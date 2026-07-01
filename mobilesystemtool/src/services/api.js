import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 60000,
  headers: {
    'ngrok-skip-browser-warning': '1',
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('เชื่อมต่อช้าเกินไป กรุณาลองใหม่อีกครั้ง'))
    }
    const msg = error.response?.data?.msg || error.response?.data?.ERROR || error.message || 'เกิดข้อผิดพลาด'
    return Promise.reject(new Error(msg))
  }
)

export default api
