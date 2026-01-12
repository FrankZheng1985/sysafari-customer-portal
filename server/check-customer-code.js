/**
 * 检查客户编码数据状态
 * 诊断 customer_code 显示问题
 * 
 * 运行: cd server && node check-customer-code.js
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '.env') })

const DATABASE_URL = process.env.DATABASE_URL

console.log('=== 检查客户编码数据状态 ===\n')

async function checkCustomerCode() {
  if (!DATABASE_URL) {
    console.error('❌ 未找到 DATABASE_URL 环境变量')
    process.exit(1)
  }
  
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') 
      ? false 
      : { rejectUnauthorized: false }
  })
  
  try {
    // 查看所有表
    console.log('1. 数据库中的所有表:')
    const allTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    allTables.rows.forEach(t => console.log(`   - ${t.table_name}`))
    
    // 检查 customer_accounts 所有数据
    console.log('\n2. customer_accounts 表所有数据:')
    const allAccounts = await pool.query(`SELECT * FROM customer_accounts`)
    console.log(`   共 ${allAccounts.rows.length} 条记录:`)
    allAccounts.rows.forEach(row => {
      console.log(`   - id: ${row.id}, customer_id: ${row.customer_id}, username: ${row.username}, email: ${row.email}`)
    })
    
    // 检查 customers 所有数据
    console.log('\n3. customers 表所有数据:')
    const allCustomers = await pool.query(`SELECT * FROM customers`)
    console.log(`   共 ${allCustomers.rows.length} 条记录:`)
    allCustomers.rows.forEach(row => {
      console.log(`   - id: ${row.id}, customer_code: ${row.customer_code}, customer_name: ${row.customer_name}`)
    })
    
    // 检查 portal_customers 表
    console.log('\n4. portal_customers 表数据:')
    try {
      const portalCustomers = await pool.query(`SELECT * FROM portal_customers LIMIT 10`)
      console.log(`   共 ${portalCustomers.rows.length} 条记录:`)
      portalCustomers.rows.forEach(row => {
        console.log(`   - id: ${row.id}`)
        console.log(`     customer_id: ${row.customer_id}`)
        console.log(`     customer_code: ${row.customer_code || '(空)'}`)
        console.log(`     email: ${row.email}`)
        console.log(`     company_name: ${row.company_name}`)
        console.log('')
      })
    } catch (e) {
      console.log('   表不存在或查询失败:', e.message)
    }
    
    // 检查 portal_users 表
    console.log('\n5. portal_users 表数据:')
    try {
      const portalUsers = await pool.query(`
        SELECT pu.*, c.customer_code, c.customer_name, c.company_name as c_company
        FROM portal_users pu
        LEFT JOIN customers c ON pu.customer_id::integer = c.id
        LIMIT 10
      `)
      console.log(`   共 ${portalUsers.rows.length} 条记录:`)
      portalUsers.rows.forEach(row => {
        console.log(`   - id: ${row.id}, username: ${row.username}`)
        console.log(`     customer_id: ${row.customer_id}`)
        console.log(`     关联的 customer_code: ${row.customer_code || '(空)'}`)
        console.log(`     关联的 customer_name: ${row.customer_name || '(空)'}`)
        console.log('')
      })
    } catch (e) {
      console.log('   表不存在或查询失败:', e.message)
    }
    
    // 搜索傲翼
    console.log('\n6. 全库搜索"傲翼":')
    const tables = ['customers', 'customer_accounts', 'portal_customers', 'portal_users']
    for (const table of tables) {
      try {
        const cols = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND data_type IN ('character varying', 'text')
        `, [table])
        
        for (const col of cols.rows) {
          const result = await pool.query(
            `SELECT * FROM ${table} WHERE ${col.column_name} LIKE '%傲翼%'`
          )
          if (result.rows.length > 0) {
            console.log(`   ✅ 在 ${table}.${col.column_name} 找到 ${result.rows.length} 条记录:`)
            console.log('   ', JSON.stringify(result.rows[0], null, 2))
          }
        }
      } catch (e) {
        // 忽略
      }
    }
    
    // 搜索 UUID
    console.log('\n7. 搜索 UUID "00fd24b6-1520-480e-acd3-4df5a38c34be":')
    for (const table of tables) {
      try {
        const cols = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1 AND data_type IN ('character varying', 'text', 'uuid')
        `, [table])
        
        for (const col of cols.rows) {
          const result = await pool.query(
            `SELECT * FROM ${table} WHERE ${col.column_name}::text LIKE '%00fd24b6%'`
          )
          if (result.rows.length > 0) {
            console.log(`   ✅ 在 ${table}.${col.column_name} 找到:`)
            console.log('   ', JSON.stringify(result.rows[0], null, 2))
          }
        }
      } catch (e) {
        // 忽略
      }
    }
    
    console.log('\n========================================')
    console.log('📋 诊断总结')
    console.log('========================================')
    
  } catch (err) {
    console.error('❌ 错误:', err.message)
  } finally {
    await pool.end()
  }
}

checkCustomerCode()
