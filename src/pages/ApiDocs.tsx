import { useState } from 'react'
import { Book, Code, Terminal, Copy, CheckCircle } from 'lucide-react'

const API_BASE_URL = 'https://erp.xianfeng-eu.com/open-api'

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
        <h1 className="text-page-title">API 对接文档</h1>
        <p className="text-small mt-1">将您的 ERP/WMS 系统与 Sysafari 物流系统对接</p>
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
                <p className="text-sm text-gray-500 mb-4">批量创建订单，单次最多 100 个</p>
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
                <h3 className="text-sm font-medium text-gray-700 mt-4 mb-2">响应示例</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "errCode": 200,
  "errMsg": "创建完成：成功 1 个，失败 0 个",
  "data": {
    "total": 1,
    "success": 1,
    "failed": 0,
    "results": [
      {
        "success": true,
        "orderId": "BP250001",
        "externalOrderNo": "ERP-2024-001"
      }
    ]
  }
}`}
                  </pre>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">获取订单详情</h2>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">GET</span>
                  <code className="text-sm text-gray-600">/orders/:id</code>
                </div>
                <p className="text-sm text-gray-500 mb-4">支持订单ID或外部订单号查询</p>
                <h3 className="text-sm font-medium text-gray-700 mb-2">响应示例</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "errCode": 200,
  "errMsg": "success",
  "data": {
    "id": "BP250001",
    "externalOrderNo": "ERP-2024-001",
    "billNumber": "COSU1234567890",
    "containerNumber": "CSLU1234567",
    "status": "运输中",
    "shipStatus": "已到港",
    "customsStatus": "清关中",
    "shipper": "发货人名称",
    "consignee": "收货人名称",
    "etd": "2024-12-25",
    "eta": "2025-01-15",
    "ata": "2025-01-14"
  }
}`}
                  </pre>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">更新订单</h2>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">PUT</span>
                  <code className="text-sm text-gray-600">/orders/:id</code>
                </div>
                <p className="text-sm text-gray-500 mb-4">更新订单信息，需要 order:update 权限</p>
                <h3 className="text-sm font-medium text-gray-700 mb-2">请求示例</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "consignee": "新收货人名称",
  "placeOfDelivery": "Berlin, Germany",
  "remark": "请在工作日送货"
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
                <p className="text-sm text-gray-500 mb-4">批量查询订单状态变更</p>
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
                <p className="text-sm text-gray-500 mb-4">获取订单物流跟踪时间线</p>
                <h3 className="text-sm font-medium text-gray-700 mb-2">响应示例</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "errCode": 200,
  "errMsg": "success",
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
      },
      {
        "time": "2025-01-14T08:00:00Z",
        "status": "已到港",
        "description": "货物已到达汉堡港",
        "location": "汉堡港"
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
                <h3 className="text-sm font-medium text-gray-700 mb-2">查询参数</h3>
                <div className="overflow-x-auto mb-4">
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
                        <td><code>status</code></td>
                        <td>string</td>
                        <td>账单状态：unpaid（未付）、partial（部分付）、paid（已付）</td>
                      </tr>
                      <tr>
                        <td><code>start_date</code></td>
                        <td>string</td>
                        <td>开始日期（YYYY-MM-DD）</td>
                      </tr>
                      <tr>
                        <td><code>end_date</code></td>
                        <td>string</td>
                        <td>结束日期（YYYY-MM-DD）</td>
                      </tr>
                      <tr>
                        <td><code>page</code></td>
                        <td>number</td>
                        <td>页码，默认 1</td>
                      </tr>
                      <tr>
                        <td><code>pageSize</code></td>
                        <td>number</td>
                        <td>每页数量，默认 20</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">响应示例</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "errCode": 200,
  "errMsg": "success",
  "data": {
    "invoices": [
      {
        "id": "INV-2024-001",
        "invoiceNumber": "XF2024120001",
        "invoiceDate": "2024-12-01",
        "dueDate": "2024-12-31",
        "totalAmount": 5000.00,
        "paidAmount": 0,
        "currency": "EUR",
        "status": "unpaid",
        "billNumber": "COSU1234567890"
      }
    ],
    "total": 15,
    "page": 1,
    "pageSize": 20
  }
}`}
                  </pre>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">查询账户余额</h2>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">GET</span>
                  <code className="text-sm text-gray-600">/balance</code>
                </div>
                <p className="text-sm text-gray-500 mb-4">获取客户账户的应付款汇总</p>
                <h3 className="text-sm font-medium text-gray-700 mb-2">响应示例</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "errCode": 200,
  "errMsg": "success",
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

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Webhook 通知</h2>
                <p className="text-gray-600 mb-4">
                  当订单状态发生变化时，系统会向您配置的 Webhook URL 发送通知。
                </p>
                <h3 className="text-sm font-medium text-gray-700 mb-2">事件类型</h3>
                <div className="overflow-x-auto mb-4">
                  <table className="data-table text-sm">
                    <thead>
                      <tr>
                        <th>事件</th>
                        <th>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>order.status_changed</code></td>
                        <td>订单状态变更</td>
                      </tr>
                      <tr>
                        <td><code>order.shipped</code></td>
                        <td>货物已发运</td>
                      </tr>
                      <tr>
                        <td><code>order.arrived</code></td>
                        <td>货物已到港</td>
                      </tr>
                      <tr>
                        <td><code>order.customs_cleared</code></td>
                        <td>清关完成</td>
                      </tr>
                      <tr>
                        <td><code>order.delivered</code></td>
                        <td>已送达</td>
                      </tr>
                      <tr>
                        <td><code>invoice.created</code></td>
                        <td>账单已创建</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Webhook 请求示例</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`// 请求头
