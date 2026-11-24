import { useState } from "react";
import { Link2, MessageCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface PostSaveInviteDialogProps {
  invitePath?: string;
  inviteError: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

export function PostSaveInviteDialog({
  invitePath,
  inviteError,
  onRetry,
  onDismiss,
}: PostSaveInviteDialogProps) {
  const [copyStatus, setCopyStatus] = useState<"copied" | "manual" | null>(null);
  const inviteUrl = invitePath ? new URL(invitePath, window.location.origin).href : "";
  const greeting = "一起衝浪好開心！來 WaveShare 加我當浪友吧 🌊";
  const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(`${greeting}\n${inviteUrl}`)}`;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("manual");
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onDismiss(); }}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader className="text-left">
          <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlus size={20} aria-hidden="true" />
          </div>
          <DialogTitle className="text-xl">邀請一起衝浪的朋友</DialogTitle>
          <DialogDescription>紀錄已儲存！把邀請傳給和你一起下水的朋友吧。</DialogDescription>
        </DialogHeader>
        {inviteUrl ? (
          <>
            <div className="min-w-0 space-y-2 rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">LINE 訊息預覽</p>
              <p className="text-sm">{greeting}</p>
              <p className="break-all text-sm text-muted-foreground">{inviteUrl}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button asChild size="lg">
                <a href={lineUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" /> 用 LINE 傳送
                </a>
              </Button>
              <Button variant="outline" size="lg" onClick={copyInvite}>
                <Link2 aria-hidden="true" /> 複製邀請連結
              </Button>
            </div>
            {copyStatus === "copied" && <p role="status" className="text-sm">已複製邀請連結</p>}
            {copyStatus === "manual" && (
              <div className="space-y-2">
                <p role="status" className="text-sm">無法自動複製，請手動複製下方連結。</p>
                <Input aria-label="浪友邀請連結" value={inviteUrl} readOnly onFocus={event => event.currentTarget.select()} />
              </div>
            )}
          </>
        ) : inviteError ? (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">無法取得邀請連結，請再試一次。</p>
            <Button variant="outline" onClick={onRetry}>重試</Button>
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">正在取得邀請連結…</p>
        )}
        <DialogClose asChild>
          <Button variant="ghost" className="w-full">稍後再說</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
