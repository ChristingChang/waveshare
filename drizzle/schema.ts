import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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

/**
 * Surf sessions table - stores individual surfing records
 */
export const surfSessions = mysqlTable("surf_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD format
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