export const BOARD_TYPES = [
  "長板 (Longboard)",
  "短板 (Shortboard)",
  "魚板 (Fish)",
  "軟板 (Softboard)",
  "槍板 (Gun)",
  "趣味板 (Funboard)",
  "迷你馬力布 (Mini Malibu)",
] as const;

export type BoardType = typeof BOARD_TYPES[number];

export function getBoardTypeDisplay(boardType: string | null | undefined): string {
  if (!boardType) return "未記錄";
  return boardType;
}
