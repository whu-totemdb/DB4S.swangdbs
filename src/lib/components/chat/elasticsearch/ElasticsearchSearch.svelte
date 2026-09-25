<script>
  import { onMount } from 'svelte';
  import { createSearchkitConfig, SORT_OPTIONS, facetLabels } from './index';
  import SearchBox from './SearchBox.svelte';
  import Facets from './Facets.svelte';
  import SearchResults from './SearchResults.svelte';
  import { createEventDispatcher } from 'svelte';
  import './styles.css';
  
  export let darkMode = false;
  export let searchType = 'patents';
  
  // 添加锁定标志
  let isSearchLocked = false;

  // 优化searchType监听
  let prevSearchType = searchType;

  // 强制监听prop变化并强制重新初始化
  $: if (searchType !== prevSearchType) {
    console.log('强制重新初始化searchType:', searchType);
    
    // 保存滚动位置
    if (resultsContainer) {
      lastKnownScrollPosition = resultsContainer.scrollTop;
    }
    
    // 更新配置
    initConfig(searchType);
    
    // 更新类型标记
    prevSearchType = searchType;
    
    // 在锁定检查后执行搜索
    if (searchExecuted && !isSearchLocked) {
      setTimeout(() => {
        performSearch().then(() => {
          // 确保搜索完成后才恢复滚动
          setTimeout(() => {
            restoreScrollPosition(lastKnownScrollPosition);
          }, 300);
        });
      }, 200);
    }
  }
  
  const dispatch = createEventDispatcher();
  
  // 搜索状态
  let searchTerm = "";
  let results = [];
  let facets = {};
  let filters = [];
  let loading = false;
  let error = null;
  let totalResults = 0;
  let currentPage = 1;
  let resultsPerPage = 10;
  let sorting = [];
  let searchExecuted = false;
  
  // API配置
  let config;
  let API_HOST;
  let API_INDEX;
  let API_KEY;
  let sortOptions = [];
  
  // 初始化配置函数 - 明确接收searchType参数
  function initConfig(type) {
    // 保存当前滚动位置
    const currentScrollTop = resultsContainer?.scrollTop || 0;
    
    // 现有的初始化代码
    const currentType = type || searchType;
    console.log('初始化配置，搜索类型:', currentType);
    config = createSearchkitConfig(currentType);
    API_HOST = config.connection.host;
    API_INDEX = config.connection.index;
    API_KEY = config.connection.apiKey;
    sortOptions = SORT_OPTIONS[currentType] || [];
    sorting = sortOptions[0]?.value || [];
    console.log('API配置:', {API_HOST, API_INDEX, sortOptions});
    
    // 在初始化后的渲染周期恢复滚动位置
    setTimeout(() => {
        if (resultsContainer) {
            resultsContainer.scrollTop = currentScrollTop;
        }
    }, 0);
  }
  
  // 在脚本顶部添加常量和引用
  const PATENT_STORAGE_KEY = 'patent-search-state';
  let resultsContainer;
  let debouncedSaveState;

  // 添加新变量跟踪当前滚动位置
  let lastKnownScrollPosition = 0;

  // 把函数移到组件级别，而不是onMount内部
  function handleResetSearchState() {
    console.log('重置搜索状态');
    
    // 清除保存的状态
    sessionStorage.removeItem(PATENT_STORAGE_KEY);
    
    // 清空搜索词
    searchTerm = "";
    // 清空筛选条件
    filters = [];
    // 重置页面
    currentPage = 1;
    // 重置排序为默认
    sorting = sortOptions[0]?.value || [];
    
    // 清除 facets UI 状态
    facets = {};
    
    // 执行搜索
    performSearch().then(() => {
      // 滚动回顶部
      if (resultsContainer) {
        resultsContainer.scrollTop = 0;
      }
      
      // 强制更新UI
      searchExecuted = true;
    });
  }

  onMount(async () => {
    console.log('组件挂载，搜索类型:', searchType);
    initConfig(searchType);
    
    // 尝试从sessionStorage恢复状态
    try {
      const savedState = sessionStorage.getItem(PATENT_STORAGE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        searchTerm = state.searchTerm || "";
        filters = state.filters || [];
        currentPage = state.currentPage || 1;
        sorting = state.sorting || (sortOptions[0]?.value || []);
        
        // 如果有保存的搜索状态，执行搜索
        if (state.hasSearched) {
          performSearch().then(() => {
            // 搜索完成后恢复滚动位置
            if (resultsContainer && state.scrollPosition) {
              restoreScrollPosition(state.scrollPosition);
            }
          });
        } else {
          performSearch();
        }
      } else {
        performSearch();
      }
    } catch (err) {
      console.error('恢复搜索状态失败:', err);
      performSearch();
    }
    
    // 添加保存搜索状态的事件监听器
    const searchContainer = document.querySelector('.sui-layout');
    if (searchContainer) {
      searchContainer.addEventListener('save-search-state', saveSearchState);
      searchContainer.addEventListener('reset-search-state', handleResetSearchState);
    }
    
    // 初始化防抖函数
    debouncedSaveState = debounce(() => {
      saveSearchState();
    }, 200);

    // 定义滚动处理函数
    const scrollHandler = () => {
      lastKnownScrollPosition = resultsContainer.scrollTop;
      debouncedSaveState();
    };
    
    // 添加滚动事件监听
    if (resultsContainer) {
      resultsContainer.addEventListener('scroll', scrollHandler);
    }

    // 确保全局监听器捕获重置事件
    window.addEventListener('reset-patents-search', handleResetSearchState);
    
    // 同时保留对搜索容器的监听
    const searchContainerElem = document.querySelector('.sui-layout');
    if (searchContainerElem) {
      searchContainerElem.addEventListener('reset-search-state', handleResetSearchState);
    }

    return () => {
      // 清理事件监听器
      const searchContainer = document.querySelector('.sui-layout');
      if (searchContainer) {
        searchContainer.removeEventListener('save-search-state', saveSearchState);
        searchContainer.removeEventListener('reset-search-state', handleResetSearchState);
      }
      if (resultsContainer) {
        resultsContainer.removeEventListener('scroll', scrollHandler);
      }
      window.removeEventListener('reset-patents-search', handleResetSearchState);
    };
  });

  // 添加保存状态的函数
  function saveSearchState() {
    try {
      const scrollTop = resultsContainer?.scrollTop || 0;
      
      const state = {
        searchTerm,
        filters,
        currentPage,
        sorting,
        hasSearched: searchExecuted,
        scrollPosition: scrollTop
      };
      sessionStorage.setItem(PATENT_STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('保存搜索状态失败:', err);
    }
  }
  
  // 执行搜索
  async function performSearch(appendResults = false) {
    // 如果已经在搜索中，则退出
    if (isSearchLocked) {
      console.log('搜索已锁定，忽略重复请求');
      return;
    }
    
    // 设置锁定
    isSearchLocked = true;
    console.log('搜索开始，设置锁定');
    
    loading = true;
    error = null;
    
    try {
      if (!API_HOST || !API_INDEX) {
        throw new Error("API配置不完整，请检查searchType设置");
      }
      
      const url = `${API_HOST}/${API_INDEX}/_search`;
      
      // 构建Elasticsearch查询
      const query = buildElasticsearchQuery();
      
      console.log(`执行搜索 - 页面 ${currentPage}，每页 ${resultsPerPage}，总结果 ${totalResults}`);
      console.log("搜索查询:", JSON.stringify(query));
      console.log(`从第 ${(currentPage - 1) * resultsPerPage} 条开始，获取 ${resultsPerPage} 条`);
      
      // 发送请求
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (API_KEY) {
        headers['Authorization'] = `ApiKey ${API_KEY}`;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(query)
      });
      
      if (!response.ok) {
        throw new Error(`搜索请求失败: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("搜索结果:", data);
      processSearchResults(data);
      searchExecuted = true;
      
      // 触发搜索完成事件
      dispatch('searchComplete', { 
        results, 
        facets,
        totalResults,
        searchTerm,
        searchType
      });
    } catch (err) {
      console.error('搜索错误:', err);
      error = err.message || '搜索过程中发生错误';
    } finally {
      // 释放锁定
      isSearchLocked = false;
      loading = false;
      console.log('搜索完成，释放锁定');
    }
  }
  
  // 处理搜索结果
  function processSearchResults(data) {
    // 处理结果列表
    results = data.hits.hits.map(hit => {
      const processedHit = {
        id: hit._id,
        score: hit._score,
        originalData: hit._source // 存储原始数据方便访问
      };
      
      // 处理普通字段
      for (const field of config.search_settings.result_attributes) {
        if (typeof field === 'string') {
          // 支持嵌套字段访问（如 Paper_Details.PaperTitle）
          if (field.includes('.')) {
            const parts = field.split('.');
            let value = hit._source;
            for (const part of parts) {
              if (value && value[part] !== undefined) {
                value = value[part];
              } else {
                value = null;
                break;
              }
            }
            processedHit[field] = {
              raw: value
            };
          } else {
            processedHit[field] = {
              raw: hit._source[field]
            };
          }
        }
      }
      
      // 处理高亮字段
      if (hit.highlight) {
        for (const field in hit.highlight) {
          // 确保字段存在在processedHit中，如果不存在则创建
          const simpleField = field.split('.').pop();
          if (!processedHit[field]) {
            processedHit[field] = {};
          }
          processedHit[field].snippet = hit.highlight[field].join(' ... ');
          
          // 为嵌套字段也添加简化的访问方式
          processedHit[simpleField] = processedHit[simpleField] || {};
          processedHit[simpleField].snippet = hit.highlight[field].join(' ... ');
        }
      }
      
      return processedHit;
    });
    
    // 处理facets
    const processedFacets = {};
    if (data.aggregations) {
      for (const key in data.aggregations) {
        const aggData = data.aggregations[key];
        
        if (aggData.buckets) {
          processedFacets[key] = {
            data: aggData.buckets.map(bucket => ({
              value: bucket.key,
              count: bucket.doc_count
            }))
          };
        }
      }
    }
    facets = processedFacets;
    
    // 设置总结果数
    if (data.hits.total && typeof data.hits.total === 'object') {
      // ES7+格式: { value: 10000, relation: 'gte' }
      totalResults = data.hits.total.value;
      const relation = data.hits.total.relation;
      
      // 如果relation是'gte'(大于等于)，表示实际数量超过了返回值
      if (relation === 'gte' && totalResults === 10000) {
        totalResults = 10000; // 改为数字而非字符串，确保Math.ceil计算正确
      }
    } else {
      // 旧版ES格式或其他情况，直接使用value
      totalResults = data.hits.total.value || data.hits.total || 0;
    }

    // 打印分页信息帮助调试
    console.log(`处理搜索结果 - 总结果数: ${totalResults}, 总页数: ${Math.ceil(totalResults / resultsPerPage)}`);

    // 在processSearchResults函数中添加处理
    if (data.hits.hits.length === 0 && currentPage > 1) {
      // 如果当前页没有结果且不是第一页，回退到第一页
      currentPage = 1;
      performSearch(); // 重新搜索
      return; // 中止当前处理
    }
  }
  
  // 构建Elasticsearch查询
  function buildElasticsearchQuery() {
    // 解析权重字段为统一结构
    const attrs = config.search_settings.search_attributes.map(field => {
      return typeof field === 'string' ? { field, weight: 1 } : field;
    });

    // 标题/人名机构字段集合
    const titleFieldsSet = new Set(['专利名称', 'Paper_Details.PaperTitle']);
    const peopleOrgFieldsSet = new Set([
      '申请人',
      '发明人',
      'Author_List.Author_Details.Author_Name',
      'Author_List.Affiliation_Details.Affiliation_Name'
    ]);

    // 按类别拆分并保留权重
    const titleFields = attrs
      .filter(a => titleFieldsSet.has(a.field))
      .map(a => `${a.field}^${a.weight}`);

    const peopleOrgFields = attrs
      .filter(a => peopleOrgFieldsSet.has(a.field))
      .map(a => `${a.field}^${a.weight}`);

    const otherFields = attrs
      .filter(a => !titleFieldsSet.has(a.field) && !peopleOrgFieldsSet.has(a.field))
      .map(a => `${a.field}^${a.weight}`);

    // 基础查询
    const query = {
      size: resultsPerPage,
      from: (currentPage - 1) * resultsPerPage,
      query: {
        bool: {
          must: searchTerm
            ? {
                bool: {
                  should: [],
                  minimum_should_match: 1
                }
              }
            : { match_all: {} },
          filter: []
        }
      },
      aggs: {},
      highlight: {
        fields: {},
        pre_tags: ["<em>"],
        post_tags: ["</em>"]
      }
    };

    // 1) 标题短语匹配：只有完整包含时才触发高权重
    if (searchTerm && titleFields.length > 0) {
      // 仅对具体字段做短语匹配，不走 multi_match，以确保“完整包含”语义
      for (const tf of titleFields) {
        const f = tf.split('^')[0];
        query.query.bool.must.bool.should.push({
          match_phrase: {
            [f]: { query: searchTerm, boost: 8 }
          }
        });
      }
    }

       // 2) 作者/机构（或申请人/发明人）优先
       if (searchTerm && peopleOrgFields.length > 0) {
      if (searchType === 'patents') {
        // 专利：为申请人/发明人添加短语匹配（整句完全包含优先）
        query.query.bool.must.bool.should.push({
          match_phrase: { '申请人': { query: searchTerm, boost: 8 } }
        });
        query.query.bool.must.bool.should.push({
          match_phrase: { '发明人': { query: searchTerm, boost: 6 } }
        });
        // 严格 AND 的 multi_match，长实体名更稳命中
        query.query.bool.must.bool.should.push({
          multi_match: {
            query: searchTerm,
            fields: peopleOrgFields,
            type: 'best_fields',
            operator: 'and',
            boost: 4
          }
        });
      } else {
        // 论文沿用原来的优先策略
        query.query.bool.must.bool.should.push({
          multi_match: {
            query: searchTerm,
            fields: peopleOrgFields,
            type: 'best_fields',
            boost: 4
          }
        });
      }
    }

    // 3) 其他字段常规匹配（不含标题）
    if (searchTerm && otherFields.length > 0) {
      query.query.bool.must.bool.should.push({
        multi_match: {
          query: searchTerm,
          fields: otherFields,
          type: "best_fields",
          boost: 1.2
        }
      });
    }

    // 添加过滤条件
    if (filters.length > 0) {
      filters.forEach(filter => {
        if (filter.type === 'any' && filter.values.length > 0) {
          query.query.bool.filter.push({
            terms: {
              [filter.field]: filter.values
            }
          });
        }
      });
    }

    // 添加聚合查询(facets)
    for (const facet of config.search_settings.facet_attributes) {
      if (facet.type === 'string') {
        query.aggs[facet.attribute] = {
          terms: { field: facet.field, size: 30 }
        };
      } else if (facet.type === 'numeric') {
        query.aggs[facet.attribute] = {
          stats: { field: facet.field }
        };
      } else if (facet.type === 'range' && facet.ranges) {
        query.aggs[facet.attribute] = {
          range: { field: facet.field, ranges: facet.ranges }
        };
      }
    }

    // 添加高亮
    for (const field of config.search_settings.highlight_attributes) {
      query.highlight.fields[field] = {};
    }

    // 添加排序
    if (sorting && sorting.length > 0) {
      query.sort = sorting.map(sort => ({
        [sort.field]: { order: sort.direction }
      }));
    }

    return query;
  }
  
  // 处理搜索框的提交
  function handleSearchSubmit(event) {
    console.log("搜索提交:", event.detail);
    const previousTerm = searchTerm;
    searchTerm = event.detail?.value || "";
    console.log(`搜索词从"${previousTerm}"变为"${searchTerm}"`);
    currentPage = 1;
    performSearch();
    saveSearchState(); // 添加这行
  }
  
  // 处理搜索框的变化
  function handleSearchChange(event) {
    console.log("搜索框变化:", event.detail);
    searchTerm = event.detail?.value || "";
    console.log("当前搜索词:", searchTerm);
  }
  
  // 处理过滤器变化
  function handleFilterChange(newFilters) {
    console.log("过滤器变化:", newFilters);
    filters = newFilters || [];
    currentPage = 1;
    performSearch();
    saveSearchState(); // 添加这行
  }
  
  // 处理结果点击
  function handleResultClick(event) {
    console.log("结果点击:", event.detail);
    dispatch('resultClick', { result: event.detail.result });
  }
  
  // 新增：处理分析专利
  function handleAnalyzePatent(event) {
    console.log("分析专利事件:", event.detail);
    dispatch('analyzePatent', event.detail);
  }
  
  // 新增：处理分析申请人
  function handleAnalyzeApplicant(event) {
    console.log("分析申请人事件:", event.detail);
    dispatch('analyzeApplicant', event.detail);
  }
  
  // 新增：处理分析发明人
  function handleAnalyzeInventor(event) {
    console.log("分析发明人事件:", event.detail);
    dispatch('analyzeInventor', event.detail);
  }
  
  // 处理排序变化
  function handleSortChange(event) {
    console.log("排序变化:", event.target.value);
    const sortOption = sortOptions.find(option => option.name === event.target.value);
    if (sortOption) {
      sorting = sortOption.value;
      performSearch();
      saveSearchState(); // 添加这行
    }
  }
  
  // 处理分页变化
  function handlePageChange(newPage) {
    console.log("分页变化:", newPage, "当前页:", currentPage, "总页数:", Math.ceil(totalResults / resultsPerPage));
    if (newPage !== currentPage && newPage >= 1 && newPage <= Math.ceil(totalResults / resultsPerPage)) {
      currentPage = newPage;
      console.log("页面已更新为:", currentPage);
      performSearch().then(() => {
        console.log("新页面加载完成");
        // 滚动到顶部
        if (resultsContainer) {
          resultsContainer.scrollTop = 0;
        }
      });
      
      // 保存搜索状态
      saveSearchState();
    } else {
      console.log("分页请求被忽略 - 页码无效或相同");
    }
  }
  
  // 创建一个elasticsearch客户端对象，用于Facets组件
  const elasticsearchClient = {
    search: async (searchRequest) => {
      try {
        const url = `${API_HOST}/${searchRequest.index}/_search`;
        const headers = {
          'Content-Type': 'application/json'
        };
        
        if (API_KEY) {
          headers['Authorization'] = `ApiKey ${API_KEY}`;
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(searchRequest.body)
        });
        
        if (!response.ok) {
          throw new Error(`Search request failed: ${response.status} ${response.statusText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('Elasticsearch search error:', error);
        throw error;
      }
    }
  };

  // 添加防抖函数
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // 改进restoreScrollPosition函数，使用与专利搜索组件相同的递归尝试方法
  function restoreScrollPosition(position) {
    console.log('开始恢复滚动位置:', position);
    
    // 使用递归方式多次尝试
    function attemptRestore(attempts = 0) {
      if (attempts > 15) return; // 增加尝试次数
      
      setTimeout(() => {
        if (!resultsContainer) {
          console.log('无法找到结果容器，尝试次数:', attempts + 1);
          return attemptRestore(attempts + 1);
        }
        
        console.log('设置滚动位置:', position, '尝试次数:', attempts + 1);
        resultsContainer.scrollTop = position;
        
        // 检查是否成功
        if (Math.abs(resultsContainer.scrollTop - position) > 5 && position > 0) {
          console.log('滚动位置未正确设置，当前:', resultsContainer.scrollTop, '目标:', position);
          return attemptRestore(attempts + 1);
        } else {
          console.log('滚动位置成功恢复到:', resultsContainer.scrollTop);
        }
      }, 150 * (attempts + 1)); // 增加延迟
    }
    
    // 开始尝试恢复
    attemptRestore();
  }
</script>

<div class={`sui-layout ${darkMode ? 'sui-search--dark' : ''}`} style="height: 100%; overflow-y: auto; display: flex; flex-direction: column;">
  <div class="sui-layout-header" style="flex-shrink: 0; padding: 10px; border-bottom: 1px solid #e5e7eb;">
    <SearchBox 
      initialValue={searchTerm}
      on:submit={handleSearchSubmit}
      on:change={handleSearchChange}
      searchAsYouType={false}
      placeholder={searchType === 'patents' ? "搜索专利..." : "搜索论文..."}
    />
  </div>
  
  <div class="sui-layout-body" style="flex-grow: 1; overflow: hidden; display: flex;">
    <div class="sui-layout-body__inner" style="width: 100%; display: flex; overflow: hidden;">
      <div class="sui-layout-sidebar" style="width: 250px; padding: 15px; border-right: 1px solid #e5e7eb; overflow-y: auto; flex-shrink: 0;">
        {#if searchExecuted}
          <div class="sui-sorting">
            <label for="sort-select">排序方式:</label>
            <select 
              id="sort-select" 
              class="sui-results-per-page__select"
              value={sortOptions.find(opt => JSON.stringify(opt.value) === JSON.stringify(sorting))?.name}
              on:change={handleSortChange}
            >
              {#each sortOptions as option}
                <option value={option.name}>{option.name}</option>
              {/each}
            </select>
          </div>
        {/if}
        
        <Facets 
          {facets}
          {filters}
          on:filterChange={(event) => handleFilterChange(event.detail)}
          elasticsearch={elasticsearchClient}
          index={API_INDEX}
        />
      </div>
      
      <div class="sui-layout-main" style="flex-grow: 1; overflow: hidden; display: flex; flex-direction: column;">
        <div class="sui-layout-main-header" style="padding: 15px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;">
          {#if searchExecuted}
            <div class="sui-results-summary">
              <div class="sui-paging-info">
                显示 {results.length > 0 ? ((currentPage - 1) * resultsPerPage) + 1 : 0} - {Math.min(typeof totalResults === 'string' ? parseInt(totalResults) : totalResults, currentPage * resultsPerPage)} 条，
                共 <strong>{totalResults}</strong> 条结果
                {#if searchTerm}
                  匹配 <strong>"{searchTerm}"</strong>
                {/if}
              </div>
            </div>
            
            <div class="sui-results-per-page">
              <span class="sui-results-per-page__label">每页显示:</span>
              <select 
                class="sui-results-per-page__select"
                bind:value={resultsPerPage}
                on:change={(e) => {
                  resultsPerPage = parseInt(e.target.value);
                  currentPage = 1;
                  performSearch();
                }}
              >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              </select>
            </div>
          {/if}
        </div>
        
        <!-- 修改结果容器的div，添加bind:this引用 -->
        <div class="sui-layout-main-body" bind:this={resultsContainer} style="flex-grow: 1; padding: 15px; overflow-y: auto;">
          {#if loading}
            <div class="sui-loading">
              <div class="sui-loading__loader"></div>
              <div class="sui-loading__message">正在搜索...</div>
            </div>
          {:else if error}
            <div class="sui-search-error">
              <div>搜索错误: {error}</div>
            </div>
          {:else}
            <SearchResults 
              results={results}
              titleField={searchType === 'patents' ? "专利名称" : "Paper_Details.PaperTitle"}
              defaultImageUrl="https://img2.baidu.com/it/u=2386315314,1853898729&fm=253&fmt=auto&app=138&f=JPEG?w=407&h=380"
              on:resultClick={handleResultClick}
              {searchType}
              on:analyzePatent={handleAnalyzePatent}
              on:analyzeApplicant={handleAnalyzeApplicant}
              on:analyzeInventor={handleAnalyzeInventor}
            />
            
            {#if results.length > 0}
            <div class="sui-paging">
              <ul class="sui-pagination">
                <!-- 上一页按钮 -->
                <li class="sui-pagination__item" class:disabled={currentPage === 1}>
                  <button 
                    class="sui-pagination__link"
                    disabled={currentPage === 1}
                    on:click={() => handlePageChange(currentPage - 1)}
                  >
                    上一页
                  </button>
                </li>
                
                {#if true}
                  {@const totalPages = Math.ceil(totalResults / resultsPerPage) || 1}
                  {@const maxPagesToShow = 5}

                  <!-- 修正的分页算法 -->
                  {@const halfVisiblePages = Math.floor(maxPagesToShow / 2)}
                  {@const rawStartPage = Math.max(1, currentPage - halfVisiblePages)}
                  {@const rawEndPage = Math.min(totalPages, currentPage + halfVisiblePages)}

                  <!-- 确保总是显示maxPagesToShow个页码或者全部页码(如果总页数少于maxPagesToShow) -->
                  {@const startPage = Math.max(1, Math.min(rawStartPage, totalPages - maxPagesToShow + 1))}
                  {@const endPage = Math.min(totalPages, Math.max(rawEndPage, Math.min(totalPages, startPage + maxPagesToShow - 1)))}
                  
                  <!-- 第一页快速链接 -->
                  {#if startPage > 1}
                    <li class="sui-pagination__item">
                      <button class="sui-pagination__link" on:click={() => handlePageChange(1)}>1</button>
                    </li>
                    {#if startPage > 2}
                      <li class="sui-pagination__item sui-pagination__ellipsis">...</li>
                    {/if}
                  {/if}
                  
                  <!-- 动态页码按钮 -->
                  {#each Array(Math.min(maxPagesToShow, totalPages)).slice(0, endPage - startPage + 1) as _, i}
                    {@const pageNum = startPage + i}
                    <li 
                      class="sui-pagination__item" 
                      class:sui-pagination__item--active={pageNum === currentPage}
                    >
                      <button 
                        class="sui-pagination__link" 
                        on:click|stopPropagation={() => handlePageChange(pageNum)}
                      >
                        {pageNum}
                      </button>
                    </li>
                  {/each}
                  
                  <!-- 最后一页快速链接 -->
                  {#if endPage < totalPages}
                    {#if endPage < totalPages - 1}
                      <li class="sui-pagination__item sui-pagination__ellipsis">...</li>
                    {/if}
                    <li class="sui-pagination__item">
                      <button class="sui-pagination__link" on:click={() => handlePageChange(totalPages)}>
                        {totalPages}
                      </button>
                    </li>
                  {/if}
                {/if}
                
                <!-- 下一页按钮 -->
                <li 
                  class="sui-pagination__item" 
                  class:disabled={currentPage >= Math.ceil(totalResults / resultsPerPage)}
                >
                  <button 
                    class="sui-pagination__link"
                    disabled={currentPage >= Math.ceil(totalResults / resultsPerPage)}
                    on:click={() => handlePageChange(currentPage + 1)}
                  >
                    下一页
                  </button>
                </li>
              </ul>
            </div>
          {/if}
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  :global(.sui-layout) {
    --sui-border-color: #e5e7eb;
    --sui-background-color: #ffffff;
    --sui-text-color: #333333;
  }
  
  :global(.sui-search--dark) {
    --sui-border-color: #4a5568;
    --sui-background-color: #2d3748;
    --sui-text-color: #e2e8f0;
  }
  
  :global(.sui-select),
  :global(.sui-results-per-page__select) {
    appearance: none;
    background-color: var(--sui-background-color);
    border: 1px solid var(--sui-border-color);
    border-radius: 4px;
    color: var(--sui-text-color);
    font-size: 14px;
    padding: 6px 24px 6px 12px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8.825L1.175 4 2.238 2.938 6 6.7 9.763 2.938 10.825 4z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    cursor: pointer;
  }
  
  .sui-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #666;
  }
  
  .sui-loading__loader {
    display: inline-block;
    width: 30px;
    height: 30px;
    margin-bottom: 16px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-left-color: #3a56e4;
    border-radius: 50%;
    animation: sui-loading 1s linear infinite;
  }
  
  .sui-loading__message {
    font-size: 16px;
  }
  
  .sui-sorting {
    margin-bottom: 20px;
  }
  
  .sui-pagination {
    display: flex;
    list-style: none;
    padding: 0;
    margin: 20px 0;
    justify-content: center;
  }
  
  .sui-pagination__item {
    margin: 0 4px;
  }
  
  .sui-pagination__link {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--sui-border-color);
    border-radius: 4px;
    background: var(--sui-background-color);
    color: var(--sui-text-color);
    font-size: 14px;
    cursor: pointer;
  }
  
  .sui-pagination__item--active .sui-pagination__link {
    background-color: #3a56e4;
    border-color: #3a56e4;
    color: white;
  }
  
  @keyframes sui-loading {
    to { transform: rotate(360deg); }
  }
  
  /* 暗色模式 */
  :global(.sui-search--dark) {
    background-color: #222;
    color: #eee;
  }
  
  :global(.sui-search--dark .sui-loading) {
    color: #aaa;
  }
  
  :global(.sui-search--dark .sui-loading__loader) {
    border-color: rgba(255, 255, 255, 0.1);
    border-left-color: #4d69e9;
  }
  
  /* Disabled state */
  .disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .disabled button {
    cursor: not-allowed;
  }
</style> 