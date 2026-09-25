<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let authorName = "";
  export let authorId = "";
  export let count = 0;

  const dispatch = createEventDispatcher();

  let papersQuick = [];
  let papersFull = [];
  let loading = true;
  let pollInterval;

  // CSV 导出相关
  let fieldSelectorOpen = false;
  let allFields = [
    "论文名称", "发表年份", "本人排序", "机构名称",
    "期刊名称", "ISSN", "出版商", "ISBN",
    "是否国际合著", "DOI"
  ];
  let selectedFields = new Set(["论文名称", "发表年份", "本人排序"]);

  function closePanel() {
    dispatch('close');
  }

  function formatBoolean(value) {
    if (value === true) return "是";
    if (value === false) return "否";
    return "未知";
  }

  function formatField(value, fallback = "未提供") {
    if (value === undefined || value === null || value === "") return fallback;
    return value;
  }

  function buildDoiLink(doi) {
    if (!doi) return null;
    if (doi.startsWith("http")) return doi;
    return `https://doi.org/${doi}`;
  }

  onMount(async () => {
    if (!authorName) return;
    loading = true;

    try {
      // 第一次请求快速字段
      const resp = await fetch(`http://10.254.22.26:8060/search/publications?author_name=${encodeURIComponent(authorName)}`);
      const json = await resp.json();

      count = json.count;

      papersQuick = json.papers.map(p => ({
        "论文名称": p["论文名称"],
        "发表年份": p["发表年份"],
        "本人排序": p["本人排序"]
      }));

      papersFull = json.papers;

      // 开启轮询，每 2 秒检查缓存更新
      pollInterval = setInterval(async () => {
        try {
          const cacheResp = await fetch(`http://10.254.22.26:8060/get_papers_cache?author_name=${encodeURIComponent(authorName)}`);
          const cacheJson = await cacheResp.json();

          let updated = false;
          cacheJson.papers.forEach((p, idx) => {
            if (papersFull[idx] && papersFull[idx]["机构名称"] === "loading" && p["机构名称"] !== "loading") {
              papersFull[idx] = p;
              updated = true;
            }
          });

          // 如果全部论文都补齐，停止轮询
          if (!papersFull.some(p => p["机构名称"] === "loading")) {
            clearInterval(pollInterval);
            pollInterval = null;
            loading = false;
          }
        } catch (err) {
          console.error("轮询缓存失败", err);
        }
      }, 2000);

    } catch (err) {
      console.error("加载论文数据失败", err);
      papersQuick = [];
      papersFull = [];
      count = 0;
      loading = false;
    }
  });


  function downloadCSV() {
    const fields = Array.from(selectedFields);
    const filtered = papersFull.map(row =>
      Object.fromEntries(fields.map(f => [f, row[f]]))
    );
    const csv = convertToCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${authorName}_papers.csv`;
    link.click();

    URL.revokeObjectURL(url);
    fieldSelectorOpen = false;
  }

  function convertToCSV(rows) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const csvRows = [headers.join(",")];
    for (const row of rows) {
      csvRows.push(headers.map(h => JSON.stringify(row[h] ?? "")).join(","));
    }
    return csvRows.join("\n");
  }
</script>

<div class="scholar-overlay" role="dialog" aria-modal="true">
  <div class="overlay-container">
    <div class="overlay-header">
      <div>
        <p class="breadcrumb">学术作者查询 / 结果详情</p>
        <h1>{authorName || "学术作者成果"}</h1>
        <p class="subtitle">
          {#if authorName}
            共检索到 {count} 篇公开成果
          {:else}
            请选择作者后查看完整成果
          {/if}
        </p>
      </div>

```
  <div class="header-actions">
    <button class="btn-outline" on:click={closePanel}>返回</button>
    {#if papersFull.length > 0}
      <button class="btn-primary" on:click={() => fieldSelectorOpen = true}>
        自定义 CSV 导出
      </button>
    {/if}
  </div>
</div>

<div class="overlay-content">
  {#if !authorName}
    <div class="empty-card">尚未选择作者，无法展示成果。</div>
  {:else if papersQuick.length === 0 && loading}
    <div class="empty-card">正在加载...</div>
  {:else}
    <div class="papers-grid">
      {#each papersQuick as quick, idx}
        <article class="paper-card">
          <header>
            <span class="badge">#{idx + 1}</span>
            <h2>{quick["论文名称"]}</h2>
          </header>

          <section>
            <p><strong>发表年份：</strong>{quick["发表年份"]}</p>
            <p><strong>作者排序：</strong>{quick["本人排序"]}</p>
            <p><strong>所属机构：</strong>
              {#if papersFull[idx]["机构名称"] === "loading"}
                <span class="skeleton skeleton-text"></span>
              {:else}
                {formatField(papersFull[idx]["机构名称"])}
              {/if}
            </p>
            <p><strong>期刊 / 会议：</strong>
              {#if papersFull[idx]["期刊名称"] === "loading"}
                <span class="skeleton skeleton-text"></span>
              {:else}
                {formatField(papersFull[idx]["期刊名称"])}
              {/if}
            </p>
            <p><strong>出版商：</strong>
              {#if papersFull[idx]["出版商"] === "loading"}
                <span class="skeleton skeleton-text small"></span>
              {:else}
                {formatField(papersFull[idx]["出版商"])}
              {/if}
            </p>
            <p><strong>ISSN：</strong>
              {#if papersFull[idx]["ISSN"] === "loading"}
                <span class="skeleton skeleton-text tiny"></span>
              {:else}
                {formatField(papersFull[idx]["ISSN"])}
              {/if}
            </p>
            <p><strong>ISBN：</strong>
              {#if papersFull[idx]["ISBN"] === "loading"}
                <span class="skeleton skeleton-text tiny"></span>
              {:else}
                {formatField(papersFull[idx]["ISBN"])}
              {/if}
            </p>
            <p><strong>国际合著：</strong>
              {#if papersFull[idx]["是否国际合著"] === "loading"}
                <span class="skeleton skeleton-text tiny"></span>
              {:else}
                {formatBoolean(papersFull[idx]["是否国际合著"])}
              {/if}
            </p>
          </section>

          <footer>
            {#if !loading && papersFull[idx]?.["DOI"]}
              <a class="btn-link" href={buildDoiLink(papersFull[idx]["DOI"])} target="_blank">查看 DOI</a>
            {/if}
          </footer>
        </article>
      {/each}
    </div>
  {/if}
</div>
```

  </div>
</div>

{#if fieldSelectorOpen}

  <div class="csv-panel">
    <div class="csv-box">
      <h2>选择导出字段</h2>
      {#each allFields as f}
        <label class="csv-item">
          <input type="checkbox" checked={selectedFields.has(f)}
            on:change={(e) => {
              if (e.target.checked) selectedFields.add(f);
              else selectedFields.delete(f);
            }}
          />
          {f}
        </label>
      {/each}
      <div class="csv-actions">
        <button class="btn-outline" on:click={() => fieldSelectorOpen = false}>取消</button>
        <button class="btn-primary" on:click={downloadCSV}>下载 CSV</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Skeleton 样式 */
  .skeleton {
    display: inline-block;
    height: 0.9rem;
    background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 37%, #e2e8f0 63%);
    background-size: 400% 100%;
    border-radius: 4px;
    animation: skeleton-loading 1.4s ease infinite;
  }

  .skeleton-text { width: 120px; }
  .skeleton-text.small { width: 80px; }
  .skeleton-text.tiny { width: 60px; }

  @keyframes skeleton-loading {
    0% { background-position: 100% 50%; }
    100% { background-position: 0 50%; }
  }

  /* 原始样式保留 */
  .scholar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem 1rem;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }

  .overlay-container {
    width: min(1200px, 96vw);
    max-height: 92vh;
    background: #f8fafc;
    border-radius: 1.25rem;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 60px rgba(15, 23, 42, 0.4);
    overflow: hidden;
  }

  .overlay-header {
    padding: 2rem 2.5rem;
    background: linear-gradient(135deg, #4a90e2, #57b5e7);
    color: #fff;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
  }

  .breadcrumb {
    margin: 0;
    opacity: 0.8;
    font-size: 0.95rem;
  }

  .overlay-header h1 {
    margin: 0.3rem 0;
    font-size: clamp(2rem, 4vw, 2.8rem);
  }

  .subtitle {
    margin: 0;
    opacity: 0.9;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .btn-outline,
  .btn-primary {
    border-radius: 999px;
    font-weight: 600;
    padding: 0.65rem 1.6rem;
    border: none;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .btn-outline {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.45);
  }

  .btn-primary {
    background: #fff;
    color: #2563eb;
    text-decoration: none;
    box-shadow: 0 12px 30px rgba(37, 99, 235, 0.25);
  }

  .overlay-content {
    padding: 2rem 2.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .empty-card {
    padding: 2.5rem;
    text-align: center;
    color: #475569;
    background: #fff;
    border-radius: 1rem;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  }

  .papers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1.5rem;
  }

  .paper-card {
    background: #fff;
    border-radius: 1rem;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    display: flex;
    flex-direction: column;
  }

  .paper-card h2 {
    margin: 0.35rem 0 0;
    font-size: 1.05rem;
    color: #0f172a;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    background: rgba(74, 144, 226, 0.18);
    color: #2563eb;
    font-weight: 600;
  }

  .paper-card section p {
    margin: 0.25rem 0;
    font-size: 0.9rem;
    color: #475569;
  }

  .paper-card footer {
    margin-top: auto;
    padding-top: 1rem;
  }

  .btn-link {
    font-size: 0.9rem;
    color: #2563eb;
    text-decoration: none;
    font-weight: 600;
  }

  .csv-panel {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.55);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 20000;
  }

  .csv-box {
    background: #fff;
    padding: 2rem;
    border-radius: 1rem;
    width: 380px;
    box-shadow: 0px 20px 40px rgba(0,0,0,0.25);
  }

  .csv-item {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .csv-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>

