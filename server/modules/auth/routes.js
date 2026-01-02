/**
 * 客户认证模块路由
 * 方案2：通过 API 调用 ERP 系统进行认证
 * 客户信息缓存到本地 portal_db 的 portal_customers 表
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import axios from 'axios'
import { getDatabase } from '../../config/database.js'
import { generateToken, authenticate, logActivity } from '../../middleware/auth.js'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// ERP API 地址
const ERP_API_URL = process.env.MAIN_API_URL || 'http://localhost:3001'

/**
 * 客户登录
 * POST /api/auth/login
 * 通过 ERP API 验证账户，成功后在本地创建 session
 */
router.post('/login', async (req, res) => {
  try {
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
    
    // 方式1: 首先尝试从本地 portal_customers 验证（离线模式）
    let localCustomer = await db.prepare(`
      SELECT * FROM portal_customers WHERE email = ? OR id = ?
    `).get(loginId.toLowerCase().trim(), loginId.trim())
    
    // 方式2: 调用 ERP API 验证
    try {
      const erpResponse = await axios.post(`${ERP_API_URL}/api/auth/customer/login`, {
        email: loginId,
        password: password
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (erpResponse.data.errCode === 200) {
        const erpCustomer = erpResponse.data.data.customer
        
        // 同步客户信息到本地数据库
        if (localCustomer) {
          // 更新现有记录
          await db.prepare(`
            UPDATE portal_customers 
            SET customer_id = ?,
                company_name = ?,
                contact_name = ?,
                phone = ?,
                status = 'active',
                erp_synced_at = NOW(),
                last_login_at = NOW(),
                login_count = login_count + 1,
                updated_at = NOW()
            WHERE id = ?
          `).run(
            erpCustomer.customerId,
            erpCustomer.companyName,
            erpCustomer.contactPerson,
            erpCustomer.phone,
            localCustomer.id
          )
        } else {
          // 创建新记录
          const newId = erpCustomer.id || uuidv4()
          await db.prepare(`
            INSERT INTO portal_customers 
            (id, customer_id, email, company_name, contact_name, phone, status, erp_synced_at, last_login_at, login_count)
            VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), NOW(), 1)
          `).run(
            newId,
            erpCustomer.customerId,
            erpCustomer.email?.toLowerCase() || loginId.toLowerCase(),
            erpCustomer.companyName,
            erpCustomer.contactPerson,
            erpCustomer.phone
          )
          
          localCustomer = { 
            id: newId, 
            customer_id: erpCustomer.customerId,
            email: erpCustomer.email?.toLowerCase() || loginId.toLowerCase(),
            company_name: erpCustomer.companyName,
            contact_name: erpCustomer.contactPerson,
            phone: erpCustomer.phone
          }
        }
        
        // 生成本地 Token
        const token = generateToken({
          accountId: localCustomer.id,
          customerId: localCustomer.customer_id || erpCustomer.customerId,
          username: erpCustomer.username || loginId,
          email: erpCustomer.email || localCustomer.email,
          companyName: erpCustomer.companyName || localCustomer.company_name
        })
        
        // 创建本地 Session
        const sessionId = uuidv4()
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
        
        await db.prepare(`
          INSERT INTO portal_sessions (id, customer_id, token, ip_address, user_agent, expires_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          sessionId,
          localCustomer.id,
          token,
          req.ip,
          req.get('User-Agent'),
          expiresAt.toISOString()
        )
        
        // 记录活动日志
        await logActivity({
          customerId: localCustomer.id,
          action: 'login',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          details: { method: 'erp_api' }
        })
        
        return res.json({
          errCode: 200,
          msg: '登录成功',
          data: {
            token,
            customer: {
              id: localCustomer.id,
              customerId: localCustomer.customer_id || erpCustomer.customerId,
              username: erpCustomer.username || loginId,
              email: erpCustomer.email || localCustomer.email,
              companyName: erpCustomer.companyName || localCustomer.company_name,
              contactPerson: erpCustomer.contactPerson || localCustomer.contact_name,
              phone: erpCustomer.phone || localCustomer.phone
            }
          }
        })
      }
      
    } catch (erpError) {
      console.error('ERP API 调用失败:', erpError.response?.data || erpError.message)
      
      // ERP 不可用时，尝试本地验证（需要有本地密码）
      if (localCustomer && localCustomer.password_hash) {
        const isValidPassword = await bcrypt.compare(password, localCustomer.password_hash)
        
        if (isValidPassword && localCustomer.status === 'active') {
          // 本地验证成功
          const token = generateToken({
            accountId: localCustomer.id,
            customerId: localCustomer.customer_id,
            username: localCustomer.email,
            email: localCustomer.email,
            companyName: localCustomer.company_name
          })
          
          // 更新登录时间
          await db.prepare(`
            UPDATE portal_customers 
            SET last_login_at = NOW(), login_count = login_count + 1
            WHERE id = ?
          `).run(localCustomer.id)
          
          // 记录活动日志
          await logActivity({
            customerId: localCustomer.id,
            action: 'login',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: { method: 'local_fallback' }
          })
          
          return res.json({
            errCode: 200,
            msg: '登录成功（离线模式）',
            data: {
              token,
              customer: {
                id: localCustomer.id,
                customerId: localCustomer.customer_id,
                username: localCustomer.email,
                email: localCustomer.email,
                companyName: localCustomer.company_name,
                contactPerson: localCustomer.contact_name,
                phone: localCustomer.phone
              }
            }
          })
        }
      }
      
      // ERP 返回的错误信息
      if (erpError.response?.data?.msg) {
        return res.status(401).json({
          errCode: 401,
          msg: erpError.response.data.msg,
          data: null
        })
      }
    }
    
    // 认证失败
    return res.status(401).json({
      errCode: 401,
      msg: '用户名或密码错误',
      data: null
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
      SELECT * FROM portal_customers WHERE id = ?
    `).get(req.customer.accountId)
    
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
        username: customer.email,
        email: customer.email,
        companyName: customer.company_name,
        contactPerson: customer.contact_name,
        phone: customer.phone,
        status: customer.status,
        lastLoginAt: customer.last_login_at,
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
 * 同时更新 ERP 和本地密码
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
    
    // 尝试调用 ERP API 修改密码
    try {
      await axios.post(`${ERP_API_URL}/api/auth/customer/change-password`, {
        oldPassword,
        newPassword
      }, {
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })
    } catch (erpError) {
      // 如果 ERP API 返回错误，传递错误信息
      if (erpError.response?.data?.msg) {
        return res.status(400).json({
          errCode: 400,
          msg: erpError.response.data.msg,
          data: null
        })
      }
      console.warn('ERP 密码修改失败，仅更新本地:', erpError.message)
    }
    
    // 更新本地密码（用于离线登录）
    const db = getDatabase()
    const newPasswordHash = await bcrypt.hash(newPassword, 10)
    
    await db.prepare(`
      UPDATE portal_customers 
      SET password_hash = ?, updated_at = NOW() 
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
    const db = getDatabase()
    
    // 使当前 session 失效
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (token) {
      await db.prepare(`
        UPDATE portal_sessions SET is_active = false WHERE token = ?
      `).run(token)
    }
    
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
      username: req.customer.username,
      email: req.customer.email,
      companyName: req.customer.companyName
    })
    
    // 更新 Session
    const db = getDatabase()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    
    await db.prepare(`
      UPDATE portal_sessions 
      SET token = ?, expires_at = ? 
      WHERE customer_id = ? AND is_active = true
    `).run(token, expiresAt.toISOString(), req.customer.accountId)
    
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
