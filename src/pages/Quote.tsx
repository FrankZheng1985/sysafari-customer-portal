import { useState, useEffect, useRef } from 'react'
import { portalApi } from '../utils/api'
import { 
  FileText, Truck, Plus, Trash2, MapPin, Package, 
  Calculator, Clock, Check, X, Eye,
  AlertCircle, Loader2, Upload, FileSpreadsheet,
  CheckCircle, XCircle
} from 'lucide-react'
import AddressAutocomplete from '../components/AddressAutocomplete'

// 类型定义
interface TruckType {
  id: number
  code: string
  name: string
  nameEn: string
  category: string
  description: string
  maxWeight: number
  maxVolume: number | null
  length: number
  width: number
  height: number
  baseRatePerKm: number
  minCharge: number
}

// 卡车类型分类配置
const TRUCK_CATEGORIES = [
  { 
    key: 'van', 
    name: '厢式货车', 
    nameEn: 'Van', 
    icon: '🚐',
    description: '城市配送、短途运输'
  },
  { 
    key: 'rigid', 
    name: '箱式卡车', 
    nameEn: 'Rigid Truck', 
    icon: '🚛',
    description: '中长途标准货物'
  },
  { 
    key: 'semi', 
    name: '半挂车', 
    nameEn: 'Semi-Trailer', 
    icon: '🚚',
    description: '长途大批量运输'
  },
  { 
    key: 'reefer', 
    name: '冷藏车', 
    nameEn: 'Reefer', 
    icon: '❄️',
    description: '温控货物运输'
  },
  { 
    key: 'special', 
    name: '特种车辆', 
    nameEn: 'Special', 
    icon: '⚠️',
    description: '特殊货物运输'
  }
] as const

interface CargoItem {
  id: string
  name: string
  hsCode: string
  value: number
  quantity: number
  weight: number
  dutyRate: number
  vatRate: number
}

interface Waypoint {
  id: string
  address: string
}

interface TransportQuote {
  route: {
    distance: number
    duration: number
    durationFormatted: string
  }
  cost: {
    baseCost: number
    transportCost: number
    tolls: number
    fuelSurcharge: number
    totalCost: number
  }
  truckType: {
    code: string
    name: string
  }
  isEstimate?: boolean
  warning?: string
}

interface Inquiry {
  id: string
  inquiryNumber: string
  inquiryType: string
  status: string
  clearanceData: any
  transportData: any
  estimatedDuty: number
  estimatedVat: number
  clearanceFee: number
  transportFee: number
  totalQuote: number
  validUntil: string
  createdAt: string
  // 新增：匹配结果相关
  matchingStatus?: 'pending' | 'matched' | 'confirmed' | 'rejected'
  matchedItems?: MatchedCargoItem[]
  matchedAt?: string
  confirmedAt?: string
}

// 匹配后的货物项
interface MatchedCargoItem extends CargoItem {
  originalName?: string  // 原始品名
  matchedName?: string   // 匹配后品名
  matchedHsCode?: string // 匹配后的HS CODE
  matchConfidence?: number // 匹配置信度
  calculatedDuty?: number  // 计算后的关税
  calculatedVat?: number   // 计算后的增值税
  remarks?: string        // 备注
}

// 上传的Excel文件信息
interface UploadedFile {
  id: string
  fileName: string
  fileSize: number
  uploadedAt: string
  itemCount: number
}

// Tab 类型
type TabType = 'clearance' | 'transport' | 'history'

