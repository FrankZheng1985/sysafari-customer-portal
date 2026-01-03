/**
 * 客户认证模块路由
 * 直接从本地 portal_db 数据库验证用户
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { generateToken, authenticate } from '../../middleware/auth.js'
import { getDatabase } from '../../config/database.js'

const router = Router()

/**
 * 从 ERP 获取真正的客户代码
 * @param {Object} db - 数据库实例
 * @param {string} customerId - 客户 UUID
 * @returns {string|null} 客户代码
 */
async function getCustomerCodeFromERP(db, customerId) {
  try {
    // 首先尝试从 ERP 的 customers 表获取客户代码
    const erpCustomer = await db.prepare(`
      SELECT code FROM customers WHERE id = $1
    `).get(customerId)
    
    if (erpCustomer?.code) {
      return erpCustomer.code
    }
    
    // 如果 customers 表没有，尝试从 bills_of_lading 表获取
    const order = await db.prepare(`
      SELECT customer_code FROM bills_of_lading 
      WHERE customer_id = $1 AND customer_code IS NOT NULL AND customer_code != ''
      LIMIT 1
    `).get(customerId)
    
    return order?.customer_code || null
  } catch (error) {
    console.error('从 ERP 获取客户代码失败:', error.message)
    return null
  }
}

/**
 * 客户登录
 * POST /api/auth/login
 * 直接从本地 portal_customers 表验证用户
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
        msg: '请输入用户名/邮箱和密码',
        data: null
      })
    }
    
    // 从本地数据库查询用户
    const db = getDatabase()
    console.log('查询本地数据库用户:', loginId)
    
    const customer = await db.prepare(`
      SELECT id, customer_id, customer_code, email, password_hash, company_name, contact_name, phone, status
      FROM portal_customers
      WHERE email = $1 OR customer_id = $1
    `).get(loginId)
    
    if (!customer) {
      console.log('用户不存在:', loginId)
      return res.status(401).json({
        errCode: 401,
        msg: '用户名或密码错误',
        data: null
      })
    }
    
    console.log('找到用户:', customer.email)
    
    // 检查用户状态
    if (customer.status !== 'active') {
      console.log('用户状态异常:', customer.status)
      return res.status(401).json({
        errCode: 401,
        msg: '账户已被禁用，请联系管理员',
        data: null
      })
    }
    
    // 验证密码
    const isValidPassword = await bcrypt.compare(password, customer.password_hash)
    if (!isValidPassword) {
      console.log('密码验证失败')
      return res.status(401).json({
        errCode: 401,
        msg: '用户名或密码错误',
        data: null
      })
    }
    
    console.log('密码验证成功')
    
    // 获取真正的客户代码
    let customerCode = customer.customer_code
    if (!customerCode) {
      // 如果本地没有存储客户代码，从 ERP 获取
      customerCode = await getCustomerCodeFromERP(db, customer.customer_id)
      
      // 如果获取到了客户代码，更新到本地表
      if (customerCode) {
        await db.prepare(`
          UPDATE portal_customers SET customer_code = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `).run(customerCode, customer.id)
        console.log('已更新客户代码到本地:', customerCode)
      }
    }
    
    // 如果仍然没有客户代码，使用 customer_id 的简短形式作为显示
    const displayCustomerCode = customerCode || customer.customer_id
    console.log('使用客户代码:', displayCustomerCode)
    
    // 更新登录信息
    await db.prepare(`
      UPDATE portal_customers 
      SET last_login_at = CURRENT_TIMESTAMP, login_count = login_count + 1
      WHERE id = $1
    `).run(customer.id)
    
    // 生成 Token
    const token = generateToken({
      accountId: customer.id,
      customerId: customer.customer_id,
      customerCode: displayCustomerCode,
      username: customer.contact_name || customer.email,
      email: customer.email,
      companyName: customer.company_name,
      contactPerson: customer.contact_name,
      phone: customer.phone
    })
    
    console.log('登录成功，返回响应')
    return res.json({
      errCode: 200,
      msg: '登录成功',
      data: {
        token: token,
        customer: {
          id: customer.id,
          customerId: customer.customer_id,
          customerCode: displayCustomerCode,
          username: customer.contact_name || customer.email,
          email: customer.email,
          companyName: customer.company_name,
          contactPerson: customer.contact_name,
          phone: customer.phone
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
    
    // 从数据库获取最新的客户信息
    const customer = await db.prepare(`
      SELECT id, customer_id, customer_code, email, company_name, contact_name, phone, status
      FROM portal_customers
      WHERE id = $1
    `).get(req.customer.accountId)
    
    if (!customer) {
      return res.status(401).json({
        errCode: 401,
        msg: '用户不存在',
        data: null
      })
    }
    
    // 获取真正的客户代码
    let customerCode = customer.customer_code
    if (!customerCode) {
      // 如果本地没有存储客户代码，从 ERP 获取
      customerCode = await getCustomerCodeFromERP(db, customer.customer_id)
      
      // 如果获取到了客户代码，更新到本地表
      if (customerCode) {
        await db.prepare(`
          UPDATE portal_customers SET customer_code = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
        `).run(customerCode, customer.id)
      }
    }
    
    // 如果仍然没有客户代码，使用 customer_id
    const displayCustomerCode = customerCode || customer.customer_id
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: customer.id,
        customerId: customer.customer_id,
        customerCode: displayCustomerCode,
        username: customer.contact_name || customer.email,
        email: customer.email,
        companyName: customer.company_name,
        contactPerson: customer.contact_name,
        phone: customer.phone,
        status: customer.status
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
    
    // 从本地数据库验证旧密码并更新
    const db = getDatabase()
    const customer = await db.prepare(`
      SELECT id, password_hash FROM portal_customers WHERE id = $1
    `).get(req.customer.accountId)
    
    if (!customer) {
      return res.status(404).json({
        errCode: 404,
        msg: '用户不存在',
        data: null
      })
    }
    
    // 验证旧密码
    const isValidOldPassword = await bcrypt.compare(oldPassword, customer.password_hash)
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
      UPDATE portal_customers SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
    `).run(newPasswordHash, customer.id)
    
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
    // 生成新 Token，包含 customerCode
    const token = generateToken({
      accountId: req.customer.accountId,
      customerId: req.customer.customerId,
      customerCode: req.customer.customerCode,  // 添加客户代码
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
