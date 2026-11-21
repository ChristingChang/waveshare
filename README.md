# WaveShare 浪旅誌 🏄‍♂️

**WaveShare 浪旅誌**是衝浪愛好者的影片日誌，讓您記錄每次下水的經驗、回顧造訪過的浪點，也能搜尋並加入好友。

**想了解產品現在能做什麼、接下來要改什麼？** 請從[產品與設計文件](docs/README.md)開始。

## 核心功能

### 📹 影片日誌管理
上傳衝浪影片，並記下日期、浪點、浪況評分、浪板類型與心得。

### 🗺️ 互動式地圖
互動式地圖標示台灣的衝浪浪點。藍色代表您到過的浪點，灰色代表尚未造訪；點擊標記可以查看浪點與造訪次數。

### 📊 統計分析
自動統計您的衝浪數據,包含總衝浪次數、探索浪點數量、平均浪況評分、最常造訪的浪點排行榜,以及各浪板類型的使用統計,幫助您了解自己的衝浪習慣。

### 📅 日曆視圖
月曆介面清楚顯示每個月的衝浪紀錄,點擊日期即可查看當天的詳細資訊,讓您輕鬆回顧過往的衝浪時光。

### 👥 好友系統
可以搜尋浪友、發送邀請，或接受、拒絕別人送來的邀請。目前好友名單不會顯示彼此的衝浪紀錄。

### 🏄 浪板管理
記錄每次使用的浪板類型,包含長板、短板、魚板、軟板、槍板、趣味板、迷你馬力布等七種選項,統計頁面自動分析各浪板的使用頻率。

## 技術架構

### 前端技術
- **React 19** - 現代化的使用者介面框架
- **Tailwind CSS 4** - 實用優先的 CSS 框架,打造海洋風格主題
- **tRPC 11** - 端到端型別安全的 API 呼叫
- **Wouter** - 輕量級路由管理
- **Leaflet.js** - 開源互動式地圖函式庫
- **shadcn/ui** - 高品質 UI 元件庫

### 後端技術
- **Express 4** - Node.js Web 應用程式框架
- **tRPC 11** - 型別安全的 RPC 框架
- **Drizzle ORM** - TypeScript ORM,支援 MySQL/TiDB
- **Manus OAuth** - 整合式使用者認證系統
- **Multer** - 檔案上傳中介軟體

### 資料庫設計
使用 MySQL/TiDB 儲存結構化資料,主要資料表包含:
- `users` - 使用者資訊與認證
- `surf_sessions` - 衝浪紀錄主表
- `surf_spots` - 浪點統計資料
- `friendships` - 好友關係管理
- `session_companions` - 紀錄同行夥伴

### 雲端儲存
整合 S3 相容儲存服務,所有上傳的影片檔案儲存於雲端,資料庫僅保存 URL 參照,確保系統效能與擴展性。

## 安裝與設定

### 環境需求
- Node.js 22.13.0 或以上版本
- pnpm 套件管理工具
- MySQL 或 TiDB 資料庫
- Manus 平台帳號(用於 OAuth 認證)

### 安裝步驟

1. **複製專案儲存庫**
```bash
git clone https://github.com/your-username/waveshare.git
cd waveshare
```

2. **安裝相依套件**
```bash
pnpm install
```

3. **設定環境變數**
```bash
cp .env.example .env
```

編輯 `.env` 檔案,填入您的資料庫連線資訊與 API 金鑰:
- `DATABASE_URL` - MySQL/TiDB 連線字串
- `JWT_SECRET` - Session 加密金鑰(請使用強密碼)
- `VITE_APP_ID` - Manus OAuth 應用程式 ID
- `BUILT_IN_FORGE_API_KEY` - Manus 後端 API 金鑰
- `VITE_FRONTEND_FORGE_API_KEY` - Manus 前端 API 金鑰

4. **初始化資料庫**
```bash
pnpm db:push
```

5. **啟動開發伺服器**
```bash
pnpm dev
```

應用程式將在 `http://localhost:3000` 啟動。

### 測試
```bash
pnpm test
```

