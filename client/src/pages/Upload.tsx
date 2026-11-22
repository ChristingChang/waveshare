import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Upload as UploadIcon, Star, Video, Loader2 } from "lucide-react";
import { SpotSelector } from "@/components/SpotSelector";
import { BOARD_TYPES } from "@shared/boardTypes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { TRPCClientError } from "@trpc/client";

export default function Upload() {
  const [, setLocation] = useLocation();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0] || "");
  const [spotName, setSpotName] = useState("");
  const [boardType, setBoardType] = useState("");
  const [waveQuality, setWaveQuality] = useState(3);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const presignUpload = trpc.surfSessions.presignUpload.useMutation();
  const createSession = trpc.surfSessions.create.useMutation({
    onSuccess: () => {
      utils.surfSessions.invalidate();
      toast.success("紀錄已儲存");
      setLocation("/");
    },
    onError: (error) => {
      toast.error("儲存失敗: " + error.message);
      setUploading(false);
    },
  });

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type)) {
        toast.error("請選擇 MP4、MOV 或 WebM 影片");
        return;
      }
      if (file.size === 0 || file.size > 100 * 1024 * 1024) {
        toast.error("影片不可為空，且大小不可超過 100 MiB");
        return;
      }
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      setVideoPreview(url);
    }
  };

  const handleRemoveVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!videoFile) {
      toast.error("請選擇影片");
      return;
    }

    if (!spotName.trim()) {
      toast.error("請輸入浪點名稱");
      return;
    }

    setUploading(true);

    try {
      const { uploadUrl, videoPath } = await presignUpload.mutateAsync({
        contentType: videoFile.type as "video/mp4" | "video/quicktime" | "video/webm",
        size: videoFile.size,
      });
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": videoFile.type },
        body: videoFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("影片上傳失敗，請稍後重試；若持續發生，請聯絡管理員檢查儲存服務設定");
      }

      // Create session record
      await createSession.mutateAsync({
        date,
        spotName: spotName.trim(),
        videoPath,
        boardType: boardType.trim() || undefined,
        note: note.trim() || undefined,
        waveQuality,
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof TRPCClientError && error.data?.code === "TOO_MANY_REQUESTS"
        ? error.message : error instanceof Error && error.message.includes("影片")
        ? error.message : "上傳失敗，請檢查網路連線後重試");
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="container max-w-2xl flex items-center justify-between">
          <h1 className="text-2xl font-bold">新增紀錄</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      <div className="container max-w-2xl py-6 px-4">
        <form onSubmit={handleSubmit}>
          <Card className="bg-card">
            <CardContent className="pt-6 space-y-6">
              {/* Video Upload */}
              <div className="space-y-2">
                <Label htmlFor="video" className="text-card-foreground">
                  影片 <span className="text-destructive">*</span>
                </Label>
                {videoPreview ? (
                  <div className="relative">
                    <video
                      src={videoPreview}
                      controls
                      className="w-full rounded-lg bg-black"
                      style={{ maxHeight: "400px" }}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={handleRemoveVideo}
                    >
                      <X className="w-4 h-4 mr-1" />
                      移除
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:bg-accent transition-colors"
                  >
                    <Video className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-2">點擊上傳影片</p>
                    <p className="text-sm text-muted-foreground">支援 MP4、MOV、WebM，最大 100 MiB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  id="video"
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={handleVideoChange}
                  className="hidden"
                />
              </div>

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
              onClick={() => setLocation("/")}
              disabled={uploading}
            >
              取消
            </Button>
            <Button type="submit" className="flex-1" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  上傳中...
                </>
              ) : (
                <>
                  <UploadIcon className="w-4 h-4 mr-2" />
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
