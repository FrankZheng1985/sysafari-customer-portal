-- ================================================================
-- 清关匹配功能扩展 - 数据库迁移脚本
-- 用于支持Excel上传、单证匹配、客户确认/取消等功能
-- 
-- 执行时间：2026-01-02
-- 作者：系统开发
-- ================================================================

-- 1. 创建客户上传文件表
CREATE TABLE IF NOT EXISTS customer_uploaded_files (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(50) DEFAULT 'cargo_excel',  -- cargo_excel, bill_of_lading, packing_list 等
    item_count INTEGER DEFAULT 0,
    parsed_data JSONB,  -- 解析后的数据（JSON格式）
    status VARCHAR(20) DEFAULT 'active',  -- active, deleted, processed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_uploaded_files_customer ON customer_uploaded_files(customer_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_type ON customer_uploaded_files(file_type);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_status ON customer_uploaded_files(status);

-- 添加注释
COMMENT ON TABLE customer_uploaded_files IS '客户上传文件表';
COMMENT ON COLUMN customer_uploaded_files.file_type IS '文件类型：cargo_excel-货物Excel, bill_of_lading-提单, packing_list-装箱单';
COMMENT ON COLUMN customer_uploaded_files.parsed_data IS '解析后的结构化数据';

-- 2. 为 customer_inquiries 表添加匹配相关字段
-- 注意：如果字段已存在会报错，可以忽略

-- 匹配状态
ALTER TABLE customer_inquiries 
ADD COLUMN IF NOT EXISTS matching_status VARCHAR(20) DEFAULT 'pending';
-- pending: 待匹配, matched: 已匹配待确认, confirmed: 客户已确认, rejected: 客户已拒绝

-- 匹配后的货物明细（由单证部门填写）
ALTER TABLE customer_inquiries 
ADD COLUMN IF NOT EXISTS matched_items JSONB;

-- 匹配时间
ALTER TABLE customer_inquiries 
ADD COLUMN IF NOT EXISTS matched_at TIMESTAMP WITH TIME ZONE;

-- 确认时间
ALTER TABLE customer_inquiries 
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;

-- 拒绝时间
ALTER TABLE customer_inquiries 
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

-- 拒绝原因
ALTER TABLE customer_inquiries 
ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- 关联的上传文件ID
ALTER TABLE customer_inquiries 
ADD COLUMN IF NOT EXISTS uploaded_file_id VARCHAR(50);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_inquiries_matching_status ON customer_inquiries(matching_status);
CREATE INDEX IF NOT EXISTS idx_inquiries_matched_at ON customer_inquiries(matched_at);

-- 添加注释
COMMENT ON COLUMN customer_inquiries.matching_status IS '匹配状态：pending-待匹配, matched-已匹配待确认, confirmed-已确认, rejected-已拒绝';
COMMENT ON COLUMN customer_inquiries.matched_items IS '单证部门匹配后的货物明细（含HS CODE、关税等）';
COMMENT ON COLUMN customer_inquiries.reject_reason IS '客户拒绝/取消的原因';

-- 3. 创建匹配历史记录表（用于追踪匹配过程）
CREATE TABLE IF NOT EXISTS inquiry_matching_history (
    id SERIAL PRIMARY KEY,
    inquiry_id VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,  -- created, matched, confirmed, rejected, resubmitted
    actor_type VARCHAR(20),       -- customer, operator, system
    actor_id VARCHAR(50),
    actor_name VARCHAR(255),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_matching_history_inquiry ON inquiry_matching_history(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_matching_history_created ON inquiry_matching_history(created_at);

-- 添加注释
COMMENT ON TABLE inquiry_matching_history IS '询价匹配历史记录表';
COMMENT ON COLUMN inquiry_matching_history.action IS '操作类型：created-创建, matched-匹配完成, confirmed-确认, rejected-拒绝';
COMMENT ON COLUMN inquiry_matching_history.actor_type IS '操作者类型：customer-客户, operator-操作员, system-系统';

-- 4. 更新现有数据（将现有询价的matching_status设为pending）
UPDATE customer_inquiries 
SET matching_status = 'pending' 
WHERE matching_status IS NULL;

-- ================================================================
-- 完成提示
-- ================================================================
SELECT '数据库迁移完成！' AS message;
SELECT 
    'customer_uploaded_files' AS table_name, 
    COUNT(*) AS row_count 
FROM customer_uploaded_files
UNION ALL
SELECT 
    'customer_inquiries (with matching_status)' AS table_name, 
    COUNT(*) AS row_count 
FROM customer_inquiries 
WHERE matching_status IS NOT NULL;

