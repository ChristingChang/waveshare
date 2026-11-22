import { Waves, Timer, Compass, Wind, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ConditionsSnapshot,
  ConditionValue,
  ConditionDirection,
} from "@shared/surfConditions";

const rounded = (value: number) => Number(value.toFixed(1));
const range = (v: ConditionValue) =>
  v.min === v.max
    ? String(rounded(v.min))
    : rounded(v.min) + "–" + rounded(v.max);
const bearing = (v: ConditionDirection) =>
  ["北", "東北", "東", "東南", "南", "西南", "西", "西北"][
    Math.round(v.degrees / 45) % 8
  ];

export function SessionConditions({
  conditions,
  className,
}: {
  conditions?: string | null;
  className?: string;
}) {
  let snapshot: ConditionsSnapshot;
  try {
    snapshot = JSON.parse(conditions ?? "null");
  } catch {
    return null;
  }
  if (!snapshot || snapshot.v !== 1) return null;
  const {
    waveHeight,
    wavePeriod,
    swellDirection,
    windSpeed,
    windDirection,
    tides = [],
  } = snapshot;
  const sources = Array.from(
    new Set(
      [
        waveHeight?.source,
        wavePeriod?.source,
        swellDirection?.source,
        windSpeed?.source,
        windDirection?.source,
        ...tides.map(t => t.source),
      ].filter(Boolean)
    )
  );
  if (!sources.length) return null;
  const icon = "h-3.5 w-3.5 shrink-0";
  return (
    <div className={cn("mt-2 text-xs text-muted-foreground", className)} aria-label="自動浪況">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1">
        {waveHeight && (
          <span title={waveHeight.source}>
            <Waves className={icon} />
            浪高 {range(waveHeight)} m
          </span>
        )}
        {wavePeriod && (
          <span title={wavePeriod.source}>
            <Timer className={icon} />
            週期 {range(wavePeriod)} s
          </span>
        )}
        {swellDirection && (
          <span title={swellDirection.source}>
            <Compass className={icon} />
            湧浪 {bearing(swellDirection)} {Math.round(swellDirection.degrees) % 360}°
          </span>
        )}
        {windSpeed && (
          <span title={windSpeed.source}>
            <Wind className={icon} />
            風速 {range(windSpeed)} m/s
          </span>
        )}
        {windDirection && (
          <span title={windDirection.source}>
            <Compass className={icon} />
            風向 {bearing(windDirection)}
          </span>
        )}
        {tides.map((t, i) => (
          <span key={i} title={t.source}>
            {t.type === "high" ? (
              <ArrowUp className={icon} />
            ) : (
              <ArrowDown className={icon} />
            )}
            {t.type === "high" ? "滿潮" : "乾潮"} {t.time}
          </span>
        ))}
      </div>
      <div className="mt-1 text-[10px]">
        {snapshot.mode === "hour"
          ? String(snapshot.hour).padStart(2, "0") + ":00"
          : "06:00–18:00"}{" "}
        · {sources.join("、")}
      </div>
    </div>
  );
}
