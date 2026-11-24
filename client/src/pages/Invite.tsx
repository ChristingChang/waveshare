import { Link, useLocation, useSearch } from "wouter";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { FRIEND_INVITE_CODE } from "@shared/friendInvite";

export default function Invite({ code, isAuthenticated }: { code: string; isAuthenticated: boolean }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();
  const join = trpc.friends.acceptInvite.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.friends.getFriends.invalidate(),
        utils.friends.getPendingRequests.invalidate(),
        utils.surfSessions.getSharedWithMe.invalidate(),
      ]);
      navigate("/friends?joined=1", { replace: true });
    },
  });
  const reason = isAuthenticated ? new URLSearchParams(search).get("joinError") : null;
  const invalid = !FRIEND_INVITE_CODE.test(code) || reason === "invalid";
  const self = reason === "self";
  const error = invalid ? "這個浪友邀請連結無效。" : self ? "不能接受自己的浪友邀請。"
    : join.error?.message ?? (reason === "retry" ? "暫時無法加入浪友，請再試一次。" : null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users aria-hidden="true" /> 浪友邀請</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>你收到一份 WaveShare 浪友邀請。成為浪友後，就能查看對方選擇分享給你的衝浪紀錄。</p>
          {error && <p role="alert" className="text-destructive">{error}</p>}
          {!invalid && !self && (isAuthenticated ? (
            <Button disabled={join.isPending} onClick={() => join.mutate({ code })}>
              {join.isPending ? "加入中…" : "加入浪友"}
            </Button>
          ) : (
            <form action="/api/auth/google/invite" method="post">
              <input type="hidden" name="code" value={code} />
              <Button type="submit">使用 Google 登入並加入浪友</Button>
            </form>
          ))}
          <Link href={isAuthenticated ? "/friends" : "/"} className="block text-sm text-muted-foreground underline">
            {isAuthenticated ? "返回浪友頁面" : "返回首頁"}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
