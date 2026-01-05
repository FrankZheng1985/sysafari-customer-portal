import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { portalApi } from '../utils/api'
import {
  ArrowLeft,
  Package,
  MapPin,
  Calendar,
  Ship,
  Truck,
  CheckCircle,
  Clock,
  FileText,
  Anchor,
  FileCheck,
  ShieldCheck,
  Home
} from 'lucide-react'

interface ProgressStep {
  key: string
  label: string
  completed: boolean
  time: string | null
}

interface OrderDetail {
  id: string
  orderNumber: string
  billNumber: string
  containerNumber: string
  externalOrderNo: string
  shipper: string
  consignee: string
  notifyParty: string
  portOfLoading: string
  portOfDischarge: string
  placeOfDelivery: string
  transportMethod: string
  containerType: string
  status: string
  rawStatus: string
  shipStatus: string
  customsStatus: string
  deliveryStatus: string
  docSwapStatus: string
  docSwapTime: string
  customsReleaseTime: string
  vessel: string
  voyage: string
  etd: string
  eta: string
  ata: string
  pieces: number
  weight: number
  volume: number
  description: string
  remark: string
  customerName: string
  customerCode: string
  createdAt: string
  updatedAt: string
  progressSteps: ProgressStep[]
}

// 进度图标映射
const stepIcons: Record<string, React.ElementType> = {
  accepted: Package,
  shipped: Ship,
  arrived: Anchor,
  doc_swap: FileCheck,
  customs: ShieldCheck,
  delivered: Home
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('info')

  useEffect(() => {
    if (id) {
      fetchOrderDetail()
    }
  }, [id])

  const fetchOrderDetail = async () => {
    try {
      const res = await portalApi.getOrderById(id!)
      if (res.data.errCode === 200) {
        setOrder(res.data.data)
      }
    } catch (error) {
      console.error('获取订单详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      '草稿': 'bg-gray-100 text-gray-600',
      '进行中': 'bg-blue-100 text-blue-700',
      '待发运': 'bg-amber-100 text-amber-700',
      '已发运': 'bg-blue-100 text-blue-700',
      '运输中': 'bg-blue-100 text-blue-700',
      '已到港': 'bg-green-100 text-green-700',
      '清关中': 'bg-purple-100 text-purple-700',
      '已放行': 'bg-teal-100 text-teal-700',
      '派送中': 'bg-indigo-100 text-indigo-700',
      '已签收': 'bg-green-100 text-green-700',
      '已完成': 'bg-green-100 text-green-700',
    }
    return statusMap[status] || 'bg-gray-100 text-gray-600'
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return dateStr.split('T')[0]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-16">
        <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">订单不存在</p>
        <Link to="/orders" className="mt-4 text-primary-600 hover:text-primary-700">
          返回订单列表
        </Link>
      </div>
    )
  }

  // 计算完成的步骤数
  const completedSteps = order.progressSteps?.filter(s => s.completed).length || 0
  const totalSteps = order.progressSteps?.length || 6

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/orders"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-page-title">订单 {order.orderNumber}</h1>
            <p className="text-small mt-0.5">
              提单号: {order.billNumber || '-'} | 柜号: {order.containerNumber || '-'}
            </p>
          </div>
        </div>
        <span className={`status-badge text-sm px-3 py-1 ${getStatusColor(order.status)}`}>
          {order.status}
        </span>
      </div>

      {/* 运输进度卡片 */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">运输进度</h2>
          <span className="text-sm text-gray-500">
            {completedSteps}/{totalSteps} 已完成
          </span>
        </div>
        
        {/* 进度条 */}
        <div className="relative">
          {/* 背景线 */}
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
          
          {/* 进度线 */}
          <div 
            className="absolute top-5 left-0 h-0.5 bg-green-500 transition-all duration-500"
            style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
          />
          
          {/* 步骤节点 */}
          <div className="relative flex justify-between">
            {order.progressSteps?.map((step, index) => {
              const Icon = stepIcons[step.key] || Package
              const isCompleted = step.completed
              const isCurrent = index === completedSteps
              
              return (
                <div key={step.key} className="flex flex-col items-center">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all ${
                      isCompleted 
                        ? 'bg-green-500 text-white' 
                        : isCurrent 
                          ? 'bg-blue-500 text-white animate-pulse'
                          : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span className={`text-xs mt-2 font-medium ${
                    isCompleted ? 'text-green-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                  {step.time && (
                    <span className="text-xs text-gray-400 mt-0.5">
                      {formatDate(step.time)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 关键时间节点 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-xs">ETD 预计离港</span>
          </div>
          <p className="text-base font-semibold text-gray-900">{order.etd || '-'}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">ETA 预计到港</span>
          </div>
          <p className="text-base font-semibold text-gray-900">{order.eta || '-'}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Anchor className="w-4 h-4" />
            <span className="text-xs">ATA 实际到港</span>
          </div>
          <p className="text-base font-semibold text-gray-900">{order.ata || '-'}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs">清关放行时间</span>
          </div>
          <p className="text-base font-semibold text-gray-900">{order.customsReleaseTime || '-'}</p>
        </div>
      </div>

      {/* 标签页 */}
      <div className="card">
        <div className="border-b border-gray-100">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'info', label: '基本信息' },
              { id: 'status', label: '状态详情' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 运输信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Ship className="w-4 h-4 text-primary-600" />
                  运输信息
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">运输方式</span>
                    <span className="text-gray-900 font-medium">{order.transportMethod || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">柜型</span>
                    <span className="text-gray-900 font-medium">{order.containerType || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">船名</span>
                    <span className="text-gray-900 font-medium">{order.vessel || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">航次</span>
                    <span className="text-gray-900 font-medium">{order.voyage || '-'}</span>
                  </div>
                </div>
              </div>

              {/* 起运信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  起运信息
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">起运港</span>
                    <span className="text-gray-900 font-medium">{order.portOfLoading || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">发货人</span>
                    <span className="text-gray-900 font-medium">{order.shipper || '-'}</span>
                  </div>
                </div>
              </div>

              {/* 目的地信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Home className="w-4 h-4 text-green-600" />
                  目的地信息
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">目的港</span>
                    <span className="text-gray-900 font-medium">{order.portOfDischarge || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">交货地点</span>
                    <span className="text-gray-900 font-medium">{order.placeOfDelivery || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">收货人</span>
                    <span className="text-gray-900 font-medium">{order.consignee || '-'}</span>
                  </div>
                </div>
              </div>

              {/* 货物信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-600" />
                  货物信息
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">件数</span>
                    <span className="text-gray-900 font-medium">{order.pieces || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">重量</span>
                    <span className="text-gray-900 font-medium">{order.weight ? `${order.weight} KG` : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">体积</span>
                    <span className="text-gray-900 font-medium">{order.volume ? `${order.volume} CBM` : '-'}</span>
                  </div>
                </div>
              </div>

              {/* 客户信息 */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-600" />
                  客户信息
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">客户名称</span>
                    <span className="text-gray-900 font-medium">{order.customerName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">客户编码</span>
                    <span className="text-gray-900 font-medium">{order.customerCode || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">外部订单号</span>
                    <span className="text-gray-900 font-medium">{order.externalOrderNo || '-'}</span>
                  </div>
                </div>
              </div>

              {/* 备注 */}
              {order.remark && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900">备注</h3>
                  <p className="text-sm text-gray-600">{order.remark}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'status' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 船运状态 */}
              <div className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Ship className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">船运状态</span>
                </div>
                <span className={`status-badge ${
                  order.shipStatus === '已到港' ? 'bg-green-100 text-green-700' :
                  order.shipStatus === '运输中' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {order.shipStatus || '-'}
                </span>
              </div>

              {/* 换单状态 */}
              <div className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileCheck className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-gray-900">换单状态</span>
                </div>
                <span className={`status-badge ${
                  order.docSwapStatus === '已换单' ? 'bg-green-100 text-green-700' :
                  order.docSwapStatus === '换单中' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {order.docSwapStatus || '-'}
                </span>
                {order.docSwapTime && (
                  <p className="text-xs text-gray-400 mt-2">{order.docSwapTime}</p>
                )}
              </div>

              {/* 清关状态 */}
              <div className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900">清关状态</span>
                </div>
                <span className={`status-badge ${
                  order.customsStatus === '已放行' ? 'bg-green-100 text-green-700' :
                  order.customsStatus === '查验中' ? 'bg-red-100 text-red-700' :
                  order.customsStatus === '清关中' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {order.customsStatus || '-'}
                </span>
                {order.customsReleaseTime && (
                  <p className="text-xs text-gray-400 mt-2">{order.customsReleaseTime}</p>
                )}
              </div>

              {/* 派送状态 */}
              <div className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">派送状态</span>
                </div>
                <span className={`status-badge ${
                  order.deliveryStatus === '已送达' ? 'bg-green-100 text-green-700' :
                  order.deliveryStatus === '派送中' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {order.deliveryStatus || '-'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
