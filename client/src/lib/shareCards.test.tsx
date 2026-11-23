// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { SURF_SPOTS } from "@shared/surfSpots";
import { createShareCardFile, drawShareCard, makeRecordCard, makeSpotsCard } from "./shareCards";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockContext() {
  const gradient = { addColorStop: vi.fn() };
  const context = {
    createLinearGradient: () => gradient,
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    measureText: () => ({ width: 120 }),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  return context;
}

describe("share cards", () => {
  const record = {
    spotName: "烏石港（北堤）",
    date: "2026-09-23",
    waveQuality: 4,
    boardType: "長板 (Longboard)",
    note: "Keep this private",
    videoUrl: "https://example.test/private.mp4",
    videoPath: "surf-videos/private.mp4",
  };

  it("uses only public-facing record fields, keeping the stored calendar date", () => {
    expect(makeRecordCard(record)).toEqual({
      kind: "record",
      spotName: "烏石港（北堤）",
      date: "2026 / 09 / 23",
      rating: 4,
      board: "長板 (Longboard)",
      conditions: null,
    });
    expect(makeRecordCard({ ...record, spotName: record.videoUrl, boardType: record.videoPath, date: record.videoUrl }))
      .toMatchObject({ spotName: "未分類浪點", board: "未記錄", date: "未記錄" });
  });

  it("formats the saved condition snapshot without including provider metadata", () => {
    const conditions = JSON.stringify({
      v: 1,
      mode: "hour",
      hour: 8,
      waveHeight: { min: 1.05, max: 1.6, source: "https://example.test/waves" },
      wavePeriod: { min: 9, max: 9 },
      swellDirection: { degrees: 45 },
      windSpeed: { min: 4, max: 6 },
      windDirection: { degrees: 360 },
      tides: [
        { type: "high", time: "08:34" },
        { type: "low", time: "14:30" },
        { type: "low", time: "https://example.test/tide" },
      ],
    });
    const card = makeRecordCard({ ...record, conditions });
    expect(card.conditions).toEqual({
      time: "08:00",
      metrics: [
        { label: "浪高", value: "1.1–1.6 m" },
        { label: "週期", value: "9 s" },
        { label: "湧浪", value: "東北" },
        { label: "風速", value: "4–6 m/s" },
        { label: "風向", value: "北" },
        { label: "潮汐", value: "滿 08:34  ·  乾 14:30" },
      ],
    });
    const context = mockContext();
    drawShareCard(context as unknown as CanvasRenderingContext2D, card);
    expect(context.fillText.mock.calls.map(([value]) => value)).toEqual(expect.arrayContaining([
      "當日浪況", "08:00", "1.1–1.6 m", "9 s", "東北", "4–6 m/s", "北", "滿 08:34  ·  乾 14:30",
    ]));
    expect(makeRecordCard({ ...record, conditions: "not-json" }).conditions).toBeNull();
    expect(makeRecordCard({ ...record, conditions: '{"v":1}' }).conditions).toBeNull();
  });

  it("counts distinct spots from the catalog and groups them by region", () => {
    const card = makeSpotsCard([record, record, { spotName: "佳樂水" }, { spotName: "Not in catalog" }]);
    expect(card).toMatchObject({ kind: "spots", visited: 2, total: 37 });
    expect(card.regions).toEqual([
      { region: "北部", visited: 1, total: 15 },
      { region: "東部", visited: 0, total: 11 },
      { region: "南部", visited: 1, total: 4 },
      { region: "西部", visited: 0, total: 6 },
      { region: "離島", visited: 0, total: 1 },
    ]);
    expect(makeSpotsCard([])).toMatchObject({ visited: 0, total: 37 });
    expect(makeSpotsCard(SURF_SPOTS.map(({ name }) => ({ spotName: name }))))
      .toMatchObject({ visited: 37, total: 37 });
  });

  it.each([
    { card: makeRecordCard(record), filename: "waveshare-surf-record.png", heading: record.spotName },
    { card: makeSpotsCard([record]), filename: "waveshare-my-spots.png", heading: "我的浪點" },
  ])("renders $filename as a 1080 × 1920 PNG", async ({ card, filename, heading }) => {
    const context = mockContext();
    const encode = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
      type
    ) {
      expect([this.width, this.height]).toEqual([1080, 1920]);
      callback(new Blob(["PNG"], { type }));
    });

    const file = await createShareCardFile(card);

    expect(file).toMatchObject({ name: filename, type: "image/png" });
    expect(encode).toHaveBeenCalledWith(expect.any(Function), "image/png");
    const rendered = context.fillText.mock.calls.map(([value]) => String(value));
    expect(rendered).toContain(heading);
    expect(rendered.join(" ")).not.toMatch(/private|mp4|https?:/);
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(context.arc).toHaveBeenCalled();
    expect(rendered).not.toContain("當日浪況");
  });

  it("draws the local photo as a centered cover crop and only exports the rendered PNG", async () => {
    const context = mockContext();
    const file = new File(["pixels"], "surf.jpg", { type: "image/jpeg" });
    const createObjectURL = vi.fn().mockReturnValue("blob:photo");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });
    class LocalImage {
      naturalWidth = 1600;
      naturalHeight = 800;
      decode = vi.fn().mockResolvedValue(undefined);
    }
    vi.stubGlobal("Image", LocalImage);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob(["PNG"])));

    const png = await createShareCardFile(makeRecordCard(record), file);

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:photo");
    expect(context.drawImage).toHaveBeenCalledWith(expect.any(LocalImage), 575, 0, 450, 800, 0, 0, 1080, 1920);
    expect(png).toMatchObject({ name: "waveshare-surf-record.png", type: "image/png" });
  });
});
