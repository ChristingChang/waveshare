import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONDITION_SPOTS,
  resolveConditionSpot,
} from "../shared/conditionSpots";
import {
  aggregate,
  fetchSurfConditions,
  parseCwaCoastal,
  parseCwaTides,
} from "./surfConditions";

const input = {
  date: "2026-11-22",
  hour: 7,
  lat: 24.8659,
  lng: 121.8371,
  cwaArea: "頭城鎮沿海",
  isTaiwan: true,
  now: new Date("2026-11-22T01:00:00Z"),
  cwaApiKey: "fixture-key",
};
const element = (name: string, value: unknown) => ({
  ElementName: name,
  Time: [
    {
      StartTime: "2026-11-22T06:00:00+8:00",
      EndTime: "2026-11-22T09:00:00+8:00",
      ElementValue: value,
    },
  ],
});
const coastal = {
  cwaopendata: {
    Dataset: {
      Locations: {
        Location: [
          {
            LocationName: "壯圍鄉沿海",
            Latitude: "24.8659",
            Longitude: "121.8371",
            WeatherElement: [element("浪高", { WaveHeight: "9" })],
          },
          {
            LocationName: "頭城鎮沿海",
            Latitude: "24.87",
            Longitude: "121.89",
            WeatherElement: [
              element("浪高", [{ WaveHeight: "1.2" }]),
              element("浪週期", { WavePeriod: "8" }),
              element("浪向", { WaveDirection: "東北" }),
              element("風速", {
                BeaufortScale: "4",
                WindSpeedKph: "18",
                WindSpeedKts: "10",
                WindSpeed: "5.0",
              }),
              element("風向", { WindDirection: "偏北風" }),
            ],
          },
        ],
      },
    },
  },
};
const tide = {
  cwaopendata: {
    Dataset: {
      Location: [
        {
          LocationName: "宜蘭縣頭城鎮",
          Latitude: 24.87,
          Longitude: 121.89,
          TimePeriods: {
            Daily: [
              {
                Date: "2026-11-22",
                Time: [
                  {
                    DateTime: "2026-11-22T03:12:00+08:00",
                    TideType: "滿潮",
                    TideHeights: { AboveTWVD: "42" },
                  },
                  { DateTime: "2026-11-22T09:20:00+08:00", TideType: "乾潮" },
                  { DateTime: "2026-11-23T03:30:00+08:00", TideType: "滿潮" },
                ],
              },
            ],
          },
        },
      ],
    },
  },
};
const marine = {
  hourly: {
    time: ["2026-11-22T06:00", "2026-11-22T07:00", "2026-11-22T08:00"],
    wave_height: [1, 2, 3],
    wave_period: [6, 7, 8],
    swell_wave_direction: [350, 0, 10],
    sea_level_height_msl: [0, 1, 0],
  },
};
const weather = {
  hourly: {
    time: marine.hourly.time,
    wind_speed_10m: [2, 3, 4],
    wind_direction_10m: [350, 0, 10],
  },
};

beforeEach(() =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("F-D0047")
          ? coastal
          : url.includes("F-A0021")
            ? tide
            : url.includes("marine-api")
              ? marine
              : weather,
    }))
  )
);
afterEach(() => vi.unstubAllGlobals());

