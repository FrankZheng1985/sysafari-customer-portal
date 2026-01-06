-- 用户管理模块数据库表
-- 用于客户门户独立管理子账户和角色权限

-- =====================================================
-- 1. 权限定义表（系统级，预定义所有权限）
-- =====================================================
CREATE TABLE IF NOT EXISTS portal_permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,           -- 权限代码，如 orders:view
  name VARCHAR(100) NOT NULL,                  -- 权限名称，如 查看订单
  module VARCHAR(50) NOT NULL,                 -- 所属模块，如 orders
  description TEXT,                            -- 权限描述
  sort_order INTEGER DEFAULT 0,                -- 排序
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 预置权限数据
INSERT INTO portal_permissions (code, name, module, description, sort_order) VALUES
  -- 仪表盘
  ('dashboard:view', '查看仪表盘', 'dashboard', '查看仪表盘统计数据', 10),
  -- 订单模块
  ('orders:view', '查看订单', 'orders', '查看订单列表和详情', 20),
  ('orders:create', '创建订单', 'orders', '创建新订单', 21),
  ('orders:export', '导出订单', 'orders', '导出订单数据', 22),
  -- 询价模块
  ('quote:view', '查看询价', 'quote', '查看询价记录', 30),
  ('quote:create', '发起询价', 'quote', '发起新的询价请求', 31),
  -- 关税计算
  ('tariff:view', '关税计算', 'tariff', '使用关税计算器', 40),
  -- 财务模块
  ('finance:view', '查看账单', 'finance', '查看账单和应付账款', 50),
  -- API 模块
  ('api:view', '查看API文档', 'api', '查看 API 文档', 60),
  ('api:manage', '管理API密钥', 'api', '管理 API 密钥', 61),
  -- 用户管理
  ('users:view', '查看用户', 'users', '查看子账户列表', 70),
  ('users:manage', '管理用户', 'users', '创建、编辑、删除子账户', 71),
  -- 角色管理
  ('roles:view', '查看角色', 'roles', '查看角色列表', 80),
  ('roles:manage', '管理角色', 'roles', '创建、编辑、删除角色和权限配置', 81),
  -- 设置
  ('settings:view', '查看设置', 'settings', '查看账户设置', 90),
  ('settings:edit', '修改设置', 'settings', '修改账户设置', 91)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 2. 角色表（每个客户公司可自定义角色）
-- =====================================================
CREATE TABLE IF NOT EXISTS portal_roles (
  id SERIAL PRIMARY KEY,
  customer_id VARCHAR(50) NOT NULL,            -- 所属客户公司（关联 customers.id 或 customer_accounts.customer_id）
  name VARCHAR(100) NOT NULL,                  -- 角色名称
  description TEXT,                            -- 角色描述
  is_system BOOLEAN DEFAULT false,             -- 是否系统预置角色
  is_default BOOLEAN DEFAULT false,            -- 是否为新用户默认角色
  status VARCHAR(20) DEFAULT 'active',         -- 状态: active, disabled
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, name)                    -- 同一客户下角色名称唯一
);

-- =====================================================
-- 3. 角色权限关联表
-- =====================================================
CREATE TABLE IF NOT EXISTS portal_role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES portal_roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES portal_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, permission_id)               -- 防止重复关联
);

-- =====================================================
-- 4. 子账户表（门户独立管理的员工账户）
-- =====================================================
CREATE TABLE IF NOT EXISTS portal_users (
  id SERIAL PRIMARY KEY,
  parent_account_id INTEGER NOT NULL,          -- 关联主账户 customer_accounts.id
  customer_id VARCHAR(50) NOT NULL,            -- 所属客户公司（冗余字段，便于查询）
  username VARCHAR(100) NOT NULL,              -- 用户名（用于登录）
  email VARCHAR(255),                          -- 邮箱（可选，也可用于登录）
  password_hash VARCHAR(255) NOT NULL,         -- 密码哈希
  display_name VARCHAR(100),                   -- 显示名称
  phone VARCHAR(50),                           -- 手机号
  role_id INTEGER REFERENCES portal_roles(id) ON DELETE SET NULL,  -- 关联角色
  status VARCHAR(20) DEFAULT 'active',         -- 状态: active, disabled, deleted
  login_attempts INTEGER DEFAULT 0,            -- 登录失败次数
  locked_until TIMESTAMP,                      -- 锁定截止时间
  last_login_at TIMESTAMP,                     -- 最后登录时间
  last_login_ip VARCHAR(50),                   -- 最后登录 IP
  password_changed_at TIMESTAMP,               -- 密码最后修改时间
  created_by INTEGER,                          -- 创建者（主账户ID或子账户ID）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, username),               -- 同一客户下用户名唯一
  UNIQUE(customer_id, email)                   -- 同一客户下邮箱唯一（如果有邮箱）
);

-- =====================================================
-- 5. 索引
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_portal_permissions_module ON portal_permissions(module);
CREATE INDEX IF NOT EXISTS idx_portal_permissions_code ON portal_permissions(code);

CREATE INDEX IF NOT EXISTS idx_portal_roles_customer ON portal_roles(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_roles_status ON portal_roles(status);

CREATE INDEX IF NOT EXISTS idx_portal_role_permissions_role ON portal_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_portal_role_permissions_permission ON portal_role_permissions(permission_id);

CREATE INDEX IF NOT EXISTS idx_portal_users_parent ON portal_users(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_customer ON portal_users(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_username ON portal_users(username);
CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email);
CREATE INDEX IF NOT EXISTS idx_portal_users_role ON portal_users(role_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_status ON portal_users(status);

-- =====================================================
-- 6. 注释
-- =====================================================
COMMENT ON TABLE portal_permissions IS '权限定义表 - 系统预置所有功能权限';
COMMENT ON TABLE portal_roles IS '角色表 - 每个客户公司可自定义角色';
COMMENT ON TABLE portal_role_permissions IS '角色权限关联表';
COMMENT ON TABLE portal_users IS '子账户表 - 门户独立管理的员工账户';

COMMENT ON COLUMN portal_users.parent_account_id IS '主账户ID，关联 customer_accounts.id';
COMMENT ON COLUMN portal_users.customer_id IS '客户公司ID，冗余字段便于查询';
COMMENT ON COLUMN portal_roles.is_system IS '是否系统预置角色，系统角色不可删除';
COMMENT ON COLUMN portal_roles.is_default IS '是否为新用户默认角色';

-- =====================================================
-- 7. 函数：自动更新 updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_portal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为相关表添加触发器
DROP TRIGGER IF EXISTS trigger_portal_roles_updated ON portal_roles;
CREATE TRIGGER trigger_portal_roles_updated
  BEFORE UPDATE ON portal_roles
  FOR EACH ROW EXECUTE FUNCTION update_portal_updated_at();

DROP TRIGGER IF EXISTS trigger_portal_users_updated ON portal_users;
CREATE TRIGGER trigger_portal_users_updated
  BEFORE UPDATE ON portal_users
  FOR EACH ROW EXECUTE FUNCTION update_portal_updated_at();

-- =====================================================
-- 验证
-- =====================================================
SELECT 'add-user-management.sql executed successfully' AS message;

