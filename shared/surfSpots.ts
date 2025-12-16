export type Region = "北部" | "東部" | "南部" | "西部" | "離島";

export interface SurfSpotData {
  name: string;
  region: Region;
}

export const SURF_SPOTS: SurfSpotData[] = [
  // 北部
  { name: "沙崙白沙灣", region: "北部" },
  { name: "餐廳", region: "北部" },
  { name: "金山", region: "北部" },
  { name: "翡翠灣", region: "北部" },
  { name: "萬里", region: "北部" },
  { name: "福隆", region: "北部" },
  { name: "大溪", region: "北部" },
  { name: "梗枋", region: "北部" },
  { name: "雙獅", region: "北部" },
  { name: "外澳", region: "北部" },
  { name: "烏石港（北堤）", region: "北部" },
  { name: "烏石港（南堤）", region: "北部" },
  { name: "臭水", region: "北部" },
  { name: "竹安清水", region: "北部" },
  { name: "蘇澳 - 無尾港", region: "北部" },
  
  // 東部
  { name: "環保公園", region: "東部" },
  { name: "花蓮北濱", region: "東部" },
  { name: "雙橋", region: "東部" },
  { name: "鹽寮漁港", region: "東部" },
  { name: "磯崎", region: "東部" },
  { name: "八仙洞", region: "東部" },
  { name: "宜灣成功", region: "東部" },
  { name: "都歷東河", region: "東部" },
  { name: "金樽", region: "東部" },
  { name: "都蘭", region: "東部" },
  { name: "台東", region: "東部" },
  
  // 南部
  { name: "九棚", region: "南部" },
  { name: "佳樂水", region: "南部" },
  { name: "南灣", region: "南部" },
  { name: "射寮", region: "南部" },
  
  // 西部
  { name: "旗津", region: "西部" },
  { name: "漁光島（馬場）", region: "西部" },
  { name: "四草橋", region: "西部" },
  { name: "竹南", region: "西部" },
  { name: "松柏港", region: "西部" },
  { name: "外埔漁港", region: "西部" },
  
  // 離島
  { name: "山水", region: "離島" },
];

export const REGIONS: Region[] = ["北部", "東部", "南部", "西部", "離島"];

export function getSpotsByRegion(region: Region): string[] {
  return SURF_SPOTS
    .filter(spot => spot.region === region)
    .map(spot => spot.name);
}

export function getAllSpotNames(): string[] {
  return SURF_SPOTS.map(spot => spot.name);
}

// 浪點座標資料 [緯度, 經度]
export const SPOT_COORDINATES: Record<string, [number, number]> = {
  // 北部
  "沙崙白沙灣": [25.29, 121.52],
  "餐廳": [25.22, 121.51],
  "金山": [25.22, 121.64],
  "翡翠灣": [25.20, 121.68],
  "萬里": [25.18, 121.69],
  "福隆": [25.02, 121.94],
  "大溪": [24.95, 121.90],
  "梗枋": [24.93, 121.89],
  "雙獅": [24.92, 121.88],
  "外澳": [24.86, 121.85],
  "烏石港（北堤）": [24.84, 121.83],
  "烏石港（南堤）": [24.83, 121.83],
  "臭水": [24.82, 121.82],
  "竹安清水": [24.75, 121.80],
  "蘇澳 - 無尾港": [24.63, 121.85],
  
  // 東部
  "環保公園": [24.01, 121.62],
  "花蓮北濱": [24.00, 121.61],
  "雙橋": [23.98, 121.60],
  "鹽寮漁港": [23.95, 121.60],
  "磯崎": [23.82, 121.53],
  "八仙洞": [23.48, 121.40],
  "宜灣成功": [23.10, 121.38],
  "都歷東河": [23.08, 121.38],
  "金樽": [23.00, 121.32],
  "都蘭": [22.95, 121.27],
  "台東": [22.75, 121.15],
  
  // 南部
  "九棚": [22.18, 120.82],
  "佳樂水": [22.04, 120.85],
  "南灣": [21.94, 120.75],
  "射寮": [22.45, 120.48],
  
  // 西部
  "旗津": [22.60, 120.27],
  "漁光島（馬場）": [22.95, 120.14],
  "四草橋": [23.03, 120.14],
  "竹南": [24.70, 120.88],
  "松柏港": [24.35, 120.58], // 台中大甲
  "外埔漁港": [24.61, 120.78], // 苗栗後龍
  
  // 離島
  "山水": [23.56, 119.59], // 澎湖
};

export function getSpotCoordinates(spotName: string): [number, number] | null {
  return SPOT_COORDINATES[spotName] || null;
}
