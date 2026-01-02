import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../utils/api'

interface User {
  id: number
  customerId: string
  customerName: string
  customerCode: string
  username: string
  email?: string
  phone?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
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
              customerCode: data.customerCode || data.customerId,  // 优先使用 customerCode
              username: data.username || data.email,
              email: data.email,
              phone: data.phone
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
    const userData = {
      id: customer.id,
      customerId: customer.customerId,
      customerName: customer.companyName,
      customerCode: customer.customerCode || customer.customerId,  // 优先使用 customerCode
      username: customer.email,
      email: customer.email,
      phone: customer.phone
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

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user,
      loading,
      login,
      logout,
      updateUser
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

