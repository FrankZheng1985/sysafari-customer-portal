import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { portalApi } from '../utils/api'
import {
  LayoutDashboard,
  Package,
  FileText,
  CreditCard,
  Book,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Bell,
  Calculator
} from 'lucide-react'

const navigation = [
  { name: '仪表盘', href: '/', icon: LayoutDashboard },
  { name: '订单管理', href: '/orders', icon: Package },
  { name: '在线询价', href: '/quote', icon: Calculator },
  { name: '关税计算', href: '/tariff-calculator', icon: Calculator },
  { name: '账单查询', href: '/invoices', icon: FileText },
  { name: '应付账款', href: '/payables', icon: CreditCard },
  { name: 'API 文档', href: '/api-docs', icon: Book },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  // 获取系统 Logo
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await portalApi.getSystemLogo()
        if (response.data.errCode === 200 && response.data.data?.logoUrl) {
          setLogoUrl(response.data.data.logoUrl)
        }
      } catch (error) {
        console.error('获取 Logo 失败:', error)
      }
    }
    fetchLogo()
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-56 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-gray-200 bg-primary-600">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center p-1">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Package className="w-5 h-5 text-primary-600" />
              )}
            </div>
            <span className="text-base font-semibold text-white">客户门户</span>
          </div>
          <button 
            className="lg:hidden ml-auto p-1 rounded-lg hover:bg-white/10"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center px-3 py-2 mb-0.5 rounded-md text-[13px] font-medium transition-colors
                ${isActive 
                  ? 'bg-primary-50 text-primary-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <item.icon className="w-[18px] h-[18px] mr-2.5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* 底部用户信息 */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <div className="ml-2.5 min-w-0">
                <p className="text-[13px] font-medium text-gray-700 truncate">
                  {user?.customerName || user?.username}
                </p>
                <p className="text-[11px] text-gray-500 truncate">
                  {user?.customerCode}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 顶部导航栏 */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 flex-shrink-0">
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex-1" />
          
          {/* 通知图标 */}
          <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 mr-2">
            <Bell className="w-5 h-5" />
          </button>
          
          {/* 用户下拉菜单 */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-gray-100"
            >
              <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-primary-600" />
              </div>
              <span className="hidden sm:block text-[13px] font-medium text-gray-700">
                {user?.customerName}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            
            {userMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setUserMenuOpen(false)} 
                />
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <div className="p-3 border-b border-gray-100">
                    <p className="text-[13px] font-medium text-gray-900">{user?.customerName}</p>
                    <p className="text-[11px] text-gray-500">{user?.email || user?.username}</p>
                  </div>
                  <div className="py-1">
                    <NavLink
                      to="/settings"
                      className="flex items-center px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings className="w-4 h-4 mr-2 text-gray-400" />
                      账户设置
                    </NavLink>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false)
                        handleLogout()
                      }}
                      className="w-full flex items-center px-3 py-2 text-[13px] text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      退出登录
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-auto p-5 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
