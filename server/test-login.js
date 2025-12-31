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
console.log('1. 数据库连接:', DATABASE_URL ? '已配置' : '❌ 未配置')

async function test() {
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  })
  
  try {
    // 测试数据库连接
    const dbResult = await pool.query('SELECT current_database() as db')
    console.log('2. 当前数据库:', dbResult.rows[0].db)
    
    // 查询用户
    const email = 'demo@example.com'
    const password = 'demo123456'
    
    console.log('\n3. 查询用户:', email)
    const userResult = await pool.query(
      'SELECT id, email, password_hash, status FROM portal_customers WHERE email = $1',
      [email.toLowerCase()]
    )
    
    if (userResult.rows.length === 0) {
      console.log('   ❌ 用户不存在！')
      return
    }
    
    const user = userResult.rows[0]
    console.log('   ✅ 找到用户:')
    console.log('      - ID:', user.id)
    console.log('      - Email:', user.email)
    console.log('      - Status:', user.status)
    console.log('      - Password Hash:', user.password_hash)
    console.log('      - Hash 长度:', user.password_hash?.length)
    
    // 验证密码
    console.log('\n4. 验证密码:', password)
    const isValid = await bcrypt.compare(password, user.password_hash)
    console.log('   结果:', isValid ? '✅ 密码正确' : '❌ 密码错误')
    
    // 生成正确的哈希对比
    if (!isValid) {
      console.log('\n5. 生成新哈希进行对比:')
      const newHash = bcrypt.hashSync(password, 10)
      console.log('   新哈希:', newHash)
      const verifyNew = await bcrypt.compare(password, newHash)
      console.log('   验证新哈希:', verifyNew ? '✅ 正确' : '❌ 错误')
    }
    
  } catch (err) {
    console.error('❌ 错误:', err.message)
  } finally {
    await pool.end()
  }
}

test()

