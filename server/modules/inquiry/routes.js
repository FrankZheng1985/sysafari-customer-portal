/**
 * 询价模块路由
 * 处理客户询价、运输计算、清关估算、地址管理等
 */

import { Router } from 'express'
import axios from 'axios'
import multer from 'multer'
import xlsx from 'xlsx'
import { getDatabase, generateId } from '../../config/database.js'
import { authenticate, logActivity } from '../../middleware/auth.js'

const router = Router()

// 配置文件上传
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB 限制
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ]
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件格式，请上传 Excel 或 CSV 文件'))
    }
  }
})

// 主系统 API 配置
const MAIN_API_URL = process.env.MAIN_API_URL || 'http://localhost:3001'
const MAIN_API_KEY = process.env.MAIN_API_KEY || ''

// ==================== 基础数据代理（从主系统获取） ====================

/**
 * 获取起运港列表
 * GET /api/base-data/ports-of-loading
 */
router.get('/base-data/ports-of-loading', async (req, res) => {
  try {
    const { country, search } = req.query
    const mainRes = await axios.get(`${MAIN_API_URL}/api/portal/base-data/ports-of-loading`, {
      params: { country, search },
      headers: { 'x-api-key': MAIN_API_KEY },
      timeout: 10000
    })
    res.json(mainRes.data)
  } catch (error) {
    console.error('获取起运港列表失败:', error.message)
    res.json({ errCode: 200, msg: 'success', data: [] })
  }
})

/**
 * 获取目的港列表
 * GET /api/base-data/destination-ports
 */
router.get('/base-data/destination-ports', async (req, res) => {
  try {
    const { country, search } = req.query
    const mainRes = await axios.get(`${MAIN_API_URL}/api/portal/base-data/destination-ports`, {
      params: { country, search },
      headers: { 'x-api-key': MAIN_API_KEY },
      timeout: 10000
    })
    res.json(mainRes.data)
  } catch (error) {
    console.error('获取目的港列表失败:', error.message)
    res.json({ errCode: 200, msg: 'success', data: [] })
  }
})

/**
 * 获取机场列表
 * GET /api/base-data/air-ports
 */
router.get('/base-data/air-ports', async (req, res) => {
  try {
    const { country, search } = req.query
    const mainRes = await axios.get(`${MAIN_API_URL}/api/portal/base-data/air-ports`, {
      params: { country, search },
      headers: { 'x-api-key': MAIN_API_KEY },
      timeout: 10000
    })
    res.json(mainRes.data)
  } catch (error) {
    console.error('获取机场列表失败:', error.message)
    res.json({ errCode: 200, msg: 'success', data: [] })
  }
})

/**
 * 获取国家列表
 * GET /api/base-data/countries
 */
router.get('/base-data/countries', async (req, res) => {
  try {
    const { region, search } = req.query
    const mainRes = await axios.get(`${MAIN_API_URL}/api/portal/base-data/countries`, {
      params: { region, search },
      headers: { 'x-api-key': MAIN_API_KEY },
      timeout: 10000
    })
    res.json(mainRes.data)
  } catch (error) {
    console.error('获取国家列表失败:', error.message)
    res.json({ errCode: 200, msg: 'success', data: [] })
  }
})

/**
 * 获取城市列表
 * GET /api/base-data/cities
 */
router.get('/base-data/cities', async (req, res) => {
  try {
    const { countryCode, search, level } = req.query
    const mainRes = await axios.get(`${MAIN_API_URL}/api/portal/base-data/cities`, {
      params: { countryCode, search, level },
      headers: { 'x-api-key': MAIN_API_KEY },
      timeout: 10000
    })
    res.json(mainRes.data)
  } catch (error) {
    console.error('获取城市列表失败:', error.message)
    res.json({ errCode: 200, msg: 'success', data: [] })
  }
})

/**
 * 获取常用位置列表（汇总港口/城市）
 * GET /api/base-data/locations
 */
router.get('/base-data/locations', async (req, res) => {
  try {
    const { type, search } = req.query
    const mainRes = await axios.get(`${MAIN_API_URL}/api/portal/base-data/locations`, {
      params: { type, search },
      headers: { 'x-api-key': MAIN_API_KEY },
      timeout: 10000
    })
    res.json(mainRes.data)
  } catch (error) {
    console.error('获取常用位置列表失败:', error.message)
    res.json({ errCode: 200, msg: 'success', data: [] })
  }
})

// ==================== 关税/税率查询代理（从主系统获取） ====================

/**
 * 搜索 HS 编码税率
 * GET /api/tariff-rates/search
 */
router.get('/tariff-rates/search', async (req, res) => {
  try {
    const { hsCode, origin, limit } = req.query
    console.log(`[税率搜索] 请求参数: hsCode=${hsCode}, origin=${origin}, limit=${limit}`)
    console.log(`[税率搜索] 调用主系统: ${MAIN_API_URL}/api/portal/tariff-rates/search`)
    
    const mainRes = await axios.get(`${MAIN_API_URL}/api/portal/tariff-rates/search`, {
      params: { hsCode, origin, limit },
      headers: { 'x-api-key': MAIN_API_KEY },
      timeout: 10000
    })
    
    // 调试：打印返回的数据
    const resultCount = mainRes.data?.data?.length || 0
    console.log(`[税率搜索] 主系统返回 ${resultCount} 条记录`)
    if (mainRes.data?.data && mainRes.data.data.length > 0) {
      mainRes.data.data.forEach((rate, idx) => {
        console.log(`[税率搜索] 结果${idx + 1}: hsCode=${rate.hsCode}, hsCode10=${rate.hsCode10}, dutyRate=${rate.dutyRate}%`)
      })
    }
    
    res.json(mainRes.data)
  } catch (error) {
    console.error('搜索HS编码税率失败:', error.message)
    if (error.response) {
      console.error('主系统响应:', error.response.status, error.response.data)
    }
    res.json({ errCode: 200, msg: 'success', data: [] })
  }
})

