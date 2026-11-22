-- 照片功能需要的兩個資料表（PR #14）。
-- 在 TiDB Cloud 的 SQL Editor 選擇 waveshare 資料庫，整段貼上執行即可；重複執行也不會出錯。
CREATE TABLE IF NOT EXISTS `photo_uploads` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `photoPath` varchar(512) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `photo_uploads_id` PRIMARY KEY(`id`),
  INDEX `photo_uploads_user_created_idx` (`userId`, `createdAt`)
);

CREATE TABLE IF NOT EXISTS `session_photos` (
  `id` int AUTO_INCREMENT NOT NULL,
  `sessionId` int NOT NULL,
  `userId` int NOT NULL,
  `photoPath` varchar(512) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `session_photos_id` PRIMARY KEY(`id`),
  INDEX `session_photos_session_idx` (`sessionId`),
  INDEX `session_photos_path_idx` (`photoPath`)
);
