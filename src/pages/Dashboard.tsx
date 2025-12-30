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
  Plus
} from 'lucide-react'

interface OrderStats {
  total: number
  draft: number
  pending: number
  shipping: number
  arrived: number
  completed: number
}

interface PayableSummary {
  balance: number
  overdueAmount: number
  overdueCount: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null)
  const [payableSummary, setPayableSummary] = useState<PayableSummary | null>(null)
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

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
            draft: parseInt(stats.draft) || 0,
            pending: parseInt(stats.pending) || 0,
            shipping: parseInt(stats.shipping) || 0,
            arrived: parseInt(stats.arrived) || 0,
            completed: parseInt(stats.completed) || 0
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
                {orderStats?.shipping || 0}
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
                        {order.billNumber || order.id}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {order.containerNumber || '-'}
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
