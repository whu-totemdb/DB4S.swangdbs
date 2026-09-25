<script>
  import { onMount } from 'svelte';
  import { createSearchkitConfig, SORT_OPTIONS, THEME_VARIABLES, facetLabels } from './index.js';
  import SearchBox from './SearchBox.svelte';
  import Facets from './Facets.svelte';
  import SearchResults from './SearchResults.svelte';
  import { createEventDispatcher } from 'svelte';
  import './styles.css';
  
  export let darkMode = false;
  
  const dispatch = createEventDispatcher();
  
  // 搜索状态
  let searchTerm = "";
  let results = [];
  let facets = [];
  let filters = [];
  let loading = false;
  let error = null;
  let totalResults = 0;
  let currentPage = 1;
  let resultsPerPage = 10;
  let sorting = SORT_OPTIONS[0].value; // 默认使用"相关度"排序
  let searchExecuted = false;
  let themeVars = darkMode ? THEME_VARIABLES.dark : THEME_VARIABLES.light;
  
  // 确保主题变量随darkMode变化
  $: themeVars = darkMode ? THEME_VARIABLES.dark : THEME_VARIABLES.light;
  
  // API配置
  let config = createSearchkitConfig();
  let API_HOST = config.connection.host;
  let API_INDEX = config.connection.index;
  
  // 添加新变量用于懒加载
  let allLoadedResults = []; // 存储所有已加载的结果
  let isLoadingMore = false; // 是否正在加载更多
  let hasMoreResults = true; // 是否还有更多结果可加载
  let loadMoreObserver; // 交叉观察器

  // 1. 添加以下变量用于性能优化
  let facetsLoaded = false;  // 是否已加载facets
  let facetsLoading = false; // 是否正在加载facets
  let resultsCache = new Map(); // 缓存查询结果
  let lastSearchQuery = ""; // 上次搜索条件的哈希值
  
  // 在脚本顶部添加常量
  const STORAGE_KEY = 'paper-search-state';
  let resultsContainer; // 用于引用结果容器
  let debouncedSaveState; // 保存防抖函数的引用

  // 添加新变量用于追踪滚动位置
  let lastKnownScrollPosition = 0;

  // 组件挂载时执行
  onMount(async () => {
    console.log("Elasticsearch搜索组件挂载");
    
    // 初始化配置
    config = createSearchkitConfig();
    API_HOST = config.connection.host;
    API_INDEX = config.connection.index;
    
    // 应用主题变量
    applyThemeVariables();

    // 尝试从sessionStorage恢复状态
    try {
      const savedState = sessionStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        searchTerm = state.searchTerm || "";
        filters = state.filters || [];
        currentPage = state.currentPage || 1;
        sorting = state.sorting || SORT_OPTIONS[1].value;
        
        // 如果有保存的搜索状态，直接执行搜索
        if (state.hasSearched) {
          setTimeout(() => {
            performSearch().then(() => {
              // 搜索完成后恢复滚动位置
              if (resultsContainer && state.scrollPosition) {
                restoreScrollPosition(state.scrollPosition);
              }
            });
          }, 100);
        }
      } else {
        // 默认按最新发表排序
        sorting = SORT_OPTIONS[1].value;
        // 自动执行一次初始搜索，显示最新论文
        performSearch();
      }
    } catch (err) {
      console.error('恢复搜索状态失败:', err);
      // 出错时执行默认搜索
      sorting = SORT_OPTIONS[1].value;
      performSearch();
    }
    
    // 初始化交叉观察器
    initializeObserver();
    
    // 定义重置搜索状态的处理函数
    function handleResetSearchState() {
      console.log('重置论文搜索状态');
      
      // 清除保存的状态
      sessionStorage.removeItem(STORAGE_KEY);
      
      // 清空搜索词
      searchTerm = "";
      // 清空筛选条件
      filters = [];
      // 重置页面
      currentPage = 1;
      // 重置排序为默认
      sorting = SORT_OPTIONS[0].value;
      
      // 清除 facets UI 状态
      facets = [];
      facetsLoaded = false;
      
      // 执行搜索
      performSearch().then(() => {
        // 滚动回顶部
        if (resultsContainer) {
          resultsContainer.scrollTop = 0;
        }
        
        // 强制刷新 facets
        loadFacets();
      });
    }
    
    // 添加保存搜索状态的事件监听器
    const searchContainer = document.querySelector('.sui-layout');
    if (searchContainer) {
      searchContainer.addEventListener('save-search-state', saveSearchState);
      searchContainer.addEventListener('reset-search-state', handleResetSearchState);
    }

    // 监听特定于论文的重置事件
    window.addEventListener('reset-papers-search', handleResetSearchState);

    // 防抖函数初始化
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
    window.addEventListener('reset-search-state', handleResetSearchState);
    
    // 同时保留对搜索容器的监听
    const searchContainerElem = document.querySelector('.sui-layout');
    if (searchContainerElem) {
      searchContainerElem.addEventListener('reset-search-state', handleResetSearchState);
    }

    return () => {
      // 组件销毁时清理观察器
      if (loadMoreObserver) {
        loadMoreObserver.disconnect();
      }
      // 清理事件监听器
      const searchContainer = document.querySelector('.sui-layout');
      if (searchContainer) {
        searchContainer.removeEventListener('save-search-state', saveSearchState);
        searchContainer.removeEventListener('reset-search-state', handleResetSearchState);
      }
      // 移除滚动事件监听器
      if (resultsContainer) {
        resultsContainer.removeEventListener('scroll', scrollHandler);
      }
      window.removeEventListener('reset-search-state', handleResetSearchState);
      window.removeEventListener('reset-papers-search', handleResetSearchState);
    };
  });
  
  // 应用主题变量到组件
  function applyThemeVariables() {
    if (!darkMode) {
      Object.entries(THEME_VARIABLES.light).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    } else {
      Object.entries(THEME_VARIABLES.dark).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    }
  }
  
  // 执行搜索
  async function performSearch(appendResults = false) {
    if (!appendResults) {
      loading = true;
      allLoadedResults = [];
    } else {
      isLoadingMore = true;
    }
    error = null;
    
    try {
      // 构建查询参数
      const query = buildElasticsearchQuery();
      // 结果查询不带聚合（facets 独立后台请求）
      if (query.aggs) delete query.aggs;
      
      // 添加调试日志
      console.log(`执行搜索 - 页面 ${currentPage}，每页 ${resultsPerPage}，总结果 ${totalResults}`);
      console.log(`从第 ${(currentPage - 1) * resultsPerPage} 条开始，获取 ${resultsPerPage} 条`);
      
      // 创建缓存键
      const cacheKey = JSON.stringify({
        searchTerm,
        filters,
        sorting,
        page: currentPage,
        perPage: resultsPerPage
      });
      
      // 检查缓存
      if (resultsCache.has(cacheKey) && !appendResults) {
        const cachedData = resultsCache.get(cacheKey);

        // 兼容 total 结构，避免 hasMore 异常
        const totalHits = typeof cachedData?.hits?.total === 'number'
          ? cachedData.hits.total
          : (cachedData?.hits?.total?.value ?? 0);
        totalResults = totalHits;

        processSearchResults(cachedData, appendResults);
        searchExecuted = true;

       const pageHits = Array.isArray(cachedData?.hits?.hits) ? cachedData.hits.hits.length : 0;
       hasMoreResults = totalResults > (currentPage * resultsPerPage);

        loading = false;
        isLoadingMore = false;

        dispatch('searchComplete', { results, facets, totalResults, searchTerm });

        // 如果facets未加载，后台加载facets
        if (!facetsLoaded && !facetsLoading) {
          loadFacets();
        }
        return;
      }
      
      const searchUrl = `${API_HOST}/${API_INDEX}/_search`;
      console.log(`${appendResults ? '加载更多' : '新查询'}:`, searchUrl);
      
      // 执行查询
      const xhr = new XMLHttpRequest();
      xhr.open('POST', searchUrl, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'application/json');

      // 20s 超时兜底，防止卡死
      xhr.timeout = 20000;
      
      xhr.onload = function() {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText) || { hits: { hits: [], total: 0 } };

            // 确保正确提取总数
            const totalHits = typeof data.hits.total === 'number'
              ? data.hits.total
              : (data.hits.total?.value || 0);
            
            // 明确打印出totalHits，便于调试
            console.log(`响应数据 - 原始总数: ${JSON.stringify(data.hits.total)}, 解析后总数: ${totalHits}`);
            
            totalResults = totalHits;

            processSearchResults(data, appendResults);
            searchExecuted = true;

            // 明确计算hasMoreResults，确保分页可用
            hasMoreResults = totalResults > (currentPage * resultsPerPage);
            console.log(`分页状态: hasMoreResults=${hasMoreResults}, 总结果=${totalResults}, 当前页=${currentPage}, 每页数量=${resultsPerPage}`);

            // 背景加载 facets（独立，不阻塞结果）
            if (!facetsLoaded && !appendResults && !facetsLoading) {
              loadFacets();
            }

            dispatch('searchComplete', { results, facets, totalResults, searchTerm });
          } else {
            console.error("错误响应:", xhr.status, xhr.responseText);
            error = `搜索请求失败: ${xhr.status} ${xhr.statusText}`;
            searchExecuted = true; // 即便失败也落盘，显示错误块而不是持续加载
          }
        } catch (e) {
          console.error('解析响应失败:', e);
          error = '解析响应失败';
          searchExecuted = true;
        } finally {
          loading = false;
          isLoadingMore = false;
        }
      };

      xhr.onerror = function() {
        console.error("网络错误");
        error = "网络连接错误，请检查网络设置或ES服务是否可用";
        loading = false;
        isLoadingMore = false;
        searchExecuted = true;
      };

      xhr.ontimeout = function() {
        console.error("请求超时");
        error = "请求超时，请稍后重试";
        loading = false;
        isLoadingMore = false;
        searchExecuted = true;
      };
      
      xhr.send(JSON.stringify(query));
    } catch (err) {
      console.error('搜索错误:', err);
      error = err instanceof Error ? err.message : String(err);
      loading = false;
      isLoadingMore = false;
      searchExecuted = true;
    }
  }
  
  // 处理搜索结果
  function processSearchResults(data, appendResults = false) {
    // 处理结果列表
    const newResults = Array.isArray(data?.hits?.hits) ? data.hits.hits.map((hit) => ({
      id: hit._id,
      score: hit._score,
      ...hit._source,
      highlight: hit.highlight || {}
    })) : [];

    // 追加或替换结果
    if (appendResults) {
      allLoadedResults = [...allLoadedResults, ...newResults];
      results = allLoadedResults;
    } else {
      allLoadedResults = newResults;
      results = newResults;
    }

    // 仅当响应里包含聚合时才更新 facets，避免清空已加载的筛选
   if (data && data.aggregations) {
     const rawFacets = processAggregations(data.aggregations);
     facets = formatFacets(rawFacets);
   }

    // 设置总结果数（兼容 number / { value, relation } 两种格式）
    const totalHits = typeof data?.hits?.total === 'number'
      ? data.hits.total
      : (data?.hits?.total?.value ?? 0);


   // 添加页数上限限制
const maxResults = 10000; // 最多显示10000条结果（1000页，每页10条）
const relation = data?.hits?.total?.relation;
// 如果结果数太大或是估算值，则限制为最大值
if (relation === 'gte' || totalHits > maxResults) {
  totalResults = maxResults;
} else {
  totalResults = totalHits;
}
    // 打印分页信息帮助调试
    console.log(`处理搜索结果 - 总结果数: ${totalResults}, 总页数: ${Math.ceil(totalResults / resultsPerPage)}`);
  }
  
  // 处理ES聚合结果，转换为facets结构
  function processAggregations(aggregations) {
    if (!aggregations || !aggregations.all_facets) return [];
    const processedAggs = [];
    const allFacetsAggs = aggregations.all_facets;
    for (const [facetKey, aggResult] of Object.entries(allFacetsAggs)) {
      if (facetKey === 'doc_count') continue;
      // 查找facet配置
      const facetConfig = config.search_settings.facet_attributes.find(f => f.attribute === facetKey);
      if (!facetConfig) continue;
      let buckets = null;
      if (aggResult[`${facetKey}_terms`] && aggResult[`${facetKey}_terms`].buckets) {
        buckets = aggResult[`${facetKey}_terms`].buckets;
      } else if (aggResult[`${facetKey}_range`] && aggResult[`${facetKey}_range`].buckets) {
        buckets = aggResult[`${facetKey}_range`].buckets;
      } else if (aggResult.buckets) {
        buckets = aggResult.buckets;
      }
      if (!buckets || buckets.length === 0) continue;
      let values = buckets.map(bucket => ({
        value: bucket.key,
        count: bucket.doc_count
      }));
      // 保证range类型顺序
      if (facetConfig.type === 'range' && facetConfig.ranges) {
        const rangeOrder = {};
        facetConfig.ranges.forEach((range, idx) => { rangeOrder[range.name] = idx; });
        values.sort((a, b) => rangeOrder[a.value] - rangeOrder[b.value]);
      }
      processedAggs.push({
        attribute: facetConfig.attribute, // 用于label
        field: facetConfig.field,         // 用于filter
        type: facetConfig.type,
        values
      });
    }
    return processedAggs;
  }
  
  // 格式化facets，保证field和attribute分离（完整替换）
  function formatFacets(facetsData) {
    if (!facetsData || !Array.isArray(facetsData)) return [];
    const formattedFacets = [];

    function getSelectedValuesForField(field) {
      const filter = filters.find(f => f.field === field);
      return filter ? filter.values.map(v => String(v)) : [];
    }

    for (const facet of facetsData) {
      // 这里的 attribute 来自聚合键（如 'Year'），field 为真实 ES 字段（如 'Paper_Basic.Year'）
      const originalAttribute = facet.attribute;
      const { field, type, values } = facet;
      if (!values || values.length === 0) continue;

      // 将 UI 层的"年份"attribute 改为 'Paper_Basic.Year'，从而走 Facets.svelte 的"非 Year 分支"，出现"显示更多…"
      const uiAttribute = originalAttribute === 'Year' ? 'Paper_Basic.Year' : originalAttribute;

      // 排序：年份数字降序；其他字符串按计数降序
      let sortedValues = [...values];
      const isUiYear = uiAttribute === 'Paper_Basic.Year' || originalAttribute === 'Year';
      if (type === 'numeric' && isUiYear) {
        sortedValues.sort((a, b) => parseInt(b.value, 10) - parseInt(a.value, 10));
      } else if (type === 'string') {
        sortedValues.sort((a, b) => b.count - a.count);
      }

      // 保证选中项始终可见
      const selectedValues = getSelectedValuesForField(field);
      const currentValues = new Set(sortedValues.map(item => String(item.value)));
      for (const selectedValue of selectedValues) {
        if (!currentValues.has(selectedValue)) {
          sortedValues.push({ value: selectedValue, count: 0, selected: true });
        }
      }

      formattedFacets.push({
        attribute: uiAttribute,     // 用于 Facets 的展示与分支判断（年份走"非 Year 分支"）
        field,                      // 用于 filter 的真实字段
        type,
        values: sortedValues,
        // 默认展开：加入 'Paper_Basic.Year' 以保持年份展开
        isExpanded: ['DocType', 'Year', 'Paper_Basic.Year', 'CitationCount', 'Publisher'].includes(uiAttribute),
        // 非 Year 分支会依据 showAllItems 决定是否切片到 20 并显示"显示更多…"
        showAllItems: sortedValues.length <= 20
      });
    }
    return formattedFacets;
  }
  
  // 构建Elasticsearch查询（完整替换）
  function buildElasticsearchQuery() {
    // 从配置拆分 根字段 与 嵌套(作者)字段，并保留权重
    const searchAttrs = config.search_settings.search_attributes;
    const rootSearchFields = [];
    const nestedSearchFields = [];

    for (const f of searchAttrs) {
      const fieldName = typeof f === 'string' ? f : f.field;
      const weighted = typeof f === 'string' ? f : `${f.field}^${f.weight}`;
      if (fieldName && fieldName.startsWith('Author_List.')) {
        nestedSearchFields.push(weighted);
      } else {
        rootSearchFields.push(weighted);
      }
    }

    // 额外控制：标题字段单独短语匹配高权重；从常规根字段中移除
    const titleField = 'Paper_Details.PaperTitle';
    const rootFieldsNoTitle = rootSearchFields.filter((f) => f.split('^')[0] !== titleField);

    console.log("构建查询 - 根字段(无标题):", rootFieldsNoTitle);
    console.log("构建查询 - 作者(嵌套)字段:", nestedSearchFields);
    console.log("构建查询 - 过滤器:", filters);

    // 基础查询骨架（结果查询加速项：关闭精确总数 + 限制返回字段）
    const query = {
      size: resultsPerPage,
      from: (currentPage - 1) * resultsPerPage,
      track_total_hits: true,
      _source: { includes: config.search_settings.result_attributes },
      query: {
        bool: {
          must: searchTerm
            ? {
                // 当有搜索词时，根字段multi_match、作者嵌套查询和标题短语匹配中，应至少命中一个
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
      sort: []
    };

    // 关键词检索策略：作者全名 > 作者/机构 > 标题短语 > 其他字段
    if (searchTerm) {
      // 作者全名强匹配（最高权重）
      query.query.bool.must.bool.should.push({
        nested: {
          path: 'Author_List',
          score_mode: 'max',
          ignore_unmapped: true,
          query: {
            match_phrase: {
              'Author_List.Author_Details.Author_Name': {
                query: searchTerm,
                boost: 8
              }
            }
          }
        }
      });

      // 作者/机构严格包含（AND）
      query.query.bool.must.bool.should.push({
        nested: {
          path: 'Author_List',
          score_mode: 'max',
          ignore_unmapped: true,
          query: {
            multi_match: {
              query: searchTerm,
              fields: [
                'Author_List.Author_Details.Author_Name^3',
                'Author_List.Affiliation_Details.Affiliation_Name^2.5'
              ],
              type: 'best_fields',
              operator: 'and',
              boost: 4
            }
          }
        }
      });

      // 标题短语匹配
      query.query.bool.must.bool.should.push({
        match_phrase: {
          [titleField]: {
            query: searchTerm,
            boost: 3
          }
        }
      });

      // 其他根字段（去掉标题，AND）
      if (rootFieldsNoTitle.length > 0) {
        query.query.bool.must.bool.should.push({
          multi_match: {
            query: searchTerm,
            fields: rootFieldsNoTitle,
            type: 'best_fields',
            operator: 'and',
            boost: 1.2
          }
        });
      }
    }

    // 修改默认"近5年"过滤逻辑
    const hasYearFilter = filters.some(f => f.field === 'Paper_Basic.Year' || f.field === 'Year');
    const isInitialLoad = !searchTerm; // 判断是否为首屏加载(无搜索词)
    
    // 仅在首屏加载且用户未选择年份时添加"近5年"过滤
    if (!hasYearFilter && isInitialLoad) {
      const thisYear = new Date().getFullYear();
      query.query.bool.filter.push({ range: { 'Paper_Basic.Year': { gte: thisYear - 4 } } });
    }

    // 添加过滤条件到主查询（保留你现有逻辑）
    if (filters.length > 0) {
      filters.forEach(filter => {
        const fieldName = filter.field;

        // 查找对应的 facet 配置，以确定类型
        const facetConfig = config.search_settings.facet_attributes.find(
          (facet) => facet.attribute === filter.field || facet.field.includes(filter.field)
        );

        if (!fieldName || filter.values.length === 0) return;

        if (facetConfig?.type === 'range') {
          const selectedRanges = filter.values;
          if (facetConfig.ranges) {
            const rangeFilters = selectedRanges.map(rangeName => {
              const range = facetConfig.ranges.find(r => r.name === rangeName);
              if (range) {
                const rangeFilter = { range: { [fieldName]: {} } };
                if (range.from !== null) rangeFilter.range[fieldName].gte = range.from;
                if (range.to !== null) rangeFilter.range[fieldName].lt = range.to;
                return rangeFilter;
              }
              return null;
            }).filter(Boolean);

            if (rangeFilters.length > 0) {
              query.query.bool.filter.push({
                bool: { should: rangeFilters, minimum_should_match: 1 }
              });
            }
          }
        } else if (fieldName.includes('.') && fieldName.includes('Author_List')) {
          // 嵌套路径查询（作者字段）
          const nestedPath = fieldName.split('.')[0];
          query.query.bool.filter.push({
            nested: {
              path: nestedPath,
              query: {
                terms: {
                  [fieldName]: filter.values
                }
              }
            }
          });
        } else if (facetConfig?.type === 'numeric' || !isNaN(Number(filter.values[0]))) {
          const numericValues = filter.values.map((v) => Number(v));
          query.query.bool.filter.push({
            terms: {
              [fieldName]: numericValues
            }
          });
        } else {
          query.query.bool.filter.push({
            terms: {
             [fieldName]: filter.values
            }
          });
        }
      });
    }

    // 构建 facets 的 allFacetAggs（供后台 loadFacets 使用）
    const allFacetAggs = {};
    const facetConfigs = config.search_settings.facet_attributes;
    if (facetConfigs) {
      facetConfigs.forEach(facetConfig => {
        const { attribute, field, type, ranges } = facetConfig;

        const otherFilters = filters
          .filter(f => f.field !== attribute && f.field !== field.replace(/\.keyword$/, ''))
          .map(filter => {
            const filterField = filter.field;
            const filterFacet = facetConfigs.find(fc =>
              fc.attribute === filterField || fc.field.includes(filterField)
            );
            if (!filterFacet) return null;

            if (filterFacet.type === 'range') {
              const selectedRanges = filter.values;
              if (filterFacet.ranges) {
                const rangeFilters = selectedRanges.map(rangeName => {
                  const range = filterFacet.ranges.find(r => r.name === rangeName);
                  if (range) {
                    const rangeFilter = { range: { [filterField]: {} } };
                    if (range.from !== null) rangeFilter.range[filterField].gte = range.from;
                    if (range.to !== null) rangeFilter.range[filterField].lt = range.to;
                    return rangeFilter;
                  }
                  return null;
                }).filter(Boolean);

                if (rangeFilters.length > 0) {
                  return {
                    bool: { should: rangeFilters, minimum_should_match: 1 }
                  };
                }
              }
            } else if (filterField.includes('.') && filterField.includes('Author_List')) {
              const nestedPath = filterField.split('.')[0];
              return {
                nested: {
                  path: nestedPath,
                  query: {
                    terms: {
                      [filterField]: filter.values
                    }
                  }
                }
              };
            } else if (filterFacet.type === 'numeric' || !isNaN(Number(filter.values[0]))) {
              const numericValues = filter.values.map((v) => Number(v));
              return {
                terms: {
                  [filterField]: numericValues
                }
              };
            } else {
              return {
                terms: {
                 [filterField]: filter.values
                }
              };
            }
          })
          .filter(Boolean);

        if (type === 'string') {
          allFacetAggs[attribute] = {
            filter: { bool: { filter: otherFilters } },
            aggs: {
              [`${attribute}_terms`]: {
                terms: { field: field, size: 100 }
              }
            }
          };
        } else if (type === 'numeric') {
          allFacetAggs[attribute] = {
            filter: { bool: { filter: otherFilters } },
            aggs: {
              [`${attribute}_terms`]: {
                terms: {
                  field: field,
                  size: attribute === 'Year' ? 200 : 50,
                  order: attribute === 'Year' ? { "_key": "desc" } : { "_count": "desc" }
                }
              }
            }
          };
        } else if (type === 'range' && ranges) {
          allFacetAggs[attribute] = {
            filter: { bool: { filter: otherFilters } },
            aggs: {
              [`${attribute}_range`]: {
                range: {
                  field: field,
                  ranges: ranges.map(range => ({
                    from: range.from !== null ? range.from : undefined,
                    to: range.to !== null ? range.to : undefined,
                    key: range.name
                  }))
                }
              }
            }
          };
        }
      });
    }

    // 仅供后台 facets 请求使用（结果查询会在发送前 delete 掉）
    query.aggs = {
      all_facets: {
        global: {},
        aggs: allFacetAggs
      }
    };

    // 添加排序：默认相关度，但始终尊重用户选择
    if (sorting && sorting.length > 0) {
      // 用户选择的排序方式
      query.sort = sorting.map(sort => ({
        [sort.field]: { order: sort.direction }
      }));
      
      // 如果用户选择的不是"相关度"排序且有搜索词，可以添加次要排序_score
      const isRelevanceSort = sorting.length === 0; // 相关度排序的特征是空数组
      if (!isRelevanceSort && searchTerm) {
        // 将相关度作为次要排序因素
        query.sort.push({ _score: { order: "desc" } });
      }
    } else if (searchTerm) {
      // 默认情况：有搜索词且用户未选择排序方式，使用相关度排序
      query.sort = [
        { _score: { order: 'desc' } },
        { 'Paper_Basic.Year': { order: 'desc' } }
      ];
    } else {
      // 无搜索词且无排序选择：默认按最新发表排序
      query.sort = [{ 'Paper_Basic.Year': { order: 'desc' } }];
    }

    return query;
  }
  
  // 处理搜索框的提交
  function handleSearchSubmit(event) {
    console.log("搜索提交:", event.detail);
    const previousTerm = searchTerm;
    searchTerm = event.detail?.value || "";

    if (previousTerm !== searchTerm) {
      resultsCache.clear();
    }

    currentPage = 1;
    performSearch();
    
    // 保存搜索状态
    saveSearchState();
  }
  
  // 处理搜索框的变化
  function handleSearchChange(event) {
    console.log("搜索框变化:", event.detail);
    searchTerm = event.detail?.value || "";
    console.log("当前搜索词:", searchTerm);
  }
  
  // 处理过滤器变化，始终用field
  function handleFilterChange(newFilters) {
    filters = newFilters.map(filter => {
      // 直接用field，不做任何转换
      return { ...filter, field: filter.field };
    });
    
    currentPage = 1;
    performSearch();
    
    // 保存搜索状态
    saveSearchState();
  }
  
  // 处理结果点击
  function handleResultClick(event) {
    const result = event.detail?.result;
    console.log("结果点击:", result);
    dispatch('resultClick', { result });
  }
  
  // 处理生成报告
  function handleGenerateReport(event) {
    console.log("生成报告事件:", event.detail);
    dispatch('generateReport', event.detail);
  }
  
  // 处理分析机构
  function handleAnalyzeInstitution(event) {
    console.log("分析机构事件:", event.detail);
    dispatch('analyzeInstitution', event.detail);
  }
  
  // 处理分析作者
  function handleAnalyzeAuthor(event) {
    console.log("分析作者事件:", event.detail);
    dispatch('analyzeAuthor', event.detail);
  }
  
  // 处理排序变化
  function handleSortChange(event) {
    const target = /** @type {HTMLSelectElement} */ (event.target);
    console.log("排序变化:", target.value);
    const sortOption = SORT_OPTIONS.find(option => option.name === target.value);
    if (sortOption) {
      sorting = sortOption.value;
      performSearch();
      
      // 保存搜索状态
      saveSearchState();
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

  // 处理加载更多
  function loadMore() {
    if (hasMoreResults && !isLoadingMore) {
      currentPage++;
      performSearch(true); // 追加模式
    }
  }

  // 初始化交叉观察器
  function initializeObserver() {
    if ('IntersectionObserver' in window) {
      loadMoreObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMoreResults && !isLoadingMore && !loading) {
          loadMore();
        }
      }, { threshold: 0.5 });
    }
  }

  // 添加观察目标的函数
  function setLoadMoreTarget(node) {
    if (loadMoreObserver && node) {
      loadMoreObserver.observe(node);
      return {
        destroy() {
          loadMoreObserver.unobserve(node);
        }
      };
    }
  }

  // 3. 添加单独加载facets的函数（再次完整替换）
  async function loadFacets() {
    if (facetsLoaded || facetsLoading) return;
    facetsLoading = true;
    console.log("开始后台加载facets...");

    try {
      // 1) 取当前构建的 query 与 aggs
      const built = buildElasticsearchQuery();

      // 2) 只抽取"过滤条件"（近5年 + 已选筛选），不要全文 should
      const onlyFilter = Array.isArray(built?.query?.bool?.filter)
        ? built.query.bool.filter
        : [];

      // 2.1) Year 需忽略"近5年"默认范围
      const yearlessFilters = onlyFilter.filter(f => {
        if (!f || !f.range) return true;
        return !(f.range['Paper_Basic.Year'] || f.range['Year']);
      });

      // 3) 为每个 facet 合成独立的 filter（Year 用 yearlessFilters，其它用 onlyFilter）
      const rawAggs = built.aggs?.all_facets?.aggs || {};
      const perFacetAggs = {};
      for (const [attr, def] of Object.entries(rawAggs)) {
        const defFilters = def?.filter?.bool?.filter || [];
        const baseFilters = (attr === 'Year' || attr === 'Paper_Basic.Year') ? yearlessFilters : onlyFilter;
        perFacetAggs[attr] = {
          filter: { bool: { filter: [...baseFilters, ...defFilters] } },
          aggs: def?.aggs || {}
        };
      }

      // 4) 顶层不再套全局/统一 filter
      const facetsQuery = {
        size: 0,
        track_total_hits: false,
        query: { match_all: {} },
        aggs: {
          all_facets: {
            global: {},
            aggs: perFacetAggs
          }
        }
      };

      // 5) 带缓存
      const searchUrl = `${API_HOST}/${API_INDEX}/_search?request_cache=true`;

      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(facetsQuery)
      });
      if (!response.ok) throw new Error(`Facets加载失败: ${response.status}`);

      const data = await response.json();
      const rawFacets = processAggregations(data.aggregations);
      facets = formatFacets(rawFacets);
      facetsLoaded = true;
      console.log("Facets加载完成");
    } catch (err) {
      console.error("Facets加载错误:", err);
    } finally {
      facetsLoading = false;
    }
  }

  // 5. 修改结果渲染，实现虚拟列表
  function limitResultsForDisplay(results) {
    // 只返回视窗可见的结果数量
    const visibleResults = results.slice(0, Math.min(30, results.length));
    return visibleResults;
  }

  // 扩展saveSearchState函数，保存滚动位置
  function saveSearchState() {
    try {
      // 获取滚动容器的滚动位置
      const scrollTop = resultsContainer?.scrollTop || lastKnownScrollPosition || 0;
      
      const state = {
        searchTerm,
        filters,
        currentPage,
        sorting,
        hasSearched: searchExecuted,
        scrollPosition: scrollTop // 保存滚动位置
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      console.log('已保存搜索状态，滚动位置:', scrollTop);
    } catch (err) {
      console.error('保存搜索状态失败:', err);
    }
  }

  // 添加恢复滚动位置的函数
  function restoreScrollPosition(position) {
    console.log('开始恢复滚动位置:', position);
    
    // 使用递归方式多次尝试
    function attemptRestore(attempts = 0) {
      if (attempts > 15) return; // 最多尝试15次
      
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
      }, 150 * (attempts + 1)); // 逐渐增加延迟
    }
    
    // 开始尝试恢复
    attemptRestore();
  }

  // 在这些函数的末尾调用 saveSearchState():
  // - handleSearchSubmit
  // - handleFilterChange 
  // - handleSortChange
  // - handlePageChange

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
</script>

