<template>
  <div style="height: 100%; overflow-y: none;">
    <!-- 上部高德地图 -->
    <div id="map-container" style="width: 100%;"></div>
    <div id="poi-picker" style="position: absolute; top: 10px; left: 10px; z-index: 999;">
      <input type="text" v-model="poiQuery" placeholder="请输入要查找的地点" @input="onInput" @focus="onFocus" @blur="onBlur" />
      <ul v-if="poiSuggestions.length" style="list-style-type: none; padding: 0;">
        <li v-for="(suggestion, index) in poiSuggestions" :key="index" @click="onSuggestionClick(suggestion)">
          {{ suggestion.name }}
        </li>
      </ul>
    </div>
    <!-- 添加右上角的指令查询输入框 -->
    <div id="control-panel"
      style="position: absolute; top: 20px; right: 20px; z-index: 1000; background: rgba(255, 255, 255, 0.7); padding: 10px; border-radius: 5px;">
      <input type="text" id="shipmentIdInput" placeholder="输入 调度指令号"
        style="padding: 5px; width: 200px; margin-right: 10px;">
      <button id="queryBtn" style="padding: 5px 10px;" @click="getTracesAndRender">查询</button>
    </div>
    <div id="info-container">
      <el-table :data="staysData" stripe :header-cell-style="{ 'background': '#c5def4' }" style="width: 100%"
        :max-height="'calc(35vh - 10px)'" :row-class-name="tableRowClassName">
        <el-table-column type="index" label="序号" width="80" />
        <el-table-column prop="vehNo" label="车辆号" width="120"></el-table-column>
        <el-table-column label="停留开始时间" :formatter="(row) => formatDate(row.startTime)" width="180"></el-table-column>
        <el-table-column label="停留结束时间" :formatter="(row) => formatDate(row.endTime)" width="180"></el-table-column>
        <el-table-column prop="addr" label="停留地址" show-overflow-tooltip width="200"></el-table-column>
        <el-table-column prop="stayInMinutes" label="停留时长(分钟)" width="100"></el-table-column>
        <el-table-column label="是否卸货点" :formatter="(row) => formatBoolean(row.matchedSomeDeliverPoint)"
          width="100"></el-table-column>
        <el-table-column prop="totalMiles" label="总里程(KM)" width="100"></el-table-column>
        <el-table-column label="操作" width="120">
          <template v-slot="scope">
            <el-button @click="showOnMap(scope.row)" size="small">查看位置</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

  </div>
</template>

<script setup>
import AMapLoader from '@amap/amap-jsapi-loader';  // 导入 AMapLoader
import { ref, onMounted, onUnmounted } from 'vue'
import icon_of_truck from '@/assets/car.png';
import { getGpsTrace, getKeyPointStops, getShipmentStops } from '../utils/http'; // 导入 http.js 中的函数

let map = ref(null);
let poiQuery = ref(null)  // POI 搜索框的查询关键字
let poiSuggestions = []  // 保存 POI 自动补全的建议
let poiMarker = ref(null)  // 用于保存当前选中的 POI 标记
let AMap = ref(null)  // 用于存储 AMap 对象
let autoComplete = ref(null)  // 用于存储 AMap.AutoComplete 对象
let placeSearch = ref(null)  // 用于存储 AMap.PlaceSearch 对象
let infoWindow = ref(null)
let pathSimplifierIns = ref(null)
let currentMarker = ref(null)
let staysData = ref([])
let navgtr = ref(null)
let rectangleFlagPin = ref(null)
let triangleFlagPin = ref(null)
let bsAllStops = ref([])
let destFlagMarkers = ref([])
let fivePointPin = ref(null)
let pickupMarkers = ref([])

