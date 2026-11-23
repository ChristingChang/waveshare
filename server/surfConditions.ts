import { distanceKm, resolveConditionSpot } from "../shared/conditionSpots.js";
import type {
  ConditionsSnapshot,
  ConditionTide,
} from "../shared/surfConditions.js";

type Row = {
  time: string;
  end?: string;
  waveHeight?: number;
  wavePeriod?: number;
  swellDirection?: number;
  waveDirection?: number;
  windSpeed?: number;
  windDirection?: number;
};
type Area = { name: string; lat: number; lng: number; rows: Row[] };
type Fields = Record<string, any>;
const fields = (v: any): Fields =>
  v && typeof v === "object"
    ? Object.fromEntries(
        Object.entries(v).map(([k, v]) => [k.toLowerCase(), v])
      )
    : {};
const items = (v: any): any[] =>
  Array.isArray(v) ? v : v && typeof v === "object" ? [v] : [];
const number = (v: any): number | undefined =>
  v !== null &&
  v !== undefined &&
  String(v).trim() !== "" &&
  Number.isFinite(Number(v)) &&
  Number(v) >= 0
    ? Number(v)
    : undefined;
const direction = (v: any) => {
  const names = ["北", "東北", "東", "東南", "南", "西南", "西", "西北"];
  const s = String(v)
    .replace(/^偏|風$|方$/g, "")
    .toUpperCase();
  const i = names.includes(s)
    ? names.indexOf(s)
    : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"].indexOf(s);
  const n = number(v);
  return i >= 0 ? i * 45 : n !== undefined && n <= 360 ? n % 360 : undefined;
};
const localTime = (s: any) => {
  if (typeof s !== "string") return "";
  const d = new Date(
    s.replace(/([+-])(\d):/, "$10$2:").replace(" ", "T") +
      (/[Zz]|[+-]\d{1,2}:\d\d$/.test(s) ? "" : "+08:00")
  );
  return Number.isFinite(+d)
    ? new Date(+d + 8 * 3600000).toISOString().slice(0, 16)
    : "";
};
const rootDataset = (payload: any) => {
  const p = fields(payload);
  const root = fields(p.cwaopendata ?? p);
  return fields(root.dataset ?? root.records);
};

export function parseCwaCoastal(payload: unknown): Area[] {
  const dataset = rootDataset(payload);
  const output: Area[] = [];
  for (const group of items(dataset.locations).length
    ? items(dataset.locations)
    : [dataset]) {
    for (const item of items(fields(group).location)) {
      const area = fields(item),
        rows: Row[] = [];
      const lat = number(area.latitude),
        lng = number(area.longitude);
      if (!area.locationname || lat === undefined || lng === undefined)
        continue;
      for (const e of items(area.weatherelement)) {
        const element = fields(e);
        const generic: Record<string, string> = {
          浪高: "waveheight",
          波高: "waveheight",
          浪週期: "waveperiod",
          浪周期: "waveperiod",
          浪向: "wavedirection",
          風速: "windspeed",
          風向: "winddirection",
        };
        const name =
          generic[element.elementname] ??
          String(element.elementname).toLowerCase();
        for (const t of items(element.time)) {
          const period = fields(t),
            time = localTime(
              period.starttime ?? period.datatime ?? period.datetime
            );
          if (!time) continue;
          const row: Row = {
            time,
            end:
              localTime(period.endtime) ||
              localTime(
                new Date(
                  Date.parse(time + "+08:00") + 3 * 3600000
                ).toISOString()
              ),
          };
          for (const ev of items(period.elementvalue)) {
            const values = fields(ev);
            if (
              values.value !== undefined &&
              (name !== "windspeed" ||
                ["m/s", "公尺/秒"].includes(values.measures ?? values.measure))
            )
              values[name] = values.value;
            const mapping: Record<string, keyof Row> = {
              waveheight: "waveHeight",
              significantwaveheight: "waveHeight",
              waveperiod: "wavePeriod",
              wavedirection: "waveDirection",
              windspeed: "windSpeed",
              windspeedinmeterspersecond: "windSpeed",
              winddirection: "windDirection",
            };
            for (const [key, target] of Object.entries(mapping)) {
              const value = key.includes("direction")
                ? direction(values[key])
                : number(values[key]);
              if (value !== undefined) (row as any)[target] = value;
            }
          }
          rows.push(row);
        }
      }
      output.push({ name: area.locationname, lat, lng, rows });
    }
  }
  return output;
}

