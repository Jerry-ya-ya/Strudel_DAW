# Strudel Studio

一個以 Angular 22 製作的瀏覽器 DAW，使用 Strudel 1.3 作為音樂引擎。可建立、讀取、更新與刪除 Strudel 樂譜，並把已儲存的樂譜以獨立 iframe 播放器嵌入其他網站。

## 功能

- Strudel live-coding 編輯器，支援 `Ctrl + Enter` 即時播放與停止
- 樂譜完整 CRUD、搜尋、複製、名稱／描述／BPM 中繼資料
- `/embed/:id` 精簡播放器與 iframe 程式碼產生器
- Angular 前端固定使用 `http://localhost:4100`
- Express 檔案型 API；不需要外部資料庫
- 前、後端各自 Docker 化，以 Docker Compose 一鍵啟動
- 樂譜存放目錄 `backend/data/` 已由 Git 忽略；Docker 使用 named volume `score-data`

## Docker 啟動（建議）

```bash
docker compose up --build
```

開啟 [http://localhost:4100](http://localhost:4100)。後端只暴露在 Compose 內部網路，由 Nginx 將 `/api` 反向代理至後端。

停止服務：

```bash
docker compose down
```

若要連同所有已儲存樂譜一起移除，才使用 `docker compose down -v`。

## 本機開發

需求：Node.js 24、pnpm 11。

```bash
pnpm install
pnpm dev
```

- 前端：http://localhost:4100
- 後端：http://localhost:3000
- Angular dev server 會將 `/api` proxy 到後端

其他指令：

```bash
pnpm build
pnpm test
```

## API

| 方法 | 路徑 | 用途 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康檢查 |
| `GET` | `/api/scores` | 取得樂譜摘要清單 |
| `GET` | `/api/scores/:id` | 取得單份樂譜 |
| `POST` | `/api/scores` | 建立樂譜 |
| `PUT` | `/api/scores/:id` | 更新樂譜 |
| `DELETE` | `/api/scores/:id` | 刪除樂譜 |

樂譜 JSON 欄位為 `name`、`description`、`bpm` 與 `code`。伺服器會自行維護 `id`、`createdAt`、`updatedAt`。

## iframe

儲存樂譜後按右上角 **Embed**，即可複製：

```html
<iframe
  src="http://localhost:4100/embed/SCORE_ID"
  title="Strudel player"
  width="720"
  height="420"
  allow="autoplay"
  loading="lazy"
></iframe>
```

瀏覽器的音訊自動播放政策要求使用者先點擊播放器；嵌入頁因此提供明確的播放按鈕。Strudel 的鼓組 sample 會在首次初始化時由 `tidalcycles/dirt-samples` 載入；若網路無法取得 samples，內建 synth 音色仍可使用。

## 資料保存

- 本機執行：預設寫入 `backend/data/scores/*.json`
- Docker：寫入 `/app/data/scores`，由 `score-data` named volume 保存
- 可用 `SCORE_DATA_DIR` 環境變數改變後端存放位置

請勿把執行期樂譜加入 Git；`.gitignore` 已忽略整個 `backend/data/`。

## 技術備註

Strudel 使用 Web Audio API 並以 AGPL-3.0-or-later 發布。更多整合方式請參考 [Strudel 官方專案整合文件](https://strudel.cc/technical-manual/project-start/)。
