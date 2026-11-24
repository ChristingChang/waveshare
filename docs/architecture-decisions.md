# WaveShare 架構決策紀錄（ADR）

ADR 記下「要改什麼、有哪些取捨、上線前要確認什麼」。**選定方向，不代表已合併或已上線。** [回文件首頁](README.md)

| 編號    | 決策                     | 編寫時的實作狀態                                                                         | 正式站 |
| ------- | ------------------------ | ---------------------------------------------------------------------------------------- | ------ |
| ADR-001 | 新影片改用 Cloudflare R2 | 已接受；[PR #1](https://github.com/ChristingChang/waveshare/pull/1) 已合併；公開播放部分已被 ADR-005 取代 | 未驗證 |
| ADR-002 | 登入改用 GitHub          | 已被 [ADR-004](#adr-004登入從-manus-改用-google) 取代；未合併 | 不適用 |
| ADR-003 | 資料庫改用 TiDB Cloud    | 已接受；[PR #2](https://github.com/ChristingChang/waveshare/pull/2) 已合併到主分支       | 未驗證 |
| ADR-004 | 登入改用 Google          | 已接受；[PR #2](https://github.com/ChristingChang/waveshare/pull/2) 已合併到主分支       | 未驗證 |
| ADR-005 | 影片只給本人播放（私人播放連結） | 已接受；[PR #10](https://github.com/ChristingChang/waveshare/pull/10) 已合併；私人連結保留，「只給本人」已由 [ADR-006](#adr-006逐筆分享給指定好友) 放寬 | 未驗證 |
| ADR-006 | 逐筆分享給指定好友 | 已接受；[PR #13](https://github.com/ChristingChang/waveshare/pull/13) 已合併到主分支 | 未驗證 |
| ADR-007 | 影片選填，照片可私人附加 | 已接受；[PR #14](https://github.com/ChristingChang/waveshare/pull/14) 已合併到主分支 | 未驗證 |
| ADR-008 | 由瀏覽器產生可帶出站外的分享圖卡 | 已接受；[PR #16](https://github.com/ChristingChang/waveshare/pull/16) 已合併到主分支 | 未驗證 |
| ADR-009 | 從外部查詢浪況並隨日誌保存 | 已接受；[PR #20](https://github.com/ChristingChang/waveshare/pull/20) 及部署修正 [PR #22](https://github.com/ChristingChang/waveshare/pull/22) 已合併到主分支 | 未驗證 |

## ADR-001：新影片改由瀏覽器直接傳到 Cloudflare R2

**狀態：已接受。** [PR #1](https://github.com/ChristingChang/waveshare/pull/1) 已合併到主分支；正式站尚未驗證。

**部分已被 [ADR-005](#adr-005影片只給本人播放) 取代：** 直接上傳到 R2、次數限制、刪除與清理仍有效。下文「R2 播放網址是公開的」以及上線前設定「播放網址」這兩處，已改為 ADR-005 的私人播放連結；以下保留原決策內容。

**背景。** PR #1 之前，瀏覽器先把影片傳給 WaveShare 後端，再轉存到 Manus Forge。程式雖允許單檔 100 MiB，但網站架在 Vercel，Vercel 會先擋下大約 4.5 MB 以上的整筆請求，所以超過這個大小的影片傳不上去。見 [Vercel 部署指南](../DEPLOY_TO_VERCEL.md)。

**決策。** 影片不再經過 WaveShare 後端，改由瀏覽器直接傳到 Cloudflare R2：浪友登入後，WaveShare 依申報的格式（MP4、MOV、WebM）與大小（最多 100 MiB）核發一個有效 10 分鐘、只能放進該浪友專屬位置的上傳網址；影片傳完後才送出紀錄，WaveShare 會再確認影片位置屬於本人。舊的後端上傳路徑已移除。也可以維持後端轉存，或改用其他支援瀏覽器直接上傳的儲存服務；本次採用 R2。見[上傳與刪除影片的程式](../server/r2.ts)。

**取捨。** 影片不再受 Vercel 約 4.5 MB 的限制，但要另外管理 Cloudflare 設定和費用。為了避免濫用，每位浪友在任意連續 24 小時內最多申請 10 次上傳，沒傳完也算（[次數限制程式](../server/videoUploads.ts)）。**日誌只有本人可讀，R2 播放網址卻是公開的；知道影片網址的人不用登入也能試著播放。** 不宜用此方案存放私密影片。刪除紀錄時，若沒有其他紀錄使用同一支影片，會嘗試刪除 R2 上的檔案；刪檔失敗不會擋下日誌刪除。另可啟用每日清理，處理申請超過 24 小時卻沒存成紀錄的影片。舊 Forge 影片保留原網址，不會自動搬到 R2，也不會被刪除。

**上線前。** 依 [R2 設定教學](R2_SETUP.zh-TW.md)設定儲存空間、允許的網站來源、播放網址與伺服器金鑰，並先在使用中的資料庫建立上傳次數記錄表（沒有這張表就無法上傳）。用實際部署測試超過 4.5 MB 的合法影片能上傳並播放、第 11 次申請會被擋下。若要啟用清理，設定 `CRON_SECRET`；Vercel 每天約台灣時間 11:00 執行一次，每次最多處理 100 筆，要確認它只清除沒被紀錄使用的上傳。確認舊 Forge 網址是否仍能播放、是否需要另外搬遷。

## ADR-002：登入從 Manus 改用 GitHub

**狀態：已被 [ADR-004](#adr-004登入從-manus-改用-google) 取代。** 以下保留原決策；文中的「現行」指當時的 Manus 版本，不是現在的做法。

**背景。** 現行登入依賴 Manus 授權，以 Manus 提供的身分識別碼找到 WaveShare 帳號。日誌和好友關係依附 WaveShare 的內部使用者編號，不會因登入服務換了就自動換到新帳號。見[當時的登入程式](https://github.com/ChristingChang/waveshare/blob/77c54ca/server/_core/oauth.ts)與[資料結構](../drizzle/schema.ts)。

**決策。** 改用 GitHub 帳號登入，取代 Manus 登入。其他可行方式包括保留 Manus，或另外支援 Email／其他登入服務；不推定選擇 GitHub 的理由。

**取捨。** 登入不再需要 Manus，但浪友要有 GitHub 帳號。PR #2 以 GitHub 的帳號編號辨識使用者，不用 Email 合併帳號。既有 Manus 使用者第一次用 GitHub 登入時會從空白日誌開始，不會自動接回舊紀錄；切換登入本身也不會刪除舊資料。

**上線前。** 依 [部署教學（PR #2）](https://github.com/ChristingChang/waveshare/blob/38e7c7dd0b59abfe7a9fe422bf35a56b837f5d26/docs/DEPLOY.zh-TW.md)設定 GitHub 授權應用程式與回到 WaveShare 的網址。驗證同一個 GitHub 帳號再次登入時能回到同一個 WaveShare 帳號，並驗證取消登入、登出與既有登入狀態。若要讓舊使用者接續日誌，須另外規劃並驗證帳號對應。

## ADR-003：正式資料庫改用 TiDB Cloud

**狀態：已接受。** [PR #2](https://github.com/ChristingChang/waveshare/pull/2) 已合併到主分支；正式站的連線與資料未驗證。

**背景。** WaveShare 透過 MySQL 相容方式連資料庫，TiDB Cloud 支援這種連線方式。

**決策。** 部署時採用 TiDB Cloud 儲存帳號、衝浪紀錄及好友等資料；影片檔另存 Cloudflare R2。其他可行方式包括沿用現有資料庫或改用其他受管 MySQL；不推定選擇 TiDB Cloud 的理由。

**取捨。** 不必自行維護資料庫主機，也可沿用 MySQL 資料結構。連到以 `.tidbcloud.com` 結尾的主機時，WaveShare 會自動使用加密連線，並核對憑證和主機名稱。設定新連線不會把舊資料搬過去。

**上線前。** 依[部署教學](DEPLOY.zh-TW.md)設定 TiDB Cloud 和更新資料表，並驗證 WaveShare 能讀寫資料。若要搬舊資料，先備份，再核對資料筆數、使用者與日誌／好友的關聯；切換後驗證影片仍可播放，並保留回復方式。

## ADR-004：登入從 Manus 改用 Google

**狀態：已接受。** [PR #2](https://github.com/ChristingChang/waveshare/pull/2) 已合併到主分支；正式站登入未驗證。

**背景。** 不依賴 Manus 的版本原先規劃用 GitHub 登入（[ADR-002](#adr-002登入從-manus-改用-github)）。張淨雅認為要浪友用 GitHub 帳號登入不自然，改用浪友較熟悉的 Google 帳號。

**決策。** 主分支改用 Google 登入，不採用 GitHub 登入。原本的 Manus 登入和 Forge 整合程式已移除，部署也不需要舊 Manus 設定。

**取捨。** 浪友需要 Google 帳號，但不用再開 Manus 或 GitHub 帳號。WaveShare 用 Google 提供的專屬代號（儲存為 `google:<sub>`）辨識帳號，不用電子郵件比對。電子郵件只有經 Google 驗證才會儲存，其他浪友也不能用它搜尋。就算地址相同，舊 Manus 使用者也會從新的 WaveShare 帳號開始，舊日誌和好友不會自動轉入；切換登入不會刪除舊資料。

**上線前。** 依[部署教學](DEPLOY.zh-TW.md)完成設定，並在實際部署的測試站確認登入、取消授權、登出，以及用同一帳號再次登入仍能看到日誌。若要接回舊日誌，須另外規劃帳號對應。

**後續調整。** [PR #9](https://github.com/ChristingChang/waveshare/pull/9) 在登入後的頁面上方加了「登出」，也移除了未登入時自動跳到 Google 的做法；[PR #17](https://github.com/ChristingChang/waveshare/pull/17) 將未登入畫面改為有示範資料的介紹頁。登出後會顯示介紹頁，按「使用 Google 登入」才前往 Google。原有的 Google 登入方式不變。

- **登入網址：** WaveShare 從 `/api/auth/google` 把使用者送往 Google，Google 授權後回到 `/api/auth/google/callback`。
- **部署設定：** 設定 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET` 與維持登入用的 `SESSION_SECRET`。`GOOGLE_CALLBACK_URL` 可選填；未填時，WaveShare 用發起登入的網站網址組成返回網址。這個返回網址必須和 Google 後台登記的完全一致。

## ADR-005：影片只給本人播放

**狀態：已接受。** [PR #10](https://github.com/ChristingChang/waveshare/pull/10) 已合併到主分支；正式站未驗證，Cloudflare 的公開存取也還要手動關閉。取代 [ADR-001](#adr-001新影片改由瀏覽器直接傳到-cloudflare-r2) 中「R2 播放網址公開」的部分。

**後續變更。** 下文保留當時的決策。私人播放連結仍使用；[ADR-006](#adr-006逐筆分享給指定好友) 把「只有本人」放寬為「本人與這筆紀錄指定的好友」。

**背景。** 依 ADR-001，日誌只有本人能讀，但 R2 影片用公開網址播放：知道網址的人不用登入就能看（US-43）。影片的可見範圍比日誌還大，之後也沒辦法做到「只讓指定好友看」（US-51）。

**決策。** 影片不再用公開網址播放。詳細頁的影片一律指向 WaveShare 自己的網址 `/api/videos/<紀錄編號>`，每次播放時由 WaveShare 決定能不能看：

- 沒登入：擋下，顯示「請先登入」。
- 登入的不是紀錄本人，或紀錄不存在：一律顯示「找不到影片」，不透露紀錄是否存在。
- 本人：轉到一個 15 分鐘有效的 R2 播放連結。
- 舊 Forge 影片：只有本人會被轉到原本存的網址。

「誰能看」集中在同一處判斷（[播放程式](../server/videoPlayback.ts)），目前只有本人；之後做好友分享時就從這裡放寬。程式不再使用 `R2_PUBLIC_URL`，也不用改資料庫：之前上傳的 R2 影片照樣能播。其他可行方式包括維持公開網址，或讓影片內容整段經過 WaveShare 伺服器；不推定未採用的理由。

**取捨。** 影片和日誌一樣只有本人看得到，但每次播放都要先經過 WaveShare 確認登入。播放連結在 15 分鐘內，拿到連結的人仍能播放；WaveShare 會要求瀏覽器不快取這個轉址，也不把網址帶給其他網站，以降低外流機會。影片播到一半連結過期時，播放器會自動重新取得一次，並從原處接著播。舊 Forge 影片從 WaveShare 只有本人能打開，但它的原網址本身是否公開，未確認。

**上線前。**

1. 部署後，到 Cloudflare 的 R2 bucket 設定關閉 `r2.dev` 公開網址（Public Development URL），並停用或移除所有公開的自訂網域（[R2 設定教學](R2_SETUP.zh-TW.md)第 2 步）。**沒關之前，舊的公開網址仍然誰都能播放。**
2. 之後可以刪除 Vercel 上的 `R2_PUBLIC_URL`。
3. 在測試站確認：本人能播放；未登入和其他帳號打不開；舊公開網址無法播放；長影片暫停超過 15 分鐘後仍能接著播。

## ADR-006：逐筆分享給指定好友

**狀態：已接受。** [PR #13](https://github.com/ChristingChang/waveshare/pull/13) 已合併到主分支；未在實際的 Cloudflare R2 或正式資料庫上測試。

**背景。** 和浪友一起衝浪，不代表要把整本日誌給對方看。只分享某筆紀錄時，附上的影片也應遵守同樣的規則。

**決策。** 新紀錄預設不分享。本人可在詳細頁選擇哪些已接受邀請的好友能看這一筆。網站另外存下每筆紀錄的分享名單；查看時既要在名單上，也要仍是好友。對方只可查看，不能編輯、刪除或再授權給其他人。影片沿用 ADR-005 的私人連結，但開放給同一批人。

**取捨。** 只知道網址不等於有權查看。取消分享後，WaveShare 會擋下對方重新開啟紀錄或取得新連結；已發出的 R2 連結無法提早收回，仍可能用到 15 分鐘的有效期結束。

**上線前。** 在 TiDB Cloud 建立分享資料表（`0004_session_shares.sql`），再用不同帳號確認指定好友可以看，未選中的好友不能看，取消分享也會擋下新的播放請求。步驟見[部署教學](DEPLOY.zh-TW.md)。

## ADR-007：影片選填，照片可私人附加

**狀態：已接受。** [PR #14](https://github.com/ChristingChang/waveshare/pull/14) 已合併到主分支；未在實際的 Cloudflare R2 或正式資料庫上測試。

**背景。** 有時浪友只拍了照片，或只想記下浪況，不應為了存日誌而一定要附影片。

**決策。** 影片改為選填，每筆可附最多 10 張照片。照片由瀏覽器直接傳到私人 R2 儲存空間；WaveShare 以 `/api/photos/<照片編號>` 核對登入與這筆紀錄的分享名單，再提供 15 分鐘有效的觀看連結。

**取捨。** 照片不用另外設定分享對象，但和影片一樣，已取得的 R2 連結到期前仍可能有效。每張最多 20 MiB；HEIC／HEIF 先在瀏覽器轉成 JPG，方便回看。編輯移除照片或刪除紀錄時，網站會嘗試刪除不再使用的照片檔；已啟用的每日清理也會處理逾 24 小時未存成紀錄的上傳。

**上線前。** 在 TiDB Cloud 執行 `drizzle/manual/0005_photos.sql` 建立兩張照片表。確認沒有影片也能存紀錄、本人及指定好友可看照片，其他人不能從照片網址打開。步驟見[部署教學](DEPLOY.zh-TW.md)。

**後續調整。** [PR #19](https://github.com/ChristingChang/waveshare/pull/19) 讓照片上傳失敗時依原因提示；如果缺少照片資料表，畫面會請管理員執行上述 SQL。上傳與觀看方式不變。

## ADR-008：由瀏覽器產生可帶出站外的分享圖卡

**狀態：已接受。** [PR #16](https://github.com/ChristingChang/waveshare/pull/16) 已合併到主分支；未在正式站驗證。

**背景。** 浪友想在 IG 限時動態或 LINE 分享衝浪回憶，不必因此開放整筆紀錄或附上的影片、照片。

**決策。** 在瀏覽器內把自己的紀錄摘要或浪點造訪進度做成 PNG，不另上傳圖片給 WaveShare，也不建立公開的紀錄連結。圖卡只用選定的欄位，紀錄圖卡不放心得、照片、影片或原始紀錄網址。站內逐筆分享仍按 [ADR-006](#adr-006逐筆分享給指定好友) 的規則。

**取捨。** 只分享圖片檔，不改變日誌的可見範圍，也不必在網站額外儲存圖卡；但收件人可保留或轉傳圖片，無法從 WaveShare 收回。是否能直接叫出分享選單由瀏覽器決定，不支援時仍可下載圖片。

**上線前。** 不需新增部署設定。在測試站確認兩種圖卡都可預覽和下載、僅本人可從紀錄產生圖卡，並在支援直接分享圖片的裝置確認分享只傳圖片檔。

## ADR-009：從外部查詢浪況並隨日誌保存

**狀態：已接受。** [PR #20](https://github.com/ChristingChang/waveshare/pull/20) 與 [PR #22](https://github.com/ChristingChang/waveshare/pull/22) 已合併到主分支；未在本次文件更新中驗證正式站。

**背景。** 星等是浪友的主觀評分；回顧時也想知道當天的風浪與潮汐，不必每次自己查。

**決策。** 由 WaveShare 在新增時或日期、地點、下水時間有變時查詢，把當次取得的資料與每個項目的來源一起存入日誌，而不是每次打開時重查。台灣當天的紀錄在有金鑰時優先用中央氣象署的沿海預報與潮汐資料，缺項由 Open-Meteo 的海象與天氣資料補上。其他情況（包括補舊紀錄）只用 Open-Meteo。氣象署的浪向不是湧浪方向，所以湧浪方向只取自 Open-Meteo。

**取捨。** 回看時不必等外部服務回應，但看到的是當時存下的資料，不是即時海況。存檔時，外部請求最多等約 5.6 秒；查不到的項目不顯示，整筆查不到也能儲存，不用猜數值。Open-Meteo 的滿潮與乾潮時間來自潮位模型估算，不是實地觀測。自動資料不會取代浪友給的星等；既有紀錄也不會自動補上。

**上線前。** 先執行 `drizzle/manual/0006_surf_conditions.sql` 新增欄位，再部署。選用的 `CWA_API_KEY`、驗收與舊紀錄補資料方式見[部署教學](DEPLOY.zh-TW.md)。

**後續調整。** [PR #22](https://github.com/ChristingChang/waveshare/pull/22) 補上 Vercel 載入自動浪況程式時需要的副檔名，修正 API 啟動失敗；不改浪況來源、顯示方式或資料庫欄位。

## 切換時的依賴與待確認事項

- **正式切換：** 先依[部署教學](DEPLOY.zh-TW.md)建立所需的表和欄位，再到測試站確認 Google 登入、好友分享、R2 影片與照片的上傳和觀看，以及自動浪況。
- **資料接續：** 尚未確認正式站的既有資料、舊 Manus 帳號的對應方式，以及 Forge 影片是否須搬遷。R2 影片已改用私人播放（ADR-005）；舊 Forge 影片的原網址是否公開，仍未確認。
