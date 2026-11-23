import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, MapPin, Star } from "lucide-react";
import { Link } from "wouter";
import { LeafletMap } from "@/components/LeafletMap";
import { ShareCardButton } from "@/components/ShareCardButton";
import { makeSpotsCard } from "@/lib/shareCards";
import { SURF_SPOTS, getSpotCoordinates } from "@shared/surfSpots";

export default function MapPage() {
  const { data: sessions = [], isLoading, isSuccess } = trpc.surfSessions.getAll.useQuery();
  const [expandedSpot, setExpandedSpot] = useState<string | null>(null);
  const spotsCard = useMemo(() => makeSpotsCard(sessions), [sessions]);

  const spotStats = useMemo(() => {
    const stats: Record<
      string,
      {
        name: string;
        count: number;
        sessions: typeof sessions;
      }
    > = {};

    sessions.forEach((session) => {
      if (!stats[session.spotName]) {
        stats[session.spotName] = {
          name: session.spotName,
          count: 0,
          sessions: [],
        };
      }
      stats[session.spotName]!.count++;
      stats[session.spotName]!.sessions.push(session);
    });

    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [sessions]);

  // Prepare map markers
  const mapMarkers = useMemo(() => {
    const visitedSpots = new Set(sessions.map((s) => s.spotName));
    const visitCounts: Record<string, number> = {};
    
    sessions.forEach((session) => {
      visitCounts[session.spotName] = (visitCounts[session.spotName] || 0) + 1;
    });

    return SURF_SPOTS.map((spot) => {
      const coordinates = getSpotCoordinates(spot.name);
      if (!coordinates) return null;

      return {
        name: spot.name,
        coordinates,
        visited: visitedSpots.has(spot.name),
        visitCount: visitCounts[spot.name] || 0,
      };
    }).filter((marker): marker is NonNullable<typeof marker> => marker !== null);
  }, [sessions]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${
          i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="container max-w-2xl">
          <h1 className="text-2xl font-bold">浪點地圖</h1>
        </div>
      </div>

      <div className="container max-w-2xl py-6 px-4 space-y-6">
        {/* Map Section */}
        <Card className="bg-card overflow-hidden">
          <CardContent className="p-0">
            <div className="h-[400px] w-full">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  載入地圖中...
                </div>
              ) : (
                <LeafletMap markers={mapMarkers} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Spot List Section */}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              我的浪點{isSuccess && (
                <span className="ml-2 text-sm text-muted-foreground">
                  {spotsCard.visited}/{spotsCard.total}
                </span>
              )}
            </h2>
            {isSuccess && <ShareCardButton card={spotsCard} />}
          </div>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">載入中...</div>
          ) : spotStats.length > 0 ? (
            <div className="space-y-3">
              {spotStats.map((spot) => (
                <Card key={spot.name} className="bg-card">
                  <CardHeader
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() =>
                      setExpandedSpot(expandedSpot === spot.name ? null : spot.name)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-primary" />
                        <div>
                          <CardTitle className="text-base text-card-foreground">
                            {spot.name}
                          </CardTitle>
                          <div className="text-sm text-muted-foreground mt-1">
                            去過 {spot.count} 次
                          </div>
                        </div>
                      </div>
                      {expandedSpot === spot.name ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>

                  {expandedSpot === spot.name && (
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {spot.sessions.map((session) => (
                          <Link key={session.id} href={`/detail/${session.id}`}>
                            <div className="p-3 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer">
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                  {formatDate(session.date)}
                                </div>
                                <div className="flex gap-0.5">
                                  {renderStars(session.waveQuality)}
                                </div>
                              </div>
                              {session.note && (
                                <div className="text-sm text-foreground mt-2 line-clamp-2">
                                  {session.note}
                                </div>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card">
              <CardContent className="text-center py-12">
                <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">還沒有浪點紀錄</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
