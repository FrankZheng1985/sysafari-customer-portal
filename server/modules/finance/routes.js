/**
 * 财务模块路由
 * 从主系统 API 获取账单数据
 */

import { Router } from 'express'
import axios from 'axios'
import { authenticate, logActivity } from '../../middleware/auth.js'

const router = Router()

// 主系统 API 配置
const MAIN_API_URL = process.env.MAIN_API_URL || 'http://127.0.0.1:3001'
const MAIN_API_KEY = process.env.MAIN_API_KEY || 'portal_internal_key'

/**
 * 获取应付款汇总（根路由，兼容 /api/payables）
 * GET /api/payables 或 /api/finance
 * 从 ERP 主系统获取数据
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const customerId = req.customer.customerId
    console.log(`[应付款查询] 客户ID: ${customerId}, 转发到ERP系统`)
    
    // 从主系统获取应付款汇总
    const response = await axios.get(`${MAIN_API_URL}/api/portal/payables`, {
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': customerId,
        'Authorization': req.headers.authorization
      },
      timeout: 15000
    })
    
    console.log(`[应付款查询] ERP返回: ${JSON.stringify(response.data?.data?.summary || {})}`)
    
    // 转换数据格式，兼容前端显示
    const erpData = response.data?.data || {}
    const summary = erpData.summary || {}
    const aging = erpData.aging || {}
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        // 汇总信息
        summary: {
          totalAmount: parseFloat(summary.totalAmount || 0),
          paidAmount: parseFloat(summary.paidAmount || 0),
          balance: parseFloat(summary.balance || 0),
          overdueAmount: parseFloat(summary.overdueAmount || 0),
          unpaidCount: parseInt(summary.unpaidCount || 0),
          overdueCount: parseInt(summary.overdueCount || 0)
        },
        // 账龄分析
        aging: {
          current: parseFloat(aging.current || 0),
          days1To30: parseFloat(aging.days1To30 || 0),
          days31To60: parseFloat(aging.days31To60 || 0),
          days61To90: parseFloat(aging.days61To90 || 0),
          daysOver90: parseFloat(aging.daysOver90 || 0)
        },
        // 兼容旧格式
        totalPayable: parseFloat(summary.balance || 0),
        overdue: parseFloat(summary.overdueAmount || 0),
        dueIn7Days: 0,
        dueIn30Days: parseFloat(aging.current || 0),
        currency: 'EUR'
      }
    })
    
  } catch (error) {
    console.error('获取应付款汇总失败:', error.message)
    
    // 返回默认数据
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        summary: {
          totalAmount: 0,
          paidAmount: 0,
          balance: 0,
          overdueAmount: 0,
          unpaidCount: 0,
          overdueCount: 0
        },
        aging: {
          current: 0,
          days1To30: 0,
          days31To60: 0,
          days61To90: 0,
          daysOver90: 0
        },
        totalPayable: 0,
        overdue: 0,
        dueIn7Days: 0,
        dueIn30Days: 0,
        currency: 'EUR'
      }
    })
  }
})

/**
 * 获取账单列表
 * GET /api/finance/invoices
 */
router.get('/invoices', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, startDate, endDate } = req.query
    
    // 从主系统获取数据
    const response = await axios.get(`${MAIN_API_URL}/api/portal/invoices`, {
      params: {
        customerId: req.customer.customerId,
        page,
        pageSize,
        status,
        startDate,
        endDate
      },
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': req.customer.customerId
      },
      timeout: 10000
    })
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'view_invoices',
      details: { page, pageSize, status }
    })
    
    res.json(response.data)
    
  } catch (error) {
    console.error('获取账单列表失败:', error.message)
    
    // 如果主系统不可用
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return res.json({
        errCode: 200,
        msg: '数据正在同步中',
        data: {
          list: [],
          total: 0,
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        }
      })
    }
    
    res.status(500).json({
      errCode: 500,
      msg: '获取账单失败',
      data: null
    })
  }
})

/**
 * 获取账单详情
 * GET /api/finance/invoices/:id
 */
router.get('/invoices/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    
    // 从主系统获取数据
    const response = await axios.get(`${MAIN_API_URL}/api/portal/invoices/${id}`, {
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': req.customer.customerId
      },
      timeout: 10000
    })
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'view_invoice_detail',
      resourceType: 'invoice',
      resourceId: id
    })
    
    res.json(response.data)
    
  } catch (error) {
    console.error('获取账单详情失败:', error.message)
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        errCode: 404,
        msg: '账单不存在',
        data: null
      })
    }
    
    if (error.response?.status === 403) {
      return res.status(403).json({
        errCode: 403,
        msg: '无权访问此账单',
        data: null
      })
    }
    
    res.status(500).json({
      errCode: 500,
      msg: '获取账单详情失败',
      data: null
    })
  }
})

/**
 * 下载账单 PDF
 * GET /api/finance/invoices/:id/download
 */
router.get('/invoices/:id/download', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    
    // 从主系统获取 PDF
    const response = await axios.get(`${MAIN_API_URL}/api/portal/invoices/${id}/pdf`, {
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': req.customer.customerId
      },
      responseType: 'arraybuffer',
      timeout: 30000
    })
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'download_invoice',
      resourceType: 'invoice',
      resourceId: id
    })
    
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id}.pdf"`)
    res.send(Buffer.from(response.data))
    
  } catch (error) {
    console.error('下载账单失败:', error.message)
    
    res.status(500).json({
      errCode: 500,
      msg: '下载账单失败',
      data: null
    })
  }
})

/**
 * 获取应付款汇总
 * GET /api/finance/payables/summary
 */
router.get('/payables/summary', authenticate, async (req, res) => {
  try {
    // 从主系统获取数据
    const response = await axios.get(`${MAIN_API_URL}/api/portal/payables/summary`, {
      params: {
        customerId: req.customer.customerId
      },
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': req.customer.customerId
      },
      timeout: 10000
    })
    
    res.json(response.data)
    
  } catch (error) {
    console.error('获取应付款汇总失败:', error.message)
    
    // 返回默认数据
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        totalPayable: 0,
        overdue: 0,
        dueIn7Days: 0,
        dueIn30Days: 0,
        currency: 'EUR'
      }
    })
  }
})

/**
 * 获取财务统计
 * GET /api/finance/stats
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { year, month } = req.query
    
    // 从主系统获取数据
    const response = await axios.get(`${MAIN_API_URL}/api/portal/finance/stats`, {
      params: {
        customerId: req.customer.customerId,
        year,
        month
      },
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': req.customer.customerId
      },
      timeout: 10000
    })
    
    res.json(response.data)
    
  } catch (error) {
    console.error('获取财务统计失败:', error.message)
    
    // 返回默认数据
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
        invoiceCount: 0
      }
    })
  }
})

export default router

