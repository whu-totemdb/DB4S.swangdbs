<script>
  import { createEventDispatcher } from 'svelte';
  
  export let results = [];
  export let titleField = "PaperTitle";
  export let urlField = "DOI";
  export let thumbnailField = ""; // 学术论文通常没有缩略图
  
  const dispatch = createEventDispatcher();
  
  // 处理结果点击事件
  function handleResultClick(result) {
    console.log("搜索结果点击:", result);
    dispatch('resultClick', { result });
  }
  
  // 处理生成报告按钮点击 - 分析论文
  function handleGenerateReport(result) {
    console.log("生成论文分析报告:", result);
    const paperTitle = result.Paper_Details?.PaperTitle || "未知论文";
    const paperId = result.PaperID || result.id || "未知ID";
    const abstract = result.Abstract?.PaperAbstract || result.Abstract || "";
    dispatch('generateReport', { paperTitle, paperId, abstract });
  }
  
  // 处理机构分析按钮点击 - 分析机构
  function handleAnalyzeInstitution(payload) {
    // payload 可能是 { ...result, _analyzeAffiliation: xxx, _analyzeAffiliationId: xxx }
    let institutionName = payload._analyzeAffiliation || payload.Paper_Details?.Publisher || "未知机构";
    let institutionId = payload._analyzeAffiliationId || null;
    let abstract = payload.Abstract?.PaperAbstract || payload.Abstract || "";
    // 如果没有直接传递ID，则尝试从作者机构信息中获取Affiliation_ID
    if (!institutionId && payload.Author_List && Array.isArray(payload.Author_List)) {
      for (const author of payload.Author_List) {
        if (author?.Affiliation_Details?.Affiliation_Name === institutionName) {
          institutionId = author.Affiliation_Details.Affiliation_ID || null;
          break;
        }
      }
    }
    dispatch('analyzeInstitution', { institutionName, institutionId, abstract });
  }
  
  // 添加处理作者分析按钮点击的函数
  function handleAnalyzeAuthor(author) {
    console.log("分析作者:", author);
    const authorName = author.Author_Details?.Author_Name || author.name || "未知作者";
    const authorId = author.Author_Details?.Author_ID || author.AuthorID || null;
    const affiliation = author.Affiliation_Details?.Affiliation_Name || "未知机构";
    dispatch('analyzeAuthor', { authorName, authorId, affiliation });
  }
  
  // DOI链接格式化
  function formatDOILink(doi) {
    if (!doi) return '';
    if (doi.startsWith('http')) return doi;
    return `https://doi.org/${doi}`;
  }
  
  // 格式化出版年份
  function formatYear(year) {
    if (!year) return '未知年份';
    return year;
  }
  
  // 格式化作者信息
  function formatAuthors(authorList) {
    if (!authorList) return '';
    
    try {
      // 处理不同的数据结构
      if (Array.isArray(authorList)) {
        // 如果是简单数组
        return authorList.join(', ');
      } else if (typeof authorList === 'object' && authorList.Author_Details) {
        // 处理嵌套结构
        if (Array.isArray(authorList.Author_Details)) {
          return authorList.Author_Details
            .map(author => author.Author_Name)
            .filter(Boolean)
            .join(', ');
        } else {
          return authorList.Author_Details.Author_Name || '';
        }
      } else if (typeof authorList === 'object') {
        // 查找所有嵌套的作者列表
        const authors = [];
        for (const list of Array.isArray(authorList) ? authorList : [authorList]) {
          if (list.Author_Details) {
            if (Array.isArray(list.Author_Details)) {
              authors.push(...list.Author_Details
                .map(author => author.Author_Name)
                .filter(Boolean));
            } else {
              const name = list.Author_Details.Author_Name;
              if (name) authors.push(name);
            }
          }
        }
        return authors.join(', ');
      }
    } catch (err) {
      console.error("处理作者信息出错:", err, authorList);
      return '';
    }
    
    return '';
  }
  
  // 格式化机构信息
  function formatAffiliations(authorList) {
    if (!authorList) return '';
    
    try {
      // 处理不同的数据结构
      const affiliations = new Set();
      
      if (typeof authorList === 'object') {
        // 查找所有嵌套的机构列表
        const lists = Array.isArray(authorList) ? authorList : [authorList];
        
        for (const list of lists) {
          if (list.Affiliation_Details) {
            if (Array.isArray(list.Affiliation_Details)) {
              list.Affiliation_Details
                .forEach(aff => {
                  if (aff.Affiliation_Name) affiliations.add(aff.Affiliation_Name);
                });
            } else {
              const name = list.Affiliation_Details.Affiliation_Name;
              if (name) affiliations.add(name);
            }
          }
        }
      }
      
      return Array.from(affiliations).join(', ');
    } catch (err) {
      console.error("处理机构信息出错:", err, authorList);
      return '';
    }
  }
  
  // 获取最新年份信息 (优先使用Paper_Basic.Year)
  function getYear(result) {
    if (result && result.Paper_Basic && result.Paper_Basic.raw) {
      return result.Paper_Basic.raw.Year || result.Year?.raw || "未知年份";
    }
    return result.Year?.raw || "未知年份";
  }
