/**
 * PM2 配置文件
 * 客户门户系统 - 端口 3003
 */

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
      PORT: 3003
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

