# WaveShare 部署教學：Google 登入、TiDB Cloud、Vercel

本版本不需要 Manus 帳號或 Forge 服務。網站放在 Vercel，帳號與衝浪紀錄放在 TiDB Cloud，影片與照片放在 Cloudflare R2。

**舊 Manus 帳號不會自動轉移。** 使用者需要重新用 Google 登入，建立新的 WaveShare 帳號，從空白紀錄開始；不會依相同電子郵件合併舊資料。舊資料不會因此被刪除。

## 1. 建立 TiDB Cloud 資料庫

1. 到 <https://tidbcloud.com/> 註冊或登入，建立叢集，選擇 **Starter / Serverless**（介面名稱可能更新）。選擇適合的地區，設定並保存資料庫密碼。
2. 開啟叢集的 **Connect**，選擇公開連線與 MySQL 相容的連線方式。記下主機、連接埠、使用者名稱和密碼；使用者名稱可能包含叢集識別碼，請完整複製。
3. 在 TiDB 的 **SQL Editor** 執行 `CREATE DATABASE IF NOT EXISTS waveshare;`，建立網站使用的資料庫。
4. 取得連線字串，格式如下（不要把範例值照貼）：

   ```text
   mysql://使用者名稱:密碼@TiDB主機:4000/waveshare
   ```

   若控制台提供完整 URI，可直接複製並將資料庫名稱設為 `waveshare`。密碼或帳號含 `@`、`:`、`/` 等特殊字元時必須做 URL 編碼，不可直接拼接；可請協助部署的人處理。不要把此字串放到公開文件、GitHub 或截圖中。
5. 這個字串就是 `DATABASE_URL`。主機結尾為 `.tidbcloud.com` 時，程式與遷移工具都會自動使用 TLS 1.2 以上並驗證伺服器憑證。其他 MySQL 主機若需要同樣保護，設定 `DATABASE_SSL=true`。不要關閉憑證驗證。

## 2. 在 Vercel 建立網站

1. 到 <https://vercel.com/new> 登入並匯入 WaveShare 儲存庫，確認正式部署使用主分支（`main`）。
2. 使用專案內的 `vercel.json`：安裝指令 `pnpm install`、建置指令 `pnpm build`、輸出資料夾 `dist/public`。API 由 `api/index.ts` 處理，網頁路徑由 SPA fallback 處理。
3. 記下預定使用的正式網址，例如 `https://waveshare-example.vercel.app`。可以先建立專案取得網址，再填入下列設定並重新部署。尚未設定登入時，登入端點會顯示設定未完成。

## 3. 建立 Google 登入設定

1. 用 Google 帳號開啟 <https://console.cloud.google.com/>，點上方專案選單 → **新增專案（New project）**，命名為 `WaveShare` 並建立，再切換到該專案。
2. 開啟 **Google Auth Platform**（舊介面為 **APIs & Services → OAuth consent screen**），按 **Get started**。在 **Branding** 填應用程式名稱、使用者支援信箱與聯絡信箱。
3. **Audience / 使用者類型** 選 **External（外部）**，不是 Internal，讓組織外的 Google 帳號也能登入。在 **Data Access** 只使用基本的 `openid`、`email`、`profile`，不需加入 Gmail 或雲端硬碟權限。
   在 OAuth 同意畫面（Branding）填入隱私權政策 `https://waveshare-six.vercel.app/privacy` 與服務條款 `https://waveshare-six.vercel.app/terms`，供 Google 審查及使用者閱讀。
4. 到 **Audience** 按 **Publish app（發布應用程式）** 並確認，讓狀態由 **Testing** 改為 **In production**。只留在測試模式時，只有列出的測試帳號可用；正式公開前必須發布。若 Google 要求品牌或網域驗證，請依控制台提示完成。
5. 到 **Clients → Create client**（舊介面為 **Credentials → Create credentials → OAuth client ID**），類型選 **Web application（網頁應用程式）**。
6. **Authorized JavaScript origins（已授權的 JavaScript 來源）** 填網站來源，不含路徑，例如 `https://waveshare-example.vercel.app`。**Authorized redirect URIs（已授權的重新導向 URI）** 填完整 callback：

   ```text
   https://waveshare-example.vercel.app/api/auth/google/callback
   ```

7. 建立後複製 **Client ID** 與 **Client secret** 並安全保存，對應 `GOOGLE_CLIENT_ID` 與 `GOOGLE_CLIENT_SECRET`，只填到 Vercel 的伺服器端環境變數，不要公開。
8. 建議將 `GOOGLE_CALLBACK_URL` 明確設為上述 callback。若留空，程式使用發起請求的網站來源組合 callback。更換自訂網域時，Google 用戶端的來源、redirect URI 與 Vercel 的 callback 都要一起更新，網址必須完全一致（包括 HTTPS、路徑與結尾斜線）。

本機開發或 Vercel 預覽若使用不同網址，建議另建 Google Web application 用戶端與對應環境變數，避免登入後跳回正式網站。本機來源填 `http://localhost:3000`，redirect URI 填 `http://localhost:3000/api/auth/google/callback`；若開發埠不同需一起調整。預覽網址也需逐一授權，不能使用萬用字元。

