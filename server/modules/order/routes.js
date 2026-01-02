/**
 * 订单模块路由
 * 直接从数据库获取订单数据
 */

import { Router } from 'express'
import { getDatabase } from '../../config/database.js'
import { authenticate, logActivity } from '../../middleware/auth.js'

const router = Router()

/**
 * 生成订单进度步骤
 * @param {Object} order - 订单数据
 * @returns {Array} 进度步骤数组
 */
function generateProgressSteps(order) {
  const steps = [
    {
      key: 'accepted',
      label: '已接单',
      completed: true,
      time: order.created_at
    },
    {
      key: 'shipped',
      label: '已发运',
      completed: !!order.etd,
      time: order.etd || null
    },
    {
      key: 'arrived',
      label: '已到港',
      completed: order.ship_status === '已到港' || !!order.ata,
      time: order.ata || null
    },
    {
      key: 'doc_swap',
      label: '已换单',
      completed: order.doc_swap_status === '已换单',
      time: order.doc_swap_time || null
    },
    {
      key: 'customs',
      label: '已放行',
      completed: order.customs_status === '已放行',
      time: order.customs_release_time || null
    },
    {
      key: 'delivered',
      label: '已送达',
      completed: order.delivery_status === '已送达' || order.status === '已完成',
      time: order.delivery_status === '已送达' ? order.updated_at : null
    }
  ]
  
  return steps
}

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
    const { page = 1, pageSize = 20, status, keyword, startDate, endDate, shipStatus, customsStatus, deliveryStatus, billNumber } = req.query
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
    
    // 船运状态筛选
    if (shipStatus === 'not_arrived') {
      whereClause += ` AND ship_status = '未到港'`
    } else if (shipStatus === 'arrived') {
      whereClause += ` AND ship_status = '已到港' AND (customs_status IS NULL OR customs_status = '' OR customs_status != '已放行') AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status NOT IN ('已送达')) AND status != '已完成'`
    }
    
    // 清关状态筛选
    if (customsStatus === 'cleared') {
      whereClause += ` AND customs_status = '已放行' AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status NOT IN ('已送达')) AND status != '已完成'`
    }
    
    // 派送状态筛选
    if (deliveryStatus === 'delivering') {
      whereClause += ` AND (delivery_status = '派送中' OR delivery_status = '待派送')`
    } else if (deliveryStatus === 'delivered') {
      whereClause += ` AND (delivery_status = '已送达' OR status = '已完成')`
    }
    
    // 提单号搜索
    if (billNumber) {
      whereClause += ` AND (bill_number ILIKE $${paramIndex} OR container_number ILIKE $${paramIndex})`
      conditions.push(`%${billNumber}%`)
      paramIndex++
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
    const ordersRaw = await db.prepare(`
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
    
    // 转换字段名为驼峰格式
    const orders = (ordersRaw || []).map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      billNumber: order.bill_number,
      containerNumber: order.container_number,
      shipper: order.shipper,
      consignee: order.consignee,
      portOfLoading: order.port_of_loading,
      portOfDischarge: order.port_of_discharge,
      placeOfDelivery: order.place_of_delivery,
      transportMethod: order.transport_method,
      containerType: order.container_type,
      pieces: order.pieces,
      weight: order.weight,
      volume: order.volume,
      status: order.status,
      rawStatus: order.status,
      shipStatus: order.ship_status,
      customsStatus: order.customs_status,
      deliveryStatus: order.delivery_status,
      etd: order.etd,
      eta: order.eta,
      ata: order.ata,
      externalOrderNo: order.external_order_no,
      customerName: order.customer_name,
      customerCode: order.customer_code,
      createdAt: order.created_at,
      updatedAt: order.updated_at
    }))
    
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
        list: orders,
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
        shipper, consignee, notify_party, port_of_loading, port_of_discharge,
        place_of_delivery, transport_method, container_type,
        pieces, weight, volume, status, ship_status,
        customs_status, delivery_status, doc_swap_status,
        etd, eta, ata, external_order_no,
        customer_name, customer_code,
        vessel, voyage, description, remark,
        doc_swap_time, customs_release_time,
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
    
    // 生成进度步骤
    const progressSteps = generateProgressSteps(order)
    
    // 转换为驼峰格式
    const orderData = {
      id: order.id,
      orderNumber: order.order_number,
      billNumber: order.bill_number,
      containerNumber: order.container_number,
      externalOrderNo: order.external_order_no,
      shipper: order.shipper,
      consignee: order.consignee,
      notifyParty: order.notify_party,
      portOfLoading: order.port_of_loading,
      portOfDischarge: order.port_of_discharge,
      placeOfDelivery: order.place_of_delivery,
      transportMethod: order.transport_method,
      containerType: order.container_type,
      status: order.status,
      rawStatus: order.status,
      shipStatus: order.ship_status,
      customsStatus: order.customs_status,
      deliveryStatus: order.delivery_status,
      docSwapStatus: order.doc_swap_status,
      docSwapTime: order.doc_swap_time,
      customsReleaseTime: order.customs_release_time,
      vessel: order.vessel,
      voyage: order.voyage,
      etd: order.etd,
      eta: order.eta,
      ata: order.ata,
      pieces: order.pieces,
      weight: order.weight,
      volume: order.volume,
      description: order.description,
      remark: order.remark,
      customerName: order.customer_name,
      customerCode: order.customer_code,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      progressSteps
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
      data: orderData
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
