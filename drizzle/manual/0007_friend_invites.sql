CREATE TABLE IF NOT EXISTS `friend_invites` (
  `inviterId` int NOT NULL,
  `code` varchar(64) NOT NULL,
  CONSTRAINT `friend_invites_inviterId` PRIMARY KEY (`inviterId`),
  CONSTRAINT `friend_invites_code_unique` UNIQUE (`code`)
);
