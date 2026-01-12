/**
 * 客户认证模块路由
 * 支持主账户（customer_accounts）和子账户（portal_users）登录
 */

import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { generateToken, authenticate, getUserPermissions } from '../../middleware/auth.js'
import { getDatabase } from '../../config/database.js'

const router = Router()

/**
 * 客户登录
 * POST /api/auth/login
 * 优先从 portal_users 验证，再从 customer_accounts 验证
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
    
    // 首先尝试从子账户表 portal_users 查找
    console.log('查询 portal_users 表:', loginId)
    
    const subUser = await db.prepare(`
      SELECT 
        pu.id,
        pu.parent_account_id,
        pu.customer_id,
        pu.username,
        pu.email,
        pu.password_hash,
        pu.display_name,
        pu.phone,
        pu.role_id,
        pr.name as role_name,
        pu.status,
        pu.login_attempts,
        pu.locked_until,
        pu.last_login_at,
        c.customer_code,
        c.customer_name,
        c.company_name
      FROM portal_users pu
      LEFT JOIN portal_roles pr ON pu.role_id = pr.id
      LEFT JOIN customers c ON pu.customer_id = c.id::text
      WHERE (pu.username = $1 OR pu.email = $1) AND pu.status != $2
    `).get(loginId, 'deleted')
    
    // 如果找到子账户，验证子账户登录
    if (subUser) {
      console.log('找到子账户:', subUser.username)
      return await handleSubUserLogin(db, subUser, password, req, res)
    }
    
    // 否则从主账户表 customer_accounts 查询
    console.log('查询主账户 customer_accounts 表:', loginId)
    
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
        c.customer_code,
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
    
    console.log('找到主账户:', account.username)
    return await handleMasterAccountLogin(db, account, password, req, res)
    
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
 * 处理子账户登录
 */
async function handleSubUserLogin(db, subUser, password, req, res) {
  // 检查账户是否被锁定
  if (subUser.locked_until && new Date(subUser.locked_until) > new Date()) {
    console.log('账户被锁定至:', subUser.locked_until)
    return res.status(401).json({
      errCode: 401,
      msg: '账户已被锁定，请稍后再试',
      data: null
    })
  }
  
  // 检查用户状态
  if (subUser.status !== 'active') {
    console.log('用户状态异常:', subUser.status)
    return res.status(401).json({
      errCode: 401,
      msg: '账户已被禁用，请联系管理员',
      data: null
    })
  }
  
  // 验证密码
  const isValidPassword = await bcrypt.compare(password, subUser.password_hash)
  if (!isValidPassword) {
    console.log('密码验证失败')
    
    // 增加登录失败次数
    const newAttempts = (subUser.login_attempts || 0) + 1
    let lockUntil = null
    
    if (newAttempts >= 5) {
      lockUntil = new Date(Date.now() + 30 * 60 * 1000)
      await db.prepare(`
        UPDATE portal_users 
        SET login_attempts = $1, locked_until = $2, updated_at = NOW()
        WHERE id = $3
      `).run(newAttempts, lockUntil, subUser.id)
    } else {
      await db.prepare(`
        UPDATE portal_users 
        SET login_attempts = $1, updated_at = NOW()
        WHERE id = $2
      `).run(newAttempts, subUser.id)
    }
    
    return res.status(401).json({
      errCode: 401,
      msg: '用户名或密码错误',
      data: null
    })
  }
  
  console.log('密码验证成功')
  
  // 登录成功，更新登录信息
  await db.prepare(`
    UPDATE portal_users 
    SET login_attempts = 0, 
        locked_until = NULL, 
        last_login_at = NOW(),
        last_login_ip = $1,
        updated_at = NOW()
    WHERE id = $2
  `).run(req.ip || req.connection?.remoteAddress || null, subUser.id)
  
  // 获取用户权限
  const permissions = await getUserPermissions(subUser.role_id)
  
  // 获取 customerCode，优先从 customers 表，否则从 portal_customers 表
  let customerCode = subUser.customer_code
  let companyName = subUser.company_name || subUser.customer_name || ''
  
  // 如果 customers 表中没有 customer_code，尝试从 portal_customers 表获取
  if (!customerCode) {
    try {
      // 尝试用 customer_id 查询 portal_customers
      let portalCustomer = await db.prepare(`
        SELECT customer_code, company_name
        FROM portal_customers 
        WHERE customer_id = $1
      `).get(subUser.customer_id)
      
      if (portalCustomer) {
        customerCode = portalCustomer.customer_code
        companyName = portalCustomer.company_name || companyName
        console.log('✅ 子账户登录时从 portal_customers 获取到 customer_code:', customerCode)
      }
    } catch (err) {
      console.log('⚠️ 子账户登录时查询 portal_customers 失败:', err.message)
    }
  }
  
  // 最终回退到 customer_id
  customerCode = customerCode || subUser.customer_id
  
  // 生成 Token（子账户）
  const token = generateToken({
    accountId: subUser.parent_account_id,
    userId: subUser.id,
    customerId: subUser.customer_id,
    customerCode: customerCode,
    username: subUser.username,
    email: subUser.email,
    companyName: companyName,
    contactPerson: subUser.display_name || subUser.username,
    phone: subUser.phone,
    userType: 'sub',  // 子账户
    roleId: subUser.role_id,
    roleName: subUser.role_name,
    permissions: permissions
  })
  
  console.log('子账户登录成功，返回响应')
  return res.json({
    errCode: 200,
    msg: '登录成功',
    data: {
      token: token,
      customer: {
        id: subUser.id,
        customerId: subUser.customer_id,
        customerCode: customerCode,
        username: subUser.username,
        displayName: subUser.display_name,
        email: subUser.email,
        companyName: companyName,
        contactPerson: subUser.display_name || subUser.username,
        phone: subUser.phone,
        userType: 'sub',
        roleId: subUser.role_id,
        roleName: subUser.role_name,
        permissions: permissions
      }
    }
  })
}

