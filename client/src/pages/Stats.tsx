import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Waves, Trophy, Activity } from "lucide-react";

export default function Stats() {
  const { data: sessions = [], isLoading } = trpc.surfSessions.getAll.useQuery();
  const { data: stats } = trpc.surfSessions.getStats.useQuery();
  const { data: boardTypeStats = [] } = trpc.surfSessions.getBoardTypeStats.useQuery();

  const topSpots = useMemo(() => {
    const spotCounts: Record<string, number> = {};
    sessions.forEach((session) => {
      spotCounts[session.spotName] = (spotCounts[session.spotName] || 0) + 1;
    });

    const total = sessions.length;
    return Object.entries(spotCounts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [sessions]);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="container max-w-2xl">
          <h1 className="text-2xl font-bold">統計</h1>
        </div>
      </div>

      <div className="container max-w-2xl py-6 px-4 space-y-6">
        {/* Total Sessions */}
        <Card className="bg-card">
          <CardContent className="pt-6 text-center">
            <Waves className="w-16 h-16 text-primary mx-auto mb-4" />
            <div className="text-5xl font-bold text-foreground mb-2">
              {isLoading ? "..." : stats?.totalSessions || 0}
            </div>
            <div className="text-muted-foreground">總衝浪次數</div>
          </CardContent>
        </Card>

        {/* Board Type Stats */}
        {boardTypeStats.length > 0 && (
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Activity className="w-5 h-5 text-primary" />
                浪板使用統計
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {boardTypeStats.map((item) => (
                  <div key={item.boardType} className="flex items-center justify-between">
                    <div className="font-medium text-foreground">{item.boardType}</div>
                    <div className="text-sm text-muted-foreground">{item.count} 次</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Spots */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Trophy className="w-5 h-5 text-yellow-500" />
              最常去的浪點 Top 5
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">載入中...</div>
            ) : topSpots.length > 0 ? (
              <div className="space-y-4">
                {topSpots.map((spot, index) => (
                  <div key={spot.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                            index === 0
                              ? "bg-yellow-400 text-yellow-900"
                              : index === 1
                              ? "bg-gray-300 text-gray-700"
                              : index === 2
                              ? "bg-orange-300 text-orange-900"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{spot.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {spot.count} 次
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {spot.percentage.toFixed(1)}%
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-500"
                        style={{ width: `${spot.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                還沒有足夠的數據
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