/**
 * 精确查询 HS 编码税率
 * GET /api/tariff-rates/query
 */
router.get('/tariff-rates/query', async (req, res) => {
  try {
    const { hsCode, origin } = req.query
    const mainRes = await axios.get(`${MAIN_API_URL}/api/portal/tariff-rates/query`, {
      params: { hsCode, origin },
      headers: { 'x-api-key': MAIN_API_KEY },
      timeout: 10000
    })
    res.json(mainRes.data)
  } catch (error) {
    console.error('查询HS编码税率失败:', error.message)
    res.json({ errCode: 200, msg: 'success', data: [] })
  }
})

/**
 * 获取国家增值税率
 * GET /api/vat-rates/:countryCode
 */
router.get('/vat-rates/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params
    const mainRes = await axios.get(`${MAIN_API_URL}/api/portal/vat-rates/${countryCode}`, {
      headers: { 'x-api-key': MAIN_API_KEY },
      timeout: 10000
    })
    res.json(mainRes.data)
  } catch (error) {
    console.error('获取国家增值税率失败:', error.message)
    // 返回默认增值税率
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        countryCode: req.params.countryCode,
        countryName: '默认',
        standardRate: 19,
        reducedRate: 7,
        isDefault: true
      }
    })
  }
})

/**
 * 获取实时汇率（基于欧元）
 * GET /api/exchange-rates
 */
router.get('/exchange-rates', async (req, res) => {
  try {
    const mainRes = await axios.get(`${MAIN_API_URL}/api/portal/exchange-rates`, {
      headers: { 'x-api-key': MAIN_API_KEY },
      timeout: 10000
    })
    res.json(mainRes.data)
  } catch (error) {
    console.error('获取汇率失败:', error.message)
    // 返回备用汇率
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        base: 'EUR',
        rates: {
          EUR: 1,
          USD: 0.92,
          CNY: 0.13,
          GBP: 1.17,
          JPY: 0.006
        },
        timestamp: Date.now(),
        source: 'fallback',
        warning: '使用备用汇率'
      }
    })
  }
})

// ==================== 地址管理 ====================

/**
 * 获取客户历史地址
 * GET /api/addresses
 */
router.get('/addresses', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    const addresses = await db.prepare(`
      SELECT 
        id, label, address, city, country, postal_code,
        latitude, longitude, use_count, status,
        created_at, updated_at
      FROM customer_addresses
      WHERE customer_id = $1 AND status = 'approved'
      ORDER BY use_count DESC, updated_at DESC
      LIMIT 50
    `).all(customerId)
    
    const result = (addresses || []).map(addr => ({
      id: addr.id,
      label: addr.label,
      address: addr.address,
      city: addr.city,
      country: addr.country,
      postalCode: addr.postal_code,
      latitude: addr.latitude,
      longitude: addr.longitude,
      useCount: addr.use_count
    }))
    
    res.json({ errCode: 200, msg: 'success', data: result })
  } catch (error) {
    console.error('获取客户地址失败:', error.message)
    res.json({ errCode: 200, msg: 'success', data: [] })
  }
})

/**
 * 获取系统 Logo（从主系统获取）
 * GET /api/system/logo
 * 公开接口，无需认证
 */
router.get('/system/logo', async (req, res) => {
  try {
    const mainApiRes = await axios.get(`${MAIN_API_URL}/api/system-settings`, {
      params: { key: 'systemLogo' },
      timeout: 5000
    })
    
    if (mainApiRes.data.errCode === 200 && mainApiRes.data.data?.systemLogo) {
      res.json({ 
        errCode: 200, 
        msg: 'success', 
        data: { logoUrl: mainApiRes.data.data.systemLogo }
      })
    } else {
      res.json({ errCode: 200, msg: 'success', data: { logoUrl: null } })
    }
  } catch (error) {
    console.error('获取系统 Logo 失败:', error.message)
    res.json({ errCode: 200, msg: 'success', data: { logoUrl: null } })
  }
})

/**
 * 搜索地址（通过主系统 HERE API）
 * GET /api/addresses/search
 */
router.get('/addresses/search', authenticate, async (req, res) => {
  try {
    const { query, limit = 5 } = req.query
    
    if (!query || query.length < 3) {
      return res.json({ errCode: 200, msg: 'success', data: [] })
    }
    
    let results = []
    
    // 调用主系统的地址自动补全 API（使用 HERE API）
    try {
      const mainApiRes = await axios.get(`${MAIN_API_URL}/api/portal/addresses/autosuggest`, {
        params: { query, limit },
        headers: {
          'x-api-key': MAIN_API_KEY
        },
        timeout: 5000
      })
      
      if (mainApiRes.data.errCode === 200 && mainApiRes.data.data) {
        results = (mainApiRes.data.data || []).map(item => ({
          title: item.title || item.address,
          address: item.address,
          city: item.city,
          country: item.country,
          postalCode: item.postalCode,
          latitude: item.lat,
          longitude: item.lng
        }))
      }
    } catch (apiError) {
      console.error('主系统地址自动补全 API 调用失败:', apiError.message)
    }
    
    res.json({ errCode: 200, msg: 'success', data: results })
  } catch (error) {
    console.error('地址搜索失败:', error.message)
    res.json({ errCode: 200, msg: 'success', data: [] })
  }
})

