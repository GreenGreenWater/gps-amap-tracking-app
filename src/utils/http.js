// src/utils/http.js
import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const apiKey = import.meta.env.VITE_API_KEY;

// 创建 axios 实例并配置默认请求头
const axiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'X-API-KEY': apiKey
  }
});

// 添加响应拦截器
axiosInstance.interceptors.response.use(
  response => {
    // 如果响应成功，直接返回数据
    if (response.data.success) {
      return response.data;
    } else {
      // 业务逻辑错误
      console.error('请求失败:', response.data.message);
      return Promise.reject(new Error(response.data.message || '请求失败'));
    }
  },
  error => {
    // 处理网络错误、超时等
    console.error('请求错误:', {
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// 获取GPS轨迹数据
export const getGpsTrace = async (shipmentId) => {
  try {
    const response = await axiosInstance.get('trace/getTraces', {
      params: { shipmentId },
    });
    return response.data; // 由于拦截器已处理了 success 判断，这里直接返回 data
  } catch (error) {
    console.error('获取轨迹数据失败:', error);
    throw error;
  }
};

// 获取在途停留数据
export const getKeyPointStops = async (shipmentId) => {
  try {
    const response = await axiosInstance.get('trace/getStays', {
      params: { shipmentId }
    });
    return response.data; // 由于拦截器已处理了 success ��断，这里直接返回 data
  } catch (error) {
    console.error('获取停留数据失败:', error);
    throw error;
  }
};

// 获取指令站点数据
export const getShipmentStops = async (shipmentId) => {
  try {
    const response = await axiosInstance.get('vehGps/getShipmentStops', {
      params: { shipmentId }
    });
    return response.data;
  } catch (error) {
    console.error('获取指令站点数据失败:', error);
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
