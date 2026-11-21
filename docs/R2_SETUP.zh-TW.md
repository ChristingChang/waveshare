# R2 影片儲存設定教學

完成後，影片會從您的瀏覽器直接傳到 Cloudflare R2，不會經過 Vercel 的 4.5 MB 限制。本程式接受 MP4、MOV、WebM，單支影片最多 100 MiB。

**先提醒：這是公開播放的儲存空間。** 知道影片網址的人都能觀看，不適合放私人或敏感影片。上傳網址有效 10 分鐘，請勿分享；Cloudflare 可能需要付款方式，使用量超過免費額度會收費。

## 1. 開帳號、建立儲存空間

1. 到 <https://dash.cloudflare.com/sign-up> 註冊並登入。
2. 找到 **R2 Object Storage → Overview**，依畫面啟用 R2（可能要求綁定付款方式）。
3. 按 **Create bucket**，名稱可填 `waveshare-videos`，記下名稱，這就是 `R2_BUCKET`。
4. 使用一般預設位置；本程式未設定 EU、US 或 FedRAMP 等特定司法管轄區的獨立連線端點。不要選需此類端點的 bucket。

## 2. 取得公開播放網址

1. 點進剛建立的 bucket → **Settings**。
2. 在 **Public Development URL** 按 **Enable**，輸入 `allow` 並確認 **Allow**。
3. 複製顯示的 **Public Bucket URL**（例如 `https://pub-你的代碼.r2.dev`），這就是 `R2_PUBLIC_URL`；不要填 S3 API 的 `r2.cloudflarestorage.com` 網址。
4. `r2.dev` 是有流量限制的開發用途網址。正式服務建議在相同 Settings 的 **Custom Domains** 綁定由 Cloudflare 管理的網域，再把 `R2_PUBLIC_URL` 改成該 HTTPS 網址。不要自行把 CNAME 指到 `r2.dev`。

## 3. 允許您的網站上傳（CORS）

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
2. 加入以下五個變數，值不要加引號：

| 名稱 | 填什麼 |
|---|---|
| `R2_ACCOUNT_ID` | 第 4 步的 Account ID |
| `R2_ACCESS_KEY_ID` | 第 4 步的 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | 第 4 步的 Secret Access Key |
| `R2_BUCKET` | bucket 名稱，例如 `waveshare-videos` |
| `R2_PUBLIC_URL` | 第 2 步的公開 HTTPS 播放網址 |

3. 勾選您要使用的環境（Production，以及需要時的 Preview / Development）。這五個變數都由伺服器讀取，瀏覽器不會拿到帳號鑰匙，只會拿到短效上傳網址與播放網址。
4. 到 **Deployments** 找目前部署，按選單的 **Redeploy**。只儲存變數而沒有重新部署不會更新既有部署。
5. 本機開發則把相同設定填進 `.env`，並依 `.env.example` 填妥資料庫與 OAuth 設定，重新啟動 `pnpm dev`。

## 6. 試一次

登入 WaveShare，上傳一段小影片並播放；再用一段超過 4.5 MB、但不超過 100 MiB 的影片確認直接上傳。若失敗，先確認五個變數、CORS 的網站網址、token 的 bucket 範圍，以及是否已重新部署。

影片內容不會經過應用伺服器掃描；目前檢查的是申報的格式與大小，不是防毒或完整影片檢驗。R2 新影片使用 `r2/surf-videos/<使用者編號>/video-...` 路徑，播放網址會依目前的 `R2_PUBLIC_URL` 組合。既有 `surf-videos/...` 路徑保留原播放網址，不會自動搬到 R2；仍可只編輯文字資料。刪除紀錄也不會刪除 R2 物件，可在 Cloudflare 手動整理。

## 官方參考

每位使用者在滾動的 24 小時內最多申請 10 次影片上傳。申請後即使未上傳、未建立紀錄或刪除紀錄，也會計入次數；簽名或傳輸失敗的申請亦可能計入，請稍後再試。

本教學已對照以下 Cloudflare 官方文件：
- [預簽上傳網址](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [CORS 設定](https://developers.cloudflare.com/r2/buckets/cors/)
- [公開 bucket 與 r2.dev 限制](https://developers.cloudflare.com/r2/buckets/public-buckets/)
- [建立 R2 存取鑰匙與權限](https://developers.cloudflare.com/r2/api/tokens/)
