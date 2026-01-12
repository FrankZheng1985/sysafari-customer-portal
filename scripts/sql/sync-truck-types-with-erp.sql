-- 同步卡车类型数据与ERP系统保持一致
-- 执行时间: 2026-01-12
-- 说明: 更新客户门户的卡车类型配置，使其与ERP系统完全一致

-- 先清空现有数据
DELETE FROM truck_types;

-- 重新插入与ERP一致的卡车类型数据
-- ==================== 厢式配送车 (Distribution Vehicles) ====================
INSERT INTO truck_types (code, name, name_en, category, description, max_weight, max_volume, length, width, height, base_rate_per_km, min_charge, status)
VALUES 
  ('sprinter', 'Sprinter', 'Mercedes Sprinter (3.5t)', 'distribution', '载重: 1.2t | 容积: 14m³', 1200, 14, 5.0, 1.8, 1.8, 1.0, 80, 'active'),
  ('small_van', '小型厢式车', 'Small Van (7.5t)', 'distribution', '载重: 3t | 容积: 20m³', 3000, 20, 6.0, 2.2, 2.0, 1.2, 100, 'active'),
  ('medium_van', '中型厢式车', 'Medium Van (12t)', 'distribution', '载重: 6t | 容积: 40m³', 6000, 40, 7.5, 2.4, 2.2, 1.5, 150, 'active'),
  ('large_van', '大型厢式车', 'Large Van (18t)', 'distribution', '载重: 10t | 容积: 55m³', 10000, 55, 9.0, 2.5, 2.4, 1.8, 200, 'active');

-- ==================== 半挂车/公路运输 (Semi-trailers) ====================
INSERT INTO truck_types (code, name, name_en, category, description, max_weight, max_volume, length, width, height, base_rate_per_km, min_charge, status)
VALUES 
  ('curtainsider', '篷布半挂车', 'Curtainsider (Tautliner)', 'semi_trailer', '载重: 24t | 容积: 86m³', 24000, 86, 13.6, 2.5, 2.7, 2.0, 300, 'active'),
  ('semi_40', '40尺标准半挂', 'Standard Semi (40ft)', 'semi_trailer', '载重: 25t | 容积: 76m³', 25000, 76, 12.2, 2.5, 2.6, 2.2, 320, 'active'),
  ('mega_trailer', 'Mega半挂车', 'Mega Trailer (45ft)', 'semi_trailer', '载重: 24t | 容积: 100m³', 24000, 100, 13.6, 2.5, 3.0, 2.4, 350, 'active'),
  ('double_deck', '双层半挂车', 'Double Deck Trailer', 'semi_trailer', '载重: 22t | 容积: 120m³', 22000, 120, 13.6, 2.5, 3.0, 2.5, 380, 'active');

-- ==================== 特种车辆 (Special Vehicles) ====================
INSERT INTO truck_types (code, name, name_en, category, description, max_weight, max_volume, length, width, height, base_rate_per_km, min_charge, status)
VALUES 
  ('reefer_small', '冷藏车(小)', 'Reefer Van (7.5t)', 'special', '载重: 2.5t | 温控: -25°C~+25°C', 2500, 20, 6.0, 2.2, 2.0, 1.8, 150, 'active'),
  ('reefer_large', '冷藏半挂', 'Reefer Semi-trailer', 'special', '载重: 22t | 温控: -25°C~+25°C', 22000, 80, 13.6, 2.5, 2.6, 2.8, 400, 'active'),
  ('flatbed', '平板车', 'Flatbed Trailer', 'special', '载重: 28t | 长度: 13.6m', 28000, 0, 13.6, 2.5, 0.8, 2.3, 350, 'active'),
  ('lowloader', '低板车', 'Low Loader', 'special', '载重: 40t | 适合超高货物', 40000, 0, 15.0, 3.0, 0.6, 3.5, 500, 'active'),
  ('hazmat', 'ADR危险品车', 'ADR Hazmat Truck', 'special', '载重: 22t | ADR认证', 22000, 75, 13.6, 2.5, 2.6, 3.0, 450, 'active'),
  ('tanker', '罐车', 'Tanker Truck', 'special', '容量: 30,000L | 液体运输', 25000, 30, 13.0, 2.5, 3.0, 3.2, 480, 'active');

-- 验证插入结果
SELECT category, COUNT(*) as count FROM truck_types GROUP BY category ORDER BY category;
SELECT * FROM truck_types ORDER BY category, max_weight;
