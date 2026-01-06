/**
 * PM2 配置文件
 * 客户门户系统 - 端口 3003
 */

const fs = require('fs')
const path = require('path')

// 手动读取并解析 .env 文件
function loadEnvFile(envPath) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const envVars = {}
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim()
        }
      }
    })
    return envVars
  } catch (err) {
    console.error('无法读取 .env 文件:', err.message)
    return {}
  }
}

const envVars = loadEnvFile('/var/www/sysafari-customer-portal/server/.env')

module.exports = {
  apps: [{
    name: 'portal-api',
    script: 'server/app.js',
    cwd: '/var/www/sysafari-customer-portal',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: envVars.PORT || 3003,
      DATABASE_URL: envVars.DATABASE_URL,
      MAIN_API_URL: envVars.MAIN_API_URL || 'http://localhost:3001',
      MAIN_API_KEY: envVars.MAIN_API_KEY || ''
    },
    error_file: '/var/www/sysafari-customer-portal/logs/error.log',
    out_file: '/var/www/sysafari-customer-portal/logs/out.log',
    log_file: '/var/www/sysafari-customer-portal/logs/combined.log',
    time: true,
    // 重启策略
    exp_backoff_restart_delay: 100,
    // 优雅关闭
    kill_timeout: 5000,
    listen_timeout: 10000
  }]
}