describe("spot resolution", () => {
  it("imports every canonical spot and resolves normalized aliases", () => {
    expect(CONDITION_SPOTS).toHaveLength(46);
    expect(resolveConditionSpot({ spotName: "烏石港（北堤）" })).toMatchObject({
      lat: 24.8659,
      cwaArea: "頭城鎮沿海",
      isTaiwan: true,
    });
    expect(resolveConditionSpot({ spotName: "蘇澳 - 無尾港" })).toMatchObject({
      cwaArea: "蘇澳鎮沿海",
    });
    expect(resolveConditionSpot({ spotName: "都歷東河" })).toMatchObject({
      cwaArea: "成功鎮沿海",
    });
    expect(resolveConditionSpot({ spotName: "漁光島（馬場）" })).toMatchObject({
      cwaArea: "安平區沿海",
    });
  });
  it("does not mislabel ambiguous names and uses coordinates for unknown spots", () => {
    expect(
      resolveConditionSpot({ spotName: "沙崙白沙灣" })?.cwaArea
    ).toBeUndefined();
    expect(
      resolveConditionSpot({ spotName: "海外", spotLat: "-28", spotLng: "153" })
    ).toMatchObject({ isTaiwan: false });
    expect(resolveConditionSpot({ spotName: "未知" })).toBeNull();
    expect(
      resolveConditionSpot({ spotName: "未知", spotLat: "oops", spotLng: "0" })
    ).toBeNull();
  });
});
describe("CWA parsers", () => {
  it("parses coastal units, named directions and forecast intervals", () => {
    const area = parseCwaCoastal(coastal)[1];
    expect(
      aggregate(area.rows, "waveHeight", input.date, 7, "CWA")
    ).toMatchObject({ min: 1.2, max: 1.2 });
    expect(
      aggregate(area.rows, "windSpeed", input.date, 7, "CWA")
    ).toMatchObject({ min: 5 });
    expect(
      aggregate(area.rows, "windDirection", input.date, 7, "CWA")
    ).toMatchObject({ degrees: 0 });
  });
  it("never treats Beaufort as m/s and rejects missing or negative values", () => {
    const payload = {
      records: {
        location: [
          {
            locationName: "測試",
            latitude: 24,
            longitude: 121,
            weatherElement: [
              element("風速", { value: "4", measures: "蒲福風級" }),
              element("浪高", { WaveHeight: "-99" }),
            ],
          },
        ],
      },
    };
    const rows = parseCwaCoastal(payload)[0].rows;
    expect(aggregate(rows, "windSpeed", input.date, 7, "CWA")).toBeNull();
    expect(aggregate(rows, "waveHeight", input.date, 7, "CWA")).toBeNull();
    expect(parseCwaCoastal(null)).toEqual([]);
  });
  it("selects township tide location and keeps only this day's high/low times", () => {
    expect(parseCwaTides(tide, input)).toEqual([
      { time: "03:12", type: "high", source: "中央氣象署" },
      { time: "09:20", type: "low", source: "中央氣象署" },
    ]);
    expect(parseCwaTides({}, input)).toEqual([]);
    expect(
      parseCwaTides(tide, { ...input, cwaArea: undefined, lat: 0, lng: 0 })
    ).toEqual([]);
  });
});
describe("source selection and aggregation", () => {
  it("uses named CWA area today, not a closer wrong township", async () => {
    const result = await fetchSurfConditions(input);
    expect(result?.waveHeight).toEqual({
      min: 1.2,
      max: 1.2,
      source: "中央氣象署",
    });
    expect(result?.windSpeed?.min).toBe(5);
    expect(result?.swellDirection?.source).toBe("Open-Meteo");
    expect(result?.tides[0].source).toBe("中央氣象署");
  });
  it.each([{ date: "2026-11-21" }, { isTaiwan: false }, { cwaApiKey: "" }])(
    "uses Open-Meteo rather than CWA for %j",
    async change => {
      await fetchSurfConditions({ ...input, ...change });
      expect(
        vi
          .mocked(fetch)
          .mock.calls.every(([url]) => !String(url).includes("cwa.gov.tw"))
      ).toBe(true);
    }
  );
  it("returns one local hour or daytime ranges with circular means", async () => {
    const hour = await fetchSurfConditions({ ...input, cwaApiKey: "" });
    expect(hour?.waveHeight).toEqual({ min: 2, max: 2, source: "Open-Meteo" });
    expect(hour?.tides).toEqual([
      { time: "07:00", type: "high", source: "Open-Meteo（潮位模型）" },
    ]);
    const daytime = await fetchSurfConditions({
      ...input,
      hour: null,
      cwaApiKey: "",
    });
    expect(daytime?.waveHeight).toMatchObject({ min: 1, max: 3 });
    expect(
      Math.min(
        daytime!.swellDirection!.degrees,
        360 - daytime!.swellDirection!.degrees
      )
    ).toBeCloseTo(0);
    expect(aggregate([], "waveHeight", input.date, null, "test")).toBeNull();
    expect(
      aggregate(
        [
          { time: input.date + "T07:00", swellDirection: 0 },
          { time: input.date + "T08:00", swellDirection: 180 },
        ],
        "swellDirection",
        input.date,
        null,
        "test"
      )
    ).toBeNull();
  });
  it("fills missing CWA fields from Open-Meteo and uses archive weather for old dates", async () => {
    vi.mocked(fetch).mockImplementation(
      async (url: any) =>
        ({
          ok: true,
          json: async () =>
            String(url).includes("F-D0047")
              ? { records: { location: [] } }
              : String(url).includes("marine-api")
                ? marine
                : weather,
        }) as Response
    );
    expect((await fetchSurfConditions(input))?.waveHeight?.source).toBe(
      "Open-Meteo"
    );
    await fetchSurfConditions({ ...input, date: "2025-01-01" });
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(([url]) =>
          String(url).includes("archive-api.open-meteo.com")
        )
    ).toBe(true);
  });
  it("returns partial data or null without throwing on network/HTTP failures", async () => {
    vi.mocked(fetch).mockImplementation(async (url: any) => {
      if (String(url).includes("marine-api"))
        return { ok: true, json: async () => marine } as Response;
      throw new Error("timeout");
    });
    expect((await fetchSurfConditions(input))?.windSpeed).toBeNull();
    expect((await fetchSurfConditions(input))?.waveHeight?.source).toBe(
      "Open-Meteo"
    );
    vi.mocked(fetch).mockRejectedValue(new Error("timeout"));
    await expect(fetchSurfConditions(input)).resolves.toBeNull();
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
    await expect(fetchSurfConditions(input)).resolves.toBeNull();
  });
});
