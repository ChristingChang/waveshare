import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc.js";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { MAX_VIDEO_SIZE, deleteR2Video, presignVideo, validateVideoReference, withPlaybackUrl } from "./r2.js";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Surf sessions router
  surfSessions: router({
    presignUpload: protectedProcedure
      .input(z.object({
        contentType: z.enum(["video/mp4", "video/quicktime", "video/webm"]),
        size: z.number().int().positive().max(MAX_VIDEO_SIZE),
      }))
      .mutation(({ ctx, input }) => presignVideo(ctx.user.id, input.contentType, input.size)),

    // Get recent sessions for home page
    getRecent: protectedProcedure.query(async ({ ctx }) => {
      const { getUserRecentSessions } = await import("./db.js");
      return (await getUserRecentSessions(ctx.user.id, 3)).map(withPlaybackUrl);
    }),

    // Get all sessions
    getAll: protectedProcedure.query(async ({ ctx }) => {
      const { getUserAllSessions } = await import("./db.js");
      return (await getUserAllSessions(ctx.user.id)).map(withPlaybackUrl);
    }),

    // Get sessions by date range (for calendar)
    getByDateRange: protectedProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ ctx, input }) => {
        const { getUserSessionsByDateRange } = await import("./db.js");
        return (await getUserSessionsByDateRange(ctx.user.id, input.startDate, input.endDate)).map(withPlaybackUrl);
      }),

    // Get single session by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getSessionById } = await import("./db.js");
        const session = await getSessionById(input.id, ctx.user.id);
        if (session) return { ...withPlaybackUrl(session), isOwner: true, ownerName: ctx.user.name };
        const { getSessionsSharedWithUser } = await import("./db.js");
        const [shared] = await getSessionsSharedWithUser(ctx.user.id, input.id);
        return shared ? { ...shared, isOwner: false } : undefined;
      }),

    getCompanions: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const { getSessionCompanions } = await import("./db.js");
        return getSessionCompanions(input.id, ctx.user.id);
      }),

    getShares: protectedProcedure.input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const { getSessionById, getSessionShareIds } = await import("./db.js");
        if (!await getSessionById(input.id, ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND" });
        return getSessionShareIds(input.id);
      }),

    setShares: protectedProcedure.input(z.object({ id: z.number().int().positive(), friendIds: z.array(z.number().int().positive()) }))
      .mutation(async ({ ctx, input }) => {
        const { getSessionById, setSessionShares } = await import("./db.js");
        if (!await getSessionById(input.id, ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND" });
        return setSessionShares(input.id, ctx.user.id, input.friendIds);
      }),

    getSharedWithMe: protectedProcedure.query(async ({ ctx }) => {
      const { getSessionsSharedWithUser } = await import("./db.js");
      return getSessionsSharedWithUser(ctx.user.id);
    }),

    // Create new session
    create: protectedProcedure
      .input(
        z.object({
          date: z.string(),
          spotName: z.string(),
          spotLat: z.string().optional(),
          spotLng: z.string().optional(),
          videoPath: z.string(),
          note: z.string().optional(),
          boardType: z.string().optional(),
          waveQuality: z.number().min(1).max(5),
          companionIds: z.array(z.number().int().positive()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        validateVideoReference(ctx.user.id, input.videoPath);
        const { createSurfSession } = await import("./db.js");
        const { companionIds, ...sessionData } = input;
        const record = {
          userId: ctx.user.id,
          ...sessionData,
          videoUrl: "",
        };
        return companionIds?.length
          ? createSurfSession(record, companionIds)
          : createSurfSession(record);
      }),

    // Update session
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          videoPath: z.string().optional(),
          date: z.string().optional(),
          spotName: z.string().optional(),
          spotLat: z.string().optional(),
          spotLng: z.string().optional(),
          note: z.string().optional(),
          boardType: z.string().optional(),
          waveQuality: z.number().min(1).max(5).optional(),
          companionIds: z.array(z.number().int().positive()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, companionIds, ...updates } = input;
        if (input.videoPath !== undefined) {
          validateVideoReference(ctx.user.id, input.videoPath);
        }
        const { updateSurfSession } = await import("./db.js");
        const recordUpdates = input.videoPath === undefined ? updates : { ...updates, videoUrl: "" };
        return companionIds === undefined
          ? updateSurfSession(id, ctx.user.id, recordUpdates)
          : updateSurfSession(id, ctx.user.id, recordUpdates, companionIds);
      }),

    // Delete session
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteSurfSession, getSessionById, isVideoPathReferenced } = await import("./db.js");
        
        // Get session to retrieve video path for deletion
        const session = await getSessionById(input.id, ctx.user.id);
        if (!session) {
          throw new Error("Session not found");
        }
        
        // Delete from database
        await deleteSurfSession(input.id, ctx.user.id);
        
        try {
          if (!await isVideoPathReferenced(session.videoPath)) {
            await deleteR2Video(ctx.user.id, session.videoPath);
          }
        } catch (error) {
          console.error("[R2] Failed to delete session video:", error);
        }
        
        return { success: true };
      }),

    // Get user statistics
    getStats: protectedProcedure.query(async ({ ctx }) => {
      const { getUserStats } = await import("./db.js");
      return getUserStats(ctx.user.id);
    }),

    // Get spot names for autocomplete
    getSpotNames: protectedProcedure.query(async ({ ctx }) => {
      const { getSpotNames } = await import("./db.js");
      return getSpotNames(ctx.user.id);
    }),

    // Get board type statistics
    getBoardTypeStats: protectedProcedure.query(async ({ ctx }) => {
      const { getBoardTypeStats } = await import("./db.js");
      return getBoardTypeStats(ctx.user.id);
    }),
  }),

  // Friends router
  friends: router({
    // Search users
    search: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const { searchUsers } = await import("./db.js");
        return searchUsers(input.query, ctx.user.id);
      }),

    // Send friend request
    sendRequest: protectedProcedure
      .input(z.object({ friendId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { sendFriendRequest } = await import("./db.js");
        return sendFriendRequest(ctx.user.id, input.friendId);
      }),

    // Accept friend request
    acceptRequest: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { acceptFriendRequest } = await import("./db.js");
        return acceptFriendRequest(input.requestId, ctx.user.id);
      }),

    // Reject friend request
    rejectRequest: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { rejectFriendRequest } = await import("./db.js");
        return rejectFriendRequest(input.requestId, ctx.user.id);
      }),

    // Get friends list
    getFriends: protectedProcedure.query(async ({ ctx }) => {
      const { getUserFriends } = await import("./db.js");
      return getUserFriends(ctx.user.id);
    }),

    // Get pending requests
    getPendingRequests: protectedProcedure.query(async ({ ctx }) => {
      const { getPendingRequests } = await import("./db.js");
      return getPendingRequests(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
