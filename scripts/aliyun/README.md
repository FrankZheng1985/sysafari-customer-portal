# 阿里云部署指南

## 目录结构

```
scripts/aliyun/
├── ecosystem.config.js  # PM2 配置
├── nginx-portal.conf    # Nginx 配置
├── deploy.sh            # 部署脚本
├── init-server.sh       # 初始化脚本
├── env.prod.example     # 生产环境变量模板
├── env.local.example    # 本地环境变量模板
└── README.md            # 本文档
```

## 部署步骤

### 1. 准备工作

#### 1.1 创建数据库
```sql
-- 连接到阿里云 RDS
CREATE DATABASE portal_db;
CREATE USER portal_user WITH PASSWORD '安全密码';
GRANT ALL PRIVILEGES ON DATABASE portal_db TO portal_user;

-- 初始化表结构
\c portal_db
\i scripts/sql/init-portal-db.sql
```

#### 1.2 配置 DNS
在阿里云 DNS 控制台添加记录：
- 类型: A
- 主机记录: portal
- 记录值: ECS 服务器 IP

### 2. 首次部署

```bash
# 1. SSH 登录到 ECS
ssh root@your-ecs-ip

# 2. 克隆代码
git clone https://github.com/YOUR_USERNAME/sysafari-customer-portal.git /var/www/sysafari-portal

# 3. 执行初始化脚本
cd /var/www/sysafari-portal
chmod +x scripts/aliyun/init-server.sh
./scripts/aliyun/init-server.sh

# 4. 配置环境变量
cp scripts/aliyun/env.prod.example server/.env
vim server/.env  # 编辑填入实际值
```

### 3. 申请 SSL 证书

方法一：使用阿里云免费证书
1. 登录阿里云 SSL 证书控制台
2. 申请免费 DV 证书
3. 下载 Nginx 格式证书
4. 上传到 `/etc/nginx/ssl/portal/`

方法二：使用 Let's Encrypt
```bash
sudo certbot certonly --webroot -w /var/www/certbot -d portal.xianfeng-eu.com
sudo ln -s /etc/letsencrypt/live/portal.xianfeng-eu.com/fullchain.pem /etc/nginx/ssl/portal/fullchain.pem
sudo ln -s /etc/letsencrypt/live/portal.xianfeng-eu.com/privkey.pem /etc/nginx/ssl/portal/privkey.pem
```

### 4. 后续更新

```bash
cd /var/www/sysafari-portal
./scripts/aliyun/deploy.sh
```

## 服务管理

### PM2 命令
```bash
pm2 status           # 查看状态
pm2 logs portal-api  # 查看日志
pm2 restart portal-api  # 重启服务
pm2 stop portal-api  # 停止服务
```

### Nginx 命令
```bash
sudo nginx -t              # 测试配置
sudo systemctl reload nginx  # 重载配置
sudo systemctl status nginx  # 查看状态
```

## 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| ERP 主系统 | 3001 | erp.xianfeng-eu.com |
| 演示环境 | 3002 | demo.xianfeng-eu.com |
| **客户门户** | **3003** | **portal.xianfeng-eu.com** |

## API 架构说明

客户门户前端直接调用 **ERP 主系统的 Portal API**：

```
┌─────────────────────────┐
│  客户浏览器              │
│  portal.xianfeng-eu.com │
└───────────┬─────────────┘
            │
            │ API 请求
            ▼
┌─────────────────────────┐
│  ERP 主系统              │
│  erp.xianfeng-eu.com    │
│  /api/portal/*          │
└─────────────────────────┘
```

### 前端环境变量

| 文件 | 环境 | VITE_MAIN_API_URL |
|------|------|-------------------|
| `.env.development` | 开发 | `http://localhost:3001/api/portal` |
| `.env.production` | 生产 | `https://erp.xianfeng-eu.com/api/portal` |

构建时 Vite 会自动根据环境加载对应的配置文件。

## 故障排除

### 1. 无法连接数据库
- 检查 RDS 安全组是否允许 ECS IP
- 检查 DATABASE_URL 是否使用内网地址
- 检查用户名密码是否正确

### 2. 502 Bad Gateway
- 检查 PM2 服务是否运行: `pm2 status`
- 检查端口是否正确: `netstat -tlnp | grep 3003`
- 查看后端日志: `pm2 logs portal-api`

### 3. SSL 证书问题
- 检查证书文件是否存在
- 检查证书文件权限
- 检查证书是否过期

