import { BOARD_TYPES } from "@shared/boardTypes";
import { REGIONS, SURF_SPOTS } from "@shared/surfSpots";

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

type RecordFields = {
  spotName: string;
  date: string;
  waveQuality: number;
  boardType?: string | null;
};

export function makeRecordCard({ spotName, date, waveQuality, boardType }: RecordFields) {
  return {
    kind: "record" as const,
    spotName: SURF_SPOTS.find(spot => spot.name === spotName)?.name ?? "未分類浪點",
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replaceAll("-", " / ") : "未記錄",
    rating: Math.min(5, Math.max(0, Math.round(waveQuality) || 0)),
    board: BOARD_TYPES.find(board => board === boardType) ?? "未記錄",
  };
}

export function makeSpotsCard(sessions: readonly Pick<RecordFields, "spotName">[]) {
  const names = new Set(sessions.map(session => session.spotName));
  const regions = REGIONS.map(region => {
    const spots = SURF_SPOTS.filter(spot => spot.region === region);
    return { region, visited: spots.filter(spot => names.has(spot.name)).length, total: spots.length };
  });

  return {
    kind: "spots" as const,
    visited: regions.reduce((sum, region) => sum + region.visited, 0),
    total: SURF_SPOTS.length,
    regions,
  };
}

export type ShareCard = ReturnType<typeof makeRecordCard> | ReturnType<typeof makeSpotsCard>;

const ink = "#f2fffb";
const mint = "#7df4d6";
const muted = "#a3cfd0";
const font = 'system-ui, "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif';
const gutter = 112;
const contentWidth = SHARE_CARD_WIDTH - 2 * gutter;

export function drawShareCard(ctx: CanvasRenderingContext2D, card: ShareCard) {
  function text(value: string, x: number, y: number, size: number,
    color = ink, weight = 600, maxWidth = contentWidth) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillText(value, x, y, maxWidth);
  }

  function bar(x: number, y: number, width: number, height: number, color: string) {
    if (width <= 0) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, height / 2);
    ctx.fill();
  }

  const sky = ctx.createLinearGradient(0, 0, 780, SHARE_CARD_HEIGHT);
  sky.addColorStop(0, "#092331");
  sky.addColorStop(0.58, "#0b4551");
  sky.addColorStop(1, "#092b3b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);

  const sun = ctx.createRadialGradient(754, 444, 40, 754, 444, 495);
  sun.addColorStop(0, "#40ddc64d");
  sun.addColorStop(1, "#40ddc600");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, 970);

  for (let i = 0; i < 11; i++) {
    const y = 1360 + i * 31;
    ctx.beginPath();
    ctx.moveTo(-80, y + 240);
    ctx.bezierCurveTo(290, y - 150, 600, y + 255, 1160, y - 90);
    ctx.strokeStyle = i % 3 === 0 ? "#7df4d64d" : "#7df4d624";
    ctx.lineWidth = i % 3 === 0 ? 3 : 2;
    ctx.stroke();
  }

  ctx.textBaseline = "alphabetic";
  bar(gutter, 264, 48, 8, mint);
  text(card.kind === "record" ? "SURF LOG" : "SPOT TRACKER", gutter + 68, 281, 30, mint, 800);

  if (card.kind === "record") {
    text("衝浪紀錄", gutter, 428, 62, muted);
    text(card.spotName, gutter, 574, 124, ink, 800);
    text(card.date, gutter, 686, 54, mint, 700);
    bar(gutter, 787, contentWidth, 3, "#a3cfd052");

    text("浪況評分", gutter, 903, 36, muted);
    text("★".repeat(card.rating), gutter, 998, 64, mint);
    text(`${card.rating} / 5`, gutter + 392, 989, 48, ink, 700);
    text("板子類型", gutter, 1150, 36, muted);
    text(card.board, gutter, 1230, 62, ink, 700);
  } else {
    text("我的浪點", gutter, 425, 88, ink, 800);
    const count = String(card.visited);
    text(count, gutter, 660, 216, mint, 800);
    text(`/ ${card.total}`, gutter + ctx.measureText(count).width + 34, 643, 92, ink, 700);
    text("已造訪的浪點", gutter, 740, 38, muted);

    card.regions.forEach(({ region, visited, total }, index) => {
      const y = 874 + index * 101;
      text(region, gutter, y, 38);
      bar(gutter + 141, y - 26, 548, 17, "#a3cfd04d");
      bar(gutter + 141, y - 26, (548 * visited) / total, 17, mint);
      ctx.textAlign = "right";
      text(`${visited} / ${total}`, SHARE_CARD_WIDTH - gutter, y, 36, muted, 700);
      ctx.textAlign = "left";
    });
  }

  text("WaveShare 浪旅誌", gutter, 1638, 46, ink, 800);
}

export async function createShareCardFile(card: ShareCard): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_WIDTH;
  canvas.height = SHARE_CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  drawShareCard(ctx, card);

  const png = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode share card"));
    }, "image/png");
  });
  const filename = card.kind === "record" ? "waveshare-surf-record.png" : "waveshare-my-spots.png";
  return new File([png], filename, { type: "image/png" });
}