function nearest<T extends { name: string; lat: number; lng: number }>(
  areas: T[],
  input: { lat: number; lng: number; cwaArea?: string }
): T | undefined {
  if (input.cwaArea) return areas.find(a => a.name === input.cwaArea);
  const area = [...areas].sort(
    (a, b) =>
      distanceKm(input.lat, input.lng, a) - distanceKm(input.lat, input.lng, b)
  )[0];
  return area && distanceKm(input.lat, input.lng, area) <= 25
    ? area
    : undefined;
}

export function parseCwaTides(
  payload: unknown,
  input: { date: string; lat: number; lng: number; cwaArea?: string }
): ConditionTide[] {
  const dataset = rootDataset(payload);
  const locations = items(dataset.location ?? dataset.locations).flatMap(l =>
    fields(l).location ? items(fields(l).location) : [l]
  );
  const areas = locations.map(l => {
    const a = fields(l),
      info = fields(a.locationinfo);
    return {
      name: String(a.locationname ?? info.locationname ?? ""),
      lat: Number(a.latitude ?? info.latitude),
      lng: Number(a.longitude ?? info.longitude),
      raw: a,
    };
  });
  const township = input.cwaArea?.replace(/沿海$/, "");
  const area =
    areas.find(a => township && a.name.includes(township)) ??
    nearest(areas, { ...input, cwaArea: undefined });
  if (!area) return [];
  const tides: ConditionTide[] = [];
  function walk(v: any) {
    if (!v || typeof v !== "object") return;
    const f = fields(v);
    const time = localTime(f.datetime ?? f.datatime ?? f.time);
    const type = f.tidetype ?? f.tide;
    if (
      time.startsWith(input.date) &&
      ["滿潮", "乾潮", "高潮", "低潮", "high", "low"].includes(type)
    )
      tides.push({
        time: time.slice(11, 16),
        type: ["滿潮", "高潮", "high"].includes(type) ? "high" : "low",
        source: "中央氣象署",
      });
    for (const child of Object.values(v))
      if (typeof child === "object") walk(child);
  }
  walk(area.raw);
  return tides.sort((a, b) => a.time.localeCompare(b.time));
}

export function aggregate(
  rows: Row[],
  key: keyof Omit<Row, "time" | "end">,
  date: string,
  hour: number | null,
  source: string
) {
  const hours =
    hour === null ? Array.from({ length: 13 }, (_, i) => i + 6) : [hour];
  const values = hours.flatMap(h => {
    const time = date + "T" + String(h).padStart(2, "0") + ":00";
    const row = rows.find(
      r =>
        r.time <= time &&
        (r.end ? r.end > time : r.time === time) &&
        r[key] !== undefined
    );
    return row?.[key] === undefined ? [] : [row[key]!];
  });
  if (!values.length) return null;
  if (key.endsWith("Direction")) {
    const x = values.reduce((s, v) => s + Math.cos((v * Math.PI) / 180), 0),
      y = values.reduce((s, v) => s + Math.sin((v * Math.PI) / 180), 0);
    if (Math.hypot(x, y) < 1e-8) return null;
    return {
      degrees: Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) % 360,
      source,
    };
  }
  return { min: Math.min(...values), max: Math.max(...values), source };
}