const initAMap = async () => {
  try {
    window._AMapSecurityConfig = {
      securityJsCode: "6844e28491d0f5c0745ef1c15dfc7888",
    };
    // 使用 AMapLoader 异步加载高德地图
    const AMapModule = await AMapLoader.load({
      key: '1c35e4edce73b9414a373c04fd7bdb19',  // 在这里填写你自己的高德地图 API Key
      version: '2.0',  // 高德地图 JS API 版本
      plugins: ['AMap.Scale', 'AMap.ToolBar', 'AMap.InfoWindow', 'AMap.MapType', 'AMap.TrafficLayer', 'AMap.AutoComplete', 'AMap.PlaceSearch'],  // 加载必要的插件
      AMapUI: {
        version: '1.1',
        plugins: ['misc/PathSimplifier','overlay/SvgMarker']
      }
    });

    // 获取 AMap 对象
    AMap.value = AMapModule;

    // 初始化地图
    map.value = new AMap.value.Map('map-container', {
      zoom: 12,  // 默认缩放级别
      center: [115.869192, 28.514623],  // 默认中心点（江西中联智能物流有限公司）
    });

    // 添加比例尺控件
    const scale = new AMap.value.Scale();  // 创建比例尺控件
    map.value.addControl(scale)  // 将比例尺控件添加到地图上

    // 缩放控件
    const toolbar = new AMap.value.ToolBar();
    map.value.addControl(toolbar);

    rectangleFlagPin.value = new window.AMapUI.SvgMarker.Shape.RectangleFlagPin({
      height: 30, //高度
      //width: **, //不指定,维持默认的宽高比
      fillColor: 'orange', //填充色
      strokeWidth: 1, //描边宽度
      strokeColor: '#666' //描边颜色
      //offset:[n1, n2] //这里不设置offset，偏移本身和形状的尺寸相关，WaterDrop中实现了getOffset方法，所以不需要在构造参数中写死offset。
    });

    fivePointPin.value = new window.AMapUI.SvgMarker.Shape.FivePointsStar({
      height: 20, //高度
      fillColor: 'red', //填充色
      strokeWidth: 1, //描边宽度
      strokeColor: '#666' //描边颜色
    });

    triangleFlagPin.value = new window.AMapUI.SvgMarker.Shape.TriangleFlagPin({
      height: 40, //高度
      fillColor: 'blue', //填充色
      strokeWidth: 1, //描边宽度
      strokeColor: '#666' //描边颜色
    });

    // 初始化 AutoComplete 自动补全插件
    autoComplete.value = new AMap.value.Autocomplete({
      input: 'poiQuery',  // 输入框 ID
    });

    // 初始化 PlaceSearch 插件
    placeSearch.value = new AMap.value.PlaceSearch({
      pageSize: 20,  // 设置返回结果的数量
      pageIndex: 1,  // 设置第一页
      map: map.value,  // 设置搜索结果显示的地图
    });
    const colors = [
      "#3366cc", "#dc3912", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00",
      "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707",
      "#651067", "#329262", "#5574a6", "#3b3eac"
    ];
    // 使用 AMapUI 加载 PathSimplifier
    pathSimplifierIns.value = new window.AMapUI.PathSimplifier({
      map: map.value, // 将 PathSimplifier 与地图绑定
      zIndex: 10, // 设置图层的 Z 轴位置
      clickToSelect: false, // 点击轨迹选择简化路径
      autoSetFitView: true, // 自动调整视野以显示完整路径
      getPath: (pathData, pathIndex) => {
        const lnglatList = [];
        for (const item of pathData.path) {
          lnglatList.push([item.lng, item.lat]);
        }
        return lnglatList;
      },
      getHoverTitle: (pathData, _pathIndex, pointIndex) => {
        if (pointIndex >= 0) {
          //point 
          const point = pathData.path[pointIndex];
          // console.log(point)
          const content = `
                <div>
                  <strong>车辆号：</strong> ${point.vehNo} <br>
                  <strong>定位时间：</strong> ${formatDate(point.pkgTs)} <br>
                  <strong>省：</strong> ${point.province} <br>
                  <strong>市：</strong> ${point.city} <br>
                  <strong>区县：</strong> ${point.district || '暂无'} <br>
                  <strong>详细地址：</strong> ${point.addr} <br>
                  <strong>速度：</strong> ${point.speed} km/h <br>
                  <strong>方向：</strong> ${point.direction} <br>
                  <strong>总公里数：</strong> ${point.totalMiles} km
                </div>
              `;
          return pathData.name + content + '，点：' + pointIndex + '/' + pathData.path.length;
        }

        return pathData.name + '，点数量' + pathData.path.length;
      },
      renderOptions: {
        renderAllPointsIfNumberBelow: 200,
        pathLineStyle: {
          dirArrowStyle: true
        },
        getPathStyle: (pathItem, zoom) => {

          var color = colors[pathItem.pathIndex % colors.length],
            lineWidth = Math.round(4 * Math.pow(1.1, zoom - 3));

          return {
            pathLineStyle: {
              strokeStyle: color,
              lineWidth: lineWidth
            },
            pathLineSelectedStyle: {
              lineWidth: lineWidth + 2
            },
            pathNavigatorStyle: {
              fillStyle: color
            }
          };
        }
      },
    });

    // 获取 URL 参数并调用接口加载数据
    const shipmentId = new URLSearchParams(window.location.search).get('shipmentId');
    if (shipmentId) {
      renderPathSimplifier(shipmentId);
      fetchAndRenderDestPoint(shipmentId);
      fetchStaysData(shipmentId); // 通过 shipmentId 加载停留数据
    }

  } catch (error) {
    console.error('地图加载失败', error);
  }
}