/**
 * 保存新地址（需审核）
 * POST /api/addresses
 */
router.post('/addresses', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const customerName = req.customer.companyName || req.customer.email
    
    const { address, label, city, country, postalCode, latitude, longitude } = req.body
    
    if (!address) {
      return res.status(400).json({ errCode: 400, msg: '地址不能为空', data: null })
    }
    
    // 检查是否已存在相同地址
    const existing = await db.prepare(`
      SELECT id FROM customer_addresses 
      WHERE customer_id = $1 AND address = $2
    `).get(customerId, address)
    
    if (existing) {
      // 更新使用次数
      await db.prepare(`
        UPDATE customer_addresses 
        SET use_count = use_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `).run(existing.id)
      
      return res.json({
        errCode: 200,
        msg: '地址已存在',
        data: { id: existing.id, isNew: false }
      })
    }
    
    // 创建新地址（状态为待审核）
    const id = generateId('ADDR')
    
    await db.prepare(`
      INSERT INTO customer_addresses (
        id, customer_id, customer_name, label, address, city, country, 
        postal_code, latitude, longitude, status, use_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `).run(
      id, customerId, customerName,
      label || address,
      address, city || null, country || null,
      postalCode || null, latitude || null, longitude || null,
      'pending', // 待审核状态
      1
    )
    
    // 创建审核任务（通知跟单员和操作经理）
    const taskId = generateId('TASK')
    const taskTitle = `新地址审核: ${customerName}`
    const taskContent = `客户 ${customerName} 添加了新地址，请审核：\n${address}`
    
    await db.prepare(`
      INSERT INTO address_review_tasks (
        id, address_id, customer_id, customer_name,
        task_type, status, address_content, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `).run(
      taskId, id, customerId, customerName,
      'address_review', 'pending', address, null
    )
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'add_address',
      resourceType: 'address',
      resourceId: id,
      details: { address, status: 'pending' }
    })
    
    res.json({
      errCode: 200,
      msg: '地址已提交审核',
      data: { id, isNew: true, status: 'pending' }
    })
  } catch (error) {
    console.error('保存地址失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '保存地址失败', data: null })
  }
})

/**
 * 获取卡车类型列表
 * GET /api/truck-types
 */
router.get('/truck-types', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    
    const truckTypes = await db.prepare(`
      SELECT 
        id, code, name, name_en, category, description,
        max_weight, max_volume, length, width, height,
        base_rate_per_km, min_charge, status
      FROM truck_types
      WHERE status = 'active'
      ORDER BY max_weight ASC
    `).all()
    
    const result = (truckTypes || []).map(t => ({
      id: t.id,
      code: t.code,
      name: t.name,
      nameEn: t.name_en,
      category: t.category,
      description: t.description,
      maxWeight: parseFloat(t.max_weight || 0),
      maxVolume: t.max_volume ? parseFloat(t.max_volume) : null,
      length: parseFloat(t.length || 0),
      width: parseFloat(t.width || 0),
      height: parseFloat(t.height || 0),
      baseRatePerKm: parseFloat(t.base_rate_per_km || 0),
      minCharge: parseFloat(t.min_charge || 0)
    }))
    
    res.json({ errCode: 200, msg: 'success', data: result })
  } catch (error) {
    console.error('获取卡车类型失败:', error.message)
    // 返回默认卡车类型 - 与ERP系统保持一致
    res.json({
      errCode: 200,
      msg: 'success',
      data: [
        // 厢式配送车 (Distribution Vehicles)
        { id: 1, code: 'sprinter', name: 'Sprinter', nameEn: 'Mercedes Sprinter (3.5t)', category: 'distribution', description: '载重: 1.2t | 容积: 14m³', maxWeight: 1200, maxVolume: 14, baseRatePerKm: 1.0, minCharge: 80 },
        { id: 2, code: 'small_van', name: '小型厢式车', nameEn: 'Small Van (7.5t)', category: 'distribution', description: '载重: 3t | 容积: 20m³', maxWeight: 3000, maxVolume: 20, baseRatePerKm: 1.2, minCharge: 100 },
        { id: 3, code: 'medium_van', name: '中型厢式车', nameEn: 'Medium Van (12t)', category: 'distribution', description: '载重: 6t | 容积: 40m³', maxWeight: 6000, maxVolume: 40, baseRatePerKm: 1.5, minCharge: 150 },
        { id: 4, code: 'large_van', name: '大型厢式车', nameEn: 'Large Van (18t)', category: 'distribution', description: '载重: 10t | 容积: 55m³', maxWeight: 10000, maxVolume: 55, baseRatePerKm: 1.8, minCharge: 200 },
        // 半挂车/公路运输 (Semi-trailers)
        { id: 5, code: 'curtainsider', name: '篷布半挂车', nameEn: 'Curtainsider (Tautliner)', category: 'semi_trailer', description: '载重: 24t | 容积: 86m³', maxWeight: 24000, maxVolume: 86, baseRatePerKm: 2.0, minCharge: 300 },
        { id: 6, code: 'semi_40', name: '40尺标准半挂', nameEn: 'Standard Semi (40ft)', category: 'semi_trailer', description: '载重: 25t | 容积: 76m³', maxWeight: 25000, maxVolume: 76, baseRatePerKm: 2.2, minCharge: 320 },
        { id: 7, code: 'mega_trailer', name: 'Mega半挂车', nameEn: 'Mega Trailer (45ft)', category: 'semi_trailer', description: '载重: 24t | 容积: 100m³', maxWeight: 24000, maxVolume: 100, baseRatePerKm: 2.4, minCharge: 350 },
        { id: 8, code: 'double_deck', name: '双层半挂车', nameEn: 'Double Deck Trailer', category: 'semi_trailer', description: '载重: 22t | 容积: 120m³', maxWeight: 22000, maxVolume: 120, baseRatePerKm: 2.5, minCharge: 380 },
        // 特种车辆 (Special Vehicles)
        { id: 9, code: 'reefer_small', name: '冷藏车(小)', nameEn: 'Reefer Van (7.5t)', category: 'special', description: '载重: 2.5t | 温控: -25°C~+25°C', maxWeight: 2500, maxVolume: 20, baseRatePerKm: 1.8, minCharge: 150 },
        { id: 10, code: 'reefer_large', name: '冷藏半挂', nameEn: 'Reefer Semi-trailer', category: 'special', description: '载重: 22t | 温控: -25°C~+25°C', maxWeight: 22000, maxVolume: 80, baseRatePerKm: 2.8, minCharge: 400 },
        { id: 11, code: 'flatbed', name: '平板车', nameEn: 'Flatbed Trailer', category: 'special', description: '载重: 28t | 长度: 13.6m', maxWeight: 28000, maxVolume: 0, baseRatePerKm: 2.3, minCharge: 350 },
        { id: 12, code: 'lowloader', name: '低板车', nameEn: 'Low Loader', category: 'special', description: '载重: 40t | 适合超高货物', maxWeight: 40000, maxVolume: 0, baseRatePerKm: 3.5, minCharge: 500 },
        { id: 13, code: 'hazmat', name: 'ADR危险品车', nameEn: 'ADR Hazmat Truck', category: 'special', description: '载重: 22t | ADR认证', maxWeight: 22000, maxVolume: 75, baseRatePerKm: 3.0, minCharge: 450 },
        { id: 14, code: 'tanker', name: '罐车', nameEn: 'Tanker Truck', category: 'special', description: '容量: 30,000L | 液体运输', maxWeight: 25000, maxVolume: 30, baseRatePerKm: 3.2, minCharge: 480 }
      ]
    })
  }
})

