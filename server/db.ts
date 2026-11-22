import { TRPCError } from "@trpc/server";
import { and, desc, eq, exists, or } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { InsertUser, users } from "../drizzle/schema.js";
import { databaseConfig } from "./_core/databaseConfig.js";
import { friendships, sessionShares, surfSessions } from "../drizzle/schema.js";
import { withPlaybackUrl } from "./r2.js";

type Database = MySql2Database<Record<string, unknown>>;

let _db: Database | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = createPool({
        ...databaseConfig(process.env.DATABASE_URL, process.env.DATABASE_SSL),
        connectionLimit: 3,
        maxIdle: 1,
        idleTimeout: 60_000,
        waitForConnections: true,
      });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to initialize connection pool");
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Surf Sessions Queries
 */

// Get user's recent surf sessions
export async function getUserRecentSessions(userId: number, limit: number = 3) {
  const db = await getDb();
  if (!db) return [];
  
  const { surfSessions } = await import("../drizzle/schema.js");
  const result = await db
    .select()
    .from(surfSessions)
    .where(eq(surfSessions.userId, userId))
    .orderBy(desc(surfSessions.date), desc(surfSessions.createdAt), desc(surfSessions.id))
    .limit(limit);
  
  return result;
}

// Get all user's surf sessions
export async function getUserAllSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { surfSessions } = await import("../drizzle/schema.js");
  const result = await db
    .select()
    .from(surfSessions)
    .where(eq(surfSessions.userId, userId))
    .orderBy(surfSessions.date);
  
  return result;
}

// Get sessions by date range
export async function getUserSessionsByDateRange(
  userId: number,
  startDate: string,
  endDate: string
) {
  const db = await getDb();
  if (!db) return [];
  
  const { surfSessions } = await import("../drizzle/schema.js");
  const { and, gte, lte } = await import("drizzle-orm");
  
  const result = await db
    .select()
    .from(surfSessions)
    .where(
      and(
        eq(surfSessions.userId, userId),
        gte(surfSessions.date, startDate),
        lte(surfSessions.date, endDate)
      )
    )
    .orderBy(surfSessions.date);
  
  return result;
}

// Get single session by ID
export async function getSessionById(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const { surfSessions } = await import("../drizzle/schema.js");
  const { and } = await import("drizzle-orm");
  
  const result = await db
    .select()
    .from(surfSessions)
    .where(
      and(
        eq(surfSessions.id, sessionId),
        eq(surfSessions.userId, userId)
      )
    )
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

export async function getSessionShareIds(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ friendId: sessionShares.friendId }).from(sessionShares)
    .where(eq(sessionShares.sessionId, sessionId));
  return rows.map(row => row.friendId);
}

export async function setSessionShares(sessionId: number, ownerId: number, friendIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const [session] = await tx.select().from(surfSessions)
      .where(and(eq(surfSessions.id, sessionId), eq(surfSessions.userId, ownerId))).for("update");
    if (!session) throw new Error("Session not found");
    const friends = await tx.select().from(friendships).where(and(
      eq(friendships.status, "accepted"),
      or(eq(friendships.userId, ownerId), eq(friendships.friendId, ownerId)),
    ));
    const accepted = new Set(friends.map(friend => friend.userId === ownerId ? friend.friendId : friend.userId));
    const ids = Array.from(new Set(friendIds)).filter(id => id !== ownerId && accepted.has(id));
    await tx.delete(sessionShares).where(eq(sessionShares.sessionId, sessionId));
    if (ids.length) await tx.insert(sessionShares).values(ids.map(friendId => ({ sessionId, friendId })));
    return ids;
  });
}

function acceptedFriendship(viewerId: number) {
  return and(eq(friendships.status, "accepted"), or(
    and(eq(friendships.userId, surfSessions.userId), eq(friendships.friendId, viewerId)),
    and(eq(friendships.friendId, surfSessions.userId), eq(friendships.userId, viewerId)),
  ));
}

export async function getSessionsSharedWithUser(viewerId: number, sessionId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ session: surfSessions, ownerName: users.name }).from(sessionShares)
    .innerJoin(surfSessions, eq(surfSessions.id, sessionShares.sessionId))
    .innerJoin(users, eq(users.id, surfSessions.userId))
    .where(and(eq(sessionShares.friendId, viewerId),
      sessionId === undefined ? undefined : eq(surfSessions.id, sessionId),
      exists(db.select({ id: friendships.id }).from(friendships).where(acceptedFriendship(viewerId))),
    ))
    .orderBy(desc(surfSessions.date), desc(surfSessions.createdAt), desc(surfSessions.id));
  return rows.map(({ session, ownerName }) => ({ ...withPlaybackUrl(session), ownerName }));
}

