# 發佈到 GitHub 指南 🚀

本文件說明如何將 WaveShare 專案發佈到 GitHub,並確保資安最佳實踐。

## 前置作業檢查

✅ 已完成的準備工作:
- [x] 檢查並移除敏感資訊
- [x] 建立 .gitignore 檔案(已包含 .env, uploads/, storage/ 等)
- [x] 建立 .env.example 範例檔
- [x] 撰寫 README.md 文件
- [x] 提交所有變更到本地 Git 儲存庫

## 發佈步驟

### 1. 在 GitHub 建立新儲存庫

1. 前往 [GitHub](https://github.com) 並登入您的帳號
2. 點擊右上角的 **+** 按鈕,選擇 **New repository**
3. 填寫儲存庫資訊:
   - **Repository name**: `waveshare` (或您喜歡的名稱)
   - **Description**: `🏄‍♂️ WaveShare 浪旅誌 - 衝浪影片日誌與社群平台`
   - **Visibility**: 選擇 **Public**(公開)或 **Private**(私有)
   - **不要**勾選 "Initialize this repository with a README"(因為我們已經有了)
4. 點擊 **Create repository**

### 2. 連結本地儲存庫到 GitHub

在終端機執行以下命令(請將 `your-username` 替換為您的 GitHub 使用者名稱):

```bash
cd /home/ubuntu/waveshare

# 設定遠端儲存庫
git remote add origin https://github.com/your-username/waveshare.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

### 3. 驗證發佈成功

1. 重新整理 GitHub 儲存庫頁面
2. 確認所有檔案都已上傳
3. 檢查 README.md 是否正確顯示

## 資安檢查清單

### ✅ 已防護的項目

- **環境變數隔離**: `.env` 檔案已加入 `.gitignore`,不會被上傳
- **API 金鑰保護**: 所有敏感金鑰都在 `.env` 中,未提交到 Git
- **上傳檔案排除**: `uploads/` 和 `storage/` 目錄已加入 `.gitignore`
- **資料庫憑證**: `DATABASE_URL` 僅存在於本地 `.env` 檔案
- **範例檔案**: `.env.example` 僅包含範例值,無真實憑證

### ⚠️ 發佈前最後確認

在推送到 GitHub 之前,請再次確認:

```bash
# 檢查是否有 .env 檔案被追蹤
git ls-files | grep "\.env$"
# 應該沒有任何輸出

# 檢查 .gitignore 是否生效
cat .gitignore | grep "\.env"
# 應該看到 .env 相關規則

# 查看即將推送的檔案
git ls-tree -r main --name-only | head -20
# 確認沒有敏感檔案
```

### 🔒 額外安全建議

1. **啟用 GitHub 雙因素認證 (2FA)**
   - 前往 Settings → Password and authentication
   - 啟用 Two-factor authentication

2. **使用 SSH 金鑰而非 HTTPS**
   ```bash
   # 產生 SSH 金鑰
   ssh-keygen -t ed25519 -C "your_email@example.com"
   
   # 複製公鑰
   cat ~/.ssh/id_ed25519.pub
   
   # 到 GitHub Settings → SSH and GPG keys 新增公鑰
   
   # 更改遠端 URL 為 SSH
   git remote set-url origin git@github.com:your-username/waveshare.git
   ```

3. **設定 GitHub Secrets(用於 CI/CD)**
   - 前往儲存庫 Settings → Secrets and variables → Actions
   - 新增必要的環境變數作為 Secrets

4. **啟用 Dependabot**
   - 前往儲存庫 Settings → Code security and analysis
   - 啟用 Dependabot alerts 和 Dependabot security updates

## 後續維護

### 更新專案

```bash
# 拉取最新變更
git pull origin main

# 進行修改後提交
git add .
git commit -m "feat: 新增功能描述"
git push origin main
```

### 協作開發

如果有其他開發者要貢獻:

1. 他們需要 fork 您的儲存庫
2. Clone fork 到本地
3. 建立新分支進行開發
4. 提交 Pull Request

### 版本標籤

建議使用語意化版本標籤:

```bash
# 建立版本標籤
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## 常見問題

### Q: 不小心提交了 .env 檔案怎麼辦?

A: 立即執行以下步驟:

```bash
# 從 Git 歷史中移除
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# 強制推送(會覆寫遠端歷史)
git push origin --force --all

# 更換所有在 .env 中的 API 金鑰和密碼!
```

### Q: 如何讓儲存庫變成私有?

A: 前往儲存庫 Settings → General → Danger Zone → Change repository visibility

### Q: 如何刪除遠端儲存庫?

A: 前往儲存庫 Settings → General → Danger Zone → Delete this repository

## 相關資源

- [GitHub 官方文件](https://docs.github.com)
- [Git 教學](https://git-scm.com/book/zh-tw/v2)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)

---

**祝您發佈順利!** 🎉
