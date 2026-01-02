/**
 * 客户认证模块路由
 * 方案2：通过 API 调用 ERP 系统进行认证
 * 客户信息缓存到本地 portal_db 的 portal_customers 表
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import axios from 'axios'
import { generateToken, authenticate } from '../../middleware/auth.js'

const router = Router()

// ERP API 地址
const ERP_API_URL = process.env.MAIN_API_URL || 'http://localhost:3001'

/**
 * 客户登录
 * POST /api/auth/login
 * 通过 ERP API 验证账户，成功后在本地创建 session
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
    
    // 调用 ERP API 验证
    console.log('准备调用 ERP API:', `${ERP_API_URL}/api/portal/auth/login`)
    console.log('发送数据:', { username: loginId, password: '***' })
    
    try {
      const erpResponse = await axios.post(`${ERP_API_URL}/api/portal/auth/login`, {
        username: loginId,
        password: password
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      console.log('ERP 响应状态:', erpResponse.status)
      console.log('ERP 响应数据:', JSON.stringify(erpResponse.data))
      
      if (erpResponse.data.errCode === 200) {
        // ERP 返回的是 data.user 和 data.token
        const erpUser = erpResponse.data.data.user
        console.log('ERP 用户信息:', JSON.stringify(erpUser))
        
        // 生成 Portal 自己的 Token，包含所有必要的客户信息
        const portalToken = generateToken({
          accountId: erpUser.id,
          customerId: erpUser.customerId,
          username: erpUser.username,
          email: erpUser.email || loginId,
          companyName: erpUser.customerName,
          contactPerson: erpUser.username,
          phone: erpUser.phone
        })
        
        console.log('已生成 Portal Token')
        console.log('登录成功，返回响应')
        return res.json({
          errCode: 200,
          msg: '登录成功',
          data: {
            token: portalToken,  // 使用 Portal 自己的 Token
            customer: {
              id: erpUser.id,
              customerId: erpUser.customerId,
              username: erpUser.username,
              email: erpUser.email || loginId,
              companyName: erpUser.customerName,
              contactPerson: erpUser.username,
              phone: erpUser.phone
            }
          }
        })
      } else {
        console.log('ERP 返回非 200 errCode:', erpResponse.data.errCode)
        return res.status(401).json({
          errCode: 401,
          msg: erpResponse.data.msg || '登录失败',
          data: null
        })
      }
      
    } catch (erpError) {
      console.error('ERP API 调用失败')
      console.error('错误类型:', erpError.name)
      console.error('错误消息:', erpError.message)
      if (erpError.response) {
        console.error('ERP 响应状态:', erpError.response.status)
        console.error('ERP 响应数据:', JSON.stringify(erpError.response.data))
      }
      
      // ERP 返回的错误信息
      if (erpError.response?.data?.msg) {
        return res.status(401).json({
          errCode: 401,
          msg: erpError.response.data.msg,
          data: null
        })
      }
      
      // 网络错误等
      return res.status(500).json({
        errCode: 500,
        msg: 'ERP 系统连接失败，请稍后重试',
        data: null
      })
    }
    
  } catch (error) {
    console.error('登录处理异常:', error)
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
    // 直接从 token 返回信息
    res.json({
      errCode: 200,
      msg: 'success',
      data: {
        id: req.customer.accountId,
        customerId: req.customer.customerId,
        username: req.customer.username,
        email: req.customer.email,
        companyName: req.customer.companyName,
        contactPerson: req.customer.username,
        phone: null,
        status: 'active'
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
    
    // 调用 ERP API 修改密码
    try {
      await axios.post(`${ERP_API_URL}/api/portal/auth/change-password`, {
        oldPassword,
        newPassword
      }, {
        headers: {
          'Authorization': req.headers.authorization,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      })
      
      res.json({
        errCode: 200,
        msg: '密码修改成功',
        data: null
      })
      
    } catch (erpError) {
      if (erpError.response?.data?.msg) {
        return res.status(400).json({
          errCode: 400,
          msg: erpError.response.data.msg,
          data: null
        })
      }
      throw erpError
    }
    
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
      username: req.customer.username,
      email: req.customer.email,
      companyName: req.customer.companyName
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
