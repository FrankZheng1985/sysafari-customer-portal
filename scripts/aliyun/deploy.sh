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

# 同步前端文件到 Nginx 服务目录
echo "📁 同步前端文件..."

# 获取新构建的JS文件名
NEW_JS=$(cat $APP_DIR/dist/index.html | grep -o 'index-[^"]*\.js')
echo "📋 新构建的JS文件: $NEW_JS"

# 强制完全删除并重建目录
rm -rf /var/www/portal
sleep 1
mkdir -p /var/www/portal

# 使用 cp 直接复制（比rsync更可靠）
cp -rf $APP_DIR/dist/* /var/www/portal/

# 强制同步到磁盘
sync
sleep 1

# 验证同步结果
DEPLOYED_JS=$(cat /var/www/portal/index.html | grep -o 'index-[^"]*\.js')
echo "📋 已部署的JS文件: $DEPLOYED_JS"

# 检查文件是否匹配
if [ "$NEW_JS" != "$DEPLOYED_JS" ]; then
    echo "❌ 错误：文件同步失败！"
    echo "期望: $NEW_JS"
    echo "实际: $DEPLOYED_JS"
    exit 1
fi

# 检查JS文件是否存在
if [ ! -f "/var/www/portal/assets/$DEPLOYED_JS" ]; then
    echo "❌ 错误：JS文件不存在！"
    ls -la /var/www/portal/assets/
    exit 1
fi

echo "✅ 文件同步验证通过"

# 重载 Nginx
echo "🔄 重载 Nginx..."
systemctl reload nginx

# 重启 PM2 服务
echo "🔄 重启 PM2 服务..."
pm2 restart portal-api || pm2 start scripts/aliyun/ecosystem.config.cjs

# 显示服务状态
echo "📊 服务状态:"
pm2 status portal-api

echo "=========================================="
echo "✅ 部署完成!"
echo "=========================================="

