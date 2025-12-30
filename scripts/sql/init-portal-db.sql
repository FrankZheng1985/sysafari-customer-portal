-- ============================================
-- Sysafari Customer Portal 数据库初始化脚本
-- 数据库名：portal_db
-- 端口：5432
-- ============================================

-- 创建数据库（需要以超级用户执行）
-- CREATE DATABASE portal_db;

-- 创建专用用户（可选，增强安全性）
-- CREATE USER portal_user WITH PASSWORD '你的安全密码';
-- GRANT ALL PRIVILEGES ON DATABASE portal_db TO portal_user;

-- ============================================
-- 1. 客户表 (portal_customers)
-- 用于存储门户系统的客户账户信息
-- ============================================
CREATE TABLE IF NOT EXISTS portal_customers (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) UNIQUE NOT NULL,          -- 关联主系统的客户ID
    email VARCHAR(255) UNIQUE NOT NULL,               -- 登录邮箱
    password_hash VARCHAR(255) NOT NULL,              -- 密码哈希
    company_name VARCHAR(255),                        -- 公司名称
    contact_name VARCHAR(100),                        -- 联系人姓名
    phone VARCHAR(50),                                -- 联系电话
    status VARCHAR(20) DEFAULT 'active',              -- 状态: active, inactive, suspended
    last_login_at TIMESTAMP WITH TIME ZONE,           -- 最后登录时间
    login_count INTEGER DEFAULT 0,                    -- 登录次数
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_portal_customers_customer_id ON portal_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_customers_email ON portal_customers(email);
CREATE INDEX IF NOT EXISTS idx_portal_customers_status ON portal_customers(status);

