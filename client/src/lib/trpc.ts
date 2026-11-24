import { httpBatchLink, httpLink, splitLink, TRPCClientError, type TRPCLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { observable } from "@trpc/server/observable";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";
import { PhotoAuthorizationTimeoutError } from "./uploadError";

export const trpc = createTRPCReact<AppRouter>();

const fetchWithCredentials: typeof fetch = (input, init) =>
  globalThis.fetch(input, { ...init, credentials: "include" });

const apiOptions = {
  url: "/api/trpc",
  transformer: superjson,
  fetch: fetchWithCredentials,
};

const photoAuthorizationDeadline: TRPCLink<AppRouter> = () => ({ op, next }) =>
  observable(observer => {
    const controller = new AbortController();
    const abort = () => controller.abort(op.signal?.reason);
    if (op.signal?.aborted) abort();
    else op.signal?.addEventListener("abort", abort, { once: true });

    const timeout = setTimeout(() => {
      observer.error(TRPCClientError.from(new PhotoAuthorizationTimeoutError()));
    }, 10_000);
    const request = next({ ...op, signal: controller.signal }).subscribe(observer);
    return () => {
      clearTimeout(timeout);
      op.signal?.removeEventListener("abort", abort);
      request.unsubscribe();
      controller.abort();
    };
  });

export const apiLink = splitLink<AppRouter>({
  condition: op => op.path === "surfSessions.presignPhotoUpload",
  true: [
    photoAuthorizationDeadline,
    httpLink({
      ...apiOptions,
      async fetch(input, init) {
        const response = await apiOptions.fetch(input, init);
        // Vercel can return a non-JSON 504 that tRPC cannot decode.
        if (response.status === 504) throw new PhotoAuthorizationTimeoutError();
        return response;
      },
    }),
  ],
  false: httpBatchLink(apiOptions),
});
