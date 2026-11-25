# R2 影片與照片儲存設定教學

完成後，影片與照片會從您的瀏覽器直接傳到 Cloudflare R2，不會經過 Vercel 的 4.5 MB 限制。影片接受 MP4、MOV、WebM，單支最多 100 MiB；照片每筆最多 10 張，每張最多 20 MiB。

**只有紀錄本人和這筆紀錄指定的好友能看影片與照片。** WaveShare 先確認誰有權查看，再提供 15 分鐘有效的觀看連結；所以儲存空間本身必須關閉公開存取（第 2 步）。上傳網址有效 10 分鐘，請勿分享；Cloudflare 可能需要付款方式，使用量超過免費額度會收費。

## 1. 開帳號、建立儲存空間

1. 到 <https://dash.cloudflare.com/sign-up> 註冊並登入。
2. 找到 **R2 Object Storage → Overview**，依畫面啟用 R2（可能要求綁定付款方式）。
3. 按 **Create bucket**，名稱可填 `waveshare-videos`，記下名稱，這就是 `R2_BUCKET`。
4. 使用一般預設位置；本程式未設定 EU、US 或 FedRAMP 等特定司法管轄區的獨立連線端點。不要選需此類端點的 bucket。

## 2. 關閉公開存取

WaveShare 不再使用公開播放網址。舊版教學曾要求開啟公開網址；只要它還開著，舊的公開影片網址仍然誰都能播放。新建立的 bucket 預設不公開，仍請檢查一次：

1. 點進 bucket → **Settings**。
2. **Public Development URL**（`r2.dev` 網址）：若顯示已啟用（Enabled），按 **Disable** 並依畫面確認。應顯示為停用。
3. **Custom Domains**：若有連到這個 bucket 的自訂網域，逐一從該網域的選單停用（Disable）或移除（Remove）。清單應該是空的。
4. 回到 WaveShare 用過的舊公開影片網址（例如 `https://pub-你的代碼.r2.dev/r2/surf-videos/...`），在瀏覽器打開，應無法播放。Cloudflare 介面名稱可能會更新，以「不讓任何網址公開讀取這個 bucket」為準。

## 3. 允許您的網站上傳（CORS）

分享圖卡也需要這個設定：在 `AllowedOrigins` 加入開啟圖卡的 WaveShare 網址，並保留 `AllowedMethods` 裡的 `GET`。這樣瀏覽器才能用短效觀看連結讀取 R2 照片，或從影片擷取圖卡背景。影片能播放不代表可以擷取畫面；若讀取或擷取失敗，圖卡會試下一種背景。不要因此開啟公開存取。

1. 同一個 bucket 的 **Settings → CORS Policy → Add CORS policy → JSON**。
2. 貼上下列完整內容，把 `https://your-project.vercel.app` 換成您真正的 Vercel 網站網址。保留 `https://`，結尾不要有 `/` 或其他路徑。

