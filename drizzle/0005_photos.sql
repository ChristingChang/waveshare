CREATE TABLE `photo_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`photoPath` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `photo_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`userId` int NOT NULL,
	`photoPath` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `photo_uploads_user_created_idx` ON `photo_uploads` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `session_photos_session_idx` ON `session_photos` (`sessionId`);--> statement-breakpoint
CREATE INDEX `session_photos_path_idx` ON `session_photos` (`photoPath`);