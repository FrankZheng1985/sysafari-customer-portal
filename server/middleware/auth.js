/**
 * 客户门户认证中间件
 * 方案2：使用本地 portal_customers 表进行验证
 * JWT Token 进行客户身份验证
 */

import jwt from 'jsonwebtoken'
import { getDatabase } from '../config/database.js'

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'portal-secret-key-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

/**
 * 生成 JWT Token
 * @param {Object} payload - Token 载荷
 * @returns {string} JWT Token
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/**
 * 验证 JWT Token
 * @param {string} token - JWT Token
 * @returns {Object|null} 解码后的载荷或 null
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    console.error('Token 验证失败:', error.message)
    return null
  }
}

/**
 * 客户认证中间件
 */
export function authenticate(req, res, next) {
  // 获取 Authorization header
  const authHeader = req.headers.authorization
  
  if (!authHeader) {
    return res.status(401).json({
      errCode: 401,
      msg: '请先登录',
      data: null
    })
  }

  // 提取 token
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  
  // 验证 token
  const decoded = verifyToken(token)
  
  if (!decoded) {
    return res.status(401).json({
      errCode: 401,
      msg: 'Token 无效或已过期',
      data: null
    })
  }

  // 从本地 portal_customers 表验证客户是否存在且状态正常
  verifyCustomer(decoded.accountId)
    .then(customer => {
      if (!customer) {
        return res.status(401).json({
          errCode: 401,
          msg: '账户不存在或已禁用',
          data: null
        })
      }
      
      // 将客户信息附加到请求对象
      req.customer = {
        accountId: customer.id,
        customerId: customer.customer_id,
        username: customer.email,
        email: customer.email,
        companyName: customer.company_name,
        contactPerson: customer.contact_name,
        status: customer.status
      }
      
      next()
    })
    .catch(error => {
      console.error('客户验证失败:', error)
      return res.status(500).json({
        errCode: 500,
        msg: '服务器错误',
        data: null
      })
    })
}

/**
 * 验证客户账户是否存在且状态正常
 * 使用本地 portal_customers 表
 * @param {string} accountId - 客户账户 ID
 * @returns {Promise<Object|null>} 客户信息或 null
 */
async function verifyCustomer(accountId) {
  const db = getDatabase()
  
  try {
    const customer = await db.prepare(`
      SELECT 
        id, customer_id, email, company_name, contact_name, phone, status
      FROM portal_customers 
      WHERE id = ? AND status = 'active'
    `).get(accountId)
    
    return customer
  } catch (error) {
    console.error('查询 portal_customers 失败:', error)
    return null
  }
}

/**
 * 可选认证中间件
 * 如果有认证信息则验证，没有也继续
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization
  
  if (!authHeader) {
    return next()
  }
  
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  const decoded = verifyToken(token)
  
  if (decoded) {
    verifyCustomer(decoded.accountId)
      .then(customer => {
        if (customer) {
          req.customer = {
            accountId: customer.id,
            customerId: customer.customer_id,
            username: customer.email,
            email: customer.email,
            companyName: customer.company_name,
            contactPerson: customer.contact_name,
            status: customer.status
          }
        }
        next()
      })
      .catch(() => {
        next()
      })
  } else {
    next()
  }
}

/**
 * 记录活动日志
 * @param {Object} params - 日志参数
 */
export async function logActivity(params) {
  const {
    customerId,
    action,
    resourceType,
    resourceId,
    ipAddress,
    userAgent,
    details
  } = params

  try {
    const db = getDatabase()
    
    // 插入到 portal_activity_logs 表
    await db.prepare(`
      INSERT INTO portal_activity_logs 
      (customer_id, action, resource_type, resource_id, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      customerId,
      action,
      resourceType || null,
      resourceId || null,
      ipAddress || null,
      userAgent || null,
      details ? JSON.stringify(details) : null
    )
  } catch (error) {
    // 如果表不存在，静默忽略
    if (!error.message?.includes('does not exist')) {
      console.error('记录活动日志失败:', error)
    }
  }
}

export default {
  generateToken,
  verifyToken,
  authenticate,
  optionalAuth,
  logActivity
}
