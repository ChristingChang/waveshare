import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc.js";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { MAX_VIDEO_SIZE, deleteR2Video, presignVideo, validateVideoReference, withPlaybackUrl } from "./r2.js";
import { MAX_PHOTOS_PER_SESSION, MAX_PHOTO_SIZE, deleteUnreferencedPhotos, presignPhoto, toPhotoView, validatePhotoPaths } from "./photos.js";

const photoPathsInput = z.array(z.string()).max(MAX_PHOTOS_PER_SESSION);

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

    presignPhotoUpload: protectedProcedure
      .input(z.object({
        contentType: z.enum(["image/jpeg", "image/png", "image/heic", "image/heif"]),
        size: z.number().int().positive().max(MAX_PHOTO_SIZE),
      }))
      .mutation(({ ctx, input }) => presignPhoto(ctx.user.id, input.contentType, input.size)),

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
        const { getSessionById, getSessionPhotos } = await import("./db.js");
        const session = await getSessionById(input.id, ctx.user.id);
        if (session) {
          const photos = await getSessionPhotos(session.id, ctx.user.id);
          return { ...withPlaybackUrl(session), isOwner: true, ownerName: ctx.user.name, photos: photos.map(toPhotoView) };
        }
        const { getSessionsSharedWithUser } = await import("./db.js");
        const [shared] = await getSessionsSharedWithUser(ctx.user.id, input.id);
        if (!shared) return undefined;
        const photos = await getSessionPhotos(shared.id, shared.userId);
        return { ...shared, isOwner: false, photos: photos.map(toPhotoView) };
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
          videoPath: z.string().optional(),
          photoPaths: photoPathsInput.optional(),
          note: z.string().optional(),
          boardType: z.string().optional(),
          waveQuality: z.number().min(1).max(5),
          companionIds: z.array(z.number()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.videoPath) validateVideoReference(ctx.user.id, input.videoPath);
        const photoPaths = input.photoPaths ?? [];
        validatePhotoPaths(ctx.user.id, photoPaths);
        const { createSurfSession } = await import("./db.js");
        const { companionIds, photoPaths: _photoPaths, ...sessionData } = input;
        
        const result = await createSurfSession({
          userId: ctx.user.id,
          ...sessionData,
          videoPath: input.videoPath ?? "",
          videoUrl: "",
        }, photoPaths);
        
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
          videoPath: z.string().optional(),
          date: z.string().optional(),
          spotName: z.string().optional(),
          spotLat: z.string().optional(),
          spotLng: z.string().optional(),
          note: z.string().optional(),
          boardType: z.string().optional(),
          waveQuality: z.number().min(1).max(5).optional(),
          companionIds: z.array(z.number()).optional(),
          addPhotoPaths: photoPathsInput.optional(),
          removePhotoIds: z.array(z.number().int().positive()).max(MAX_PHOTOS_PER_SESSION).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, companionIds, addPhotoPaths = [], removePhotoIds = [], ...updates } = input;
        if (input.videoPath !== undefined) {
          validateVideoReference(ctx.user.id, input.videoPath);
        }
        validatePhotoPaths(ctx.user.id, addPhotoPaths);
        const { updateSurfSession, getSessionById, getSessionPhotos, addSessionPhotos, removeSessionPhotos } = await import("./db.js");

        let removedPhotoPaths: string[] = [];
        if (addPhotoPaths.length || removePhotoIds.length) {
          if (!await getSessionById(id, ctx.user.id)) {
            throw new TRPCError({ code: "NOT_FOUND", message: "找不到此紀錄" });
          }
          const current = await getSessionPhotos(id, ctx.user.id);
          const kept = current.filter(photo => !removePhotoIds.includes(photo.id)).length;
          if (kept + addPhotoPaths.length > MAX_PHOTOS_PER_SESSION) {
            throw new TRPCError({ code: "BAD_REQUEST", message: `每筆紀錄最多 ${MAX_PHOTOS_PER_SESSION} 張照片` });
          }
          removedPhotoPaths = (await removeSessionPhotos(id, ctx.user.id, removePhotoIds)).map(photo => photo.photoPath);
          await addSessionPhotos(id, ctx.user.id, addPhotoPaths);
        }
        
        const fields = input.videoPath === undefined ? updates : { ...updates, videoUrl: "" };
        const result = Object.keys(fields).length ? await updateSurfSession(id, ctx.user.id, fields) : undefined;
        await deleteUnreferencedPhotos(ctx.user.id, removedPhotoPaths);
        
        // Note: Companions feature is prepared but not fully integrated
        // Will be completed in future update
        
        return result;
      }),

    // Delete session
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { deleteSurfSession, getSessionById, isVideoPathReferenced, removeSessionPhotos } = await import("./db.js");
        
        // Get session to retrieve video path for deletion
        const session = await getSessionById(input.id, ctx.user.id);
        if (!session) {
          throw new Error("Session not found");
        }
        
        // Delete from database
        const photos = await removeSessionPhotos(input.id, ctx.user.id);
        await deleteSurfSession(input.id, ctx.user.id);
        await deleteUnreferencedPhotos(ctx.user.id, photos.map(photo => photo.photoPath));
        
        try {
          if (session.videoPath && !await isVideoPathReferenced(session.videoPath)) {
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
