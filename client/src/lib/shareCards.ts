import { BOARD_TYPES } from "@shared/boardTypes";
import type { ConditionsSnapshot } from "@shared/surfConditions";
import { REGIONS, SURF_SPOTS } from "@shared/surfSpots";
import { photoFileError, toDisplayablePhoto } from "./photoUpload";

export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1920;

type RecordFields = {
  spotName: string;
  date: string;
  waveQuality: number;
  boardType?: string | null;
  conditions?: string | null;
};

function makeConditions(conditions: RecordFields["conditions"]) {
  let snapshot: ConditionsSnapshot | null;
  try {
    snapshot = JSON.parse(conditions ?? "null");
  } catch {
    return null;
  }
  if (snapshot?.v !== 1) return null;

  const range = (value: ConditionsSnapshot["waveHeight"], unit: string) => {
    if (!value || !Number.isFinite(value.min) || !Number.isFinite(value.max)) return "";
    const min = Number(value.min.toFixed(1));
    const max = Number(value.max.toFixed(1));
    return `${min === max ? min : `${min}–${max}`} ${unit}`;
  };
  const bearing = (value: ConditionsSnapshot["windDirection"]) => {
    if (!value || !Number.isFinite(value.degrees)) return "";
    const index = ((Math.round(value.degrees / 45) % 8) + 8) % 8;
    return ["北", "東北", "東", "東南", "南", "西南", "西", "西北"][index];
  };
  const tides = Array.isArray(snapshot.tides)
    ? snapshot.tides.filter(tide => typeof tide?.time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(tide.time))
    : [];
  const tideTime = (type: "high" | "low") => tides.filter(tide => tide.type === type)
    .map(tide => tide.time).join(" / ");
  const metrics = [
    { label: "浪高", value: range(snapshot.waveHeight, "m") },
    { label: "週期", value: range(snapshot.wavePeriod, "s") },
    { label: "湧浪", value: bearing(snapshot.swellDirection) },
    { label: "風速", value: range(snapshot.windSpeed, "m/s") },
    { label: "風向", value: bearing(snapshot.windDirection) },
    { label: "潮汐", value: [
      tideTime("high") && `滿 ${tideTime("high")}`,
      tideTime("low") && `乾 ${tideTime("low")}`,
    ].filter(Boolean).join("  ·  ") },
  ].filter(item => item.value);
  if (!metrics.length) return null;

  const { hour } = snapshot;
  const time = snapshot.mode === "daytime"
    ? "06:00–18:00"
    : snapshot.mode === "hour" && hour !== null && Number.isInteger(hour) && hour >= 0 && hour < 24
      ? `${String(hour).padStart(2, "0")}:00`
      : "";
  return { time, metrics };
}