-- ============================================
-- 2. 会话表 (portal_sessions)
-- 用于管理客户登录会话
-- ============================================
CREATE TABLE IF NOT EXISTS portal_sessions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES portal_customers(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,       -- 会话令牌
    ip_address VARCHAR(45),                           -- 登录IP
    user_agent TEXT,                                  -- 浏览器信息
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,     -- 过期时间
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_customer ON portal_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires ON portal_sessions(expires_at);

-- ============================================
-- 3. 活动日志表 (portal_activity_logs)
-- 记录客户的所有操作
-- ============================================
CREATE TABLE IF NOT EXISTS portal_activity_logs (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES portal_customers(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,                     -- 操作类型: login, logout, view_order, etc.
    resource_type VARCHAR(50),                        -- 资源类型: order, invoice, api_key
    resource_id VARCHAR(100),                         -- 资源ID
    ip_address VARCHAR(45),                           -- IP地址
    user_agent TEXT,                                  -- 浏览器信息
    details JSONB,                                    -- 详细信息
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_portal_activity_logs_customer ON portal_activity_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_activity_logs_action ON portal_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_portal_activity_logs_created ON portal_activity_logs(created_at);

-- ============================================
-- 4. API 密钥表 (portal_api_keys)
-- 客户的API访问密钥
-- ============================================
CREATE TABLE IF NOT EXISTS portal_api_keys (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES portal_customers(id) ON DELETE CASCADE,
    key_name VARCHAR(100) NOT NULL,                   -- 密钥名称
    api_key VARCHAR(64) UNIQUE NOT NULL,              -- API密钥（加密存储）
    key_prefix VARCHAR(10) NOT NULL,                  -- 密钥前缀（用于展示）
    permissions JSONB DEFAULT '["read"]',             -- 权限: read, write, etc.
    rate_limit INTEGER DEFAULT 1000,                  -- 每日请求限制
    status VARCHAR(20) DEFAULT 'active',              -- 状态: active, revoked
    last_used_at TIMESTAMP WITH TIME ZONE,            -- 最后使用时间
    usage_count INTEGER DEFAULT 0,                    -- 使用次数
    expires_at TIMESTAMP WITH TIME ZONE,              -- 过期时间（可选）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE               -- 撤销时间
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_portal_api_keys_customer ON portal_api_keys(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_api_keys_key ON portal_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_portal_api_keys_status ON portal_api_keys(status);

-- ============================================
-- 5. 订单缓存表 (cached_orders)
-- 从主系统同步的订单数据缓存
-- ============================================
CREATE TABLE IF NOT EXISTS cached_orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) UNIQUE NOT NULL,             -- 主系统订单ID
    customer_id INTEGER NOT NULL REFERENCES portal_customers(id) ON DELETE CASCADE,
    order_number VARCHAR(50),                         -- 订单号
    order_data JSONB NOT NULL,                        -- 订单完整数据
    status VARCHAR(50),                               -- 订单状态
    created_date DATE,                                -- 订单创建日期
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- 同步时间
    expires_at TIMESTAMP WITH TIME ZONE               -- 缓存过期时间
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cached_orders_customer ON cached_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_cached_orders_order_id ON cached_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_cached_orders_status ON cached_orders(status);
CREATE INDEX IF NOT EXISTS idx_cached_orders_synced ON cached_orders(synced_at);

-- ============================================
-- 6. 账单缓存表 (cached_invoices)
-- 从主系统同步的账单数据缓存
-- ============================================
CREATE TABLE IF NOT EXISTS cached_invoices (
    id SERIAL PRIMARY KEY,
    invoice_id VARCHAR(50) UNIQUE NOT NULL,           -- 主系统账单ID
    customer_id INTEGER NOT NULL REFERENCES portal_customers(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50),                       -- 账单号
    invoice_data JSONB NOT NULL,                      -- 账单完整数据
    status VARCHAR(50),                               -- 账单状态
    amount DECIMAL(12, 2),                            -- 金额
    currency VARCHAR(10) DEFAULT 'EUR',               -- 货币
    due_date DATE,                                    -- 到期日
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_cached_invoices_customer ON cached_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_invoice_id ON cached_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_status ON cached_invoices(status);
CREATE INDEX IF NOT EXISTS idx_cached_invoices_synced ON cached_invoices(synced_at);

-- ============================================
-- 7. 数据同步状态表 (sync_status)
-- 记录与主系统的数据同步状态
-- ============================================
CREATE TABLE IF NOT EXISTS sync_status (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES portal_customers(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL,                   -- 同步类型: orders, invoices, full
    last_sync_at TIMESTAMP WITH TIME ZONE,            -- 最后同步时间
    next_sync_at TIMESTAMP WITH TIME ZONE,            -- 下次同步时间
    status VARCHAR(20) DEFAULT 'pending',             -- 状态: pending, running, completed, failed
    records_synced INTEGER DEFAULT 0,                 -- 同步记录数
    error_message TEXT,                               -- 错误信息
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sync_status_customer ON sync_status(customer_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_type ON sync_status(sync_type);

-- ============================================
-- 8. 通知表 (portal_notifications)
-- 客户通知消息
-- ============================================
CREATE TABLE IF NOT EXISTS portal_notifications (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES portal_customers(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,                      -- 通知标题
    message TEXT NOT NULL,                            -- 通知内容
    type VARCHAR(50) DEFAULT 'info',                  -- 类型: info, warning, success, error
    is_read BOOLEAN DEFAULT FALSE,                    -- 是否已读
    link VARCHAR(500),                                -- 相关链接
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_portal_notifications_customer ON portal_notifications(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_notifications_read ON portal_notifications(is_read);

-- ============================================
-- 9. 系统配置表 (portal_settings)
-- 门户系统配置
-- ============================================
CREATE TABLE IF NOT EXISTS portal_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,                 -- 配置键
    value TEXT,                                       -- 配置值
    description VARCHAR(500),                         -- 配置说明
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
INSERT INTO portal_settings (key, value, description) VALUES
    ('sync_interval_minutes', '30', '数据同步间隔（分钟）'),
    ('session_timeout_hours', '24', '会话超时时间（小时）'),
    ('api_rate_limit_default', '1000', 'API默认每日请求限制'),
    ('cache_expiry_hours', '1', '缓存过期时间（小时）'),
    ('maintenance_mode', 'false', '维护模式开关')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 更新时间触发器函数
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加更新触发器
DROP TRIGGER IF EXISTS update_portal_customers_updated_at ON portal_customers;
CREATE TRIGGER update_portal_customers_updated_at
    BEFORE UPDATE ON portal_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sync_status_updated_at ON sync_status;
CREATE TRIGGER update_sync_status_updated_at
    BEFORE UPDATE ON sync_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 完成
-- ============================================
-- 提示：执行此脚本前，请确保已创建 portal_db 数据库
-- psql -U postgres -d portal_db -f init-portal-db.sql

