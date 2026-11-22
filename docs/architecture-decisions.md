# WaveShare 架構決策紀錄（ADR）

ADR 記下「要改什麼、有哪些取捨、上線前要確認什麼」。**選定方向，不代表已合併或已上線。** [回文件首頁](README.md)

| 編號    | 決策                     | 編寫時的實作狀態                                                                         | 正式站 |
| ------- | ------------------------ | ---------------------------------------------------------------------------------------- | ------ |
| ADR-001 | 新影片改用 Cloudflare R2 | 已接受；[PR #1](https://github.com/ChristingChang/waveshare/pull/1) 已合併到主分支       | 未驗證 |
| ADR-002 | 登入改用 GitHub          | 已被 [ADR-004](#adr-004登入從-manus-改用-google) 取代；未合併 | 不適用 |
| ADR-003 | 資料庫改用 TiDB Cloud    | PR #2 有連線設定和部署教學，尚未合併                                                     | 未驗證 |
| ADR-004 | 登入改用 Google          | [PR #2](https://github.com/ChristingChang/waveshare/pull/2) 有實作，尚未合併             | 未驗證 |

## ADR-001：新影片改由瀏覽器直接傳到 Cloudflare R2

**狀態：已接受。** [PR #1](https://github.com/ChristingChang/waveshare/pull/1) 已合併到主分支；正式站尚未驗證。

**背景。** PR #1 之前，瀏覽器先把影片傳給 WaveShare 後端，再轉存到 Manus Forge。程式雖允許單檔 100 MiB，但網站架在 Vercel，Vercel 會先擋下大約 4.5 MB 以上的整筆請求，所以超過這個大小的影片傳不上去。見 [Vercel 部署指南](../DEPLOY_TO_VERCEL.md)。

**決策。** 影片不再經過 WaveShare 後端，改由瀏覽器直接傳到 Cloudflare R2：浪友登入後，WaveShare 依申報的格式（MP4、MOV、WebM）與大小（最多 100 MiB）核發一個有效 10 分鐘、只能放進該浪友專屬位置的上傳網址；影片傳完後才送出紀錄，WaveShare 會再確認影片位置屬於本人。舊的後端上傳路徑已移除。也可以維持後端轉存，或改用其他支援瀏覽器直接上傳的儲存服務；本次採用 R2。見[上傳與刪除影片的程式](../server/r2.ts)。

**取捨。** 影片不再受 Vercel 約 4.5 MB 的限制，但要另外管理 Cloudflare 設定和費用。為了避免濫用，每位浪友在任意連續 24 小時內最多申請 10 次上傳，沒傳完也算（[次數限制程式](../server/videoUploads.ts)）。**日誌只有本人可讀，R2 播放網址卻是公開的；知道影片網址的人不用登入也能試著播放。** 不宜用此方案存放私密影片。刪除紀錄時，若沒有其他紀錄使用同一支影片，會嘗試刪除 R2 上的檔案；刪檔失敗不會擋下日誌刪除。另可啟用每日清理，處理申請超過 24 小時卻沒存成紀錄的影片。舊 Forge 影片保留原網址，不會自動搬到 R2，也不會被刪除。

**上線前。** 依 [R2 設定教學](R2_SETUP.zh-TW.md)設定儲存空間、允許的網站來源、播放網址與伺服器金鑰，並先在使用中的資料庫建立上傳次數記錄表（沒有這張表就無法上傳）。用實際部署測試超過 4.5 MB 的合法影片能上傳並播放、第 11 次申請會被擋下。若要啟用清理，設定 `CRON_SECRET`；Vercel 每天約台灣時間 11:00 執行一次，每次最多處理 100 筆，要確認它只清除沒被紀錄使用的上傳。確認舊 Forge 網址是否仍能播放、是否需要另外搬遷。

## ADR-002：登入從 Manus 改用 GitHub

**狀態：已被 [ADR-004](#adr-004登入從-manus-改用-google) 取代。** 以下保留當時的決策，不是目前的部署指引。

**背景。** 現行登入依賴 Manus 授權，以 Manus 提供的身分識別碼找到 WaveShare 帳號。日誌和好友關係依附 WaveShare 的內部使用者編號，不會因登入服務換了就自動換到新帳號。見[現行登入程式](../server/_core/oauth.ts)與[資料結構](../drizzle/schema.ts)。

**決策。** 改用 GitHub 帳號登入，取代 Manus 登入。其他可行方式包括保留 Manus，或另外支援 Email／其他登入服務；不推定選擇 GitHub 的理由。

**取捨。** 登入不再需要 Manus，但浪友要有 GitHub 帳號。PR #2 以 GitHub 的帳號編號辨識使用者，不用 Email 合併帳號。既有 Manus 使用者第一次用 GitHub 登入時會從空白日誌開始，不會自動接回舊紀錄；切換登入本身也不會刪除舊資料。

**上線前。** 依 [部署教學（PR #2）](https://github.com/ChristingChang/waveshare/blob/38e7c7dd0b59abfe7a9fe422bf35a56b837f5d26/docs/DEPLOY.zh-TW.md)設定 GitHub 授權應用程式與回到 WaveShare 的網址。驗證同一個 GitHub 帳號再次登入時能回到同一個 WaveShare 帳號，並驗證取消登入、登出與既有登入狀態。若要讓舊使用者接續日誌，須另外規劃並驗證帳號對應。

## ADR-003：正式資料庫改用 TiDB Cloud

**背景。** WaveShare 透過 MySQL 相容方式連資料庫；現有[程式](../server/db.ts)與[部署指南](../DEPLOY_TO_VERCEL.md)已按 MySQL／TiDB 撰寫，但儲存庫無法證明正式站現在連到哪一家服務或是否已有資料。

**決策。** 正式站以 TiDB Cloud 儲存帳號、衝浪紀錄及好友等資料；影片檔仍放在獨立的儲存服務。其他可行方式包括沿用現有資料庫或改用其他受管 MySQL；不推定選擇 TiDB Cloud 的理由。

**取捨。** 不必自行維護資料庫主機，也可沿用 MySQL 資料結構。PR #2 對 TiDB Cloud 自動使用加密連線並驗證伺服器憑證；仍要實測連線、資料表變更與相容性。設定新連線不會把舊資料搬過去。

**上線前。** 在 TiDB 套用版本對應的資料表變更，驗證 WaveShare 能讀寫資料。若要搬舊資料，先備份，再核對資料筆數、使用者與日誌／好友的關聯；切換後驗證影片仍可播放，並保留回復方式。

## ADR-004：登入從 Manus 改用 Google

**背景。** 不依賴 Manus 的版本原先規劃用 GitHub 登入（[ADR-002](#adr-002登入從-manus-改用-github)）。張淨雅認為要浪友用 GitHub 帳號登入不自然，改用浪友較熟悉的 Google 帳號。

**決策。** 用 Google 取代 Manus 登入，不採用 GitHub 登入。主分支仍使用 Manus；[PR #2](https://github.com/ChristingChang/waveshare/pull/2) 已實作 Google 登入，但尚未合併。

**取捨。** 浪友需要 Google 帳號，但不用再開 Manus 或 GitHub 帳號。WaveShare 用 Google 提供的專屬代號（儲存為 `google:<sub>`）辨識帳號，不用電子郵件比對。電子郵件只有經 Google 驗證才會儲存，其他浪友也不能用它搜尋。就算地址相同，舊 Manus 使用者也會從新的 WaveShare 帳號開始，舊日誌和好友不會自動轉入；切換登入不會刪除舊資料。

**上線前。** 依 [Google 登入部署教學（PR #2）](https://github.com/ChristingChang/waveshare/blob/09fac3e824c46d8f2d193d74cf3d127d35dec6b0/docs/DEPLOY.zh-TW.md)完成設定，並在實際部署的測試站確認登入、取消授權、登出，以及用同一帳號再次登入仍能看到日誌。若要接回舊日誌，須另外規劃帳號對應。

- **登入網址：** WaveShare 從 `/api/auth/google` 把使用者送往 Google，Google 授權後回到 `/api/auth/google/callback`。
- **部署設定：** 設定 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 與維持登入用的 `SESSION_SECRET`。`GOOGLE_CALLBACK_URL` 可選填；未填時，WaveShare 用發起登入的網站網址組成返回網址。這個返回網址必須和 Google 後台登記的完全一致。

## 切換時的依賴與待確認事項

- **程式合併：** R2 上傳的 PR #1 已合併到主分支；Google 登入與 TiDB Cloud 的 PR #2 原本接在 PR #1 上，仍待合併。R2 不需要等換資料庫就能使用。
- **正式切換：** R2 需要先在目標資料庫建立所需的表；Google 登入需要在目標資料庫正確找到使用者。可先在測試環境把兩項一起驗證。
- **資料接續：** 尚未確認正式站的既有資料、舊 Manus 帳號的對應方式，以及 Forge 影片是否須搬遷。若需要不公開的影片，應先選定私人播放方式，而不是使用目前的 R2 公開網址。
