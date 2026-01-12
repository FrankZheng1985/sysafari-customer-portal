/**
 * 客户门户认证中间件
 * 支持主账户（customer_accounts）和子账户（portal_users）登录
 * JWT Token 进行客户身份验证
 */

import jwt from 'jsonwebtoken'
import { getDatabase } from '../config/database.js'

// JWT 配置
// 注意：此密钥必须与 ERP 系统的 JWT_SECRET 保持一致，以支持工作人员代登录功能
const JWT_SECRET = process.env.JWT_SECRET || 'customer-portal-secret-key'
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

  // 从 Token 获取客户信息
  // 支持 ERP 系统代登录 Token（使用 type: 'customer'）和客户门户 Token（使用 userType）
  const isStaffProxy = decoded.staffProxy === true
  const userType = decoded.userType || (decoded.type === 'customer' ? 'master' : 'master')
  
  req.customer = {
    accountId: decoded.accountId,
    customerId: decoded.customerId,
    customerCode: decoded.customerCode || decoded.customerId,
    customerName: decoded.customerName,
    username: decoded.username,
    email: decoded.email,
    companyName: decoded.companyName || decoded.customerName,
    contactPerson: decoded.contactPerson || decoded.username,
    phone: decoded.phone,
    status: 'active',
    // 用户类型和权限信息
    userType: userType,
    userId: decoded.userId || decoded.accountId,
    roleId: decoded.roleId || null,
    roleName: decoded.roleName || null,
    permissions: decoded.permissions || [],
    // 工作人员代登录标记
    staffProxy: isStaffProxy,
    staffId: decoded.staffId,
    staffName: decoded.staffName,
    staffRole: decoded.staffRole
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
    req.customer = {
      accountId: decoded.accountId,
      customerId: decoded.customerId,
      customerCode: decoded.customerCode,
      username: decoded.username,
      email: decoded.email,
      companyName: decoded.companyName,
      contactPerson: decoded.contactPerson || decoded.username,
      phone: decoded.phone,
      status: 'active',
      userType: decoded.userType || 'master',
      userId: decoded.userId || decoded.accountId,
      roleId: decoded.roleId || null,
      roleName: decoded.roleName || null,
      permissions: decoded.permissions || []
    }
  }
  
  next()
}

/**
 * 权限验证中间件
 * 检查用户是否拥有指定权限
 * 主账户默认拥有所有权限
 * 
 * @param {string|string[]} requiredPermissions - 需要的权限代码，可以是单个或数组
 * @param {boolean} requireAll - 如果是数组，是否需要全部满足（默认 false，只需满足一个）
 */
export function requirePermission(requiredPermissions, requireAll = false) {
  return (req, res, next) => {
    // 未认证
    if (!req.customer) {
      return res.status(401).json({
        errCode: 401,
        msg: '请先登录',
        data: null
      })
    }
    
    // 主账户拥有所有权限
    if (req.customer.userType === 'master') {
      return next()
    }
    
    // 子账户验证权限
    const userPermissions = req.customer.permissions || []
    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions]
    
    let hasPermission
    if (requireAll) {
      // 需要全部权限
      hasPermission = permissions.every(p => userPermissions.includes(p))
    } else {
      // 只需要其中一个权限
      hasPermission = permissions.some(p => userPermissions.includes(p))
    }
    
    if (!hasPermission) {
      return res.status(403).json({
        errCode: 403,
        msg: '您没有权限执行此操作',
        data: null
      })
    }
    
    next()
  }
}

/**
 * 检查是否为主账户
 * 某些操作只能由主账户执行（如用户管理、角色管理）
 */
export function requireMasterAccount(req, res, next) {
  if (!req.customer) {
    return res.status(401).json({
      errCode: 401,
      msg: '请先登录',
      data: null
    })
  }
  
  // 主账户 或 有 users:manage 权限的子账户
  if (req.customer.userType === 'master' || 
      (req.customer.permissions && req.customer.permissions.includes('users:manage'))) {
    return next()
  }
  
  return res.status(403).json({
    errCode: 403,
    msg: '此操作需要管理员权限',
    data: null
  })
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

/**
 * 获取用户的权限列表
 * @param {number} roleId - 角色ID
 * @returns {Promise<string[]>} 权限代码数组
 */
export async function getUserPermissions(roleId) {
  if (!roleId) return []
  
  try {
    const db = getDatabase()
    const permissions = await db.prepare(`
      SELECT p.code
      FROM portal_permissions p
      INNER JOIN portal_role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
    `).all(roleId)
    
    return permissions.map(p => p.code)
  } catch (error) {
    console.error('获取用户权限失败:', error)
    return []
  }
}

export default {
  generateToken,
  verifyToken,
  authenticate,
  optionalAuth,
  requirePermission,
  requireMasterAccount,
  logActivity,
  getUserPermissions
}
