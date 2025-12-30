import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api, { mainApi } from '../utils/api'

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
          mainApi.defaults.headers.common['Authorization'] = `Bearer ${token}`
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          const response = await mainApi.get('/auth/me')
          if (response.data.errCode === 200) {
            setUser(response.data.data)
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
    delete mainApi.defaults.headers.common['Authorization']
    delete api.defaults.headers.common['Authorization']
    setToken(null)
    setUser(null)
  }

  const login = async (username: string, password: string) => {
    // 使用主系统的 Portal API 登录
    const response = await mainApi.post('/auth/login', { username, password })
    
    if (response.data.errCode !== 200) {
      throw new Error(response.data.msg || '登录失败')
    }
    
    const { token: newToken, user: userData } = response.data.data
    
    localStorage.setItem('portal_token', newToken)
    mainApi.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
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

