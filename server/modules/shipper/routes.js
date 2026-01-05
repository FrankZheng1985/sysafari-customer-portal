/**
 * 发货人/收货人预设管理路由
 * 支持客户预设常用发货人和收货人信息
 */

import { Router } from 'express'
import { getDatabase } from '../../config/database.js'
import { authenticate, logActivity } from '../../middleware/auth.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

/**
 * 生成格式化的显示文本
 * @param {Object} data - 发货人/收货人数据
 * @returns {string} 格式化的显示文本
 */
function generateDisplayFormat(data) {
  const parts = []
  
  // 公司名称
  if (data.name) {
    parts.push(data.name)
  }
  
  // 地址
  const addressParts = []
  if (data.address) {
    addressParts.push(data.address)
  }
  if (data.city) {
    addressParts.push(data.city)
  }
  if (data.province) {
    addressParts.push(data.province)
  }
  if (data.country) {
    addressParts.push(data.country)
  }
  if (data.postalCode) {
    addressParts.push(data.postalCode)
  }
  if (addressParts.length > 0) {
    parts.push(addressParts.join(', '))
  }
  
  // 联系人信息
  const contactParts = []
  if (data.contactPerson) {
    contactParts.push(`联系人: ${data.contactPerson}`)
  }
  if (data.contactPhone) {
    contactParts.push(`电话: ${data.contactPhone}`)
  }
  if (data.email) {
    contactParts.push(`邮箱: ${data.email}`)
  }
  if (contactParts.length > 0) {
    parts.push(contactParts.join(', '))
  }
  
  return parts.join('\n')
}

// ============================================
// 发货人预设 API
// ============================================

