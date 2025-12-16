import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";

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
    // Get recent sessions for home page
    getRecent: protectedProcedure.query(async ({ ctx }) => {
      const { getUserRecentSessions } = await import("./db");
      return getUserRecentSessions(ctx.user.id, 3);
    }),

    // Get all sessions
    getAll: protectedProcedure.query(async ({ ctx }) => {
      const { getUserAllSessions } = await import("./db");
      return getUserAllSessions(ctx.user.id);
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
        const { getUserSessionsByDateRange } = await import("./db");
        return getUserSessionsByDateRange(ctx.user.id, input.startDate, input.endDate);
      }),

    // Get single session by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const { getSessionById } = await import("./db");
        return getSessionById(input.id, ctx.user.id);
      }),

    // Create new session
    create: protectedProcedure
      .input(
        z.object({
          date: z.string(),
          spotName: z.string(),
          spotLat: z.string().optional(),
          spotLng: z.string().optional(),
          videoUrl: z.string(),
          videoPath: z.string(),
          note: z.string().optional(),
          boardType: z.string().optional(),
          waveQuality: z.number().min(1).max(5),
          companionIds: z.array(z.number()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { createSurfSession, addSessionCompanions } = await import("./db");
        const { companionIds, ...sessionData } = input;
        
        const result = await createSurfSession({
          userId: ctx.user.id,
          ...sessionData,
        });
        
        // Add companions if provided
        // Note: For now, companions feature is prepared but not fully integrated
        // Will be completed in future update
        
        return result;
      }),

    // Update session
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          date: z.string().optional(),
          spotName: z.string().optional(),
          spotLat: z.string().optional(),
          spotLng: z.string().optional(),
          note: z.string().optional(),
          boardType: z.string().optional(),
          waveQuality: z.number().min(1).max(5).optional(),
          companionIds: z.array(z.number()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, companionIds, ...updates } = input;
        const { updateSurfSession } = await import("./db");
        
        const result = await updateSurfSession(id, ctx.user.id, updates);
        
        // Note: Companions feature is prepared but not fully integrated
        // Will be completed in future update
        
        return result;
      }),

    // Delete session
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteSurfSession, getSessionById } = await import("./db");
        
        // Get session to retrieve video path for deletion
        const session = await getSessionById(input.id, ctx.user.id);
        if (!session) {
          throw new Error("Session not found");
        }
        
        // Delete from database
        await deleteSurfSession(input.id, ctx.user.id);
        
        // TODO: Delete video from S3 storage
        // const { storageDelete } = await import("./storage");
        // await storageDelete(session.videoPath);
        
        return { success: true };
      }),

    // Get user statistics
    getStats: protectedProcedure.query(async ({ ctx }) => {
      const { getUserStats } = await import("./db");
      return getUserStats(ctx.user.id);
    }),

    // Get spot names for autocomplete
    getSpotNames: protectedProcedure.query(async ({ ctx }) => {
      const { getSpotNames } = await import("./db");
      return getSpotNames(ctx.user.id);
    }),

    // Get board type statistics
    getBoardTypeStats: protectedProcedure.query(async ({ ctx }) => {
      const { getBoardTypeStats } = await import("./db");
      return getBoardTypeStats(ctx.user.id);
    }),
  }),

  // Friends router
  friends: router({
    // Search users
    search: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const { searchUsers } = await import("./db");
        return searchUsers(input.query, ctx.user.id);
      }),

    // Send friend request
    sendRequest: protectedProcedure
      .input(z.object({ friendId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { sendFriendRequest } = await import("./db");
        return sendFriendRequest(ctx.user.id, input.friendId);
      }),

    // Accept friend request
    acceptRequest: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { acceptFriendRequest } = await import("./db");
        return acceptFriendRequest(input.requestId, ctx.user.id);
      }),

    // Reject friend request
    rejectRequest: protectedProcedure
      .input(z.object({ requestId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { rejectFriendRequest } = await import("./db");
        return rejectFriendRequest(input.requestId, ctx.user.id);
      }),

    // Get friends list
    getFriends: protectedProcedure.query(async ({ ctx }) => {
      const { getUserFriends } = await import("./db");
      return getUserFriends(ctx.user.id);
    }),

    // Get pending requests
    getPendingRequests: protectedProcedure.query(async ({ ctx }) => {
      const { getPendingRequests } = await import("./db");
      return getPendingRequests(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
