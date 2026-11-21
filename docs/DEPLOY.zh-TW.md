# WaveShare 部署教學：Google 登入、TiDB Cloud、Vercel

本版本不需要 Manus 帳號或 Forge 服務。網站放在 Vercel，帳號與衝浪紀錄放在 TiDB Cloud，影片放在 Cloudflare R2。

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

1. 到 <https://vercel.com/new> 登入並匯入 WaveShare 儲存庫。若分支尚未合併，請確認部署的是包含此功能的分支。
2. 使用專案內的 `vercel.json`：安裝指令 `pnpm install`、建置指令 `pnpm build`、輸出資料夾 `dist/public`。API 由 `api/index.ts` 處理，網頁路徑由 SPA fallback 處理。
3. 記下預定使用的正式網址，例如 `https://waveshare-example.vercel.app`。可以先建立專案取得網址，再填入下列設定並重新部署。尚未設定登入時，登入端點會顯示設定未完成。

## 3. 建立 Google 登入設定

1. 用 Google 帳號開啟 <https://console.cloud.google.com/>，點上方專案選單 → **新增專案（New project）**，命名為 `WaveShare` 並建立，再切換到該專案。
2. 開啟 **Google Auth Platform**（舊介面為 **APIs & Services → OAuth consent screen**），按 **Get started**。在 **Branding** 填應用程式名稱、使用者支援信箱與聯絡信箱。
3. **Audience / 使用者類型** 選 **External（外部）**，不是 Internal，讓組織外的 Google 帳號也能登入。在 **Data Access** 只使用基本的 `openid`、`email`、`profile`，不需加入 Gmail 或雲端硬碟權限。
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

影片請完整依照 [R2 設定教學](R2_SETUP.zh-TW.md) 建立 bucket、公開播放網址、CORS 與 bucket 範圍的 Object Read & Write 存取鑰匙。R2 環境變數名稱維持不變；公開網址代表知道網址的人可以觀看影片。

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
| `R2_PUBLIC_URL` | 影片功能必填；HTTPS 公開播放網址 |
| `CRON_SECRET` | 選填；另一組至少 16 字元的隨機密碼，啟用每日未使用影片清理；不要與 Session 金鑰共用 |
| `VITE_APP_TITLE` | 建議填 `WaveShare 浪旅誌`；公開網頁標題 |
| `VITE_APP_LOGO` | 建議填公開可讀取的圖示網址；非機密 |
| `PORT` | 只供本機 / 自架使用，預設 3000；Vercel 不需填 |
| `NODE_ENV` | Vercel 正式部署自動使用 `production`，不需手動填 |

除了 `VITE_APP_TITLE`、`VITE_APP_LOGO`，上述資料都不要放到前端變數。無需設定舊 Manus OAuth、Forge 或分析服務變數。

## 6. 初始化 / 更新資料庫

請協助部署的人在專案根目錄執行，電腦需要 Node.js 22.13 以上與 pnpm：

```sh
pnpm install --frozen-lockfile
```

複製 `.env.example` 為本機 `.env`，填入 `DATABASE_URL`，需要時填 `DATABASE_SSL`；不要提交 `.env`。確認目標為剛建立的 TiDB 資料庫，不是其他網站的資料庫，再執行已隨專案提供的遷移：

```sh
pnpm exec drizzle-kit migrate
```

也可使用專案既有 `pnpm db:push`（會先產生 schema 差異，再遷移）。若是在既有資料庫上升級，先備份，再請熟悉資料庫的人確認。遷移需要包含 `video_uploads` 表，上傳次數限制與清理會用到。

## 7. 重新部署與確認

1. 回到 Vercel **Deployments** → 目前版本 → **Redeploy**。
2. 開啟網站並點登入，應導向 Google 授權，完成後回到首頁；測試登出、再次登入。
3. 新增衝浪紀錄並上傳影片，測試播放、編輯與刪除。影片直接上傳 R2，不受 Vercel 約 4.5 MB 的函式請求大小限制。
4. 每位使用者每滾動 24 小時最多申請 10 次上傳，未完成的申請也會計入。設定 `CRON_SECRET` 後，Vercel 每天呼叫清理路由，細節見 R2 教學。

若登入失敗，先確認 Google redirect URI 完全一致、應用程式已發布為 In production、Secret 無多餘空白、TiDB 遷移已完成，並且已重新部署。不要將登入 code、存取 token、Cookie 或資料庫密碼貼到公開 issue。