// 获取停留数据并更新表格
const fetchStaysData = async (shipmentId) => {
  try {
    if(currentMarker.value){
      currentMarker.value.setMap(null);
    }
    staysData.value = await getKeyPointStops(shipmentId); // 调用 http.js 中的 API
  } catch (error) {
    console.error("获取停留数据失败:", error);
  }
}

const fetchAndRenderDestPoint = async (shipmentId) => {
  if(destFlagMarkers.value.length>0){
    destFlagMarkers.value.forEach((elt) =>{
      elt.setMap(null);
    })
    destFlagMarkers.value = [];
  }
  if(pickupMarkers.value.length>0){
    pickupMarkers.value.forEach((elt) =>{
      elt.setMap(null);
    })
    pickupMarkers.value = [];
  }
  getShipmentStops(shipmentId).then((data) => {
    bsAllStops.value = data;
    if (bsAllStops.value.length > 0) {
      let pickupStopsCt = 0
      bsAllStops.value.forEach((item) => {
        if (item.stopType === 'D') {
          const destPosition = new AMap.value.LngLat(parseFloat(item.longitude), parseFloat(item.latitude));
          // 使用 SvgMarker 创建旗帜标记
          const destMarker = new window.AMapUI.SvgMarker(rectangleFlagPin.value, {
            position: destPosition,
            title: `目的地- ${item.stopNum - pickupStopsCt}`,
            label: {
              content: `
              <strong>目的地: ${item.addr}</strong><br>
              <strong>地址编码: ${item.stopGid}</strong><br>
              <strong>目的地顺序: ${item.stopNum - pickupStopsCt} </strong>
              `,
              style: {
                color: 'white',
                backgroundColor: '#FF5722',
                borderRadius: '50%',
                fontSize: '16px',
                width: '30px',
                height: '30px',
                textAlign: 'center',
                lineHeight: '30px'
              }
            }
          });
          destMarker.setMap(map.value);
          destFlagMarkers.value.push(destMarker);
        }else if(item.stopType==='P'){
          pickupStopsCt ++
          const pickupPosition = new AMap.value.LngLat(parseFloat(item.longitude), parseFloat(item.latitude));
          const pickupMarker = new window.AMapUI.SvgMarker(fivePointPin.value, {
            position: pickupPosition,
            title: `装货点- ${item.stopNum}`,
            label: {
              content: `
              <strong>装货点: ${item.addr}</strong><br>
              <strong>装货点顺序: ${item.stopNum} </strong>
              `,
            }
          });
          pickupMarker.setMap(map.value);
          pickupMarkers.value.push(pickupMarker);
        }
      })
    }
  });
}

const getTracesAndRender = () => {
  const shipmentIdInput = document.getElementById('shipmentIdInput');
  const shipmentId = shipmentIdInput.value.trim();

  console.info('target shipmentId is :', shipmentId);

  if (shipmentId) {
    renderPathSimplifier(shipmentId);// 使用输入的 shipmentId 渲染轨迹
    fetchAndRenderDestPoint(shipmentId);
    fetchStaysData(shipmentId);
  } else {
    alert('请输入有效的 shipmentId');
  }
};