/**
 * 获取发货人预设列表
 * GET /api/shippers
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { status = 'active' } = req.query
    
    const shippers = await db.prepare(`
      SELECT 
        id, name, name_en, short_name,
        country, province, city, district, address, address_en, postal_code,
        contact_person, contact_phone, mobile, email, fax,
        tax_number, eori_number,
        is_default, display_format, sort_order,
        erp_synced, erp_shipper_id, erp_synced_at,
        status, created_at, updated_at
      FROM shipper_presets
      WHERE customer_id = $1 AND status = $2
      ORDER BY is_default DESC, sort_order ASC, created_at DESC
    `).all(customerId, status)
    
    // 转换为驼峰格式
    const list = (shippers || []).map(item => ({
      id: item.id,
      name: item.name,
      nameEn: item.name_en,
      shortName: item.short_name,
      country: item.country,
      province: item.province,
      city: item.city,
      district: item.district,
      address: item.address,
      addressEn: item.address_en,
      postalCode: item.postal_code,
      contactPerson: item.contact_person,
      contactPhone: item.contact_phone,
      mobile: item.mobile,
      email: item.email,
      fax: item.fax,
      taxNumber: item.tax_number,
      eoriNumber: item.eori_number,
      isDefault: item.is_default,
      displayFormat: item.display_format,
      sortOrder: item.sort_order,
      erpSynced: item.erp_synced,
      erpShipperId: item.erp_shipper_id,
      erpSyncedAt: item.erp_synced_at,
      status: item.status,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: list
    })
    
  } catch (error) {
    console.error('获取发货人列表失败:', error.message)
    res.status(500).json({
      errCode: 500,
      msg: '获取发货人列表失败',
      data: null
    })
  }
})

/**
 * 获取发货人详情
 * GET /api/shippers/:id
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    const shipper = await db.prepare(`
      SELECT * FROM shipper_presets
      WHERE id = $1 AND customer_id = $2
    `).get(id, customerId)
    
    if (!shipper) {
      return res.status(404).json({
        errCode: 404,
        msg: '发货人不存在',
        data: null
      })
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: shipper.id,
        name: shipper.name,
        nameEn: shipper.name_en,
        shortName: shipper.short_name,
        country: shipper.country,
        province: shipper.province,
        city: shipper.city,
        district: shipper.district,
        address: shipper.address,
        addressEn: shipper.address_en,
        postalCode: shipper.postal_code,
        contactPerson: shipper.contact_person,
        contactPhone: shipper.contact_phone,
        mobile: shipper.mobile,
        email: shipper.email,
        fax: shipper.fax,
        taxNumber: shipper.tax_number,
        eoriNumber: shipper.eori_number,
        isDefault: shipper.is_default,
        displayFormat: shipper.display_format,
        sortOrder: shipper.sort_order,
        erpSynced: shipper.erp_synced,
        erpShipperId: shipper.erp_shipper_id,
        status: shipper.status,
        createdAt: shipper.created_at,
        updatedAt: shipper.updated_at
      }
    })
    
  } catch (error) {
    console.error('获取发货人详情失败:', error.message)
    res.status(500).json({
      errCode: 500,
      msg: '获取发货人详情失败',
      data: null
    })
  }
})

/**
 * 创建发货人预设
 * POST /api/shippers
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    const {
      name,
      nameEn,
      shortName,
      country,
      province,
      city,
      district,
      address,
      addressEn,
      postalCode,
      contactPerson,
      contactPhone,
      mobile,
      email,
      fax,
      taxNumber,
      eoriNumber,
      isDefault = false,
      sortOrder = 0
    } = req.body
    
    // 验证必填字段
    if (!name) {
      return res.status(400).json({
        errCode: 400,
        msg: '发货人名称不能为空',
        data: null
      })
    }
    
    const id = uuidv4()
    
    // 生成显示格式
    const displayFormat = generateDisplayFormat({
      name, address, city, province, country, postalCode,
      contactPerson, contactPhone, email
    })
    
    await db.prepare(`
      INSERT INTO shipper_presets (
        id, customer_id, name, name_en, short_name,
        country, province, city, district, address, address_en, postal_code,
        contact_person, contact_phone, mobile, email, fax,
        tax_number, eori_number,
        is_default, display_format, sort_order,
        status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19,
        $20, $21, $22,
        'active', NOW(), NOW()
      )
    `).run(
      id, customerId, name, nameEn || null, shortName || null,
      country || null, province || null, city || null, district || null, address || null, addressEn || null, postalCode || null,
      contactPerson || null, contactPhone || null, mobile || null, email || null, fax || null,
      taxNumber || null, eoriNumber || null,
      isDefault, displayFormat, sortOrder
    )
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'create_shipper',
      resourceType: 'shipper',
      resourceId: id,
      details: { name }
    })
    
    console.log(`发货人预设创建成功: ${name} (客户: ${customerId})`)
    
    res.json({
      errCode: 200,
      msg: '发货人创建成功',
      data: {
        id,
        name,
        displayFormat,
        isDefault
      }
    })
    
  } catch (error) {
    console.error('创建发货人失败:', error.message)
    res.status(500).json({
      errCode: 500,
      msg: '创建发货人失败: ' + error.message,
      data: null
    })
  }
})

/**
 * 更新发货人预设
 * PUT /api/shippers/:id
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    // 检查发货人是否存在
    const existing = await db.prepare(`
      SELECT id FROM shipper_presets WHERE id = $1 AND customer_id = $2
    `).get(id, customerId)
    
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: '发货人不存在',
        data: null
      })
    }
    
    const {
      name,
      nameEn,
      shortName,
      country,
      province,
      city,
      district,
      address,
      addressEn,
      postalCode,
      contactPerson,
      contactPhone,
      mobile,
      email,
      fax,
      taxNumber,
      eoriNumber,
      isDefault,
      sortOrder
    } = req.body
    
    // 生成显示格式
    const displayFormat = generateDisplayFormat({
      name, address, city, province, country, postalCode,
      contactPerson, contactPhone, email
    })
    
    await db.prepare(`
      UPDATE shipper_presets SET
        name = COALESCE($1, name),
        name_en = $2,
        short_name = $3,
        country = $4,
        province = $5,
        city = $6,
        district = $7,
        address = $8,
        address_en = $9,
        postal_code = $10,
        contact_person = $11,
        contact_phone = $12,
        mobile = $13,
        email = $14,
        fax = $15,
        tax_number = $16,
        eori_number = $17,
        is_default = COALESCE($18, is_default),
        display_format = $19,
        sort_order = COALESCE($20, sort_order),
        erp_synced = FALSE,
        updated_at = NOW()
      WHERE id = $21 AND customer_id = $22
    `).run(
      name, nameEn, shortName,
      country, province, city, district, address, addressEn, postalCode,
      contactPerson, contactPhone, mobile, email, fax,
      taxNumber, eoriNumber,
      isDefault, displayFormat, sortOrder,
      id, customerId
    )
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'update_shipper',
      resourceType: 'shipper',
      resourceId: id,
      details: { name }
    })
    
    res.json({
      errCode: 200,
      msg: '发货人更新成功',
      data: { id, name, displayFormat }
    })
    
  } catch (error) {
    console.error('更新发货人失败:', error.message)
    res.status(500).json({
      errCode: 500,
      msg: '更新发货人失败',
      data: null
    })
  }
})

/**
 * 删除发货人预设
 * DELETE /api/shippers/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    // 软删除
    const result = await db.prepare(`
      UPDATE shipper_presets 
      SET status = 'deleted', updated_at = NOW()
      WHERE id = $1 AND customer_id = $2
    `).run(id, customerId)
    
    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '发货人不存在',
        data: null
      })
    }
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'delete_shipper',
      resourceType: 'shipper',
      resourceId: id
    })
    
    res.json({
      errCode: 200,
      msg: '发货人删除成功',
      data: null
    })
    
  } catch (error) {
    console.error('删除发货人失败:', error.message)
    res.status(500).json({
      errCode: 500,
      msg: '删除发货人失败',
      data: null
    })
  }
})

/**
 * 设为默认发货人
 * POST /api/shippers/:id/set-default
 */
