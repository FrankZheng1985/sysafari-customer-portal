import { useState, useEffect } from 'react'
import { portalApi } from '../utils/api'
import { CreditCard, TrendingUp, Clock, AlertTriangle } from 'lucide-react'

interface PayableSummary {
  totalInvoices: number
  totalAmount: number
  paidAmount: number
  balance: number
  unpaidCount: number
  partialCount: number
  overdueCount: number
  overdueAmount: number
}

interface Aging {
  current: number
  days1To30: number
  days31To60: number
  days61To90: number
  daysOver90: number
}

export default function Payables() {
  const [summary, setSummary] = useState<PayableSummary | null>(null)
  const [aging, setAging] = useState<Aging | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPayables()
  }, [])

  const fetchPayables = async () => {
    try {
      const res = await portalApi.getPayables()
      if (res.data.errCode === 200) {
        setSummary(res.data.data?.summary)
        setAging(res.data.data?.aging)
      }
    } catch (error) {
      console.error('获取应付账款失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">应付账款</h1>
        <p className="text-sm text-gray-500 mt-1">查看账款余额和账龄分析</p>
      </div>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">总金额</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                €{summary?.totalAmount?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已付款</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                €{summary?.paidAmount?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待付余额</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                €{summary?.balance?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">逾期金额</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                €{summary?.overdueAmount?.toLocaleString() || 0}
              </p>
              {summary?.overdueCount ? (
                <p className="text-xs text-red-500 mt-1">{summary.overdueCount} 笔逾期</p>
              ) : null}
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 账龄分析 */}
      <div className="card">
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">账龄分析</h2>
          <p className="text-sm text-gray-500 mt-1">按逾期天数统计待付金额</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-500">未到期</p>
              <p className="text-xl font-bold text-green-600 mt-2">
                €{aging?.current?.toLocaleString() || 0}
              </p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-500">1-30天</p>
              <p className="text-xl font-bold text-blue-600 mt-2">
                €{aging?.days1To30?.toLocaleString() || 0}
              </p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <p className="text-sm text-gray-500">31-60天</p>
              <p className="text-xl font-bold text-amber-600 mt-2">
                €{aging?.days31To60?.toLocaleString() || 0}
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-500">61-90天</p>
              <p className="text-xl font-bold text-orange-600 mt-2">
                €{aging?.days61To90?.toLocaleString() || 0}
              </p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-500">90天以上</p>
              <p className="text-xl font-bold text-red-600 mt-2">
                €{aging?.daysOver90?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 付款说明 */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">付款方式</h2>
        <div className="text-sm text-gray-600 space-y-2">
          <p>• 银行转账：请在转账时注明您的客户编号和账单号</p>
          <p>• 如有付款疑问，请联系您的业务经理或财务部门</p>
          <p>• 付款后请通知我们，以便及时更新账户状态</p>
        </div>
      </div>
    </div>
  )
}

