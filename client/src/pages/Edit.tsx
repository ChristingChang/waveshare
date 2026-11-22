import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Star, Loader2, Save } from "lucide-react";
import { SpotSelector } from "@/components/SpotSelector";
import { BOARD_TYPES } from "@shared/boardTypes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { SessionVideo } from "@/components/SessionVideo";
import { PhotoPicker } from "@/components/PhotoPicker";
import { uploadPhotos } from "@/lib/photoUpload";
import { uploadErrorMessage } from "@/lib/uploadError";

export default function Edit() {
  const [, params] = useRoute("/edit/:id");
  const [, setLocation] = useLocation();

  const sessionId = params?.id ? parseInt(params.id) : 0;

  const { data: session, isLoading } = trpc.surfSessions.getById.useQuery(
    { id: sessionId },
    { enabled: sessionId > 0 }
  );

  const [date, setDate] = useState("");
  const [spotName, setSpotName] = useState("");
  const [boardType, setBoardType] = useState("");
  const [waveQuality, setWaveQuality] = useState(3);
  const [note, setNote] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<number[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    if (session) {
      setDate(session.date);
      setSpotName(session.spotName);
      setBoardType(session.boardType || "");
      setWaveQuality(session.waveQuality);
      setNote(session.note || "");
    }
  }, [session]);

  const utils = trpc.useUtils();
  const presignPhotoUpload = trpc.surfSessions.presignPhotoUpload.useMutation();
  const updateSession = trpc.surfSessions.update.useMutation({
    onSuccess: () => {
      utils.surfSessions.invalidate();
      toast.success("紀錄已更新");
      setLocation(`/detail/${sessionId}`);
    },
    onError: (error) => {
      toast.error("更新失敗: " + error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!spotName.trim()) {
      toast.error("請輸入浪點名稱");
      return;
    }

    let addPhotoPaths: string[];
    setUploadingPhotos(true);
    try {
      addPhotoPaths = await uploadPhotos(photoFiles, presignPhotoUpload.mutateAsync);
    } catch (error) {
      toast.error(uploadErrorMessage(error));
      return;
    } finally {
      setUploadingPhotos(false);
    }

    updateSession.mutate({
      id: sessionId,
      date,
      spotName: spotName.trim(),
      boardType: boardType.trim() || undefined,
      note: note.trim() || undefined,
      waveQuality,
      addPhotoPaths,
      removePhotoIds: removedPhotoIds,
    });
  };

  const saving = uploadingPhotos || updateSession.isPending;

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
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="container max-w-2xl flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/detail/${sessionId}`)}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-2xl font-bold">編輯紀錄</h1>
        </div>
      </div>

      <div className="container max-w-2xl py-6 px-4">
        <form onSubmit={handleSubmit}>
          <Card className="bg-card">
            <CardContent className="pt-6 space-y-6">
              {/* Video Preview (Read-only) */}
              {session.videoUrl && (
                <div className="space-y-2">
                  <Label className="text-card-foreground">影片</Label>
                  <SessionVideo
                    src={session.videoUrl}
                    controls
                    className="w-full rounded-lg bg-black"
                    style={{ maxHeight: "300px" }}
                  />
                  <p className="text-sm text-muted-foreground">影片無法更改</p>
                </div>
              )}

              <PhotoPicker
                files={photoFiles}
                onFilesChange={setPhotoFiles}
                existing={session.photos}
                removedIds={removedPhotoIds}
                onRemovedIdsChange={setRemovedPhotoIds}
                disabled={saving}
              />

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date" className="text-card-foreground">
                  日期 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              {/* Spot Selector */}
              <SpotSelector
                value={spotName}
                onChange={setSpotName}
                required
              />

              {/* Board Type */}
              <div className="space-y-2">
                <Label htmlFor="boardType" className="text-card-foreground">
                  板子類型
                </Label>
                <Select value={boardType} onValueChange={setBoardType}>
                  <SelectTrigger id="boardType">
                    <SelectValue placeholder="選擇板子類型(選填)" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOARD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Wave Quality */}
              <div className="space-y-2">
                <Label className="text-card-foreground">
                  浪況評分 <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setWaveQuality(rating)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-10 h-10 ${
                          rating <= waveQuality
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label htmlFor="note" className="text-card-foreground">
                  心得筆記
                </Label>
                <Textarea
                  id="note"
                  placeholder="寫下今天的浪況、感受..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setLocation(`/detail/${sessionId}`)}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  儲存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  儲存
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
