-- ============================================
-- 添加 customer_code 字段到 portal_customers 表
-- 用于存储从 ERP 获取的真正客户代码（如 "AY001"）
-- ============================================

-- 添加 customer_code 字段
ALTER TABLE portal_customers 
ADD COLUMN IF NOT EXISTS customer_code VARCHAR(50);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_portal_customers_customer_code ON portal_customers(customer_code);

-- 添加注释
COMMENT ON COLUMN portal_customers.customer_code IS 'ERP系统中的客户代码（如 AY001），区别于 customer_id（UUID）';

-- 验证
SELECT 'add-customer-code.sql executed successfully' AS message;