// 显示停留点在地图上的位置
const showOnMap = (row) => {
  const { longitude, latitude, startTime, endTime, vehNo, stayInMinutes, addr } = row;
  const index = staysData.value.indexOf(row);
  const position = new AMap.value.LngLat(parseFloat(longitude), parseFloat(latitude));
  map.value.setCenter(position); // 设置地图中心为停留点位置
  if (currentMarker.value) {
    currentMarker.value.setMap(null);
  }
  
  if(row.matchedSomeDeliverPoint){
    currentMarker.value = new window.AMapUI.SvgMarker(triangleFlagPin.value,{
      position,
      title: `车辆号：${vehNo}`,
      label: {  // 使用 label 显示序号
        content: `
          <strong>停留点序号: ${index + 1}</strong><br>
          <strong>停留时间:${stayInMinutes} 分钟</strong><br>
          <strong>自 ${new Date(startTime).toLocaleString()} 到 ${new Date(endTime).toLocaleString()}</strong><br>
          <strong>地址: ${addr}</strong>
          `,  // 显示序号
      }
    });
  }else{
  currentMarker.value = new AMap.value.Marker({
    position,
    title: `车辆号：${vehNo}`,
    label: {  // 使用 label 显示序号
      content: `
          <strong>停留点序号: ${index + 1}</strong><br>
          <strong>停留时间:${stayInMinutes} 分钟</strong><br>
          <strong>自 ${new Date(startTime).toLocaleString()} 到 ${new Date(endTime).toLocaleString()}</strong><br>
          <strong>地址: ${addr}</strong>
          `,  // 显示序号
      offset: new AMap.value.Pixel(0, -30),  // 设置标签的位置（向上偏移）
      style: {
        color: 'white',  // 设置标签的文字颜色
        backgroundColor: '#FF5722',  // 设置标签的背景色
        borderRadius: '50%',  // 设置标签的圆角
        fontSize: '16px',  // 设置字体大小
        width: '30px',  // 设置标签宽度
        height: '30px',  // 设置标签高度
        textAlign: 'center',  // 设置文字居中
        lineHeight: '30px'  // 设置文字垂直居中
      }
    }
  });
}
  currentMarker.value.setMap(map.value);
}

// PathSimplifier 方式 渲染轨迹
const renderPathSimplifier = async (shipmentId) => {
  try {
    const traceData = await getGpsTrace(shipmentId); // 获取轨迹数据

    if (!traceData || traceData.length < 0) {
      console.info(`${shipmentId} 未查询到任何轨迹数据`);
    }

    const pathData = [{ name: shipmentId, path: traceData }]
    // console.log('pathData: ', pathData)

    //设置轨迹数据
    pathSimplifierIns.value.setData(pathData);

    function onload() {
      //图片加载成功，重新绘制一次
      pathSimplifierIns.value.renderLater();
    };
    function onerror(e) {
      console.error('图片加载失败！', e);
    };

    // 创建信息窗体
    infoWindow.value = new AMap.value.InfoWindow({
      offset: new AMap.value.Pixel(1, -30),
    });

    navgtr.value = pathSimplifierIns.value.createPathNavigator(0, {
      loop: false, // 循环播放
      speed: 300000, // 巡航速度，单位千米/小时
      pathNavigatorStyle: {
        // width: 18, //不设置，使用默认的宽高比
        height: 24,
        content: window.AMapUI.PathSimplifier.Render.Canvas.getImageContent(icon_of_truck, onload, onerror), // 自定义巡航器样式
        strokeStyle: null,
        fillStyle: null,
        //经过路径的样式
        pathLinePassedStyle: {
          lineWidth: 6,
          strokeStyle: 'black',
          dirArrowStyle: {
            stepSpace: 15,
            strokeStyle: 'red'
          }
        }
      },
    });

    navgtr.value.marker = new AMap.value.Marker({
      offset: new AMap.value.Pixel(12, -10),
      content: `${pathData[0].path[0].vehNo}`,
      map: map.value
    });

    // 监听移动中巡航器
    navgtr.value.on("move", function () {
      // let idx = this.getCursor().idx; // 走到了第几个点
      // let point = pathData[0].path[idx];
      // console.info('巡航经过点 :',point);
      // navgtr.marker.setContent(point.addr);
      navgtr.value.marker.setPosition(navgtr.value.getPosition());
    });

    navgtr.value.start()

  } catch (error) {
    console.error('渲染轨迹失败:', error);
  }
};

// 格式化时间为易读的日期时间
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
}

// 格式化布尔值为易读的文本
const formatBoolean = (value) => {
  return value ? '是' : '/';
}

