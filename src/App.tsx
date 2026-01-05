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
import { portalApi } from './utils/api'

// 动态设置 Favicon 为公司 Logo
function FaviconUpdater() {
  useEffect(() => {
    const updateFavicon = async () => {
      try {
        const response = await portalApi.getSystemLogo()
        if (response.data.errCode === 200 && response.data.data?.logoUrl) {
          const logoUrl = response.data.data.logoUrl
          
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
      } catch (error) {
        console.error('更新 Favicon 失败:', error)
      }
    }
    
    updateFavicon()
  }, [])
  
  return null
}

// 受保护的路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
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
          </Route>
          
          {/* 404 重定向 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