export function makeRecordCard({ spotName, date, waveQuality, boardType, conditions }: RecordFields) {
  return {
    kind: "record" as const,
    spotName: SURF_SPOTS.find(spot => spot.name === spotName)?.name ?? "未分類浪點",
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replaceAll("-", " / ") : "未記錄",
    rating: Math.min(5, Math.max(0, Math.round(waveQuality) || 0)),
    board: BOARD_TYPES.find(board => board === boardType) ?? "未記錄",
    conditions: makeConditions(conditions),
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

const ink = "#fff6e6";
const mint = "#a7ead4";
const muted = "#b9cfca";
const font = 'system-ui, "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif';
const gutter = 96;
const contentWidth = SHARE_CARD_WIDTH - 2 * gutter;

function drawOcean(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 180, 1040);
  sky.addColorStop(0, "#142b3d");
  sky.addColorStop(0.56, "#466b74");
  sky.addColorStop(1, "#dfad7d");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);

  ctx.fillStyle = "#ffdc9f";
  ctx.beginPath();
  ctx.arc(278, 544, 114, 0, 2 * Math.PI);
  ctx.fill();

  ctx.strokeStyle = "#ffedcc63";
  ctx.lineWidth = 2;
  for (const y of [602, 616, 638, 687, 710]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(410, y);
    ctx.stroke();
  }

  function wave(offset: number) {
    ctx.moveTo(-70, 762 + offset * 0.38);
    ctx.bezierCurveTo(200, 715 + offset * 0.7, 351, 1050 + offset, 612, 838 + offset * 0.7);
    ctx.bezierCurveTo(808, 678 + offset * 0.5, 674, 569 + offset * 0.43, 546, 586 + offset * 0.65);
    ctx.bezierCurveTo(662, 397 + offset * 0.85, 953, 440 + offset * 0.72, 1160, 601 + offset * 0.62);
  }

  const sea = ctx.createLinearGradient(540, 485, 570, 1350);
  sea.addColorStop(0, "#91dac4");
  sea.addColorStop(0.36, "#278a8f");
  sea.addColorStop(0.72, "#154b61");
  sea.addColorStop(1, "#0a202c");
  ctx.fillStyle = sea;
  ctx.beginPath();
  wave(0);
  ctx.lineTo(1160, SHARE_CARD_HEIGHT);
  ctx.lineTo(-70, SHARE_CARD_HEIGHT);
  ctx.fill();

  for (let i = 0; i < 21; i++) {
    ctx.beginPath();
    wave(i * 26);
    ctx.strokeStyle = i === 0 ? "#e5f8e7" : i % 4 === 0 ? "#83dabd83" : "#a8eddf40";
    ctx.lineWidth = i === 0 ? 8 : i % 4 === 0 ? 4 : 2;
    ctx.stroke();
  }

  let seed = 314;
  function scatter() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 150; i++) {
    const x = 556 + scatter() * 548;
    const rise = 0.00115 * (x - 810) ** 2;
    const distance = scatter() ** 1.8;
    const y = 474 + rise - distance * 145;
    ctx.fillStyle = i % 3 === 0 ? "#fff6e6a0" : "#ffedcc62";
    ctx.beginPath();
    ctx.arc(x, y, 0.9 + scatter() * 3.2 * (1 - distance * 0.66), 0, 2 * Math.PI);
    ctx.fill();
  }
}

