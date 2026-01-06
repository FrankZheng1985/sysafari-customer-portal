import { useState, useEffect } from 'react'
import { portalApi } from '../utils/api'
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Key,
  ToggleLeft,
  ToggleRight,
  Shield,
  Copy,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  UserPlus,
  Settings
} from 'lucide-react'

interface User {
  id: number
  username: string
  email: string
  display_name: string
  phone: string
  role_id: number
  role_name: string
  status: string
  last_login_at: string
  created_at: string
}

interface Role {
  id: number
  name: string
  description: string
  is_system: boolean
  is_default: boolean
  user_count: number
}

interface Permission {
  id: number
  code: string
  name: string
  module: string
  description: string
}

interface PermissionGroup {
  module: string
  moduleName: string
  permissions: Permission[]
}

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users')
  
  // 用户列表状态
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userSearchKeyword, setUserSearchKeyword] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  
  // 角色列表状态
  const [roles, setRoles] = useState<Role[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)
  
  // 权限列表状态
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([])
  
  // 弹窗状态
  const [showUserModal, setShowUserModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  
  // 编辑状态
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [deletingItem, setDeletingItem] = useState<{ type: 'user' | 'role'; id: number; name: string } | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null)
  
  // 表单状态
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
    phone: '',
    roleId: 0
  })
  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    permissionIds: [] as number[],
    isDefault: false
  })
  
  // 提示消息
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)
  
  // 加载用户列表
  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await portalApi.getUsers({
        keyword: userSearchKeyword,
        status: userStatusFilter !== 'all' ? userStatusFilter : undefined
      })
      if (res.data.errCode === 200) {
        setUsers(res.data.data.list || [])
      }
    } catch (error) {
      console.error('加载用户列表失败:', error)
    } finally {
      setUsersLoading(false)
    }
  }
  
  // 加载角色列表
  const loadRoles = async () => {
    setRolesLoading(true)
    try {
      const res = await portalApi.getRoles()
      if (res.data.errCode === 200) {
        setRoles(res.data.data.list || [])
      }
    } catch (error) {
      console.error('加载角色列表失败:', error)
    } finally {
      setRolesLoading(false)
    }
  }
  
  // 加载权限列表
  const loadPermissions = async () => {
    try {
      const res = await portalApi.getPermissions()
      if (res.data.errCode === 200) {
        setPermissionGroups(res.data.data.grouped || [])
      }
    } catch (error) {
      console.error('加载权限列表失败:', error)
    }
  }
  
  // 初始化默认角色
  const initDefaultRoles = async () => {
    try {
      await portalApi.initDefaultRoles()
      await loadRoles()
    } catch (error) {
      console.error('初始化默认角色失败:', error)
    }
  }
  
  // 初始化加载
  useEffect(() => {
    loadUsers()
    loadRoles()
    loadPermissions()
    initDefaultRoles()
  }, [])
  
  // 搜索和筛选
  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers()
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearchKeyword, userStatusFilter])
  
  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }
  
  // 打开用户编辑弹窗
  const openUserModal = (user?: User) => {
    if (user) {
      setEditingUser(user)
      setUserForm({
        username: user.username,
        email: user.email || '',
        password: '',
        displayName: user.display_name || '',
        phone: user.phone || '',
        roleId: user.role_id || 0
      })
    } else {
      setEditingUser(null)
      setUserForm({
        username: '',
        email: '',
        password: '',
        displayName: '',
        phone: '',
        roleId: roles.find(r => r.is_default)?.id || 0
      })
    }
    setGeneratedPassword(null)
    setShowUserModal(true)
  }
  
  // 保存用户
  const saveUser = async () => {
    try {
      if (!userForm.username.trim()) {
        showMessage('error', '请输入用户名')
        return
      }
      
      if (editingUser) {
        // 更新
        const res = await portalApi.updateUser(editingUser.id, {
          email: userForm.email || undefined,
          displayName: userForm.displayName || undefined,
          phone: userForm.phone || undefined,
          roleId: userForm.roleId || undefined
        })
        if (res.data.errCode === 200) {
          showMessage('success', '用户更新成功')
          setShowUserModal(false)
          loadUsers()
        } else {
          showMessage('error', res.data.msg || '更新失败')
        }
      } else {
        // 创建
        const res = await portalApi.createUser({
          username: userForm.username,
          email: userForm.email || undefined,
          password: userForm.password || undefined,
          displayName: userForm.displayName || undefined,
          phone: userForm.phone || undefined,
          roleId: userForm.roleId || undefined
        })
        if (res.data.errCode === 200) {
          showMessage('success', '用户创建成功')
          if (res.data.data.generatedPassword) {
            setGeneratedPassword(res.data.data.generatedPassword)
          } else {
            setShowUserModal(false)
          }
          loadUsers()
        } else {
          showMessage('error', res.data.msg || '创建失败')
        }
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.msg || '操作失败')
    }
  }
  
  // 切换用户状态
  const toggleUserStatus = async (user: User) => {
    try {
      const res = await portalApi.toggleUserStatus(user.id)
      if (res.data.errCode === 200) {
        showMessage('success', res.data.msg)
        loadUsers()
      } else {
        showMessage('error', res.data.msg || '操作失败')
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.msg || '操作失败')
    }
  }
  
  // 重置密码
  const resetPassword = async () => {
    if (!resetPasswordUser) return
    
    try {
      const res = await portalApi.resetUserPassword(resetPasswordUser.id)
      if (res.data.errCode === 200) {
        setGeneratedPassword(res.data.data.newPassword)
        showMessage('success', '密码重置成功')
      } else {
        showMessage('error', res.data.msg || '重置失败')
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.msg || '重置失败')
    }
  }
  
  // 删除用户
  const deleteUser = async () => {
    if (!deletingItem || deletingItem.type !== 'user') return
    
    try {
      const res = await portalApi.deleteUser(deletingItem.id)
      if (res.data.errCode === 200) {
        showMessage('success', '用户已删除')
        setShowDeleteModal(false)
        setDeletingItem(null)
        loadUsers()
      } else {
        showMessage('error', res.data.msg || '删除失败')
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.msg || '删除失败')
    }
  }
  
  // 打开角色编辑弹窗
  const openRoleModal = async (role?: Role) => {
    if (role) {
      setEditingRole(role)
      // 获取角色详情（含权限）
      try {
        const res = await portalApi.getRoleById(role.id)
        if (res.data.errCode === 200) {
          const roleData = res.data.data
          setRoleForm({
            name: roleData.name,
            description: roleData.description || '',
            permissionIds: roleData.permissions?.map((p: Permission) => p.id) || [],
            isDefault: roleData.is_default
          })
        }
      } catch (error) {
        console.error('获取角色详情失败:', error)
      }
    } else {
      setEditingRole(null)
      setRoleForm({
        name: '',
        description: '',
        permissionIds: [],
        isDefault: false
      })
    }
    setShowRoleModal(true)
  }
  
  // 保存角色
  const saveRole = async () => {
    try {
      if (!roleForm.name.trim()) {
        showMessage('error', '请输入角色名称')
        return
      }
      
      if (editingRole) {
        // 更新
        const res = await portalApi.updateRole(editingRole.id, {
          name: editingRole.is_system ? undefined : roleForm.name,
          description: roleForm.description || undefined,
          permissionIds: roleForm.permissionIds,
          isDefault: roleForm.isDefault
        })
        if (res.data.errCode === 200) {
          showMessage('success', '角色更新成功')
          setShowRoleModal(false)
          loadRoles()
        } else {
          showMessage('error', res.data.msg || '更新失败')
        }
      } else {
        // 创建
        const res = await portalApi.createRole({
          name: roleForm.name,
          description: roleForm.description || undefined,
          permissionIds: roleForm.permissionIds,
          isDefault: roleForm.isDefault
        })
        if (res.data.errCode === 200) {
          showMessage('success', '角色创建成功')
          setShowRoleModal(false)
          loadRoles()
        } else {
          showMessage('error', res.data.msg || '创建失败')
        }
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.msg || '操作失败')
    }
  }
  
  // 删除角色
  const deleteRole = async () => {
    if (!deletingItem || deletingItem.type !== 'role') return
    
    try {
      const res = await portalApi.deleteRole(deletingItem.id)
      if (res.data.errCode === 200) {
        showMessage('success', '角色已删除')
        setShowDeleteModal(false)
        setDeletingItem(null)
        loadRoles()
      } else {
        showMessage('error', res.data.msg || '删除失败')
      }
    } catch (error: any) {
      showMessage('error', error.response?.data?.msg || '删除失败')
    }
  }
  
  // 切换权限选择
  const togglePermission = (permId: number) => {
    setRoleForm(prev => {
      const newIds = prev.permissionIds.includes(permId)
        ? prev.permissionIds.filter(id => id !== permId)
        : [...prev.permissionIds, permId]
      return { ...prev, permissionIds: newIds }
    })
  }
  
  // 选择/取消选择模块所有权限
  const toggleModulePermissions = (permissions: Permission[]) => {
    const permIds = permissions.map(p => p.id)
    const allSelected = permIds.every(id => roleForm.permissionIds.includes(id))
    
    setRoleForm(prev => {
      if (allSelected) {
        // 取消选择
        return { ...prev, permissionIds: prev.permissionIds.filter(id => !permIds.includes(id)) }
      } else {
        // 全选
        const newIds = [...new Set([...prev.permissionIds, ...permIds])]
        return { ...prev, permissionIds: newIds }
      }
    })
  }
  
  // 复制密码
  const copyPassword = () => {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword)
      setCopiedPassword(true)
      setTimeout(() => setCopiedPassword(false), 2000)
    }
  }
  
  // 格式化时间
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title">用户管理</h1>
          <p className="text-small mt-1">管理您公司的员工账户和角色权限</p>
        </div>
      </div>
      
      {/* 消息提示 */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center space-x-3 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )}
          <span className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </span>
        </div>
      )}

      {/* 标签页 */}
      <div className="card">
        <div className="border-b border-gray-100">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 border-b-2 text-sm font-medium transition-colors flex items-center ${
                activeTab === 'users'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="w-4 h-4 mr-2" />
              用户账户
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`py-4 border-b-2 text-sm font-medium transition-colors flex items-center ${
                activeTab === 'roles'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Shield className="w-4 h-4 mr-2" />
              角色权限
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* 用户列表 */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* 工具栏 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="搜索用户名、邮箱..."
                      value={userSearchKeyword}
                      onChange={(e) => setUserSearchKeyword(e.target.value)}
                      className="input pl-10 w-64"
                    />
                  </div>
                  <select
                    value={userStatusFilter}
                    onChange={(e) => setUserStatusFilter(e.target.value)}
                    className="input w-32"
                  >
                    <option value="all">全部状态</option>
                    <option value="active">已启用</option>
                    <option value="disabled">已禁用</option>
                  </select>
                </div>
                <button
                  onClick={() => openUserModal()}
                  className="btn btn-primary flex items-center"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  添加用户
                </button>
              </div>
              
              {/* 用户表格 */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="pb-3 font-medium">用户名</th>
                      <th className="pb-3 font-medium">显示名称</th>
                      <th className="pb-3 font-medium">邮箱</th>
                      <th className="pb-3 font-medium">角色</th>
                      <th className="pb-3 font-medium">状态</th>
                      <th className="pb-3 font-medium">最后登录</th>
                      <th className="pb-3 font-medium text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500">
                          加载中...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500">
                          暂无用户数据
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="py-3 font-medium text-gray-900">{user.username}</td>
                          <td className="py-3 text-gray-600">{user.display_name || '-'}</td>
                          <td className="py-3 text-gray-600">{user.email || '-'}</td>
                          <td className="py-3">
                            <span className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded">
                              {user.role_name || '未分配'}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-1 text-xs rounded ${
                              user.status === 'active' 
                                ? 'bg-green-50 text-green-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {user.status === 'active' ? '已启用' : '已禁用'}
                            </span>
                          </td>
                          <td className="py-3 text-gray-500 text-sm">
                            {formatDate(user.last_login_at)}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => openUserModal(user)}
                                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                                title="编辑"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setResetPasswordUser(user)
                                  setGeneratedPassword(null)
                                  setShowPasswordModal(true)
                                }}
                                className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                                title="重置密码"
                              >
                                <Key className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => toggleUserStatus(user)}
                                className={`p-1.5 rounded ${
                                  user.status === 'active'
                                    ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                    : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                }`}
                                title={user.status === 'active' ? '禁用' : '启用'}
                              >
                                {user.status === 'active' ? (
                                  <ToggleRight className="w-4 h-4" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingItem({ type: 'user', id: user.id, name: user.username })
                                  setShowDeleteModal(true)
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 角色列表 */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              {/* 工具栏 */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  角色用于定义用户的权限范围，您可以创建自定义角色来满足不同的需求
                </p>
                <button
                  onClick={() => openRoleModal()}
                  className="btn btn-primary flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建角色
                </button>
              </div>
              
              {/* 角色卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rolesLoading ? (
                  <div className="col-span-full py-8 text-center text-gray-500">
                    加载中...
                  </div>
                ) : roles.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-gray-500">
                    暂无角色数据
                  </div>
                ) : (
                  roles.map((role) => (
                    <div
                      key={role.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                            <Shield className="w-5 h-5 text-primary-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 flex items-center">
                              {role.name}
                              {role.is_system && (
                                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded">
                                  系统
                                </span>
                              )}
                              {role.is_default && (
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-green-50 text-green-600 rounded">
                                  默认
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {role.user_count || 0} 个用户
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => openRoleModal(role)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                            title="编辑"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          {!role.is_system && (
                            <button
                              onClick={() => {
                                setDeletingItem({ type: 'role', id: role.id, name: role.name })
                                setShowDeleteModal(true)
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {role.description && (
                        <p className="mt-3 text-sm text-gray-500 line-clamp-2">
                          {role.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 用户编辑弹窗 */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-medium">
                {editingUser ? '编辑用户' : '添加用户'}
              </h3>
              <button
                onClick={() => {
                  setShowUserModal(false)
                  setGeneratedPassword(null)
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* 生成的密码提示 */}
              {generatedPassword && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 mb-2">
                    用户创建成功！请保存以下密码：
                  </p>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-3 py-2 bg-white border border-green-200 rounded text-sm font-mono">
                      {generatedPassword}
                    </code>
                    <button
                      onClick={copyPassword}
                      className="p-2 bg-green-100 hover:bg-green-200 rounded"
                    >
                      {copiedPassword ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-green-600" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    请将此密码告知用户，此密码只显示一次
                  </p>
                </div>
              )}
              
              {!generatedPassword && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      用户名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                      disabled={!!editingUser}
                      className="input"
                      placeholder="3-30位字母、数字或下划线"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      显示名称
                    </label>
                    <input
                      type="text"
                      value={userForm.displayName}
                      onChange={(e) => setUserForm(prev => ({ ...prev, displayName: e.target.value }))}
                      className="input"
                      placeholder="用于显示的名称"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      邮箱
                    </label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm(prev => ({ ...prev, email: e.target.value }))}
                      className="input"
                      placeholder="可用于登录"
                    />
                  </div>
                  
                  {!editingUser && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        密码
                      </label>
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                        className="input"
                        placeholder="留空则自动生成"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        留空将自动生成随机密码
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      手机号
                    </label>
                    <input
                      type="text"
                      value={userForm.phone}
                      onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="input"
                      placeholder="联系电话"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      角色
                    </label>
                    <select
                      value={userForm.roleId}
                      onChange={(e) => setUserForm(prev => ({ ...prev, roleId: parseInt(e.target.value) }))}
                      className="input"
                    >
                      <option value={0}>请选择角色</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>
                          {role.name} {role.is_default && '(默认)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 p-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowUserModal(false)
                  setGeneratedPassword(null)
                }}
                className="btn btn-secondary"
              >
                {generatedPassword ? '关闭' : '取消'}
              </button>
              {!generatedPassword && (
                <button onClick={saveUser} className="btn btn-primary">
                  保存
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 角色编辑弹窗 */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-medium">
                {editingRole ? '编辑角色' : '创建角色'}
              </h3>
              <button
                onClick={() => setShowRoleModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  角色名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, name: e.target.value }))}
                  disabled={editingRole?.is_system}
                  className="input"
                  placeholder="如：财务人员、业务员"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  角色描述
                </label>
                <textarea
                  value={roleForm.description}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                  className="input"
                  rows={2}
                  placeholder="描述此角色的用途"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={roleForm.isDefault}
                  onChange={(e) => setRoleForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="isDefault" className="ml-2 text-sm text-gray-700">
                  设为新用户默认角色
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  权限配置
                </label>
                <div className="space-y-4 border border-gray-200 rounded-lg p-4">
                  {permissionGroups.map((group) => (
                    <div key={group.module} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleModulePermissions(group.permissions)}
                          className="text-sm font-medium text-gray-700 hover:text-primary-600 flex items-center"
                        >
                          <input
                            type="checkbox"
                            checked={group.permissions.every(p => roleForm.permissionIds.includes(p.id))}
                            onChange={() => toggleModulePermissions(group.permissions)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded mr-2"
                          />
                          {group.moduleName}
                        </button>
                      </div>
                      <div className="ml-6 grid grid-cols-2 gap-2">
                        {group.permissions.map((perm) => (
                          <label
                            key={perm.id}
                            className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900"
                          >
                            <input
                              type="checkbox"
                              checked={roleForm.permissionIds.includes(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              className="w-4 h-4 text-primary-600 border-gray-300 rounded"
                            />
                            <span>{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowRoleModal(false)}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button onClick={saveRole} className="btn btn-primary">
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 重置密码弹窗 */}
      {showPasswordModal && resetPasswordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-medium">重置密码</h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setGeneratedPassword(null)
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4">
              {generatedPassword ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 mb-2">
                    密码已重置！请保存以下新密码：
                  </p>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-3 py-2 bg-white border border-green-200 rounded text-sm font-mono">
                      {generatedPassword}
                    </code>
                    <button
                      onClick={copyPassword}
                      className="p-2 bg-green-100 hover:bg-green-200 rounded"
                    >
                      {copiedPassword ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-green-600" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    请将此密码告知用户，此密码只显示一次
                  </p>
                </div>
              ) : (
                <p className="text-gray-600">
                  确定要重置用户 <span className="font-medium">{resetPasswordUser.username}</span> 的密码吗？
                  系统将生成一个随机密码。
                </p>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 p-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setGeneratedPassword(null)
                }}
                className="btn btn-secondary"
              >
                {generatedPassword ? '关闭' : '取消'}
              </button>
              {!generatedPassword && (
                <button onClick={resetPassword} className="btn btn-primary">
                  确认重置
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteModal && deletingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-medium text-red-600">确认删除</h3>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletingItem(null)
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4">
              <p className="text-gray-600">
                确定要删除{deletingItem.type === 'user' ? '用户' : '角色'} 
                <span className="font-medium"> {deletingItem.name} </span>吗？
                此操作不可撤销。
              </p>
            </div>
            
            <div className="flex justify-end space-x-3 p-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletingItem(null)
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={deletingItem.type === 'user' ? deleteUser : deleteRole}
                className="btn bg-red-600 hover:bg-red-700 text-white"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

