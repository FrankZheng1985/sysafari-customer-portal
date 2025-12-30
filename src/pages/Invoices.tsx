import { useState, useEffect } from 'react'
import { portalApi } from '../utils/api'
import { FileText, Download, Eye, ChevronLeft, ChevronRight, X, FileSpreadsheet, AlertCircle } from 'lucide-react'

interface InvoiceItem {
  feeName: string
  feeNameEn?: string
  amount: number
  quantity?: number
  unit?: string
}

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  totalAmount: number
  paidAmount: number
  balance: number
  currency: string
  status: string
  billNumber: string
  containerNumbers: string[]
  items: InvoiceItem[]
  pdfUrl: string | null
  excelUrl: string | null
  notes: string
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize] = useState(20)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    fetchInvoices()
  }, [page, statusFilter])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const res = await portalApi.getInvoices({
        page,
        pageSize,
        status: statusFilter || undefined
      })
      if (res.data.errCode === 200) {
        // 后端返回格式: { errCode, msg, data: { list, total, page, pageSize } }
        setInvoices(res.data.data?.list || [])
        setTotal(res.data.data?.total || 0)
      }
    } catch (error) {
      console.error('获取账单列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = async (invoice: Invoice) => {
    setDetailLoading(true)
    try {
      const res = await portalApi.getInvoiceById(invoice.id)
      if (res.data.errCode === 200) {
        setSelectedInvoice(res.data.data)
      }
    } catch (error) {
      console.error('获取账单详情失败:', error)
      setSelectedInvoice(invoice)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDownloadPdf = async (invoice: Invoice) => {
    if (!invoice.pdfUrl) {
      alert('PDF文件尚未生成')
      return
    }
    
    try {
      // 调用API获取签名URL
      const res = await portalApi.downloadInvoicePdf(invoice.id)
      if (res.data.errCode === 200 && res.data.data?.pdfUrl) {
        window.open(res.data.data.pdfUrl, '_blank')
      } else {
        alert(res.data.msg || 'PDF下载失败')
      }
    } catch (error) {
      console.error('下载PDF失败:', error)
      alert('下载PDF失败')
    }
  }

  const handleDownloadExcel = async (invoice: Invoice) => {
    if (!invoice.excelUrl) {
      alert('Excel文件尚未生成')
      return
    }
    
    try {
      // 调用API获取签名URL
      const res = await portalApi.downloadInvoiceExcel(invoice.id)
      if (res.data.errCode === 200 && res.data.data?.excelUrl) {
        window.open(res.data.data.excelUrl, '_blank')
      } else {
        alert(res.data.msg || 'Excel下载失败')
      }
    } catch (error) {
      console.error('下载Excel失败:', error)
      alert('下载Excel失败')
    }
  }

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      'unpaid': 'bg-red-100 text-red-700',
      'pending': 'bg-red-100 text-red-700',
      'partial': 'bg-amber-100 text-amber-700',
      'paid': 'bg-green-100 text-green-700',
      'issued': 'bg-blue-100 text-blue-700',
      'draft': 'bg-gray-100 text-gray-600',
    }
    return statusMap[status] || 'bg-gray-100 text-gray-600'
  }

  const getStatusText = (status: string) => {
    const textMap: Record<string, string> = {
      'unpaid': '未付款',
      'pending': '待付款',
      'partial': '部分付款',
      'paid': '已付款',
      'issued': '已开具',
      'draft': '草稿',
    }
    return textMap[status] || status
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-CN')
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">账单查询</h1>
        <p className="text-sm text-gray-500 mt-1">查看您的所有账单和费用明细</p>
      </div>

      {/* 筛选 */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="input w-full sm:w-40"
          >
            <option value="">全部状态</option>
            <option value="issued">已开具</option>
            <option value="unpaid">未付款</option>
            <option value="partial">部分付款</option>
            <option value="paid">已付款</option>
          </select>
        </div>
      </div>

      {/* 账单列表 */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : invoices.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>账单号</th>
                    <th>柜号/订单</th>
                    <th>账单日期</th>
                    <th>到期日</th>
                    <th className="text-right">金额</th>
                    <th className="text-right">已付</th>
                    <th className="text-right">余额</th>
                    <th>状态</th>
                    <th className="text-center">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="font-medium text-gray-900">{invoice.invoiceNumber}</td>
                      <td>
                        <div className="max-w-[150px]">
                          {invoice.containerNumbers?.length > 0 ? (
                            <div className="text-xs text-gray-600 truncate" title={invoice.containerNumbers.join(', ')}>
                              {invoice.containerNumbers.slice(0, 2).join(', ')}
                              {invoice.containerNumbers.length > 2 && `...+${invoice.containerNumbers.length - 2}`}
                            </div>
                          ) : invoice.billNumber ? (
                            <span className="text-gray-600">{invoice.billNumber}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td>{formatDate(invoice.invoiceDate)}</td>
                      <td>{formatDate(invoice.dueDate)}</td>
                      <td className="text-right font-medium">
                        {invoice.currency} {invoice.totalAmount?.toLocaleString() || '0'}
                      </td>
                      <td className="text-right text-green-600">
                        {invoice.currency} {invoice.paidAmount?.toLocaleString() || '0'}
                      </td>
                      <td className="text-right font-medium text-amber-600">
                        {invoice.currency} {invoice.balance?.toLocaleString() || '0'}
                      </td>
                      <td>
                        <div className="flex items-center justify-center">
                          <span className={`status-badge ${getStatusColor(invoice.status)}`}>
                            {getStatusText(invoice.status)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewDetail(invoice)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-primary-600"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(invoice)}
                            className={`p-1.5 hover:bg-gray-100 rounded ${
                              invoice.pdfUrl ? 'text-gray-500 hover:text-red-600' : 'text-gray-300 cursor-not-allowed'
                            }`}
                            title={invoice.pdfUrl ? '下载PDF' : 'PDF未生成'}
                            disabled={!invoice.pdfUrl}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadExcel(invoice)}
                            className={`p-1.5 hover:bg-gray-100 rounded ${
                              invoice.excelUrl ? 'text-gray-500 hover:text-green-600' : 'text-gray-300 cursor-not-allowed'
                            }`}
                            title={invoice.excelUrl ? '下载Excel' : 'Excel未生成'}
                            disabled={!invoice.excelUrl}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
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
                  <span className="px-3 py-1 text-sm">{page}</span>
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
            <FileText className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500">暂无账单数据</p>
          </div>
        )}
      </div>

      {/* 账单详情弹窗 */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">账单详情</h3>
                <p className="text-sm text-gray-500">{selectedInvoice.invoiceNumber}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 基本信息 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">账单号</label>
                      <div className="font-medium">{selectedInvoice.invoiceNumber}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">账单日期</label>
                      <div className="font-medium">{formatDate(selectedInvoice.invoiceDate)}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">到期日</label>
                      <div className="font-medium">{formatDate(selectedInvoice.dueDate)}</div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">状态</label>
                      <div>
                        <span className={`status-badge ${getStatusColor(selectedInvoice.status)}`}>
                          {getStatusText(selectedInvoice.status)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 柜号信息 */}
                  {selectedInvoice.containerNumbers?.length > 0 && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-2">关联柜号</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedInvoice.containerNumbers.map((cn, idx) => (
                          <span key={idx} className="px-2 py-1 bg-gray-100 rounded text-sm">
                            {cn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 费用明细 */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-2">费用明细</label>
                    {selectedInvoice.items?.length > 0 ? (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-4 py-2 font-medium text-gray-600">费用项目</th>
                              <th className="text-right px-4 py-2 font-medium text-gray-600">数量</th>
                              <th className="text-right px-4 py-2 font-medium text-gray-600">金额</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedInvoice.items.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2">
                                  <div>{item.feeName}</div>
                                  {item.feeNameEn && (
                                    <div className="text-xs text-gray-400">{item.feeNameEn}</div>
                                  )}
                                </td>
                                <td className="text-right px-4 py-2">
                                  {item.quantity || 1} {item.unit || ''}
                                </td>
                                <td className="text-right px-4 py-2 font-medium">
                                  {selectedInvoice.currency} {item.amount?.toLocaleString() || '0'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50">
                            <tr>
                              <td colSpan={2} className="px-4 py-2 font-medium text-right">合计</td>
                              <td className="px-4 py-2 font-bold text-right text-primary-600">
                                {selectedInvoice.currency} {selectedInvoice.totalAmount?.toLocaleString() || '0'}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400 border border-gray-200 rounded-lg">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                        <p>暂无费用明细</p>
                      </div>
                    )}
                  </div>

                  {/* 金额汇总 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <label className="text-xs text-gray-500">账单金额</label>
                        <div className="text-lg font-bold text-gray-900">
                          {selectedInvoice.currency} {selectedInvoice.totalAmount?.toLocaleString() || '0'}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">已付金额</label>
                        <div className="text-lg font-bold text-green-600">
                          {selectedInvoice.currency} {selectedInvoice.paidAmount?.toLocaleString() || '0'}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">待付金额</label>
                        <div className="text-lg font-bold text-amber-600">
                          {selectedInvoice.currency} {selectedInvoice.balance?.toLocaleString() || '0'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 备注 */}
                  {selectedInvoice.notes && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-2">备注</label>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
                        {selectedInvoice.notes}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              {selectedInvoice.pdfUrl && (
                <button
                  onClick={() => handleDownloadPdf(selectedInvoice)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                >
                  <Download className="w-4 h-4" />
                  下载PDF
                </button>
              )}
              {selectedInvoice.excelUrl && (
                <button
                  onClick={() => handleDownloadExcel(selectedInvoice)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  下载Excel
                </button>
              )}
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
