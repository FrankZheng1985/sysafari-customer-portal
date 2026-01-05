-- ================================================================
-- 添加额外服务字段到 bills_of_lading 表
-- 用于支持客户门户创建订单时的附加属性和额外服务选项
-- ================================================================

-- 附加属性字段
-- cargo_type: 箱型 (拼箱/整箱)
ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS cargo_type VARCHAR(50);

-- transport_service: 运输方式 (委托我司运输/自行运输)
ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS transport_service VARCHAR(50);

-- bill_type: 提单类型 (船东单/货代单)
ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS bill_type VARCHAR(50);

-- 额外服务字段
-- container_return: 异地还柜 (异地还柜/本地还柜)
ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS container_return VARCHAR(50);

-- full_container_delivery: 全程整柜运输 (必须整柜派送/可拆柜后托盘送货)
ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS full_container_delivery VARCHAR(50);

-- last_mile_transport: 末端运输方式 (卡车派送/小型货车派送/快递派送/客户自提)
ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS last_mile_transport VARCHAR(50);

-- devan_service: 拆柜服务 (需要拆柜分货服务/不需要拆柜)
ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS devan_service VARCHAR(50);

-- t1_customs_service: 海关经停报关服务(T1报关) (是/否)
ALTER TABLE bills_of_lading 
ADD COLUMN IF NOT EXISTS t1_customs_service VARCHAR(10);

-- 添加注释
COMMENT ON COLUMN bills_of_lading.cargo_type IS '箱型: 拼箱(CFS)/整箱(FCL)';
COMMENT ON COLUMN bills_of_lading.transport_service IS '运输方式: 委托我司运输/自行运输';
COMMENT ON COLUMN bills_of_lading.bill_type IS '提单类型: 船东单(Master Bill)/货代单(House Bill)';
COMMENT ON COLUMN bills_of_lading.container_return IS '异地还柜: 异地还柜(非Rotterdam)/本地还柜';
COMMENT ON COLUMN bills_of_lading.full_container_delivery IS '全程整柜运输: 必须整柜派送/可拆柜后托盘送货';
COMMENT ON COLUMN bills_of_lading.last_mile_transport IS '末端运输方式: 卡车派送/小型货车派送/快递派送/客户自提';
COMMENT ON COLUMN bills_of_lading.devan_service IS '拆柜服务: 需要拆柜分货服务/不需要拆柜';
COMMENT ON COLUMN bills_of_lading.t1_customs_service IS 'T1报关服务: 是/否';

-- 为新字段添加索引（可选，根据查询需求）
CREATE INDEX IF NOT EXISTS idx_bol_cargo_type ON bills_of_lading(cargo_type);
CREATE INDEX IF NOT EXISTS idx_bol_bill_type ON bills_of_lading(bill_type);

-- 验证字段添加成功
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bills_of_lading' 
AND column_name IN (
  'cargo_type', 'transport_service', 'bill_type',
  'container_return', 'full_container_delivery', 'last_mile_transport',
  'devan_service', 't1_customs_service'
)
ORDER BY column_name;

