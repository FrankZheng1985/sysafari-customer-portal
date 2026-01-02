/**
 * 订单模块路由
 * 直接从数据库获取订单数据
 */

import { Router } from 'express'
import { getDatabase } from '../../config/database.js'
import { authenticate, logActivity } from '../../middleware/auth.js'

const router = Router()

/**
 * 获取订单统计 (必须放在 /:id 前面)
 * GET /api/orders/stats
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    // 获取订单统计 - 互斥状态
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN ship_status = '未到港' THEN 1 END) as not_arrived,
        COUNT(CASE WHEN ship_status = '已到港' AND (customs_status IS NULL OR customs_status = '' OR customs_status != '已放行') AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status NOT IN ('已送达')) AND status != '已完成' THEN 1 END) as arrived,
        COUNT(CASE WHEN customs_status = '已放行' AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status NOT IN ('已送达')) AND status != '已完成' THEN 1 END) as customs_cleared,
        COUNT(CASE WHEN delivery_status = '派送中' OR delivery_status = '待派送' THEN 1 END) as delivering,
        COUNT(CASE WHEN delivery_status = '已送达' OR status = '已完成' THEN 1 END) as delivered
      FROM bills_of_lading
      WHERE customer_id = $1
    `).get(customerId)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        total: parseInt(stats?.total || 0),
        notArrived: parseInt(stats?.not_arrived || 0),
        arrived: parseInt(stats?.arrived || 0),
        customsCleared: parseInt(stats?.customs_cleared || 0),
        delivering: parseInt(stats?.delivering || 0),
        delivered: parseInt(stats?.delivered || 0)
      }
    })
    
  } catch (error) {
    console.error('获取订单统计失败:', error.message)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        total: 0,
        notArrived: 0,
        arrived: 0,
        customsCleared: 0,
        delivering: 0,
        delivered: 0
      }
    })
  }
})

/**
 * 获取订单列表
 * GET /api/orders
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword, startDate, endDate } = req.query
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const conditions = [customerId]
    let paramIndex = 2
    
    let whereClause = 'WHERE customer_id = $1'
    
    if (status) {
      whereClause += ` AND status = $${paramIndex++}`
      conditions.push(status)
    }
    
    if (keyword) {
      whereClause += ` AND (order_number ILIKE $${paramIndex} OR bill_number ILIKE $${paramIndex} OR consignee ILIKE $${paramIndex})`
      conditions.push(`%${keyword}%`)
      paramIndex++
    }
    
    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex++}`
      conditions.push(startDate)
    }
    
    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex++}`
      conditions.push(endDate)
    }
    
    // 获取总数
    const countResult = await db.prepare(`
      SELECT COUNT(*) as total FROM bills_of_lading ${whereClause}
    `).get(...conditions)
    
    // 获取订单列表
    const orders = await db.prepare(`
      SELECT 
        id, order_number, bill_number, container_number,
        shipper, consignee, port_of_loading, port_of_discharge,
        place_of_delivery, transport_method, container_type,
        pieces, weight, volume, status, ship_status,
        customs_status, delivery_status,
        etd, eta, ata, external_order_no,
        customer_name, customer_code,
        created_at, updated_at
      FROM bills_of_lading
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `).all(...conditions, parseInt(pageSize), offset)
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'view_orders',
      details: { page, pageSize, status, keyword }
    })
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: orders || [],
        total: parseInt(countResult?.total || 0),
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
    
  } catch (error) {
    console.error('获取订单列表失败:', error.message)
    
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
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    // 获取订单详情，确保属于当前客户
    const order = await db.prepare(`
      SELECT 
        id, order_number, bill_number, container_number,
        shipper, consignee, port_of_loading, port_of_discharge,
        place_of_delivery, transport_method, container_type,
        pieces, weight, volume, status, ship_status,
        customs_status, delivery_status,
        etd, eta, ata, external_order_no,
        customer_name, customer_code,
        created_at, updated_at
      FROM bills_of_lading
      WHERE id = ? AND customer_id = ?
    `).get(id, customerId)
    
    if (!order) {
      return res.status(404).json({
        errCode: 404,
        msg: '订单不存在',
        data: null
      })
    }
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'view_order_detail',
      resourceType: 'order',
      resourceId: id
    })
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: order
    })
    
  } catch (error) {
    console.error('获取订单详情失败:', error.message)
    
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
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    // 获取订单基本信息
    const order = await db.prepare(`
      SELECT id, order_number, ship_status, customs_status, delivery_status,
             etd, eta, ata, port_of_loading, port_of_discharge, place_of_delivery
      FROM bills_of_lading
      WHERE id = ? AND customer_id = ?
    `).get(id, customerId)
    
    if (!order) {
      return res.status(404).json({
        errCode: 404,
        msg: '订单不存在',
        data: null
      })
    }
    
    // 构建跟踪时间线
    const timeline = []
    
    if (order.etd) {
      timeline.push({
        status: '已发运',
        location: order.port_of_loading,
        time: order.etd,
        description: `货物已从 ${order.port_of_loading} 发出`
      })
    }
    
    if (order.eta) {
      timeline.push({
        status: '预计到达',
        location: order.port_of_discharge,
        time: order.eta,
        description: `预计到达 ${order.port_of_discharge}`
      })
    }
    
    if (order.ata) {
      timeline.push({
        status: '已到港',
        location: order.port_of_discharge,
        time: order.ata,
        description: `已到达 ${order.port_of_discharge}`
      })
    }
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'view_order_tracking',
      resourceType: 'order',
      resourceId: id
    })
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        order: {
          id: order.id,
          orderNumber: order.order_number,
          shipStatus: order.ship_status,
          customsStatus: order.customs_status,
          deliveryStatus: order.delivery_status
        },
        timeline
      }
    })
    
  } catch (error) {
    console.error('获取订单跟踪失败:', error.message)
    
    res.status(500).json({
      errCode: 500,
      msg: '获取跟踪信息失败',
      data: null
    })
  }
})

export default router
