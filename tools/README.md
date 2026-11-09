# 點播源搬移／驗證工具

這些工具負責把 `TV_Box_Sources` 中能用的點播源驗證過後，搬進本專案的 `mix.json` / `mix18.json` / `site_file/` / `reference_file/`。
原本放在 `/tmp/mig`，現在路徑都改成相對本目錄，所以可以直接在 `tools/` 底下執行。

## 環境

- Python 3，`migrate.py` 需要 `pypinyin`（用來產生資料夾名稱）
- 主機端要有 `ffprobe`，用來確認串流真的能播
- 要有 `adb`，並接上已安裝 TV App 的裝置（套件名稱 `com.fongmi.android.tv`）
- App 必須帶有除錯端點 `/spider`（原始碼見 `app/SpiderTest.java`，放在
  `TV/app/src/main/java/com/fongmi/android/tv/server/process/`，然後在 `Nano.java` 加上 `process.add(new SpiderTest());`）
- 環境變數（都有預設值）：
  - `TVBOX_SRC`：原始來源目錄，預設 `/home/tailon/github_projects/android_tvbox_app/TV_Box_Sources`
  - `TVBOX_ASSETS`：App 內建 `assets://` 的目錄，預設 `.../TV/quickjs/src/main/assets`
  - `DST`：輸出目錄，預設是本專案根目錄（`tools/` 的上一層）
  - `SRV`：harness 給 App 載入設定檔的來源網址，預設 `http://127.0.0.1:8765/`
  - `RES`：驗證結果檔，預設 `tools/results.json`

## 流程（請在 `tools/` 目錄下執行）

| 步驟 | 指令 | 說明 |
|---|---|---|
| 1. 盤點 | `python3 inventory.py` | 掃描所有設定檔的 sites，把內容相同的站點歸成一組 → `groups.json` |
| 2. 找缺檔 | `python3 missing.py`、`python3 missing_imports.py` | 列出設定檔引用了但實際不存在的檔案 → `missing.json` |
| 3. 補缺檔 | `python3 fill_missing.py` | 先在本機找同名檔，找不到再透過 Sourcegraph（`sg.py`）到 GitHub 找；補到的檔案放進 `overlay/`，紀錄寫進 `fill_log.json` |
| 4. 排程 | `python3 plan.py` | 每組挑一個代表設定檔 → `plan.json` |
| 5. 啟動來源伺服器 | `python3 union_server.py 8765` | 檔案先從 `overlay/` 找，找不到才用原始目錄 |
| 6. 連接 App | `adb forward tcp:9978 tcp:9978; adb reverse tcp:8765 tcp:8765` | |
| 7. 驗證 | `python3 redo.py plan.json`（或 `python3 harness.py plan.json [workers]`） | 每個站都跑 首頁 → 分類 → 詳情 → 播放（含解析），並用 ffprobe 確認串流；結果寫到 `RES` |
| 8. 搬移 | `python3 migrate.py results_all.json [--dry]` | 驗證通過的站寫進 `mix.json`，並更新 `site_file/`、`reference_file/`、`move_list.txt`；用 `--dry` 只會顯示統計，不會寫檔 |
| 9. 檢查 | `python3 check_refs.py .. mix.json mix18.json direct.json direct18.json` | 確認所有 `./` 引用與 JS import 都存在、jar 的 md5 正確（輸出 `bad 0` 代表沒問題） |

`affected.py` 用來找出被 overlay 補檔影響、需要重新驗證的群組。

## 資料檔

| 檔案 | 內容 |
|---|---|
| `groups.json` | 盤點結果。gid 就是陣列的索引，`results_all.json` 用 gid 對應到這裡 |
| `results_all.json` | 彙整後的驗證結果（`pass` 為 true 代表可用） |
| `excluded.txt` | 複驗失敗、已經從 mix 移除的站（`原始設定檔<TAB>原始key`）。migrate.py 不會再把這些站加回去 |
| `missing.json` / `fill_log.json` | 缺檔清單和補檔來源紀錄（另外也整理成專案根目錄的 `fill_list.txt`） |
| `skip_crashjar.json` | 因為 jar 會讓 App 當機而跳過的 gid |
| `overlay/` | 補齊或修正的檔案，路徑對應原始目錄（例如 `qist_tvbox/99188_nojar.json`、`2hacc_TVBox/h/h.json`） |
| `remote/` | JS 遠端 import 下載下來的快取（migrate.py 本地化時使用） |

## 注意事項

- **會讓 App 當機的 jar**：這幾個 jar 會觸發 xunlei JNI 的防竄改檢查，App 會直接 abort：
  - md5 `7c8f662c…`（pg23a94bb_upgraded.jar）
  - md5 `e58c3a29…`（pg_upgraded.jar，`qist_tvbox/js.json` 用的就是它）
  - md5 `c9986646…`（liuhtt pg.jar）

  所以原本補在 `overlay/OK/jar/pg.jar` 的檔案就是當機 jar，**沒有放進 repo**。
- **當機後的復原**：`redo.py` 偵測到當機時會自動處理，也可以手動執行：
  `python3 -c "import redo; redo.recover('有問題的設定檔')"`。
  它會先用 overlay 放一個空殼設定檔，再重啟 App，然後載入安全的 `qist_tvbox/dianshi.json`，最後把原本的狀態還回來。
- 並行數開太高時，JS 站可能會出現 `RejectedExecutionException`。這是測試本身造成的，不是站點的問題。遇到時請重啟 App，再用 2 個 worker 重測。
- 舊版 drpy2（ca81841e）沒有定義 `$js`。規則檔如果用到 `$js.toString`，要在檔頭加上相容 shim（範例見 `site_file/dongmanlumanmanjs/js/路漫漫.js` 開頭兩行）。
- 本目錄會跟著整個 repo 一起由 GitHub Pages 公開。