/**
 * 推荐卡车类型
 * GET /api/truck-types/recommend
 * 根据货物重量和体积推荐合适的卡车类型
 */
router.get('/truck-types/recommend', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const { weight, volume } = req.query
    
    const cargoWeight = parseFloat(weight) || 0
    const cargoVolume = parseFloat(volume) || 0
    
    if (cargoWeight <= 0 && cargoVolume <= 0) {
      return res.status(400).json({ 
        errCode: 400, 
        msg: '请提供货物重量或体积', 
        data: null 
      })
    }
    
    // 查询满足条件的最小卡车类型
    const truckType = await db.prepare(`
      SELECT 
        id, code, name, name_en, category, description,
        max_weight, max_volume, length, width, height,
        base_rate_per_km, min_charge
      FROM truck_types
      WHERE status = 'active'
        AND (max_weight >= $1 OR $1 = 0)
        AND (max_volume >= $2 OR $2 = 0)
      ORDER BY max_weight ASC
      LIMIT 1
    `).get(cargoWeight, cargoVolume)
    
    if (!truckType) {
      // 如果没找到，返回最大的卡车类型
      const largestTruck = await db.prepare(`
        SELECT 
          id, code, name, name_en, category, description,
          max_weight, max_volume, length, width, height,
          base_rate_per_km, min_charge
        FROM truck_types
        WHERE status = 'active'
        ORDER BY max_weight DESC
        LIMIT 1
      `).get()
      
      if (largestTruck) {
        return res.json({
          errCode: 200,
          msg: '货物超出最大卡车载量，推荐最大车型',
          data: {
            id: largestTruck.id,
            code: largestTruck.code,
            name: largestTruck.name,
            nameEn: largestTruck.name_en,
            category: largestTruck.category,
            maxWeight: parseFloat(largestTruck.max_weight || 0),
            maxVolume: largestTruck.max_volume ? parseFloat(largestTruck.max_volume) : null,
            baseRatePerKm: parseFloat(largestTruck.base_rate_per_km || 0),
            minCharge: parseFloat(largestTruck.min_charge || 0),
            warning: '货物可能需要分批运输'
          }
        })
      }
      
      return res.status(404).json({ errCode: 404, msg: '暂无可用卡车类型', data: null })
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: truckType.id,
        code: truckType.code,
        name: truckType.name,
        nameEn: truckType.name_en,
        category: truckType.category,
        maxWeight: parseFloat(truckType.max_weight || 0),
        maxVolume: truckType.max_volume ? parseFloat(truckType.max_volume) : null,
        baseRatePerKm: parseFloat(truckType.base_rate_per_km || 0),
        minCharge: parseFloat(truckType.min_charge || 0)
      }
    })
  } catch (error) {
    console.error('推荐卡车类型失败:', error.message)
    // 返回默认推荐
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: 2,
        code: 'TRUCK_7T',
        name: '7.5吨卡车',
        nameEn: '7.5T Truck',
        category: 'medium',
        maxWeight: 7500,
        maxVolume: 35,
        baseRatePerKm: 1.5,
        minCharge: 150
      }
    })
  }
})

/**
 * 运输计算
 * POST /api/transport/calculate
 * 调用主系统的 HERE Routing API 获取真实路线距离
 */
