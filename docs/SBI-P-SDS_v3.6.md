# SBI-P-SDS v3.6
## 智慧商情研究室 P 系列專案共用開發規範
**SBI Lab P-Series Shared Development Standard**  
**Version 3.6 · 2026-10-29**  
慈濟大學｜經營管理學系｜智慧商情研究室

> **最高原則：帳號共用，權限分開；資料共庫，物件隔離；前端分站，後端以 Project Code 嚴格分界。**  
> **RLS Always On → No Direct Table Access → RPC Only → Least Data → Least Privilege**

## 0. 版本與承接說明
本版根據可取得的 SBI-P-SDS v3.4 全文及已確認的 v3.5 頁尾版本標示規則，擴充「專案海報與展示設計標準」與交付前 Checklist。**尚未取得 v3.5 原始全文，因此如 v3.5 另有未提供條文，應在正式定稿前對照補入。**

v3.6 新增：海報類型與尺寸、固定識別、內容與視覺設計、作者海報、印刷規格、PDF/SVG/PNG/ZIP 交付、QR Code 實測、授權與海報 QA。

## 1. 適用範圍與架構
適用所有 SBI Lab P 系列網站。預設 GitHub Pages（HTML/CSS/JavaScript）＋ Supabase PostgreSQL。低敏感度專案可共用 Supabase Project，但須嚴格隔離資料庫物件、權限、RLS、RPC 與 migration；高敏感系統應評估獨立 Project。

| 層級 | 標準 |
|---|---|
| 前端 | GitHub Pages；非必要不引入複雜建置流程 |
| 資料庫 | Supabase PostgreSQL；按 Project Code 隔離 |
| 登入 | 共用 Supabase Auth，各 P 專案自行登入 |
| 帳號維護 | P130 Account Center |
| 授權 | 各 P 專案獨立管理角色與業務權限 |

## 2. GitHub、ZIP 與版本
### 2.1 前端
以靜態 HTML/CSS/JavaScript 為預設；引入框架須有明確需求。

### 2.2 設定與秘密
部署用 `config.js` 僅包含公開 Supabase URL 與 anon/publishable key；版本庫與交付 ZIP 僅提供 `config-sample.js`，不得覆蓋既有 `config.js`。嚴禁公開 `service_role`、secret key、SMTP 密碼與其他秘密。

### 2.3 ZIP
ZIP 外層為同名資料夾；至少包含 README、前端檔案、`config-sample.js`、適用時的 `database/` 與 `docs/`。建議附 Permissions SQL 與 HealthCheck SQL；純前端專案可註明不適用。

### 2.4 Web Versioning
開發版建議自 V0.001 遞增；可見或可操作變更須遞增 Web Version，並同步更新 CSS/JS cache-busting 版本。Git commit SHA 不等於 Web Version；純文件或不影響前端的後端變更不強制遞增。

### 2.5 首頁頁尾 SDS 標示（承襲 v3.5）
所有 P 系列網站首頁頁尾，除原有慈濟大學、經營管理學系、好玩實驗室識別及網站版本外，**在網站版本之後**標示實際採用的 SDS 版本。例如：

`慈濟大學｜經營管理學系｜好玩實驗室 · Web Version V0.123 · SBI-P-SDS v3.6`

不得虛報尚未實際遵守的 SDS 版本；行動版可換行但順序不變。

## 3. Supabase 物件命名
| 物件 | 標準 |
|---|---|
| Table | `TblPxx...` |
| View | `VwPxx...` |
| PostgreSQL RPC | 名稱含 P 編號，例如 `P118_GetTimelineSites` |
| Edge Function | 名稱含 P 編號 |
| Storage bucket | 名稱含專案識別 |

禁止未經核准的跨專案 generic 物件；正式共用平台物件除外。

## 4. 跨專案隔離
單一 P 專案 SQL、RPC、policy、trigger、Edge Function、migration 只能修改本專案物件。禁止在單一專案 migration 中使用跨 public schema 的全域 `GRANT/REVOKE ON ALL TABLES/SEQUENCES`、`ALTER DEFAULT PRIVILEGES`、`DROP SCHEMA public CASCADE`、`DROP OWNED BY` 或全域 schema 授權。共用平台治理另行審核。

