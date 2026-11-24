import { TRPCClientError } from "@trpc/client";

export class PhotoAuthorizationTimeoutError extends Error {
  constructor() {
    super("照片上傳授權逾時，請稍後重試");
  }
}

export function uploadErrorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) {
    if (error.cause instanceof PhotoAuthorizationTimeoutError) return error.cause.message;
    if (error.shape || error.data) return error.message;
    return "上傳失敗，請檢查網路連線後重試";
  }
  if (error instanceof TypeError) return "上傳失敗，請檢查網路連線後重試";
  return error instanceof Error ? error.message : "上傳失敗，請稍後重試";
}