router.post('/transport/calculate', authenticate, async (req, res) => {
  try {
    const { origin, destination, waypoints, truckTypeCode, goods } = req.body
    
    if (!origin?.address || !destination?.address) {
      return res.status(400).json({ errCode: 400, msg: '缺少起点或终点地址', data: null })
    }
    
    console.log('[运输计算] 请求参数:', { origin, destination, waypoints, truckTypeCode, goods })
    
    // 调用主系统的路线计算 API（使用 HERE Routing API）
    let routeData = null
    let useEstimate = false
    
    try {
      // 获取当前用户的客户ID（用于主系统认证）
      const customerId = req.user?.customerId || req.body.customerId || 'portal-guest'
      
      const mainApiRes = await axios.post(`${MAIN_API_URL}/api/portal/transport/calculate`, {
        origin: { address: origin.address || origin },  // 确保是对象格式
        destination: { address: destination.address || destination },  // 确保是对象格式
        waypoints: (waypoints || []).map(wp => ({ address: wp.address || wp })).filter(w => w.address),
        truckTypeCode: truckTypeCode || 'SEMI_40',
        goods: goods || {}
      }, {
        headers: {
          'x-api-key': MAIN_API_KEY,
          'x-portal-customer': customerId,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15秒超时
      })
      
      console.log('[运输计算] 主系统响应:', mainApiRes.data)
      
      if (mainApiRes.data.errCode === 200 && mainApiRes.data.data) {
        routeData = mainApiRes.data.data
      } else {
        console.warn('[运输计算] 主系统返回错误:', mainApiRes.data.msg)
        useEstimate = true
      }
    } catch (apiError) {
      console.error('[运输计算] 主系统 API 调用失败:', apiError.message)
      if (apiError.response) {
        console.error('[运输计算] 响应状态:', apiError.response.status)
        console.error('[运输计算] 响应数据:', apiError.response.data)
      }
      useEstimate = true
    }
    
    // 如果主系统 API 调用失败，使用本地估算（带警告）
    if (useEstimate || !routeData) {
      console.warn('[运输计算] 使用本地估算，无法获取真实路线')
      
      // 本地估算逻辑（作为后备方案）
      // 注意：这只是估算，不够准确
      const estimatedDistance = 800 + Math.random() * 800 // 800-1600 km
      const estimatedDuration = estimatedDistance / 70 // 按平均 70 km/h 计算
      
      // 获取卡车类型费率
      const db = getDatabase()
      let truckType = null
      if (truckTypeCode) {
        truckType = await db.prepare(`
          SELECT code, name, base_rate_per_km, min_charge 
          FROM truck_types 
          WHERE code = $1 AND status = 'active'
        `).get(truckTypeCode)
      }
      
      const baseRate = truckType?.base_rate_per_km || 1.5
      const minCharge = truckType?.min_charge || 150
      
      const baseCost = Math.max(estimatedDistance * baseRate, minCharge)
      const fuelSurcharge = baseCost * 0.15
      const tolls = estimatedDistance * 0.12
      const totalCost = baseCost + fuelSurcharge + tolls
      
      return res.json({
        errCode: 200,
        msg: 'success',
        data: {
          route: {
            distance: Math.round(estimatedDistance),
            duration: Math.round(estimatedDuration * 60),
            durationFormatted: `${Math.floor(estimatedDuration)}小时${Math.round((estimatedDuration % 1) * 60)}分钟`
          },
          cost: {
            baseCost: Math.round(baseCost * 100) / 100,
            transportCost: Math.round(baseCost * 100) / 100,
            tolls: Math.round(tolls * 100) / 100,
            fuelSurcharge: Math.round(fuelSurcharge * 100) / 100,
            totalCost: Math.round(totalCost * 100) / 100
          },
          truckType: {
            code: truckType?.code || 'TRUCK_18T',
            name: truckType?.name || '18吨卡车'
          },
          isEstimate: true,
          warning: '无法获取精确路线，当前为估算值，仅供参考'
        }
      })
    }
    
    // 使用主系统返回的真实路线数据
    // 主系统返回格式：{ route: { route: { roadDistance, duration, durationFormatted, ... }, origin, destination }, cost: { ... }, truckType: { ... } }
    // 注意：路线数据可能在 routeData.route.route 或直接在 routeData.route 中
    // 重要：主系统返回的 duration 单位是分钟，不是秒！
    const routeInfo = routeData.route?.route || routeData.route || {}
    const distance = routeInfo.roadDistance || routeInfo.distance || 0
    const durationMinutes = routeInfo.duration || 0 // 分钟
    const durationHours = durationMinutes / 60
    
    // 优先使用主系统返回的格式化时间，否则自己计算
    const durationFormatted = routeInfo.durationFormatted || (durationMinutes > 0 
      ? `${Math.floor(durationHours)}小时${Math.round((durationHours % 1) * 60)}分钟`
      : `${Math.floor(distance / 70)}小时${Math.round(((distance / 70) % 1) * 60)}分钟`) // 按70km/h估算
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        route: {
          distance: Math.round(distance),
          duration: durationMinutes || Math.round(distance / 70 * 60), // 分钟
          durationFormatted: durationFormatted
        },
        cost: {
          baseCost: routeData.cost?.baseCost || 0,
          transportCost: routeData.cost?.transportCost || 0,
          tolls: routeData.cost?.tolls || 0,
          fuelSurcharge: routeData.cost?.fuelSurcharge || 0,
          totalCost: routeData.cost?.totalCost || 0,
          currency: routeData.cost?.currency || 'EUR'
        },
        truckType: {
          code: routeData.truckType?.code || truckTypeCode || 'SEMI_40',
          name: routeData.truckType?.name || '标准半挂车'
        },
        isEstimate: false
      }
    })
  } catch (error) {
    console.error('运输计算失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '运输计算失败', data: null })
  }
})

/**
 * 清关费用估算
 * POST /api/clearance/estimate
 */