## 5. 前端資料存取
**Frontend → 專案 PostgreSQL RPC → Database**。公開前端不得直接透過 `.from()`、REST 或 GraphQL 對 Table/View 做 SELECT、INSERT、UPDATE、DELETE。前端與 PostgreSQL 的業務資料交換統一使用專案 RPC；SQL 業務邏輯留在資料庫。Edge Function 涉及資料庫存取仍須遵守專案邊界。Data API 的 Exposed Schemas 應僅暴露必要 RPC schema，資料表所在 schema 不暴露。

## 6. 共用 Auth 與 P130
需登入的 P 專案原則上共用同一 Supabase Project 的 `auth.users`；各專案保留自己的 `signInWithPassword()`。註冊、Email 驗證、忘記密碼、重設／修改密碼、基本資料及跨專案授權由 P130 集中處理。各專案可提供 P130 入口；合法網址應列入 Authentication Redirect URLs。

### 6.1 密碼顯示／隱藏
所有登入、註冊、確認、重設及修改密碼欄位均須有可鍵盤操作的顯示／隱藏控制。預設遮蔽，切換不改變值，不得在日誌顯示明文密碼。

## 7. Authentication 與 Authorization 分離
Auth 確認身分；Project Access 決定可否使用該專案；Project-local Role 決定單位與業務權限。登入不等於取得全部 P 專案授權；某專案管理員不自動成為其他專案管理員。

## 8. Auth 前端與安全
各 P 專案使用不同 `auth.storageKey`；無登入需求者可設定 `persistSession:false`。不得透過新增 auth.users 的 trigger 自動建立所有 P 專案 profile。退出單一專案不得刪除共用 Auth 使用者。

## 9. RLS、Data API、GRANT 與 RPC
**DB-01 RLS Always On**：所有 P 系列表啟用 RLS，包括公開資料。

**DB-02 No Direct Table Access**：前端禁止 Table/View CRUD；檢查 Exposed Schemas，不能只靠前端沒有 `.from()` 判定安全。

**DB-03 RPC Only**：所有前端 PostgreSQL 資料交換均經專案命名 RPC。

**DB-04 Least Data**：RPC 僅回傳必要欄位；避免 `SELECT *`、Email、token、內部註記及不必要的他人資料。

**DB-05 Function Least Privilege**：撤除 `PUBLIC EXECUTE`，按需授權 `anon` 或 `authenticated`。管理、敏感、匯入、批次、核准及跨使用者資料 RPC 不得授權 anon；authenticated 不代表管理員，函式須檢查業務角色。

**DB-06 Table Grants**：GRANT 決定操作權，RLS 決定資料列；兩者不可互相取代。逐表、逐角色、逐操作最小授權。`service_role` 僅受控伺服器端使用，絕不進公開前端。

**DB-07 新表預設（v3.4）**：依 Supabase 2026-10-30 權限預設變更，既有專案新建 public 表不再自動取得 Data API grants，既有表保留 grants。遇到 `42501` 應先查 schema USAGE、GRANT、sequence 與 exposed schema，不得先全面開放 RLS 或 GRANT ALL。

**DB-08 RPC Schema 邊界**：新專案建議將 RPC 放在 Data API 暴露 schema，資料表放未暴露的專案資料 schema。若沿用 exposed public tables，GRANT 可能使表 endpoint 可被直接呼叫；即使受 RLS 保護，也不等於完全封閉 endpoint。

**DB-09 SECURITY INVOKER 優先**：Function 預設 `SECURITY INVOKER`。`SECURITY DEFINER` 僅在書面核准例外下使用，須固定安全 search_path、schema-qualified 物件、驗證 auth.uid 與角色、避免 injection、最小回傳及允許／拒絕案例測試。

**DB-10 新表 Migration**：同一 migration 須明列 RLS、逐操作 policies、精確 GRANT/REVOKE、必要 sequence 權限、schema exposure 決策、RPC 與 EXECUTE 權限；不可依賴自動 grants。

