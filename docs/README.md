# WaveShare 產品與設計文件

WaveShare 浪旅誌讓浪友記下衝浪的日期、浪點和心得，選擇附上影片或照片，再從日曆、地圖與統計回顧，也能把某筆紀錄分享給指定好友。

| 文件                                             | 看這份可以知道什麼？                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [產品規格書](product-spec.md)                    | 目前能做什麼、誰能看到紀錄、哪些功能還沒有。                                       |
| [架構決策紀錄（ADR）](architecture-decisions.md) | 為什麼採用私人影片與照片、怎麼決定好友可以看什麼，以及登入和資料庫的選擇。 |
| [流程圖](flows.md)                               | 從登入、上傳到回看，一步一步會發生什麼。                                           |
| [使用者故事](user-stories.md)                    | 從浪友的角度描述需求，以及怎麼判斷功能做對了。                                     |
| [部署教學](DEPLOY.zh-TW.md)                     | 怎麼在 Vercel 設定 Google 登入和 TiDB Cloud，並上線驗證。                           |
| [R2 設定教學](R2_SETUP.zh-TW.md)                 | 網站管理者怎麼設定 Cloudflare R2，讓影片和照片可以上傳和觀看。                     |

## 主分支現況

這套文件以編寫時的主分支（`main`）為現況基準，是程式碼的盤點，不代表正式站已部署或驗證。

| 項目   | 主分支現況 |
| ------ | ---------- |
| 分享   | 新紀錄預設不分享。本人可逐筆選擇好友；指定好友只能查看紀錄及影片和照片（[PR #13](https://github.com/ChristingChang/waveshare/pull/13)）。 |
| 影片與照片 | 影片可不填，每筆最多附 10 張私人照片（[PR #14](https://github.com/ChristingChang/waveshare/pull/14)）。檔案直接上傳到 Cloudflare R2；WaveShare 確認有權查看後才提供短效連結。 |
| 登入   | 使用 Google 帳號；不需要 Manus 帳號，也不會自動接回舊 Manus 帳號的日誌（[PR #2](https://github.com/ChristingChang/waveshare/pull/2)）。 |
| 資料庫 | 使用 TiDB Cloud 保存帳號、好友與衝浪紀錄；分享和照片所需的資料表須在部署前手動建立。 |
| 分享圖卡 | 紀錄圖卡依序用第一張紀錄照片、影片畫面、海浪插畫當背景；有存浪況就一併顯示（[PR #23](https://github.com/ChristingChang/waveshare/pull/23)、[PR #30](https://github.com/ChristingChang/waveshare/pull/30)）。只上傳影片時，瀏覽器也會嘗試擷取一張照片存進紀錄（[PR #24](https://github.com/ChristingChang/waveshare/pull/24)）。 |

準備部署時，請依[部署教學](DEPLOY.zh-TW.md)和 [R2 設定教學](R2_SETUP.zh-TW.md)完成設定（包括關閉 R2 公開存取）。好友分享和照片功能未在實際的 Cloudflare R2 或正式資料庫上測試，請先在測試站確認。