router.post('/clearance/estimate', authenticate, async (req, res) => {
  try {
    const { items } = req.body
    
    if (!items || items.length === 0) {
      return res.status(400).json({ errCode: 400, msg: '缺少货物信息', data: null })
    }
    
    let totalDuty = 0
    let totalVat = 0
    let totalValue = 0
    
    for (const item of items) {
      const value = (item.value || 0) * (item.quantity || 1)
      const dutyRate = item.dutyRate || 5 // 默认关税率 5%
      const vatRate = item.vatRate || 19 // 默认增值税率 19%
      
      totalValue += value
      totalDuty += value * (dutyRate / 100)
      totalVat += (value + totalDuty) * (vatRate / 100)
    }
    
    // 清关服务费
    const clearanceFee = Math.max(150, totalValue * 0.002) // 最低 150 欧元或货值的 0.2%
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        totalValue: Math.round(totalValue * 100) / 100,
        estimatedDuty: Math.round(totalDuty * 100) / 100,
        estimatedVat: Math.round(totalVat * 100) / 100,
        clearanceFee: Math.round(clearanceFee * 100) / 100,
        totalCost: Math.round((totalDuty + totalVat + clearanceFee) * 100) / 100,
        currency: 'EUR'
      }
    })
  } catch (error) {
    console.error('清关估算失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '清关估算失败', data: null })
  }
})

/**
 * 上传Excel货物明细
 * POST /api/clearance/upload-excel
 */
router.post('/clearance/upload-excel', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ errCode: 400, msg: '请上传文件', data: null })
    }

    const db = getDatabase()
    const customerId = req.customer.customerId
    const customerName = req.customer.companyName || req.customer.email

    // 解析 Excel 文件
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: '' })

    if (!jsonData || jsonData.length === 0) {
      return res.status(400).json({ errCode: 400, msg: 'Excel文件为空或格式不正确', data: null })
    }

    // 解析货物项（支持中英文列名）
    const items = jsonData.map((row, index) => {
      // 支持多种列名格式
      const name = row['品名'] || row['Name'] || row['商品名称'] || row['Product'] || row['Description'] || ''
      const hsCode = row['HS CODE'] || row['HSCode'] || row['HS编码'] || row['海关编码'] || ''
      const value = parseFloat(row['货值'] || row['Value'] || row['金额'] || row['Amount'] || 0) || 0
      const quantity = parseInt(row['数量'] || row['Quantity'] || row['Qty'] || 1) || 1
      const weight = parseFloat(row['重量'] || row['Weight'] || row['净重'] || 0) || 0
      const dutyRate = parseFloat(row['关税率'] || row['Duty Rate'] || row['关税'] || 0) || 0
      const vatRate = parseFloat(row['增值税率'] || row['VAT Rate'] || row['VAT'] || 19) || 19

      return {
        index: index + 1,
        name: String(name).trim(),
        hsCode: String(hsCode).trim().replace(/[^0-9]/g, ''), // 只保留数字
        value,
        quantity,
        weight,
        dutyRate,
        vatRate
      }
    }).filter(item => item.name || item.hsCode) // 过滤空行

    if (items.length === 0) {
      return res.status(400).json({ errCode: 400, msg: '未能解析到有效的货物数据', data: null })
    }

    // 保存上传记录到数据库
    const fileId = generateId('FILE')
    await db.prepare(`
      INSERT INTO customer_uploaded_files (
        id, customer_id, customer_name, file_name, file_size,
        file_type, item_count, parsed_data, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `).run(
      fileId,
      customerId,
      customerName,
      req.file.originalname,
      req.file.size,
      'cargo_excel',
      items.length,
      JSON.stringify(items),
      'active'
    )

    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'upload_cargo_excel',
      resourceType: 'file',
      resourceId: fileId,
      details: { fileName: req.file.originalname, itemCount: items.length }
    })

    res.json({
      errCode: 200,
      msg: '上传成功',
      data: {
        fileId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        items
      }
    })
  } catch (error) {
    console.error('上传Excel失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '上传失败：' + error.message, data: null })
  }
})

/**
 * 获取待确认的匹配结果
 * GET /api/inquiries/pending-confirmations
 */
router.get('/inquiries/pending-confirmations', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId

    // 查询状态为 "matched"（已匹配待确认）的询价
    const inquiriesRaw = await db.prepare(`
      SELECT 
        id, inquiry_number, customer_id, customer_name,
        inquiry_type, status, matching_status, clearance_data, transport_data,
        estimated_duty, estimated_vat, clearance_fee,
        transport_fee, total_quote, valid_until, notes,
        matched_items, matched_at,
        created_at, updated_at
      FROM customer_inquiries
      WHERE customer_id = $1 AND matching_status = 'matched'
      ORDER BY matched_at DESC
    `).all(customerId)

    const inquiries = (inquiriesRaw || []).map(inq => ({
      id: inq.id,
      inquiryNumber: inq.inquiry_number,
      customerId: inq.customer_id,
      customerName: inq.customer_name,
      inquiryType: inq.inquiry_type,
      status: inq.status,
      matchingStatus: inq.matching_status,
      clearanceData: inq.clearance_data ? JSON.parse(inq.clearance_data) : null,
      transportData: inq.transport_data ? JSON.parse(inq.transport_data) : null,
      estimatedDuty: parseFloat(inq.estimated_duty || 0),
      estimatedVat: parseFloat(inq.estimated_vat || 0),
      clearanceFee: parseFloat(inq.clearance_fee || 0),
      transportFee: parseFloat(inq.transport_fee || 0),
      totalQuote: parseFloat(inq.total_quote || 0),
      validUntil: inq.valid_until,
      notes: inq.notes,
      matchedItems: inq.matched_items ? JSON.parse(inq.matched_items) : null,
      matchedAt: inq.matched_at,
      createdAt: inq.created_at,
      updatedAt: inq.updated_at
    }))

    res.json({
      errCode: 200,
      msg: 'success',
      data: inquiries
    })
  } catch (error) {
    console.error('获取待确认记录失败:', error.message)
    res.json({ errCode: 200, msg: 'success', data: [] })
  }
})

