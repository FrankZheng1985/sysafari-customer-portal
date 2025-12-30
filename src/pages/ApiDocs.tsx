import { useState } from 'react'
import { Book, Code, Terminal, Copy, CheckCircle } from 'lucide-react'

const API_BASE_URL = 'https://api.sysafari.com/open-api'

export default function ApiDocs() {
  const [activeTab, setActiveTab] = useState('quickstart')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const tabs = [
    { id: 'quickstart', label: '快速开始', icon: Book },
    { id: 'orders', label: '订单接口', icon: Code },
    { id: 'invoices', label: '账单接口', icon: Code },
    { id: 'examples', label: '示例代码', icon: Terminal },
  ]

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API 对接文档</h1>
        <p className="text-sm text-gray-500 mt-1">将您的 ERP/WMS 系统与 Sysafari 物流系统对接</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 侧边导航 */}
        <div className="lg:col-span-1">
          <div className="card p-4">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* 文档内容 */}
        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'quickstart' && (
            <>
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">认证方式</h2>
                <p className="text-gray-600 mb-4">
                  所有 API 请求需要在 Header 中携带认证信息：
                </p>
                <div className="bg-gray-900 rounded-lg p-4 relative">
                  <button
                    onClick={() => copyCode('X-API-Key: YOUR_API_KEY\nX-API-Secret: YOUR_API_SECRET\nContent-Type: application/json', 'auth')}
                    className="absolute top-3 right-3 p-1.5 hover:bg-gray-700 rounded"
                  >
                    {copiedCode === 'auth' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`X-API-Key: YOUR_API_KEY
X-API-Secret: YOUR_API_SECRET
Content-Type: application/json`}
                  </pre>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">API 基础 URL</h2>
                <code className="text-sm bg-gray-100 px-3 py-2 rounded block">
                  {API_BASE_URL}
                </code>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">响应格式</h2>
                <p className="text-gray-600 mb-4">
                  所有接口返回统一的 JSON 格式：
                </p>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "errCode": 200,      // 状态码：200 成功，其他为错误
  "errMsg": "success", // 状态消息
  "data": { ... }      // 返回数据
}`}
                  </pre>
                </div>
              </div>
            </>
          )}

          {activeTab === 'orders' && (
            <>
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">创建订单</h2>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">POST</span>
                  <code className="text-sm text-gray-600">/orders</code>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">请求示例</h3>
                <div className="bg-gray-900 rounded-lg p-4 relative">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "orders": [
    {
      "externalOrderNo": "ERP-2024-001",
      "billNumber": "COSU1234567890",
      "containerNumber": "CSLU1234567",
      "shipper": "发货人名称",
      "consignee": "收货人名称",
      "portOfLoading": "CNSHA",
      "portOfDischarge": "DEHAM",
      "etd": "2024-12-25",
      "eta": "2025-01-15",
      "cargoItems": [
        {
          "productName": "户外折叠椅",
          "productNameEn": "Outdoor Folding Chair",
          "quantity": 500,
          "unit": "PCS",
          "unitPrice": 12.50
        }
      ]
    }
  ],
  "callback_url": "https://your-system.com/webhook"
}`}
                  </pre>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">查询订单状态</h2>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">GET</span>
                  <code className="text-sm text-gray-600">/orders/status</code>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">查询参数</h3>
                <div className="overflow-x-auto">
                  <table className="data-table text-sm">
                    <thead>
                      <tr>
                        <th>参数</th>
                        <th>类型</th>
                        <th>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>updated_after</code></td>
                        <td>string</td>
                        <td>查询此时间之后更新的订单（ISO 8601格式）</td>
                      </tr>
                      <tr>
                        <td><code>order_ids</code></td>
                        <td>string</td>
                        <td>订单ID或外部订单号，多个用逗号分隔</td>
                      </tr>
                      <tr>
                        <td><code>page</code></td>
                        <td>number</td>
                        <td>页码，默认 1</td>
                      </tr>
                      <tr>
                        <td><code>pageSize</code></td>
                        <td>number</td>
                        <td>每页数量，默认 50</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">获取物流跟踪</h2>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">GET</span>
                  <code className="text-sm text-gray-600">/orders/tracking/:id</code>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">响应示例</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "errCode": 200,
  "data": {
    "orderId": "BP250001",
    "externalOrderNo": "ERP-2024-001",
    "currentStatus": "派送中",
    "timeline": [
      {
        "time": "2024-12-25T10:00:00Z",
        "status": "已接单",
        "description": "订单已创建"
      },
      {
        "time": "2024-12-26T15:30:00Z",
        "status": "已发运",
        "description": "货物已从上海港出发",
        "location": "上海港"
      }
    ]
  }
}`}
                  </pre>
                </div>
              </div>
            </>
          )}

          {activeTab === 'invoices' && (
            <>
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">查询账单列表</h2>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">GET</span>
                  <code className="text-sm text-gray-600">/invoices</code>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">查询账户余额</h2>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">GET</span>
                  <code className="text-sm text-gray-600">/balance</code>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">响应示例</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "errCode": 200,
  "data": {
    "totalAmount": 50000.00,
    "paidAmount": 35000.00,
    "balance": 15000.00,
    "unpaidCount": 5,
    "overdueAmount": 2000.00,
    "currency": "EUR"
  }
}`}
                  </pre>
                </div>
              </div>
            </>
          )}

          {activeTab === 'examples' && (
            <>
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Python 示例</h2>
                <div className="bg-gray-900 rounded-lg p-4 relative">
                  <button
                    onClick={() => copyCode(`import requests

class SysafariAPI:
    def __init__(self, api_key, api_secret):
        self.base_url = "${API_BASE_URL}"
        self.headers = {
            "X-API-Key": api_key,
            "X-API-Secret": api_secret,
            "Content-Type": "application/json"
        }
    
    def create_orders(self, orders):
        response = requests.post(
            f"{self.base_url}/orders",
            headers=self.headers,
            json={"orders": orders}
        )
        return response.json()
    
    def get_order_status(self, updated_after=None):
        params = {}
        if updated_after:
            params["updated_after"] = updated_after
        response = requests.get(
            f"{self.base_url}/orders/status",
            headers=self.headers,
            params=params
        )
        return response.json()

# 使用示例
api = SysafariAPI("your_api_key", "your_api_secret")
result = api.get_order_status()
print(result)`, 'python')}
                    className="absolute top-3 right-3 p-1.5 hover:bg-gray-700 rounded"
                  >
                    {copiedCode === 'python' ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`import requests

class SysafariAPI:
    def __init__(self, api_key, api_secret):
        self.base_url = "${API_BASE_URL}"
        self.headers = {
            "X-API-Key": api_key,
            "X-API-Secret": api_secret,
            "Content-Type": "application/json"
        }
    
    def create_orders(self, orders):
        response = requests.post(
            f"{self.base_url}/orders",
            headers=self.headers,
            json={"orders": orders}
        )
        return response.json()

# 使用示例
api = SysafariAPI("your_api_key", "your_api_secret")
result = api.get_order_status()
print(result)`}
                  </pre>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">cURL 示例</h2>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`curl -X GET "${API_BASE_URL}/orders/status" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-API-Secret: YOUR_API_SECRET" \\
  -H "Content-Type: application/json"`}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

