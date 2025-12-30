/**
 * 客户认证模块路由
 * 处理客户登录、注册、修改密码等
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDatabase } from '../../config/database.js'
import { generateToken, authenticate, logActivity } from '../../middleware/auth.js'

const router = Router()

/**
 * 客户登录
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({
        errCode: 400,
        msg: '请输入邮箱和密码',
        data: null
      })
    }
    
    const db = getDatabase()
    
    // 查询客户
    const customer = await db.prepare(`
      SELECT id, customer_id, email, password_hash, company_name, contact_name, phone, status
      FROM portal_customers
      WHERE email = $1
    `).get(email.toLowerCase().trim())
    
    if (!customer) {
      return res.status(401).json({
        errCode: 401,
        msg: '邮箱或密码错误',
        data: null
      })
    }
    
    // 检查账户状态
    if (customer.status !== 'active') {
      return res.status(401).json({
        errCode: 401,
        msg: '账户已被禁用，请联系客服',
        data: null
      })
    }
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, customer.password_hash)
    if (!isValidPassword) {
      return res.status(401).json({
        errCode: 401,
        msg: '邮箱或密码错误',
        data: null
      })
    }
    
    // 生成 Token
    const token = generateToken({
      customerId: customer.id,
      email: customer.email,
      companyName: customer.company_name
    })
    
    // 更新登录信息
    await db.prepare(`
      UPDATE portal_customers 
      SET last_login_at = NOW(), login_count = login_count + 1
      WHERE id = $1
    `).run(customer.id)
    
    // 记录活动日志
    await logActivity({
      customerId: customer.id,
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
          id: customer.id,
          customerId: customer.customer_id,
          email: customer.email,
          companyName: customer.company_name,
          contactName: customer.contact_name,
          phone: customer.phone
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
    
    const customer = await db.prepare(`
      SELECT id, customer_id, email, company_name, contact_name, phone, status, 
             last_login_at, login_count, created_at
      FROM portal_customers
      WHERE id = $1
    `).get(req.customer.id)
    
    if (!customer) {
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
        id: customer.id,
        customerId: customer.customer_id,
        email: customer.email,
        companyName: customer.company_name,
        contactName: customer.contact_name,
        phone: customer.phone,
        status: customer.status,
        lastLoginAt: customer.last_login_at,
        loginCount: customer.login_count,
        createdAt: customer.created_at
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
    const customer = await db.prepare(`
      SELECT password_hash FROM portal_customers WHERE id = $1
    `).get(req.customer.id)
    
    if (!customer) {
      return res.status(404).json({
        errCode: 404,
        msg: '客户不存在',
        data: null
      })
    }
    
    // 验证旧密码
    const isValidPassword = await bcrypt.compare(oldPassword, customer.password_hash)
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
      UPDATE portal_customers SET password_hash = $1, updated_at = NOW() WHERE id = $2
    `).run(newPasswordHash, req.customer.id)
    
    // 记录活动日志
    await logActivity({
      customerId: req.customer.id,
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
      customerId: req.customer.id,
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

