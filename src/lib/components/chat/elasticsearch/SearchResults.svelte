<script>
  import { createEventDispatcher } from 'svelte';
  
  export let results = [];
  export let titleField = "专利名称";
  export let urlField = null;
  export let thumbnailField = null;
  export let defaultImageUrl = "https://img2.baidu.com/it/u=2386315314,1853898729&fm=253&fmt=auto&app=138&f=JPEG?w=407&h=380";
  export let searchType = "patents"; // 默认为专利搜索
  
  const dispatch = createEventDispatcher();
  
  // 处理结果点击事件
  function handleResultClick(result) {
    console.log("搜索结果点击:", result);
    dispatch('resultClick', { result });
  }

  // 新增：分析专利
  function handleAnalyzePatent(result) {
    dispatch('analyzePatent', { title: result[titleField]?.raw || result[titleField]?.snippet || "", result });
  }

  // 新增：分析申请人
  function handleAnalyzeApplicant(result) {
    dispatch('analyzeApplicant', { applicant: result.申请人?.raw, result });
  }

  // 新增：分析发明人
  function handleAnalyzeInventor(result) {
    dispatch('analyzeInventor', { inventor: result.发明人?.raw, result });
  }
</script>

<div>
  {#if results.length === 0}
    <div class="sui-results__empty">
      <div>
        没有找到结果
      </div>
    </div>
  {:else}
    <ul class="sui-results-container">
      {#each results as result, i}
        {@const title = result[titleField]?.raw || result[titleField]?.snippet || ""}
        
        <li class="sui-result">
          <div class="sui-result__header">
            <!-- 添加固定图片容器 -->
            <div class="sui-result__image-container">
              <img class="sui-result__image" src={defaultImageUrl} alt={searchType === 'patents' ? "专利图片" : "论文图片"} />
            </div>
            
            <div class="sui-result__title">
              <button 
                class="sui-result__title-link"
                on:click={() => handleResultClick(result)}
              >
                {@html title}
              </button>
              <!-- 机器人图标：分析专利 -->
              <button class="sui-result__icon-btn" title="分析专利" on:click={() => handleAnalyzePatent(result)}>
                <img src="/btnpicture/button1.png" alt="分析专利" width="100" height="50" />
              </button>
            </div>
          </div>
          
          <!-- 根据搜索类型显示不同的结果详情 -->
          {#if searchType === 'patents'}
            <div>
              {#if result.摘要文本?.snippet || result.摘要文本?.raw}
                <div class="sui-result__description">
                   {@html result.摘要文本?.snippet || result.摘要文本?.raw}
                </div>
              {/if}
              
              <div class="sui-result__details">
                {#if result.申请号?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">申请号:</span>
                    <span class="sui-result__value">{result.申请号.raw}</span>
                  </div>
                {/if}
                
                {#if result.申请人?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">申请人:</span>
                    <span class="sui-result__value">
                      {result.申请人.raw}
                      <!-- 机器人图标：分析申请人 -->
                      <button class="sui-result__icon-btn" title="分析申请人" on:click={() => handleAnalyzeApplicant(result)}>
                        <img src="/btnpicture/button2.png" alt="分析申请人" width="100" height="50" />
                      </button>
                    </span>
                  </div>
                {/if}
                
                {#if result.申请人类型?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">申请人类型:</span>
                    <span class="sui-result__value">{result.申请人类型.raw}</span>
                  </div>
                {/if}
                
                {#if result.专利类型?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">专利类型:</span>
                    <span class="sui-result__value">{result.专利类型.raw}</span>
                  </div>
                {/if}
                
                {#if result.发明人?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">发明人:</span>
                    <span class="sui-result__value">
                      {result.发明人.raw}
                      <!-- 机器人图标：分析发明人 -->
                      <button class="sui-result__icon-btn" title="分析发明人" on:click={() => handleAnalyzeInventor(result)}>
                        <img src="/btnpicture/button2.png" alt="分析发明人" width="100" height="50" />
                      </button>
                    </span>
                  </div>
                {/if}
                
                {#if result.IPC分类号?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">IPC分类号:</span>
                    <span class="sui-result__value">{result.IPC分类号.raw}</span>
                  </div>
                {/if}
                
                {#if result.申请年份?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">申请年份:</span>
                    <span class="sui-result__value">{result.申请年份.raw}</span>
                  </div>
                {/if}
                
                {#if result.公开公告日?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">公开公告日:</span>
                    <span class="sui-result__value">{result.公开公告日.raw}</span>
                  </div>
                {/if}
                
                {#if result.被引证次数?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">被引证次数:</span>
                    <span class="sui-result__value">{result.被引证次数.raw}</span>
                  </div>
                {/if}
              </div>
            </div>
          
          <!-- 论文结果显示 - 更新为新配置的字段 -->
          {:else if searchType === 'papers'}
            <div>
              {#if result.Abstract?.snippet || result.Abstract?.raw}
                <div class="sui-result__description">
                  {@html result.Abstract?.snippet || result.Abstract?.raw}
                </div>
              {/if}
              
              <div class="sui-result__details">
                {#if result.PaperID?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">论文ID:</span>
                    <span class="sui-result__value">{result.PaperID.raw}</span>
                  </div>
                {/if}
                
                {#if result['Paper_Details.Publisher']?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">出版商:</span>
                    <span class="sui-result__value">{result['Paper_Details.Publisher'].raw}</span>
                  </div>
                {/if}
                
                {#if result['Paper_Details.OriginalVenue']?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">期刊/会议:</span>
                    <span class="sui-result__value">{result['Paper_Details.OriginalVenue'].raw}</span>
                  </div>
                {/if}
                
                {#if result['Paper_Basic.Year']?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">发表年份:</span>
                    <span class="sui-result__value">{result['Paper_Basic.Year'].raw}</span>
                  </div>
                {/if}
                
                {#if result['Paper_Basic.Citation_Count']?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">引用次数:</span>
                    <span class="sui-result__value">{result['Paper_Basic.Citation_Count'].raw}</span>
                  </div>
                {/if}
                
                {#if result['Paper_Basic.DOI']?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">DOI:</span>
                    <span class="sui-result__value">{result['Paper_Basic.DOI'].raw}</span>
                  </div>
                {/if}
                
                {#if result['Paper_Details.DocType']?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">文档类型:</span>
                    <span class="sui-result__value">{result['Paper_Details.DocType'].raw}</span>
                  </div>
                {/if}
                
                {#if result.Author_List?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">作者:</span>
                    <span class="sui-result__value">
                      {#if Array.isArray(result.Author_List.raw.Author_Details)}
                        {result.Author_List.raw.Author_Details.map(author => author.Author_Name).join(', ')}
                      {:else if result.Author_List.raw.Author_Details}
                        {result.Author_List.raw.Author_Details.Author_Name || ''}
                      {:else}
                        未知作者
                      {/if}
                    </span>
                  </div>
                {/if}
                
                {#if result['Paper_Details.Volume']?.raw || result['Paper_Details.Issue']?.raw}
                  <div class="sui-result__key-value-pair">
                    <span class="sui-result__key">卷/期:</span>
                    <span class="sui-result__value">
                      {#if result['Paper_Details.Volume']?.raw}Vol. {result['Paper_Details.Volume'].raw}{/if}
                      {#if result['Paper_Details.Issue']?.raw}, Issue {result['Paper_Details.Issue'].raw}{/if}
                    </span>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  /* 基本样式匹配原始Search UI组件 */
  .sui-results {
    width: 100%;
  }
  
  .sui-results-container {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .sui-result {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 1rem;
    padding: 1.25rem;
    background-color: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .sui-result:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .sui-result__header {
    display: flex;
    align-items: flex-start;
    margin-bottom: 1rem;
  }
  
  .sui-result__title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-right: 1rem;
    flex-grow: 1;
    line-height: 1.4;
  }
  
  .sui-result__title a {
    color: #3a56e4;
    text-decoration: none;
  }
  
  .sui-result__title a:hover {
    text-decoration: underline;
  }
  
  .sui-result__image-container {
    margin-right: 1.25rem;
    flex: 0 0 120px;
  }
  
  .sui-result__image {
    width: 100%;
    height: auto;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #e5e7eb;
  }
  
  .sui-result__body {
    line-height: 1.6;
  }
  
  .sui-result__description {
    margin-bottom: 1rem;
    color: #4b5563;
  }
  
  .sui-result__details {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0 0 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
    border-top: 1px solid #e5e7eb;
    padding-top: 0.75rem;
  }
  
  .sui-result__key-value-pair {
    display: flex;
    align-items: center;
    font-size: 0.875rem;
  }
  
  .sui-result__key {
    font-weight: 600;
    margin-right: 0.5rem;
    color: #4b5563;
  }
  
  .sui-result__value {
    color: #1f2937;
  }
  
  .sui-results__empty {
    padding: 3rem;
    text-align: center;
    font-size: 1.2rem;
    color: #6b7280;
    background-color: #f9fafb;
    border-radius: 8px;
    border: 1px dashed #d1d5db;
  }
  
  /* 暗色模式适配 */
  :global(.dark) .sui-result {
    background-color: #2d3748;
    border-color: #4a5568;
  }
  
  :global(.dark) .sui-result__title a {
    color: #88a4ff;
  }
  
  :global(.dark) .sui-result__details {
    border-top-color: #4a5568;
  }
  
  :global(.dark) .sui-result__key {
    color: #a0aec0;
  }
  
  :global(.dark) .sui-result__value {
    color: #e2e8f0;
  }
  
  :global(.dark) .sui-result__description {
    color: #a0aec0;
  }
  
  :global(.dark) .sui-result__image {
    border-color: #4a5568;
  }
  
  :global(.dark) .sui-results__empty {
    color: #a0aec0;
    background-color: #2d3748;
    border-color: #4a5568;
  }
  
  .sui-result__icon-btn svg {
    stroke: currentColor;
  }
</style> 