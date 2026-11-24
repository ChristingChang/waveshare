import { resolveConditionSpot } from "../shared/conditionSpots";
import { fetchSurfConditions } from "../server/surfConditions";

const now = new Date();
const yesterday = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(+now - 86400000));
const spot = resolveConditionSpot({ spotName: "烏石港（北堤）" })!;
for (const hour of [7, null]) {
  console.log(
    JSON.stringify(
      {
        date: yesterday,
        spot: "烏石港（北堤）",
        snapshot: await fetchSurfConditions({
          ...spot,
          date: yesterday,
          hour,
          now,
          cwaApiKey: "",
        }),
      },
      null,
      2
    )
  );
}
