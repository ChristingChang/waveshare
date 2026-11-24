import { SessionConditions } from "@/components/SessionConditions";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Plus, Waves, MapPin, Star } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.surfSessions.getStats.useQuery();
  const { data: recentSessions, isLoading: sessionsLoading } = trpc.surfSessions.getRecent.useQuery();

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50 to-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-8 px-4">
        <div className="container max-w-2xl">
          <h1 className="text-3xl font-bold mb-2">WaveShare 浪旅誌</h1>
          <p className="text-primary-foreground/90">
            歡迎回來, {user?.name || "衝浪者"}！
          </p>
        </div>
      </div>

      <div className="container max-w-2xl py-6 px-4">
        {/* Statistics Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-card">
            <CardContent className="pt-6 pb-4 px-3 text-center">
              <div className="flex justify-center mb-2">
                <Waves className="w-8 h-8 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {statsLoading ? "..." : stats?.totalSessions || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">總衝浪次數</div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="pt-6 pb-4 px-3 text-center">
              <div className="flex justify-center mb-2">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {statsLoading ? "..." : stats?.uniqueSpots || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">浪點數量</div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="pt-6 pb-4 px-3 text-center">
              <div className="flex justify-center mb-2">
                <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {statsLoading
                  ? "..."
                  : stats?.avgWaveQuality
                  ? Number(stats.avgWaveQuality).toFixed(1)
                  : "0.0"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">平均評分</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Sessions */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg text-card-foreground">最近紀錄</CardTitle>
            <Link href="/calendar">
              <Button variant="ghost" size="sm" className="text-primary">
                查看全部
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="text-center py-8 text-muted-foreground">載入中...</div>
            ) : recentSessions && recentSessions.length > 0 ? (
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <Link key={session.id} href={`/detail/${session.id}`}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{session.spotName}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(session.date)}
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {renderStars(session.waveQuality)}
                      </div>
                      <SessionConditions conditions={session.conditions} className="col-span-2" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Waves className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">還沒有衝浪紀錄</p>
                <Link href="/upload">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    新增第一筆紀錄
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Action Button */}
      <Link href="/upload">
        <Button
          size="lg"
          className="fixed bottom-20 right-6 rounded-full w-14 h-14 shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </Link>
    </div>
  );
}
