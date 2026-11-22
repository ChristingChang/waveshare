import { describe, expect, it } from "vitest";
import { TRPCClientError } from "@trpc/client";
import { uploadErrorMessage } from "./uploadError";

describe("upload error messages shared by new and edit record pages", () => {
  it.each(["照片功能尚未啟用", "儲存服務尚未設定", "已達上傳上限", "無權限儲存"])("preserves server message: %s", message => {
    const error = new TRPCClientError(message, { result: { error: {
      message, code: -32603, data: { code: "INTERNAL_SERVER_ERROR" },
    } } });
    expect(uploadErrorMessage(error)).toBe(message);
  });

  it("identifies fetch failures and tRPC errors with no server response", () => {
    expect(uploadErrorMessage(new TypeError("Failed to fetch"))).toContain("請檢查網路連線");
    expect(uploadErrorMessage(TRPCClientError.from(new TypeError("Failed to fetch")))).toContain("請檢查網路連線");
  });

  it("preserves local errors and provides a non-network fallback for unknown failures", () => {
    expect(uploadErrorMessage(new Error("照片上傳失敗"))).toBe("照片上傳失敗");
    expect(uploadErrorMessage(undefined)).toBe("上傳失敗，請稍後重試");
  });
});
