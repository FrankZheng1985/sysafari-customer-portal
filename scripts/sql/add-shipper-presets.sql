-- ============================================
-- 发货人预设表 (shipper_presets)
-- 用于存储客户的发货人预设信息
-- 支持同步到ERP客户管理系统
-- ============================================

-- 创建发货人预设表
CREATE TABLE IF NOT EXISTS shipper_presets (
    id VARCHAR(50) PRIMARY KEY,                    -- UUID主键
    customer_id VARCHAR(50) NOT NULL,              -- 所属客户ID（关联portal_customers）
    
    -- 基本信息
    name VARCHAR(255) NOT NULL,                    -- 发货人名称/公司名
    name_en VARCHAR(255),                          -- 英文名称
    short_name VARCHAR(100),                       -- 简称（用于快速选择）
    
    -- 地址信息
    country VARCHAR(100),                          -- 国家
    province VARCHAR(100),                         -- 省/州
    city VARCHAR(100),                             -- 城市
    district VARCHAR(100),                         -- 区/县
    address TEXT,                                  -- 详细地址
    address_en TEXT,                               -- 英文地址
    postal_code VARCHAR(20),                       -- 邮政编码
    
    -- 联系信息
    contact_person VARCHAR(100),                   -- 联系人
    contact_phone VARCHAR(50),                     -- 联系电话
    mobile VARCHAR(50),                            -- 手机号
    email VARCHAR(255),                            -- 邮箱
    fax VARCHAR(50),                               -- 传真
    
    -- 商务信息
    tax_number VARCHAR(100),                       -- 税号/统一社会信用代码
    eori_number VARCHAR(50),                       -- EORI号（欧盟经济运营商识别号）
    
    -- 显示配置
    is_default BOOLEAN DEFAULT FALSE,             -- 是否为默认发货人
    display_format TEXT,                          -- 格式化后的显示文本（用于订单）
    sort_order INTEGER DEFAULT 0,                  -- 排序顺序
    
    -- ERP同步状态
    erp_synced BOOLEAN DEFAULT FALSE,             -- 是否已同步到ERP
    erp_shipper_id VARCHAR(50),                   -- ERP系统中的发货人ID
    erp_synced_at TIMESTAMP WITH TIME ZONE,       -- 最后同步时间
    sync_error TEXT,                               -- 同步错误信息
    
    -- 状态
    status VARCHAR(20) DEFAULT 'active',           -- 状态: active(启用), inactive(停用), deleted(删除)
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_shipper_presets_customer ON shipper_presets(customer_id);
CREATE INDEX IF NOT EXISTS idx_shipper_presets_status ON shipper_presets(status);
CREATE INDEX IF NOT EXISTS idx_shipper_presets_default ON shipper_presets(customer_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_shipper_presets_erp_synced ON shipper_presets(erp_synced);

-- 注释
COMMENT ON TABLE shipper_presets IS '发货人预设表 - 存储客户常用发货人信息';
COMMENT ON COLUMN shipper_presets.customer_id IS '所属客户ID';
COMMENT ON COLUMN shipper_presets.display_format IS '格式化显示文本，用于填充订单发货人字段';
COMMENT ON COLUMN shipper_presets.erp_synced IS '是否已同步到ERP客户管理系统';
COMMENT ON COLUMN shipper_presets.erp_shipper_id IS 'ERP系统中对应的发货人/联系人ID';

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_shipper_presets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_shipper_presets_updated_at ON shipper_presets;
CREATE TRIGGER trigger_shipper_presets_updated_at
    BEFORE UPDATE ON shipper_presets
    FOR EACH ROW
    EXECUTE FUNCTION update_shipper_presets_updated_at();

-- 确保每个客户只有一个默认发货人的触发器
CREATE OR REPLACE FUNCTION ensure_single_default_shipper()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        -- 将该客户的其他发货人设为非默认
        UPDATE shipper_presets 
        SET is_default = FALSE 
        WHERE customer_id = NEW.customer_id 
          AND id != NEW.id 
          AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_ensure_single_default_shipper ON shipper_presets;
CREATE TRIGGER trigger_ensure_single_default_shipper
    BEFORE INSERT OR UPDATE OF is_default ON shipper_presets
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION ensure_single_default_shipper();

-- ============================================
-- 同理创建收货人预设表 (consignee_presets)
-- 结构与发货人表相似
-- ============================================

CREATE TABLE IF NOT EXISTS consignee_presets (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    
    -- 基本信息
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    short_name VARCHAR(100),
    
    -- 地址信息
    country VARCHAR(100),
    province VARCHAR(100),
    city VARCHAR(100),
    district VARCHAR(100),
    address TEXT,
    address_en TEXT,
    postal_code VARCHAR(20),
    
    -- 联系信息
    contact_person VARCHAR(100),
    contact_phone VARCHAR(50),
    mobile VARCHAR(50),
    email VARCHAR(255),
    fax VARCHAR(50),
    
    -- 商务信息
    tax_number VARCHAR(100),
    eori_number VARCHAR(50),
    vat_number VARCHAR(50),                        -- 增值税号
    
    -- 显示配置
    is_default BOOLEAN DEFAULT FALSE,
    display_format TEXT,
    sort_order INTEGER DEFAULT 0,
    
    -- ERP同步状态
    erp_synced BOOLEAN DEFAULT FALSE,
    erp_consignee_id VARCHAR(50),
    erp_synced_at TIMESTAMP WITH TIME ZONE,
    sync_error TEXT,
    
    -- 状态
    status VARCHAR(20) DEFAULT 'active',
    
    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_consignee_presets_customer ON consignee_presets(customer_id);
CREATE INDEX IF NOT EXISTS idx_consignee_presets_status ON consignee_presets(status);
CREATE INDEX IF NOT EXISTS idx_consignee_presets_default ON consignee_presets(customer_id, is_default) WHERE is_default = TRUE;

-- 注释
COMMENT ON TABLE consignee_presets IS '收货人预设表 - 存储客户常用收货人信息';

-- 更新时间触发器
DROP TRIGGER IF EXISTS trigger_consignee_presets_updated_at ON consignee_presets;
CREATE TRIGGER trigger_consignee_presets_updated_at
    BEFORE UPDATE ON consignee_presets
    FOR EACH ROW
    EXECUTE FUNCTION update_shipper_presets_updated_at();

-- 确保每个客户只有一个默认收货人
CREATE OR REPLACE FUNCTION ensure_single_default_consignee()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        UPDATE consignee_presets 
        SET is_default = FALSE 
        WHERE customer_id = NEW.customer_id 
          AND id != NEW.id 
          AND is_default = TRUE;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_ensure_single_default_consignee ON consignee_presets;
CREATE TRIGGER trigger_ensure_single_default_consignee
    BEFORE INSERT OR UPDATE OF is_default ON consignee_presets
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION ensure_single_default_consignee();

-- ============================================
-- 完成
-- ============================================
SELECT 'add-shipper-presets.sql executed successfully' AS message;