router.post('/:id/set-default', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    // 检查发货人是否存在
    const shipper = await db.prepare(`
      SELECT id, name FROM shipper_presets 
      WHERE id = $1 AND customer_id = $2 AND status = 'active'
    `).get(id, customerId)
    
    if (!shipper) {
      return res.status(404).json({
        errCode: 404,
        msg: '发货人不存在',
        data: null
      })
    }
    
    // 设为默认（触发器会自动处理其他记录）
    await db.prepare(`
      UPDATE shipper_presets SET is_default = TRUE WHERE id = $1
    `).run(id)
    
    res.json({
      errCode: 200,
      msg: '已设为默认发货人',
      data: { id, name: shipper.name }
    })
    
  } catch (error) {
    console.error('设置默认发货人失败:', error.message)
    res.status(500).json({
      errCode: 500,
      msg: '设置默认发货人失败',
      data: null
    })
  }
})

// ============================================
// 收货人预设 API
// ============================================

/**
 * 获取收货人预设列表
 * GET /api/shippers/consignees/list
 */
router.get('/consignees/list', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    const { status = 'active' } = req.query
    
    const consignees = await db.prepare(`
      SELECT 
        id, name, name_en, short_name,
        country, province, city, district, address, address_en, postal_code,
        contact_person, contact_phone, mobile, email, fax,
        tax_number, eori_number, vat_number,
        is_default, display_format, sort_order,
        erp_synced, erp_consignee_id, erp_synced_at,
        status, created_at, updated_at
      FROM consignee_presets
      WHERE customer_id = $1 AND status = $2
      ORDER BY is_default DESC, sort_order ASC, created_at DESC
    `).all(customerId, status)
    
    const list = (consignees || []).map(item => ({
      id: item.id,
      name: item.name,
      nameEn: item.name_en,
      shortName: item.short_name,
      country: item.country,
      province: item.province,
      city: item.city,
      district: item.district,
      address: item.address,
      addressEn: item.address_en,
      postalCode: item.postal_code,
      contactPerson: item.contact_person,
      contactPhone: item.contact_phone,
      mobile: item.mobile,
      email: item.email,
      fax: item.fax,
      taxNumber: item.tax_number,
      eoriNumber: item.eori_number,
      vatNumber: item.vat_number,
      isDefault: item.is_default,
      displayFormat: item.display_format,
      sortOrder: item.sort_order,
      erpSynced: item.erp_synced,
      erpConsigneeId: item.erp_consignee_id,
      erpSyncedAt: item.erp_synced_at,
      status: item.status,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: list
    })
    
  } catch (error) {
    console.error('获取收货人列表失败:', error.message)
    res.status(500).json({
      errCode: 500,
      msg: '获取收货人列表失败',
      data: null
    })
  }
})

/**
 * 创建收货人预设
 * POST /api/shippers/consignees
 */
router.post('/consignees', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    const {
      name,
      nameEn,
      shortName,
      country,
      province,
      city,
      district,
      address,
      addressEn,
      postalCode,
      contactPerson,
      contactPhone,
      mobile,
      email,
      fax,
      taxNumber,
      eoriNumber,
      vatNumber,
      isDefault = false,
      sortOrder = 0
    } = req.body
    
    if (!name) {
      return res.status(400).json({
        errCode: 400,
        msg: '收货人名称不能为空',
        data: null
      })
    }
    
    const id = uuidv4()
    
    const displayFormat = generateDisplayFormat({
      name, address, city, province, country, postalCode,
      contactPerson, contactPhone, email
    })
    
    await db.prepare(`
      INSERT INTO consignee_presets (
        id, customer_id, name, name_en, short_name,
        country, province, city, district, address, address_en, postal_code,
        contact_person, contact_phone, mobile, email, fax,
        tax_number, eori_number, vat_number,
        is_default, display_format, sort_order,
        status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20,
        $21, $22, $23,
        'active', NOW(), NOW()
      )
    `).run(
      id, customerId, name, nameEn || null, shortName || null,
      country || null, province || null, city || null, district || null, address || null, addressEn || null, postalCode || null,
      contactPerson || null, contactPhone || null, mobile || null, email || null, fax || null,
      taxNumber || null, eoriNumber || null, vatNumber || null,
      isDefault, displayFormat, sortOrder
    )
    
    await logActivity({
      customerId: req.customer.id,
      action: 'create_consignee',
      resourceType: 'consignee',
      resourceId: id,
      details: { name }
    })
    
    res.json({
      errCode: 200,
      msg: '收货人创建成功',
      data: { id, name, displayFormat, isDefault }
    })
    
  } catch (error) {
    console.error('创建收货人失败:', error.message)
    res.status(500).json({
      errCode: 500,
      msg: '创建收货人失败: ' + error.message,
      data: null
    })
  }
})