## 4. 產生 Session 金鑰與設定 R2

請協助部署的人在已安裝 Node.js 的電腦終端機執行：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

將輸出保存為 `SESSION_SECRET`。不要公開或加上 `VITE_`。更換此金鑰會讓所有使用者需要重新登入。

影片請完整依照 [R2 設定教學](R2_SETUP.zh-TW.md) 建立 bucket、關閉公開存取、設定 CORS，並建立只限該 bucket 的 Object Read & Write 存取鑰匙。影片只有紀錄本人能播放，WaveShare 確認身分後才給 15 分鐘有效的播放連結。**若 bucket 曾開啟 `r2.dev` 公開網址或公開的自訂網域，請到 Cloudflare 關閉**（作法見 R2 教學第 2 步）；沒關之前，舊的公開影片網址仍然誰都能播放。

## 5. 在 Vercel 填環境變數

開啟專案 **Settings → Environment Variables**，逐一新增，填值時不要加上多餘引號。Production、Preview、Development 各自使用相應設定，修改後都要重新部署。

| 變數 | 是否必填 / 用途 |
|---|---|
| `DATABASE_URL` | 必填；第 1 步的資料庫連線字串 |
| `DATABASE_SSL` | 選填；`true` 啟用其他 MySQL 主機的 TLS；TiDB Cloud 自動啟用 |
| `SESSION_SECRET` | 必填；第 4 步的隨機金鑰 |
| `JWT_SECRET` | 僅舊設定相容；未填 `SESSION_SECRET` 時才使用，不需同時設定 |
| `GOOGLE_CLIENT_ID` | 必填；Google OAuth App 的 Client ID |
| `GOOGLE_CLIENT_SECRET` | 必填；Google OAuth App 的 Secret |
| `GOOGLE_CALLBACK_URL` | 選填但建議明確指定；第 3 步的完整 callback |
| `R2_ACCOUNT_ID` | 影片功能必填；Cloudflare 帳號 ID |
| `R2_ACCESS_KEY_ID` | 影片功能必填；R2 存取鑰匙 ID |
| `R2_SECRET_ACCESS_KEY` | 影片功能必填；R2 存取密鑰 |
| `R2_BUCKET` | 影片功能必填；bucket 名稱 |
| `CRON_SECRET` | 選填；另一組至少 16 字元的隨機密碼，啟用每日未使用影片清理；不要與 Session 金鑰共用 |
| `CWA_API_KEY` | 選填；中央氣象署開放資料的金鑰，讓台灣當天的紀錄優先使用氣象署資料 |
| `PORT` | 只供本機 / 自架使用，預設 3000；Vercel 不需填 |
| `NODE_ENV` | Vercel 正式部署自動使用 `production`，不需手動填 |

上述設定不要放到會公開給瀏覽器的前端變數。分頁標題「WaveShare 浪旅誌」和海浪圖示已隨網站提供，不用在 Vercel 設定；若以前填過 `VITE_APP_TITLE` 或 `VITE_APP_LOGO`，可刪除。`R2_PUBLIC_URL` 也已不再使用。無需設定舊 Manus OAuth、Forge 或分析服務變數。

