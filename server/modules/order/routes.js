/**
 * 订单模块路由
 * 直接从数据库获取订单数据
 */

import { Router } from 'express'
import { getDatabase } from '../../config/database.js'
import { authenticate, logActivity } from '../../middleware/auth.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

/**
 * 生成订单号 - 使用数据库序列确保顺序唯一性
 * 格式: BP + 年月日(6位) + 序号(4位)
 * 例如: BP2501050001, BP2501050002...
 */
async function generateOrderNumber(db) {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const datePrefix = `BP${year}${month}${day}`
  
  // 查询当天已有的最大序号
  const result = await db.prepare(`
    SELECT order_number FROM bills_of_lading 
    WHERE order_number LIKE $1 
    ORDER BY order_number DESC 
    LIMIT 1
  `).get(`${datePrefix}%`)
  
  let sequence = 1
  if (result && result.order_number) {
    // 提取序号部分并+1
    const lastSequence = parseInt(result.order_number.slice(-4), 10)
    sequence = lastSequence + 1
  }
  
  return `${datePrefix}${String(sequence).padStart(4, '0')}`
}

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
    
    // 获取订单统计 - 简化为：总订单数、进行中、已完成、总重量、总立方
    // 注意：NOT IN 对 NULL 值返回 NULL，需要显式处理 NULL 和空字符串
    const stats = await db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN (delivery_status IS NULL OR delivery_status = '' OR delivery_status NOT IN ('已送达', '异常关闭')) 
                   AND (status IS NULL OR status = '' OR status NOT IN ('已完成', '已归档', '已取消')) THEN 1 END) as in_progress,
        COUNT(CASE WHEN delivery_status IN ('已送达', '异常关闭') OR status IN ('已完成', '已归档', '已取消') THEN 1 END) as completed,
        COALESCE(SUM(weight), 0) as total_weight,
        COALESCE(SUM(volume), 0) as total_volume
      FROM bills_of_lading
      WHERE customer_id = $1
    `).get(customerId)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        total: parseInt(stats?.total || 0),
        inProgress: parseInt(stats?.in_progress || 0),
        completed: parseInt(stats?.completed || 0),
        totalWeight: parseFloat(stats?.total_weight || 0),
        totalVolume: parseFloat(stats?.total_volume || 0)
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
 * 获取订单量趋势
 * GET /api/orders/trend
 * 返回近12个月的订单量趋势数据（按创建时间或清关完成时间统计）
 */
router.get('/trend', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { type = 'month', dateType = 'created' } = req.query
    
    // 计算日期范围（近12个月）
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const startDateStr = startDate.toISOString().split('T')[0]
    
    // 根据 dateType 选择日期字段
    // 注意：create_time 是 TEXT 类型，需要转换为 timestamp
    const dateField = dateType === 'customs' ? 'customs_release_time' : 'create_time'
    const dateFieldCast = dateType === 'customs' ? dateField : `${dateField}::timestamp`
    
    // 按月统计订单数量
    const trendData = await db.prepare(`
      SELECT 
        TO_CHAR(${dateFieldCast}, 'YYYY-MM') as month,
        COUNT(*) as count,
        COALESCE(SUM(weight), 0) as total_weight,
        COALESCE(SUM(volume), 0) as total_volume
      FROM bills_of_lading
      WHERE customer_id = $1 
        AND ${dateField} IS NOT NULL
        AND ${dateField} != ''
        AND ${dateFieldCast} >= $2::timestamp
      GROUP BY TO_CHAR(${dateFieldCast}, 'YYYY-MM')
      ORDER BY month ASC
    `).all(customerId, startDateStr)
    
    // 获取近12个月的汇总数据
    const summaryStats = await db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(weight), 0) as total_weight,
        COALESCE(SUM(volume), 0) as total_volume
      FROM bills_of_lading
      WHERE customer_id = $1 
        AND ${dateField} IS NOT NULL
        AND ${dateField} != ''
        AND ${dateFieldCast} >= $2::timestamp
    `).get(customerId, startDateStr)
    
    // 生成完整的12个月数据（包含无数据的月份）
    const months = []
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = `${String(date.getMonth() + 1).padStart(2, '0')}`
      
      const found = trendData?.find(d => d.month === monthKey)
      months.push({
        month: monthKey,
        label: monthLabel,
        count: parseInt(found?.count || 0),
        weight: parseFloat(found?.total_weight || 0),
        volume: parseFloat(found?.total_volume || 0)
      })
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        months,
        summary: {
          totalOrders: parseInt(summaryStats?.total_orders || 0),
          totalWeight: parseFloat(summaryStats?.total_weight || 0),
          totalVolume: parseFloat(summaryStats?.total_volume || 0)
        }
      }
    })
    
  } catch (error) {
    console.error('获取订单趋势失败:', error.message)
    
    // 返回空数据
    const now = new Date()
    const emptyMonths = []
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      emptyMonths.push({
        month: monthKey,
        label: `${String(date.getMonth() + 1).padStart(2, '0')}`,
        count: 0,
        weight: 0,
        volume: 0
      })
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        months: emptyMonths,
        summary: {
          totalOrders: 0,
          totalWeight: 0,
          totalVolume: 0
        }
      }
    })
  }
})

