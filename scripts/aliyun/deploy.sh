#!/bin/bash
# ============================================
# Sysafari 客户门户部署脚本
# 用于阿里云 ECS 服务器
# ============================================

set -e

APP_DIR="/var/www/sysafari-customer-portal"
LOG_DIR="$APP_DIR/logs"
BACKUP_DIR="$APP_DIR/backups"

echo "=========================================="
echo "🚀 开始部署客户门户系统..."
echo "=========================================="

# 创建必要目录
mkdir -p $LOG_DIR
mkdir -p $BACKUP_DIR

# 进入应用目录
cd $APP_DIR

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 安装前端依赖
echo "📦 安装前端依赖..."
npm install

# 安装后端依赖
echo "📦 安装后端依赖..."
cd server && npm install
cd $APP_DIR

# 构建前端
echo "🔨 构建前端..."
npm run build

# 重启 PM2 服务
echo "🔄 重启 PM2 服务..."
pm2 restart portal-api || pm2 start scripts/aliyun/ecosystem.config.cjs

# 显示服务状态
echo "📊 服务状态:"
pm2 status portal-api

echo "=========================================="
echo "✅ 部署完成!"
echo "=========================================="