function drawCover(ctx: CanvasRenderingContext2D, photo: HTMLImageElement) {
  const width = Math.min(photo.naturalWidth, photo.naturalHeight * SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT);
  const height = Math.min(photo.naturalHeight, photo.naturalWidth * SHARE_CARD_HEIGHT / SHARE_CARD_WIDTH);
  ctx.drawImage(photo, (photo.naturalWidth - width) / 2, (photo.naturalHeight - height) / 2,
    width, height, 0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
}

export function drawShareCard(ctx: CanvasRenderingContext2D, card: ShareCard, photo?: HTMLImageElement) {
  function text(value: string, x: number, y: number, size: number,
    color = ink, weight = 600, maxWidth = contentWidth) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillText(value, x, y, maxWidth);
  }

  function panel(x: number, y: number, width: number, height: number, color: string, radius = height / 2) {
    if (width <= 0) return;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }

  if (photo) drawCover(ctx, photo);
  else drawOcean(ctx);

  const scrim = ctx.createLinearGradient(0, 0, 0, SHARE_CARD_HEIGHT);
  scrim.addColorStop(0, "#061a26d9");
  scrim.addColorStop(0.20, "#061a264f");
  scrim.addColorStop(0.34, "#061a2600");
  scrim.addColorStop(0.51, "#061a2659");
  scrim.addColorStop(0.60, "#061a26c7");
  scrim.addColorStop(1, "#061a26fa");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);

  ctx.textBaseline = "alphabetic";
  text("WaveShare", gutter, 278, 52, ink, 850);
  ctx.textAlign = "right";
  text("浪旅誌", SHARE_CARD_WIDTH - gutter, 275, 32, ink, 700);
  ctx.textAlign = "left";
  panel(gutter, 303, contentWidth, 2, "#fff6e670");

  if (card.kind === "record") {
    const ocean = card.conditions?.metrics.filter(item => item.label !== "潮汐") ?? [];
    const tide = card.conditions?.metrics.find(item => item.label === "潮汐");
    const rows = Math.ceil(ocean.length / 3);
    const panelHeight = 89 + 106 * rows + (tide ? 53 : 16);
    const panelY = 1560 - panelHeight;
    const titleY = card.conditions ? panelY - 137 : 1336;
    text("S U R F   L O G   /   衝浪紀錄", gutter, titleY - 151, 33, mint, 800);
    text(card.spotName, gutter, titleY, 128, ink, 900);
    text(card.date, gutter, titleY + 76, 48, ink, 680);

    if (card.conditions) {
      panel(gutter, panelY, contentWidth, panelHeight, "#092330d9", 28);
      text("當日浪況", gutter + 30, panelY + 52, 30, mint, 800);
      ctx.textAlign = "right";
      text(card.conditions.time, SHARE_CARD_WIDTH - gutter - 30, panelY + 52, 30, muted, 650);
      ctx.textAlign = "left";
      panel(gutter + 30, panelY + 74, contentWidth - 60, 2, "#b9cfca50");
      ocean.forEach(({ label, value }, index) => {
        const x = gutter + 30 + (index % 3) * 274;
        const y = panelY + 116 + Math.floor(index / 3) * 106;
        text(label, x, y, 27, muted);
        text(value, x, y + 43, 37, ink, 780, 247);
      });
      if (tide) {
        text("潮汐", gutter + 30, 1532, 27, muted);
        text(tide.value, gutter + 114, 1532, 26, ink, 650, contentWidth - 144);
      }
    }

    panel(gutter, 1612, contentWidth, 2, "#fff6e670");
    text(card.rating > 0 ? `★  ${card.rating} / 5` : "浪況未評分", gutter, 1682, 35, mint, 800);
    ctx.textAlign = "right";
    text(card.board, SHARE_CARD_WIDTH - gutter, 1682, 34, ink, 700, 524);
    ctx.textAlign = "left";
  } else {
    text("S P O T   T R A C K E R", gutter, 835, 33, mint, 800);
    text("我的浪點", gutter, 951, 104, ink, 900);
    const count = String(card.visited);
    text(count, gutter, 1196, 243, ink, 900);
    text(`/ ${card.total}`, gutter + ctx.measureText(count).width + 28, 1186, 101, mint, 770);
    text("已造訪的浪點", gutter + 8, 1254, 34, muted);

    panel(gutter, 1312, contentWidth, 392, "#092330d9", 28);
    card.regions.forEach(({ region, visited, total }, index) => {
      const y = 1379 + index * 69;
      text(region, gutter + 30, y, 31);
      panel(gutter + 164, y - 22, 516, 14, "#b9cfca45");
      panel(gutter + 164, y - 22, (516 * visited) / total, 14, mint);
      ctx.textAlign = "right";
      text(`${visited} / ${total}`, SHARE_CARD_WIDTH - gutter - 30, y, 32, ink, 720);
      ctx.textAlign = "left";
    });
  }
}

async function decodeImage(src: string, crossOrigin?: "anonymous") {
  const image = new Image();
  if (crossOrigin) image.crossOrigin = crossOrigin;
  image.src = src;
  await image.decode();
  return image;
}

async function decodePhoto(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await decodeImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadPhoto(file: File) {
  const error = photoFileError(file);
  if (error) throw new Error(error);
  try {
    return await decodePhoto(file);
  } catch {
    try {
      const displayable = await toDisplayablePhoto(file);
      if (displayable !== file) return await decodePhoto(displayable);
    } catch {
      throw new Error("無法讀取照片，請改用 JPG 或 PNG");
    }
    throw new Error("無法讀取照片，請改用 JPG 或 PNG");
  }
}

async function encodeShareCard(card: ShareCard, photo?: HTMLImageElement): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_CARD_WIDTH;
  canvas.height = SHARE_CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  drawShareCard(ctx, card, photo);

  const png = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode share card"));
    }, "image/png");
  });
  const filename = card.kind === "record" ? "waveshare-surf-record.png" : "waveshare-my-spots.png";
  return new File([png], filename, { type: "image/png" });
}

export async function createShareCardFile(card: ShareCard, background?: File | string): Promise<File> {
  if (typeof background === "string") {
    try {
      return await encodeShareCard(card, await decodeImage(background, "anonymous"));
    } catch {
      return encodeShareCard(card);
    }
  }
  return encodeShareCard(card, background ? await loadPhoto(background) : undefined);
}