export async function canFriendViewSession(sessionId: number, viewerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ id: sessionShares.id }).from(sessionShares)
    .innerJoin(surfSessions, eq(surfSessions.id, sessionShares.sessionId))
    .where(and(eq(sessionShares.sessionId, sessionId), eq(sessionShares.friendId, viewerId),
      exists(db.select({ id: friendships.id }).from(friendships).where(acceptedFriendship(viewerId))),
    )).limit(1);
  return rows.length > 0;
}

export async function getSessionVideo(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { surfSessions } = await import("../drizzle/schema.js");

  const result = await db
    .select({ id: surfSessions.id, userId: surfSessions.userId, videoPath: surfSessions.videoPath, videoUrl: surfSessions.videoUrl })
    .from(surfSessions)
    .where(eq(surfSessions.id, sessionId))
    .limit(1);

  return result[0];
}

// Create new surf session
export async function createSurfSession(session: {
  userId: number;
  date: string;
  spotName: string;
  spotLat?: string;
  spotLng?: string;
  videoUrl: string;
  videoPath: string;
  note?: string;
  boardType?: string;
  waveQuality: number;
}, photoPaths: string[] = [], companionIds?: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const { surfSessions, sessionPhotos } = await import("../drizzle/schema.js");

  return db.transaction(async tx => {
    const ids = companionIds?.length ? await validateCompanions(tx, session.userId, companionIds) : [];
    const result = await tx.insert(surfSessions).values(session);
    const sessionId = result[0].insertId;
    if (photoPaths.length) {
      await tx.insert(sessionPhotos).values(photoPaths.map(photoPath => ({ sessionId, userId: session.userId, photoPath })));
    }
    await insertSessionCompanions(tx, sessionId, ids);
    return result;
  });
}

/**
 * Session Photos
 */

// Lets record pages keep working if the photo tables have not been created yet.
export function isMissingTableError(error: unknown): boolean {
  for (let e = error as { errno?: number; code?: string; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (e.errno === 1146 || e.code === "ER_NO_SUCH_TABLE") return true;
  }
  return false;
}

export async function getSessionPhotos(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  const { sessionPhotos } = await import("../drizzle/schema.js");
  const { and, asc } = await import("drizzle-orm");
  try {
    return await db.select().from(sessionPhotos)
      .where(and(eq(sessionPhotos.sessionId, sessionId), eq(sessionPhotos.userId, userId)))
      .orderBy(asc(sessionPhotos.id));
  } catch (error) {
    if (isMissingTableError(error)) return [];
    throw error;
  }
}

export async function getSessionPhoto(photoId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { sessionPhotos } = await import("../drizzle/schema.js");
  const result = await db.select({
    id: sessionPhotos.id, sessionId: sessionPhotos.sessionId, userId: sessionPhotos.userId, photoPath: sessionPhotos.photoPath,
  }).from(sessionPhotos).where(eq(sessionPhotos.id, photoId)).limit(1);
  return result[0];
}

// Removes and adds a session's photos in one transaction; returns the removed rows.
export async function changeSessionPhotos(sessionId: number, userId: number, removeIds: number[], addPaths: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { sessionPhotos } = await import("../drizzle/schema.js");
  const { and, inArray } = await import("drizzle-orm");
  return db.transaction(async tx => {
    let removed: (typeof sessionPhotos.$inferSelect)[] = [];
    if (removeIds.length) {
      const condition = and(eq(sessionPhotos.sessionId, sessionId), eq(sessionPhotos.userId, userId), inArray(sessionPhotos.id, removeIds));
      removed = await tx.select().from(sessionPhotos).where(condition);
      if (removed.length) await tx.delete(sessionPhotos).where(condition);
    }
    if (addPaths.length) {
      await tx.insert(sessionPhotos).values(addPaths.map(photoPath => ({ sessionId, userId, photoPath })));
    }
    return removed;
  });
}

// Removes the given photos (or all of the session's photos) and returns the removed rows.
export async function removeSessionPhotos(sessionId: number, userId: number, photoIds?: number[]) {
  if (photoIds && !photoIds.length) return [];
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { sessionPhotos } = await import("../drizzle/schema.js");
  const { and, inArray } = await import("drizzle-orm");
  const condition = and(
    eq(sessionPhotos.sessionId, sessionId),
    eq(sessionPhotos.userId, userId),
    photoIds ? inArray(sessionPhotos.id, photoIds) : undefined,
  );
  let rows;
  try {
    rows = await db.select().from(sessionPhotos).where(condition);
  } catch (error) {
    if (!photoIds && isMissingTableError(error)) return [];
    throw error;
  }
  if (rows.length) await db.delete(sessionPhotos).where(condition);
  return rows;
}

export async function isPhotoPathReferenced(photoPath: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { sessionPhotos } = await import("../drizzle/schema.js");
  const matches = await db.select({ id: sessionPhotos.id })
    .from(sessionPhotos)
    .where(eq(sessionPhotos.photoPath, photoPath))
    .limit(1);
  return matches.length > 0;
}

// Update surf session
export async function updateSurfSession(
  sessionId: number,
  userId: number,
  updates: {
    videoPath?: string;
    videoUrl?: string;
    date?: string;
    spotName?: string;
    spotLat?: string;
    spotLng?: string;
    note?: string;
    boardType?: string;
    waveQuality?: number;
  },
  companionIds?: number[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { surfSessions } = await import("../drizzle/schema.js");
  const ownedSession = and(eq(surfSessions.id, sessionId), eq(surfSessions.userId, userId));
  if (companionIds === undefined) {
    return db.update(surfSessions).set(updates).where(ownedSession);
  }

  return db.transaction(async tx => {
    const [session] = await tx.select({ id: surfSessions.id }).from(surfSessions)
      .where(ownedSession).for("update");
    if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "找不到此紀錄" });

    const ids = await validateCompanions(tx, userId, companionIds);
    const result = Object.values(updates).some(value => value !== undefined)
      ? await tx.update(surfSessions).set(updates).where(ownedSession)
      : undefined;
    await removeSessionCompanions(tx, sessionId);
    await insertSessionCompanions(tx, sessionId, ids);
    return result;
  });
}