**自動浪況的外部服務。** 如要使用中央氣象署的鄉鎮沿海預報（`F-D0047-095`）及潮汐資料（`F-A0021-001`），請從[中央氣象署開放資料平臺](https://opendata.cwa.gov.tw/)取得金鑰，只填到 Vercel 的伺服器端環境變數 `CWA_API_KEY`，不要公開。網站也會向 [Open-Meteo](https://open-meteo.com/) 查詢海象及天氣（較早日期用歷史天氣），不用填金鑰。氣象署資料不足時由 Open-Meteo 補上；沒有氣象署金鑰時仍會查 Open-Meteo。若外部服務查不到資料，仍可儲存紀錄。

## 6. 初始化 / 更新資料庫

**Vercel 部署不會自動更新資料庫。** 請在重新部署前，由管理者在 TiDB Cloud 的 **SQL Editor** 手動執行還沒套用的 SQL。若要更新現有資料庫，請先備份。確認選的是網站 `DATABASE_URL` 指向的資料庫（本教學使用 `waveshare`）。

1. **全新資料庫才需要這一步：** 先照編號依序開啟 [`0000` 到 `0003` 的 SQL 檔](../drizzle/)，貼到 SQL Editor 逐檔執行。若檔案中有 `--> statement-breakpoint`，貼上後先刪除那一整行（只移除分隔標記，不移除 SQL）。原有站點不用重跑已套用的檔案；影片上傳次數限制和清理需要 `0003` 建立的 `video_uploads` 表。
2. **好友分享（0004）：** 開啟 [`drizzle/0004_session_shares.sql`](../drizzle/0004_session_shares.sql)，把內容貼到 SQL Editor，刪除 `--> statement-breakpoint` 那一行後執行，建立 `session_shares` 表及其索引。若已套用 0004，不要重跑。
3. **照片（0005）：** 開啟 [`drizzle/manual/0005_photos.sql`](../drizzle/manual/0005_photos.sql)，整份貼到 SQL Editor 執行，建立 `photo_uploads` 和 `session_photos`。這份檔案可重複執行；不要另外執行 `drizzle/0005_photos.sql`，它是給 Drizzle 工具使用的同一項更新。
4. **自動浪況與下水時間（0006，部署前必做）：** 開啟 [`drizzle/manual/0006_surf_conditions.sql`](../drizzle/manual/0006_surf_conditions.sql)，整份貼到 SQL Editor 執行，在 `surf_sessions` 加入可留空的 `surfHour`（下水時間）與 `conditions`（自動浪況）欄位。這份檔案可重複執行；不要另外執行 `drizzle/0006_surf_conditions.sql`。即使不設定 `CWA_API_KEY`，仍須先加欄位，否則網站無法正常讀取紀錄。
5. 確認上述三張新表及兩個新欄位都出現在正確的資料庫，再回 Vercel 重新部署。如果 0004 曾執行到一半或不確定某次更新是否已完成，先請熟悉資料庫的人核對，不要直接重跑。手動貼 SQL 不會更新 Drizzle 的遷移紀錄；同一資料庫不要再用 `pnpm db:push` 或 `pnpm exec drizzle-kit migrate` 重跑已手動套用的檔案。

## 7. 重新部署與確認

1. 回到 Vercel **Deployments** → 目前版本 → **Redeploy**。
2. 用未登入的視窗開啟網站，確認分頁標題和海浪圖示正確，先看到介紹頁及示範畫面，不會自動前往 Google。按「使用 Google 登入」才前往 Google，成功後回到首頁。從頁面上方按「登出」，應顯示介紹頁，不會自動再登入；再試一次手動登入。
3. 在測試站新增一筆有影片的紀錄，以及一筆有照片、無影片的紀錄。確認本人能播放影片、點照片縮圖看大圖、編輯照片與刪除紀錄。選用的影片及照片直接上傳 R2，不受 Vercel 約 4.5 MB 的函式請求大小限制。
4. 用不同帳號確認新紀錄預設不分享。指定好友並儲存後，對方可從好友頁打開紀錄及其影片或照片，但不能編輯。未登入或未被選中的好友直接開啟 `/api/videos/<紀錄編號>` 或 `/api/photos/<照片編號>` 會被擋下；取消分享後，指定好友也無法再向 WaveShare 取得新連結。先前取得的 R2 連結仍可能用到 15 分鐘的有效期結束。另確認舊的 `r2.dev` 或公開自訂網域網址已無法播放。
5. 每位使用者在任意連續 24 小時內最多申請 10 次影片和 100 次照片上傳，未完成的申請也會計入。設定 `CRON_SECRET` 後，Vercel 每天清理未使用的上傳，細節見 [R2 教學](R2_SETUP.zh-TW.md)。
6. 在自己的紀錄詳細頁與地圖頁確認「分享圖卡」能預覽並下載 PNG；用支援直接分享圖片的瀏覽器再確認「分享圖片」可傳送圖片檔。圖卡由瀏覽器產生，不需要額外的部署設定。
7. 用已知浪點各新增一筆有填、沒填下水時間的紀錄，確認兩筆都能儲存。查得到資料時，首頁最近紀錄及詳細頁應顯示選定整點或 06:00–18:00 的風浪資料與來源。若 API 都回傳 500，確認部署版本已包含 [PR #22](https://github.com/ChristingChang/waveshare/pull/22) 的修正；它解決 Vercel 上的 API 啟動錯誤，不需另加設定，也沒有新的資料庫更新。

好友分享（[#13](https://github.com/ChristingChang/waveshare/pull/13)）和照片（[#14](https://github.com/ChristingChang/waveshare/pull/14)）都未在實際的 Cloudflare R2 或正式資料庫上測試。請先完成上述測試站檢查，再正式上線。

若登入失敗，先確認 Google redirect URI 完全一致、應用程式已發布為 In production、Secret 無多餘空白、TiDB 遷移已完成，並且已重新部署。不要將登入 code、存取 token、Cookie 或資料庫密碼貼到公開 issue。

若新增或編輯紀錄時，畫面提示「照片功能尚未啟用」且缺少照片資料表，請確認網站連到哪個 TiDB Cloud 資料庫，並由管理員依[第 6 步](#6-初始化--更新資料庫)在該資料庫執行 [`drizzle/manual/0005_photos.sql`](../drizzle/manual/0005_photos.sql)。只重新部署不會建立資料表。若畫面顯示其他原因，請依提示處理；例如已達次數上限就稍後再試，不必重跑 SQL。

## 8. 為舊紀錄補浪況（選用）

執行 0006 不會替舊紀錄補資料。如有需要，請協助部署的人先確認本機的 `DATABASE_URL` 指向要補資料的資料庫，再執行 `pnpm backfill:conditions --dry-run` 列出尚無自動浪況的紀錄；這一步只預覽，不寫入。確認無誤後，執行 `pnpm backfill:conditions`，只用 Open-Meteo 補上查得到的資料，不覆蓋已有的浪況。