/**
 * 确认匹配结果
 * POST /api/inquiries/:id/confirm-matching
 */
router.post('/inquiries/:id/confirm-matching', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { id } = req.params

    // 验证询价归属
    const inquiry = await db.prepare(`
      SELECT * FROM customer_inquiries 
      WHERE id = $1 AND customer_id = $2 AND matching_status = 'matched'
    `).get(id, customerId)

    if (!inquiry) {
      return res.status(404).json({ errCode: 404, msg: '询价不存在或状态不正确', data: null })
    }

    // 更新状态为已确认
    await db.prepare(`
      UPDATE customer_inquiries 
      SET matching_status = 'confirmed', 
          status = 'processing',
          confirmed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `).run(id)

    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'confirm_matching',
      resourceType: 'inquiry',
      resourceId: id,
      details: { inquiryNumber: inquiry.inquiry_number }
    })

    // TODO: 通知单证部门继续处理清关
    // 可以调用主系统 API 或发送消息队列

    res.json({
      errCode: 200,
      msg: '已确认匹配结果',
      data: { id, status: 'confirmed' }
    })
  } catch (error) {
    console.error('确认匹配结果失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '操作失败', data: null })
  }
})

/**
 * 拒绝/取消匹配结果
 * POST /api/inquiries/:id/reject-matching
 */
router.post('/inquiries/:id/reject-matching', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { id } = req.params
    const { reason } = req.body

    if (!reason || !reason.trim()) {
      return res.status(400).json({ errCode: 400, msg: '请填写取消原因', data: null })
    }

    // 验证询价归属
    const inquiry = await db.prepare(`
      SELECT * FROM customer_inquiries 
      WHERE id = $1 AND customer_id = $2 AND matching_status = 'matched'
    `).get(id, customerId)

    if (!inquiry) {
      return res.status(404).json({ errCode: 404, msg: '询价不存在或状态不正确', data: null })
    }

    // 更新状态为已拒绝
    await db.prepare(`
      UPDATE customer_inquiries 
      SET matching_status = 'rejected', 
          status = 'rejected',
          reject_reason = $2,
          rejected_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `).run(id, reason.trim())

    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'reject_matching',
      resourceType: 'inquiry',
      resourceId: id,
      details: { inquiryNumber: inquiry.inquiry_number, reason }
    })

    // TODO: 通知单证部门客户已拒绝
    // 可以调用主系统 API 或发送消息队列

    res.json({
      errCode: 200,
      msg: '已取消匹配结果',
      data: { id, status: 'rejected' }
    })
  } catch (error) {
    console.error('拒绝匹配结果失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '操作失败', data: null })
  }
})

/**
 * 获取客户询价列表
 * GET /api/inquiries
 */
router.get('/inquiries', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { page = 1, pageSize = 20, status } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    
    console.log('========== 获取询价列表 ==========')
    console.log('req.customer:', JSON.stringify(req.customer))
    console.log('customerId:', customerId)
    
    let whereClause = 'WHERE customer_id = $1'
    const conditions = [customerId]
    let paramIndex = 2
    
    if (status) {
      whereClause += ` AND status = $${paramIndex++}`
      conditions.push(status)
    }
    
    // 获取总数
    const countResult = await db.prepare(`
      SELECT COUNT(*) as total FROM customer_inquiries ${whereClause}
    `).get(...conditions)
    
    console.log('查询条件:', whereClause, conditions)
    console.log('查询结果 count:', countResult)
    
    // 获取询价列表
    const inquiriesRaw = await db.prepare(`
      SELECT 
        id, inquiry_number, customer_id, customer_name,
        inquiry_type, status, clearance_data, transport_data,
        estimated_duty, estimated_vat, clearance_fee,
        transport_fee, total_quote, valid_until, notes,
        created_at, updated_at
      FROM customer_inquiries
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `).all(...conditions, parseInt(pageSize), offset)
    
    // 辅助函数：安全解析 JSON（处理 JSONB 已自动解析的情况）
    const safeParseJson = (data) => {
      if (!data) return null
      if (typeof data === 'object') return data // JSONB 已自动解析
      try {
        return JSON.parse(data)
      } catch (e) {
        console.error('JSON 解析失败:', e.message, data)
        return null
      }
    }
    
    const inquiries = (inquiriesRaw || []).map(inq => ({
      id: inq.id,
      inquiryNumber: inq.inquiry_number,
      customerId: inq.customer_id,
      customerName: inq.customer_name,
      inquiryType: inq.inquiry_type,
      status: inq.status,
      clearanceData: safeParseJson(inq.clearance_data),
      transportData: safeParseJson(inq.transport_data),
      estimatedDuty: parseFloat(inq.estimated_duty || 0),
      estimatedVat: parseFloat(inq.estimated_vat || 0),
      clearanceFee: parseFloat(inq.clearance_fee || 0),
      transportFee: parseFloat(inq.transport_fee || 0),
      totalQuote: parseFloat(inq.total_quote || 0),
      validUntil: inq.valid_until,
      notes: inq.notes,
      createdAt: inq.created_at,
      updatedAt: inq.updated_at
    }))
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        list: inquiries,
        total: parseInt(countResult?.total || 0),
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('获取询价列表失败:', error.message)
    res.json({
      errCode: 200,
      msg: 'success',
      data: { list: [], total: 0, page: 1, pageSize: 20 }
    })
  }
})