X-Webhook-Signature: sha256=xxx...

// 请求体
{
  "event": "order.status_changed",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "orderId": "BP250001",
    "externalOrderNo": "ERP-2024-001",
    "oldStatus": "运输中",
    "newStatus": "已到港",
    "changedAt": "2025-01-15T10:30:00Z"
  }
}`}
                  </pre>
                </div>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>验证签名：</strong>使用您的 API Secret 对请求体进行 HMAC-SHA256 签名验证，确保请求来源合法。
                  </p>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">测试 Webhook</h2>
                <div className="flex items-center space-x-2 mb-4">
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">POST</span>
                  <code className="text-sm text-gray-600">/webhook/test</code>
                </div>
                <p className="text-sm text-gray-500 mb-4">测试 Webhook 连通性，需要 webhook:manage 权限</p>
                <h3 className="text-sm font-medium text-gray-700 mb-2">响应示例</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`{
  "errCode": 200,
  "errMsg": "Webhook 测试成功",
  "data": {
    "url": "https://your-system.com/webhook",
    "status": 200,
    "message": "Webhook 连接正常"
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
import hmac
import hashlib
import json

class SysafariAPI:
    def __init__(self, api_key, api_secret):
        self.base_url = "${API_BASE_URL}"
        self.api_secret = api_secret
        self.headers = {
            "X-API-Key": api_key,
            "X-API-Secret": api_secret,
            "Content-Type": "application/json"
        }
    
    def create_orders(self, orders, callback_url=None):
        """批量创建订单"""
        data = {"orders": orders}
        if callback_url:
            data["callback_url"] = callback_url
        response = requests.post(
            f"{self.base_url}/orders",
            headers=self.headers,
            json=data
        )
        return response.json()
    
    def get_order(self, order_id):
        """获取订单详情"""
        response = requests.get(
            f"{self.base_url}/orders/{order_id}",
            headers=self.headers
        )
        return response.json()
    
    def get_order_status(self, updated_after=None, order_ids=None):
        """批量查询订单状态"""
        params = {}
        if updated_after:
            params["updated_after"] = updated_after
        if order_ids:
            params["order_ids"] = ",".join(order_ids)
        response = requests.get(
            f"{self.base_url}/orders/status",
            headers=self.headers,
            params=params
        )
        return response.json()
    
    def get_tracking(self, order_id):
        """获取物流跟踪"""
        response = requests.get(
            f"{self.base_url}/orders/tracking/{order_id}",
            headers=self.headers
        )
        return response.json()
    
    def get_balance(self):
        """获取账户余额"""
        response = requests.get(
            f"{self.base_url}/balance",
            headers=self.headers
        )
        return response.json()
    
    def verify_webhook(self, payload, signature):
        """验证 Webhook 签名"""
        expected = "sha256=" + hmac.new(
            self.api_secret.encode(),
            json.dumps(payload).encode(),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

# 使用示例
api = SysafariAPI("your_api_key", "your_api_secret")

# 创建订单
orders = [{
    "externalOrderNo": "ERP-2024-001",
    "billNumber": "COSU1234567890",
    "shipper": "发货人",
    "consignee": "收货人"
}]
result = api.create_orders(orders)
print("创建订单:", result)

# 查询订单状态
result = api.get_order_status()
print("订单状态:", result)`, 'python')}
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
    
    def create_orders(self, orders, callback_url=None):
        """批量创建订单"""
        data = {"orders": orders}
        if callback_url:
            data["callback_url"] = callback_url
        response = requests.post(
            f"{self.base_url}/orders",
            headers=self.headers,
            json=data
        )
        return response.json()
    
    def get_order(self, order_id):
        """获取订单详情"""
        response = requests.get(
            f"{self.base_url}/orders/{order_id}",
            headers=self.headers
        )
        return response.json()
    
    def get_order_status(self, updated_after=None):
        """批量查询订单状态"""
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
print(result)`}
                  </pre>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">cURL 示例</h2>
                <h3 className="text-sm font-medium text-gray-700 mb-2">查询订单状态</h3>
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`curl -X GET "${API_BASE_URL}/orders/status" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-API-Secret: YOUR_API_SECRET" \\
  -H "Content-Type: application/json"`}
                  </pre>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">创建订单</h3>
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`curl -X POST "${API_BASE_URL}/orders" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-API-Secret: YOUR_API_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "orders": [{
      "externalOrderNo": "ERP-2024-001",
      "billNumber": "COSU1234567890",
      "shipper": "发货人名称",
      "consignee": "收货人名称"
    }]
  }'`}
                  </pre>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">获取物流跟踪</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 overflow-x-auto">
{`curl -X GET "${API_BASE_URL}/orders/tracking/BP250001" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "X-API-Secret: YOUR_API_SECRET" \\
  -H "Content-Type: application/json"`}
                  </pre>
                </div>
              </div>

              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">错误码说明</h2>
                <div className="overflow-x-auto">
                  <table className="data-table text-sm">
                    <thead>
                      <tr>
                        <th>错误码</th>
                        <th>说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><code>200</code></td>
                        <td>请求成功</td>
                      </tr>
                      <tr>
                        <td><code>400001</code></td>
                        <td>请求参数错误</td>
                      </tr>
                      <tr>
                        <td><code>400002</code></td>
                        <td>数据验证失败</td>
                      </tr>
                      <tr>
                        <td><code>401001</code></td>
                        <td>缺少 API Key 或 API Secret</td>
                      </tr>
                      <tr>
                        <td><code>401002</code></td>
                        <td>API Key 无效或已过期</td>
                      </tr>
                      <tr>
                        <td><code>403001</code></td>
                        <td>IP 地址不在白名单</td>
                      </tr>
                      <tr>
                        <td><code>403002</code></td>
                        <td>无权限执行此操作</td>
                      </tr>
                      <tr>
                        <td><code>404001</code></td>
                        <td>资源不存在</td>
                      </tr>
                      <tr>
                        <td><code>500000</code></td>
                        <td>服务器内部错误</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

