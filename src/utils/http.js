// src/utils/http.js
import axios from 'axios';

const apiBaseUrl = 'https://logwire-zc.unlcn.com/veh_gps/';
// const apiBaseUrl = 'http://localhost:8090/veh_gps';

// 获取GPS轨迹数据
export const getGpsTrace = async (shipmentId) => {
  try {
    const response = await axios.get(`${apiBaseUrl}/trace/getTraces`, {
      params: { shipmentId },
    });
    // console.log(response.data)
    if (response.data.success) {
      return response.data.data;  // 返回轨迹数据
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error('获取轨迹数据失败:', error);
    throw error;
  }
};

// 获取在途停留数据
export const getKeyPointStops = async (shipmentId) => {
  try {
    const response = await axios.get(`${apiBaseUrl}/trace/getStops`, {
      params: { shipmentId }
    });
    if (response.data.success) {
      return response.data.data; // 返回停留数据
    } else {
      throw new Error(response.data.message || '请求失败');
    }
  } catch (error) {
    console.error('获取停留数据失败:', error);
    throw error;
  }
};


// // 添加请求拦截器
// http.interceptors.request.use(
//   config => {
//     // 在请求前可以做一些处理，比如加入 token 等
//     return config;
//   },
//   error => {
//     return Promise.reject(error);
//   }
// );

// // 添加响应拦截器
// http.interceptors.response.use(
//   response => response.data,
//   error => {
//     // 处理错误
//     return Promise.reject(error);
//   }
// );

// export default http;