執行 Vitest 單元測試,驗證核心功能正常運作。

## Vercel 部署

使用專案根目錄的 `vercel.json`：`pnpm build` 產生 `dist/public`，Vercel 託管靜態前端，非檔案的 SPA 路徑回傳 `index.html`。`/api/*` 由 `api/index.ts` 匯出的 Express app 處理，共用 `server/_core/app.ts` 的 OAuth、上傳與 tRPC 路由；不會啟動本機監聽器。`pnpm dev` / `pnpm start` 的本機 Node server 行為不變。

**上傳限制：** Vercel Node Functions 的 request body 上限約 **4.5 MB**（含 multipart 開銷），會先於應用程式的 100 MiB 限制生效。現有路由無法在 Vercel 接收大型影片；直接上傳尚未實作。詳見 [部署指南](DEPLOY_TO_VERCEL.md)。

## 專案結構

```
waveshare/
├── client/                 # 前端應用程式
│   ├── src/
│   │   ├── pages/         # 頁面元件
│   │   ├── components/    # 可重用 UI 元件
│   │   ├── lib/           # tRPC 客戶端設定
│   │   └── index.css      # 全域樣式與主題
│   └── public/            # 靜態資源
├── server/                 # 後端應用程式
│   ├── routers.ts         # tRPC 路由定義
│   ├── db.ts              # 資料庫查詢函式
│   └── _core/             # 核心框架程式碼
├── drizzle/               # 資料庫 schema 與遷移
│   └── schema.ts          # 資料表定義
├── shared/                # 前後端共用程式碼
│   ├── surfSpots.ts       # 浪點資料與座標
│   └── boardTypes.ts      # 浪板類型定義
└── storage/               # S3 儲存整合
```

## 資安考量

### 已實施的安全措施
- **環境變數隔離** - 所有敏感資訊(API 金鑰、資料庫密碼)儲存於 `.env` 檔案,並已加入 `.gitignore` 防止意外提交
- **JWT Session 管理** - 使用 HttpOnly Cookie 儲存 Session,防止 XSS 攻擊
- **tRPC 權限控制** - `protectedProcedure` 確保所有 API 呼叫都經過身份驗證
- **檔案上傳限制** - Multer 設定檔案大小限制,防止濫用
- **SQL Injection 防護** - Drizzle ORM 自動參數化查詢,避免 SQL 注入攻擊

### 部署前檢查清單
- [ ] 更換所有預設密碼與 API 金鑰
- [ ] 設定強密碼的 `JWT_SECRET`
- [ ] 啟用 HTTPS 加密連線
- [ ] 設定資料庫防火牆規則
- [ ] 定期備份資料庫
- [ ] 監控異常登入行為

## 未來發展方向

### 短期目標
- 完成紀錄標記好友功能,在上傳與編輯頁面新增多選好友選項
- 實作分享紀錄功能,讓使用者可以將精彩衝浪影片分享給好友
- 新增浪況條件記錄(浪高、風向、潮汐),幫助分析最佳衝浪時機

### 中期目標
- 建立等級與成就系統,根據探索浪點數量與衝浪次數自動升級
- 設計成就徽章(如「浪點探索者」、「百浪達人」)增加使用動力
- 新增動態牆功能,顯示好友最新衝浪紀錄與互動

### 長期願景
打造完整的**衝浪元宇宙**,每位使用者擁有虛擬角色,隨著探索浪點、分享影片而升級。建立社群互動功能,包含留言、按讚、收藏浪點、追蹤浪友,形成活躍的衝浪社群網絡。

## 授權條款

本專案採用 MIT 授權條款,詳見 [LICENSE](LICENSE) 檔案。

## 貢獻指南

歡迎提交 Issue 回報問題或建議新功能,也歡迎發送 Pull Request 貢獻程式碼。請確保您的程式碼:
- 通過所有測試(`pnpm test`)
- 遵循專案的程式碼風格
- 包含適當的註解說明

## 聯絡方式

如有任何問題或建議,歡迎透過 GitHub Issues 與我們聯繫。

---

**Made with 🌊 by WaveShare Team**
