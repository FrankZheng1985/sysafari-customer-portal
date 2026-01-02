-- 客户门户独立认证表
-- 用于存储从 ERP 同步的客户信息和登录 session

-- 1. 门户客户表（缓存 ERP 客户信息）
CREATE TABLE IF NOT EXISTS portal_customers (
  id VARCHAR(50) PRIMARY KEY,
  customer_id VARCHAR(50) NOT NULL,           -- ERP 中的 customer_id
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),                  -- 本地密码哈希（可选，用于离线验证）
  company_name VARCHAR(255),
  contact_name VARCHAR(100),
  phone VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  erp_synced_at TIMESTAMP,                     -- 最后从 ERP 同步的时间
  last_login_at TIMESTAMP,
  login_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 登录 Session 表
CREATE TABLE IF NOT EXISTS portal_sessions (
  id VARCHAR(100) PRIMARY KEY,
  customer_id VARCHAR(50) NOT NULL,            -- 关联 portal_customers.id
  token VARCHAR(500) NOT NULL,
  ip_address VARCHAR(50),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 活动日志表
CREATE TABLE IF NOT EXISTS portal_activity_logs (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  details JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_portal_customers_email ON portal_customers(email);
CREATE INDEX IF NOT EXISTS idx_portal_customers_customer_id ON portal_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_customer ON portal_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(token);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires ON portal_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_portal_activity_logs_customer ON portal_activity_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_activity_logs_created ON portal_activity_logs(created_at);

-- 注释
COMMENT ON TABLE portal_customers IS '门户客户表 - 缓存 ERP 客户信息';
COMMENT ON TABLE portal_sessions IS '登录会话表';
COMMENT ON TABLE portal_activity_logs IS '活动日志表';

-- 验证
SELECT 'portal-auth-tables.sql executed successfully' AS message;

