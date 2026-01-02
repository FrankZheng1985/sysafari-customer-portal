/**
 * API 密钥管理模块路由
 */

import { Router } from 'express'
import crypto from 'crypto'
import { getDatabase, generateId } from '../../config/database.js'
import { authenticate, logActivity } from '../../middleware/auth.js'

const router = Router()

/**
 * 生成 API 密钥
 */
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * 获取 API 密钥列表
 * GET /api/api-keys
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    
    const keys = await db.prepare(`
      SELECT id, key_name, key_prefix, permissions, rate_limit, status,
             last_used_at, usage_count, expires_at, created_at
      FROM portal_api_keys
      WHERE customer_id = $1
      ORDER BY created_at DESC
    `).all(req.customer.id)
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: keys.map(key => ({
        id: key.id,
        keyName: key.key_name,
        keyPrefix: key.key_prefix,
        permissions: key.permissions,
        rateLimit: key.rate_limit,
        status: key.status,
        lastUsedAt: key.last_used_at,
        usageCount: key.usage_count,
        expiresAt: key.expires_at,
        createdAt: key.created_at
      }))
    })
    
  } catch (error) {
    console.error('获取 API 密钥列表失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '服务器错误',
      data: null
    })
  }
})

/**
 * 创建 API 密钥
 * POST /api/api-keys
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { keyName, permissions = ['read'], rateLimit = 1000, expiresAt } = req.body
    
    if (!keyName) {
      return res.status(400).json({
        errCode: 400,
        msg: '请输入密钥名称',
        data: null
      })
    }
    
    const db = getDatabase()
    
    // 检查是否已达到密钥数量限制（每个客户最多 5 个）
    const countResult = await db.prepare(`
      SELECT COUNT(*) as count FROM portal_api_keys 
      WHERE customer_id = $1 AND status = 'active'
    `).get(req.customer.id)
    
    if (countResult.count >= 5) {
      return res.status(400).json({
        errCode: 400,
        msg: '已达到 API 密钥数量上限（最多 5 个）',
        data: null
      })
    }
    
    // 生成密钥
    const apiKey = generateApiKey()
    const keyPrefix = apiKey.substring(0, 8)
    
    // 创建密钥记录
    const result = await db.prepare(`
      INSERT INTO portal_api_keys 
      (customer_id, key_name, api_key, key_prefix, permissions, rate_limit, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `).get(
      req.customer.id,
      keyName,
      apiKey,
      keyPrefix,
      JSON.stringify(permissions),
      rateLimit,
      expiresAt || null
    )
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'create_api_key',
      resourceType: 'api_key',
      resourceId: result?.id?.toString(),
      details: { keyName }
    })
    
    res.json({
      errCode: 200,
      msg: 'API 密钥创建成功',
      data: {
        id: result?.id,
        keyName,
        apiKey, // 仅在创建时返回完整密钥
        keyPrefix,
        permissions,
        rateLimit,
        expiresAt
      }
    })
    
  } catch (error) {
    console.error('创建 API 密钥失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '服务器错误',
      data: null
    })
  }
})

/**
 * 更新 API 密钥
 * PUT /api/api-keys/:id
 */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    const { keyName, permissions, rateLimit } = req.body
    
    const db = getDatabase()
    
    // 检查密钥是否存在且属于当前客户
    const existing = await db.prepare(`
      SELECT id FROM portal_api_keys 
      WHERE id = $1 AND customer_id = $2
    `).get(id, req.customer.id)
    
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: 'API 密钥不存在',
        data: null
      })
    }
    
    // 构建更新语句
    const updates = []
    const params = []
    let paramIndex = 1
    
    if (keyName) {
      updates.push(`key_name = $${paramIndex++}`)
      params.push(keyName)
    }
    if (permissions) {
      updates.push(`permissions = $${paramIndex++}`)
      params.push(JSON.stringify(permissions))
    }
    if (rateLimit !== undefined) {
      updates.push(`rate_limit = $${paramIndex++}`)
      params.push(rateLimit)
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        errCode: 400,
        msg: '没有需要更新的内容',
        data: null
      })
    }
    
    params.push(id)
    
    await db.prepare(`
      UPDATE portal_api_keys SET ${updates.join(', ')} WHERE id = $${paramIndex}
    `).run(...params)
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'update_api_key',
      resourceType: 'api_key',
      resourceId: id,
      details: { keyName, permissions, rateLimit }
    })
    
    res.json({
      errCode: 200,
      msg: 'API 密钥更新成功',
      data: null
    })
    
  } catch (error) {
    console.error('更新 API 密钥失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '服务器错误',
      data: null
    })
  }
})

/**
 * 撤销 API 密钥
 * DELETE /api/api-keys/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    
    const db = getDatabase()
    
    // 检查密钥是否存在且属于当前客户
    const existing = await db.prepare(`
      SELECT id, key_name FROM portal_api_keys 
      WHERE id = $1 AND customer_id = $2
    `).get(id, req.customer.id)
    
    if (!existing) {
      return res.status(404).json({
        errCode: 404,
        msg: 'API 密钥不存在',
        data: null
      })
    }
    
    // 撤销密钥（软删除）
    await db.prepare(`
      UPDATE portal_api_keys 
      SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `).run(id)
    
    // 记录活动
    await logActivity({
      customerId: req.customer.id,
      action: 'revoke_api_key',
      resourceType: 'api_key',
      resourceId: id,
      details: { keyName: existing.key_name }
    })
    
    res.json({
      errCode: 200,
      msg: 'API 密钥已撤销',
      data: null
    })
    
  } catch (error) {
    console.error('撤销 API 密钥失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '服务器错误',
      data: null
    })
  }
})

/**
 * 获取 API 密钥使用统计
 * GET /api/api-keys/:id/stats
 */
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    
    const db = getDatabase()
    
    // 检查密钥是否存在且属于当前客户
    const key = await db.prepare(`
      SELECT id, key_name, usage_count, last_used_at, rate_limit
      FROM portal_api_keys 
      WHERE id = $1 AND customer_id = $2
    `).get(id, req.customer.id)
    
    if (!key) {
      return res.status(404).json({
        errCode: 404,
        msg: 'API 密钥不存在',
        data: null
      })
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        keyName: key.key_name,
        usageCount: key.usage_count,
        lastUsedAt: key.last_used_at,
        rateLimit: key.rate_limit,
        remainingToday: key.rate_limit - (key.usage_count % key.rate_limit)
      }
    })
    
  } catch (error) {
    console.error('获取 API 密钥统计失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '服务器错误',
      data: null
    })
  }
})

export default router