// Get board type statistics
export async function getBoardTypeStats(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { surfSessions } = await import("../drizzle/schema.js");
  const { sql } = await import("drizzle-orm");
  
  const result = await db
    .select({
      boardType: surfSessions.boardType,
      count: sql<number>`count(*)`
    })
    .from(surfSessions)
    .where(eq(surfSessions.userId, userId))
    .groupBy(surfSessions.boardType)
    .orderBy(sql`count(*) desc`);
  
  return result.filter(r => r.boardType !== null);
}

/**
 * Friends Management Queries
 */

// Send friend request
export async function sendFriendRequest(userId: number, friendId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { friendships } = await import("../drizzle/schema.js");
  
  // Check if friendship already exists
  const { or, and } = await import("drizzle-orm");
  const existing = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)),
        and(eq(friendships.userId, friendId), eq(friendships.friendId, userId))
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    throw new Error("Friend request already exists");
  }
  
  const result = await db.insert(friendships).values({
    userId,
    friendId,
    status: "pending",
  });
  
  return result;
}

// Accept friend request
export async function acceptFriendRequest(requestId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { friendships } = await import("../drizzle/schema.js");
  const { and } = await import("drizzle-orm");
  
  const result = await db
    .update(friendships)
    .set({ status: "accepted" })
    .where(
      and(
        eq(friendships.id, requestId),
        eq(friendships.friendId, userId),
        eq(friendships.status, "pending")
      )
    );
  
  return result;
}

// Reject friend request
export async function rejectFriendRequest(requestId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const { friendships } = await import("../drizzle/schema.js");
  const { and } = await import("drizzle-orm");
  
  const result = await db
    .update(friendships)
    .set({ status: "rejected" })
    .where(
      and(
        eq(friendships.id, requestId),
        eq(friendships.friendId, userId),
        eq(friendships.status, "pending")
      )
    );
  
  return result;
}

// Get user's friends list
export async function getUserFriends(userId: number) {
  const db = await getDb();
  return db ? selectUserFriends(db, userId) : [];
}

async function selectUserFriends(db: Database, userId: number) {
  const { friendships, users } = await import("../drizzle/schema.js");
  const { or, and } = await import("drizzle-orm");
  
  const result = await db
    .select({
      id: friendships.id,
      userId: friendships.userId,
      friendId: friendships.friendId,
      status: friendships.status,
      friendName: users.name,
      friendEmail: users.email,
    })
    .from(friendships)
    .leftJoin(
      users,
      or(
        and(
          eq(friendships.userId, userId),
          eq(users.id, friendships.friendId)
        ),
        and(
          eq(friendships.friendId, userId),
          eq(users.id, friendships.userId)
        )
      )
    )
    .where(
      and(
        or(
          eq(friendships.userId, userId),
          eq(friendships.friendId, userId)
        ),
        eq(friendships.status, "accepted")
      )
    );
  
  return result;
}

