import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { portalApi } from '../utils/api'
import { ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle, Ship, Plane, Truck, Train, Calendar } from 'lucide-react'

interface CargoItem {
  productName: string
  productNameEn: string
  hsCode: string
  quantity: number
  unit: string
  unitPrice: number
}

// 运输方式选项
const transportModes = [
  { value: 'sea', label: '海运', icon: Ship },
  { value: 'air', label: '空运', icon: Plane },
  { value: 'rail', label: '铁路', icon: Train },
  { value: 'truck', label: '卡车', icon: Truck },
]

// 常用船公司
const shippingLines = [
  'COSCO', 'MSC', 'MAERSK', 'CMA CGM', 'ONE', 'Evergreen', 
  'Hapag-Lloyd', 'Yang Ming', 'HMM', 'ZIM', 'PIL', 'OOCL',
  'Wan Hai', 'SITC', 'Other'
]

export default function NewOrder() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    // 基本信息
    transportMode: 'sea',          // 运输方式
    // 订单号由系统自动生成，不需要在表单中提交
    billNumber: '',                // 提单号
    shippingLine: '',              // 船公司
    containerNumber: '',           // 集装箱号
    containerType: '',             // 柜型
    sealNumber: '',                // 封号
    // 航程信息
    vesselVoyage: '',              // 航班号/船名航次
    terminal: '',                  // 地勤（码头）
    // 发货信息
    shipper: '',
    portOfLoading: '',
    etd: '',
    // 收货信息
    consignee: '',
    portOfDischarge: '',
    placeOfDelivery: '',
    eta: '',
    // 货物信息
    pieces: '',
    weight: '',
    volume: '',
    // 附加属性
    cargoType: 'FCL',              // 箱型: CFS(拼箱) / FCL(整箱)
    transportService: 'entrust',   // 运输方式固定为委托我司运输
    billType: 'master',            // 提单类型: master(船东单) / house(货代单)
    // 额外服务
    containerReturn: 'local',      // 异地还柜: remote(异地还柜) / local(本地还柜)
    containerReturnLocation: '',   // 异地还柜地点
    fullContainerDelivery: 'full', // 全程整柜运输: full(必须整柜派送) / devan(可拆柜后托盘送货)
    lastMileTransport: 'truck',    // 末端运输方式
    devanService: 'no',            // 拆柜: yes(需要拆柜分货服务) / no(不需要拆柜)
    t1CustomsService: 'no',        // 海关经停报关服务(T1报关): yes / no
    // 其他
    serviceType: 'door-to-door',
    remark: ''
  })
  
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([
    { productName: '', productNameEn: '', hsCode: '', quantity: 0, unit: 'PCS', unitPrice: 0 }
  ])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCargoChange = (index: number, field: keyof CargoItem, value: string | number) => {
    setCargoItems(prev => {
      const newItems = [...prev]
      newItems[index] = { ...newItems[index], [field]: value }
      return newItems
    })
  }

  const addCargoItem = () => {
    setCargoItems(prev => [
      ...prev,
      { productName: '', productNameEn: '', hsCode: '', quantity: 0, unit: 'PCS', unitPrice: 0 }
    ])
  }

  const removeCargoItem = (index: number) => {
    if (cargoItems.length > 1) {
      setCargoItems(prev => prev.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    
    if (!formData.shipper && !formData.consignee) {
      setError('发货人或收货人至少填写一个')
      return
    }
    
    // 验证必填字段
    if (!formData.shippingLine) {
      setError('请选择船公司')
      return
    }
    if (!formData.containerNumber) {
      setError('请填写集装箱号')
      return
    }
    if (!formData.containerType) {
      setError('请选择柜型')
      return
    }
    
    // 如果选择异地还柜，必须填写还柜地点
    if (formData.containerReturn === 'remote' && !formData.containerReturnLocation) {
      setError('请填写异地还柜地点')
      return
    }
    
    // 过滤掉空的货物明细
    const validCargoItems = cargoItems.filter(item => item.productName || item.productNameEn)
    
    setLoading(true)
    
    try {
      const res = await portalApi.createOrder({
        ...formData,
        pieces: formData.pieces ? parseInt(formData.pieces) : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        volume: formData.volume ? parseFloat(formData.volume) : undefined,
        cargoItems: validCargoItems.length > 0 ? validCargoItems : undefined
      })
      
      if (res.data.errCode === 200) {
        setSuccess(true)
        setTimeout(() => {
          navigate('/orders')
        }, 2000)
      } else {
        setError(res.data.msg || '创建订单失败')
      }
    } catch (err: any) {
      setError(err.response?.data?.msg || '创建订单失败')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">订单创建成功</h2>
        <p className="text-gray-500">正在跳转到订单列表...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center space-x-4 mb-6">
        <Link
          to="/orders"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-page-title">创建新订单</h1>
          <p className="text-small">提交货物运输请求</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 运输方式 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">运输方式 <span className="text-red-500">*</span></h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {transportModes.map((mode) => {
              const Icon = mode.icon
              return (
                <label
                  key={mode.value}
                  className={`relative flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.transportMode === mode.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="transportMode"
                    value={mode.value}
                    checked={formData.transportMode === mode.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <Icon className={`w-6 h-6 mb-2 ${
                    formData.transportMode === mode.value ? 'text-primary-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    formData.transportMode === mode.value ? 'text-primary-700' : 'text-gray-600'
                  }`}>{mode.label}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* 基本信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                订单号
              </label>
              <input
                type="text"
                value="系统自动生成"
                disabled
                className="input bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">提交后系统将自动分配订单号</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                船公司 <span className="text-red-500">*</span>
              </label>
              <select
                name="shippingLine"
                value={formData.shippingLine}
                onChange={handleChange}
                className="input"
                required
              >
                <option value="">选择船公司</option>
                {shippingLines.map(line => (
                  <option key={line} value={line}>{line}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                提单号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="billNumber"
                value={formData.billNumber}
                onChange={handleChange}
                className="input"
                placeholder="输入完整提单号"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                集装箱号 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="containerNumber"
                value={formData.containerNumber}
                onChange={handleChange}
                className="input"
                placeholder="如 COSU1234567"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                柜型 <span className="text-red-500">*</span>
              </label>
              <select
                name="containerType"
                value={formData.containerType}
                onChange={handleChange}
                className="input"
                required
              >
                <option value="">请选择柜型</option>
                <option value="20GP">20GP</option>
                <option value="40GP">40GP</option>
                <option value="40HQ">40HQ</option>
                <option value="45HQ">45HQ</option>
                <option value="20RF">20RF (冷藏)</option>
                <option value="40RF">40RF (冷藏)</option>
                <option value="20OT">20OT (开顶)</option>
                <option value="40OT">40OT (开顶)</option>
                <option value="20FR">20FR (框架)</option>
                <option value="40FR">40FR (框架)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                封号
              </label>
              <input
                type="text"
                name="sealNumber"
                value={formData.sealNumber}
                onChange={handleChange}
                className="input"
                placeholder="铅封号"
              />
            </div>
          </div>
        </div>

        {/* 航程信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">航程信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.transportMode === 'air' ? '航班号' : '船名航次'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="vesselVoyage"
                value={formData.vesselVoyage}
                onChange={handleChange}
                className="input"
                placeholder={formData.transportMode === 'air' ? '如 CA123' : '如 EVER GIVEN / 025W'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                地勤（码头）
              </label>
              <input
                type="text"
                name="terminal"
                value={formData.terminal}
                onChange={handleChange}
                className="input"
                placeholder="集装箱落在哪个码头"
              />
            </div>
          </div>
        </div>

        {/* 港口信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">港口信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                起运港 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="portOfLoading"
                value={formData.portOfLoading}
                onChange={handleChange}
                className="input"
                placeholder="搜索或选择起运港"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                目的港 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="portOfDischarge"
                value={formData.portOfDischarge}
                onChange={handleChange}
                className="input"
                placeholder="搜索或选择目的港"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ETD (预计离港)
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="etd"
                  value={formData.etd}
                  onChange={handleChange}
                  className="input pr-10 cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ETA (预计到港)
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="eta"
                  value={formData.eta}
                  onChange={handleChange}
                  className="input pr-10 cursor-pointer"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* 附加属性 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">附加属性</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 箱型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                箱型 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="cargoType"
                    value="CFS"
                    checked={formData.cargoType === 'CFS'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">拼箱 (CFS)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="cargoType"
                    value="FCL"
                    checked={formData.cargoType === 'FCL'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">整箱 (FCL)</span>
                </label>
              </div>
            </div>

            {/* 提单 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                提单 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="billType"
                    value="master"
                    checked={formData.billType === 'master'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">船东单 (Master Bill)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="billType"
                    value="house"
                    checked={formData.billType === 'house'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">货代单 (House Bill)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 额外服务 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">额外服务</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 异地还柜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                异地还柜 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="containerReturn"
                      value="remote"
                      checked={formData.containerReturn === 'remote'}
                      onChange={handleChange}
                      className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">异地还柜</span>
                  </label>
                  {/* 当选择异地还柜时，显示还柜地点输入框 */}
                  {formData.containerReturn === 'remote' && (
                    <input
                      type="text"
                      name="containerReturnLocation"
                      value={formData.containerReturnLocation}
                      onChange={handleChange}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="请输入还柜地点"
                      required
                    />
                  )}
                </div>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="containerReturn"
                    value="local"
                    checked={formData.containerReturn === 'local'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">本地还柜 (Rotterdam)</span>
                </label>
              </div>
            </div>

            {/* 全程整柜运输 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                全程整柜运输 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="fullContainerDelivery"
                    value="full"
                    checked={formData.fullContainerDelivery === 'full'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">必须整柜派送</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="fullContainerDelivery"
                    value="devan"
                    checked={formData.fullContainerDelivery === 'devan'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">可拆柜后托盘送货</span>
                </label>
              </div>
            </div>

            {/* 末端运输方式 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                末端运输方式 <span className="text-red-500">*</span>
              </label>
              <select
                name="lastMileTransport"
                value={formData.lastMileTransport}
                onChange={handleChange}
                className="input"
              >
                <option value="truck">卡车派送</option>
                <option value="van">小型货车派送</option>
                <option value="express">快递派送</option>
                <option value="pickup">客户自提</option>
              </select>
            </div>

            {/* 拆柜 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                拆柜 <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="devanService"
                    value="yes"
                    checked={formData.devanService === 'yes'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">需要拆柜分货服务</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="devanService"
                    value="no"
                    checked={formData.devanService === 'no'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">不需要拆柜</span>
                </label>
              </div>
            </div>

            {/* 海关经停报关服务(T1报关) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                海关经停报关服务 (T1报关) <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="t1CustomsService"
                    value="yes"
                    checked={formData.t1CustomsService === 'yes'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">是</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="t1CustomsService"
                    value="no"
                    checked={formData.t1CustomsService === 'no'}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">否</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 发货信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">发货信息</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                发货人 <span className="text-red-500">*</span>
              </label>
              <textarea
                name="shipper"
                value={formData.shipper}
                onChange={handleChange}
                rows={3}
                className="input"
                placeholder="发货人名称、地址、联系方式"
              />
            </div>
          </div>
        </div>

        {/* 收货信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">收货信息</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                收货人 <span className="text-red-500">*</span>
              </label>
              <textarea
                name="consignee"
                value={formData.consignee}
                onChange={handleChange}
                rows={3}
                className="input"
                placeholder="收货人名称、地址、联系方式"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                送货地址
              </label>
              <input
                type="text"
                name="placeOfDelivery"
                value={formData.placeOfDelivery}
                onChange={handleChange}
                className="input"
                placeholder="最终送货地址（如与收货人不同）"
              />
            </div>
          </div>
        </div>

        {/* 货物信息 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">货物信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                总件数
              </label>
              <input
                type="number"
                name="pieces"
                value={formData.pieces}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                总重量 (KG)
              </label>
              <input
                type="number"
                step="0.01"
                name="weight"
                value={formData.weight}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                总体积 (CBM)
              </label>
              <input
                type="number"
                step="0.01"
                name="volume"
                value={formData.volume}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>

          <h3 className="text-sm font-medium text-gray-700 mb-3">货物明细</h3>
          <div className="space-y-3">
            {cargoItems.map((item, index) => (
              <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 flex-1">
                  <input
                    type="text"
                    placeholder="中文品名"
                    value={item.productName}
                    onChange={(e) => handleCargoChange(index, 'productName', e.target.value)}
                    className="input text-sm"
                  />
                  <input
                    type="text"
                    placeholder="英文品名"
                    value={item.productNameEn}
                    onChange={(e) => handleCargoChange(index, 'productNameEn', e.target.value)}
                    className="input text-sm"
                  />
                  <input
                    type="text"
                    placeholder="HS编码"
                    value={item.hsCode}
                    onChange={(e) => handleCargoChange(index, 'hsCode', e.target.value)}
                    className="input text-sm"
                  />
                  <input
                    type="number"
                    placeholder="数量"
                    value={item.quantity || ''}
                    onChange={(e) => handleCargoChange(index, 'quantity', parseInt(e.target.value) || 0)}
                    className="input text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="单价(USD)"
                    value={item.unitPrice || ''}
                    onChange={(e) => handleCargoChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="input text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCargoItem(index)}
                  className="p-2 text-gray-400 hover:text-red-500"
                  disabled={cargoItems.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCargoItem}
            className="mt-3 text-sm text-primary-600 hover:text-primary-700 flex items-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            添加货物
          </button>
        </div>

        {/* 备注 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">备注</h2>
          <textarea
            name="remark"
            value={formData.remark}
            onChange={handleChange}
            rows={3}
            className="input"
            placeholder="其他需要说明的信息..."
          />
        </div>

        {/* 提交按钮 */}
        <div className="flex items-center justify-end space-x-4">
          <Link to="/orders" className="btn btn-secondary">
            取消
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              '提交订单'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

