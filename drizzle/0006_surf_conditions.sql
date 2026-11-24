-- 浪況與下水時間欄位；可在 TiDB 重複執行。
ALTER TABLE `surf_sessions` ADD COLUMN IF NOT EXISTS `surfHour` int;
--> statement-breakpoint
ALTER TABLE `surf_sessions` ADD COLUMN IF NOT EXISTS `conditions` text;
