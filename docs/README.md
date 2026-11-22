# WaveShare 產品與設計文件

WaveShare 浪旅誌讓浪友把衝浪影片、日期、浪點和心得記在一起，也能用日曆、地圖與統計回顧自己的衝浪旅程。

| 文件                                             | 看這份可以知道什麼？                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [產品規格書](product-spec.md)                    | 目前能做什麼、誰能看到紀錄、哪些功能還沒有。                                       |
| [架構決策紀錄（ADR）](architecture-decisions.md) | 影片為什麼改存 Cloudflare R2、為什麼只給本人播放、登入為什麼改用 Google、資料庫為什麼搬到 TiDB Cloud。 |
| [流程圖](flows.md)                               | 從登入、上傳到回看，一步一步會發生什麼。                                           |
| [使用者故事](user-stories.md)                    | 從浪友的角度描述需求，以及怎麼判斷功能做對了。                                     |
| [部署教學](DEPLOY.zh-TW.md)                     | 怎麼在 Vercel 設定 Google 登入和 TiDB Cloud，並上線驗證。                           |
| [R2 設定教學](R2_SETUP.zh-TW.md)                 | 網站管理者怎麼設定 Cloudflare R2，讓影片可以上傳和播放。                           |

## 主分支現況

這套文件以編寫時的主分支（`main`）為現況基準，是程式碼的盤點，不代表正式站已部署或驗證。

| 項目   | 主分支現況 |
| ------ | ---------- |
| 影片   | 瀏覽器直接把新影片傳到 Cloudflare R2（[PR #1](https://github.com/ChristingChang/waveshare/pull/1)）；只有本人能播放，WaveShare 確認身分後才給 15 分鐘有效的播放連結（[PR #10](https://github.com/ChristingChang/waveshare/pull/10)）。 |
| 登入   | 使用 Google 帳號；不需要 Manus 帳號，也不會自動接回舊 Manus 帳號的日誌（[PR #2](https://github.com/ChristingChang/waveshare/pull/2)）。 |
| 資料庫 | 已支援部署時使用 TiDB Cloud 保存帳號、好友和衝浪紀錄；影片檔另存 R2。 |

準備部署時，請依[部署教學](DEPLOY.zh-TW.md)和 [R2 設定教學](R2_SETUP.zh-TW.md)完成設定（包括在 Cloudflare 關閉 R2 公開存取），再到測試站確認登入、儲存日誌與影片播放。