示意（須依專案實際 schema 與業務權限調整，不能直接套用）：

```sql
CREATE SCHEMA IF NOT EXISTS p139_data;
ALTER TABLE p139_data."TblP139Person" ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA p139_data TO authenticated;
GRANT SELECT ON TABLE p139_data."TblP139Person" TO authenticated;
REVOKE ALL ON TABLE p139_data."TblP139Person" FROM anon;
-- 另建逐操作 RLS policies 及專案 RPC
REVOKE EXECUTE ON FUNCTION public."P139_ListPeople"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public."P139_ListPeople"() TO authenticated;
```

## 10. Edge Function 與 Storage
Edge Function、bucket、policy 應有 P 專案識別，僅操作本專案。secrets 與 service_role 不得進 GitHub。允許 Dashboard 手動部署。內部人物照片等敏感資料預設採私有 Storage；確需公開展示者須先確認肖像授權、用途與風險，形成例外紀錄。

## 11. Migration、Permissions 與 Health Check
正式資料一律以 migration 更新，未經授權不得 drop/rebuild。Permissions SQL 僅修本專案。HealthCheck 驗證 table、function、RLS、policy、GRANT、schema exposure、跨專案引用與 RPC。以 anon、一般 authenticated、管理者測試允許與拒絕案例，並測試直接 table endpoint。檢查使用唯讀 catalog 查詢，不得藉檢查修改共用資料庫。

## 12. 新專案與 ZIP 交付
須確認 Project Code、Stable Baseline、物件命名、config-sample、共用 Auth 與獨立 storageKey、P130 入口、RLS、RPC-only、schema exposure、逐表最小授權、SECURITY INVOKER 優先、DEFINER 例外審核、Permissions/HealthCheck、Web Version/cache busting、首頁 SDS 標示、密碼顯示切換、展示型專案海報及第 16 節合規檢查。禁止跨專案全域權限修改。

## 13. 舊專案遷移
既有專案於下次改版逐步盤點 storageKey、redirect、project role、RLS、GRANT 與 schema exposure。公開專案不強制登入。不得因 Supabase 預設變更而批次重授權、搬移 schema、撤權或修改全域 default privileges。重大改動須備份、staging 驗證及正式核准。

## 14. 核心原則摘要
帳號共用、權限分開；資料共庫、物件隔離；RPC-only、RLS Always On、最小資料與最小權限；版本可見可追蹤；海報識別與品質一致但創意多樣；交付前自動檢查及人工複核。

## 15. 專案海報與展示設計標準
**Project Poster & Exhibition Design Standard**

### 15.1 目的與原則
適用於 P 系列作品、教學展示、成果展、競賽、作者介紹與宣傳摺頁。觀眾應能在 **5～10 秒**理解「作品是什麼、解決什麼問題、如何體驗、為何有價值」。**標準化的是品質、識別、必要資訊及交付，不是固定版型。**

### 15.2 海報類型與尺寸
| 類型 | 預設尺寸 | 用途 |
|---|---|---|
| P 系列標準作品海報 | **A3 直式 297 × 420 mm** | 實驗室展示與作品介紹 |
| 專題成果發表 | A1 直式 594 × 841 mm | 研究、課程成果與競賽 |
| 大型展示海報 | A2 直式 420 × 594 mm | 展覽及遠距閱讀 |
| 專題作者介紹 | A4 直式 210 × 297 mm | 作者、背景與作品故事 |
| 宣傳摺頁 | A4 橫式雙面三折 | 參觀者攜帶、活動宣傳 |
| 實驗室入口／導覽 | A3 直式為基準 | 實驗室介紹與導覽 |

大型海報原則上保留 A3 基準版；主辦單位另有規定時可依需求調整，並記錄例外。

