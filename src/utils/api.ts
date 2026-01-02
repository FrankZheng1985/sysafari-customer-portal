import axios from 'axios'

// API 基础地址配置
// 本地开发时，前端代理到本地门户后端 (3003)，但数据从主系统 (3001) 获取
// 生产环境时，通过环境变量配置
const PORTAL_API_URL = import.meta.env.VITE_PORTAL_API_URL || '/api'  // 门户后端
const MAIN_API_URL = import.meta.env.VITE_MAIN_API_URL || 'http://localhost:3001/api/portal'  // 主系统 Portal API

// 创建门户后端 axios 实例（用于门户自身功能）
const api = axios.create({
  baseURL: PORTAL_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 创建主系统 axios 实例（用于获取订单、账单等数据）
const mainApi = axios.create({
  baseURL: MAIN_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 门户后端请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('portal_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 主系统请求拦截器
mainApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('portal_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 门户后端响应拦截器
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期或无效
      localStorage.removeItem('portal_token')
      localStorage.removeItem('portal_customer')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// 主系统响应拦截器
mainApi.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('portal_token')
      localStorage.removeItem('portal_customer')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
export { mainApi }

// API 辅助函数
export const portalApi = {
  // ==================== 认证相关（使用主系统 Portal API）====================
  login: (username: string, password: string) => 
    mainApi.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => mainApi.get('/auth/me'),
  changePassword: (oldPassword: string, newPassword: string) => 
    mainApi.post('/auth/change-password', { oldPassword, newPassword }),
  
  // ==================== 订单相关（从主系统获取）====================
  getOrders: (params?: {
    page?: number
    pageSize?: number
    status?: string
    keyword?: string
    startDate?: string
    endDate?: string
  }) => mainApi.get('/orders', { params }),
  
  getOrderById: (id: string) => mainApi.get(`/orders/${id}`),
  
  getOrderTracking: (id: string) => mainApi.get(`/orders/${id}/tracking`),
  
  getOrderStats: () => mainApi.get('/orders/stats'),
  
  // ==================== 财务/账单相关（从主系统获取）====================
  getInvoices: (params?: {
    page?: number
    pageSize?: number
    status?: string
    startDate?: string
    endDate?: string
  }) => mainApi.get('/invoices', { params }),
  
  getInvoiceById: (id: string) => mainApi.get(`/invoices/${id}`),
  
  downloadInvoicePdf: (id: string) => 
    mainApi.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  
  getPayablesSummary: () => mainApi.get('/payables'),
  
  getFinanceStats: (params?: { year?: number; month?: number }) => 
    mainApi.get('/payables', { params }),
  
  // ==================== API 密钥管理（从主系统获取）====================
  getApiKeys: () => mainApi.get('/api-keys'),
  
  createApiKey: (data: {
    keyName: string
    permissions?: string[]
    rateLimit?: number
    expiresAt?: string
  }) => mainApi.post('/api-keys', data),
  
  updateApiKey: (id: string, data: {
    keyName?: string
    permissions?: string[]
    rateLimit?: number
  }) => mainApi.put(`/api-keys/${id}`, data),
  
  revokeApiKey: (id: string) => mainApi.delete(`/api-keys/${id}`),
  
  getApiKeyStats: (_id: string) => mainApi.get(`/api-logs`),
  
  // ==================== 系统信息 ====================
  getHealth: () => api.get('/health'),

  // ==================== 从主系统获取的接口 ====================
  // 应付款（dashboard 使用）
  getPayables: () => mainApi.get('/payables'),
  
  // 询价相关（Quote 页面使用）- 使用门户后端 API
  getInquiries: (params?: any) => api.get('/inquiries', { params }),
  getInquiryById: (id: string) => api.get(`/inquiries/${id}`),
  createInquiry: (data: any) => api.post('/inquiries', data),
  acceptQuote: (id: string) => api.post(`/inquiries/${id}/accept`),
  rejectQuote: (id: string, reason?: string) => api.post(`/inquiries/${id}/reject`, { reason }),
  
  // Excel上传（货物明细导入）
  uploadCargoExcel: (formData: FormData) => api.post('/clearance/upload-excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  // 待确认匹配结果相关
  getPendingConfirmations: () => api.get('/inquiries/pending-confirmations'),
  confirmMatching: (id: string) => api.post(`/inquiries/${id}/confirm-matching`),
  rejectMatching: (id: string, reason: string) => api.post(`/inquiries/${id}/reject-matching`, { reason }),
  
  // 运输计算 - 使用门户后端 API
  calculateTransport: (data: any) => api.post('/transport/calculate', data),
  
  // 清关估算 - 使用门户后端 API
  estimateClearance: (data: any) => api.post('/clearance/estimate', data),
  
  // 卡车类型 - 使用门户后端 API
  getTruckTypes: (params?: any) => api.get('/truck-types', { params }),
  recommendTruckType: (weight: number, volume: number) => 
    api.get('/truck-types/recommend', { params: { weight, volume } }),
  
  // 地理编码
  geocodeAddress: (address: string) => mainApi.get('/geocode', { params: { address } }),
  
  // 地址管理
  getCustomerAddresses: () => api.get('/addresses'),
  searchAddresses: (params: { query: string; limit?: number }) => api.get('/addresses/search', { params }),
  saveNewAddress: (data: { address: string; label?: string; city?: string; country?: string; postalCode?: string; latitude?: number; longitude?: number }) => api.post('/addresses', data),
  
  // ==================== 基础数据（从主系统获取）====================
  // 起运港
  getPortsOfLoading: (params?: { country?: string; search?: string }) => 
    mainApi.get('/base-data/ports-of-loading', { params }),
  
  // 目的港
  getDestinationPorts: (params?: { country?: string; search?: string }) => 
    mainApi.get('/base-data/destination-ports', { params }),
  
  // 机场
  getAirPorts: (params?: { country?: string; search?: string }) => 
    mainApi.get('/base-data/air-ports', { params }),
  
  // 国家
  getCountries: (params?: { region?: string; search?: string }) => 
    mainApi.get('/base-data/countries', { params }),
  
  // 城市
  getCities: (params?: { countryCode?: string; search?: string; level?: number }) => 
    mainApi.get('/base-data/cities', { params }),
  
  // 常用位置（汇总）
  getLocations: (params?: { type?: 'origin' | 'destination' | 'all'; search?: string }) => 
    mainApi.get('/base-data/locations', { params }),
  
  // 创建订单
  createOrder: (data: any) => mainApi.post('/orders', data),
  
  // 下载 Excel（账单页面使用）
  downloadInvoiceExcel: (id: string) => 
    mainApi.get(`/invoices/${id}/excel`, { responseType: 'blob' })
}
