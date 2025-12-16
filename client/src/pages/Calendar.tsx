import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { Link } from "wouter";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;

  const { data: sessions = [] } = trpc.surfSessions.getByDateRange.useQuery({
    startDate,
    endDate,
  });

  const sessionsByDate = useMemo(() => {
    const map: Record<string, typeof sessions> = {};
    sessions.forEach((session) => {
      if (!map[session.date]) {
        map[session.date] = [];
      }
      map[session.date]!.push(session);
    });
    return map;
  }, [sessions]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
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

  const selectedSessions = selectedDate ? sessionsByDate[selectedDate] || [] : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="container max-w-2xl">
          <h1 className="text-2xl font-bold">日曆</h1>
        </div>
      </div>

      <div className="container max-w-2xl py-6 px-4">
        <Card className="p-4 bg-card">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground">
              {year} 年 {month + 1} 月
            </h2>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }, (_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hasSessions = sessionsByDate[dateStr]?.length > 0;
              const sessionCount = sessionsByDate[dateStr]?.length || 0;

              return (
                <button
                  key={day}
                  onClick={() => hasSessions && setSelectedDate(dateStr)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors ${
                    hasSessions
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                      : "text-foreground hover:bg-accent"
                  }`}
                >
                  <span>{day}</span>
                  {hasSessions && (
                    <span className="text-xs mt-0.5">{sessionCount} 筆</span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Session List Dialog */}
      <Dialog open={selectedDate !== null} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && new Date(selectedDate).toLocaleDateString("zh-TW", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {selectedSessions.map((session) => (
              <Link key={session.id} href={`/detail/${session.id}`}>
                <div
                  className="p-3 rounded-lg border border-border hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => setSelectedDate(null)}
                >
                  <div className="font-medium text-foreground mb-1">{session.spotName}</div>
                  <div className="flex gap-0.5">
                    {renderStars(session.waveQuality)}
                  </div>
                  {session.note && (
                    <div className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {session.note}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
