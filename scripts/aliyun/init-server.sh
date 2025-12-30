#!/bin/bash
# ============================================
# 阿里云 ECS 服务器初始化脚本
# 首次部署客户门户时执行
# ============================================

set -e

APP_DIR="/var/www/sysafari-portal"
GITHUB_REPO="https://github.com/YOUR_USERNAME/sysafari-customer-portal.git"

echo "=========================================="
echo "🚀 初始化客户门户服务器..."
echo "=========================================="

# 1. 创建应用目录
echo "📁 创建应用目录..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# 2. 克隆代码（如果还没有）
if [ ! -d "$APP_DIR/.git" ]; then
    echo "📥 克隆代码仓库..."
    git clone $GITHUB_REPO $APP_DIR
fi

cd $APP_DIR

# 3. 创建必要目录
mkdir -p logs
mkdir -p backups

# 4. 安装依赖
echo "📦 安装前端依赖..."
npm install

echo "📦 安装后端依赖..."
cd server && npm install
cd $APP_DIR

# 5. 复制环境变量文件
if [ ! -f "server/.env" ]; then
    echo "⚠️  请创建 server/.env 文件"
    echo "   参考 server/.env.example 或文档"
fi

# 6. 构建前端
echo "🔨 构建前端..."
npm run build

# 7. 创建 SSL 证书目录
echo "📜 创建 SSL 证书目录..."
sudo mkdir -p /etc/nginx/ssl/portal

# 8. 复制 Nginx 配置
echo "⚙️  配置 Nginx..."
sudo cp scripts/aliyun/nginx-portal.conf /etc/nginx/sites-available/portal.xianfeng-eu.com
sudo ln -sf /etc/nginx/sites-available/portal.xianfeng-eu.com /etc/nginx/sites-enabled/

# 9. 测试 Nginx 配置
echo "🔍 测试 Nginx 配置..."
sudo nginx -t

# 10. 使用 PM2 启动服务
echo "🚀 启动 PM2 服务..."
pm2 start scripts/aliyun/ecosystem.config.js
pm2 save

# 11. 重载 Nginx
echo "🔄 重载 Nginx..."
sudo systemctl reload nginx

echo "=========================================="
echo "✅ 初始化完成!"
echo ""
echo "⚠️  后续操作:"
echo "1. 配置 DNS: portal.xianfeng-eu.com -> ECS IP"
echo "2. 申请 SSL 证书并放置到 /etc/nginx/ssl/portal/"
echo "3. 创建 server/.env 配置文件"
echo "4. 在 RDS 创建 portal_db 数据库"
echo "5. 执行数据库初始化脚本"
echo "=========================================="