const tableRowClassName = ({ row }) => {
  if (row.matchedSomeDeliverPoint) {
    return 'delivery-point-row'
  }
  return ''
}

// 监听输入框变化，进行 POI 自动补全
const onInput = () => {
  if (poiQuery.value.trim()) {
    // 使用 AMap.AutoComplete 获取自动补全建议
    autoComplete.value.search(poiQuery, (status, result) => {
      if (status === 'complete' && result.info === 'OK') {
        poiSuggestions = result.tips;  // 建议列表存入 poiSuggestions
      }
    });
  } else {
    poiSuggestions = [];  // 清空建议列表
  }
}

// 聚焦时，展示建议列表
const onFocus = () => {
  if (poiQuery.value.trim() && poiSuggestions.length) {
    // poiSuggestions.value = poiSuggestions.value;  // 保证聚焦时不清空建议列表
  }
}

// 失焦时，隐藏建议列表
const onBlur = () => {
  setTimeout(() => {
    poiSuggestions = [];  // 延迟清空，避免点击事件冲突
  }, 200);
}

// 用户点击某个建议时，获取该地点的详细信息
const onSuggestionClick = (suggestion) => {
  poiQuery.value = suggestion.name;  // 将建议的名称填充到搜索框中
  const position = suggestion.location;  // 获取该地点的经纬度
  console.log("定位到 名称 [" + suggestion.name + "] 位于 : ", position)

  if (poiMarker.value) {
    poiMarker.value.setMap(null);  // 移除之前的 POI 标记
  }

  // 创建并设置新的标记
  poiMarker.value = new AMap.value.Marker({
    position: position,
    title: suggestion.name,
  });

  poiMarker.value.setMap(map.value);  // 将标记添加到地图上
  map.value.setCenter(position);  // 设置地图中心为选中的 POI

}

onMounted(() => {
  initAMap()
})

onUnmounted(() => {
  if(navgtr.value && typeof navgtr.value.destory != 'undefined'){
    navgtr.value.destory()
  }
})


</script>

<style scoped>
#map-container {
  height: 60vh;
  /* 上部高德地图占 60% */
  width: 100%;
}

#info-container {
  /* 下部停留信息表格占 35% */
  height: 35vh;
  width: 100%;
  padding: 10px;
  overflow-y: scroll;
}

#poi-picker input {
  padding: 8px;
  width: 200px;
  font-size: 14px;
  border-radius: 4px;
  border: 1px solid #ddd;
}

ul {
  background-color: white;
  border: 1px solid #ddd;
  max-height: 200px;
  overflow-y: auto;
}

li {
  padding: 8px;
  cursor: pointer;
}

li:hover {
  background-color: #f0f0f0;
}

/* 深度选择器确保样式能应用到 el-table 内部 */
:deep(.el-table) {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background-color: #f5f7fa;
}

:deep(.el-table .el-table__header) {
  background-color: #f5f7fa;
  border-radius: 8px 8px 0 0;
}

:deep(.el-table th) {
  background-color: #ffffff;
  color: #000000;
  font-weight: 500;
  text-align: center;
  vertical-align: middle;
}

:deep(.el-table td) {
  text-align: center;
  /* 水平居中 */
  vertical-align: middle;
  /* 垂直居中 */
  color: #2c3e50;
  padding: 12px 16px;
  border-right: 1px solid #d6e4ff;
  /* 淡蓝色网格线 */
  border-bottom: 1px solid #d6e4ff;
  /* 淡蓝色网格�� */
  font-size: small;
  font-family: "Microsoft YaHei", "微软雅黑", "Arial", sans-serif;
  /* 设置中文等宽字体 */
}

:deep(.el-table .el-table__row:hover) {
  background-color: #f6f8fb;
}

:deep(.el-table .el-table__row:nth-child(odd)) {
  background-color: #fafbfc;
}

/* 定制表格列宽 */
:deep(.el-table-column) {
  padding: 10px;
}

:deep(.el-table-column:nth-child(2)) {
  font-weight: bold;
}

:deep(.el-table-column:nth-child(3)),
:deep(.el-table-column:nth-child(4)) {
  color: #ebf3ef;
}

:deep(.delivery-point-row) {
  font-weight: bold;
  font-style: italic;
}

</style>
