import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../utils/api'
import {
  Package,
  Search,
  Filter,
  Plus,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Truck,
  CheckCircle,
  Anchor,
  BadgeCheck
} from 'lucide-react'

interface OrderStats {
  total: number
  notArrived: number
  arrived: number
  customsCleared: number
  delivering: number
  delivered: number
}

interface Order {
  id: string
  orderNumber: string
  billNumber: string
  containerNumber: string
  externalOrderNo: string
  shipper: string
  consignee: string
  portOfLoading: string
  portOfDischarge: string
  status: string
  rawStatus: string
  shipStatus: string
  customsStatus: string
  deliveryStatus: string
  etd: string
  eta: string
  createdAt: string
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'notArrived' | 'arrived' | 'customsCleared' | 'delivering' | 'delivered'>('all')
  const [stats, setStats] = useState<OrderStats>({ total: 0, notArrived: 0, arrived: 0, customsCleared: 0, delivering: 0, delivered: 0 })

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [page, statusFilter, activeTab])

  const fetchStats = async () => {
    try {
      const res = await portalApi.getOrderStats()
      if (res.data.errCode === 200 && res.data.data) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('获取订单统计失败:', error)
    }
  }

  const fetchOrders = async () => {
    setLoading(true)
    try {
      // 根据分类标签确定筛选条件
      const params: any = {
        page,
        pageSize,
        billNumber: search || undefined
      }
      
      // 设置状态筛选
      if (activeTab === 'notArrived') {
        params.shipStatus = 'not_arrived' // 未到港
      } else if (activeTab === 'arrived') {
        params.shipStatus = 'arrived' // 已到港
      } else if (activeTab === 'customsCleared') {
        params.customsStatus = 'cleared' // 清关放行
      } else if (activeTab === 'delivering') {
        params.deliveryStatus = 'delivering' // 派送中
      } else if (activeTab === 'delivered') {
        params.deliveryStatus = 'delivered' // 已送达
      }
      
      console.log('🔍 当前标签:', activeTab, '请求参数:', params)
      const res = await portalApi.getOrders(params)
      console.log('📦 订单列表响应:', res.data, '记录数:', res.data.data?.total)
      if (res.data.errCode === 200) {
        // 订单列表在 data.list 中，total 在 data.total 中
        setOrders(res.data.data?.list || [])
        setTotal(parseInt(res.data.data?.total) || 0)
      }
    } catch (error) {
      console.error('获取订单列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setPage(1)
    fetchOrders()
  }

  // 获取订单综合状态（按物流流程优先级判断）
  const getOrderStatus = (order: Order) => {
    // 1. 已送达（最终状态）
    if (order.deliveryStatus === '已送达' || order.rawStatus === '已完成') {
      return '已送达'
    }
    // 2. 派送中
    if (order.deliveryStatus === '派送中' || order.deliveryStatus === '待派送') {
      return '派送中'
    }
    // 3. 清关放行（已放行但未派送）
    if (order.customsStatus === '已放行') {
      return '清关放行'
    }
    // 4. 清关中
    if (order.customsStatus === '清关中' || order.customsStatus === '查验中') {
      return '清关中'
    }
    // 5. 已到港（已到港但未开始清关或清关未完成）
    if (order.shipStatus === '已到港') {
      return '已到港'
    }
    // 6. 未到港
    if (order.shipStatus === '未到港') {
      return '未到港'
    }
    return '进行中'
  }

  // 获取状态对应的颜色
  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      '未到港': 'bg-orange-100 text-orange-700',
      '已到港': 'bg-cyan-100 text-cyan-700',
      '清关中': 'bg-yellow-100 text-yellow-700',
      '清关放行': 'bg-purple-100 text-purple-700',
      '派送中': 'bg-blue-100 text-blue-700',
      '已送达': 'bg-green-100 text-green-700',
      '进行中': 'bg-gray-100 text-gray-600',
    }
    return statusMap[status] || 'bg-gray-100 text-gray-600'
  }

  const handleTabChange = (tab: 'all' | 'notArrived' | 'arrived' | 'customsCleared' | 'delivering' | 'delivered') => {
    console.log('🔄 切换标签到:', tab)
    setActiveTab(tab)
    setPage(1)
    setStatusFilter('')
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">订单管理</h1>
          <p className="text-sm text-gray-500 mt-1">查看和管理您的所有订单</p>
        </div>
        <Link
          to="/orders/new"
          className="btn btn-primary inline-flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          创建订单
        </Link>
      </div>

      {/* 统计卡片 - 可点击 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div 
          className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
            activeTab === 'all' ? 'ring-2 ring-primary-500' : ''
          }`}
          onClick={() => handleTabChange('all')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">总单量</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary-600" />
            </div>
          </div>
        </div>
        <div 
          className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
            activeTab === 'notArrived' ? 'ring-2 ring-orange-500' : ''
          }`}
          onClick={() => handleTabChange('notArrived')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">未到港</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{stats.notArrived}</p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Anchor className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
        <div 
          className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
            activeTab === 'arrived' ? 'ring-2 ring-cyan-500' : ''
          }`}
          onClick={() => handleTabChange('arrived')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">已到港</p>
              <p className="text-2xl font-bold text-cyan-600 mt-1">{stats.arrived}</p>
            </div>
            <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
              <Anchor className="w-5 h-5 text-cyan-600" />
            </div>
          </div>
        </div>
        <div 
          className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
            activeTab === 'customsCleared' ? 'ring-2 ring-purple-500' : ''
          }`}
          onClick={() => handleTabChange('customsCleared')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">清关放行</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.customsCleared}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <BadgeCheck className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
        <div 
          className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
            activeTab === 'delivering' ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => handleTabChange('delivering')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">派送中</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.delivering}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div 
          className={`card p-4 cursor-pointer transition-all hover:shadow-md ${
            activeTab === 'delivered' ? 'ring-2 ring-green-500' : ''
          }`}
          onClick={() => handleTabChange('delivered')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">已送达</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.delivered}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 分类标签 */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => handleTabChange('all')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          全部订单 ({stats.total})
        </button>
        <button
          onClick={() => handleTabChange('notArrived')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'notArrived'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          未到港 ({stats.notArrived})
        </button>
        <button
          onClick={() => handleTabChange('arrived')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'arrived'
              ? 'border-cyan-600 text-cyan-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          已到港 ({stats.arrived})
        </button>
        <button
          onClick={() => handleTabChange('customsCleared')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'customsCleared'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          清关放行 ({stats.customsCleared})
        </button>
        <button
          onClick={() => handleTabChange('delivering')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'delivering'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          派送中 ({stats.delivering})
        </button>
        <button
          onClick={() => handleTabChange('delivered')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'delivered'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          已送达 ({stats.delivered})
        </button>
      </div>

      {/* 搜索和筛选 */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索提单号或柜号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input pl-10"
            />
          </div>
          <button
            onClick={handleSearch}
            className="btn btn-primary"
          >
            <Filter className="w-4 h-4 mr-2" />
            筛选
          </button>
        </div>
      </div>

      {/* 订单列表 */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : orders.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>订单号</th>
                    <th>提单号</th>
                    <th>柜号</th>
                    <th>起运港</th>
                    <th>目的港</th>
                    <th>ETD</th>
                    <th>ETA</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="font-medium text-gray-900">{order.orderNumber || '-'}</td>
                      <td>{order.billNumber || '-'}</td>
                      <td>{order.containerNumber || '-'}</td>
                      <td>{order.portOfLoading || '-'}</td>
                      <td>{order.portOfDischarge || '-'}</td>
                      <td>{order.etd || '-'}</td>
                      <td>{order.eta || '-'}</td>
                      <td>
                        <div className="flex items-center justify-center">
                          <span className={`status-badge ${getStatusColor(getOrderStatus(order))}`}>
                            {getOrderStatus(order)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-center">
                          <Link
                            to={`/orders/${order.id}`}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  共 {total} 条记录，第 {page} / {totalPages} 页
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm">
                    {page}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <Package className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500">暂无订单数据</p>
            <Link
              to="/orders/new"
              className="mt-4 text-primary-600 hover:text-primary-700"
            >
              创建第一个订单
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

