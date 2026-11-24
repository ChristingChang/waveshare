import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Provider-scoped OAuth identifier, e.g. google:123. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const videoUploads = mysqlTable("video_uploads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  videoPath: varchar("videoPath", { length: 512 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("video_uploads_user_created_idx").on(table.userId, table.createdAt)]);

export const photoUploads = mysqlTable("photo_uploads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  photoPath: varchar("photoPath", { length: 512 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("photo_uploads_user_created_idx").on(table.userId, table.createdAt)]);

export const sessionPhotos = mysqlTable("session_photos", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  userId: int("userId").notNull(),
  photoPath: varchar("photoPath", { length: 512 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("session_photos_session_idx").on(table.sessionId),
  index("session_photos_path_idx").on(table.photoPath),
]);

export type SessionPhoto = typeof sessionPhotos.$inferSelect;

/**
 * Surf sessions table - stores individual surfing records
 */
export const surfSessions = mysqlTable("surf_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
  surfHour: int("surfHour"),
  conditions: text("conditions"),
  spotName: varchar("spotName", { length: 255 }).notNull(),
  spotLat: varchar("spotLat", { length: 50 }),
  spotLng: varchar("spotLng", { length: 50 }),
  videoUrl: text("videoUrl").notNull(),
  videoPath: text("videoPath").notNull(),
  note: text("note"),
  boardType: varchar("boardType", { length: 100 }),
  waveQuality: int("waveQuality").notNull(), // 1-5 rating
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SurfSession = typeof surfSessions.$inferSelect;
export type InsertSurfSession = typeof surfSessions.$inferInsert;

export const sessionShares = mysqlTable("session_shares", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  friendId: int("friendId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("session_shares_session_friend_idx").on(table.sessionId, table.friendId)]);

/**
 * Surf spots table - stores unique surf spot locations
 */
export const surfSpots = mysqlTable("surf_spots", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  latitude: varchar("latitude", { length: 50 }),
  longitude: varchar("longitude", { length: 50 }),
  region: varchar("region", { length: 100 }),
  country: varchar("country", { length: 100 }),
  sessionCount: int("sessionCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SurfSpot = typeof surfSpots.$inferSelect;
export type InsertSurfSpot = typeof surfSpots.$inferInsert;

/**
 * Friendships table - stores friend relationships between users
 */
export const friendships = mysqlTable("friendships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // User who sent the friend request
  friendId: int("friendId").notNull(), // User who received the friend request
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = typeof friendships.$inferInsert;

export const friendInvites = mysqlTable("friend_invites", {
  inviterId: int("inviterId").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
});

/**
 * Session companions table - tracks who surfed together
 */
export const sessionCompanions = mysqlTable("session_companions", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  companionId: int("companionId").notNull(), // Friend's user ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SessionCompanion = typeof sessionCompanions.$inferSelect;
export type InsertSessionCompanion = typeof sessionCompanions.$inferInsert;