/**
 * 更新收货人预设
 * PUT /api/shippers/consignees/:id
 */
router.put('/consignees/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    const existing = await db.prepare(`
      SELECT id FROM consignee_presets WHERE id = $1 AND customer_id = $2
    `).get(id, customerId)
    
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: '收货人不存在',
        data: null
      })
    }
    
    const {
      name,
      nameEn,
      shortName,
      country,
      province,
      city,
      district,
      address,
      addressEn,
      postalCode,
      contactPerson,
      contactPhone,
      mobile,
      email,
      fax,
      taxNumber,
      eoriNumber,
      vatNumber,
      isDefault,
      sortOrder
    } = req.body
    
    const displayFormat = generateDisplayFormat({
      name, address, city, province, country, postalCode,
      contactPerson, contactPhone, email
    })
    
    await db.prepare(`
      UPDATE consignee_presets SET
        name = COALESCE($1, name),
        name_en = $2,
        short_name = $3,
        country = $4,
        province = $5,
        city = $6,
        district = $7,
        address = $8,
        address_en = $9,
        postal_code = $10,
        contact_person = $11,
        contact_phone = $12,
        mobile = $13,
        email = $14,
        fax = $15,
        tax_number = $16,
        eori_number = $17,
        vat_number = $18,
        is_default = COALESCE($19, is_default),
        display_format = $20,
        sort_order = COALESCE($21, sort_order),
        erp_synced = FALSE,
        updated_at = NOW()
      WHERE id = $22 AND customer_id = $23
    `).run(
      name, nameEn, shortName,
      country, province, city, district, address, addressEn, postalCode,
      contactPerson, contactPhone, mobile, email, fax,
      taxNumber, eoriNumber, vatNumber,
      isDefault, displayFormat, sortOrder,
      id, customerId
    )
    
    res.json({
      errCode: 200,
      msg: '收货人更新成功',
      data: { id, name, displayFormat }
    })
    
  } catch (error) {
    console.error('更新收货人失败:', error.message)
    res.status(500).json({
      errCode: 500,
      msg: '更新收货人失败',
      data: null
    })
  }
})

/**
 * 删除收货人预设
 * DELETE /api/shippers/consignees/:id
 */
router.delete('/consignees/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    const result = await db.prepare(`
      UPDATE consignee_presets 
      SET status = 'deleted', updated_at = NOW()
      WHERE id = $1 AND customer_id = $2
    `).run(id, customerId)
    
    if (result.changes === 0) {
      return res.status(404).json({
        errCode: 404,
        msg: '收货人不存在',
        data: null
      })
    }
    
    res.json({
      errCode: 200,
      msg: '收货人删除成功',
      data: null
    })
    
  } catch (error) {
    console.error('删除收货人失败:', error.message)
    res.status(500).json({
      errCode: 500,
      msg: '删除收货人失败',
      data: null
    })
  }
})

/**
 * 设为默认收货人
 * POST /api/shippers/consignees/:id/set-default
 */
router.post('/consignees/:id/set-default', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const db = getDatabase()
    const customerId = req.customer.customerId
    
    const consignee = await db.prepare(`
      SELECT id, name FROM consignee_presets 
      WHERE id = $1 AND customer_id = $2 AND status = 'active'
    `).get(id, customerId)
    
    if (!consignee) {
      return res.status(404).json({
        errCode: 404,
        msg: '收货人不存在',
        data: null
      })
    }
    
    await db.prepare(`
      UPDATE consignee_presets SET is_default = TRUE WHERE id = $1
    `).run(id)
    
    res.json({
      errCode: 200,
      msg: '已设为默认收货人',
      data: { id, name: consignee.name }
    })
    
  } catch (error) {
    console.error('设置默认收货人失败:', error.message)
    res.status(500).json({
      errCode: 500,
      msg: '设置默认收货人失败',
      data: null
    })
  }
})

export default router

