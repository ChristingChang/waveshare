# 自動浪況（選用）

設定伺服器環境變數 `CWA_API_KEY` 可在臺灣當日紀錄優先使用中央氣象署鄉鎮沿海預報與潮汐。未設定時使用 Open-Meteo，不影響儲存。
部署前請執行 `drizzle/manual/0006_surf_conditions.sql` 新增欄位；既有紀錄預設為空值。可用 `pnpm backfill:conditions --dry-run` 預覽補資料（先確認 DATABASE_URL 指向正確資料庫）。

# Vercel 部署

請依照新版 [Google 登入、TiDB Cloud 與 Vercel 部署教學](docs/DEPLOY.zh-TW.md) 操作。

本程式使用 Google OAuth、TiDB/MySQL 與 Cloudflare R2，不需要 Manus 帳號或 Forge 服務。
影片設定請參閱 [R2 設定教學](docs/R2_SETUP.zh-TW.md)。
