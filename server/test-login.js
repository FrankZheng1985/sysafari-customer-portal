/**
 * 登录调试脚本
 * 运行: node test-login.js
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

console.log('=== 登录调试脚本 ===\n')

async function test() {
  // 先测试纯 bcrypt
  console.log('1. 纯 bcrypt 测试:')
  const testPassword = 'demo123456'
  const testHash = bcrypt.hashSync(testPassword, 10)
  console.log('   生成的哈希:', testHash)
  const testResult = bcrypt.compareSync(testPassword, testHash)
  console.log('   验证结果:', testResult ? '✅ 正确' : '❌ 错误')
  
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    // 查询用户
    const email = 'demo@example.com'
    
    console.log('\n2. 查询数据库用户:', email)
    const userResult = await pool.query(
      'SELECT id, email, password_hash, status FROM portal_customers WHERE email = $1',
      [email.toLowerCase()]
    )
    
    if (userResult.rows.length === 0) {
      console.log('   ❌ 用户不存在！')
      
      // 创建用户
      console.log('\n3. 创建新用户...')
      const newHash = bcrypt.hashSync(testPassword, 10)
      await pool.query(
        `INSERT INTO portal_customers (customer_id, email, password_hash, company_name, contact_name, phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email) DO UPDATE SET password_hash = $3`,
        ['CUST-DEMO-001', email, newHash, 'Demo Company', 'Demo User', '+86 13800138000', 'active']
      )
      console.log('   ✅ 用户创建成功，哈希:', newHash)
      
      // 验证刚创建的
      const verifyResult = await pool.query(
        'SELECT password_hash FROM portal_customers WHERE email = $1',
        [email]
      )
      const savedHash = verifyResult.rows[0].password_hash
      console.log('   数据库中的哈希:', savedHash)
      console.log('   哈希是否一致:', savedHash === newHash ? '✅ 是' : '❌ 否')
      
      const finalCheck = bcrypt.compareSync(testPassword, savedHash)
      console.log('   最终密码验证:', finalCheck ? '✅ 正确' : '❌ 错误')
      
      return
    }
    
    const user = userResult.rows[0]
    console.log('   找到用户:')
    console.log('      - Email:', user.email)
    console.log('      - Status:', user.status)
    console.log('      - Hash:', user.password_hash)
    console.log('      - Hash长度:', user.password_hash?.length)
    console.log('      - Hash Buffer:', Buffer.from(user.password_hash || '').toString('hex').substring(0, 40) + '...')
    
    // 验证
    console.log('\n3. 密码验证:')
    const isValid = bcrypt.compareSync(testPassword, user.password_hash)
    console.log('   结果:', isValid ? '✅ 密码正确' : '❌ 密码错误')
    
    if (!isValid) {
      // 更新密码
      console.log('\n4. 更新密码哈希...')
      const newHash = bcrypt.hashSync(testPassword, 10)
      await pool.query(
        'UPDATE portal_customers SET password_hash = $1 WHERE email = $2',
        [newHash, email]
      )
      console.log('   新哈希:', newHash)
      
      // 重新查询验证
      const recheck = await pool.query(
        'SELECT password_hash FROM portal_customers WHERE email = $1',
        [email]
      )
      const savedHash = recheck.rows[0].password_hash
      console.log('   保存后的哈希:', savedHash)
      console.log('   哈希是否一致:', savedHash === newHash ? '✅ 是' : '❌ 否')
      
      const finalVerify = bcrypt.compareSync(testPassword, savedHash)
      console.log('   最终验证:', finalVerify ? '✅ 正确' : '❌ 错误')
    }
    
  } catch (err) {
    console.error('❌ 错误:', err.message)
    console.error(err.stack)
  } finally {
    await pool.end()
  }
}

test()