### 15.3 固定識別
作品海報原則上包含：「慈濟大學｜經營管理學系｜好玩實驗室」、Project Code、正式中文及英文名稱、核心價值主張、主要功能或簡要流程、正式網站 QR Code、QR Code 旁的可讀網址。必要時加入作者、版本、來源與授權。英文機構名稱採 `Tzu Chi University · Department of Business Management`；不得任意更改官方名稱。

### 15.4 內容編輯
- 優先說明使用者需求、作品功能、管理／教學／研究價值。
- 經營管理作品應呈現服務、效率、決策、使用者體驗、永續等適切意涵，不以技術細節取代價值。
- 主視覺協助理解核心概念；避免直接貼滿版網站截圖、README 或 schema。
- 標題簡潔、層級清楚、保留留白；不以大量文字填滿畫面。
- 模擬資料、推測、研究結果與事實應清楚區分。

### 15.5 視覺與文字
延續網站的配色、圖示、字體氣質與品牌風格；不強制所有作品同色同版。可使用專業學術、情境故事或儀表板風格。中英文字須正確、無缺字、亂碼、重疊、裁切。正式文字應以排版工具產生可驗證的文字物件，盡可能保留 SVG 可編輯文字及 PDF 可選取文字；若印刷需求需轉外框，另留可編輯來源版。生成式圖片可作插畫，但**不得直接生成正式標題、關鍵文字、網址或 QR Code**。

### 15.6 QR Code
必須由已確認的正式網址以程式或可信工具產生，保留適當留白與對比，不得變形或遮擋。**對實際輸出的 PDF、SVG、PNG 進行掃描測試**，確認能開啟正確網址，並與印刷文字一致。尚未上線的測試網址須明確標示，不得偽裝正式入口。

### 15.7 專題作者海報
採 A4 直式。可呈現作者中文／英文姓名、家鄉、畢業高中、專題編號及名稱、個人想說的一句話、作品 QR Code；依對象使用中英雙語，必要時增加印尼文等語言。提供有照片與無照片版型。**公開照片、姓名、學歷與其他個人資訊前須取得適當同意**；不得收集或展示不必要的個資。

### 15.8 研究成果海報
A1/A2 研究海報應呈現研究問題、方法、資料、結果、限制與貢獻。圖表須標示標題、單位及來源；不得將模擬結果當成實測。涉及人體資料時遵守研究倫理及授權規範。

### 15.9 印刷品質
- 正確 ISO A 系列尺寸、方向與 PDF 頁面大小；SVG `viewBox` 比例正確。
- 保留安全邊界；需出血時依印刷廠要求（常見 3 mm，但非所有情況通用）。
- 點陣照片以最終印刷尺寸約 300 ppi 為品質目標；文字、線條與 QR Code 優先向量。
- 檢查字型嵌入／轉外框策略、透明度、裁切、色彩模式及實際印刷條件。
- PDF、SVG、PNG 的內容須一致，PNG 預覽版不可取代正式印刷檔。
- 第三方素材及字型須確認授權；**不得把無權散布的字型檔放入 ZIP**。

### 15.10 標準交付
預設交付 **PDF（印刷）、SVG（向量）、PNG（預覽）及 ZIP（打包）**。檔名建議：
- `P132_ProgressiveImmersion_A3_Poster.pdf`
- `P132_ProgressiveImmersion_A3_Poster.svg`
- `P132_ProgressiveImmersion_A3_Poster.png`
- `P132_ProgressiveImmersion_Poster_Package.zip`

多尺寸／多語言在檔名標示 A1、A4、ZH-EN 等。

### 15.11 製作與驗證流程
確認專案名稱、編號、網址、受眾及尺寸 → 撰寫一句話價值主張與功能重點 → 延續網站風格設計 → 放入真實文字及向量 QR Code → 輸出 PDF/SVG/PNG → 檢查字型、尺寸、內容、連結 → 實測掃碼、必要時試印 → 通過第 16 節 QA → ZIP 打包與版本紀錄。

### 15.12 例外管理
活動指定尺寸、版型、語言或檔案格式時得調整，但須保留必要識別與品質驗證並註明原因。既有海報不強制立即重製，於下次改版逐步改善。

