# P142 GitHub Pages 部署紀錄

- 日期：2026-10-31（臺灣時間）
- Repository：bagilu/P142
- Branch：main
- Source：根目錄
- Web Version：V0.001
- Standard：SBI-P-SDS v3.6
- 來源：P142_SoundToScore_V0.001_SDS3.6.zip 已驗證版本。
- 本次僅部署，前端程式與交付 ZIP 一致。
- 未包含 Sites 的身分檔、登入設定或私密設定。
- tests/fixtures/chime.wav 為可再生成的未壓縮中間檔，不上傳；samples/P142_Test_Chime.mp3 與預期音高 JSON 保留。
- 原 docs/QA_REPORT.md 為 2026-10-30 首版交付時的歷史檢查，正式部署情況以 GitHub Actions 與 git commit 為準。


## V0.002 · 2026-11-07

- 由 V0.001 加入音高五線譜編輯、和弦、復原／重做及 JSON 載入。
- 26 項自動測試、8 項 SDS 靜態檢查通過；瀏覽器已驗證編輯、下載、重新載入與分析後編輯。
- 仍由 main 根目錄部署至 https://bagilu.github.io/P142/ 。
- 詳細驗證：QA_REPORT_V0.002.md。


## V0.003 · 2026-11-08（臺灣時間）

- 在 V0.002 加入手動拍數與 BPM，不改變自動辨識範圍。
- 原 main 根目錄及網址不變：https://bagilu.github.io/P142/ 。
- 39 項自動測試、8 項 SDS 靜態檢查通過；本機瀏覽器完成分析、拍數、和弦、速度、復原、下載及試聽操作檢查。
- 本次變更原始碼與驗證紀錄一起提交；正式部署完成狀態請查該提交的 GitHub Pages Actions。
- 詳細驗證：QA_REPORT_V0.003.md。未提交本機預覽設定或產生的 dist 副本。


## V0.004 · 2026-11-08（臺灣時間）

- 增加可調整音組間距、預設緊緻排版與 SVG 同步輸出。
- 46 項自動測試、8 項 SDS 靜態檢查通過；瀏覽器完成多行排版、偏好保留、編輯歷史及實際 SVG 下載比對。
- 仍由 main 根目錄部署到 https://bagilu.github.io/P142/ 。
- 詳細驗證：QA_REPORT_V0.004.md；部署完成狀態以本次提交的 GitHub Pages Actions 為準。
