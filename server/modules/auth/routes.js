/**
 * 客户认证模块路由
 * 直接使用 ERP 系统的 customer_accounts 表进行认证
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDatabase } from '../../config/database.js'
import { generateToken, authenticate, logActivity } from '../../middleware/auth.js'

const router = Router()

/**
 * 客户登录
 * POST /api/auth/login
 * 使用 ERP 系统的 customer_accounts 表
 */
router.post('/login', async (req, res) => {
  try {
    // 支持 email 或 username 字段
    const { email, username, password } = req.body
    const loginId = email || username
    
    if (!loginId || !password) {
      return res.status(400).json({
        errCode: 400,
        msg: '请输入用户名/邮箱和密码',
        data: null
      })
    }
    
    const db = getDatabase()
    
    // 从 ERP 的 customer_accounts 表查询客户账户
    const account = await db.prepare(`
      SELECT 
        ca.id, ca.customer_id, ca.username, ca.email, ca.password_hash, 
        ca.phone, ca.status, ca.login_attempts, ca.locked_until,
        c.company_name, c.contact_person
      FROM customer_accounts ca
      LEFT JOIN customers c ON ca.customer_id = c.id
      WHERE ca.username = ? OR ca.email = ?
    `).get(loginId.trim(), loginId.toLowerCase().trim())
    
    if (!account) {
      return res.status(401).json({
        errCode: 401,
        msg: '用户名或密码错误',
        data: null
      })
    }
    
    // 检查账户是否被锁定
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      return res.status(401).json({
        errCode: 401,
        msg: '账户已被锁定，请稍后再试',
        data: null
      })
    }
    
    // 检查账户状态
    if (account.status !== 'active') {
      return res.status(401).json({
        errCode: 401,
        msg: '账户已被禁用，请联系客服',
        data: null
      })
    }
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, account.password_hash)
    if (!isValidPassword) {
      // 增加登录失败次数
      await db.prepare(`
        UPDATE customer_accounts 
        SET login_attempts = login_attempts + 1,
            locked_until = CASE WHEN login_attempts >= 4 THEN NOW() + INTERVAL '30 minutes' ELSE locked_until END
        WHERE id = ?
      `).run(account.id)
      
      return res.status(401).json({
        errCode: 401,
        msg: '用户名或密码错误',
        data: null
      })
    }
    
    // 生成 Token
    const token = generateToken({
      accountId: account.id,
      customerId: account.customer_id,
      username: account.username,
      email: account.email,
      companyName: account.company_name
    })
    
    // 更新登录信息，重置失败次数
    await db.prepare(`
      UPDATE customer_accounts 
      SET last_login_at = NOW(), 
          last_login_ip = ?,
          login_attempts = 0,
          locked_until = NULL
      WHERE id = ?
    `).run(req.ip, account.id)
    
    // 记录活动日志
    await logActivity({
      customerId: account.id,
      action: 'login',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    })
    
    res.json({
      errCode: 200,
      msg: '登录成功',
      data: {
        token,
        customer: {
          id: account.id,
          customerId: account.customer_id,
          username: account.username,
          email: account.email,
          companyName: account.company_name,
          contactPerson: account.contact_person,
          phone: account.phone
        }
      }
    })
    
  } catch (error) {
    console.error('登录失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '服务器错误',
      data: null
    })
  }
})

/**
 * 获取当前客户信息
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    
    const account = await db.prepare(`
      SELECT 
        ca.id, ca.customer_id, ca.username, ca.email, ca.phone, ca.status,
        ca.last_login_at, ca.created_at,
        c.company_name, c.contact_person, c.customer_code
      FROM customer_accounts ca
      LEFT JOIN customers c ON ca.customer_id = c.id
      WHERE ca.id = ?
    `).get(req.customer.accountId)
    
    if (!account) {
      return res.status(404).json({
        errCode: 404,
        msg: '客户不存在',
        data: null
      })
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: account.id,
        customerId: account.customer_id,
        customerCode: account.customer_code,
        username: account.username,
        email: account.email,
        companyName: account.company_name,
        contactPerson: account.contact_person,
        phone: account.phone,
        status: account.status,
        lastLoginAt: account.last_login_at,
        createdAt: account.created_at
      }
    })
    
  } catch (error) {
    console.error('获取客户信息失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '服务器错误',
      data: null
    })
  }
})

/**
 * 修改密码
 * POST /api/auth/change-password
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        errCode: 400,
        msg: '请输入旧密码和新密码',
        data: null
      })
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        errCode: 400,
        msg: '新密码长度不能少于6位',
        data: null
      })
    }
    
    const db = getDatabase()
    
    // 获取当前密码
    const account = await db.prepare(`
      SELECT password_hash FROM customer_accounts WHERE id = ?
    `).get(req.customer.accountId)
    
    if (!account) {
      return res.status(404).json({
        errCode: 404,
        msg: '客户不存在',
        data: null
      })
    }
    
    // 验证旧密码
    const isValidPassword = await bcrypt.compare(oldPassword, account.password_hash)
    if (!isValidPassword) {
      return res.status(400).json({
        errCode: 400,
        msg: '旧密码错误',
        data: null
      })
    }
    
    // 加密新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10)
    
    // 更新密码
    await db.prepare(`
      UPDATE customer_accounts 
      SET password_hash = ?, password_changed_at = NOW(), updated_at = NOW() 
      WHERE id = ?
    `).run(newPasswordHash, req.customer.accountId)
    
    // 记录活动日志
    await logActivity({
      customerId: req.customer.accountId,
      action: 'change_password',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    })
    
    res.json({
      errCode: 200,
      msg: '密码修改成功',
      data: null
    })
    
  } catch (error) {
    console.error('修改密码失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '服务器错误',
      data: null
    })
  }
})

/**
 * 退出登录
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    // 记录活动日志
    await logActivity({
      customerId: req.customer.accountId,
      action: 'logout',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    })
    
    res.json({
      errCode: 200,
      msg: '退出成功',
      data: null
    })
    
  } catch (error) {
    console.error('退出登录失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '服务器错误',
      data: null
    })
  }
})

export default router