// Get pending friend requests
export async function getPendingRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { friendships, users } = await import("../drizzle/schema.js");
  const { and } = await import("drizzle-orm");
  
  const result = await db
    .select({
      id: friendships.id,
      userId: friendships.userId,
      userName: users.name,
      userEmail: users.email,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .leftJoin(users, eq(users.id, friendships.userId))
    .where(
      and(
        eq(friendships.friendId, userId),
        eq(friendships.status, "pending")
      )
    );
  
  return result;
}

// Search users by name
export async function searchUsers(query: string, currentUserId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { users } = await import("../drizzle/schema.js");
  const { and, like, ne } = await import("drizzle-orm");
  
  const searchPattern = `%${query}%`;
  
  const result = await db
    .select({
      id: users.id,
      name: users.name,
    })
    .from(users)
    .where(
      and(
        like(users.name, searchPattern),
        ne(users.id, currentUserId)
      )
    )
    .limit(10);
  
  return result;
}

/**
 * Session Companions Management
 */

async function validateCompanions(db: Database, userId: number, companionIds: number[]) {
  const ids = Array.from(new Set(companionIds));
  if (!ids.length) return ids;
  const friends = await selectUserFriends(db, userId);
  const acceptedIds = new Set(friends.map(friend => friend.userId === userId ? friend.friendId : friend.userId));
  if (ids.some(id => id === userId || !acceptedIds.has(id))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "只能標記已接受好友邀請的好友" });
  }
  return ids;
}

async function insertSessionCompanions(db: Database, sessionId: number, companionIds: number[]) {
  if (companionIds.length === 0) return;
  
  const { sessionCompanions } = await import("../drizzle/schema.js");
  
  const values = companionIds.map(companionId => ({
    sessionId,
    companionId,
  }));
  
  await db.insert(sessionCompanions).values(values);
}

async function removeSessionCompanions(db: Database, sessionId: number) {
  const { sessionCompanions } = await import("../drizzle/schema.js");
  
  await db.delete(sessionCompanions).where(eq(sessionCompanions.sessionId, sessionId));
}

// Get companions for a session
export async function getSessionCompanions(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { sessionCompanions, surfSessions, users } = await import("../drizzle/schema.js");
  
  const result = await db
    .select({
      companionId: sessionCompanions.companionId,
      name: users.name,
      email: users.email,
    })
    .from(sessionCompanions)
    .innerJoin(surfSessions, eq(surfSessions.id, sessionCompanions.sessionId))
    .leftJoin(users, eq(users.id, sessionCompanions.companionId))
    .where(and(eq(sessionCompanions.sessionId, sessionId), eq(surfSessions.userId, userId)))
    .orderBy(sessionCompanions.id);
  
  return result;
}

// Delete surf session
export async function deleteSurfSession(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const ownedSession = and(eq(surfSessions.id, sessionId), eq(surfSessions.userId, userId));
  return db.transaction(async tx => {
    const [session] = await tx.select({ id: surfSessions.id }).from(surfSessions)
      .where(ownedSession).for("update");
    if (!session) return;
    await tx.delete(sessionShares).where(eq(sessionShares.sessionId, sessionId));
    await removeSessionCompanions(tx, sessionId);
    return tx.delete(surfSessions).where(ownedSession);
  });
}

export async function isVideoPathReferenced(videoPath: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const { surfSessions } = await import("../drizzle/schema.js");
  const matches = await db.select({ id: surfSessions.id })
    .from(surfSessions)
    .where(eq(surfSessions.videoPath, videoPath))
    .limit(1);
  return matches.length > 0;
}

// Get user statistics
export async function getUserStats(userId: number) {
  const db = await getDb();
  if (!db) return { totalSessions: 0, uniqueSpots: 0, avgWaveQuality: 0 };
  
  const { surfSessions } = await import("../drizzle/schema.js");
  const { count, avg, countDistinct, sql } = await import("drizzle-orm");
  
  const result = await db
    .select({
      totalSessions: count(),
      uniqueSpots: countDistinct(surfSessions.spotName),
      avgWaveQuality: avg(surfSessions.waveQuality),
    })
    .from(surfSessions)
    .where(eq(surfSessions.userId, userId));
  
  return result[0] || { totalSessions: 0, uniqueSpots: 0, avgWaveQuality: 0 };
}

// Get spot names for autocomplete
export async function getSpotNames(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const { surfSessions } = await import("../drizzle/schema.js");
  const { sql } = await import("drizzle-orm");
  
  const result = await db
    .selectDistinct({ spotName: surfSessions.spotName })
    .from(surfSessions)
    .where(eq(surfSessions.userId, userId));
  
  return result.map(r => r.spotName);
}
