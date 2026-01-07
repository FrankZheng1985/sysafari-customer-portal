import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import NewOrder from './pages/NewOrder'
import Invoices from './pages/Invoices'
import Payables from './pages/Payables'
import Quote from './pages/Quote'
import TariffCalculator from './pages/TariffCalculator'
import ApiDocs from './pages/ApiDocs'
import Settings from './pages/Settings'
import UserManagement from './pages/UserManagement'
import { portalApi } from './utils/api'

// 缓存 Logo URL，避免重复请求
let cachedLogoUrl: string | null = null
let logoFetchPromise: Promise<string | null> | null = null

export async function fetchSystemLogo(): Promise<string | null> {
  // 如果已缓存，直接返回
  if (cachedLogoUrl) return cachedLogoUrl
  
  // 如果正在请求中，返回同一个 Promise
  if (logoFetchPromise) return logoFetchPromise
  
  logoFetchPromise = (async () => {
    try {
      const response = await portalApi.getSystemLogo()
      if (response.data.errCode === 200 && response.data.data?.logoUrl) {
        cachedLogoUrl = response.data.data.logoUrl
        return cachedLogoUrl
      }
    } catch (error) {
      console.error('获取 Logo 失败:', error)
    }
    return null
  })()
  
  return logoFetchPromise
}

// 动态设置 Favicon 为公司 Logo
function FaviconUpdater() {
  useEffect(() => {
    const updateFavicon = async () => {
      const logoUrl = await fetchSystemLogo()
      if (logoUrl) {
        // 查找现有的 favicon link 标签
        let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement
        
        if (!link) {
          // 如果不存在，创建一个新的
          link = document.createElement('link')
          link.rel = 'icon'
          document.head.appendChild(link)
        }
        
        // 设置 favicon 为公司 Logo
        link.type = 'image/png'
        link.href = logoUrl
      }
    }
    
    updateFavicon()
  }, [])
  
  return null
}

// 受保护的路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, token } = useAuth()
  
  // 如果正在加载，或者有 token 但还未验证完成，显示加载状态
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  
  // 没有 token 或者认证失败，重定向到登录页
  if (!isAuthenticated && !token) {
    return <Navigate to="/login" replace />
  }
  
  // 有 token 但还没验证完成（user 还是 null），显示加载状态
  if (token && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  
  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <FaviconUpdater />
      <Router>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<Login />} />
          
          {/* 受保护的路由 */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="orders/new" element={<NewOrder />} />
            <Route path="quote" element={<Quote />} />
            <Route path="tariff-calculator" element={<TariffCalculator />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="payables" element={<Payables />} />
            <Route path="api-docs" element={<ApiDocs />} />
            <Route path="settings" element={<Settings />} />
            <Route path="users" element={<UserManagement />} />
          </Route>
          
          {/* 404 重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

