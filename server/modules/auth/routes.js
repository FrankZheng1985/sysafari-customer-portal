/**
 * 客户认证模块路由
 * 从 ERP 的 customer_accounts 表验证用户（ERP 人工创建的门户账户）
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { generateToken, authenticate } from '../../middleware/auth.js'
import { getDatabase } from '../../config/database.js'

const router = Router()

/**
 * 客户登录
 * POST /api/auth/login
 * 从 ERP 的 customer_accounts 表验证用户
 */
router.post('/login', async (req, res) => {
  console.log('========== 登录请求开始 ==========')
  console.log('请求体:', JSON.stringify(req.body))
  
  try {
    const { email, username, password } = req.body
    const loginId = email || username
    
    console.log('loginId:', loginId)
    console.log('password 长度:', password?.length)
    
    if (!loginId || !password) {
      console.log('错误: 缺少用户名或密码')
      return res.status(400).json({
        errCode: 400,
        msg: '请输入用户名和密码',
        data: null
      })
    }
    
    const db = getDatabase()
    
    // 从 ERP 的 customer_accounts 表查询用户，关联 customers 表获取公司信息
    console.log('查询 ERP customer_accounts 表:', loginId)
    
    const account = await db.prepare(`
      SELECT 
        ca.id,
        ca.customer_id,
        ca.username,
        ca.password_hash,
        ca.email,
        ca.phone,
        ca.status,
        ca.login_attempts,
        ca.locked_until,
        ca.last_login_at,
        c.code AS customer_code,
        c.customer_name,
        c.company_name,
        c.contact_person
      FROM customer_accounts ca
      LEFT JOIN customers c ON ca.customer_id = c.id
      WHERE ca.username = $1 OR ca.email = $1
    `).get(loginId)
    
    if (!account) {
      console.log('用户不存在:', loginId)
      return res.status(401).json({
        errCode: 401,
        msg: '用户名或密码错误',
        data: null
      })
    }
    
    console.log('找到用户:', account.username)
    
    // 检查账户是否被锁定
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      console.log('账户被锁定至:', account.locked_until)
      return res.status(401).json({
        errCode: 401,
        msg: '账户已被锁定，请稍后再试',
        data: null
      })
    }
    
    // 检查用户状态
    if (account.status !== 'active') {
      console.log('用户状态异常:', account.status)
      return res.status(401).json({
        errCode: 401,
        msg: '账户已被禁用，请联系管理员',
        data: null
      })
    }
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, account.password_hash)
    if (!isValidPassword) {
      console.log('密码验证失败')
      
      // 增加登录失败次数
      const newAttempts = (account.login_attempts || 0) + 1
      let lockUntil = null
      
      // 连续失败5次，锁定30分钟
      if (newAttempts >= 5) {
        lockUntil = new Date(Date.now() + 30 * 60 * 1000) // 30分钟后
        await db.prepare(`
          UPDATE customer_accounts 
          SET login_attempts = $1, locked_until = $2, updated_at = NOW()
          WHERE id = $3
        `).run(newAttempts, lockUntil, account.id)
      } else {
        await db.prepare(`
          UPDATE customer_accounts 
          SET login_attempts = $1, updated_at = NOW()
          WHERE id = $2
        `).run(newAttempts, account.id)
      }
      
      return res.status(401).json({
        errCode: 401,
        msg: '用户名或密码错误',
        data: null
      })
    }
    
    console.log('密码验证成功')
    
    // 登录成功，重置登录失败次数，更新登录信息
    await db.prepare(`
      UPDATE customer_accounts 
      SET login_attempts = 0, 
          locked_until = NULL, 
          last_login_at = NOW(),
          last_login_ip = $1,
          updated_at = NOW()
      WHERE id = $2
    `).run(req.ip || req.connection?.remoteAddress || null, account.id)
    
    // 获取客户代码
    const customerCode = account.customer_code || account.customer_id
    const companyName = account.company_name || account.customer_name || ''
    const contactName = account.contact_person || account.username
    
    console.log('使用客户代码:', customerCode)
    
    // 生成 Token
    const token = generateToken({
      accountId: account.id,
      customerId: account.customer_id,
      customerCode: customerCode,
      username: account.username,
      email: account.email,
      companyName: companyName,
      contactPerson: contactName,
      phone: account.phone
    })
    
    console.log('登录成功，返回响应')
    return res.json({
      errCode: 200,
      msg: '登录成功',
      data: {
        token: token,
        customer: {
          id: account.id,
          customerId: account.customer_id,
          customerCode: customerCode,
          username: account.username,
          email: account.email,
          companyName: companyName,
          contactPerson: contactName,
          phone: account.phone
        }
      }
    })
    
  } catch (error) {
    console.error('登录处理异常:', error)
    res.status(500).json({
      errCode: 500,
      msg: '服务器错误: ' + error.message,
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
    
    // 从 customer_accounts 表获取最新的客户信息
    const account = await db.prepare(`
      SELECT 
        ca.id,
        ca.customer_id,
        ca.username,
        ca.email,
        ca.phone,
        ca.status,
        c.code AS customer_code,
        c.customer_name,
        c.company_name,
        c.contact_person
      FROM customer_accounts ca
      LEFT JOIN customers c ON ca.customer_id = c.id
      WHERE ca.id = $1
    `).get(req.customer.accountId)
    
    if (!account) {
      return res.status(401).json({
        errCode: 401,
        msg: '用户不存在',
        data: null
      })
    }
    
    const customerCode = account.customer_code || account.customer_id
    const companyName = account.company_name || account.customer_name || ''
    const contactName = account.contact_person || account.username
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: account.id,
        customerId: account.customer_id,
        customerCode: customerCode,
        username: account.username,
        email: account.email,
        companyName: companyName,
        contactPerson: contactName,
        phone: account.phone,
        status: account.status
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
    const account = await db.prepare(`
      SELECT id, password_hash FROM customer_accounts WHERE id = $1
    `).get(req.customer.accountId)
    
    if (!account) {
      return res.status(404).json({
        errCode: 404,
        msg: '用户不存在',
        data: null
      })
    }
    
    // 验证旧密码
    const isValidOldPassword = await bcrypt.compare(oldPassword, account.password_hash)
    if (!isValidOldPassword) {
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
      SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `).run(newPasswordHash, account.id)
    
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

/**
 * 刷新 Token
 * POST /api/auth/refresh
 */
router.post('/refresh', authenticate, async (req, res) => {
  try {
    // 生成新 Token
    const token = generateToken({
      accountId: req.customer.accountId,
      customerId: req.customer.customerId,
      customerCode: req.customer.customerCode,
      username: req.customer.username,
      email: req.customer.email,
      companyName: req.customer.companyName,
      phone: req.customer.phone
    })
    
    res.json({
      errCode: 200,
      msg: 'Token 刷新成功',
      data: { token }
    })
    
  } catch (error) {
    console.error('刷新 Token 失败:', error)
    res.status(500).json({
      errCode: 500,
      msg: '服务器错误',
      data: null
    })
  }
})

export default router