export default function Quote() {
  const [activeTab, setActiveTab] = useState<TabType>('transport')
  
  // 运输询价状态
  const [transportMode, setTransportMode] = useState<'container' | 'truck'>('container') // 运输方式：集装箱原柜 / 卡车
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [truckTypes, setTruckTypes] = useState<TruckType[]>([])
  const [selectedTruck, setSelectedTruck] = useState('')
  const [containerType, setContainerType] = useState('40GP') // 柜型选择
  const [returnLocation, setReturnLocation] = useState<'same' | 'different'>('same') // 还柜方式：同地/异地
  const [returnAddress, setReturnAddress] = useState('') // 异地还柜地址
  const [cargoWeight, setCargoWeight] = useState('')
  const [cargoVolume, setCargoVolume] = useState('')
  const [transportQuote, setTransportQuote] = useState<TransportQuote | null>(null)
  const [calculating, setCalculating] = useState(false)
  
  // 清关询价状态
  const [cargoItems, setCargoItems] = useState<CargoItem[]>([])
  const [hasTaxNumber, setHasTaxNumber] = useState(true)
  const [isExpress, setIsExpress] = useState(false)
  const [clearanceQuote, setClearanceQuote] = useState<any>(null)
  
  // Excel上传相关
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [uploading, setUploading] = useState(false)
  
  // 待确认匹配结果
  const [pendingConfirmations, setPendingConfirmations] = useState<Inquiry[]>([])
  const [loadingConfirmations, setLoadingConfirmations] = useState(false)
  const [selectedConfirmation, setSelectedConfirmation] = useState<Inquiry | null>(null)
  const [confirmationAction, setConfirmationAction] = useState<'confirm' | 'reject' | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  
  // 询价记录
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loadingInquiries, setLoadingInquiries] = useState(false)
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)
  
  // 提交状态
  const [submitting, setSubmitting] = useState(false)
  const [_submitSuccess, setSubmitSuccess] = useState(false)

  // 加载卡车类型
  useEffect(() => {
    loadTruckTypes()
  }, [])

  // 切换到历史记录时加载
  useEffect(() => {
    if (activeTab === 'history') {
      loadInquiries()
    }
  }, [activeTab])
  
  // 加载待确认的匹配结果
  useEffect(() => {
    if (activeTab === 'clearance') {
      loadPendingConfirmations()
    }
  }, [activeTab])

  const loadTruckTypes = async () => {
    try {
      const res = await portalApi.getTruckTypes()
      if (res.data.errCode === 200) {
        setTruckTypes(res.data.data || [])
        // 默认选择标准半挂车
        const defaultTruck = res.data.data?.find((t: TruckType) => 
          t.code === 'SEMI_STANDARD' || t.code === 'SEMI_40'
        )
        if (defaultTruck) {
          setSelectedTruck(defaultTruck.code)
        }
      }
    } catch (error) {
      console.error('加载卡车类型失败:', error)
    }
  }

  const loadInquiries = async () => {
    setLoadingInquiries(true)
    try {
      const res = await portalApi.getInquiries({ pageSize: 50 })
      if (res.data.errCode === 200) {
        setInquiries(res.data.data?.list || [])
      }
    } catch (error) {
      console.error('加载询价记录失败:', error)
    } finally {
      setLoadingInquiries(false)
    }
  }

  // 加载待确认的匹配结果
  const loadPendingConfirmations = async () => {
    setLoadingConfirmations(true)
    try {
      const res = await portalApi.getPendingConfirmations()
      if (res.data.errCode === 200) {
        setPendingConfirmations(res.data.data || [])
      }
    } catch (error) {
      console.error('加载待确认记录失败:', error)
    } finally {
      setLoadingConfirmations(false)
    }
  }

  // Excel文件上传
  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 验证文件类型
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ]
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('请上传Excel文件（.xlsx, .xls）或CSV文件')
      return
    }

    // 验证文件大小（最大10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过10MB')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await portalApi.uploadCargoExcel(formData)
      
      if (res.data.errCode === 200) {
        const { fileId, items, fileName, fileSize } = res.data.data
        
        // 设置上传文件信息
        setUploadedFile({
          id: fileId,
          fileName,
          fileSize,
          uploadedAt: new Date().toISOString(),
          itemCount: items.length
        })
        
        // 将解析后的货物项设置到列表
        setCargoItems(items.map((item: any, index: number) => ({
          id: `${Date.now()}-${index}`,
          name: item.name || '',
          hsCode: item.hsCode || '',
          value: item.value || 0,
          quantity: item.quantity || 1,
          weight: item.weight || 0,
          dutyRate: item.dutyRate || 0,
          vatRate: item.vatRate || 19
        })))
        
        alert(`成功导入 ${items.length} 项货物`)
      } else {
        alert(res.data.msg || '上传失败')
      }
    } catch (error: any) {
      console.error('上传Excel失败:', error)
      alert(error.response?.data?.msg || '上传失败，请稍后重试')
    } finally {
      setUploading(false)
      // 重置文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 删除已上传的Excel（清空货物列表）
  const handleDeleteUpload = () => {
    if (!confirm('确定要删除已上传的货物明细吗？')) return
    
    setUploadedFile(null)
    setCargoItems([])
    setClearanceQuote(null)
  }

  // 确认匹配结果
  const handleConfirmMatching = async (inquiry: Inquiry) => {
    try {
      const res = await portalApi.confirmMatching(inquiry.id)
      if (res.data.errCode === 200) {
        alert('已确认匹配结果，将继续进行清关处理')
        setSelectedConfirmation(null)
        loadPendingConfirmations()
        loadInquiries()
      } else {
        alert(res.data.msg || '操作失败')
      }
    } catch (error: any) {
      alert(error.response?.data?.msg || '操作失败')
    }
  }

  // 拒绝/取消匹配结果
  const handleRejectMatching = async (inquiry: Inquiry, reason: string) => {
    try {
      const res = await portalApi.rejectMatching(inquiry.id, reason)
      if (res.data.errCode === 200) {
        alert('已取消该匹配结果')
        setSelectedConfirmation(null)
        setRejectReason('')
        setConfirmationAction(null)
        loadPendingConfirmations()
        loadInquiries()
      } else {
        alert(res.data.msg || '操作失败')
      }
    } catch (error: any) {
      alert(error.response?.data?.msg || '操作失败')
    }
  }

  // 添加途经点
  const addWaypoint = () => {
    setWaypoints([...waypoints, { id: Date.now().toString(), address: '' }])
  }

  // 删除途经点
  const removeWaypoint = (id: string) => {
    setWaypoints(waypoints.filter(wp => wp.id !== id))
  }

  // 更新途经点
  const updateWaypoint = (id: string, address: string) => {
    setWaypoints(waypoints.map(wp => wp.id === id ? { ...wp, address } : wp))
  }

  // 计算运输费用
  const calculateTransport = async () => {
    if (!origin || !destination) {
      alert('请输入起点和终点地址')
      return
    }

    setCalculating(true)
    setTransportQuote(null)

    try {
      const res = await portalApi.calculateTransport({
        origin: { address: origin },
        destination: { address: destination },
        waypoints: waypoints.filter(wp => wp.address).map(wp => ({ address: wp.address })),
        truckTypeCode: selectedTruck,
        goods: {
          weight: parseFloat(cargoWeight) || 0,
          volume: parseFloat(cargoVolume) || 0
        }
      })

      if (res.data.errCode === 200) {
        setTransportQuote(res.data.data)
      } else {
        alert(res.data.msg || '计算失败')
      }
    } catch (error: any) {
      console.error('计算运输费用失败:', error)
      alert(error.response?.data?.msg || '计算失败，请稍后重试')
    } finally {
      setCalculating(false)
    }
  }

  // 添加货物项
  const addCargoItem = () => {
    setCargoItems([
      ...cargoItems,
      {
        id: Date.now().toString(),
        name: '',
        hsCode: '',
        value: 0,
        quantity: 1,
        weight: 0,
        dutyRate: 0,
        vatRate: 19
      }
    ])
  }

  // 删除货物项
  const removeCargoItem = (id: string) => {
    setCargoItems(cargoItems.filter(item => item.id !== id))
  }

  // 更新货物项
  const updateCargoItem = (id: string, field: string, value: any) => {
    setCargoItems(cargoItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  // 估算清关费用
  const estimateClearance = async () => {
    if (cargoItems.length === 0) {
      alert('请添加至少一项货物')
      return
    }

    setCalculating(true)
    setClearanceQuote(null)

    try {
      const res = await portalApi.estimateClearance({
        items: cargoItems.map(item => ({
          name: item.name,
          hsCode: item.hsCode,
          value: item.value,
          quantity: item.quantity,
          weight: item.weight,
          dutyRate: item.dutyRate,
          vatRate: item.vatRate
        })),
        totalValue: cargoItems.reduce((sum, item) => sum + item.value, 0),
        hsCodeCount: new Set(cargoItems.map(item => item.hsCode)).size,
        hasTaxNumber,
        isExpress
      })

      if (res.data.errCode === 200) {
        setClearanceQuote(res.data.data)
      } else {
        alert(res.data.msg || '估算失败')
      }
    } catch (error: any) {
      console.error('估算清关费用失败:', error)
      alert(error.response?.data?.msg || '估算失败，请稍后重试')
    } finally {
      setCalculating(false)
    }
  }

  // 提交询价
  const submitInquiry = async (type: 'clearance' | 'transport') => {
    setSubmitting(true)
    setSubmitSuccess(false)

    try {
      const data: any = {
        inquiryType: type
      }

      if (type === 'clearance') {
        data.clearanceData = {
          items: cargoItems,
          hasTaxNumber,
          isExpress,
          quote: clearanceQuote
        }
      } else {
        data.transportData = {
          transportMode, // 运输方式：container 或 truck
          containerType: transportMode === 'container' ? containerType : null, // 柜型
          returnLocation: transportMode === 'container' ? returnLocation : null, // 还柜方式
          returnAddress: transportMode === 'container' && returnLocation === 'different' ? returnAddress : null, // 异地还柜地址
          origin,
          destination,
          waypoints: waypoints.filter(wp => wp.address),
          truckType: transportMode === 'truck' ? selectedTruck : null,
          cargoWeight: parseFloat(cargoWeight) || 0,
          cargoVolume: parseFloat(cargoVolume) || 0,
          quote: transportQuote
        }
      }

      const res = await portalApi.createInquiry(data)

      if (res.data.errCode === 200) {
        setSubmitSuccess(true)
        alert(`询价已提交，编号：${res.data.data.inquiryNumber}`)
        // 切换到历史记录
        setActiveTab('history')
        loadInquiries()
      } else {
        alert(res.data.msg || '提交失败')
      }
    } catch (error: any) {
      console.error('提交询价失败:', error)
      alert(error.response?.data?.msg || '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 接受报价
  const handleAcceptQuote = async (inquiry: Inquiry) => {
    if (!confirm('确定接受此报价吗？')) return

    try {
      const res = await portalApi.acceptQuote(inquiry.id)
      if (res.data.errCode === 200) {
        alert('报价已接受')
        loadInquiries()
      } else {
        alert(res.data.msg || '操作失败')
      }
    } catch (error: any) {
      alert(error.response?.data?.msg || '操作失败')
    }
  }

  // 状态标签
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      quoted: 'bg-blue-100 text-blue-700',
      accepted: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      expired: 'bg-gray-100 text-gray-600'
    }
    const labels: Record<string, string> = {
      pending: '待报价',
      quoted: '已报价',
      accepted: '已接受',
      rejected: '已拒绝',
      expired: '已过期'
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    )
  }

  // 询价类型标签
  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      clearance: 'bg-purple-100 text-purple-700',
      transport: 'bg-cyan-100 text-cyan-700',
      combined: 'bg-indigo-100 text-indigo-700'
    }
    const labels: Record<string, string> = {
      clearance: '清关',
      transport: '运输',
      combined: '综合'
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${styles[type] || ''}`}>
        {labels[type] || type}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-page-title">在线询价</h1>
        <p className="text-small mt-1">获取清关和运输费用报价</p>
      </div>

      {/* Tab 切换 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('transport')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'transport'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Truck className="w-4 h-4 inline-block mr-2" />
            运输询价
          </button>
          <button
            onClick={() => setActiveTab('clearance')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'clearance'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 inline-block mr-2" />
            清关询价
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="w-4 h-4 inline-block mr-2" />
            询价记录
          </button>
        </nav>
      </div>

      {/* 运输询价 Tab */}
      {activeTab === 'transport' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：表单 */}
          <div className="space-y-6">
            {/* 起点/终点 */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                <MapPin className="w-5 h-5 inline-block mr-2 text-primary-500" />
                路线信息
              </h3>
              
              <div className="space-y-4">
                <AddressAutocomplete
                  value={origin}
                  onChange={(value) => setOrigin(value)}
                  label="起点地址"
                  placeholder="输入起点地址（如：Hamburg, Germany）"
                  required
                />

                {/* 途经点 */}
                {waypoints.map((wp, index) => (
                  <div key={wp.id} className="flex items-center gap-2">
                    <div className="flex-1">
                      <AddressAutocomplete
                        value={wp.address}
                        onChange={(value) => updateWaypoint(wp.id, value)}
                        label={`途经点 ${index + 1}`}
                        placeholder="卸货地址"
                      />
                    </div>
                    <button
                      onClick={() => removeWaypoint(wp.id)}
                      className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={addWaypoint}
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  添加途经点（多地址卸货）
                </button>

                <AddressAutocomplete
                  value={destination}
                  onChange={(value) => setDestination(value)}
                  label="终点地址"
                  placeholder="输入终点地址（如：Munich, Germany）"
                  required
                />
              </div>
            </div>

            {/* 运输方式选择 */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                <Truck className="w-5 h-5 inline-block mr-2 text-primary-500" />
                运输方式 <span className="text-red-500">*</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* 集装箱原柜运输 */}
                <label
                  className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    transportMode === 'container'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="transportMode"
                    value="container"
                    checked={transportMode === 'container'}
                    onChange={() => setTransportMode('container')}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Package className="w-6 h-6 text-primary-600 mr-2" />
                      <span className="font-medium text-gray-900">集装箱原柜</span>
                    </div>
                    {transportMode === 'container' && (
                      <Check className="w-5 h-5 text-primary-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    整柜从港口直接拖运到目的地，适合大批量货物
                  </p>
                  <p className="text-xs text-primary-600 mt-2">
                    FCL / Full Container Load
                  </p>
                </label>

                {/* 卡车运输 */}
                <label
                  className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    transportMode === 'truck'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="transportMode"
                    value="truck"
                    checked={transportMode === 'truck'}
                    onChange={() => setTransportMode('truck')}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Truck className="w-6 h-6 text-cyan-600 mr-2" />
                      <span className="font-medium text-gray-900">卡车运输</span>
                    </div>
                    {transportMode === 'truck' && (
                      <Check className="w-5 h-5 text-primary-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    拆柜后用卡车配送，适合散货或多地址分发
                  </p>
                  <p className="text-xs text-cyan-600 mt-2">
                    LTL / Less than Truckload
                  </p>
                </label>
              </div>
            </div>

            {/* 集装箱柜型选择 - 仅在选择集装箱原柜时显示 */}
            {transportMode === 'container' && (
              <>
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    <Package className="w-5 h-5 inline-block mr-2 text-primary-500" />
                    柜型选择
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { code: '20GP', name: '20尺普柜', desc: '20\' Standard', size: '5.9×2.35×2.39m' },
                      { code: '40GP', name: '40尺普柜', desc: '40\' Standard', size: '12×2.35×2.39m' },
                      { code: '40HQ', name: '40尺高柜', desc: '40\' High Cube', size: '12×2.35×2.69m' },
                      { code: '45HQ', name: '45尺高柜', desc: '45\' High Cube', size: '13.5×2.35×2.69m' },
                    ].map((container) => (
                      <label
                        key={container.code}
                        className={`relative flex flex-col p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-all ${
                          containerType === container.code
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="containerType"
                          value={container.code}
                          checked={containerType === container.code}
                          onChange={(e) => setContainerType(e.target.value)}
                          className="sr-only"
                        />
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">{container.name}</span>
                          {containerType === container.code && (
                            <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{container.desc}</span>
                        <span className="text-xs text-primary-600 mt-1">尺寸: {container.size}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 还柜方式选择 */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    <MapPin className="w-5 h-5 inline-block mr-2 text-primary-500" />
                    还柜方式
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* 同地还柜 */}
                      <label
                        className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          returnLocation === 'same'
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="returnLocation"
                          value="same"
                          checked={returnLocation === 'same'}
                          onChange={() => setReturnLocation('same')}
                          className="sr-only"
                        />
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">同地还柜</span>
                          {returnLocation === 'same' && (
                            <Check className="w-5 h-5 text-primary-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          在目的地卸货后，空柜返回起运港堆场
                        </p>
                      </label>

                      {/* 异地还柜 */}
                      <label
                        className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          returnLocation === 'different'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="returnLocation"
                          value="different"
                          checked={returnLocation === 'different'}
                          onChange={() => setReturnLocation('different')}
                          className="sr-only"
                        />
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">异地还柜</span>
                          {returnLocation === 'different' && (
                            <Check className="w-5 h-5 text-amber-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          空柜返回其他指定堆场（可能产生额外费用）
                        </p>
                      </label>
                    </div>

                    {/* 异地还柜地址输入 */}
                    {returnLocation === 'different' && (
                      <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <AddressAutocomplete
                          value={returnAddress}
                          onChange={(value) => setReturnAddress(value)}
                          label="还柜地址"
                          placeholder="请输入空柜返回堆场地址"
                          required
                        />
                        <p className="mt-2 text-xs text-amber-600">
                          <AlertCircle className="w-3 h-3 inline-block mr-1" />
                          异地还柜可能产生额外的调柜费用，具体费用将在报价中说明
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 卡车类型 - 仅在选择卡车运输时显示 */}
            {transportMode === 'truck' && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  <Truck className="w-5 h-5 inline-block mr-2 text-primary-500" />
                  卡车类型
                </h3>
                
                {/* 按分类显示卡车类型 */}
                <div className="space-y-6">
                  {TRUCK_CATEGORIES.map((category) => {
                    // 获取该分类下的卡车
                    const categoryTrucks = truckTypes.filter(t => t.category === category.key)
                    
                    // 如果该分类没有卡车，不显示
                    if (categoryTrucks.length === 0) return null
                    
                    return (
                      <div key={category.key} className="space-y-3">
                        {/* 分类标题 */}
                        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                          <span className="text-lg">{category.icon}</span>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800">{category.name}</h4>
                            <p className="text-xs text-gray-500">{category.nameEn} · {category.description}</p>
                          </div>
                        </div>
                        
                        {/* 该分类下的卡车选项 */}
                        <div className="grid grid-cols-2 gap-3">
                          {categoryTrucks.map((truck) => (
                            <label
                              key={truck.code}
                              className={`relative flex items-start p-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${
                                selectedTruck === truck.code
                                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <input
                                type="radio"
                                name="truckType"
                                value={truck.code}
                                checked={selectedTruck === truck.code}
                                onChange={(e) => setSelectedTruck(e.target.value)}
                                className="sr-only"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium text-gray-900">{truck.name}</p>
                                  {selectedTruck === truck.code && (
                                    <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">{truck.nameEn}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                    {truck.maxWeight / 1000}t
                                  </span>
                                  {truck.maxVolume && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                      {truck.maxVolume}m³
                                    </span>
                                  )}
                                </div>
                                {/* 价格信息已隐藏，实际报价由供应商系统提供 */}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                {/* 如果没有卡车类型数据 */}
                {truckTypes.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Truck className="w-10 h-10 mx-auto text-gray-300" />
                    <p className="mt-2">正在加载卡车类型...</p>
                  </div>
                )}
              </div>
            )}

            {/* 货物信息 */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                <Package className="w-5 h-5 inline-block mr-2 text-primary-500" />
                货物信息
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    货物重量 (kg)
                  </label>
                  <input
                    type="number"
                    value={cargoWeight}
                    onChange={(e) => setCargoWeight(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    货物体积 (m³)
                  </label>
                  <input
                    type="number"
                    value={cargoVolume}
                    onChange={(e) => setCargoVolume(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* 计算按钮 */}
            <button
              onClick={calculateTransport}
              disabled={calculating || !origin || !destination}
              className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {calculating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  计算中...
                </>
              ) : (
                <>
                  <Calculator className="w-5 h-5 mr-2" />
                  计算运输费用
                </>
              )}
            </button>
          </div>

          {/* 右侧：报价结果 */}
          <div className="space-y-6">
            {transportQuote ? (
              <>
                {/* 路线信息 */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">路线信息</h3>
                  
                  {/* 估算警告提示 */}
                  {transportQuote.isEstimate && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-700">
                          <p className="font-medium">估算数据</p>
                          <p>{transportQuote.warning || '当前为系统估算值，实际路线距离可能有所不同'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">总距离</span>
                      <span className="font-medium">
                        {transportQuote.route.distance} km
                        {transportQuote.isEstimate && <span className="text-yellow-500 text-xs ml-1">*估算</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">预计行程时间</span>
                      <span className="font-medium">
                        {transportQuote.route.durationFormatted}
                        {transportQuote.isEstimate && <span className="text-yellow-500 text-xs ml-1">*估算</span>}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">卡车类型</span>
                      <span className="font-medium">{transportQuote.truckType.name}</span>
                    </div>
                  </div>
                </div>

                {/* 费用明细 */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">费用明细</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">运输费</span>
                      <span>€{transportQuote.cost.transportCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">通行费（估算）</span>
                      <span>€{transportQuote.cost.tolls.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">燃油附加费</span>
                      <span>€{transportQuote.cost.fuelSurcharge.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between">
                      <span className="font-medium text-gray-900">总计</span>
                      <span className="text-xl font-bold text-primary-600">
                        €{transportQuote.cost.totalCost.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 提交询价 */}
                <button
                  onClick={() => submitInquiry('transport')}
                  disabled={submitting}
                  className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 mr-2" />
                      提交询价申请
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  * 以上报价为系统估算，最终价格以客服确认为准
                </p>
              </>
            ) : (
              <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
                <Truck className="w-12 h-12 mx-auto text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">运输报价</h3>
                <p className="mt-2 text-sm text-gray-500">
                  填写起点和终点地址，选择卡车类型后<br />
                  点击"计算运输费用"获取报价
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 清关询价 Tab */}
      {activeTab === 'clearance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：货物信息 */}
          <div className="space-y-6">
            {/* 待确认的匹配结果提醒 */}
            {loadingConfirmations && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
                <span className="text-gray-500">正在加载待确认记录...</span>
              </div>
            )}
            {!loadingConfirmations && pendingConfirmations.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium text-amber-800">
                      有 {pendingConfirmations.length} 条待确认的匹配结果
                    </h4>
                    <p className="text-sm text-amber-600 mt-1">
                      单证部门已完成货物匹配和关税计算，请及时确认
                    </p>
                    <div className="mt-3 space-y-2">
                      {pendingConfirmations.map((item) => (
                        <div 
                          key={item.id}
                          className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-200"
                        >
                          <div>
                            <span className="font-medium text-gray-900">
                              {item.inquiryNumber}
                            </span>
                            <span className="text-sm text-gray-500 ml-2">
                              {item.matchedItems?.length || 0} 项货物
                            </span>
                          </div>
                          <button
                            onClick={() => setSelectedConfirmation(item)}
                            className="px-3 py-1 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600"
                          >
                            查看并确认
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  <Package className="w-5 h-5 inline-block mr-2 text-primary-500" />
                  货物明细
                </h3>
                <div className="flex items-center gap-2">
                  {/* Excel上传按钮 */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  <button
                    onClick={handleFileSelect}
                    disabled={uploading}
                    className="text-sm text-green-600 hover:text-green-700 flex items-center px-2 py-1 rounded-lg hover:bg-green-50"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-1" />
                    )}
                    上传Excel
                  </button>
                  <button
                    onClick={addCargoItem}
                    className="text-sm text-primary-600 hover:text-primary-700 flex items-center px-2 py-1 rounded-lg hover:bg-primary-50"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    添加货物
                  </button>
                </div>
              </div>

              {/* 已上传文件信息 */}
              {uploadedFile && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileSpreadsheet className="w-5 h-5 text-green-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-green-800">
                          {uploadedFile.fileName}
                        </p>
                        <p className="text-xs text-green-600">
                          {uploadedFile.itemCount} 项货物 · 
                          {(uploadedFile.fileSize / 1024).toFixed(1)} KB · 
                          {new Date(uploadedFile.uploadedAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleDeleteUpload}
                      className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                      title="删除文件"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {cargoItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                  <Package className="w-10 h-10 mx-auto text-gray-300" />
                  <p className="mt-2">暂无货物，请点击"添加货物"</p>
                  <p className="text-xs text-gray-400 mt-1">
                    或上传Excel文件批量导入货物明细
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cargoItems.map((item, index) => (
                    <div key={item.id} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-gray-900">货物 {index + 1}</span>
                        <button
                          onClick={() => removeCargoItem(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">品名</label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateCargoItem(item.id, 'name', e.target.value)}
                            className="w-full px-2 py-1 text-sm border rounded"
                            placeholder="货物名称"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">HS CODE</label>
                          <input
                            type="text"
                            value={item.hsCode}
                            onChange={(e) => updateCargoItem(item.id, 'hsCode', e.target.value)}
                            className="w-full px-2 py-1 text-sm border rounded"
                            placeholder="8位数字"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">货值 (EUR)</label>
                          <input
                            type="number"
                            value={item.value || ''}
                            onChange={(e) => updateCargoItem(item.id, 'value', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">关税率 (%)</label>
                          <input
                            type="number"
                            value={item.dutyRate || ''}
                            onChange={(e) => updateCargoItem(item.id, 'dutyRate', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border rounded"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 选项 */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">清关选项</h3>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={hasTaxNumber}
                    onChange={(e) => setHasTaxNumber(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">我有欧盟税号（EORI）</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isExpress}
                    onChange={(e) => setIsExpress(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600"
                  />
                  <span className="ml-2 text-sm text-gray-700">加急处理</span>
                </label>
              </div>
            </div>

            <button
              onClick={estimateClearance}
              disabled={calculating || cargoItems.length === 0}
              className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {calculating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  估算中...
                </>
              ) : (
                <>
                  <Calculator className="w-5 h-5 mr-2" />
                  估算清关费用
                </>
              )}
            </button>
          </div>

          {/* 右侧：报价结果 */}
          <div className="space-y-6">
            {clearanceQuote ? (
              <>
                {/* 关税估算 */}
                {clearanceQuote.tax && (
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">关税估算</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">货物总值</span>
                        <span>€{clearanceQuote.tax.summary.totalValue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">预估关税</span>
                        <span>€{clearanceQuote.tax.summary.totalDuty.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">预估增值税</span>
                        <span>€{clearanceQuote.tax.summary.totalVat.toFixed(2)}</span>
                      </div>
                      {clearanceQuote.tax.summary.totalOtherTax > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">其他税费</span>
                          <span>€{clearanceQuote.tax.summary.totalOtherTax.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t pt-3 flex justify-between">
                        <span className="font-medium">预估税费合计</span>
                        <span className="font-bold text-amber-600">
                          €{clearanceQuote.tax.summary.totalTax.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      * 以上税费为预估值，实际以海关核定为准
                    </p>
                  </div>
                )}

                {/* 清关服务费 */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">清关服务费</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">基础清关费</span>
                      <span>€{clearanceQuote.clearance.breakdown.baseFee}</span>
                    </div>
                    {clearanceQuote.clearance.breakdown.hsCodeFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          HS CODE 费用 ({clearanceQuote.clearance.breakdown.chargeableHsCodes}个)
                        </span>
                        <span>€{clearanceQuote.clearance.breakdown.hsCodeFee}</span>
                      </div>
                    )}
                    {clearanceQuote.clearance.breakdown.valueFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">货值服务费</span>
                        <span>€{clearanceQuote.clearance.breakdown.valueFee}</span>
                      </div>
                    )}
                    {clearanceQuote.clearance.breakdown.taxNumberFee && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">税号使用费</span>
                        <span>€{clearanceQuote.clearance.breakdown.taxNumberFee}</span>
                      </div>
                    )}
                    {clearanceQuote.clearance.breakdown.expressFee && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">加急费</span>
                        <span>€{clearanceQuote.clearance.breakdown.expressFee}</span>
                      </div>
                    )}
                    <div className="border-t pt-3 flex justify-between">
                      <span className="font-medium text-gray-900">服务费合计</span>
                      <span className="text-xl font-bold text-primary-600">
                        €{clearanceQuote.clearance.clearanceFee.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 提交询价 */}
                <button
                  onClick={() => submitInquiry('clearance')}
                  disabled={submitting}
                  className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 mr-2" />
                      提交询价申请
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">清关报价</h3>
                <p className="mt-2 text-sm text-gray-500">
                  添加货物信息后<br />
                  点击"估算清关费用"获取报价
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 询价记录 Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow-sm border">
          {loadingInquiries ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto text-primary-500 animate-spin" />
              <p className="mt-2 text-gray-500">加载中...</p>
            </div>
          ) : inquiries.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-12 h-12 mx-auto text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">暂无询价记录</h3>
              <p className="mt-2 text-sm text-gray-500">
                提交运输或清关询价后，记录将显示在这里
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">询价编号</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">报价金额</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">有效期</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inquiries.map((inquiry) => (
                    <tr key={inquiry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {inquiry.inquiryNumber}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getTypeBadge(inquiry.inquiryType)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getStatusBadge(inquiry.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {inquiry.totalQuote > 0 ? (
                          <span className="font-medium">€{inquiry.totalQuote.toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {inquiry.validUntil || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(inquiry.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedInquiry(inquiry)}
                            className="text-primary-600 hover:text-primary-700"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {inquiry.status === 'quoted' && (
                            <>
                              <button
                                onClick={() => handleAcceptQuote(inquiry)}
                                className="text-green-600 hover:text-green-700"
                                title="接受报价"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 询价详情弹窗 */}
      {selectedInquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium">
                询价详情 - {selectedInquiry.inquiryNumber}
              </h3>
              <button
                onClick={() => setSelectedInquiry(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">类型</span>
                  <p className="font-medium">{getTypeBadge(selectedInquiry.inquiryType)}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">状态</span>
                  <p className="font-medium">{getStatusBadge(selectedInquiry.status)}</p>
                </div>
              </div>

              {selectedInquiry.transportData && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">运输信息</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">起点：</span>{selectedInquiry.transportData.origin}</p>
                    <p><span className="text-gray-500">终点：</span>{selectedInquiry.transportData.destination}</p>
                    {selectedInquiry.transportData.waypoints?.length > 0 && (
                      <p><span className="text-gray-500">途经点：</span>
                        {selectedInquiry.transportData.waypoints.map((wp: any) => wp.address).join(' → ')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedInquiry.totalQuote > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">报价明细</h4>
                  <div className="space-y-2">
                    {selectedInquiry.clearanceFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">清关服务费</span>
                        <span>€{selectedInquiry.clearanceFee.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedInquiry.estimatedDuty > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">预估关税</span>
                        <span>€{selectedInquiry.estimatedDuty.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedInquiry.estimatedVat > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">预估增值税</span>
                        <span>€{selectedInquiry.estimatedVat.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedInquiry.transportFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">运输费用</span>
                        <span>€{selectedInquiry.transportFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium pt-2 border-t">
                      <span>总计</span>
                      <span className="text-primary-600">€{selectedInquiry.totalQuote.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedInquiry.status === 'quoted' && (
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      handleAcceptQuote(selectedInquiry)
                      setSelectedInquiry(null)
                    }}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    接受报价
                  </button>
                  <button
                    onClick={() => setSelectedInquiry(null)}
                    className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    稍后处理
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 匹配结果确认弹窗 */}
      {selectedConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b bg-amber-50">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />
                <h3 className="text-lg font-medium text-amber-800">
                  待确认匹配结果 - {selectedConfirmation.inquiryNumber}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedConfirmation(null)
                  setConfirmationAction(null)
                  setRejectReason('')
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* 匹配信息 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">单证部门已完成货物匹配</span>
                  {selectedConfirmation.matchedAt && (
                    <span className="text-blue-600 ml-2">
                      匹配时间：{new Date(selectedConfirmation.matchedAt).toLocaleString('zh-CN')}
                    </span>
                  )}
                </p>
              </div>

              {/* 货物匹配明细表格 */}
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">序号</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">原始品名</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">匹配品名</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">HS CODE</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">货值(€)</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">关税(€)</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">增值税(€)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(selectedConfirmation.matchedItems || selectedConfirmation.clearanceData?.items || []).map((item: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-500">{index + 1}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          {item.originalName || item.name || '-'}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <span className="text-green-600 font-medium">
                            {item.matchedName || item.name || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm font-mono text-gray-900">
                          {item.matchedHsCode || item.hsCode || '-'}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-gray-900">
                          {(item.value || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-amber-600">
                          {(item.calculatedDuty || 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-blue-600">
                          {(item.calculatedVat || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-900 text-right">
                        合计：
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-right">
                        €{(selectedConfirmation.clearanceData?.quote?.tax?.summary?.totalValue || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-right text-amber-600">
                        €{(selectedConfirmation.estimatedDuty || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-right text-blue-600">
                        €{(selectedConfirmation.estimatedVat || 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 费用汇总 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">费用汇总</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">预估关税</p>
                    <p className="text-lg font-bold text-amber-600">
                      €{(selectedConfirmation.estimatedDuty || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">预估增值税</p>
                    <p className="text-lg font-bold text-blue-600">
                      €{(selectedConfirmation.estimatedVat || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">清关服务费</p>
                    <p className="text-lg font-bold text-gray-900">
                      €{(selectedConfirmation.clearanceFee || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center bg-primary-50 rounded-lg py-2">
                    <p className="text-sm text-primary-600">预估总费用</p>
                    <p className="text-xl font-bold text-primary-600">
                      €{(selectedConfirmation.totalQuote || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 拒绝原因输入 */}
              {confirmationAction === 'reject' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-red-800 mb-2">
                    请填写取消/不同意的原因：
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="请说明不同意的原因，如：品名匹配有误、关税计算不正确等"
                    rows={3}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-4 border-t">
                {confirmationAction === 'reject' ? (
                  <>
                    <button
                      onClick={() => handleRejectMatching(selectedConfirmation, rejectReason)}
                      disabled={!rejectReason.trim()}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      确认取消
                    </button>
                    <button
                      onClick={() => {
                        setConfirmationAction(null)
                        setRejectReason('')
                      }}
                      className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      返回
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleConfirmMatching(selectedConfirmation)}
                      className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" />
                      确认无误，继续清关
                    </button>
                    <button
                      onClick={() => setConfirmationAction('reject')}
                      className="flex-1 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center justify-center"
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      不同意 / 取消
                    </button>
                  </>
                )}
              </div>

              <p className="text-xs text-gray-500 text-center">
                * 确认后将继续进行清关流程，取消后需重新提交或联系客服处理
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