/**
 * 处理主账户登录
 */
async function handleMasterAccountLogin(db, account, password, req, res) {
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
    
    const newAttempts = (account.login_attempts || 0) + 1
    let lockUntil = null
    
    if (newAttempts >= 5) {
      lockUntil = new Date(Date.now() + 30 * 60 * 1000)
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
  
  // 登录成功，更新登录信息
  await db.prepare(`
    UPDATE customer_accounts 
    SET login_attempts = 0, 
        locked_until = NULL, 
        last_login_at = NOW(),
        last_login_ip = $1,
        updated_at = NOW()
    WHERE id = $2
  `).run(req.ip || req.connection?.remoteAddress || null, account.id)
  
  // 获取 customerCode，优先从 customers 表，否则从 portal_customers 表
  let customerCode = account.customer_code
  let companyName = account.company_name || account.customer_name || ''
  const contactName = account.contact_person || account.username
  
  // 如果 customers 表中没有 customer_code，尝试从 portal_customers 表获取
  if (!customerCode) {
    try {
      // 尝试用 customer_id 查询 portal_customers
      let portalCustomer = await db.prepare(`
        SELECT customer_code, company_name
        FROM portal_customers 
        WHERE customer_id::text = $1
      `).get(String(account.customer_id))
      
      // 如果没找到，用邮箱匹配
      if (!portalCustomer && account.email) {
        portalCustomer = await db.prepare(`
          SELECT customer_code, company_name
          FROM portal_customers 
          WHERE email = $1
        `).get(account.email)
      }
      
      // 如果没找到，用用户名匹配
      if (!portalCustomer && account.username) {
        portalCustomer = await db.prepare(`
          SELECT customer_code, company_name
          FROM portal_customers 
          WHERE email = $1 OR contact_name = $1
        `).get(account.username)
      }
      
      if (portalCustomer) {
        customerCode = portalCustomer.customer_code
        companyName = portalCustomer.company_name || companyName
        console.log('✅ 登录时从 portal_customers 获取到 customer_code:', customerCode)
      }
    } catch (err) {
      console.log('⚠️ 登录时查询 portal_customers 失败:', err.message)
    }
  }
  
  // 最终回退到 customer_id
  customerCode = customerCode || account.customer_id
  
  // 生成 Token（主账户拥有所有权限）
  const token = generateToken({
    accountId: account.id,
    userId: account.id,
    customerId: account.customer_id,
    customerCode: customerCode,
    username: account.username,
    email: account.email,
    companyName: companyName,
    contactPerson: contactName,
    phone: account.phone,
    userType: 'master',  // 主账户
    roleId: null,
    roleName: '管理员',
    permissions: []  // 主账户不需要权限列表，默认拥有所有权限
  })
  
  console.log('主账户登录成功，返回响应')
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
        phone: account.phone,
        userType: 'master',
        roleId: null,
        roleName: '管理员',
        permissions: []
      }
    }
  })
}

