import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { portalApi } from '../utils/api'
import { User, Lock, CheckCircle, AlertCircle } from 'lucide-react'

export default function Settings() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  
  // 密码修改
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: '两次输入的密码不一致' })
      return
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: '新密码长度不能少于8位' })
      return
    }

    setPasswordLoading(true)
    try {
      const res = await portalApi.changePassword(
        passwordForm.oldPassword,
        passwordForm.newPassword
      )
      
      if (res.data.errCode === 200) {
        setPasswordMessage({ type: 'success', text: '密码修改成功' })
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        setPasswordMessage({ type: 'error', text: res.data.msg || '修改失败' })
      }
    } catch (error: any) {
      setPasswordMessage({ type: 'error', text: error.response?.data?.msg || '修改失败' })
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-page-title">账户设置</h1>
        <p className="text-small mt-1">管理您的账户信息和安全设置</p>
      </div>

      {/* 标签页 */}
      <div className="card">
        <div className="border-b border-gray-100">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 border-b-2 text-sm font-medium transition-colors flex items-center ${
                activeTab === 'profile'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="w-4 h-4 mr-2" />
              基本信息
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`py-4 border-b-2 text-sm font-medium transition-colors flex items-center ${
                activeTab === 'security'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Lock className="w-4 h-4 mr-2" />
              安全设置
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">客户名称</label>
                  <p className="text-gray-900">{user?.customerName || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">客户编号</label>
                  <p className="text-gray-900">{user?.customerCode || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">用户名</label>
                  <p className="text-gray-900">{user?.username || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">邮箱</label>
                  <p className="text-gray-900">{user?.email || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">手机号</label>
                  <p className="text-gray-900">{user?.phone || '-'}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  如需修改账户信息，请联系您的业务经理或管理员
                </p>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-md">
              <h3 className="text-lg font-medium text-gray-900 mb-4">修改密码</h3>
              
              {passwordMessage && (
                <div className={`mb-4 p-4 rounded-lg flex items-center space-x-3 ${
                  passwordMessage.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  {passwordMessage.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${passwordMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                    {passwordMessage.text}
                  </span>
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    原密码
                  </label>
                  <input
                    type="password"
                    value={passwordForm.oldPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    新密码
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="input"
                    required
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">密码长度至少8位</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    确认新密码
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="input"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="btn btn-primary"
                >
                  {passwordLoading ? '修改中...' : '修改密码'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