export interface ConditionsInput {
  date: string;
  hour: number | null;
  lat: number;
  lng: number;
  cwaArea?: string;
  isTaiwan: boolean;
  now?: Date;
  cwaApiKey?: string;
}
export async function fetchSurfConditions(
  input: ConditionsInput
): Promise<ConditionsSnapshot | null> {
  const now = input.now ?? new Date();
  const signal = AbortSignal.timeout(5600);
  async function json(url: string) {
    try {
      const response = await fetch(url, { signal });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }
  try {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const useCwa = input.date === today && input.isTaiwan && !!input.cwaApiKey;
    const params = new URLSearchParams({
      latitude: String(input.lat),
      longitude: String(input.lng),
      start_date: input.date,
      end_date: input.date,
      timezone: input.isTaiwan ? "Asia/Taipei" : "auto",
    });
    const oldWeather =
      +now - Date.parse(input.date + "T00:00:00Z") > 5 * 86400000;
    const marineParams = new URLSearchParams(params);
    const targetDay = Date.parse(input.date + "T12:00:00Z");
    marineParams.set(
      "start_date",
      new Date(targetDay - 86400000).toISOString().slice(0, 10)
    );
    marineParams.set(
      "end_date",
      new Date(targetDay + 86400000).toISOString().slice(0, 10)
    );
    const marine = json(
      "https://marine-api.open-meteo.com/v1/marine?" +
        marineParams +
        "&hourly=wave_height,wave_period,swell_wave_direction,sea_level_height_msl"
    );
    const weather = json(
      (oldWeather
        ? "https://archive-api.open-meteo.com/v1/archive?"
        : "https://api.open-meteo.com/v1/forecast?") +
        params +
        "&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms"
    );
    const auth = new URLSearchParams({
      Authorization: input.cwaApiKey ?? "",
      downloadType: "WEB",
      format: "JSON",
    });
    const [m, w, c, t] = await Promise.all([
      marine,
      weather,
      useCwa
        ? json(
            "https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/F-D0047-095?" +
              auth
          )
        : null,
      useCwa
        ? json(
            "https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/F-A0021-001?" +
              auth
          )
        : null,
    ]);
    const toRows = (p: any): Row[] =>
      (p?.hourly?.time ?? []).map((time: string, i: number) => {
        const row: Row = { time };
        for (const [remote, local] of Object.entries({
          wave_height: "waveHeight",
          wave_period: "wavePeriod",
          swell_wave_direction: "swellDirection",
          wind_speed_10m: "windSpeed",
          wind_direction_10m: "windDirection",
        })) {
          const value = number(p.hourly[remote]?.[i]);
          if (value !== undefined) (row as any)[local] = value;
        }
        return row;
      });
    const cRows = nearest(parseCwaCoastal(c), input)?.rows ?? [];
    const omRows = [...toRows(m), ...toRows(w)];
    const value = (key: keyof Omit<Row, "time" | "end">) =>
      aggregate(cRows, key, input.date, input.hour, "中央氣象署") ??
      aggregate(omRows, key, input.date, input.hour, "Open-Meteo");
    let tides = parseCwaTides(t, input);
    if (!tides.length) {
      const levels = m?.hourly?.sea_level_height_msl ?? [];
      for (let i = 1; i < levels.length - 1; i++) {
        if (!m.hourly.time[i].startsWith(input.date)) continue;
        const [a, b, c] = levels.slice(i - 1, i + 2);
        if (![a, b, c].every(v => typeof v === "number" && Number.isFinite(v)))
          continue;
        if ((b > a && b > c) || (b < a && b < c))
          tides.push({
            time: m.hourly.time[i].slice(11, 16),
            type: b > a ? "high" : "low",
            source: "Open-Meteo（潮位模型）",
          });
      }
    }
    const snapshot: ConditionsSnapshot = {
      v: 1,
      mode: input.hour === null ? "daytime" : "hour",
      hour: input.hour,
      waveHeight: value("waveHeight") as ConditionsSnapshot["waveHeight"],
      wavePeriod: value("wavePeriod") as ConditionsSnapshot["wavePeriod"],
      swellDirection: value(
        "swellDirection"
      ) as ConditionsSnapshot["swellDirection"],
      windSpeed: value("windSpeed") as ConditionsSnapshot["windSpeed"],
      windDirection: value(
        "windDirection"
      ) as ConditionsSnapshot["windDirection"],
      tides,
      fetchedAt: now.toISOString(),
    };
    return snapshot.waveHeight ||
      snapshot.wavePeriod ||
      snapshot.swellDirection ||
      snapshot.windSpeed ||
      snapshot.windDirection ||
      tides.length
      ? snapshot
      : null;
  } catch {
    return null;
  }
}

export async function conditionsForSession(
  session: {
    date: string;
    surfHour?: number | null;
    spotName: string;
    spotLat?: string | null;
    spotLng?: string | null;
  },
  cwaApiKey = process.env.CWA_API_KEY
): Promise<string | null> {
  try {
    const spot = resolveConditionSpot(session);
    if (!spot) return null;
    const snapshot = await fetchSurfConditions({
      ...spot,
      date: session.date,
      hour: session.surfHour ?? null,
      cwaApiKey,
    });
    return snapshot ? JSON.stringify(snapshot) : null;
  } catch {
    return null;
  }
}