/**
 * 获取当前客户信息
 * GET /api/auth/me
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const db = getDatabase()
    const { userType, userId, accountId, customerId, staffProxy, customerName, username, staffName } = req.customer
    
    let userData
    
    // 工作人员代登录：从 portal_customers 表查询客户信息
    if (staffProxy) {
      console.log('📝 工作人员代登录验证成功:', { staffName, customerId, username, customerName })
      
      // 尝试从 portal_customers 表获取正确的 customer_code
      let customerCode = req.customer.customerCode || customerId
      let companyName = customerName || ''
      let email = req.customer.email || ''
      let phone = req.customer.phone || ''
      
      try {
        // 方案1: 根据 customer_id 查询 portal_customers 表
        let portalCustomer = await db.prepare(`
          SELECT customer_code, company_name, email, phone, contact_name
          FROM portal_customers 
          WHERE customer_id = $1
        `).get(customerId)
        
        // 方案2: 如果 customer_id 没找到，尝试用公司名模糊匹配
        if (!portalCustomer && customerName) {
          console.log('📝 尝试用公司名匹配:', customerName)
          portalCustomer = await db.prepare(`
            SELECT customer_code, company_name, email, phone, contact_name
            FROM portal_customers 
            WHERE company_name LIKE $1 OR contact_name LIKE $1
            LIMIT 1
          `).get(`%${customerName}%`)
        }
        
        // 方案3: 如果还没找到，尝试用用户名/邮箱匹配
        if (!portalCustomer && username) {
          console.log('📝 尝试用用户名匹配:', username)
          portalCustomer = await db.prepare(`
            SELECT customer_code, company_name, email, phone, contact_name
            FROM portal_customers 
            WHERE email = $1 OR contact_name = $1
            LIMIT 1
          `).get(username)
        }
        
        if (portalCustomer) {
          customerCode = portalCustomer.customer_code || customerCode
          companyName = portalCustomer.company_name || companyName
          email = portalCustomer.email || email
          phone = portalCustomer.phone || phone
          console.log('✅ 从 portal_customers 获取到客户编码:', customerCode)
        } else {
          console.log('⚠️ portal_customers 中未找到匹配的客户记录')
        }
      } catch (err) {
        console.log('⚠️ 查询 portal_customers 失败:', err.message)
      }
      
      userData = {
        id: accountId,
        customerId: customerId,
        customerCode: customerCode,
        username: username,
        displayName: customerName || username,
        email: email,
        companyName: companyName,
        contactPerson: customerName || username,
        phone: phone,
        status: 'active',
        userType: 'master',
        roleId: null,
        roleName: '管理员',
        permissions: [],
        // 代登录标记
        staffProxy: true,
        staffName: staffName
      }
      
      return res.json({
        errCode: 200,
        msg: 'success',
        data: userData
      })
    }
    
    if (userType === 'sub') {
      // 子账户
      const user = await db.prepare(`
        SELECT 
          pu.id,
          pu.customer_id,
          pu.username,
          pu.email,
          pu.display_name,
          pu.phone,
          pu.role_id,
          pr.name as role_name,
          pu.status,
          c.customer_code,
          c.customer_name,
          c.company_name
        FROM portal_users pu
        LEFT JOIN portal_roles pr ON pu.role_id = pr.id
        LEFT JOIN customers c ON pu.customer_id = c.id::text
        WHERE pu.id = $1
      `).get(userId)
      
      if (!user) {
        return res.status(401).json({
          errCode: 401,
          msg: '用户不存在',
          data: null
        })
      }
      
      const permissions = await getUserPermissions(user.role_id)
      
      userData = {
        id: user.id,
        customerId: user.customer_id,
        customerCode: user.customer_code || user.customer_id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        companyName: user.company_name || user.customer_name || '',
        contactPerson: user.display_name || user.username,
        phone: user.phone,
        status: user.status,
        userType: 'sub',
        roleId: user.role_id,
        roleName: user.role_name,
        permissions: permissions
      }
    } else {
      // 主账户
      const account = await db.prepare(`
        SELECT 
          ca.id,
          ca.customer_id,
          ca.username,
          ca.email,
          ca.phone,
          ca.status,
          c.customer_code,
          c.customer_name,
          c.company_name,
          c.contact_person
        FROM customer_accounts ca
        LEFT JOIN customers c ON ca.customer_id = c.id
        WHERE ca.id = $1
      `).get(accountId)
      
      if (!account) {
        return res.status(401).json({
          errCode: 401,
          msg: '用户不存在',
          data: null
        })
      }
      
      // 如果 customers 表中没有 customer_code，尝试从 portal_customers 表获取
      let customerCode = account.customer_code
      let companyName = account.company_name || account.customer_name || ''
      
      if (!customerCode) {
        try {
          // 尝试用 customer_id 查询 portal_customers
          let portalCustomer = await db.prepare(`
            SELECT customer_code, company_name
            FROM portal_customers 
            WHERE customer_id::text = $1
          `).get(String(account.customer_id))
          
          // 如果没找到，用邮箱匹配
          if (!portalCustomer && account.email) {
            portalCustomer = await db.prepare(`
              SELECT customer_code, company_name
              FROM portal_customers 
              WHERE email = $1
            `).get(account.email)
          }
          
          // 如果没找到，用用户名匹配
          if (!portalCustomer && account.username) {
            portalCustomer = await db.prepare(`
              SELECT customer_code, company_name
              FROM portal_customers 
              WHERE email = $1 OR contact_name = $1
            `).get(account.username)
          }
          
          if (portalCustomer) {
            customerCode = portalCustomer.customer_code
            companyName = portalCustomer.company_name || companyName
            console.log('✅ 从 portal_customers 补充获取到 customer_code:', customerCode)
          }
        } catch (err) {
          console.log('⚠️ 查询 portal_customers 失败:', err.message)
        }
      }
      
      userData = {
        id: account.id,
        customerId: account.customer_id,
        customerCode: customerCode || account.customer_id,
        username: account.username,
        displayName: account.contact_person || account.username,
        email: account.email,
        companyName: companyName,
        contactPerson: account.contact_person || account.username,
        phone: account.phone,
        status: account.status,
        userType: 'master',
        roleId: null,
        roleName: '管理员',
        permissions: []
      }
    }
    
    res.json({
      errCode: 200,
      msg: 'success',
      data: userData
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
    const { userType, userId, accountId } = req.customer
    
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
    let account
    let tableName
    let idField
    let targetId
    
    if (userType === 'sub') {
      // 子账户
      account = await db.prepare(`
        SELECT id, password_hash FROM portal_users WHERE id = $1
      `).get(userId)
      tableName = 'portal_users'
      idField = 'id'
      targetId = userId
    } else {
      // 主账户
      account = await db.prepare(`
        SELECT id, password_hash FROM customer_accounts WHERE id = $1
      `).get(accountId)
      tableName = 'customer_accounts'
      idField = 'id'
      targetId = accountId
    }
    
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
      UPDATE ${tableName} 
      SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW()
      WHERE ${idField} = $2
    `).run(newPasswordHash, targetId)
    
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
    const { userType, userId, accountId, customerId, customerCode, username, email, 
            companyName, contactPerson, phone, roleId, roleName, permissions } = req.customer
    
    // 生成新 Token
    const token = generateToken({
      accountId: accountId,
      userId: userId,
      customerId: customerId,
      customerCode: customerCode,
      username: username,
      email: email,
      companyName: companyName,
      contactPerson: contactPerson,
      phone: phone,
      userType: userType,
      roleId: roleId,
      roleName: roleName,
      permissions: permissions
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