## 16. 交付前自動合規檢查
正式交付 ZIP、合併 PR 或更新網站前須檢查並保存報告。`PASS`＝通過、`FAIL`＝違反強制規範、`REVIEW`＝須人工審查、`N/A`＝不適用。**任何 FAIL 不得視為合格交付。**

| 編號 | 檢查項目 | 方法 |
|---|---|---|
| QA-01 | 全部 P 系列表啟用 RLS | 唯讀 catalog SQL |
| QA-02 | 前端無直接 Table/View CRUD | HTML/JS 靜態掃描 |
| QA-03 | PostgreSQL 資料交換皆經 RPC | 靜態掃描＋審查 |
| QA-04 | Exposed Schemas 僅暴露必要 RPC schema | 設定盤點＋API 測試 |
| QA-05 | 新表逐表最小 GRANT/REVOKE | migration＋catalog |
| QA-06 | RLS policies 符合角色及操作 | 允許／拒絕測試 |
| QA-07 | RPC 僅回傳必要欄位 | Function 審查 |
| QA-08 | 無不必要 PUBLIC EXECUTE／anon 敏感權限 | grants 查詢 |
| QA-09 | INVOKER 優先、DEFINER 例外安全 | SQL 審查＋測試 |
| QA-10 | sequence 最小權限、service_role 不外洩 | catalog＋秘密掃描 |
| QA-11 | 密碼顯示／隱藏功能正常 | UI 測試 |
| QA-12 | 無正式 config.js 或秘密進入 Git/ZIP | 檔案與 Git 歷史掃描 |
| QA-13 | SQL 修改限本專案，無未核准全域 GRANT | SQL 掃描 |
| QA-14 | v3.2 原有交付與海報規範 | 既有檢查 |
| QA-15 | Web Version 與 cache busting 一致 | 靜態檢查 |
| QA-16 | 頁尾機構、Web Version、實際 SDS 版本依序顯示 | UI 檢查 |
| QA-17 | 海報尺寸、方向、PDF 頁面與 SVG viewBox 正確 | 檔案解析 |
| QA-18 | 名稱、機構、Project Code、語言、網址正確 | 比對＋人工複核 |
| QA-19 | QR Code 由真實網址產生且實際掃描成功 | 實測 |
| QA-20 | PDF/SVG/PNG 一致，無亂碼、裁切、重疊 | 渲染比對＋人工檢視 |
| QA-21 | 圖像解析度、邊界、字型、授權符合需求 | 檔案檢查＋複核 |
| QA-22 | ZIP 檔案、檔名、尺寸及語言標示完整 | ZIP 完整性檢查 |
| QA-23 | 作者個資、肖像與第三方素材有必要授權 | 授權紀錄審查 |

QA-17～23 僅適用海報／展示品交付，其他情況標示 N/A。靜態掃描不能取代 SECURITY DEFINER、RLS 繞過、角色判斷、文字語意、肖像授權與實體掃碼的人工審查。建議報告記錄 Project Code、SDS 版本、Web Version、commit SHA、日期、PASS/FAIL/REVIEW/N/A、審核者及修正紀錄。

## 17. 版本紀錄
| 版本 | 變更 |
|---|---|
| v3.1 | shared Auth、P130 Account Center |
| v3.2 | Web Versioning、Cache Busting、Project Poster Standard |
| v3.3 | 密碼顯示切換、RLS/RPC 強制安全規範、交付檢查 |
| v3.4 | Data API grants、逐表權限、schema exposure、RPC 邊界與安全測試 |
| v3.5 | 首頁頁尾於網站版本後標示實際 SDS 版本（依對話確認） |
| **v3.6** | **完整海報與展示設計規範、印刷與交付品質、作者海報、QA-16～23** |

---
**維護註記：** 本版依已取得的 v3.4 文件及對話確認的 v3.5 條款整合。未取得 v3.5 原始全文，無法驗證其中是否另有未提供的增修；正式取代 v3.5 前宜核對差異。既有系統以 migration 漸進改善，不得因 SDS 更新而未經評估批次變更資料庫權限。
