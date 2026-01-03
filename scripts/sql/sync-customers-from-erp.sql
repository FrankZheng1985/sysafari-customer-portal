-- ============================================
-- 从 ERP (sysafari_dev) 同步客户数据到门户 (portal_db)
-- 执行命令: psql -d portal_db -f scripts/sql/sync-customers-from-erp.sql
-- ============================================

-- 默认密码: demo123456
-- 密码哈希: $2a$10$ofjBLiIfx/dSzhlUFjn5fOwSDUNt1Nu1kdkvuw4DPbDhrqq7MhcUO

-- 使用 dblink 从 sysafari_dev 获取数据
CREATE EXTENSION IF NOT EXISTS dblink;

-- 建立到 sysafari_dev 的连接
SELECT dblink_connect('erp_conn', 'dbname=sysafari_dev');

-- 从 ERP 同步活跃客户数据
-- email 使用: 如果有contact_email就用，否则用 customer_code 作为登录名
INSERT INTO portal_customers (
    customer_id,
    customer_code,
    email,
    password_hash,
    company_name,
    contact_name,
    phone,
    status,
    created_at,
    updated_at
)
SELECT 
    id AS customer_id,
    customer_code,
    CASE 
        WHEN contact_email IS NOT NULL AND contact_email != '' THEN contact_email
        ELSE customer_code  -- 使用客户编码作为登录名
    END AS email,
    '$2a$10$ofjBLiIfx/dSzhlUFjn5fOwSDUNt1Nu1kdkvuw4DPbDhrqq7MhcUO' AS password_hash,  -- 默认密码: demo123456
    COALESCE(company_name, customer_name) AS company_name,
    contact_person AS contact_name,
    contact_phone AS phone,
    status,
    CURRENT_TIMESTAMP AS created_at,
    CURRENT_TIMESTAMP AS updated_at
FROM dblink('erp_conn',
    'SELECT id, customer_code, customer_name, company_name, contact_person, contact_phone, contact_email, status 
     FROM customers 
     WHERE status = ''active'''
) AS erp_customers(
    id TEXT,
    customer_code TEXT,
    customer_name TEXT,
    company_name TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    status TEXT
)
ON CONFLICT (customer_id) 
DO UPDATE SET
    customer_code = EXCLUDED.customer_code,
    company_name = EXCLUDED.company_name,
    contact_name = EXCLUDED.contact_name,
    phone = EXCLUDED.phone,
    status = EXCLUDED.status,
    updated_at = CURRENT_TIMESTAMP;

-- 断开连接
SELECT dblink_disconnect('erp_conn');

-- 显示同步结果
SELECT id, customer_id, customer_code, email, company_name, contact_name, phone, status 
FROM portal_customers 
ORDER BY id;