```json
[
  {
    "AllowedOrigins": [
      "https://your-project.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

3. 按 **Save**，最多稍候約 30 秒。如果已透過自訂網域快取影片，修改 CORS 後可能需要清除該網域快取。
4. 若使用自訂網站網域、Vercel 預覽網址或不同本機連接埠，請逐一加入 `AllowedOrigins`；它們不會自動包含。不要為方便而允許所有網站。

## 4. 建立只限此 bucket 的鑰匙

1. 回到 **R2 Object Storage → Overview**，在 **Account Details** 記下 **Account ID**，這就是 `R2_ACCOUNT_ID`。
2. 在 **API Tokens** 旁按 **Manage**，選 **Create Account API token**；若您的帳號沒有此選項，可依權限使用 **Create User API token**（離開帳號後該使用者 token 會失效）。這是 R2 專用 token，不是一般 Cloudflare 網站 API token。
3. 權限選 **Object Read & Write**，只套用到剛剛的 `waveshare-videos` bucket，不要選所有 bucket 或 Admin 權限。
4. 建立後，分別複製 **Access Key ID** 與 **Secret Access Key**，對應 `R2_ACCESS_KEY_ID` 與 `R2_SECRET_ACCESS_KEY`。不要把另一個一般 API Token 值當作 Secret。
5. Secret 只顯示一次，請安全保存；遺失時需重建。不要放到 GitHub、截圖公開分享或填入任何 `VITE_` 開頭的變數。

## 5. 填進 Vercel，再重新部署

1. 打開 Vercel 專案 → **Settings → Environment Variables**。
2. 加入以下四個變數，值不要加引號：

| 名稱 | 填什麼 |
|---|---|
| `R2_ACCOUNT_ID` | 第 4 步的 Account ID |
| `R2_ACCESS_KEY_ID` | 第 4 步的 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | 第 4 步的 Secret Access Key |
| `R2_BUCKET` | bucket 名稱，例如 `waveshare-videos` |

3. 勾選您要使用的環境（Production，以及需要時的 Preview / Development）。這四個變數都由伺服器讀取，瀏覽器不會拿到帳號鑰匙，只會拿到短效的上傳網址與播放連結。
   若以前設定過 `R2_PUBLIC_URL`，程式已不再使用，可以刪除。
4. 先依[部署教學](DEPLOY.zh-TW.md)確認資料庫已更新，再到 **Deployments** 找目前部署，按選單的 **Redeploy**。只儲存變數而沒有重新部署不會更新既有部署。
5. 本機開發則把相同設定填進 `.env`，並依 `.env.example` 填妥資料庫與 OAuth 設定，重新啟動 `pnpm dev`。

## 6. 試一次

1. 登入 WaveShare，上傳一段小影片並播放；再用一段超過 4.5 MB、但不超過 100 MiB 的影片確認直接上傳。
2. 在詳細頁播放影片、查看照片，再用未登入的視窗或未獲分享的帳號直接開啟 `/api/videos/<紀錄編號>` 和 `/api/photos/<照片編號>`，應被擋下。用這筆紀錄指定的好友帳號則可以觀看。
3. 確認第 2 步已關閉公開存取：舊的 `r2.dev` 或自訂網域影片網址應無法播放。
4. 先確認測試站已部署含[影片畫面備援](https://github.com/ChristingChang/waveshare/pull/30)的版本；舊版沒有可用照片時會直接用插畫，不能用來驗證這項設定。用本人帳號開啟「分享圖卡」，不手動換背景，直接下載 PNG。有可用照片和影片時應看到第一張照片；只看縮圖不算通過。要測試沒有照片的影片紀錄，先移除測試紀錄自動存下的照片，再確認 PNG 用了影片畫面，且沒有新增紀錄照片。若照片和影片畫面都無法用，仍應能下載海浪插畫圖卡。

若失敗，先確認四個變數、CORS 的網站網址、token 的 bucket 範圍，以及是否已重新部署。

影片內容不會經過應用伺服器掃描；目前檢查的是申報的格式與大小，不是防毒或完整影片檢驗。R2 新影片使用 `r2/surf-videos/<使用者編號>/video-...` 路徑。播放出錯時，播放器會自動重新取得連結一次，並回到原來的位置。之前上傳到 R2 的影片不用搬移；既有 `surf-videos/...` 路徑的舊 Forge 影片也不會自動搬到 R2。本人或指定好友可經 WaveShare 開啟舊 Forge 影片；Forge 原網址本身是否公開，未確認。刪除紀錄時，網站會嘗試清掉不再使用的 R2 影片與照片；儲存服務刪除失敗會記錄錯誤，不影響紀錄刪除，可在 Cloudflare 手動整理。Forge 影片不會被刪除。

## 上傳次數限制

每位使用者在滾動的 24 小時內最多申請 10 次影片上傳。申請後即使未上傳、未建立紀錄或刪除紀錄，也會計入次數；簽名或傳輸失敗的申請亦可能計入，請稍後再試。

照片另有每個帳號在任意連續 24 小時內最多 100 次上傳申請的限制。

## 自動清理未使用影片與照片（選用）

部署新版前，請先依[部署教學](DEPLOY.zh-TW.md)建立影片上傳、分享與照片所需的資料表。

在 Vercel **Settings → Environment Variables** 新增選用的 `CRON_SECRET`，填入至少 16 字元的隨機密碼，僅用於伺服器，不可加上 `VITE_`；儲存後重新部署。不設定時清理端點會停用，不影響一般使用。

Vercel 每天約 UTC 03:00（台灣時間 11:00）呼叫 `GET /api/cron/cleanup-videos`，並自動帶上 `Authorization: Bearer <CRON_SECRET>`。清理會找出申請超過 24 小時、且沒有任何紀錄使用的 R2 檔案，每次最多處理 100 筆影片和 100 筆照片。刪除檔案後才移除申請資料，失敗會保留以便下次重試；仍有紀錄使用的檔案與 Forge 影片不會刪除。已刪除紀錄但 R2 刪除失敗的檔案，也可由此清理補刪（需有對應申請資料）。

## 官方參考

本教學已對照以下 Cloudflare 官方文件：
- [預簽上傳網址](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [CORS 設定](https://developers.cloudflare.com/r2/buckets/cors/)
- [公開 bucket 與 r2.dev 限制](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [建立 R2 存取鑰匙與權限](https://developers.cloudflare.com/r2/api/tokens/)