<div class={`sui-layout ${darkMode ? 'sui-search--dark' : ''}`} style="height: 100%; overflow-y: auto; display: flex; flex-direction: column;">
  <div class="sui-layout-header" style="flex-shrink: 0; padding: 10px; border-bottom: 1px solid var(--sui-border-color); background-color: var(--sui-background-color);">
    <SearchBox 
      initialValue={searchTerm}
      on:submit={handleSearchSubmit}
      on:change={handleSearchChange}
      searchAsYouType={false}
      placeholder="搜索论文标题、摘要、作者、机构..."
      class="sui-search-box"
    />
  </div>
  
  <div class="sui-layout-body" style="flex-grow: 1; overflow: hidden; display: flex;">
    <div class="sui-layout-body__inner" style="width: 100%; display: flex; overflow: hidden;">
      <!-- 左侧边栏的facets区域 -->
      <div class="sui-layout-sidebar" style="width: 250px; padding: 15px; border-right: 1px solid var(--sui-border-color); overflow-y: auto; flex-shrink: 0;">
        {#if searchExecuted}
          <div class="sui-sorting">
            <label for="sort-select" class="sui-sorting__label">排序方式:</label>
            <select 
              id="sort-select" 
              class="sui-results-per-page__select"
              value={SORT_OPTIONS.find(opt => JSON.stringify(opt.value) === JSON.stringify(sorting))?.name}
              on:change={handleSortChange}
            >
              {#each SORT_OPTIONS as option}
                <option value={option.name}>{option.name}</option>
              {/each}
            </select>
          </div>
        {/if}
        
        {#if facetsLoading && !facetsLoaded}
          <div class="sui-facets-loading">
            <div class="sui-loading__loader sui-loading__loader--small"></div>
            <div class="sui-loading__message sui-loading__message--small">加载筛选条件...</div>
          </div>
        {/if}
        
        <Facets 
          {facets}
          {filters}
          on:filterChange={(event) => handleFilterChange(event.detail)}
        />
      </div>
      
      <div class="sui-layout-main" style="flex-grow: 1; overflow: hidden; display: flex; flex-direction: column;">
        <div class="sui-layout-main-header" style="padding: 15px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;">
          {#if searchExecuted}
          <div class="sui-results-summary">
            <div class="sui-paging-info">
                显示 {results.length > 0 ? ((currentPage - 1) * resultsPerPage) + 1 : 0} - {results.length > 0 ? ((currentPage - 1) * resultsPerPage) + results.length : 0} 条
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
        <div class="sui-layout-main-body" bind:this={resultsContainer}>
          {#if loading}
            <div class="sui-loading">
              <div class="sui-loading__loader"></div>
              <div class="sui-loading__message">正在搜索...</div>
            </div>
          {:else if error}
            <div class="sui-search-error">
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>搜索错误: {error}</p>
                <button 
                  class="sui-search-error__retry-button"
                  on:click={performSearch}
                >
                  重试
                </button>
              </div>
            </div>
          {:else if !searchExecuted}
            <div class="sui-results__empty">
              <div class="sui-loading">
                <div class="sui-loading__loader"></div>
                <div class="sui-loading__message">正在搜索...</div>
              </div>
            </div>
          {:else}
            <SearchResults 
              results={results}
              titleField="PaperTitle"
              urlField="DOI"
              on:resultClick={handleResultClick}
              on:generateReport={handleGenerateReport}
              on:analyzeInstitution={handleAnalyzeInstitution}
              on:analyzeAuthor={handleAnalyzeAuthor}
            />
            
            {#if results.length > 0}
              <div class="sui-paging">
                <ul class="sui-pagination">
                  <!-- 上一页按钮 -->
                  <li class="sui-pagination__item" class:disabled={currentPage === 1}>
                    <button 
                      class="sui-pagination__link"
                      disabled={currentPage === 1}
                      on:click|stopPropagation={() => handlePageChange(currentPage - 1)}
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
                        <button class="sui-pagination__link" on:click|stopPropagation={() => handlePageChange(1)}>1</button>
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
                        <button class="sui-pagination__link" on:click|stopPropagation={() => handlePageChange(totalPages)}>
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
                      on:click|stopPropagation={() => handlePageChange(currentPage + 1)}
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
  
  .sui-sorting {
    margin-bottom: 20px;
  }
  
  .sui-sorting__label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sui-text-color);
  }
  
  .sui-results-display-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 1rem;
    padding: 0 1rem;
    width: 100%;
  }
  
  .sui-results-summary {
    flex: 1;
  }
  
  .sui-results-per-page {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .sui-results-per-page__label {
    margin-right: 0.5rem;
    font-size: 0.875rem;
    color: var(--sui-text-color);
  }
  
  .sui-select--small {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--sui-border-color);
    background-color: var(--sui-background-color);
    color: var(--sui-text-color);
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
  
  @keyframes sui-loading {
    to { transform: rotate(360deg); }
  }
  
  .sui-loading__message {
    font-size: 16px;
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

  .sui-search-error {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: #ef4444;
    text-align: center;
  }
  
  .sui-search-error svg {
    margin: 0 auto 1rem;
    display: block;
  }
  
  .sui-search-error p {
    margin-bottom: 1rem;
  }
  
  .sui-search-error__retry-button {
    background-color: #3a56e4;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .sui-search-error__retry-button:hover {
    background-color: #2a46d4;
  }
  
  :global(.sui-search-box) {
    width: 100%;
  }
  
  :global(.sui-search-box input) {
    width: 100%;
    padding: 8px 12px;
    font-size: 14px;
    border-radius: 4px;
    border: 1px solid var(--sui-border-color);
    background-color: var(--sui-background-color);
    color: var(--sui-text-color);
  }
  
  :global(.sui-search-box button) {
    padding: 6px 12px;
    background-color: #3a56e4;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  /* 修改容器样式从相对定位为网格布局 */
  .sui-search-box__container {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.25rem;
  }

  /* 修改输入框样式 */
  .sui-search-box__text-input {
    width: 100%;
    padding: 0.5rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.25rem;
    background-color: white;
    color: #000;
  }

  /* 修改按钮样式为标准蓝色按钮 */
  .sui-search-box__submit {
    padding: 0.5rem 1rem;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.3rem;
    cursor: pointer;
    position: static; /* 移除绝对定位 */
  }

  .sui-search-box__submit:hover {
    background-color: #2563eb;
  }

  .sui-load-more {
    display: flex;
    justify-content: center;
    padding: 1rem;
    margin-top: 1rem;
    border-top: 1px solid var(--sui-border-color);
  }
  
  .sui-load-more__button {
    background-color: #3a56e4;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .sui-load-more__button:hover {
    background-color: #2a46d4;
  }
  
  .sui-load-more__button:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }

  .sui-facets-loading {
    padding: 15px;
    text-align: center;
  }
  
  .sui-loading__loader--small {
    width: 20px;
    height: 20px;
    margin-bottom: 8px;
  }
  
  .sui-loading__message--small {
    font-size: 12px;
  }

  .sui-pagination__ellipsis {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    color: var(--sui-text-color);
    font-size: 14px;
  }
</style> 