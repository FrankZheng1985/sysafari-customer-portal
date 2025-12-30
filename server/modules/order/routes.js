/**
 * 订单模块路由
 * 从主系统 API 获取订单数据
 */

import { Router } from 'express'
import axios from 'axios'
import { getDatabase } from '../../config/database.js'
import { authenticate, logActivity } from '../../middleware/auth.js'

const router = Router()

// 主系统 API 配置
const MAIN_API_URL = process.env.MAIN_API_URL || 'http://127.0.0.1:3001'
const MAIN_API_KEY = process.env.MAIN_API_KEY || ''

/**
 * 获取订单列表
 * GET /api/orders
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword, startDate, endDate } = req.query
    
    // 从主系统获取数据
    const response = await axios.get(`${MAIN_API_URL}/api/portal/orders`, {
      params: {
        customerId: req.customer.customerId,
        page,
        pageSize,
        status,
        keyword,
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
      action: 'view_orders',
      details: { page, pageSize, status, keyword }
    })
    
    res.json(response.data)
    
  } catch (error) {
    console.error('获取订单列表失败:', error.message)
    
    // 如果主系统不可用，尝试从缓存获取
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
      msg: '获取订单失败',
      data: null
    })
  }
})

/**
 * 获取订单详情
 * GET /api/orders/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    
    // 从主系统获取数据
    const response = await axios.get(`${MAIN_API_URL}/api/portal/orders/${id}`, {
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': req.customer.customerId
      },
      timeout: 10000
    })
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'view_order_detail',
      resourceType: 'order',
      resourceId: id
    })
    
    res.json(response.data)
    
  } catch (error) {
    console.error('获取订单详情失败:', error.message)
    
    if (error.response?.status === 404) {
      return res.status(404).json({
        errCode: 404,
        msg: '订单不存在',
        data: null
      })
    }
    
    if (error.response?.status === 403) {
      return res.status(403).json({
        errCode: 403,
        msg: '无权访问此订单',
        data: null
      })
    }
    
    res.status(500).json({
      errCode: 500,
      msg: '获取订单详情失败',
      data: null
    })
  }
})

/**
 * 获取订单跟踪信息
 * GET /api/orders/:id/tracking
 */
router.get('/:id/tracking', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    
    // 从主系统获取数据
    const response = await axios.get(`${MAIN_API_URL}/api/portal/orders/${id}/tracking`, {
      headers: {
        'X-API-Key': MAIN_API_KEY,
        'X-Portal-Customer': req.customer.customerId
      },
      timeout: 10000
    })
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'view_order_tracking',
      resourceType: 'order',
      resourceId: id
    })
    
    res.json(response.data)
    
  } catch (error) {
    console.error('获取订单跟踪失败:', error.message)
    
    res.status(500).json({
      errCode: 500,
      msg: '获取跟踪信息失败',
      data: null
    })
  }
})

/**
 * 获取订单统计
 * GET /api/orders/stats/summary
 */
router.get('/stats/summary', authenticate, async (req, res) => {
  try {
    // 从主系统获取数据
    const response = await axios.get(`${MAIN_API_URL}/api/portal/orders/stats`, {
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
    console.error('获取订单统计失败:', error.message)
    
    // 返回默认统计数据
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        total: 0,
        inTransit: 0,
        delivered: 0,
        pending: 0
      }
    })
  }
})

export default router