</script>

<div>
  {#if results.length === 0}
    <div class="sui-results__empty">
      <div>
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="sui-results__empty-icon">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="11" y1="8" x2="11" y2="14"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
        <p class="sui-results__empty-title">未找到符合条件的论文</p>
        <p class="sui-results__empty-hint">请尝试使用其他关键词或调整筛选条件</p>
      </div>
    </div>
  {:else}
    <ul class="sui-results-container">
      {#each results as result, i}
        <!-- 提取论文信息 -->
        {@const title = result.Paper_Details?.PaperTitle || "未知标题"}
        {@const doi = result.Paper_Basic?.DOI || ""}
        {@const doiLink = formatDOILink(doi)}
        {@const year = result.Paper_Basic?.Year || "未知年份"}
        {@const publisher = result.Paper_Details?.Publisher || "未知出版商"}
        {@const venue = result.Paper_Details?.OriginalVenue || "未知期刊/会议"}
        {@const citationCount = result.Paper_Basic?.Citation_Count || 0}
        {@const abstract = result.Abstract?.PaperAbstract || ""}
        {@const docType = result.Paper_Details?.DocType || "未知类型"}
        {@const authorsList = result.Author_List || []}
        {@const authors = Array.isArray(authorsList)
            ? authorsList.map(a => a?.Author_Details?.Author_Name).filter(Boolean).join('，')
            : '无作者信息'}
        {@const affiliations = Array.isArray(authorsList) 
            ? [...new Set(authorsList
                .filter(a => a?.Affiliation_Details?.Affiliation_Name)
                .map(a => a.Affiliation_Details.Affiliation_Name))]
                .join('，') 
            : ''}
        
        <li class="sui-result">
          <div class="sui-result__header">
            <!-- 标题展示，带高亮 -->
            <div class="sui-result__title">
              {#if doiLink}
                <a 
                  href={doiLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="sui-result__title-link"
                  on:click={() => handleResultClick(result)}
                >
                  {@html result.highlight?.Paper_Details?.PaperTitle?.join(' ... ') || title}
                </a>
              {:else}
                {@html result.highlight?.Paper_Details?.PaperTitle?.join(' ... ') || title}
              {/if}
              <!-- 论文分析机器人图标 -->
              <button class="sui-result__icon-btn" title="分析论文" on:click={() => handleGenerateReport(result)}>
                <img src="/btnpicture/button1.png" alt="分析论文" width="100" height="50" />
              </button>
            </div>
          </div>
          
          <!-- 论文主要信息 -->
          <div class="sui-result__body">
            <!-- 作者信息 -->
            <div class="sui-result__authors">
              <span class="sui-result__authors-label">作者:</span>
              <span class="sui-result__authors-list">
                {#each Array.isArray(authorsList) ? authorsList : [] as author, idx}
                  {#if author?.Author_Details?.Author_Name}
                    <span class="sui-result__author-item">
                      {author.Author_Details.Author_Name}
                      <!-- 作者分析机器人图标 -->
                      <button class="sui-result__icon-btn" title="分析作者" on:click={() => handleAnalyzeAuthor(author)}>
                        <img src="/btnpicture/button2.png" alt="分析作者" width="100" height="50" />
                      </button>
                    </span>{idx < authorsList.length - 1 ? '，' : ''}
                  {/if}
                {/each}
              </span>
            </div>
            
            <!-- 作者所属机构 -->
            {#if affiliations !== "未知机构"}
              <div class="sui-result__affiliations">
                <span class="sui-result__affiliations-label">机构:</span>
                <span class="sui-result__affiliations-list">
                  {#each Array.isArray(authorsList) ? authorsList : [] as author, idx}
                    {#if author?.Affiliation_Details?.Affiliation_Name}
                      <span class="sui-result__affiliation-item">
                        {author.Affiliation_Details.Affiliation_Name}
                        <!-- 机构分析机器人图标 -->
                        <button class="sui-result__icon-btn" title="分析机构" on:click={() => handleAnalyzeInstitution({
                          ...result,
                          _analyzeAffiliation: author.Affiliation_Details.Affiliation_Name,
                          _analyzeAffiliationId: author.Affiliation_Details.Affiliation_ID ?? author.AffiliationID
                        })}>
                          <img src="/btnpicture/button2.png" alt="分析机构" width="100" height="50" />
                        </button>
                      </span>{idx < authorsList.length - 1 ? '，' : ''}
                    {/if}
                  {/each}
                </span>
              </div>
            {/if}
            
            <!-- 出版信息 -->
            <div class="sui-result__meta">
              <span class="sui-result__doc-type">{docType}</span>
              <span class="sui-result__year">{year}</span>
              {#if venue && venue !== '未知期刊/会议'}
                <span class="sui-result__venue">{venue}</span>
              {/if}
              {#if publisher && publisher !== '未知出版商'}
                <span class="sui-result__publisher">
                  {publisher}
                </span>
              {/if}
              <span class="sui-result__citations">引用量: {citationCount}</span>
            </div>
            
            <!-- 摘要 -->
            {#if abstract}
              <div class="sui-result__abstract">
                <h4>摘要:</h4>
                <p>{abstract}</p>
              </div>
            {/if}
            
            <!-- 详细信息 -->
            <div class="sui-result__details">
              {#if result.Paper_Details?.Volume}
                <div class="sui-result__key-value-pair">
                  <span class="sui-result__key">卷:</span>
                  <span class="sui-result__value">{result.Paper_Details.Volume}</span>
                </div>
              {/if}
              
              {#if result.Paper_Details?.Issue}
                <div class="sui-result__key-value-pair">
                  <span class="sui-result__key">期:</span>
                  <span class="sui-result__value">{result.Paper_Details.Issue}</span>
                </div>
              {/if}
              
              {#if result.Paper_Basic?.Reference_Count !== undefined}
                <div class="sui-result__key-value-pair">
                  <span class="sui-result__key">参考文献数:</span>
                  <span class="sui-result__value">{result.Paper_Basic.Reference_Count}</span>
                </div>
              {/if}
              
              {#if result.Paper_Basic?.Date}
                <div class="sui-result__key-value-pair">
                  <span class="sui-result__key">出版日期:</span>
                  <span class="sui-result__value">
                    {new Date(result.Paper_Basic.Date).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              {/if}
              
              {#if result.Paper_Details?.BookTitle}
                <div class="sui-result__key-value-pair">
                  <span class="sui-result__key">书名:</span>
                  <span class="sui-result__value">{result.Paper_Details.BookTitle}</span>
                </div>
              {/if}
              {#if result.JournalID?.raw}
                <div class="sui-result__key-value-pair">
                  <span class="sui-result__key">期刊ID:</span>
                  <span class="sui-result__value">{result.JournalID.raw}</span>
                </div>
              {/if}
              {#if doi}
                <div class="sui-result__key-value-pair">
                  <span class="sui-result__key">DOI:</span>
                  <span class="sui-result__value">
                    <a href={doiLink} target="_blank" rel="noopener noreferrer" class="sui-result__doi-link">
                      {doi}
                    </a>
                  </span>
                </div>
              {/if}
            </div>
          </div>
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
    margin-bottom: 0.75rem;
  }
  
  .sui-result__title {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.4;
  }
  
  .sui-result__title a {
    color: #3a56e4;
    text-decoration: none;
  }
  
  .sui-result__title a:hover {
    text-decoration: underline;
  }
  
  .sui-result__body {
    line-height: 1.6;
  }
  
  /* 作者信息样式 */
  .sui-result__authors {
    margin-bottom: 0.5rem;
    font-size: 0.95rem;
  }
  
  .sui-result__authors-label {
    font-weight: 600;
    color: #4b5563;
    margin-right: 0.5rem;
  }
  
  .sui-result__authors-list {
    color: #1f2937;
  }

  .sui-result__author-item {
    display: inline-flex;
    align-items: center;
}
  
  /* 作者所属机构样式 */
  .sui-result__affiliations {
    margin-bottom: 0.75rem;
    font-size: 0.85rem;
    color: #6b7280;
    font-style: italic;
  }
  
  .sui-result__affiliations-label {
    font-weight: 600;
    margin-right: 0.5rem;
  }
  
  /* 论文元数据样式 */
  .sui-result__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
    color: #4b5563;
  }
  
  .sui-result__doc-type {
    font-weight: 600;
    background-color: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }
  
  .sui-result__year {
    color: #1f2937;
  }
  
  .sui-result__venue {
    font-style: italic;
  }
  
  .sui-result__publisher {
    color: #6b7280;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .sui-result__institution-button {
    background: none;
    border: none;
    padding: 2px;
    color: #3a56e4;
    cursor: pointer;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s, transform 0.1s;
  }
  
  .sui-result__institution-button:hover {
    background-color: rgba(58, 86, 228, 0.1);
    transform: scale(1.1);
  }
  
  .sui-result__citations {
    color: #3a56e4;
    font-weight: 500;
  }
  
  /* 摘要部分 */
  .sui-result__abstract {
    margin: 0.75rem 0;
    padding: 0.75rem;
    background-color: #f9fafb;
    border-radius: 0.25rem;
  }
  
  .sui-result__abstract h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.875rem;
    color: #4b5563;
  }
  
  .sui-result__abstract p {
    margin: 0;
    font-size: 0.875rem;
    color: #1f2937;
    line-height: 1.5;
  }
  
  /* 详细信息部分 */
  .sui-result__details {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
    border-top: 1px solid #e5e7eb;
    padding-top: 0.75rem;
    margin-top: 0.75rem;
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
    flex-shrink: 0;
  }
  
  .sui-result__value {
    color: #1f2937;
    word-break: break-word;
  }
  
  .sui-result__doi-link {
    color: #3a56e4;
    text-decoration: none;
  }
  
  .sui-result__doi-link:hover {
    text-decoration: underline;
  }
  
  /* 添加按钮的样式 */
  .sui-result__actions {
    grid-column: 1 / -1;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }
  
  .sui-result__button {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s, transform 0.1s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .sui-result__button--primary {
    background-color: #3a56e4;
    color: white;
    border: none;
  }
  
  .sui-result__button--secondary {
    background-color: #f3f4f6;
    color: #1f2937;
    border: 1px solid #e5e7eb;
  }
  
  .sui-result__button--primary:hover {
    background-color: #2a46d4;
    transform: translateY(-1px);
  }
  
  .sui-result__button--secondary:hover {
    background-color: #e5e7eb;
    transform: translateY(-1px);
  }
  
  .sui-result__button-icon {
    flex-shrink: 0;
  }
  
  /* 暗黑模式支持 */
  :global(.sui-search--dark) .sui-result {
    background-color: #1f2937;
    border-color: #374151;
  }
  
  :global(.sui-search--dark) .sui-result__title a {
    color: #93c5fd;
  }
  
  :global(.sui-search--dark) .sui-result__abstract {
    background-color: #111827;
  }
  
  :global(.sui-search--dark) .sui-result__doc-type {
    background-color: #374151;
    color: #e5e7eb;
  }
  
  :global(.sui-search--dark) .sui-result__year,
  :global(.sui-search--dark) .sui-result__abstract p,
  :global(.sui-search--dark) .sui-result__value,
  :global(.sui-search--dark) .sui-result__authors-list {
    color: #e5e7eb;
  }
  
  :global(.sui-search--dark) .sui-result__key,
  :global(.sui-search--dark) .sui-result__abstract h4,
  :global(.sui-search--dark) .sui-result__authors-label,
  :global(.sui-search--dark) .sui-result__affiliations-label {
    color: #9ca3af;
  }
  
  :global(.sui-search--dark) .sui-result__publisher,
  :global(.sui-search--dark) .sui-result__affiliations {
    color: #9ca3af;
  }
  
  :global(.sui-search--dark) .sui-result__institution-button {
    color: #93c5fd;
  }
  
  :global(.sui-search--dark) .sui-result__institution-button:hover {
    background-color: rgba(147, 197, 253, 0.1);
  }
  
  :global(.sui-search--dark) .sui-result__citations,
  :global(.sui-search--dark) .sui-result__doi-link {
    color: #93c5fd;
  }
  
  :global(.sui-search--dark) .sui-result__button--primary {
    background-color: #4d69e9;
  }
  
  :global(.sui-search--dark) .sui-result__button--primary:hover {
    background-color: #6080f9;
  }
  
  :global(.sui-search--dark) .sui-result__button--secondary {
    background-color: #374151;
    color: #e5e7eb;
    border-color: #4b5563;
  }
  
  :global(.sui-search--dark) .sui-result__button--secondary:hover {
    background-color: #4b5563;
  }

  /* 无结果状态 */
  .sui-results__empty {
    padding: 3rem;
    text-align: center;
    font-size: 1rem;
    color: #6b7280;
    background-color: #f9fafb;
    border-radius: 0.5rem;
    border: 1px dashed #d1d5db;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .sui-results__empty-icon {
    margin-bottom: 1rem;
    color: #9ca3af;
  }
  
  .sui-results__empty-title {
    font-size: 1.125rem;
    font-weight: 500;
    margin: 0 0 0.5rem 0;
    color: #4b5563;
  }
  
  .sui-results__empty-hint {
    margin: 0;
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  :global(.sui-search--dark) .sui-results__empty {
    background-color: #111827;
    border-color: #374151;
  }
  
  :global(.sui-search--dark) .sui-results__empty-title {
    color: #e5e7eb;
  }
  
  :global(.sui-search--dark) .sui-results__empty-hint {
    color: #9ca3af;
  }

  .sui-result__icon-btn {
    background: none;
    border: none;
    padding: 0 0.2rem;
    margin-left: 0.2rem;
    cursor: pointer;
    vertical-align: middle;
    display: inline-flex;
    align-items: center;
    color: #3a56e4;
    transition: color 0.2s;
  }
  .sui-result__icon-btn:hover {
    color: #1e40af;
  }
  .sui-result__affiliation-item {
    display: inline-flex;
    align-items: center;
  }
  .sui-result__author-item {
    display: inline-flex;
    align-items: center;
  }
</style> 