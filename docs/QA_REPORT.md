# P142 V0.001 交付與合規檢查

- 專案：P142 聽音認譜 · Sound to Score
- 規範：SBI-P-SDS v3.6（依使用者提供全文）
- 日期：2026-10-30（臺灣時間）
- 架構：純靜態 HTML / CSS / JavaScript、ES modules、Web Worker、Web Audio；零外部 runtime 依賴。
- 初始 baseline：V0.001，尚無既有 P142 GitHub repo 可供比對。未更新使用者的 GitHub。
- 審核：Codex 自動檢查及瀏覽器介面複核；尚待使用者以實際錄音驗收。

## 自動檢查

`node --test tests/*.test.mjs`：11 項測試通過，其中包含 C2–C7 共 61 個乾淨合成單音的逐一驗證。

通過：提示音音高與八度、重複音、強第二泛音、升記號、44.1kHz 重取樣、低音量、靜音、乾淨 C 大三和弦、短音、分析時間偏移、中央 C 加線及高低音譜表位置、還原記號。

`node tests/check-sds.mjs`：8 項自動檢查通過，無 FAIL。

**測試範圍說明：這些是合成條件測試，不是現場錄音的準確率統計，不代表任意音訊的正確率為 100%。**

## 瀏覽器功能檢視

| 項目 | 結果 | 證據／限制 |
|---|---|---|
| 頁面載入 | PASS | 首頁、頁尾版本與機構正常顯示 |
| 內建合成範例 | PASS | C5、E5、G5、E5、C5、C5，六組順序正確 |
| 實際 MP3 格式匯入 | PASS | 自製 44.1kHz / 128kbps MP3 解碼成功；非業者錄音 |
| MP3 音高 | PASS | 九組：C5、E5、G5、E5、C5、C5、C♯4、C4、C3 |
| MP3 原音秒數 | PASS | 起點約 0.30、0.84、1.40、2.10、2.64、3.50、4.24、4.94、5.65 秒，與合成時點接近 |
| 音符編輯 | PASS | 第一音由 C5 改 C♯5，譜面與標籤更新並標「已修正」 |
| 試聽控制 | PASS | 點音試聽、全序列試聽操作可用，播放時停用播放鍵、啟用停止鍵；未以錄音量測音訊輸出 |
| SVG 內容 | PASS | 向量輸出含各音高、加線、升記號、還原記號，無節奏或拍號；自動結構驗證通過 |
| SVG / JSON 下載 | REVIEW | 可見下載連結與 blob URL 已產生；雲端測試瀏覽器未回報 download 事件，未確認落地檔案。實際瀏覽器請再驗證 |
| 手機版 | REVIEW | 已實作 650 / 850px 響應式斷點及譜面、鍵盤橫向捲動；本次未以真實手機測試 |
| 使用者真實錄音 | REVIEW | 尚未提供，無法宣稱捷運、門鈴或手機鈴聲的實測辨識率 |

修正紀錄：讀檔解碼不再等待 AudioContext.resume，播放才啟用音訊，避免無播放授權時卡住。SVG 根節點改為 group 以保留各音符的鍵盤可及性；補還原記號避免升音後自然音產生歧義；高音譜號旋心對齊 G4 所在的下數第二線。

## SDS Checklist

| 編號 | 狀態 | 結果 |
|---|---|---|
| QA-01 | N/A | 沒有資料表或 Supabase |
| QA-02 | PASS | 無直接 Table/View CRUD；靜態掃描與原始碼檢視 |
| QA-03 | N/A | 無 PostgreSQL 資料交換；不需要 RPC |
| QA-04 | N/A | 無 Data API / exposed schema |
| QA-05 | N/A | 無資料庫 migration / GRANT |
| QA-06 | N/A | 無 RLS policies 或角色 |
| QA-07 | N/A | 無 RPC |
| QA-08 | N/A | 無 SQL function 或 EXECUTE grants |
| QA-09 | N/A | 無 SECURITY DEFINER / INVOKER |
| QA-10 | PASS | 不含 key、service_role 或其他秘密；無 sequence |
| QA-11 | N/A | 無帳密欄位、登入或帳號功能 |
| QA-12 | PASS | 提供 config-sample.js；無 config.js 或秘密進 ZIP；新專案無舊 Git 歷史 |
| QA-13 | N/A | 無 SQL，無跨專案變更 |
| QA-14 | PASS | 提供靜態前端、README、config-sample、docs、版本與 ZIP；未要求製作海報 |
| QA-15 | PASS | V0.001；CSS、app、DSP、notation、worker 均使用 v=0.001 |
| QA-16 | PASS | 慈濟大學→經營管理學系→好玩實驗室→Web Version→SDS 順序正確 |
| QA-17 | N/A | 本次為網站交付，無海報 |
| QA-18 | PASS | P142、中英文名稱、機構已核對；未聲稱已部署至 GitHub 正式網址 |
| QA-19 | N/A | 無海報 QR Code；尚未確認 GitHub 正式網址 |
| QA-20 | N/A | 無海報 PDF / SVG / PNG 組合；音高 SVG 另有功能測試 |
| QA-21 | PASS | 使用系統字型及原創 SVG，未散布第三方字型、圖片；無印刷品 |
| QA-22 | PASS | ZIP 外層同名資料夾，含 README、前端、config-sample、docs、tests、sample；打包時驗證 CRC 與必要檔案 |
| QA-23 | PASS | 無人物個資、照片或外部錄音；內建範例與測試 MP3 為自製合成音 |

## 尚待驗收的技術界線

- 僅把音高量化到標準半音，非無條件精確的音訊重建。
- 多音模式為啟發式頻譜分離，可能誤把真正的八度音當泛音。未引入 Basic Pitch 或大型 AI 模型，避免未測試的遠端依賴。
- 只支援修正既有音符及刪除，尚無手動新增漏音、音符起訖編輯、MIDI/MusicXML、節奏推論或完整樂曲轉譜。
- 不含實體展示海報。本次未提供可確認的 GitHub 正式網址，不製作假入口 QR Code。
