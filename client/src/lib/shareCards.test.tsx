// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { SURF_SPOTS } from "@shared/surfSpots";
import { createShareCardFile, makeRecordCard, makeSpotsCard } from "./shareCards";

afterEach(() => vi.restoreAllMocks());

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
    });
    expect(makeRecordCard({ ...record, spotName: record.videoUrl, boardType: record.videoPath, date: record.videoUrl }))
      .toMatchObject({ spotName: "未分類浪點", board: "未記錄", date: "未記錄" });
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
    const gradient = { addColorStop: vi.fn() };
    const context = {
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      fillRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      stroke: vi.fn(),
      measureText: () => ({ width: 120 }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
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
  });
});
