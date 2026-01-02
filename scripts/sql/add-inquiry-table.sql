-- ============================================
-- 添加客户询价表
-- ============================================

-- 创建客户询价表
CREATE TABLE IF NOT EXISTS customer_inquiries (
    id TEXT PRIMARY KEY,
    inquiry_number TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    inquiry_type TEXT NOT NULL,                    -- clearance, transport, both
    status TEXT DEFAULT 'pending',                 -- pending, quoted, accepted, rejected, expired
    clearance_data JSONB,                          -- 清关相关数据
    transport_data JSONB,                          -- 运输相关数据
    estimated_duty DECIMAL(12, 2) DEFAULT 0,       -- 预估关税
    estimated_vat DECIMAL(12, 2) DEFAULT 0,        -- 预估增值税
    clearance_fee DECIMAL(12, 2) DEFAULT 0,        -- 清关服务费
    transport_fee DECIMAL(12, 2) DEFAULT 0,        -- 运输费用
    total_quote DECIMAL(12, 2) DEFAULT 0,          -- 总报价
    valid_until DATE,                              -- 报价有效期
    notes TEXT,                                    -- 备注
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_customer ON customer_inquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_status ON customer_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_customer_inquiries_created ON customer_inquiries(created_at);

-- 创建卡车类型表（如果不存在）
CREATE TABLE IF NOT EXISTS truck_types (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    category TEXT,                                 -- small, medium, large, xlarge
    description TEXT,
    max_weight DECIMAL(10, 2),                     -- 最大载重 (kg)
    max_volume DECIMAL(10, 2),                     -- 最大体积 (m³)
    length DECIMAL(6, 2),                          -- 长度 (m)
    width DECIMAL(6, 2),                           -- 宽度 (m)
    height DECIMAL(6, 2),                          -- 高度 (m)
    base_rate_per_km DECIMAL(8, 2),                -- 每公里基础费率
    min_charge DECIMAL(10, 2),                     -- 最低收费
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认卡车类型（如果不存在）
INSERT INTO truck_types (code, name, name_en, category, max_weight, max_volume, length, width, height, base_rate_per_km, min_charge)
SELECT * FROM (VALUES
    ('VAN', '小型货车', 'Van', 'small', 1500, 10, 3.5, 1.8, 1.8, 1.2, 80),
    ('TRUCK_7T', '7.5吨卡车', '7.5T Truck', 'medium', 7500, 35, 6.5, 2.4, 2.4, 1.5, 150),
    ('TRUCK_18T', '18吨卡车', '18T Truck', 'large', 18000, 60, 8.0, 2.4, 2.7, 2.0, 250),
    ('TRUCK_40T', '40吨半挂', '40T Semi-Trailer', 'xlarge', 40000, 90, 13.6, 2.4, 2.7, 2.8, 400)
) AS v(code, name, name_en, category, max_weight, max_volume, length, width, height, base_rate_per_km, min_charge)
WHERE NOT EXISTS (SELECT 1 FROM truck_types WHERE code = v.code);

-- ============================================
-- 客户地址表
-- ============================================
CREATE TABLE IF NOT EXISTS customer_addresses (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    label TEXT,                                    -- 地址标签（如：仓库A、工厂）
    address TEXT NOT NULL,                         -- 完整地址
    city TEXT,                                     -- 城市
    country TEXT,                                  -- 国家
    postal_code TEXT,                              -- 邮编
    latitude DECIMAL(10, 6),                       -- 纬度
    longitude DECIMAL(10, 6),                      -- 经度
    status TEXT DEFAULT 'pending',                 -- pending, approved, rejected
    use_count INTEGER DEFAULT 0,                   -- 使用次数
    approved_by TEXT,                              -- 审核人
    approved_at TIMESTAMP,                         -- 审核时间
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_status ON customer_addresses(status);

-- ============================================
-- 地址审核任务表
-- ============================================
CREATE TABLE IF NOT EXISTS address_review_tasks (
    id TEXT PRIMARY KEY,
    address_id TEXT REFERENCES customer_addresses(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,
    customer_name TEXT,
    task_type TEXT DEFAULT 'address_review',
    status TEXT DEFAULT 'pending',                 -- pending, approved, rejected
    address_content TEXT,                          -- 地址内容
    assigned_to TEXT,                              -- 分配给谁
    assigned_to_name TEXT,
    reviewed_by TEXT,                              -- 审核人
    reviewed_by_name TEXT,
    reviewed_at TIMESTAMP,                         -- 审核时间
    notes TEXT,                                    -- 备注
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_address_review_tasks_status ON address_review_tasks(status);
CREATE INDEX IF NOT EXISTS idx_address_review_tasks_assigned ON address_review_tasks(assigned_to);

-- 完成
-- 执行：psql "$DATABASE_URL" -f scripts/sql/add-inquiry-table.sql

