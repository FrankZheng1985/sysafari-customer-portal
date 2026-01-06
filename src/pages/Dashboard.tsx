import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { portalApi } from '../utils/api'
import {
  Package,
  FileText,
  CreditCard,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Ship,
  Plus,
  BarChart3,
  Calendar
} from 'lucide-react'

interface OrderStats {
  total: number
  notArrived: number
  arrived: number
  customsCleared: number
  delivering: number
  delivered: number
}

interface PayableSummary {
  balance: number
  overdueAmount: number
  overdueCount: number
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

export default function Dashboard() {
  const { user } = useAuth()
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null)
  const [payableSummary, setPayableSummary] = useState<PayableSummary | null>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // 订单趋势相关状态
  const [trend, setTrend] = useState<OrderTrend | null>(null)
  const [trendDateType, setTrendDateType] = useState<'created' | 'customs'>('created')
  const [trendViewType, setTrendViewType] = useState<'month' | 'year'>('month')

  useEffect(() => {
    fetchDashboardData()
    fetchTrend()
  }, [])
  
  // 当趋势图日期类型变化时重新获取
  useEffect(() => {
    fetchTrend()
  }, [trendDateType])

  const fetchDashboardData = async () => {
    try {
      // 独立处理每个 API 调用，避免一个失败导致全部失败
      
      // 获取订单统计
      try {
        const statsRes = await portalApi.getOrderStats()
        console.log('📊 订单统计响应:', statsRes.data)
        if (statsRes.data.errCode === 200) {
          const stats = statsRes.data.data
          setOrderStats({
            total: parseInt(stats.total) || 0,
            notArrived: parseInt(stats.notArrived) || 0,
            arrived: parseInt(stats.arrived) || 0,
            customsCleared: parseInt(stats.customsCleared) || 0,
            delivering: parseInt(stats.delivering) || 0,
            delivered: parseInt(stats.delivered) || 0
          })
        }
      } catch (e) {
        console.error('获取订单统计失败:', e)
      }
      
      // 获取应付账款
      try {
        const payablesRes = await portalApi.getPayables()
        console.log('💰 应付账款响应:', payablesRes.data)
        if (payablesRes.data.errCode === 200) {
          setPayableSummary(payablesRes.data.data?.summary)
        }
      } catch (e) {
        console.error('获取应付账款失败:', e)
      }
      
      // 获取最近订单
      try {
        const ordersRes = await portalApi.getOrders({ pageSize: 5 })
        console.log('📦 订单列表响应:', ordersRes.data)
        if (ordersRes.data.errCode === 200) {
          setRecentOrders(ordersRes.data.data?.list || [])
        }
      } catch (e) {
        console.error('获取订单列表失败:', e)
      }
      
    } catch (error) {
      console.error('获取仪表盘数据失败:', error)
    } finally {
      setLoading(false)
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

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      '草稿': 'bg-gray-100 text-gray-600',
      '待发运': 'bg-amber-100 text-amber-700',
      '已发运': 'bg-blue-100 text-blue-700',
      '运输中': 'bg-blue-100 text-blue-700',
      '已到港': 'bg-green-100 text-green-700',
      '已签收': 'bg-green-100 text-green-700',
    }
    return statusMap[status] || 'bg-gray-100 text-gray-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 欢迎信息 */}
      <div className="bg-primary-600 rounded-lg px-5 py-4 text-white">
        <h1 className="text-lg font-semibold">
          欢迎回来，{user?.customerName}
        </h1>
        <p className="text-primary-200 text-[13px] mt-0.5">
          客户编号: {user?.customerCode}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-gray-500">总订单数</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">
                {orderStats?.total || 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-gray-500">运输中</p>
              <p className="text-xl font-semibold text-blue-600 mt-1">
                {(orderStats?.notArrived || 0) + (orderStats?.delivering || 0)}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Ship className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-gray-500">待付款</p>
              <p className="text-xl font-semibold text-amber-600 mt-1">
                €{payableSummary?.balance?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-gray-500">逾期账款</p>
              <p className="text-xl font-semibold text-red-600 mt-1">
                €{payableSummary?.overdueAmount?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 订单量趋势图表 */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
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
          <div className="absolute left-0 top-0 h-52 flex flex-col justify-between text-xs text-gray-400 pr-2">
            {(() => {
              const maxCount = trend ? Math.max(...trend.months.map(m => m.count), 1) : 40
              const step = Math.ceil(maxCount / 4)
              return [step * 4, step * 3, step * 2, step, 0].map((val, idx) => (
                <span key={idx} className="text-right w-6">{val}</span>
              ))
            })()}
          </div>
          
          {/* 图表区域 */}
          <div className="ml-8 h-52 flex items-end gap-1.5 border-b border-gray-200 relative">
            {/* 水平网格线 */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="border-t border-dashed border-gray-100 w-full" />
              ))}
            </div>
            
            {/* 柱状图 */}
            {trend?.months.map((item) => {
              const maxCount = Math.max(...(trend?.months.map(m => m.count) || [1]), 1)
              const heightPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0
              // 根据数值比例计算颜色深浅：低值浅色，高值深色
              const colorIntensity = maxCount > 0 ? Math.max(0.3, item.count / maxCount) : 0.3
              const isHighValue = heightPercent >= 70  // 高于70%为高值
              const isMediumValue = heightPercent >= 40 && heightPercent < 70  // 40-70%为中值
              
              return (
                <div key={item.month} className="flex-1 flex flex-col items-center justify-end relative group">
                  {/* 柱子 - 根据高低使用不同颜色 */}
                  <div
                    className={`w-full max-w-8 rounded-t transition-all duration-300 cursor-pointer relative shadow-sm ${
                      item.count === 0 
                        ? 'bg-gray-200' 
                        : isHighValue 
                          ? 'bg-primary-600 hover:bg-primary-700' 
                          : isMediumValue 
                            ? 'bg-primary-500 hover:bg-primary-600' 
                            : 'bg-primary-400 hover:bg-primary-500'
                    }`}
                    style={{ 
                      height: heightPercent > 0 ? `${Math.max(heightPercent, 6)}%` : '3px',
                      minHeight: item.count > 0 ? '12px' : '3px',
                      opacity: item.count > 0 ? colorIntensity + 0.4 : 0.5
                    }}
                  >
                    {/* 始终显示的数值 */}
                    {item.count > 0 && (
                      <span className={`absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap ${
                        isHighValue ? 'text-primary-700' : isMediumValue ? 'text-primary-600' : 'text-primary-500'
                      }`}>
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
          <div className="ml-8 flex gap-1.5 mt-2">
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

      {/* 订单列表和快捷操作 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 最近订单 */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-gray-900">最近订单</h2>
            <Link 
              to="/orders" 
              className="text-[12px] text-primary-600 hover:text-primary-700 flex items-center"
            >
              查看全部 <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                      <Package className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-gray-900">
                        {order.orderNumber || order.billNumber || order.id}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {order.billNumber || order.containerNumber || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      ETA: {order.eta || '-'}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-10 text-center text-gray-400 text-[13px]">
                暂无订单数据
              </div>
            )}
          </div>
        </div>

        {/* 快捷操作 */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-[14px] font-semibold text-gray-900">快捷操作</h2>
          </div>
          <div className="p-3 space-y-2">
            <Link
              to="/orders/new"
              className="flex items-center px-3 py-2.5 rounded-md hover:bg-primary-50 transition-colors group"
            >
              <div className="w-8 h-8 bg-primary-100 rounded flex items-center justify-center group-hover:bg-primary-200">
                <Plus className="w-4 h-4 text-primary-600" />
              </div>
              <div className="ml-2.5">
                <p className="text-[13px] font-medium text-gray-900">创建新订单</p>
                <p className="text-[11px] text-gray-500">提交货物运输请求</p>
              </div>
            </Link>
            
            <Link
              to="/invoices"
              className="flex items-center px-3 py-2.5 rounded-md hover:bg-blue-50 transition-colors group"
            >
              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center group-hover:bg-blue-200">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="ml-2.5">
                <p className="text-[13px] font-medium text-gray-900">查看账单</p>
                <p className="text-[11px] text-gray-500">历史账单与费用明细</p>
              </div>
            </Link>
            
            <Link
              to="/api-docs"
              className="flex items-center px-3 py-2.5 rounded-md hover:bg-purple-50 transition-colors group"
            >
              <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center group-hover:bg-purple-200">
                <TrendingUp className="w-4 h-4 text-purple-600" />
              </div>
              <div className="ml-2.5">
                <p className="text-[13px] font-medium text-gray-900">API 文档</p>
                <p className="text-[11px] text-gray-500">查看接口开发文档</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