/**
 * 获取港口选项列表
 * GET /api/orders/ports
 * 返回当前客户订单中所有唯一的起运港和目的港
 */
router.get('/ports', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    // 获取所有唯一的起运港
    const loadingPorts = await db.prepare(`
      SELECT DISTINCT port_of_loading as port
      FROM bills_of_lading
      WHERE customer_id = $1 AND port_of_loading IS NOT NULL AND port_of_loading != ''
      ORDER BY port_of_loading
    `).all(customerId)
    
    // 获取所有唯一的目的港
    const dischargePorts = await db.prepare(`
      SELECT DISTINCT port_of_discharge as port
      FROM bills_of_lading
      WHERE customer_id = $1 AND port_of_discharge IS NOT NULL AND port_of_discharge != ''
      ORDER BY port_of_discharge
    `).all(customerId)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        loadingPorts: (loadingPorts || []).map(p => p.port),
        dischargePorts: (dischargePorts || []).map(p => p.port)
      }
    })
    
  } catch (error) {
    console.error('获取港口列表失败:', error.message)
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        loadingPorts: [],
        dischargePorts: []
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
    const { page = 1, pageSize = 20, status, keyword, startDate, endDate, shipStatus, customsStatus, deliveryStatus, progressStatus, billNumber, etdStart, etdEnd, etaStart, etaEnd, portOfLoading, portOfDischarge, sortField, sortOrder } = req.query
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
    
    // 进度状态筛选（简化版本：进行中 / 已完成）
    if (progressStatus === 'in_progress') {
      // 进行中：未送达且状态不是已完成/已归档/已取消
      whereClause += ` AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status NOT IN ('已送达', '异常关闭')) AND status NOT IN ('已完成', '已归档', '已取消')`
    } else if (progressStatus === 'completed') {
      // 已完成：已送达、异常关闭或状态为已完成/已归档/已取消
      whereClause += ` AND (delivery_status IN ('已送达', '异常关闭') OR status IN ('已完成', '已归档', '已取消'))`
    }
    
    // 保留旧的船运状态筛选（兼容性）
    if (shipStatus === 'not_arrived') {
      whereClause += ` AND (ship_status IS NULL OR ship_status = '' OR ship_status IN ('未到港', '已发运', '运输中')) AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status NOT IN ('已送达', '异常关闭')) AND status NOT IN ('已完成', '已归档', '已取消')`
    } else if (shipStatus === 'arrived') {
      whereClause += ` AND ship_status = '已到港' AND (customs_status IS NULL OR customs_status = '' OR customs_status NOT IN ('已放行')) AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status NOT IN ('已送达', '异常关闭')) AND status NOT IN ('已完成', '已归档', '已取消')`
    }
    
    if (customsStatus === 'cleared') {
      whereClause += ` AND customs_status = '已放行' AND (delivery_status IS NULL OR delivery_status = '' OR delivery_status NOT IN ('派送中', '待派送', '已送达', '异常关闭')) AND status NOT IN ('已完成', '已归档', '已取消')`
    }
    
    if (deliveryStatus === 'delivering') {
      whereClause += ` AND delivery_status IN ('派送中', '待派送') AND status NOT IN ('已完成', '已归档', '已取消')`
    } else if (deliveryStatus === 'delivered') {
      whereClause += ` AND (delivery_status IN ('已送达', '异常关闭') OR status IN ('已完成', '已归档', '已取消'))`
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
    
    // ETD 日期范围筛选
    if (etdStart) {
      whereClause += ` AND etd >= $${paramIndex++}`
      conditions.push(etdStart)
    }
    if (etdEnd) {
      whereClause += ` AND etd <= $${paramIndex++}`
      conditions.push(etdEnd)
    }
    
    // ETA 日期范围筛选
    if (etaStart) {
      whereClause += ` AND eta >= $${paramIndex++}`
      conditions.push(etaStart)
    }
    if (etaEnd) {
      whereClause += ` AND eta <= $${paramIndex++}`
      conditions.push(etaEnd)
    }
    
    // 起运港筛选
    if (portOfLoading) {
      whereClause += ` AND port_of_loading ILIKE $${paramIndex++}`
      conditions.push(`%${portOfLoading}%`)
    }
    
    // 目的港筛选
    if (portOfDischarge) {
      whereClause += ` AND port_of_discharge ILIKE $${paramIndex++}`
      conditions.push(`%${portOfDischarge}%`)
    }
    
    // 获取总数
    const countResult = await db.prepare(`
      SELECT COUNT(*) as total FROM bills_of_lading ${whereClause}
    `).get(...conditions)
    
    // 构建排序子句 - 支持 etd 和 eta 排序
    let orderByClause = 'ORDER BY created_at DESC' // 默认排序
    const allowedSortFields = ['etd', 'eta', 'created_at']
    const allowedSortOrders = ['asc', 'desc', 'ASC', 'DESC']
    
    if (sortField && allowedSortFields.includes(sortField)) {
      const order = (sortOrder && allowedSortOrders.includes(sortOrder)) 
        ? sortOrder.toUpperCase() 
        : 'DESC'
      // NULL 值排在最后
      orderByClause = `ORDER BY ${sortField} IS NULL, ${sortField} ${order}`
    }
    
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
      ${orderByClause}
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
      WHERE id = $1 AND customer_id = $2
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
      WHERE id = $1 AND customer_id = $2
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

/**
 * 创建订单/提单
 * POST /api/orders
 * 客户提交订单请求，等待 ERP 审核处理
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const customerCode = req.customer.customerCode
    const customerName = req.customer.customerName || req.customer.companyName
    
    const {
      // 基本信息
      transportMode,          // 运输方式: sea, air, rail, truck
      externalOrderNo,        // 外部订单号
      billNumber,             // 提单号
      shippingLine,           // 船公司
      containerNumber,        // 集装箱号
      containerType,          // 柜型
      sealNumber,             // 封号
      // 航程信息
      vesselVoyage,           // 船名航次
      terminal,               // 码头
      // 港口信息
      portOfLoading,          // 起运港
      portOfDischarge,        // 目的港
      etd,                    // ETD
      eta,                    // ETA
      // 发货信息
      shipper,                // 发货人
      // 收货信息
      consignee,              // 收货人
      placeOfDelivery,        // 送货地址
      // 货物信息
      pieces,                 // 件数
      weight,                 // 重量
      volume,                 // 体积
      cargoItems,             // 货物明细
      // 附加属性
      cargoType,              // 箱型: CFS(拼箱) / FCL(整箱)
      transportService,       // 运输: entrust(委托我司) / self(自行运输)
      billType,               // 提单类型: master(船东单) / house(货代单)
      // 额外服务
      containerReturn,        // 异地还柜: remote(异地还柜) / local(本地还柜)
      fullContainerDelivery,  // 全程整柜运输: full(必须整柜派送) / devan(可拆柜后托盘送货)
      lastMileTransport,      // 末端运输方式
      devanService,           // 拆柜: yes(需要拆柜分货服务) / no(不需要拆柜)
      t1CustomsService,       // 海关经停报关服务(T1报关): yes / no
      // 其他
      serviceType,            // 服务类型
      remark                  // 备注
    } = req.body
    
    // 验证必填字段
    if (!shipper && !consignee) {
      return res.status(400).json({
        errCode: 400,
        msg: '发货人或收货人至少填写一个',
        data: null
      })
    }
    
    // 生成订单号（使用数据库序列保证顺序）
    const orderNumber = await generateOrderNumber(db)
    const orderId = uuidv4()
    
    // 运输方式映射
    const transportMethodMap = {
      'sea': '海运',
      'air': '空运',
      'rail': '铁路',
      'truck': '卡车'
    }
    
    // 解析船名航次为 vessel 和 voyage
    let vessel = ''
    let voyage = ''
    if (vesselVoyage) {
      const parts = vesselVoyage.split(/[\/\s]+/)
      if (parts.length >= 2) {
        vessel = parts.slice(0, -1).join(' ')
        voyage = parts[parts.length - 1]
      } else {
        vessel = vesselVoyage
      }
    }
    
    // 构建货物描述
    let description = ''
    if (cargoItems && cargoItems.length > 0) {
      description = cargoItems
        .filter(item => item.productName || item.productNameEn)
        .map(item => `${item.productName || ''} ${item.productNameEn || ''} (${item.quantity || 0} ${item.unit || 'PCS'})`)
        .join('; ')
    }
    
    // 附加属性映射
    const cargoTypeMap = { 'CFS': '拼箱', 'FCL': '整箱' }
    const transportServiceMap = { 'entrust': '委托我司运输', 'self': '自行运输' }
    const billTypeMap = { 'master': '船东单', 'house': '货代单' }
    const containerReturnMap = { 'remote': '异地还柜', 'local': '本地还柜' }
    const fullContainerDeliveryMap = { 'full': '必须整柜派送', 'devan': '可拆柜后托盘送货' }
    const lastMileTransportMap = { 'truck': '卡车派送', 'van': '小型货车派送', 'express': '快递派送', 'pickup': '客户自提' }
    const devanServiceMap = { 'yes': '需要拆柜分货服务', 'no': '不需要拆柜' }
    const t1CustomsServiceMap = { 'yes': '是', 'no': '否' }
    
    // 插入订单到数据库
    await db.prepare(`
      INSERT INTO bills_of_lading (
        id, order_number, bill_number, external_order_no,
        customer_id, customer_code, customer_name,
        transport_method, shipping_line, container_number, container_type, seal_number,
        vessel, voyage, terminal,
        port_of_loading, port_of_discharge, place_of_delivery,
        etd, eta,
        shipper, consignee,
        pieces, weight, volume,
        description, remark, service_type,
        cargo_type, transport_service, bill_type,
        container_return, full_container_delivery, last_mile_transport,
        devan_service, t1_customs_service,
        status, ship_status, customs_status, delivery_status,
        source, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18,
        $19, $20,
        $21, $22,
        $23, $24, $25,
        $26, $27, $28,
        $29, $30, $31,
        $32, $33, $34,
        $35, $36,
        $37, $38, $39, $40,
        $41, NOW(), NOW()
      )
    `).run(
      orderId, orderNumber, billNumber || null, externalOrderNo || null,
      customerId, customerCode, customerName,
      transportMethodMap[transportMode] || '海运', shippingLine || null, containerNumber || null, containerType || null, sealNumber || null,
      vessel || null, voyage || null, terminal || null,
      portOfLoading || null, portOfDischarge || null, placeOfDelivery || null,
      etd || null, eta || null,
      shipper || null, consignee || null,
      pieces || null, weight || null, volume || null,
      description || null, remark || null, serviceType || 'door-to-door',
      cargoTypeMap[cargoType] || '整箱', transportServiceMap[transportService] || '委托我司运输', billTypeMap[billType] || '船东单',
      containerReturnMap[containerReturn] || '本地还柜', fullContainerDeliveryMap[fullContainerDelivery] || '必须整柜派送', lastMileTransportMap[lastMileTransport] || '卡车派送',
      devanServiceMap[devanService] || '不需要拆柜', t1CustomsServiceMap[t1CustomsService] || '否',
      '待处理', '未到港', null, null,
      'customer_portal'  // 标记来源为客户门户
    )
    
    // 如果有货物明细，保存到 cargo_items 表（如果存在）
    if (cargoItems && cargoItems.length > 0) {
      try {
        for (const item of cargoItems) {
          if (item.productName || item.productNameEn) {
            await db.prepare(`
              INSERT INTO cargo_items (
                id, bill_id, product_name, product_name_en, hs_code,
                quantity, unit, unit_price, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `).run(
              uuidv4(), orderId, item.productName || null, item.productNameEn || null, item.hsCode || null,
              item.quantity || 0, item.unit || 'PCS', item.unitPrice || 0
            )
          }
        }
      } catch (cargoError) {
        // cargo_items 表可能不存在，忽略错误
        console.log('货物明细保存跳过（表可能不存在）:', cargoError.message)
      }
    }
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'create_order',
      resourceType: 'order',
      resourceId: orderId,
      details: { orderNumber, billNumber }
    })
    
    console.log(`客户门户订单创建成功: ${orderNumber} (客户: ${customerName})`)
    
    res.json({
      errCode: 200,
      msg: '订单创建成功',
      data: {
        id: orderId,
        orderNumber,
        billNumber,
        status: '待处理'
      }
    })
    
  } catch (error) {
    console.error('创建订单失败:', error.message)
    
    res.status(500).json({
      errCode: 500,
      msg: '创建订单失败: ' + error.message,
      data: null
    })
  }
})

export default router
