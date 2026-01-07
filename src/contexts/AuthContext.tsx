import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../utils/api'

interface User {
  id: number
  customerId: string
  customerName: string
  customerCode: string
  username: string
  displayName?: string
  email?: string
  phone?: string
  userType: 'master' | 'sub'  // 主账户 or 子账户
  roleId?: number
  roleName?: string
  permissions: string[]  // 权限代码数组
  // 工作人员代登录相关字段
  staffProxy?: boolean
  staffName?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  loginWithToken: (token: string) => Promise<void>  // 工作人员代登录使用
  logout: () => void
  updateUser: (user: User) => void
  // 权限判断方法
  hasPermission: (permission: string | string[]) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  isMasterAccount: () => boolean
  // 代登录标记
  isStaffProxy: boolean
  staffInfo: { staffId: number; staffName: string; staffRole: string } | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  // 从 localStorage 初始化状态
  const [user, setUser] = useState<User | null>(() => {
    // 尝试从 localStorage 恢复用户信息
    const savedUser = localStorage.getItem('portal_user')
    if (savedUser) {
      try {
        return JSON.parse(savedUser)
      } catch {
        return null
      }
    }
    return null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('portal_token'))
  const [loading, setLoading] = useState(() => {
    // 如果有 token 但没有用户信息，则需要加载
    const hasToken = !!localStorage.getItem('portal_token')
    const hasUser = !!localStorage.getItem('portal_user')
    return hasToken && !hasUser
  })

  // 初始化时设置 Authorization header，只在需要时验证 token
  useEffect(() => {
    const initAuth = async () => {
      // 如果已经有 token，设置 Authorization header
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      }
      
      // 如果已经有 user 数据，不需要验证
      if (user) {
        setLoading(false)
        return
      }
      
      // 如果有 token 但没有 user，需要验证
      if (token && !user) {
        try {
          const response = await api.get('/auth/me')
          if (response.data.errCode === 200) {
            const data = response.data.data
            // 转换字段名
            const userData: User = {
              id: data.id,
              customerId: data.customerId,
              customerName: data.companyName || data.customerName,
              customerCode: data.customerCode || data.customerId,
              username: data.username || data.email,
              displayName: data.displayName || data.contactPerson,
              email: data.email,
              phone: data.phone,
              userType: data.userType || 'master',
              roleId: data.roleId,
              roleName: data.roleName,
              permissions: data.permissions || []
            }
            // 保存到 localStorage
            localStorage.setItem('portal_user', JSON.stringify(userData))
            setUser(userData)
          } else {
            // Token 无效
            handleLogout()
          }
        } catch (error) {
          handleLogout()
        }
      }
      setLoading(false)
    }
    
    initAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 只在组件挂载时执行一次

  const handleLogout = () => {
    localStorage.removeItem('portal_token')
    localStorage.removeItem('portal_user')
    delete api.defaults.headers.common['Authorization']
    setToken(null)
    setUser(null)
  }

  const login = async (username: string, password: string) => {
    // 使用门户后端 API 登录
    const response = await api.post('/auth/login', { username, password })
    
    if (response.data.errCode !== 200) {
      throw new Error(response.data.msg || '登录失败')
    }
    
    const { token: newToken, customer } = response.data.data
    
    // 转换字段名
    const userData: User = {
      id: customer.id,
      customerId: customer.customerId,
      customerName: customer.companyName,
      customerCode: customer.customerCode || customer.customerId,
      username: customer.username || customer.email,
      displayName: customer.displayName || customer.contactPerson,
      email: customer.email,
      phone: customer.phone,
      userType: customer.userType || 'master',
      roleId: customer.roleId,
      roleName: customer.roleName,
      permissions: customer.permissions || []
    }
    
    // 保存到 localStorage（确保状态持久化）
    localStorage.setItem('portal_token', newToken)
    localStorage.setItem('portal_user', JSON.stringify(userData))
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    setToken(newToken)
    setUser(userData)
  }

  /**
   * 通过 Token 直接登录（用于工作人员代登录）
   * Token 是由 ERP 系统工作人员代登录 API 生成的
   */
  const loginWithToken = async (proxyToken: string) => {
    // 先设置 token 到 header
    api.defaults.headers.common['Authorization'] = `Bearer ${proxyToken}`
    
    try {
      // 验证 token 并获取用户信息
      const response = await api.get('/auth/me')
      
      if (response.data.errCode !== 200) {
        delete api.defaults.headers.common['Authorization']
        throw new Error(response.data.msg || '代登录失败：Token 无效')
      }
      
      const data = response.data.data
      
      // 转换字段名
      const userData: User = {
        id: data.id,
        customerId: data.customerId,
        customerName: data.companyName || data.customerName,
        customerCode: data.customerCode || data.customerId,
        username: data.username || data.email,
        displayName: data.displayName || data.contactPerson,
        email: data.email,
        phone: data.phone,
        userType: data.userType || 'master',
        roleId: data.roleId,
        roleName: data.roleName,
        permissions: data.permissions || [],
        // 代登录标记
        staffProxy: data.staffProxy || false,
        staffName: data.staffName
      }
      
      // 保存到 localStorage
      localStorage.setItem('portal_token', proxyToken)
      localStorage.setItem('portal_user', JSON.stringify(userData))
      setToken(proxyToken)
      setUser(userData)
    } catch (error) {
      delete api.defaults.headers.common['Authorization']
      throw error
    }
  }

  const logout = () => {
    handleLogout()
  }

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser)
  }

