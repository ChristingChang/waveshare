import { SPOT_COORDINATES } from "./surfSpots.js";

export const normalizeSpotName = (name: string) =>
  name
    .normalize("NFKC")
    .replace(/[\s()（）\-－]/g, "")
    .toLowerCase();
export const isTaiwanLocation = (lat: number, lng: number) =>
  lat >= 20.5 && lat <= 26.5 && lng >= 118 && lng <= 123.5;
export const distanceKm = (
  lat: number,
  lng: number,
  other: { lat: number; lng: number }
) =>
  111.2 *
  Math.hypot(
    lat - other.lat,
    (lng - other.lng) * Math.cos((lat * Math.PI) / 180)
  );

export function resolveConditionSpot(session: {
  spotName: string;
  spotLat?: string | null;
  spotLng?: string | null;
}) {
  const name = normalizeSpotName(session.spotName);
  const matched = CONDITION_SPOTS.find(spot =>
    [spot.name, ...spot.aliases].some(
      alias => normalizeSpotName(alias) === name
    )
  );
  const coordinates =
    session.spotLat?.trim() && session.spotLng?.trim()
      ? [Number(session.spotLat), Number(session.spotLng)]
      : SPOT_COORDINATES[session.spotName];
  const lat = matched?.lat ?? coordinates?.[0];
  const lng = matched?.lng ?? coordinates?.[1];
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  const isTaiwan = isTaiwanLocation(lat, lng);
  return { lat, lng, isTaiwan, cwaArea: matched?.cwaArea };
}

