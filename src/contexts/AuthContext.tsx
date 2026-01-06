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
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
  // 权限判断方法
  hasPermission: (permission: string | string[]) => boolean
  hasAnyPermission: (permissions: string[]) => boolean
  hasAllPermissions: (permissions: string[]) => boolean
  isMasterAccount: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('portal_token'))
  const [loading, setLoading] = useState(true)

  // 初始化时检查 token 有效性
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          const response = await api.get('/auth/me')
          if (response.data.errCode === 200) {
            const data = response.data.data
            // 转换字段名
            setUser({
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
            })
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
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('portal_token')
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
    
    localStorage.setItem('portal_token', newToken)
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    setToken(newToken)
    setUser(userData)
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
      logout,
      updateUser,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      isMasterAccount
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