  /**
   * 检查用户是否拥有指定权限
   * 主账户默认拥有所有权限
   * @param permission 单个权限代码或权限代码数组（数组时满足任一即可）
   */
  const hasPermission = (permission: string | string[]): boolean => {
    if (!user) return false
    
    // 主账户拥有所有权限
    if (user.userType === 'master') return true
    
    const permissions = Array.isArray(permission) ? permission : [permission]
    return permissions.some(p => user.permissions.includes(p))
  }

  /**
   * 检查用户是否拥有数组中的任一权限
   */
  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!user) return false
    if (user.userType === 'master') return true
    return permissions.some(p => user.permissions.includes(p))
  }

  /**
   * 检查用户是否拥有数组中的所有权限
   */
  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!user) return false
    if (user.userType === 'master') return true
    return permissions.every(p => user.permissions.includes(p))
  }

  /**
   * 检查是否为主账户
   */
  const isMasterAccount = (): boolean => {
    return user?.userType === 'master'
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user,
      loading,
      login,
      loginWithToken,
      logout,
      updateUser,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      isMasterAccount,
      // 代登录相关
      isStaffProxy: user?.staffProxy || false,
      staffInfo: user?.staffProxy ? {
        staffId: 0, // 暂时没有传递
        staffName: user.staffName || '',
        staffRole: ''
      } : null
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * 权限守卫组件
 * 用于包裹需要权限控制的组件
 */
interface PermissionGuardProps {
  permission: string | string[]
  requireAll?: boolean
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGuard({ 
  permission, 
  requireAll = false, 
  fallback = null, 
  children 
}: PermissionGuardProps) {
  const { hasPermission, hasAllPermissions } = useAuth()
  
  const hasAccess = requireAll 
    ? hasAllPermissions(Array.isArray(permission) ? permission : [permission])
    : hasPermission(permission)
  
  if (!hasAccess) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}

/**
 * 主账户守卫组件
 * 仅主账户可见的内容
 */
interface MasterAccountGuardProps {
  fallback?: ReactNode
  children: ReactNode
}

export function MasterAccountGuard({ fallback = null, children }: MasterAccountGuardProps) {
  const { isMasterAccount, hasPermission } = useAuth()
  
  // 主账户或有用户管理权限的子账户
  if (!isMasterAccount() && !hasPermission('users:manage')) {
    return <>{fallback}</>
  }
  
  return <>{children}</>
}