export const CONDITION_SPOTS = [
  {
    name: "白沙灣",
    lat: 25.285,
    lng: 121.5191,
    aliases: ["石門白沙灣"],
    cwaArea: "石門區沿海",
  },
  {
    name: "老梅",
    lat: 25.291,
    lng: 121.55,
    aliases: ["老梅沙灘"],
    cwaArea: "石門區沿海",
  },
  {
    name: "富貴角",
    lat: 25.298,
    lng: 121.537,
    aliases: [],
    cwaArea: "石門區沿海",
  },
  {
    name: "中角灣",
    lat: 25.2437,
    lng: 121.6225,
    aliases: ["金山", "金山中角灣", "中角"],
    cwaArea: "金山區沿海",
  },
  {
    name: "磺港",
    lat: 25.2269,
    lng: 121.6519,
    aliases: ["金山磺港"],
    cwaArea: "金山區沿海",
  },
  {
    name: "翡翠灣",
    lat: 25.1841,
    lng: 121.6898,
    aliases: ["飛行傘", "萬里翡翠灣"],
    cwaArea: "萬里區沿海",
  },
  {
    name: "萬里",
    lat: 25.1785,
    lng: 121.6969,
    aliases: ["萬里海水浴場", "wanli"],
    cwaArea: "萬里區沿海",
  },
  {
    name: "大武崙",
    lat: 25.1625,
    lng: 121.7082,
    aliases: ["大武崙沙灘"],
    cwaArea: "安樂區沿海",
  },
  {
    name: "望海巷",
    lat: 25.1436,
    lng: 121.8071,
    aliases: ["望海巷海灣"],
    cwaArea: "中正區沿海",
  },
  {
    name: "八斗子",
    lat: 25.1452,
    lng: 121.7965,
    aliases: [],
    cwaArea: "中正區沿海",
  },
  {
    name: "龍洞",
    lat: 25.1073,
    lng: 121.9163,
    aliases: ["龍洞灣"],
    cwaArea: "貢寮區沿海",
  },
  {
    name: "福隆",
    lat: 25.0218,
    lng: 121.9453,
    aliases: ["福隆海水浴場"],
    cwaArea: "貢寮區沿海",
  },
  {
    name: "馬崗",
    lat: 25.0104,
    lng: 122.0013,
    aliases: ["馬崗漁港"],
    cwaArea: "貢寮區沿海",
  },
  {
    name: "大里",
    lat: 24.9621,
    lng: 121.9272,
    aliases: ["宜蘭大里"],
    cwaArea: "頭城鎮沿海",
  },
  {
    name: "石城",
    lat: 24.9787,
    lng: 121.9464,
    aliases: [],
    cwaArea: "頭城鎮沿海",
  },
  {
    name: "大溪",
    lat: 24.9408,
    lng: 121.9006,
    aliases: ["宜蘭大溪", "大溪蜜月灣", "蜜月灣"],
    cwaArea: "頭城鎮沿海",
  },
  {
    name: "梗枋",
    lat: 24.9014,
    lng: 121.8796,
    aliases: ["梗枋漁港"],
    cwaArea: "頭城鎮沿海",
  },
  {
    name: "雙獅",
    lat: 24.879,
    lng: 121.8601,
    aliases: ["雙獅海灘"],
    cwaArea: "頭城鎮沿海",
  },
  {
    name: "外澳",
    lat: 24.8701,
    lng: 121.8395,
    aliases: ["外澳沙灘"],
    cwaArea: "頭城鎮沿海",
  },
  {
    name: "烏石港北堤",
    lat: 24.8659,
    lng: 121.8371,
    aliases: ["烏石港", "烏石", "烏石北堤", "烏石港北", "烏石港（北堤）"],
    cwaArea: "頭城鎮沿海",
  },
  {
    name: "烏石港南堤",
    lat: 24.8528,
    lng: 121.8414,
    aliases: ["烏石南堤", "烏石港南", "烏石港（南堤）"],
    cwaArea: "頭城鎮沿海",
  },
  {
    name: "臭水",
    lat: 24.8436,
    lng: 121.8325,
    aliases: ["臭水溝", "頭城濱海公園"],
    cwaArea: "頭城鎮沿海",
  },
  {
    name: "竹安",
    lat: 24.8041,
    lng: 121.8231,
    aliases: ["竹安溪口", "竹安清水"],
    cwaArea: "頭城鎮沿海",
  },
  {
    name: "永鎮",
    lat: 24.7581,
    lng: 121.8289,
    aliases: ["永鎮海濱"],
    cwaArea: "壯圍鄉沿海",
  },
  {
    name: "壯圍",
    lat: 24.7359,
    lng: 121.833,
    aliases: ["壯圍沙丘"],
    cwaArea: "壯圍鄉沿海",
  },
  {
    name: "利澤簡",
    lat: 24.663,
    lng: 121.8394,
    aliases: ["利澤"],
    cwaArea: "五結鄉沿海",
  },
  {
    name: "無尾港",
    lat: 24.6215,
    lng: 121.8562,
    aliases: ["蘇澳無尾港", "無尾港沙灘", "蘇澳 - 無尾港"],
    cwaArea: "蘇澳鎮沿海",
  },
  {
    name: "內埤",
    lat: 24.579,
    lng: 121.8708,
    aliases: ["情人灣", "南方澳內埤"],
    cwaArea: "蘇澳鎮沿海",
  },
  {
    name: "南澳",
    lat: 24.4512,
    lng: 121.8385,
    aliases: ["南澳沙灘"],
    cwaArea: "南澳鄉沿海",
  },
  {
    name: "七星潭",
    lat: 24.0282,
    lng: 121.6334,
    aliases: [],
    cwaArea: "新城鄉沿海",
  },
  {
    name: "花蓮北濱",
    lat: 23.975,
    lng: 121.6232,
    aliases: ["北濱"],
    cwaArea: "花蓮市沿海",
  },
  {
    name: "環保公園",
    lat: 23.9578,
    lng: 121.605,
    aliases: ["花蓮環保公園"],
    cwaArea: "吉安鄉沿海",
  },
  {
    name: "鹽寮",
    lat: 23.8967,
    lng: 121.6008,
    aliases: ["花蓮鹽寮", "鹽寮漁港"],
    cwaArea: "壽豐鄉沿海",
  },
  {
    name: "磯崎",
    lat: 23.6956,
    lng: 121.5464,
    aliases: ["磯崎海水浴場"],
    cwaArea: "豐濱鄉沿海",
  },
  {
    name: "石梯坪",
    lat: 23.4914,
    lng: 121.5113,
    aliases: [],
    cwaArea: "豐濱鄉沿海",
  },
  {
    name: "長濱",
    lat: 23.3148,
    lng: 121.4631,
    aliases: ["長濱海灘"],
    cwaArea: "長濱鄉沿海",
  },
  {
    name: "成功",
    lat: 23.1031,
    lng: 121.3829,
    aliases: ["成功海濱", "宜灣成功"],
    cwaArea: "成功鎮沿海",
  },
  {
    name: "都歷",
    lat: 23.0204,
    lng: 121.3232,
    aliases: ["都歷海灘", "天空之鏡", "都歷東河"],
    cwaArea: "成功鎮沿海",
  },
  {
    name: "東河",
    lat: 22.9721,
    lng: 121.313,
    aliases: ["東河河口", "台東東河"],
    cwaArea: "東河鄉沿海",
  },
  {
    name: "金樽",
    lat: 22.9465,
    lng: 121.2944,
    aliases: ["金樽漁港"],
    cwaArea: "東河鄉沿海",
  },
  {
    name: "加路蘭",
    lat: 22.798,
    lng: 121.195,
    aliases: [],
    cwaArea: "臺東市沿海",
  },
  {
    name: "漁光島",
    lat: 22.9781,
    lng: 120.1517,
    aliases: ["馬場", "安平漁光島", "漁光島（馬場）"],
    cwaArea: "安平區沿海",
  },
  {
    name: "旗津",
    lat: 22.6082,
    lng: 120.2688,
    aliases: ["旗津海水浴場"],
    cwaArea: "旗津區沿海",
  },
  {
    name: "佳樂水",
    lat: 21.9897,
    lng: 120.8546,
    aliases: ["佳樂水沖浪區"],
    cwaArea: "滿州鄉沿海",
  },
  {
    name: "南灣",
    lat: 21.9589,
    lng: 120.7659,
    aliases: ["墾丁南灣"],
    cwaArea: "恆春鎮沿海",
  },
  {
    name: "山水",
    lat: 23.5145,
    lng: 119.5924,
    aliases: ["澎湖山水", "山水沙灘"],
    cwaArea: "馬公市沿海",
  },
];
