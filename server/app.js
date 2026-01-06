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
import inquiryRoutes from './modules/inquiry/routes.js'
import shipperRoutes from './modules/shipper/routes.js'
import usersRoutes from './modules/users/routes.js'
import rolesRoutes from './modules/roles/routes.js'

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

// 账单路由（从 ERP 系统获取数据）
import { authenticate } from './middleware/auth.js'
import axios from 'axios'

const MAIN_API_URL = process.env.MAIN_API_URL || 'http://127.0.0.1:3001'
const MAIN_API_KEY = process.env.MAIN_API_KEY || 'portal_internal_key'

// 获取账单列表
app.get('/api/invoices', authenticate, async (req, res) => {
  try {
    const customerId = req.customer.customerId
    const { page = 1, pageSize = 20, status, startDate, endDate } = req.query
    
    console.log(`[账单查询] 客户ID: ${customerId}, 转发到ERP系统`)
    
    // 从 ERP 系统获取账单数据
    const response = await axios.get(`${MAIN_API_URL}/api/portal/invoices`, {
      params: { page, pageSize, status, startDate, endDate },
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': customerId
      },
      timeout: 15000
    })
    
    console.log(`[账单查询] ERP返回 ${response.data?.data?.list?.length || 0} 条账单`)
    
    res.json(response.data)
  } catch (error) {
    console.error('获取账单列表失败:', error.message)
    res.json({
      errCode: 200,
      msg: 'success',
      data: { list: [], total: 0, page: 1, pageSize: 20 }
    })
  }
})

// 获取账单详情
app.get('/api/invoices/:id', authenticate, async (req, res) => {
  try {
    const customerId = req.customer.customerId
    const { id } = req.params
    
    const response = await axios.get(`${MAIN_API_URL}/api/portal/invoices/${id}`, {
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': customerId
      },
      timeout: 15000
    })
    
    res.json(response.data)
  } catch (error) {
    console.error('获取账单详情失败:', error.message)
    if (error.response?.status === 404) {
      return res.status(404).json({ errCode: 404, msg: '账单不存在', data: null })
    }
    res.status(500).json({ errCode: 500, msg: '获取账单详情失败', data: null })
  }
})

// 下载账单 PDF
app.get('/api/invoices/:id/pdf', authenticate, async (req, res) => {
  try {
    const customerId = req.customer.customerId
    const { id } = req.params
    
    const response = await axios.get(`${MAIN_API_URL}/api/portal/invoices/${id}/pdf`, {
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': customerId
      },
      responseType: 'arraybuffer',
      timeout: 30000
    })
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`)
    res.send(Buffer.from(response.data))
  } catch (error) {
    console.error('下载账单PDF失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '下载账单失败', data: null })
  }
})

// 下载账单 Excel
app.get('/api/invoices/:id/excel', authenticate, async (req, res) => {
  try {
    const customerId = req.customer.customerId
    const { id } = req.params
    
    const response = await axios.get(`${MAIN_API_URL}/api/portal/invoices/${id}/excel`, {
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': customerId
      },
      responseType: 'arraybuffer',
      timeout: 30000
    })
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.xlsx"`)
    res.send(Buffer.from(response.data))
  } catch (error) {
    console.error('下载账单Excel失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '下载账单失败', data: null })
  }
})

// API 密钥管理模块
app.use('/api/api-keys', apiKeysRoutes)

// 询价模块（卡车类型、运输计算、清关估算、询价管理）
app.use('/api', inquiryRoutes)

// 发货人/收货人预设管理模块
app.use('/api/shippers', shipperRoutes)

// 用户管理模块
app.use('/api/users', usersRoutes)

// 角色管理模块
app.use('/api/roles', rolesRoutes)

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
    
    // 自动迁移：添加缺失的额外服务字段
    await runDatabaseMigrations()
    
    console.log('📦 客户门户数据库初始化完成')
  } catch (error) {
    console.error('数据库初始化失败:', error)
    process.exit(1)
  }
}

/**
 * 运行数据库迁移
 * 自动添加缺失的字段到 bills_of_lading 表
 */
async function runDatabaseMigrations() {
  const db = getDatabase()
  
  // 需要添加的额外服务字段
  const newColumns = [
    { name: 'cargo_type', type: 'VARCHAR(50)', comment: '箱型: 拼箱(CFS)/整箱(FCL)' },
    { name: 'transport_service', type: 'VARCHAR(50)', comment: '运输方式: 委托我司运输/自行运输' },
    { name: 'bill_type', type: 'VARCHAR(50)', comment: '提单类型: 船东单/货代单' },
    { name: 'container_return', type: 'VARCHAR(50)', comment: '异地还柜: 异地还柜/本地还柜' },
    { name: 'full_container_delivery', type: 'VARCHAR(50)', comment: '全程整柜运输: 必须整柜派送/可拆柜后托盘送货' },
    { name: 'last_mile_transport', type: 'VARCHAR(50)', comment: '末端运输方式' },
    { name: 'devan_service', type: 'VARCHAR(50)', comment: '拆柜服务: 需要拆柜分货服务/不需要拆柜' },
    { name: 't1_customs_service', type: 'VARCHAR(10)', comment: 'T1报关服务: 是/否' }
  ]
  
  for (const col of newColumns) {
    try {
      await db.exec(`ALTER TABLE bills_of_lading ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`)
    } catch (err) {
      // 字段已存在或其他错误，忽略
      if (!err.message.includes('already exists') && !err.message.includes('duplicate column')) {
        console.log(`  字段 ${col.name} 添加跳过: ${err.message}`)
      }
    }
  }
  
  console.log('✅ 数据库字段迁移检查完成')
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
    console.log('║   [用户] /api/users - 子账户管理                            ║')
    console.log('║   [角色] /api/roles - 角色权限管理                          ║')
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

