/**
 * Sysafari 客户门户系统 - 后端入口
 * 
 * 功能模块：
 * - auth/       客户认证（登录、注册）
 * - order/      订单查询
 * - finance/    账单查询
 * - api-keys/   API 密钥管理
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// 配置
import { getDatabase, closeDatabase, testConnection } from './config/database.js'

// 中间件
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.js'

// 业务模块路由
import authRoutes from './modules/auth/routes.js'
import orderRoutes from './modules/order/routes.js'
import financeRoutes from './modules/finance/routes.js'
import apiKeysRoutes from './modules/api-keys/routes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '.env') })

// 创建 Express 应用
const app = express()

// 信任代理（Nginx 反向代理）
app.set('trust proxy', 1)

// ==================== 中间件配置 ====================

// 安全响应头
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

// CORS 配置
app.use(cors({
  origin: [
    // 本地开发
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    // 阿里云生产环境
    'https://portal.xianfeng-eu.com',
    'https://customer.xianfeng-eu.com',
    // ERP 主系统（内部调用）
    'https://erp.xianfeng-eu.com',
    'https://api.xianfeng-eu.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}))

// JSON 解析
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 请求日志
app.use(morgan('combined'))

// API 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100, // 每个 IP 最多 100 次请求
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    errCode: 429,
    msg: '请求过于频繁，请稍后再试',
    data: null
  }
})
app.use('/api', limiter)

// 登录接口更严格的速率限制
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 5, // 每个 IP 最多 5 次登录尝试
  message: {
    errCode: 429,
    msg: '登录尝试过多，请 15 分钟后再试',
    data: null
  }
})
app.use('/api/auth/login', loginLimiter)

// ==================== API 路由 ====================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    errCode: 200,
    msg: 'OK',
    data: {
      status: 'healthy',
      service: 'customer-portal',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  })
})

// 客户认证模块
app.use('/api/auth', authRoutes)

// 订单查询模块
app.use('/api/orders', orderRoutes)

// 账单/财务模块
app.use('/api/finance', financeRoutes)
app.use('/api/payables', financeRoutes)  // 前端兼容 /api/payables

// 账单路由别名（/api/invoices -> /api/finance/invoices）
import { authenticate, logActivity } from './middleware/auth.js'

app.get('/api/invoices', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { page = 1, pageSize = 20, status } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    
    let whereClause = 'WHERE customer_id = $1'
    const conditions = [customerId]
    let paramIndex = 2
    
    if (status) {
      whereClause += ` AND payment_status = $${paramIndex++}`
      conditions.push(status)
    }
    
    // 获取总数
    const countResult = await db.prepare(`
      SELECT COUNT(*) as total FROM invoices ${whereClause}
    `).get(...conditions)
    
    // 获取账单列表
    const invoicesRaw = await db.prepare(`
      SELECT 
        id, invoice_number, invoice_date, due_date,
        total_amount, paid_amount, currency, payment_status,
        bill_number, container_numbers, notes,
        created_at, updated_at
      FROM invoices
      ${whereClause}
      ORDER BY invoice_date DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `).all(...conditions, parseInt(pageSize), offset)
    
    // 转换字段名为驼峰格式
    const invoices = (invoicesRaw || []).map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date,
      totalAmount: parseFloat(inv.total_amount || 0),
      paidAmount: parseFloat(inv.paid_amount || 0),
      balance: parseFloat(inv.total_amount || 0) - parseFloat(inv.paid_amount || 0),
      currency: inv.currency || 'EUR',
      status: inv.payment_status || 'unpaid',
      billNumber: inv.bill_number,
      containerNumbers: inv.container_numbers ? JSON.parse(inv.container_numbers) : [],
      notes: inv.notes,
      pdfUrl: null,
      excelUrl: null
    }))
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: invoices,
        total: parseInt(countResult?.total || 0),
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取账单列表失败:', error.message)
    res.json({
      errCode: 200,
      msg: 'success',
      data: { list: [], total: 0, page: 1, pageSize: 20 }
    })
  }
})

app.get('/api/invoices/:id', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { id } = req.params
    
    const invoice = await db.prepare(`
      SELECT * FROM invoices WHERE id = $1 AND customer_id = $2
    `).get(id, customerId)
    
    if (!invoice) {
      return res.status(404).json({ errCode: 404, msg: '账单不存在', data: null })
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        totalAmount: parseFloat(invoice.total_amount || 0),
        paidAmount: parseFloat(invoice.paid_amount || 0),
        balance: parseFloat(invoice.total_amount || 0) - parseFloat(invoice.paid_amount || 0),
        currency: invoice.currency || 'EUR',
        status: invoice.payment_status || 'unpaid',
        billNumber: invoice.bill_number,
        containerNumbers: invoice.container_numbers ? JSON.parse(invoice.container_numbers) : [],
        items: invoice.items ? JSON.parse(invoice.items) : [],
        notes: invoice.notes,
        pdfUrl: null,
        excelUrl: null
      }
    })
  } catch (error) {
    console.error('获取账单详情失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '获取账单详情失败', data: null })
  }
})

// API 密钥管理模块
app.use('/api/api-keys', apiKeysRoutes)

// ==================== 错误处理 ====================

// 404 处理
app.use(notFoundHandler)

// 全局错误处理
app.use(globalErrorHandler)

// ==================== 服务器启动 ====================

const PORT = process.env.PORT || 3003

/**
 * 初始化数据库
 */
async function initializeDatabase() {
  try {
    // 测试数据库连接
    const connected = await testConnection()
    if (!connected) {
      console.error('❌ 数据库连接失败，服务启动中止')
      process.exit(1)
    }
    
    console.log('📦 客户门户数据库初始化完成')
  } catch (error) {
    console.error('数据库初始化失败:', error)
    process.exit(1)
  }
}

/**
 * 启动服务器
 */
async function startServer() {
  // 初始化数据库
  await initializeDatabase()
  
  // 启动 HTTP 服务
  const server = app.listen(PORT, () => {
    console.log('')
    console.log('╔════════════════════════════════════════════════════════════╗')
    console.log('║                                                            ║')
    console.log('║   🌐 Sysafari 客户门户系统 v1.0                            ║')
    console.log('║                                                            ║')
    console.log(`║   📡 服务地址: http://localhost:${PORT}                       ║`)
    console.log('║   📦 数据库: PostgreSQL (portal_db)                        ║')
    console.log('║                                                            ║')
    console.log('║   📁 已加载模块:                                            ║')
    console.log('║   [认证] /api/auth - 登录、注册、修改密码                   ║')
    console.log('║   [订单] /api/orders - 订单查询、跟踪                       ║')
    console.log('║   [财务] /api/finance - 账单查询、应付款                    ║')
    console.log('║   [密钥] /api/api-keys - API 密钥管理                       ║')
    console.log('║                                                            ║')
    console.log('╚════════════════════════════════════════════════════════════╝')
    console.log('')
  })
  
  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n⏹️  正在关闭服务器...')
    server.close(() => {
      closeDatabase()
      console.log('✅ 客户门户服务器已安全关闭')
      process.exit(0)
    })
  })
  
  process.on('SIGTERM', () => {
    console.log('\n⏹️  收到终止信号...')
    server.close(() => {
      closeDatabase()
      process.exit(0)
    })
  })
}

// 启动服务
startServer()

export { app, startServer }

