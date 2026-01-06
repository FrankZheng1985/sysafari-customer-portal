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
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  BarChart3,
  Calendar
} from 'lucide-react'
import DateInput from '../components/DatePicker'

interface OrderStats {
  total: number
  inProgress: number
  completed: number
  totalWeight: number
  totalVolume: number
}

interface TrendMonth {
  month: string
  label: string
  count: number
  weight: number
  volume: number
}

interface OrderTrend {
  months: TrendMonth[]
  summary: {
    totalOrders: number
    totalWeight: number
    totalVolume: number
  }
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
  
  // 订单趋势相关状态
  const [trend, setTrend] = useState<OrderTrend | null>(null)
  const [trendDateType, setTrendDateType] = useState<'created' | 'customs'>('created')
  const [trendViewType, setTrendViewType] = useState<'month' | 'year'>('month')
  
  // 筛选条件
  const [showFilters, setShowFilters] = useState(false)
  const [etdStart, setEtdStart] = useState('')
  const [etdEnd, setEtdEnd] = useState('')
  const [etaStart, setEtaStart] = useState('')
  const [etaEnd, setEtaEnd] = useState('')
  const [portOfLoading, setPortOfLoading] = useState('')
  const [portOfDischarge, setPortOfDischarge] = useState('')
  
  // 港口选项列表
  const [loadingPorts, setLoadingPorts] = useState<string[]>([])
  const [dischargePorts, setDischargePorts] = useState<string[]>([])
  
  // 排序状态
  const [sortField, setSortField] = useState<'etd' | 'eta' | ''>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // 可选的每页条数
  const pageSizeOptions = [10, 20, 50, 100]
  
  // 检查是否有活动的筛选条件
  const hasActiveFilters = etdStart || etdEnd || etaStart || etaEnd || portOfLoading || portOfDischarge

