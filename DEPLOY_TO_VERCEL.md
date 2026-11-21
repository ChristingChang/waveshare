# 部署到 Vercel 完整指南 ⚡

本文件提供將 WaveShare 浪旅誌部署到 Vercel 的詳細步驟,包含 GitHub 自動化部署設定、環境變數配置、資料庫連線等完整流程。

## 為什麼選擇 Vercel?

Vercel 是專為前端框架與全端應用程式設計的雲端平台,提供以下優勢:

- **零配置部署** - 自動偵測 React + Express 專案結構,無需複雜設定
- **全球 CDN** - 自動將靜態資源分發到全球邊緣節點,提升載入速度
- **自動化 CI/CD** - 每次推送到 GitHub 自動觸發建置與部署
- **免費方案** - 個人專案可免費使用,包含自訂網域與 HTTPS
- **環境變數管理** - 安全地儲存 API 金鑰與資料庫憑證
- **即時預覽** - 每個 Pull Request 自動產生預覽環境

## 前置需求

在開始部署之前,請確認您已完成:

- ✅ 將專案推送到 GitHub(參考 `DEPLOY_TO_GITHUB.md`)
- ✅ 擁有 Vercel 帳號(可使用 GitHub 帳號登入)
- ✅ 準備好資料庫連線資訊(MySQL/TiDB)
- ✅ 準備好 Manus OAuth API 金鑰

## 部署步驟

### 第一步:建立 Vercel 帳號並連結 GitHub

