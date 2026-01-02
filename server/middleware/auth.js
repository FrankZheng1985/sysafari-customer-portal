/**
 * 客户门户认证中间件
 * 方案2：使用本地 portal_customers 表进行验证
 * JWT Token 进行客户身份验证
 */

import jwt from 'jsonwebtoken'
import { getDatabase } from '../config/database.js'
// 注：认证不再查询数据库，客户信息直接从 Token 获取
// 但 logActivity 仍需要数据库连接

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
 * 直接从 Token 获取客户信息，不查询数据库
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

  // 直接从 Token 获取客户信息（Token 已包含所有必要信息）
  req.customer = {
    accountId: decoded.accountId,
    customerId: decoded.customerId,
    username: decoded.username,
    email: decoded.email,
    companyName: decoded.companyName,
    contactPerson: decoded.contactPerson || decoded.username,
    phone: decoded.phone,
    status: 'active'
  }
  
  next()
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
    // 直接从 Token 获取客户信息
    req.customer = {
      accountId: decoded.accountId,
      customerId: decoded.customerId,
      username: decoded.username,
      email: decoded.email,
      companyName: decoded.companyName,
      contactPerson: decoded.contactPerson || decoded.username,
      phone: decoded.phone,
      status: 'active'
    }
  }
  
  next()
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
      VALUES ($1, $2, $3, $4, $5, $6, $7)
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
