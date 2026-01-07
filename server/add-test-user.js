/**
 * 添加测试管理员账户
 * 用户名: admin
 * 密码: admin123
 * 
 * 运行: node add-test-user.js
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '.env') })

const DATABASE_URL = process.env.DATABASE_URL

console.log('=== 添加测试管理员账户 ===\n')

async function addTestUser() {
  if (!DATABASE_URL) {
    console.error('❌ 未找到 DATABASE_URL 环境变量')
    console.log('   请在 server/.env 文件中配置数据库连接')
    process.exit(1)
  }
  
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') 
      ? false 
      : { rejectUnauthorized: false }
  })
  
  try {
    const username = 'admin'
    const password = 'admin123'
    const email = 'admin@test.com'
    
    // 生成 bcrypt 密码哈希
    const passwordHash = bcrypt.hashSync(password, 10)
    console.log('1. 生成密码哈希:', passwordHash)
    
    // 先检查 portal_users 表是否存在此用户
    console.log('\n2. 检查 portal_users 表...')
    const existingPortalUser = await pool.query(
      'SELECT id FROM portal_users WHERE username = $1 OR email = $2',
      [username, email]
    )
    
    if (existingPortalUser.rows.length > 0) {
      // 更新密码
      await pool.query(
        'UPDATE portal_users SET password_hash = $1, status = $2, updated_at = NOW() WHERE username = $3 OR email = $4',
        [passwordHash, 'active', username, email]
      )
      console.log('   ✅ portal_users 中已存在用户，已更新密码')
    }
    
    // 检查 customer_accounts 表
    console.log('\n3. 检查 customer_accounts 表...')
    try {
      const existingAccount = await pool.query(
        'SELECT id FROM customer_accounts WHERE username = $1 OR email = $2',
        [username, email]
      )
      
      if (existingAccount.rows.length > 0) {
        // 更新密码
        await pool.query(
          'UPDATE customer_accounts SET password_hash = $1, status = $2, updated_at = NOW() WHERE username = $3 OR email = $4',
          [passwordHash, 'active', username, email]
        )
        console.log('   ✅ customer_accounts 中已存在用户，已更新密码')
      } else {
        // 先查询一个可用的 customer_id
        const customerResult = await pool.query('SELECT id FROM customers LIMIT 1')
        const customerId = customerResult.rows[0]?.id || 1
        
        // 插入新用户到 customer_accounts
        await pool.query(`
          INSERT INTO customer_accounts (customer_id, username, email, password_hash, phone, status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = EXCLUDED.status, updated_at = NOW()
        `, [customerId, username, email, passwordHash, '+86 13800000000', 'active'])
        console.log('   ✅ 已在 customer_accounts 中创建测试用户 (customer_id=' + customerId + ')')
      }
    } catch (err) {
      if (err.message.includes('does not exist')) {
        console.log('   ⚠️ customer_accounts 表不存在，尝试创建...')
        // 创建 customer_accounts 表
        await pool.query(`
          CREATE TABLE IF NOT EXISTS customer_accounts (
            id SERIAL PRIMARY KEY,
            customer_id VARCHAR(50),
            username VARCHAR(100) UNIQUE NOT NULL,
            email VARCHAR(255),
            password_hash VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            status VARCHAR(20) DEFAULT 'active',
            login_attempts INTEGER DEFAULT 0,
            locked_until TIMESTAMP,
            last_login_at TIMESTAMP,
            last_login_ip VARCHAR(50),
            password_changed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `)
        
        // 插入测试用户
        await pool.query(`
          INSERT INTO customer_accounts (customer_id, username, email, password_hash, phone, status)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, ['ADMIN-TEST', username, email, passwordHash, '+86 13800000000', 'active'])
        console.log('   ✅ 已创建 customer_accounts 表并添加测试用户')
      } else {
        throw err
      }
    }
    
    // 检查 portal_customers 表
    console.log('\n4. 检查 portal_customers 表...')
    try {
      const existingCustomer = await pool.query(
        'SELECT id FROM portal_customers WHERE email = $1',
        [email]
      )
      
      if (existingCustomer.rows.length > 0) {
        await pool.query(
          'UPDATE portal_customers SET password_hash = $1, status = $2, updated_at = NOW() WHERE email = $3',
          [passwordHash, 'active', email]
        )
        console.log('   ✅ portal_customers 中已存在用户，已更新密码')
      } else {
        await pool.query(`
          INSERT INTO portal_customers (customer_id, email, password_hash, company_name, contact_name, phone, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = EXCLUDED.status, updated_at = NOW()
        `, ['ADMIN-TEST', email, passwordHash, 'Admin Test Company', 'Admin', '+86 13800000000', 'active'])
        console.log('   ✅ 已在 portal_customers 中创建测试用户')
      }
    } catch (err) {
      if (!err.message.includes('does not exist')) {
        console.log('   ⚠️ portal_customers 操作警告:', err.message)
      }
    }
    
    console.log('\n========================================')
    console.log('✅ 测试账户创建/更新成功！')
    console.log('========================================')
    console.log('用户名: admin')
    console.log('密码:   admin123')
    console.log('邮箱:   admin@test.com')
    console.log('========================================')
    console.log('\n现在可以使用以下任一方式登录:')
    console.log('  - 用户名: admin')
    console.log('  - 邮箱: admin@test.com')
    console.log('  - 密码: admin123')
    
  } catch (err) {
    console.error('❌ 错误:', err.message)
    console.error(err.stack)
  } finally {
    await pool.end()
  }
}

addTestUser()

