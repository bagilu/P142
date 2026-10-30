# P142 聽音認譜 · Sound to Score

**Web Version V0.001 · SBI-P-SDS v3.6 · 2026-10-30**

慈濟大學｜經營管理學系｜好玩實驗室  
Tzu Chi University · Department of Business Management · SBI Lab

把捷運提示音、門鈴、手機鈴聲等日常短旋律，轉成依序排列、可以試聽的音高五線譜。

正式網址：https://bagilu.github.io/P142/

2026-10-31：將已驗證的 V0.001 部署至 GitHub Pages；無前端功能變更。

## 快速部署至 GitHub Pages

1. 解壓縮交付 ZIP。
2. 將同名資料夾內的 `index.html`、`style.css`、`app.js`、`dsp.js`、`notation.js`、`analysis-worker.js`、`icon.svg`、`config-sample.js`、`samples/` 等前端內容放到 P142 repository 根目錄。**不要再包一層資料夾。**
3. 在 GitHub `Settings → Pages` 選擇由 `main` branch 的 `/(root)` 發布。
4. 開啟 GitHub Pages 提供的 HTTPS 網址。不需要安裝 npm、不需要 Supabase，也不需要 config.js。
5. 先按「試試合成提示音」，再按「開始分析」，預期為 C5、E5、G5、E5、C5、C5。

若保留 `dist/` 形式管理原始碼，也可用 GitHub Actions 上傳 dist 作為 Pages artifact；此 ZIP 已改為根目錄直接部署的形式。

## 使用方式

- 選取 MP3（另接受瀏覽器可解碼的 WAV、M4A、OGG）。若格式或編碼不支援，會顯示錯誤；可轉成 MP3 或 PCM WAV 後重試。
- 可播放原音，並設定開始與結束秒數；按「開始分析」。
- 預設為單音旋律；同時發聲可試用「多音・和弦」，此功能為實驗性質，不能保證全數辨認。
- 音符依聲音先後排序，不顯示拍號、小節、休止符或節奏時值。同時辨認到的音放在同一垂直位置。
- 點音符會試聽並開啟編輯器，可改音高／八度或刪除誤辨的音。無新增漏音與調整時間功能。
- 「試聽音符」以等距速度播放音高順序，不重現原曲節奏。試聽為合成音色，非鋼琴採樣。
- 「查看音符與原音時間」可播放每組的原音片段。
- 「下載五線譜」匯出 SVG；「下載音符資料」匯出 JSON，含 MIDI 音高、原音秒數與修正記錄。並非 MIDI 或 MusicXML 檔案。

## 適用範圍與限制

- 這是**音高估計與人工核對工具**，不保證任意錄音皆正確。尚未用使用者的實際捷運／門鈴錄音驗證。
- 清楚、音高穩定、單一聲源的短旋律最適合。現場廣播、人聲、車聲、殘響、滑音、鼓聲及重疊音，可能漏辨或誤辨。
- 範圍 C2–C7，依 A4=440 Hz 十二平均律對應最近的琴鍵；黑鍵一律以升記號顯示，無調性推論。自然音跟在同字母同八度升音後，會補還原記號。
- 原音音高若不在標準半音上，五線譜會是最近琴鍵的近似表示，不能完整表現連續滑音。
- 多音模式使用頻譜與泛音抑制啟發式方法，特別可能把八度重疊音當泛音刪除，不適合複雜樂曲轉譜或嚴格評分。
- 品質分數為啟發式指標，**不是正確機率**；橙色標記只是待確認提示，高分也可能誤辨。
- 每檔 50 MB 以內、長度 10 分鐘以內；每次分析最多 90 秒，可分段。音檔解碼仍會佔用記憶體，手機建議使用短音檔。
- 無登入、無麥克風即時收音、無資料庫、無檔案上傳伺服器、無追蹤。音訊與分析皆在本機；重新載入會清除結果，請先下載。
- 前端零外部依賴；無需網路 AI API。若已載入全部前端，可離線分析；不含 Service Worker，未宣稱為可安裝的離線 PWA。
- 本機以 HTTP server 或正式 HTTPS 開啟；不支援直接雙擊 file://，因為需要 ES modules 及 Web Worker。

## 範例與驗證

`samples/P142_Test_Chime.mp3` 為本專案合成測試音（CC0），不是任何捷運業者的原音。
預期音高：C5、E5、G5、E5、C5、C5、C♯4、C4、C3。

`tests/dsp.test.mjs` 可用 Node.js 20+ 執行：`node --test tests/*.test.mjs`。測試包含強泛音、半音、44.1kHz 重取樣、小音量、靜音、多音、短音、時間偏移、音符位置與 C2–C7 61 個乾淨合成單音。完整合規與驗證紀錄見 `docs/QA_REPORT.md`。

## 檔案

- index.html / style.css：繁體中文 RWD 介面
- app.js：讀檔、播放、波形、選段、編輯與匯出
- dsp.js / analysis-worker.js：本機頻譜音高估計及背景工作執行緒
- notation.js：向量高低音譜表、加線、升記號及還原記號
- config-sample.js：純前端、不需要任何 key 的說明
- docs/：規範與合規報告

Stable baseline：首次發布 V0.001；尚待真實場域音檔驗收。維護時遞增網頁版本，並同步 CSS、JS 與 worker 的 cache-busting。不覆蓋其他專案的 config.js 或資料庫。
