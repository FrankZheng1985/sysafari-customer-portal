/**
 * 客户门户数据库配置模块
 * 使用 PostgreSQL 连接 portal_db 数据库
 */

import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') })

// 数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL

// 检查数据库连接配置
if (!DATABASE_URL) {
  console.error('❌ 错误: 未配置数据库连接字符串')
  console.error('   请在 server/.env 文件中设置 DATABASE_URL')
  process.exit(1)
}

// PostgreSQL 连接池
let pgPool = null

/**
 * 将 ? 占位符转换为 PostgreSQL 风格的 $1, $2...
 */
function convertPlaceholders(sql) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}

/**
 * PostgreSQL Statement 包装类
 */
class PgStatement {
  constructor(pool, sql) {
    this.pool = pool
    this.originalSql = sql
    this.pgSql = convertPlaceholders(sql)
  }
  
  async run(...params) {
    try {
      const result = await this.pool.query(this.pgSql, params)
      return {
        changes: result.rowCount,
        lastInsertRowid: result.rows[0]?.id || null
      }
    } catch (err) {
      console.error('❌ PG run error:', err.message)
      console.error('   SQL:', this.pgSql)
      throw err
    }
  }
  
  async get(...params) {
    try {
      const result = await this.pool.query(this.pgSql, params)
      return result.rows[0]
    } catch (err) {
      console.error('❌ PG get error:', err.message)
      throw err
    }
  }
  
  async all(...params) {
    try {
      const result = await this.pool.query(this.pgSql, params)
      return result.rows
    } catch (err) {
      console.error('❌ PG all error:', err.message)
      throw err
    }
  }
}

/**
 * PostgreSQL 数据库适配器
 */
class PostgresDatabase {
  constructor(pool) {
    this.pool = pool
    this.isPostgres = true
  }
  
  prepare(sql) {
    return new PgStatement(this.pool, sql)
  }
  
  async exec(sql) {
    try {
      const result = await this.pool.query(sql)
      return { changes: result.rowCount || 0 }
    } catch (err) {
      if (err.message.includes('already exists') || 
          err.message.includes('duplicate column') ||
          err.code === '42701') {
        return { changes: 0 }
      }
      console.error('❌ PostgreSQL exec 错误:', err.message)
      return { changes: 0 }
    }
  }
  
  async query(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params)
      return result.rows
    } catch (err) {
      console.error('❌ PostgreSQL query 错误:', err.message)
      throw err
    }
  }
  
  close() {
    return this.pool.end()
  }
}

/**
 * 获取数据库实例（单例模式）
 */
export function getDatabase() {
  if (!pgPool) {
    const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
    const isAliyunRDS = DATABASE_URL.includes('aliyuncs.com') || DATABASE_URL.includes('rds.aliyuncs')
    
    // SSL 配置
    let sslConfig = false
    if (!isLocalhost) {
      if (isAliyunRDS) {
        sslConfig = { rejectUnauthorized: false }
      } else if (DATABASE_URL.includes('sslmode=require')) {
        sslConfig = { rejectUnauthorized: false }
      }
    }
    
    pgPool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: sslConfig,
      max: 10,                         // 最大连接数（门户系统较小）
      min: 1,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      allowExitOnIdle: false
    })
    
    pgPool.on('error', (err) => {
      console.error('❌ PostgreSQL 连接池错误:', err.message)
    })
    
    // 数据库心跳检查（每 5 分钟）
    if (!isLocalhost) {
      setInterval(async () => {
        try {
          const client = await pgPool.connect()
          await client.query('SELECT 1')
          client.release()
        } catch (err) {
          console.error('💔 数据库心跳失败:', err.message)
        }
      }, 5 * 60 * 1000)
    }
    
    const dbProvider = isLocalhost ? '本地' : (isAliyunRDS ? '阿里云RDS' : '云端')
    console.log(`🌐 Portal PostgreSQL 连接已建立 (${dbProvider})`)
  }
  return new PostgresDatabase(pgPool)
}

/**
 * 关闭数据库连接
 */
export function closeDatabase() {
  if (pgPool) {
    pgPool.end()
    pgPool = null
    console.log('🌐 Portal PostgreSQL 连接已关闭')
  }
}

/**
 * 测试数据库连接
 */
export async function testConnection() {
  getDatabase()
  try {
    const client = await pgPool.connect()
    const result = await client.query('SELECT current_database() as db')
    console.log('✅ Portal PostgreSQL 连接测试成功:', result.rows[0].db)
    client.release()
    return true
  } catch (error) {
    console.error('❌ Portal PostgreSQL 连接测试失败:', error.message)
    return false
  }
}

/**
 * 生成 UUID
 */
export function generateId(prefix = '') {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
  return prefix ? `${prefix}-${uuid}` : uuid
}

export default {
  getDatabase,
  closeDatabase,
  testConnection,
  generateId
}

