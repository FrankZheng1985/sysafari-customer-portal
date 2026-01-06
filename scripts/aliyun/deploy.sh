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

# 获取新构建的JS文件名（用于验证）
NEW_JS=$(cat $APP_DIR/dist/index.html | grep -o 'index-[^"]*\.js')
NEW_CSS=$(cat $APP_DIR/dist/index.html | grep -o 'index-[^"]*\.css')
echo "📋 新构建的文件: JS=$NEW_JS, CSS=$NEW_CSS"

# 1. 强制完全删除目标目录
echo "📋 步骤1: 删除旧目录..."
rm -rf /var/www/portal
if [ -d "/var/www/portal" ]; then
    echo "❌ 错误：无法删除portal目录"
    exit 1
fi

# 2. 重新创建目录
echo "📋 步骤2: 创建新目录..."
mkdir -p /var/www/portal/assets

# 3. 逐个复制文件（更可靠）
echo "📋 步骤3: 复制文件..."
cp $APP_DIR/dist/index.html /var/www/portal/index.html
cp $APP_DIR/dist/favicon.svg /var/www/portal/favicon.svg 2>/dev/null || true
cp $APP_DIR/dist/assets/* /var/www/portal/assets/

# 4. 强制同步到磁盘
echo "📋 步骤4: 同步到磁盘..."
sync

# 5. 验证 index.html 是否正确
DEPLOYED_JS=$(cat /var/www/portal/index.html | grep -o 'index-[^"]*\.js')
echo "📋 验证: dist=$NEW_JS, deployed=$DEPLOYED_JS"

if [ "$NEW_JS" != "$DEPLOYED_JS" ]; then
    echo "❌ 错误：index.html同步失败！"
    echo "   dist/index.html 引用: $NEW_JS"
    echo "   portal/index.html 引用: $DEPLOYED_JS"
    echo "   尝试直接复制 index.html..."
    cat $APP_DIR/dist/index.html > /var/www/portal/index.html
    sync
    # 再次验证
    DEPLOYED_JS=$(cat /var/www/portal/index.html | grep -o 'index-[^"]*\.js')
    if [ "$NEW_JS" != "$DEPLOYED_JS" ]; then
        echo "❌ 严重错误：无法正确复制index.html"
        exit 1
    fi
fi

# 6. 检查JS文件是否存在
if [ ! -f "/var/www/portal/assets/$DEPLOYED_JS" ]; then
    echo "❌ 错误：JS文件不存在于 /var/www/portal/assets/"
    echo "   期望文件: $DEPLOYED_JS"
    echo "   目录内容:"
    ls -la /var/www/portal/assets/
    exit 1
fi

echo "✅ 文件同步验证通过"
echo "   JS: $DEPLOYED_JS"
echo "   目录内容:"
ls -la /var/www/portal/assets/

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

