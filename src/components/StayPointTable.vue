<template>
    <el-table :data="stopsData" style="width: 100%" height="200px">
      <el-table-column type="index" label="序号" width="80" />
      <el-table-column prop="vehNo" label="车辆号" width="120"></el-table-column>
      <el-table-column label="轨迹时间" :formatter="(row) => formatDate(row.pkgTs)" width="180"></el-table-column>
      <el-table-column prop="speed" label="速度"  width="60"></el-table-column>
      <el-table-column prop="addr" label="停留地址" show-overflow-tooltip width="200"></el-table-column>
      <el-table-column prop="totalMiles" label="总里程(KM)" width="100"></el-table-column>
    </el-table>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { getGpsTrace, getKeyPointStops } from '../utils/http'; // 导入 http.js 中的函数

let stopsData = ref([])

// 获取停留数据并更新表格
const fetchStopsData = async (shipmentId) => {
  try {
    stopsData.value = await getKeyPointStops(shipmentId); // 调用 http.js 中的 API
  } catch (error) {
    console.error("获取停留数据失败:", error);
  }
}

const fetchGpsResultData = async (shipmentId) => {
  try {
    stopsData.value = await getGpsTrace(shipmentId); // 调用 http.js 中的 API
  } catch (error) {
    console.error("获取停留数据失败:", error);
  }
}

// 格式化时间为易读的日期时间
const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
}

onMounted(() => {
  const shipmentId = new URLSearchParams(window.location.search).get('shipmentId');
  if (shipmentId) {
    fetchGpsResultData(shipmentId)
  }
})

onUnmounted(() => {

})

</script>

<style>
#info-container {
  top: 10px;
  left: 40px;
  /* 下部停留信息表格占 35% */
  height: 15vh;
  width: 100%;
  padding: 10px;
  overflow-y: scroll;
}

</style>