  useEffect(() => {
    fetchStats()
    fetchPorts()
    fetchTrend()
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [page, statusFilter, activeTab, currentPageSize, sortField, sortOrder])
  
  // 当趋势图日期类型变化时重新获取
  useEffect(() => {
    fetchTrend()
  }, [trendDateType])

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
  
  const fetchPorts = async () => {
    try {
      const res = await portalApi.getPorts()
      if (res.data.errCode === 200 && res.data.data) {
        setLoadingPorts(res.data.data.loadingPorts || [])
        setDischargePorts(res.data.data.dischargePorts || [])
      }
    } catch (error) {
      console.error('获取港口列表失败:', error)
    }
  }
  
  const fetchTrend = async () => {
    try {
      const res = await portalApi.getOrderTrend({ 
        type: trendViewType, 
        dateType: trendDateType 
      })
      if (res.data.errCode === 200 && res.data.data) {
        setTrend(res.data.data)
      }
    } catch (error) {
      console.error('获取订单趋势失败:', error)
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
        portOfDischarge: portOfDischarge || undefined,
        // 排序参数
        sortField: sortField || undefined,
        sortOrder: sortField ? sortOrder : undefined
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

  // 处理排序点击
  const handleSort = (field: 'etd' | 'eta') => {
    if (sortField === field) {
      // 已选中此字段，切换排序顺序
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // 选择新字段，默认降序（最新的在前）
      setSortField(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  // 获取排序图标
  const getSortIcon = (field: 'etd' | 'eta') => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 text-primary-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-primary-600" />
  }

  // 带 tooltip 的单元格组件（使用原生 title 属性，更稳定）
  const TruncatedCell = ({ value, maxWidth = 120 }: { value: string | null | undefined, maxWidth?: number }) => {
    if (!value) return <span className="text-gray-400">-</span>
    return (
      <span 
        className="block truncate text-gray-700 cursor-default" 
        style={{ maxWidth: `${maxWidth}px` }}
        title={value.length > 10 ? value : undefined}
      >
        {value}
      </span>
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

      {/* 订单量趋势图表 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">订单量趋势</span>
          </div>
          <div className="flex items-center gap-2">
            {/* 统计类型切换 */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setTrendDateType('created')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  trendDateType === 'created'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                创建时间
              </button>
              <button
                onClick={() => setTrendDateType('customs')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  trendDateType === 'customs'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                清关完成
              </button>
            </div>
            {/* 月/年切换 */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setTrendViewType('month')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                  trendViewType === 'month'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                月
              </button>
              <button
                onClick={() => setTrendViewType('year')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                  trendViewType === 'year'
                    ? 'bg-white text-primary-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                年
              </button>
            </div>
          </div>
        </div>
        
        {/* 柱状图 */}
        <div className="relative">
          {/* Y轴刻度 */}
          <div className="absolute left-0 top-0 h-48 flex flex-col justify-between text-xs text-gray-400 pr-2">
            {(() => {
              const maxCount = trend ? Math.max(...trend.months.map(m => m.count), 1) : 40
              const step = Math.ceil(maxCount / 4)
              return [step * 4, step * 3, step * 2, step, 0].map((val, idx) => (
                <span key={idx} className="text-right w-6">{val}</span>
              ))
            })()}
          </div>
          
          {/* 图表区域 */}
          <div className="ml-8 h-48 flex items-end gap-2 border-b border-gray-100 relative">
            {/* 水平网格线 */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="border-t border-dashed border-gray-100 w-full" />
              ))}
            </div>
            
            {/* 柱状图 */}
            {trend?.months.map((item, index) => {
              const maxCount = Math.max(...(trend?.months.map(m => m.count) || [1]), 1)
              const heightPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0
              return (
                <div key={item.month} className="flex-1 flex flex-col items-center justify-end relative group">
                  {/* 数值标签 */}
                  {item.count > 0 && (
                    <span className="text-xs font-semibold text-primary-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                      {item.count}
                    </span>
                  )}
                  {/* 柱子 */}
                  <div
                    className="w-full max-w-10 bg-primary-500 rounded-t-sm transition-all duration-300 hover:bg-primary-600 cursor-pointer relative"
                    style={{ 
                      height: heightPercent > 0 ? `${Math.max(heightPercent, 4)}%` : '2px',
                      minHeight: item.count > 0 ? '8px' : '2px'
                    }}
                  >
                    {/* 始终显示的数值 */}
                    {item.count > 0 && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-semibold text-primary-600 whitespace-nowrap">
                        {item.count}
                      </span>
                    )}
                  </div>
                  {/* 悬浮提示 */}
                  <div className="absolute bottom-full mb-8 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap shadow-lg">
                    <div className="font-medium mb-1">{item.month}</div>
                    <div>订单数: {item.count}</div>
                    <div>重量: {item.weight.toLocaleString()} KG</div>
                    <div>体积: {item.volume.toFixed(2)} CBM</div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-800"></div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* X轴标签 */}
          <div className="ml-8 flex gap-2 mt-2">
            {trend?.months.map(item => (
              <div key={item.month} className="flex-1 text-center text-xs text-gray-400">
                {item.label}
              </div>
            ))}
          </div>
        </div>
        
        {/* 汇总数据 */}
        <div className="flex justify-around mt-6 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{trend?.summary.totalOrders || 0}</p>
            <p className="text-xs text-gray-500 mt-1">近12月订单</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{(trend?.summary.totalWeight || 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">累计重量(KG)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{(trend?.summary.totalVolume || 0).toFixed(1)}</p>
            <p className="text-xs text-gray-500 mt-1">累计体积(CBM)</p>
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
              <DateInput
                label="ETD 开始"
                value={etdStart}
                onChange={setEtdStart}
                placeholder="选择开始日期"
              />
              <DateInput
                label="ETD 结束"
                value={etdEnd}
                onChange={setEtdEnd}
                placeholder="选择结束日期"
              />
              
              {/* ETA 日期范围 */}
              <DateInput
                label="ETA 开始"
                value={etaStart}
                onChange={setEtaStart}
                placeholder="选择开始日期"
              />
              <DateInput
                label="ETA 结束"
                value={etaEnd}
                onChange={setEtaEnd}
                placeholder="选择结束日期"
              />
              
              {/* 港口筛选 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">起运港</label>
                <select
                  value={portOfLoading}
                  onChange={(e) => setPortOfLoading(e.target.value)}
                  className="input text-sm w-full"
                >
                  <option value="">全部起运港</option>
                  {loadingPorts.map(port => (
                    <option key={port} value={port}>{port}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">目的港</label>
                <select
                  value={portOfDischarge}
                  onChange={(e) => setPortOfDischarge(e.target.value)}
                  className="input text-sm w-full"
                >
                  <option value="">全部目的港</option>
                  {dischargePorts.map(port => (
                    <option key={port} value={port}>{port}</option>
                  ))}
                </select>
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
                    <th>
                      <button
                        onClick={() => handleSort('etd')}
                        className={`inline-flex items-center gap-1 hover:text-primary-600 transition-colors ${sortField === 'etd' ? 'text-primary-600' : ''}`}
                      >
                        ETD
                        {getSortIcon('etd')}
                      </button>
                    </th>
                    <th>
                      <button
                        onClick={() => handleSort('eta')}
                        className={`inline-flex items-center gap-1 hover:text-primary-600 transition-colors ${sortField === 'eta' ? 'text-primary-600' : ''}`}
                      >
                        ETA
                        {getSortIcon('eta')}
                      </button>
                    </th>
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