1. **前往 Vercel 官網**
   - 開啟瀏覽器前往 [https://vercel.com](https://vercel.com)
   - 點擊右上角的 **Sign Up** 按鈕

2. **使用 GitHub 登入**
   - 選擇 **Continue with GitHub**
   - 授權 Vercel 存取您的 GitHub 帳號
   - Vercel 會自動讀取您的儲存庫列表

3. **安裝 Vercel GitHub App**
   - 系統會提示安裝 Vercel GitHub App
   - 選擇 **Install** 並授權存取您的儲存庫
   - 建議選擇 **Only select repositories** 並選擇 `waveshare` 儲存庫

### 第二步:匯入專案到 Vercel

1. **建立新專案**
   - 登入 Vercel 後,點擊 **Add New...** → **Project**
   - 在儲存庫列表中找到 `waveshare`
   - 點擊 **Import** 按鈕

2. **配置專案設定**
   
   Vercel 會自動偵測專案類型,但我們需要手動調整一些設定:

   | 設定項目 | 值 | 說明 |
   |---------|---|------|
   | **Framework Preset** | Other | 因為是自訂全端架構 |
   | **Root Directory** | `./` | 專案根目錄 |
   | **Build Command** | `pnpm build` | 建置命令 |
   | **Output Directory** | `dist/public` | Vite 靜態前端輸出目錄 |
   | **Install Command** | `pnpm install` | 安裝命令 |

3. **不要立即部署**
   - 先點擊 **Environment Variables** 展開環境變數區塊
   - 我們需要先設定環境變數才能成功部署

### 第三步:設定環境變數

在 Vercel 專案設定頁面的 **Environment Variables** 區塊,逐一新增以下環境變數:

#### 必要環境變數

| 變數名稱 | 說明 | 範例值 |
|---------|------|--------|
| `DATABASE_URL` | MySQL/TiDB 連線字串 | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Session 加密金鑰 | 使用強密碼(至少 32 字元) |
| `VITE_APP_ID` | Manus OAuth 應用程式 ID | 從 Manus 平台取得 |
| `OAUTH_SERVER_URL` | Manus OAuth 伺服器 URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | Manus 登入入口 URL | `https://auth.manus.im` |
| `OWNER_OPEN_ID` | 專案擁有者 Open ID | 從 Manus 平台取得 |
| `OWNER_NAME` | 專案擁有者名稱 | 您的名稱 |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API URL | `https://forge.manus.im` |
| `BUILT_IN_FORGE_API_KEY` | Manus 後端 API 金鑰 | 從 Manus 平台取得 |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus 前端 API 金鑰 | 從 Manus 平台取得 |
| `VITE_FRONTEND_FORGE_API_URL` | Manus Forge API URL(前端) | `https://forge.manus.im` |

#### 選用環境變數

| 變數名稱 | 說明 | 預設值 |
|---------|------|--------|
| `VITE_APP_TITLE` | 應用程式標題 | `WaveShare 浪旅誌` |
| `VITE_APP_LOGO` | 應用程式 Logo 路徑 | `/logo.svg` |
| `VITE_ANALYTICS_ENDPOINT` | 分析服務端點 | (選用) |
| `VITE_ANALYTICS_WEBSITE_ID` | 分析網站 ID | (選用) |

**新增環境變數的步驟:**

1. 在 **Key** 欄位輸入變數名稱(例如 `DATABASE_URL`)
2. 在 **Value** 欄位輸入對應的值
3. 選擇環境: **Production**, **Preview**, **Development** (建議全選)
4. 點擊 **Add** 按鈕
5. 重複以上步驟,新增所有必要的環境變數

### 第四步:部署專案

1. **開始部署**
   - 確認所有環境變數都已設定完成
   - 點擊 **Deploy** 按鈕
   - Vercel 會開始建置與部署流程

2. **監控部署進度**
   - 部署頁面會即時顯示建置日誌
   - 整個流程通常需要 2-5 分鐘
   - 如果出現錯誤,請仔細閱讀錯誤訊息

3. **部署成功**
   - 看到 **Congratulations!** 訊息表示部署成功
   - Vercel 會自動產生一個網址,格式為 `https://waveshare-xxx.vercel.app`
   - 點擊 **Visit** 按鈕即可查看您的網站

### 第五步:設定自訂網域(選用)

1. **新增網域**
   - 進入專案的 **Settings** → **Domains**
   - 點擊 **Add** 按鈕
   - 輸入您的網域名稱(例如 `waveshare.com`)

2. **配置 DNS 記錄**
   
   Vercel 會提供 DNS 設定指示,通常需要新增以下記錄:

   | 類型 | 名稱 | 值 |
   |------|------|-----|
   | A | @ | `76.76.21.21` |
   | CNAME | www | `cname.vercel-dns.com` |

3. **等待 DNS 生效**
   - DNS 傳播通常需要 24-48 小時
   - Vercel 會自動偵測並啟用 HTTPS

### 第六步:設定自動化部署

Vercel 已自動設定 GitHub 整合,每次推送程式碼時會自動觸發部署:

1. **Production 部署**
   - 推送到 `main` 分支會自動部署到正式環境
   - 使用您設定的自訂網域或 Vercel 提供的網址

2. **Preview 部署**
   - 推送到其他分支或建立 Pull Request 會產生預覽環境
   - 每個 PR 都有獨立的預覽網址,方便測試

3. **部署通知**
   - Vercel 會在 GitHub PR 中自動留言,提供預覽連結
   - 可在 Vercel Dashboard 查看所有部署歷史

## Vercel 專案配置檔

專案已包含 `vercel.json`。主要設定如下（安全標頭保留在實際檔案中）:

```json
{
  "version": 2,
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "framework": null,
  "outputDirectory": "dist/public",
  "functions": {
    "api/index.ts": { "memory": 1024, "maxDuration": 10 }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api"
    },
    {
      "source": "/((?!api(?:/|$))[^.]*)",
      "destination": "/index.html"
    }
  ]
}
```

**配置說明:**

- **outputDirectory** - `pnpm build` 產生的 `dist/public` 由 Vercel 靜態託管。
- **functions** - `api/index.ts` 匯出 Express app，不呼叫 listen；共用 `server/_core/app.ts` 的 OAuth、上傳與 tRPC 路由。
- **rewrites** - `/api/*` 導向 Node function 並保留原始請求路徑；非檔案的 SPA 路徑回傳 `index.html`，靜態資源不改寫。
- 在 Vercel Project Settings 選擇支援的 Node.js 版本（例如 22.x）；`NODE_VERSION` 環境變數不是 runtime 版本設定。
- `pnpm dev` / `pnpm start` 仍透過 `server/_core/index.ts` 啟動本機 Node server，不用作 Vercel function entry。

## 資料庫設定

### 使用 TiDB Cloud(推薦)

TiDB Cloud 提供免費的 MySQL 相容資料庫,非常適合與 Vercel 搭配:

1. **建立 TiDB Cloud 帳號**
   - 前往 [https://tidbcloud.com](https://tidbcloud.com)
   - 使用 GitHub 帳號註冊

2. **建立 Serverless Cluster**
   - 選擇 **Create Cluster** → **Serverless**
   - 選擇最近的區域(建議選擇 AWS Tokyo 或 Singapore)
   - 免費方案提供 5GB 儲存空間

3. **取得連線字串**
   - 點擊 **Connect** 按鈕
   - 複製 MySQL 連線字串
   - 格式: `mysql://user:password@host:4000/database?sslmode=verify-full`

4. **設定 Vercel 環境變數**
   - 將連線字串設定為 `DATABASE_URL`
   - 確保包含 SSL 參數

### 使用其他 MySQL 服務

如果您使用 AWS RDS、Google Cloud SQL 或其他 MySQL 服務:

1. 確保資料庫允許來自 Vercel 的連線(可能需要設定 IP 白名單)
2. 啟用 SSL 連線以確保安全性
3. 連線字串格式: `mysql://username:password@host:port/database`

### 初始化資料庫

部署成功後,需要初始化資料庫結構:

```bash
# 在本地執行(確保 DATABASE_URL 指向正式環境資料庫)
pnpm db:push
```

**注意:** Vercel 的 Serverless 環境不支援在部署時執行資料庫遷移,需要手動執行。

## 常見問題與解決方案

### Q1: 部署失敗,顯示 "Build failed"

**可能原因與解決方案:**

1. **環境變數未設定**
   - 檢查所有必要的環境變數是否都已設定
   - 特別注意 `DATABASE_URL` 和 API 金鑰

2. **建置命令錯誤**
   - 確認 Build Command 為 `pnpm install && pnpm build`
   - 檢查 `package.json` 中的 `build` script 是否正確

3. **相依套件問題**
   - 查看建置日誌,找出失敗的套件
   - 可能需要在 `package.json` 中調整相依版本

### Q2: 部署成功但網站無法開啟

**可能原因與解決方案:**

1. **路由配置錯誤**
   - 檢查 `vercel.json` 的 routes 設定
   - 確保 `/api/*` 正確導向後端

2. **環境變數缺少 VITE_ 前綴**
   - 前端環境變數必須以 `VITE_` 開頭
   - 例如: `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`

3. **資料庫連線失敗**
   - 檢查 `DATABASE_URL` 是否正確
   - 確認資料庫允許來自 Vercel 的連線

### Q3: OAuth 登入失敗

**可能原因與解決方案:**

1. **Callback URL 未設定**
   - 前往 Manus 平台的 OAuth 應用程式設定
   - 新增 Vercel 網址作為 Callback URL
   - 格式: `https://your-app.vercel.app/api/oauth/callback`

2. **CORS 錯誤**
   - 檢查 Manus OAuth 設定中的允許來源
   - 確保包含您的 Vercel 網域

### Q4: 影片上傳失敗

**可能原因與解決方案:**

1. **檔案大小限制**
   - Vercel Node Functions 的 request body 上限約 **4.5 MB**（包含 multipart 開銷）；超限請求會在進入 Express 前被拒絕。
   - 應用程式的 Multer 100 MiB 限制仍適用於獨立 Node 部署，但無法突破 Vercel 平台限制。
   - 此部署只能透過現有路由上傳小於平台限制的影片。大型影片需另行設計直接上傳流程，或改用獨立 Node 託管；目前未實作直接上傳。

2. **Storage proxy 憑證未設定**
   - 設定 `BUILT_IN_FORGE_API_URL` 與 `BUILT_IN_FORGE_API_KEY`。
   - 上傳需要有效的登入 Cookie；未登入時會回傳 401。

### Q5: 部署後資料庫是空的

**解決方案:**

Vercel 不會自動執行資料庫遷移,需要手動初始化:

```bash
# 設定環境變數指向正式環境資料庫
export DATABASE_URL="your_production_database_url"

# 執行資料庫推送
pnpm db:push
```

## 效能優化建議

### 1. 使用 Node Functions

本專案使用 Express、Multer 與 mysql2，必須使用 Node runtime，不可將 function 切換為 Edge runtime。

### 2. 設定快取策略

在 `vercel.json` 中設定靜態資源快取:

```json
{
  "headers": [
    {
      "source": "/(.*).js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### 3. 圖片優化

使用 Vercel Image Optimization:

```typescript
// 在 React 元件中
import Image from 'next/image';

<Image 
  src="/logo.svg" 
  width={200} 
  height={200} 
  alt="WaveShare Logo" 
/>
```

### 4. 分析效能

啟用 Vercel Analytics:

1. 前往專案 **Settings** → **Analytics**
2. 點擊 **Enable Analytics**
3. 查看即時流量與效能指標

## 監控與除錯

### 查看即時日誌

1. 進入 Vercel Dashboard
2. 選擇您的專案
3. 點擊 **Deployments** → 選擇特定部署
4. 點擊 **Functions** 標籤查看 Serverless Function 日誌

### 設定錯誤追蹤

整合 Sentry 進行錯誤追蹤:

```bash
# 安裝 Sentry
pnpm add @sentry/node @sentry/react

# 在共用 server/_core/app.ts 初始化
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV,
});
```

## 成本估算

Vercel 提供慷慨的免費方案,適合個人專案:

| 項目 | 免費方案 | Pro 方案 ($20/月) |
|------|----------|-------------------|
| 頻寬 | 100 GB | 1 TB |
| Serverless Function 執行時間 | 100 GB-Hours | 1000 GB-Hours |
| 建置時間 | 6000 分鐘/月 | 無限制 |
| 團隊成員 | 1 人 | 無限制 |
| 自訂網域 | 無限制 | 無限制 |
| 環境變數 | 無限制 | 無限制 |

對於 WaveShare 這樣的專案,免費方案通常已足夠。如果流量增加,可隨時升級。

## 安全性最佳實踐

### 1. 環境變數管理

- ✅ 所有敏感資訊都透過 Vercel 環境變數設定
- ✅ 不要在程式碼中硬編碼 API 金鑰
- ✅ 定期輪換 JWT_SECRET 和 API 金鑰

### 2. HTTPS 強制

Vercel 自動為所有網域啟用 HTTPS,並強制重導向。

### 3. CORS 設定

若需 CORS，應在共用的 `server/_core/app.ts` 中設定，使本機與 Vercel 使用相同設定:

```typescript
app.use(cors({
  origin: process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000',
  credentials: true,
}));
```

### 4. Rate Limiting

保護 API 端點免受濫用:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100 // 最多 100 次請求
});

app.use('/api/', limiter);
```

## 回滾與版本管理

### 回滾到先前版本

如果新版本出現問題:

1. 前往 Vercel Dashboard → **Deployments**
2. 找到穩定的舊版本
3. 點擊 **⋯** → **Promote to Production**
4. 確認回滾操作

### 使用 Git Tags

建議使用 Git tags 標記重要版本:

```bash
# 建立版本標籤
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Vercel 會自動為每個 tag 建立部署
```

## 下一步

部署成功後,建議進行以下優化:

1. **設定自訂網域** - 提升品牌專業度
2. **啟用 Analytics** - 了解使用者行為
3. **整合 Sentry** - 即時追蹤錯誤
4. **設定 GitHub Actions** - 自動化測試流程
5. **建立 Staging 環境** - 使用 Preview 部署測試新功能

## 相關資源

- [Vercel 官方文件](https://vercel.com/docs)
- [Vercel CLI 工具](https://vercel.com/docs/cli)
- [TiDB Cloud 文件](https://docs.pingcap.com/tidbcloud/)
- [Vercel Community](https://github.com/vercel/vercel/discussions)

---

**祝您部署順利!** 🚀 如有任何問題,歡迎參考 Vercel 官方文件或社群支援。
