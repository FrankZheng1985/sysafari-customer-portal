/**
 * 发货人/收货人选择器组件
 * 支持从预设列表中选择，或添加新的预设
 */
import { useState, useEffect, useRef } from 'react'
import { portalApi } from '../utils/api'
import { 
  User, Plus, ChevronDown, Star, Trash2, Edit2, 
  Save, X, Building2, MapPin, Phone, Mail, 
  AlertCircle, Loader2
} from 'lucide-react'

// 发货人/收货人数据类型
export interface PartyPreset {
  id: string
  name: string
  nameEn?: string
  shortName?: string
  country?: string
  province?: string
  city?: string
  district?: string
  address?: string
  addressEn?: string
  postalCode?: string
  contactPerson?: string
  contactPhone?: string
  mobile?: string
  email?: string
  fax?: string
  taxNumber?: string
  eoriNumber?: string
  vatNumber?: string
  isDefault?: boolean
  displayFormat?: string
  erpSynced?: boolean
}

interface PartySelectorProps {
  type: 'shipper' | 'consignee'
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  className?: string
}

export default function PartySelector({
  type,
  value,
  onChange,
  label,
  placeholder,
  required = false,
  className = ''
}: PartySelectorProps) {
  const [presets, setPresets] = useState<PartyPreset[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingPreset, setEditingPreset] = useState<PartyPreset | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // 新建表单数据
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    country: '',
    city: '',
    address: '',
    postalCode: '',
    contactPerson: '',
    contactPhone: '',
    email: '',
    taxNumber: '',
    eoriNumber: '',
    isDefault: false
  })
  
  const typeLabel = type === 'shipper' ? '发货人' : '收货人'
  
  // 加载预设列表
  useEffect(() => {
    loadPresets()
  }, [type])
  
  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const loadPresets = async () => {
    setLoading(true)
    try {
      const res = type === 'shipper' 
        ? await portalApi.getShippers()
        : await portalApi.getConsignees()
      
      if (res.data.errCode === 200) {
        setPresets(res.data.data || [])
      }
    } catch (err) {
      console.error(`加载${typeLabel}列表失败:`, err)
    } finally {
      setLoading(false)
    }
  }
  
  // 选择预设
  const handleSelectPreset = (preset: PartyPreset) => {
    onChange(preset.displayFormat || generateDisplayFormat(preset))
    setShowDropdown(false)
  }
  
  // 生成显示格式
  const generateDisplayFormat = (preset: PartyPreset): string => {
    const parts = []
    
    if (preset.name) {
      parts.push(preset.name)
    }
    
    const addressParts = []
    if (preset.address) addressParts.push(preset.address)
    if (preset.city) addressParts.push(preset.city)
    if (preset.country) addressParts.push(preset.country)
    if (preset.postalCode) addressParts.push(preset.postalCode)
    if (addressParts.length > 0) {
      parts.push(addressParts.join(', '))
    }
    
    const contactParts = []
    if (preset.contactPerson) contactParts.push(`联系人: ${preset.contactPerson}`)
    if (preset.contactPhone) contactParts.push(`电话: ${preset.contactPhone}`)
    if (preset.email) contactParts.push(`邮箱: ${preset.email}`)
    if (contactParts.length > 0) {
      parts.push(contactParts.join(', '))
    }
    
    return parts.join('\n')
  }
  
  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      nameEn: '',
      country: '',
      city: '',
      address: '',
      postalCode: '',
      contactPerson: '',
      contactPhone: '',
      email: '',
      taxNumber: '',
      eoriNumber: '',
      isDefault: false
    })
    setError('')
  }
  
  // 打开新增表单
  const handleOpenAddForm = () => {
    resetForm()
    setShowAddForm(true)
    setShowDropdown(false)
  }
  
  // 打开编辑表单
  const handleOpenEditForm = (preset: PartyPreset, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingPreset(preset)
    setFormData({
      name: preset.name || '',
      nameEn: preset.nameEn || '',
      country: preset.country || '',
      city: preset.city || '',
      address: preset.address || '',
      postalCode: preset.postalCode || '',
      contactPerson: preset.contactPerson || '',
      contactPhone: preset.contactPhone || '',
      email: preset.email || '',
      taxNumber: preset.taxNumber || '',
      eoriNumber: preset.eoriNumber || '',
      isDefault: preset.isDefault || false
    })
    setShowEditForm(true)
    setShowDropdown(false)
  }
  
  // 保存新预设
  const handleSaveNew = async () => {
    if (!formData.name.trim()) {
      setError(`${typeLabel}名称不能为空`)
      return
    }
    
    setSaving(true)
    setError('')
    
    try {
      const res = type === 'shipper'
        ? await portalApi.createShipper(formData)
        : await portalApi.createConsignee(formData)
      
      if (res.data.errCode === 200) {
        // 更新到输入框
        onChange(res.data.data.displayFormat || generateDisplayFormat(formData as any))
        setShowAddForm(false)
        resetForm()
        loadPresets()
      } else {
        setError(res.data.msg || '保存失败')
      }
    } catch (err: any) {
      setError(err.response?.data?.msg || '保存失败')
    } finally {
      setSaving(false)
    }
  }
  
  // 更新预设
  const handleUpdatePreset = async () => {
    if (!editingPreset) return
    if (!formData.name.trim()) {
      setError(`${typeLabel}名称不能为空`)
      return
    }
    
    setSaving(true)
    setError('')
    
    try {
      const res = type === 'shipper'
        ? await portalApi.updateShipper(editingPreset.id, formData)
        : await portalApi.updateConsignee(editingPreset.id, formData)
      
      if (res.data.errCode === 200) {
        setShowEditForm(false)
        setEditingPreset(null)
        resetForm()
        loadPresets()
      } else {
        setError(res.data.msg || '更新失败')
      }
    } catch (err: any) {
      setError(err.response?.data?.msg || '更新失败')
    } finally {
      setSaving(false)
    }
  }
  
  // 删除预设
  const handleDeletePreset = async (preset: PartyPreset, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`确定要删除${typeLabel} "${preset.name}" 吗？`)) return
    
    try {
      const res = type === 'shipper'
        ? await portalApi.deleteShipper(preset.id)
        : await portalApi.deleteConsignee(preset.id)
      
      if (res.data.errCode === 200) {
        loadPresets()
      }
    } catch (err) {
      console.error('删除失败:', err)
    }
  }
  
  // 设为默认
  const handleSetDefault = async (preset: PartyPreset, e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      const res = type === 'shipper'
        ? await portalApi.setDefaultShipper(preset.id)
        : await portalApi.setDefaultConsignee(preset.id)
      
      if (res.data.errCode === 200) {
        loadPresets()
      }
    } catch (err) {
      console.error('设置默认失败:', err)
    }
  }
  
  // 渲染表单
  const renderForm = (isEdit: boolean) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            {isEdit ? `编辑${typeLabel}` : `添加${typeLabel}`}
          </h3>
          <button
            onClick={() => {
              isEdit ? setShowEditForm(false) : setShowAddForm(false)
              setEditingPreset(null)
              resetForm()
            }}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}
          
          {/* 基本信息 */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 flex items-center">
              <Building2 className="w-4 h-4 mr-2 text-gray-500" />
              基本信息
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm text-gray-600 mb-1">
                  名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={`${typeLabel}名称/公司名`}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm text-gray-600 mb-1">英文名称</label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="English Name"
                />
              </div>
            </div>
          </div>
          
          {/* 地址信息 */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-gray-500" />
              地址信息
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">国家</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="如：China"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">城市</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="如：Shanghai"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-600 mb-1">详细地址</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="街道、门牌号"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">邮编</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="邮政编码"
                />
              </div>
            </div>
          </div>
          
          {/* 联系信息 */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 flex items-center">
              <Phone className="w-4 h-4 mr-2 text-gray-500" />
              联系信息
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">联系人</label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="联系人姓名"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">电话</label>
                <input
                  type="text"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="联系电话"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-gray-600 mb-1">邮箱</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="email@example.com"
                />
              </div>
            </div>
          </div>
          
          {/* 商务信息 */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 flex items-center">
              <Mail className="w-4 h-4 mr-2 text-gray-500" />
              商务信息
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">税号</label>
                <input
                  type="text"
                  value={formData.taxNumber}
                  onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="统一社会信用代码/VAT号"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">EORI号</label>
                <input
                  type="text"
                  value={formData.eoriNumber}
                  onChange={(e) => setFormData({ ...formData, eoriNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="欧盟经济运营商识别号"
                />
              </div>
            </div>
          </div>
          
          {/* 设为默认 */}
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="ml-2 text-sm text-gray-700">设为默认{typeLabel}</span>
          </label>
        </div>
        
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={() => {
              isEdit ? setShowEditForm(false) : setShowAddForm(false)
              setEditingPreset(null)
              resetForm()
            }}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={isEdit ? handleUpdatePreset : handleSaveNew}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 flex items-center"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存{typeLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 选择按钮 - 移到顶部 */}
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className={`
          px-4 py-1.5 text-sm font-medium rounded-full
          transition-all duration-200 ease-in-out
          flex items-center gap-1.5 mb-2
          ${showDropdown 
            ? 'bg-primary-600 text-white shadow-md' 
            : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 shadow-sm'
          }
        `}
      >
        <User className="w-3.5 h-3.5" />
        <span>从地址簿选择</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
      </button>
      
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      {/* 输入区域 */}
      <div className="relative group">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="input pr-4"
          placeholder={placeholder || `${typeLabel}名称、地址、联系方式`}
        />
      </div>
      
      {/* 下拉列表 */}
      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {/* 添加新预设按钮 */}
          <button
            onClick={handleOpenAddForm}
            className="w-full px-4 py-3 text-left text-primary-600 hover:bg-primary-50 flex items-center border-b border-gray-100"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加新{typeLabel}
          </button>
          
          {/* 预设列表 */}
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              <Loader2 className="w-5 h-5 mx-auto animate-spin" />
              <p className="mt-1 text-sm">加载中...</p>
            </div>
          ) : presets.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <User className="w-8 h-8 mx-auto text-gray-300" />
              <p className="mt-1 text-sm">暂无{typeLabel}预设</p>
              <p className="text-xs text-gray-400">点击上方按钮添加</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer group"
                  onClick={() => handleSelectPreset(preset)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900 truncate">
                          {preset.name}
                        </span>
                        {preset.isDefault && (
                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                            默认
                          </span>
                        )}
                        {preset.erpSynced && (
                          <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                            已同步
                          </span>
                        )}
                      </div>
                      {preset.address && (
                        <p className="text-sm text-gray-500 truncate mt-0.5">
                          {[preset.address, preset.city, preset.country].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {preset.contactPerson && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {preset.contactPerson} {preset.contactPhone && `· ${preset.contactPhone}`}
                        </p>
                      )}
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!preset.isDefault && (
                        <button
                          onClick={(e) => handleSetDefault(preset, e)}
                          className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded"
                          title="设为默认"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleOpenEditForm(preset, e)}
                        className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeletePreset(preset, e)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* 新增表单弹窗 */}
      {showAddForm && renderForm(false)}
      
      {/* 编辑表单弹窗 */}
      {showEditForm && editingPreset && renderForm(true)}
    </div>
  )
}

