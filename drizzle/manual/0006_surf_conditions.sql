-- 自動浪況與下水時間：在 TiDB Cloud SQL Editor 選擇 waveshare 資料庫執行。
-- 重複執行也不會出錯。
ALTER TABLE `surf_sessions` ADD COLUMN IF NOT EXISTS `surfHour` int;
ALTER TABLE `surf_sessions` ADD COLUMN IF NOT EXISTS `conditions` text;
