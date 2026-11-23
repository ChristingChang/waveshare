export type ConditionValue = { min: number; max: number; source: string };
export type ConditionDirection = { degrees: number; source: string };
export type ConditionTide = {
  time: string;
  type: "high" | "low";
  source: string;
};
export interface ConditionsSnapshot {
  v: 1;
  mode: "hour" | "daytime";
  hour: number | null;
  waveHeight: ConditionValue | null;
  wavePeriod: ConditionValue | null;
  swellDirection: ConditionDirection | null;
  windSpeed: ConditionValue | null;
  windDirection: ConditionDirection | null;
  tides: ConditionTide[];
  fetchedAt: string;
}
