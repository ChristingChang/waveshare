CREATE TABLE `surf_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`spotName` varchar(255) NOT NULL,
	`spotLat` varchar(50),
	`spotLng` varchar(50),
	`videoUrl` text NOT NULL,
	`videoPath` text NOT NULL,
	`note` text,
	`boardType` varchar(100),
	`waveQuality` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `surf_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `surf_spots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`latitude` varchar(50),
	`longitude` varchar(50),
	`region` varchar(100),
	`country` varchar(100),
	`sessionCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `surf_spots_id` PRIMARY KEY(`id`),
	CONSTRAINT `surf_spots_name_unique` UNIQUE(`name`)
);