/**
 * 创建询价
 * POST /api/inquiries
 */
router.post('/inquiries', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const customerName = req.customer.companyName || req.customer.email
    
    const {
      inquiryType,
      clearanceData,
      transportData,
      estimatedDuty,
      estimatedVat,
      clearanceFee,
      transportFee,
      totalQuote,
      notes
    } = req.body
    
    const id = generateId('INQ')
    const inquiryNumber = `INQ-${Date.now().toString(36).toUpperCase()}`
    
    // 有效期 7 天
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + 7)
    
    await db.prepare(`
      INSERT INTO customer_inquiries (
        id, inquiry_number, customer_id, customer_name,
        inquiry_type, status, clearance_data, transport_data,
        estimated_duty, estimated_vat, clearance_fee,
        transport_fee, total_quote, valid_until, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
    `).run(
      id, inquiryNumber, customerId, customerName,
      inquiryType, 'pending',
      clearanceData ? JSON.stringify(clearanceData) : null,
      transportData ? JSON.stringify(transportData) : null,
      estimatedDuty || 0, estimatedVat || 0, clearanceFee || 0,
      transportFee || 0, totalQuote || 0,
      validUntil.toISOString().split('T')[0],
      notes || null
    )
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'create_inquiry',
      resourceType: 'inquiry',
      resourceId: id,
      details: { inquiryNumber, inquiryType }
    })
    
    res.json({
      errCode: 200,
      msg: '询价提交成功',
      data: {
        id,
        inquiryNumber,
        status: 'pending',
        validUntil: validUntil.toISOString().split('T')[0]
      }
    })
  } catch (error) {
    console.error('创建询价失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '创建询价失败', data: null })
  }
})

/**
 * 接受报价
 * POST /api/inquiries/:id/accept
 */
router.post('/inquiries/:id/accept', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { id } = req.params

    // 验证询价归属和状态
    const inquiry = await db.prepare(`
      SELECT * FROM customer_inquiries 
      WHERE id = $1 AND customer_id = $2 AND status = 'quoted'
    `).get(id, customerId)

    if (!inquiry) {
      return res.status(404).json({ errCode: 404, msg: '询价不存在或状态不正确', data: null })
    }

    // 检查报价是否过期
    if (inquiry.valid_until && new Date(inquiry.valid_until) < new Date()) {
      return res.status(400).json({ errCode: 400, msg: '报价已过期', data: null })
    }

    // 更新状态为已接受
    await db.prepare(`
      UPDATE customer_inquiries 
      SET status = 'accepted', 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `).run(id)

    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'accept_quote',
      resourceType: 'inquiry',
      resourceId: id,
      details: { inquiryNumber: inquiry.inquiry_number }
    })

    res.json({
      errCode: 200,
      msg: '已接受报价',
      data: { id, status: 'accepted' }
    })
  } catch (error) {
    console.error('接受报价失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '操作失败', data: null })
  }
})

/**
 * 拒绝报价
 * POST /api/inquiries/:id/reject
 */
router.post('/inquiries/:id/reject', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { id } = req.params
    const { reason } = req.body

    // 验证询价归属和状态
    const inquiry = await db.prepare(`
      SELECT * FROM customer_inquiries 
      WHERE id = $1 AND customer_id = $2 AND status = 'quoted'
    `).get(id, customerId)

    if (!inquiry) {
      return res.status(404).json({ errCode: 404, msg: '询价不存在或状态不正确', data: null })
    }

    // 更新状态为已拒绝
    await db.prepare(`
      UPDATE customer_inquiries 
      SET status = 'rejected', 
          reject_reason = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `).run(id, reason || null)

    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'reject_quote',
      resourceType: 'inquiry',
      resourceId: id,
      details: { inquiryNumber: inquiry.inquiry_number, reason }
    })

    res.json({
      errCode: 200,
      msg: '已拒绝报价',
      data: { id, status: 'rejected' }
    })
  } catch (error) {
    console.error('拒绝报价失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '操作失败', data: null })
  }
})

/**
 * 获取询价详情
 * GET /api/inquiries/:id
 */
router.get('/inquiries/:id', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { id } = req.params
    
    const inquiry = await db.prepare(`
      SELECT * FROM customer_inquiries 
      WHERE id = $1 AND customer_id = $2
    `).get(id, customerId)
    
    if (!inquiry) {
      return res.status(404).json({ errCode: 404, msg: '询价不存在', data: null })
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: inquiry.id,
        inquiryNumber: inquiry.inquiry_number,
        inquiryType: inquiry.inquiry_type,
        status: inquiry.status,
        clearanceData: inquiry.clearance_data ? JSON.parse(inquiry.clearance_data) : null,
        transportData: inquiry.transport_data ? JSON.parse(inquiry.transport_data) : null,
        estimatedDuty: parseFloat(inquiry.estimated_duty || 0),
        estimatedVat: parseFloat(inquiry.estimated_vat || 0),
        clearanceFee: parseFloat(inquiry.clearance_fee || 0),
        transportFee: parseFloat(inquiry.transport_fee || 0),
        totalQuote: parseFloat(inquiry.total_quote || 0),
        validUntil: inquiry.valid_until,
        notes: inquiry.notes,
        createdAt: inquiry.created_at,
        updatedAt: inquiry.updated_at
      }
    })
  } catch (error) {
    console.error('获取询价详情失败:', error.message)
    res.status(500).json({ errCode: 500, msg: '获取询价详情失败', data: null })
  }
})

export default router

