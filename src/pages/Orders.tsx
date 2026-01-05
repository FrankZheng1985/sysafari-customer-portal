import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { portalApi } from '../utils/api'
import {
  Package,
  Search,
  Filter,
  Plus,
  Eye,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react'

interface OrderStats {
  total: number
  inProgress: number
  completed: number
  totalWeight: number
  totalVolume: number
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
  const [currentPageSize, setCurrentPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'inProgress' | 'completed'>('all')
  const [stats, setStats] = useState<OrderStats>({ total: 0, inProgress: 0, completed: 0, totalWeight: 0, totalVolume: 0 })
  
  // 筛选条件
  const [showFilters, setShowFilters] = useState(false)
  const [etdStart, setEtdStart] = useState('')
  const [etdEnd, setEtdEnd] = useState('')
  const [etaStart, setEtaStart] = useState('')
  const [etaEnd, setEtaEnd] = useState('')
  const [portOfLoading, setPortOfLoading] = useState('')
  const [portOfDischarge, setPortOfDischarge] = useState('')
  
  // 可选的每页条数
  const pageSizeOptions = [10, 20, 50, 100]
  
  // 检查是否有活动的筛选条件
  const hasActiveFilters = etdStart || etdEnd || etaStart || etaEnd || portOfLoading || portOfDischarge

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [page, statusFilter, activeTab, currentPageSize])

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
        pageSize: currentPageSize,
        billNumber: search || undefined,
        // 日期范围筛选
        etdStart: etdStart || undefined,
        etdEnd: etdEnd || undefined,
        etaStart: etaStart || undefined,
        etaEnd: etaEnd || undefined,
        // 港口筛选
        portOfLoading: portOfLoading || undefined,
        portOfDischarge: portOfDischarge || undefined
      }
      
      // 设置状态筛选
      if (activeTab === 'inProgress') {
        params.progressStatus = 'in_progress' // 进行中
      } else if (activeTab === 'completed') {
        params.progressStatus = 'completed' // 已完成
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
  
  // 清除所有筛选条件
  const clearFilters = () => {
    setEtdStart('')
    setEtdEnd('')
    setEtaStart('')
    setEtaEnd('')
    setPortOfLoading('')
    setPortOfDischarge('')
    setSearch('')
    setPage(1)
  }

  // 获取订单综合状态（按物流流程优先级判断，与ERP状态保持一致）
  // ship_status 可能的值: null, '', '未到港', '已发运', '运输中', '已到港'
  // customs_status 可能的值: null, '', '清关中', '查验中', '已放行'
  // delivery_status 可能的值: null, '', '待派送', '派送中', '已送达', '异常关闭'
  const getOrderStatus = (order: Order) => {
    // 1. 已送达（最终状态）- 包括异常关闭、已完成、已归档、已取消
    if (order.deliveryStatus === '已送达' || order.deliveryStatus === '异常关闭' || 
        order.rawStatus === '已完成' || order.rawStatus === '已归档' || order.rawStatus === '已取消') {
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
    // 6. 未到港（包括 null/空、未到港、已发运、运输中）
    // 所有还未到港的订单都归入此分类
    return '未到港'
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

  const handleTabChange = (tab: 'all' | 'inProgress' | 'completed') => {
    console.log('🔄 切换标签到:', tab)
    setActiveTab(tab)
    setPage(1)
    setStatusFilter('')
  }

  const totalPages = Math.ceil(total / currentPageSize)

  // 处理每页条数变化
  const handlePageSizeChange = (newSize: number) => {
    setCurrentPageSize(newSize)
    setPage(1)
  }

  // 带 tooltip 的单元格组件
  const TruncatedCell = ({ value, maxWidth = 120 }: { value: string | null | undefined, maxWidth?: number }) => {
    if (!value) return <span className="text-gray-400">-</span>
    return (
      <div className="relative group">
        <span 
          className="block truncate text-gray-700" 
          style={{ maxWidth: `${maxWidth}px` }}
        >
          {value}
        </span>
        {value.length > 10 && (
          <div className="absolute left-0 bottom-full mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap">
            {value}
            <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-page-title">订单管理</h1>
          <p className="text-small mt-1">查看和管理您的所有订单</p>
        </div>
        <Link
          to="/orders/new"
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          创建订单
        </Link>
      </div>

      {/* 订单统计卡片 */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span className="text-sm font-medium text-gray-700">订单统计</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
          {/* 总订单数 */}
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            <p className="text-xs text-gray-500 mt-1">总订单数</p>
          </div>
          {/* 进行中 */}
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.inProgress}</p>
            <p className="text-xs text-gray-500 mt-1">进行中</p>
          </div>
          {/* 已完成 */}
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{stats.completed}</p>
            <p className="text-xs text-gray-500 mt-1">已完成</p>
          </div>
          {/* 总重量 */}
          <div className="bg-orange-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.totalWeight.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">总重量(KG)</p>
          </div>
          {/* 总立方 */}
          <div className="bg-pink-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-pink-600">{stats.totalVolume.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">总立方(CBM)</p>
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
          onClick={() => handleTabChange('inProgress')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'inProgress'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          进行中 ({stats.inProgress})
        </button>
        <button
          onClick={() => handleTabChange('completed')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'completed'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          已完成 ({stats.completed})
        </button>
      </div>

      {/* 搜索和筛选 */}
      <div className="card p-4">
        {/* 主搜索栏 */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="搜索提单号或柜号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input input-with-icon-left"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn ${hasActiveFilters ? 'btn-primary' : 'btn-secondary'} relative`}
          >
            <Filter className="w-4 h-4" />
            高级筛选
            {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
          <button
            onClick={handleSearch}
            className="btn btn-primary"
          >
            <Search className="w-4 h-4" />
            搜索
          </button>
        </div>
        
        {/* 筛选面板 */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              {/* ETD 日期范围 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">ETD 开始</label>
                <input
                  type="date"
                  value={etdStart}
                  onChange={(e) => setEtdStart(e.target.value)}
                  className="input text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">ETD 结束</label>
                <input
                  type="date"
                  value={etdEnd}
                  onChange={(e) => setEtdEnd(e.target.value)}
                  className="input text-sm w-full"
                />
              </div>
              
              {/* ETA 日期范围 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">ETA 开始</label>
                <input
                  type="date"
                  value={etaStart}
                  onChange={(e) => setEtaStart(e.target.value)}
                  className="input text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">ETA 结束</label>
                <input
                  type="date"
                  value={etaEnd}
                  onChange={(e) => setEtaEnd(e.target.value)}
                  className="input text-sm w-full"
                />
              </div>
              
              {/* 港口筛选 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">起运港</label>
                <input
                  type="text"
                  placeholder="输入起运港..."
                  value={portOfLoading}
                  onChange={(e) => setPortOfLoading(e.target.value)}
                  className="input text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">目的港</label>
                <input
                  type="text"
                  placeholder="输入目的港..."
                  value={portOfDischarge}
                  onChange={(e) => setPortOfDischarge(e.target.value)}
                  className="input text-sm w-full"
                />
              </div>
            </div>
            
            {/* 筛选操作按钮 */}
            <div className="flex justify-end gap-2 mt-4">
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="btn btn-secondary text-sm"
                >
                  <X className="w-4 h-4" />
                  清除筛选
                </button>
              )}
              <button
                onClick={handleSearch}
                className="btn btn-primary text-sm"
              >
                应用筛选
              </button>
            </div>
          </div>
        )}
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
                    <th className="text-center">状态</th>
                    <th className="text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <TruncatedCell value={order.orderNumber} maxWidth={100} />
                      </td>
                      <td>
                        <TruncatedCell value={order.billNumber} maxWidth={120} />
                      </td>
                      <td>
                        <TruncatedCell value={order.containerNumber} maxWidth={110} />
                      </td>
                      <td>
                        <TruncatedCell value={order.portOfLoading} maxWidth={80} />
                      </td>
                      <td>
                        <TruncatedCell value={order.portOfDischarge} maxWidth={80} />
                      </td>
                      <td className="text-gray-700 whitespace-nowrap">{order.etd || '-'}</td>
                      <td className="text-gray-700 whitespace-nowrap">{order.eta || '-'}</td>
                      <td className="text-center">
                        <span className={`status-badge ${getStatusColor(getOrderStatus(order))}`}>
                          {getOrderStatus(order)}
                        </span>
                      </td>
                      <td className="text-center">
                        <Link
                          to={`/orders/${order.id}`}
                          className="inline-flex items-center justify-center p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600 transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              {/* 左侧：记录统计 */}
              <div className="text-sm text-gray-500">
                共 <span className="font-medium text-gray-700">{total}</span> 条记录
              </div>
              
              {/* 右侧：分页控件 */}
              <div className="flex items-center gap-4">
                {/* 每页条数选择 */}
                <select
                  value={currentPageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent cursor-pointer"
                >
                  {pageSizeOptions.map(size => (
                    <option key={size} value={size}>{size} 条/页</option>
                  ))}
                </select>
                
                {/* 上一页按钮 */}
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  上一页
                </button>
                
                {/* 页码显示 */}
                <span className="text-sm text-gray-600">
                  第 {page} / {totalPages || 1} 页
                </span>
                
                {/* 下一页按钮 */}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
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

