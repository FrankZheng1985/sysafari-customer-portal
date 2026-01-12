-- ============================================
-- 更新卡车类型 - 完善欧洲卡车分类
-- ============================================

-- 先清空现有数据（如果需要重建）
-- TRUNCATE truck_types RESTART IDENTITY;

-- 或者更新现有数据并添加新数据
-- 先删除所有现有记录
DELETE FROM truck_types;

-- 重置自增ID
ALTER SEQUENCE truck_types_id_seq RESTART WITH 1;

-- 插入完整的欧洲卡车类型（按分类）
INSERT INTO truck_types (code, name, name_en, category, description, max_weight, max_volume, length, width, height, base_rate_per_km, min_charge, status)
VALUES

-- ===== 1. 厢式货车 (Van) - category: 'van' =====
('VAN_SMALL', '小型厢式车', 'Small Van (3.5t)', 'van', 
 '3.5吨以下城市配送车，适合小批量、最后一公里配送', 
 1500, 12, 3.2, 1.8, 1.8, 1.2, 80, 'active'),
 
('VAN_MEDIUM', '中型厢式车', 'Medium Van (7.5t)', 'van', 
 '7.5吨城市货车，适合中等批量城市/近郊配送', 
 3500, 25, 5.0, 2.2, 2.2, 1.5, 120, 'active'),

-- ===== 2. 箱式卡车 (Rigid Truck) - category: 'rigid' =====
('RIGID_12T', '大型箱式车', 'Box Truck (12t)', 'rigid', 
 '12吨刚性底盘箱式卡车，中短途标准货物运输', 
 6000, 45, 7.2, 2.4, 2.4, 1.8, 180, 'active'),

('RIGID_18T', '重型箱式车', 'Heavy Box Truck (18t)', 'rigid', 
 '18吨重型箱式卡车，中长途大批量货物运输', 
 10000, 55, 8.5, 2.4, 2.6, 2.0, 220, 'active'),

('RIGID_26T', '超重型箱式车', 'Heavy Duty Truck (26t)', 'rigid', 
 '26吨超重型卡车，适合重货和大批量运输', 
 15000, 70, 9.5, 2.4, 2.7, 2.3, 280, 'active'),

-- ===== 3. 半挂车 (Semi-Trailer) - category: 'semi' =====
('SEMI_STANDARD', '标准半挂车', 'Standard Semi-Trailer (40ft)', 'semi', 
 '40尺标准半挂车(13.6m)，欧洲最常用的长途运输车型', 
 25000, 76, 13.6, 2.45, 2.7, 2.5, 350, 'active'),

('SEMI_MEGA', '超大半挂车', 'Mega Trailer (45ft)', 'semi', 
 '45尺加长半挂车，超高内部空间，适合轻泡货物', 
 24000, 100, 13.6, 2.45, 3.0, 2.8, 400, 'active'),

('CURTAIN_STANDARD', '标准侧帘车', 'Curtainsider (40ft)', 'semi', 
 '侧帘半挂车，便于叉车侧面装卸货物', 
 24000, 76, 13.6, 2.45, 2.7, 2.5, 350, 'active'),

-- ===== 4. 冷藏车 (Reefer) - category: 'reefer' =====
('REEFER_SMALL', '小型冷藏车', 'Small Reefer (7.5t)', 'reefer', 
 '7.5吨冷藏车，城市/近郊温控配送', 
 3000, 20, 5.0, 2.2, 2.0, 2.0, 180, 'active'),

('REEFER_MEDIUM', '中型冷藏车', 'Medium Reefer (18t)', 'reefer', 
 '18吨冷藏卡车，中距离温控运输', 
 8000, 40, 7.5, 2.4, 2.4, 2.5, 280, 'active'),

('REEFER_SEMI', '冷藏半挂车', 'Reefer Semi-Trailer (40ft)', 'reefer', 
 '40尺冷藏半挂车，长途温控运输，-25°C至+25°C', 
 22000, 67, 13.4, 2.45, 2.5, 3.5, 500, 'active'),

-- ===== 5. 特种车辆 (Special) - category: 'special' =====
('FLATBED_STANDARD', '标准平板车', 'Flatbed Trailer (40ft)', 'special', 
 '40尺平板半挂车，适合机械设备、钢材等不规则货物', 
 30000, NULL, 13.6, 2.45, 0.0, 2.8, 400, 'active'),

('LOWLOADER', '低平板车', 'Low Loader', 'special', 
 '超低平板车，适合超高货物、工程机械运输', 
 35000, NULL, 12.0, 2.55, 0.0, 4.5, 800, 'active'),

('HAZMAT_TRUCK', '危险品车', 'Hazmat Truck (ADR)', 'special', 
 'ADR认证危险品运输车，需特殊许可', 
 20000, 50, 8.0, 2.4, 2.5, 4.0, 600, 'active'),

('TANKER_LIQUID', '液体罐车', 'Liquid Tanker', 'special', 
 '液体罐车，食品级/化工品液体运输', 
 25000, 30000, 12.0, 2.5, 3.5, 3.8, 550, 'active');

-- 添加注释
COMMENT ON COLUMN truck_types.category IS '车型分类: van-厢式货车, rigid-箱式卡车, semi-半挂车, reefer-冷藏车, special-特种车辆';

-- 验证插入结果
SELECT category, code, name, name_en, max_weight, max_volume, base_rate_per_km 
FROM truck_types 
ORDER BY 
  CASE category 
    WHEN 'van' THEN 1 
    WHEN 'rigid' THEN 2 
    WHEN 'semi' THEN 3 
    WHEN 'reefer' THEN 4 
    WHEN 'special' THEN 5 
  END, 
  max_weight;

-- 完成
-- 执行：psql "$DATABASE_URL" -f scripts/sql/update-truck-types.sql
