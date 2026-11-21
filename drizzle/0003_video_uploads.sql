CREATE TABLE `video_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`videoPath` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `video_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `video_uploads_user_created_idx` ON `video_uploads` (`userId`,`createdAt`);