import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit, Trash2, Star, Calendar, Waves } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Detail() {
  const [, params] = useRoute("/detail/:id");
  const [, setLocation] = useLocation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const sessionId = params?.id ? parseInt(params.id) : 0;

  const { data: session, isLoading } = trpc.surfSessions.getById.useQuery(
    { id: sessionId },
    { enabled: sessionId > 0 }
  );
  const companions = trpc.surfSessions.getCompanions.useQuery(
    { id: sessionId },
    { enabled: !!session }
  );

  const utils = trpc.useUtils();
  const deleteSession = trpc.surfSessions.delete.useMutation({
    onSuccess: () => {
      utils.surfSessions.invalidate();
      toast.success("紀錄已刪除");
      setLocation("/");
    },
    onError: (error) => {
      toast.error("刪除失敗: " + error.message);
    },
  });

  const handleDelete = () => {
    if (sessionId > 0) {
      deleteSession.mutate({ id: sessionId });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-6 h-6 ${
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        }`}
      />
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-muted-foreground mb-4">找不到此紀錄</p>
        <Button onClick={() => setLocation("/")}>返回首頁</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-cyan-600 text-primary-foreground py-6 px-4">
        <div className="container max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="編輯紀錄"
                onClick={() => setLocation(`/edit/${sessionId}`)}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Edit className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                className="text-primary-foreground hover:bg-destructive/20"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">{session.spotName}</h1>
          <div className="flex items-center gap-2 text-primary-foreground/90">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(session.date)}</span>
          </div>
        </div>
      </div>

      <div className="container max-w-2xl py-6 px-4 space-y-6">
        {/* Video Player */}
        <Card className="overflow-hidden bg-card">
          <video
            src={session.videoUrl}
            controls
            className="w-full bg-black"
            style={{ maxHeight: "500px" }}
          />
        </Card>

        {/* Details */}
        <Card className="bg-card">
          <CardContent className="pt-6 space-y-4">
            {/* Wave Quality */}
            <div>
              <div className="text-sm text-muted-foreground mb-2">浪況評分</div>
              <div className="flex gap-1">{renderStars(session.waveQuality)}</div>
            </div>

            {/* Board Type */}
            {session.boardType && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">板子類型</div>
                <div className="bg-muted rounded-lg px-4 py-3 text-foreground">
                  <Waves className="w-4 h-4 inline mr-2 text-primary" />
                  {session.boardType}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm text-muted-foreground mb-2">衝浪夥伴</h2>
              {companions.data?.length ? (
                <ul className="flex flex-wrap gap-2">
                  {companions.data.map(companion => (
                    <li key={companion.companionId} className="max-w-full break-all rounded-lg bg-muted px-3 py-2 text-sm">
                      {companion.name || companion.email || "未命名好友"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {companions.isPending ? "正在載入…" : companions.isError ? "無法載入衝浪夥伴。" : "沒有標記衝浪夥伴。"}
                </p>
              )}
            </div>

            {/* Note */}
            {session.note && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">心得筆記</div>
                <div className="bg-muted rounded-lg px-4 py-3 text-foreground whitespace-pre-wrap">
                  {session.note}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-card text-card-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              確定要刪除這筆衝浪紀錄嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
