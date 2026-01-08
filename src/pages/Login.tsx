import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, AlertCircle, UserCheck } from 'lucide-react'
import { fetchSystemLogo } from '../App'

export default function Login() {
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [proxyLoginLoading, setProxyLoginLoading] = useState(false)
  const tokenLoginAttempted = useRef(false)  // 防止重复尝试 token 登录
  
  const { login, loginWithToken, isAuthenticated, loading: authLoading } = useAuth()

  // 如果用户已登录（页面初始加载时检查），直接跳转到首页
  // 使用 window.location 而不是 navigate，避免 React Router 状态问题
  useEffect(() => {
    // 只在初始加载完成后检查，避免闪烁
    if (!authLoading && isAuthenticated && !proxyLoginLoading) {
      window.location.href = '/'
    }
  }, [authLoading, isAuthenticated, proxyLoginLoading])

  // 获取系统 Logo（使用共享缓存）
  useEffect(() => {
    const loadLogo = async () => {
      const url = await fetchSystemLogo()
      if (url) {
        setLogoUrl(url)
      }
    }
    loadLogo()
  }, [])

  // 处理工作人员代登录（通过 URL 中的 token 参数）
  useEffect(() => {
    const tokenParam = searchParams.get('token')
    
    // 如果有 token 参数且还没尝试过登录
    if (tokenParam && !tokenLoginAttempted.current && !authLoading) {
      tokenLoginAttempted.current = true
      setProxyLoginLoading(true)
      setError('')
      
      // 先清除旧的登录状态，确保使用新 token 的客户信息
      localStorage.removeItem('portal_token')
      localStorage.removeItem('portal_user')
      
      // 使用 token 直接登录
      loginWithToken(tokenParam)
        .then(() => {
          // 登录成功，跳转到首页
          window.location.href = '/'
        })
        .catch((err: Error) => {
          setError(err.message || '代登录失败，请使用用户名密码登录')
          setProxyLoginLoading(false)
        })
    }
  }, [searchParams, loginWithToken, authLoading])

  // 从 URL 参数自动填充用户名
  useEffect(() => {
    const usernameParam = searchParams.get('username')
    if (usernameParam) {
      setUsername(usernameParam)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码')
      return
    }
    
    setLoading(true)
    
    try {
      await login(username, password)
      // 登录成功后，使用 window.location 强制完整页面导航
      // 避免 React Router 的状态问题
      window.location.href = '/'
    } catch (err: any) {
      setError(err.response?.data?.msg || err.message || '登录失败，请检查用户名和密码')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* 左侧品牌区 */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-700 to-primary-600" />
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1.5">
              {/* Logo - 从主系统获取 */}
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <path d="M16.5 9.4 7.55 4.24"/>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.29 7 12 12 20.71 7"/>
                  <line x1="12" x2="12" y1="22" y2="12"/>
                </svg>
              )}
            </div>
            <span className="text-xl font-semibold">BP Logistics Sys</span>
          </div>
          <h1 className="text-3xl font-bold mb-3">客户门户系统</h1>
          <p className="text-base text-white/80 mb-8">
            实时追踪您的货物，查看账单，管理运输订单
          </p>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[14px]">实时订单状态追踪</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[14px]">在线账单查询与管理</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[14px]">API 接口自助对接</span>
            </div>
          </div>
        </div>
        {/* 装饰图形 */}
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/5 rounded-full" />
      </div>

      {/* 右侧登录表单 */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* 工作人员代登录加载中 */}
          {proxyLoginLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-6 h-6 text-primary-600 animate-pulse" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">工作人员代登录</h2>
              <p className="text-sm text-gray-500 mb-4">正在验证登录信息，请稍候...</p>
              <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}

          {/* 移动端 Logo 和登录表单 */}
          {!proxyLoginLoading && (
          <>
          <div className="lg:hidden flex items-center justify-center space-x-2 mb-6">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center p-1.5 shadow-sm">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <path d="M16.5 9.4 7.55 4.24"/>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.29 7 12 12 20.71 7"/>
                  <line x1="12" x2="12" y1="22" y2="12"/>
                </svg>
              )}
            </div>
            <span className="text-lg font-semibold text-gray-800">BP Logistics 客户门户</span>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">欢迎登录</h2>
              <p className="mt-1 text-[13px] text-gray-500">请输入您的账户信息</p>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-[13px] text-red-700">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-[13px] font-medium text-gray-700 mb-1">
                  用户名
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-md focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                  placeholder="请输入用户名"
                  autoComplete="username"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-[13px] font-medium text-gray-700 mb-1">
                  密码
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-9 px-3 pr-10 text-[13px] border border-gray-200 rounded-md focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    placeholder="请输入密码"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-medium rounded-md transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  '登录'
                )}
              </button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-[12px] text-gray-500">
                如需开通账户，请联系您的业务经理
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-gray-400">
            © {new Date().getFullYear()} BP Logistics Sys. All rights reserved.
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
