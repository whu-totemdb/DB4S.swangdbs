<script>
  import { createEventDispatcher } from 'svelte';
  import { facetLabels } from './index';
  
  export let facets = [];
  export let filters = [];
  export let elasticsearch = null; // Elasticsearch客户端实例
  export let index = ''; // 索引名称
  
  const dispatch = createEventDispatcher();
  
  // 搜索状态
  let searchQueries = {};
  let searchResults = {};
  let searchLoading = {};
  let expandedFacets = {};
  let yearMultiSelectMode = true; // 年份多选模式
  let selectionModes = {}; // 各筛选条件的选择模式（多选或单选）
  
  // 获取facet的显示名称
  function getFacetLabel(attribute) {
    const labels = facetLabels;
    if (labels[attribute]) return labels[attribute];
    return attribute;
  }
  
  // 初始化展开状态和选择模式
  function initExpandedState() {
    if (facets && Array.isArray(facets)) {
      facets.forEach(facet => {
        expandedFacets[facet.field] = ['DocType', 'Year', 'Paper_Basic.Year', 'CitationCount', 'Publisher'].includes(facet.attribute);
        selectionModes[facet.field] = true;
      });
    }
  }
  
  // 组件挂载后初始化展开状态
  $: if (hasFacets && Object.keys(expandedFacets).length === 0) {
    initExpandedState();
  }
  
  // 切换选择模式（多选/单选）
  function toggleSelectionMode(facetField) {
    selectionModes[facetField] = !selectionModes[facetField];
    
    // 如果切换到单选模式且已选择了多个值，则只保留第一个
    if (!selectionModes[facetField]) {
      const existingFilter = filters.find(f => f.field === facetField);
      if (existingFilter && existingFilter.values.length > 1) {
        const newFilters = filters.map(f => {
          if (f.field === facetField) {
            return {
              ...f,
              values: [f.values[0]]
            };
          }
          return f;
        });
        dispatch('filterChange', newFilters);
      }
    }
  }
  
  // 处理facet值选择
  function handleFacetValueSelect(facetField, value) {
    const facetItem = facets.find(f => f.field === facetField);
    if (!facetItem) return;
    const actualField = facetField;
    const existingFilterIndex = filters.findIndex(f => f.field === actualField);
    let newFilters;
    if (existingFilterIndex >= 0) {
      const existingFilter = filters[existingFilterIndex];
      const valueExists = existingFilter.values.includes(value);
      if (valueExists) {
        const newValues = existingFilter.values.filter(v => v !== value);
        if (newValues.length === 0) {
          newFilters = filters.filter((_, i) => i !== existingFilterIndex);
        } else {
          newFilters = [...filters];
          newFilters[existingFilterIndex] = { ...existingFilter, values: newValues };
        }
      } else {
        newFilters = [...filters];
        newFilters[existingFilterIndex] = { ...existingFilter, values: [...existingFilter.values, value] };
      }
    } else {
      newFilters = [...filters, { field: actualField, values: [value], type: "any" }];
    }
    dispatch('filterChange', newFilters);
  }
  
  // 检查值是否已选中
  function isValueSelected(facetField, value) {
    const facetFilter = filters.find(f => f.field === facetField);
    return facetFilter ? facetFilter.values.includes(value) : false;
  }
  
  // 切换facet的展开状态
  function toggleFacet(facetField) {
    expandedFacets[facetField] = !expandedFacets[facetField];
  }
  
  // 格式化facet值显示
  function formatFacetValue(facetField, value, item) {
    if (facetField === 'Year') {
      return `${value}年`;
    }
    
    if (facetField === 'CitationCount') {
      if (item && (item.from !== undefined || item.to !== undefined)) {
        if (item.from === null) {
          return `< ${item.to}`;
        } else if (item.to === null) {
          return `${item.from}+`;
        } else {
          return value.toString();
        }
      }
      return `${value}次`;
    }
    
    return String(value);
  }
  
  // 确认是否有facets数据
  $: hasFacets = facets && Array.isArray(facets) && facets.length > 0;
  
  // 获取特定facet的值
  function getFacetValues(facet) {
    return facet.values || [];
  }
  
  // 在每次 facets 更新时记录到控制台
  $: if (facets && Array.isArray(facets)) {
    console.log("Facets 组件收到的 facets 数据:", facets);
  }
  
  // Elasticsearch字段搜索
  async function searchFacetValues(facetName, searchQuery) {
    if (!elasticsearch || !index) return;
    
    searchQueries[facetName] = searchQuery;
    searchLoading[facetName] = true;
    
    try {
      // 构建搜索请求
      const searchRequest = {
        index: index,
        body: {
          size: 0,
          aggs: {
            facet_values: {
              terms: {
                field: facetName,
                include: `.*${searchQuery}.*`,
                size: 50
              }
            }
          }
        }
      };
      
      const response = await elasticsearch.search(searchRequest);
      
      // 解析结果
      const buckets = response.aggregations?.facet_values?.buckets || [];
      searchResults[facetName] = buckets.map((bucket) => ({
        value: bucket.key,
        count: bucket.doc_count
      }));
    } catch (error) {
      console.error('搜索Facet值失败:', error);
      searchResults[facetName] = [];
    } finally {
      searchLoading[facetName] = false;
    }
  }
  
  function handleSearchInput(event, facetName) {
    const target = /** @type {HTMLInputElement} */ (event.target);
    const searchValue = target?.value || "";
    
    if (searchValue.length >= 1) {
      searchFacetValues(facetName, searchValue);
    } else {
      // 清空搜索结果，显示原始facet值
      searchResults[facetName] = null;
    }
  }
</script>

{#if hasFacets}
  <div class="sui-facets">
    <h3 class="sui-facets__title">论文筛选</h3>
    
    <!-- 已选择的过滤器 -->
    {#if filters.length > 0}
      <div class="sui-facets__selected">
        <div class="sui-facets__selected-title">已选择:</div>
        <div class="sui-facets__selected-items">
          {#each filters as filter}
            {#each filter.values as value}
              <span class="sui-facets__selected-item">
                {getFacetLabel(facets.find(f=>f.field===filter.field)?.attribute || filter.field)}: {formatFacetValue(filter.field, value)}
                <button 
                  class="sui-facets__remove-button"
                  on:click={() => handleFacetValueSelect(filter.field, value)}
                >
                  ×
                </button>
              </span>
            {/each}
          {/each}
        </div>
        {#if filters.length > 0}
          <button 
            class="sui-facets__clear-button"
            on:click={() => dispatch('filterChange', [])}
          >
            清除全部
          </button>
        {/if}
      </div>
    {/if}
    
    <!-- 分类筛选器 -->
    {#each facets as facet}
      {@const facetName = facet.field}
      <div class="sui-facet">
        <button 
          class="sui-facet__title-button"
          on:click={() => toggleFacet(facetName)}
        >
          <div class="sui-facet__title">
            {getFacetLabel(facet.attribute)}
            <span class="sui-facet__count">({getFacetValues(facet).length || 0})</span>
            <span class="sui-facet__mode-indicator">
              {selectionModes[facetName] ? "多选" : "单选"}
            </span>
          </div>
          <span class="sui-facet__arrow {expandedFacets[facetName] ? 'sui-facet__arrow--open' : ''}">
            ▼
          </span>
        </button>
        
        {#if expandedFacets[facetName]}
          <!-- 只有在展开状态才显示内容 -->
          {#if getFacetValues(facet).length > 10 && facet.attribute !== 'Year'}
            <!-- 添加搜索框（除了Year字段外） -->
            <div class="sui-facet__search">
              <input 
                class="sui-facet__search-input" 
                type="search" 
                placeholder="搜索{getFacetLabel(facet.attribute)}..."
                on:input={(e) => handleSearchInput(e, facetName)}
                value={searchQueries[facetName] || ''}
              />
            </div>
          {/if}
          
          <!-- 添加清除选择按钮 -->
          {#if filters.some(f => f.field === facetName)}
            <div class="sui-facet__actions">
              <button
                class="sui-facet__clear-year-button"
                on:click={() => {
                  const newFilters = filters.filter(f => f.field !== facetName);
                  dispatch('filterChange', newFilters);
                }}
              >
                清除{getFacetLabel(facet.attribute)}选择
              </button>
            </div>
          {/if}
          
          <div class="sui-facet__content">
            <ul class="sui-facet__list">
              {#if searchLoading[facetName]}
                <li class="sui-facet__loading">
                  <div class="sui-facet__loading-spinner"></div>
                  <div>正在搜索...</div>
                </li>
              {:else if searchResults[facetName]}
                <!-- 显示搜索结果 -->
                {#if searchResults[facetName].length > 0}
                  {#each searchResults[facetName] as valueItem}
                    {@const isSelected = isValueSelected(facetName, valueItem.value)}
                    <li class="sui-facet__item">
                      <label class="sui-facet__item-label {isSelected ? 'sui-facet__item-label--selected' : ''}">
                        <input 
                          type="checkbox" 
                          class="sui-facet__checkbox"
                          checked={isSelected}
                          on:change={() => handleFacetValueSelect(facetName, valueItem.value)}
                        />
                        <span class="sui-facet__item-value">{formatFacetValue(facetName, valueItem.value, valueItem)}</span>
                        <span class="sui-facet__item-count">
                          {valueItem.count}
                        </span>
                      </label>
                    </li>
                  {/each}
                {:else}
                  <li class="sui-facet__empty">
                    没有找到匹配的选项
                  </li>
                {/if}
              <!-- 显示原始facet数据 -->
              {:else if getFacetValues(facet).length > 0}
                {#if facet.attribute === 'Year'}
                  <!-- 年份过滤器特殊处理 -->
                  {#each getFacetValues(facet) as valueItem}
                    {@const isSelected = isValueSelected(facetName, valueItem.value)}
                    <li class="sui-facet__item">
                      <label class="sui-facet__item-label {isSelected ? 'sui-facet__item-label--selected' : ''}" 
                             class:sui-facet__item-label--disabled={valueItem.count === 0 && !isSelected}>
                        <input 
                          type="checkbox" 
                          class="sui-facet__checkbox"
                          checked={isSelected}
                          on:change={() => handleFacetValueSelect(facetName, valueItem.value)}
                          disabled={valueItem.count === 0 && !isSelected}
                        />
                        <span class="sui-facet__item-value">{formatFacetValue(facetName, valueItem.value, valueItem)}</span>
                        <span class="sui-facet__item-count">
                          {valueItem.count}
                        </span>
                      </label>
                    </li>
                  {/each}
                {:else}
                  <!-- 所有其他过滤器统一处理，与CitationCount保持一致 -->
                 {#each getFacetValues(facet).slice(0, facet.limit || 5) as valueItem}
                    {@const isSelected = isValueSelected(facetName, valueItem.value)}
                    <li class="sui-facet__item">
                      <label class="sui-facet__item-label {isSelected ? 'sui-facet__item-label--selected' : ''}"
                             class:sui-facet__item-label--disabled={valueItem.disabled && !isSelected}>
                        <input 
                          type="checkbox" 
                          class="sui-facet__checkbox"
                          checked={isSelected}
                          on:change={() => handleFacetValueSelect(facetName, valueItem.value)}
                          disabled={valueItem.disabled && !isSelected}
                        />
                        <span class="sui-facet__item-value">{formatFacetValue(facetName, valueItem.value, valueItem)}</span>
                        <span class="sui-facet__item-count">
                          {valueItem.count}
                        </span>
                      </label>
                    </li>
                  {/each}
                 
                 {#if getFacetValues(facet).length > (facet.limit || 5)}
                    <li class="sui-facet__show-more">
                      <button 
                        class="sui-facet__show-more-button"
                       on:click={() => {
                         facet.limit = (facet.limit || 5) + 5;
                       }}
                      >
                        显示更多...
                      </button>
                    </li>
                  {/if}
                {/if}
              {:else}
                <li class="sui-facet__empty">
                  没有可用选项
                </li>
              {/if}
            </ul>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .sui-facets {
    margin-bottom: 1.5rem;
  }
  
  .sui-facets__title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #1f2937;
  }
  
  .sui-facets__selected {
    background-color: #f3f4f6;
    border-radius: 0.375rem;
    padding: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .sui-facets__selected-title {
    font-weight: 600;
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
    color: #4b5563;
  }
  
  .sui-facets__selected-items {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .sui-facets__selected-item {
    display: inline-flex;
    align-items: center;
    background-color: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
  
  .sui-facets__remove-button {
    margin-left: 0.5rem;
    font-weight: bold;
    color: #6b7280;
    border: none;
    background: none;
    cursor: pointer;
    padding: 0 0.25rem;
  }
  
  .sui-facets__remove-button:hover {
    color: #ef4444;
  }
  
  .sui-facets__clear-button {
    background: none;
    border: none;
    color: #3a56e4;
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  
  .sui-facets__clear-button:hover {
    color: #2a46d4;
  }
  
  .sui-facet {
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .sui-facet:last-child {
    border-bottom: none;
  }
  
  .sui-facet__title-button {
    display: flex;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: none;
    padding: 0.5rem 0;
    cursor: pointer;
    text-align: left;
  }
  
  .sui-facet__title {
    font-weight: 600;
    font-size: 0.875rem;
    color: #1f2937;
    display: flex;
    align-items: center;
  }
  
  .sui-facet__count {
    color: #6b7280;
    font-weight: normal;
    margin-left: 0.5rem;
    font-size: 0.75rem;
  }
  
  .sui-facet__arrow {
    color: #9ca3af;
    font-size: 0.75rem;
    transition: transform 0.2s ease;
  }
  
  .sui-facet__arrow--open {
    transform: rotate(180deg);
  }
  
  .sui-facet__content {
    margin-top: 0.5rem;
  }
  
  .sui-facet__search {
    margin-bottom: 0.75rem;
  }
  
  .sui-facet__search-input {
    width: 100%;
    padding: 0.375rem 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.25rem;
    font-size: 0.75rem;
  }
  
  .sui-facet__list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .sui-facet__item {
    margin-bottom: 0.25rem;
  }
  
  .sui-facet__item:last-child {
    margin-bottom: 0;
  }
  
  .sui-facet__item-label {
    display: flex;
    align-items: center;
    padding: 0.375rem 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .sui-facet__item-label:hover {
    background-color: #f3f4f6;
  }
  
  .sui-facet__item-label--selected {
    background-color: #ebf5ff;
    color: #2563eb;
  }
  
  .sui-facet__checkbox {
    margin-right: 0.5rem;
    width: 1rem;
    height: 1rem;
    border-radius: 0.25rem;
    border: 1px solid #d1d5db;
    cursor: pointer;
  }
  
  .sui-facet__checkbox:checked {
    background-color: #2563eb;
    border-color: #2563eb;
  }
  
  .sui-facet__item-value {
    flex: 1;
    font-size: 0.875rem;
  }
  
  .sui-facet__item-count {
    font-size: 0.75rem;
    color: #6b7280;
    margin-left: 0.5rem;
  }
  
  .sui-facet__loading {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    color: #6b7280;
    font-size: 0.75rem;
  }
  
  .sui-facet__loading-spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-left-color: #3a56e4;
    border-radius: 50%;
    margin-right: 0.5rem;
    animation: sui-facet-loading 1s linear infinite;
  }
  
  .sui-facet__empty {
    padding: 0.5rem;
    color: #6b7280;
    font-size: 0.75rem;
    font-style: italic;
  }
  
  .sui-facet__show-more {
    padding: 0.5rem 0;
  }
  
  .sui-facet__show-more-button {
    background: none;
    border: none;
    color: #3a56e4;
    font-size: 0.75rem;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  
  .sui-facet__show-more-button:hover {
    color: #2a46d4;
  }
  
  @keyframes sui-facet-loading {
    to { transform: rotate(360deg); }
  }
  
  /* 暗黑模式支持 */
  :global(.sui-search--dark) .sui-facets__title {
    color: #e5e7eb;
  }
  
  :global(.sui-search--dark) .sui-facets__selected {
    background-color: #374151;
  }
  
  :global(.sui-search--dark) .sui-facets__selected-title {
    color: #d1d5db;
  }
  
  :global(.sui-search--dark) .sui-facets__selected-item {
    background-color: #1f2937;
    border-color: #4b5563;
    color: #e5e7eb;
  }
  
  :global(.sui-search--dark) .sui-facets__clear-button {
    color: #93c5fd;
  }
  
  :global(.sui-search--dark) .sui-facet {
    border-color: #4b5563;
  }
  
  :global(.sui-search--dark) .sui-facet__title {
    color: #e5e7eb;
  }
  
  :global(.sui-search--dark) .sui-facet__count {
    color: #9ca3af;
  }
  
  :global(.sui-search--dark) .sui-facet__search-input {
    background-color: #1f2937;
    border-color: #4b5563;
    color: #e5e7eb;
  }
  
  :global(.sui-search--dark) .sui-facet__item-label:hover {
    background-color: #374151;
  }
  
  :global(.sui-search--dark) .sui-facet__item-label--selected {
    background-color: #1e3a8a;
  }
  
  :global(.sui-search--dark) .sui-facet__item-value {
    color: #e5e7eb;
  }
  
  :global(.sui-search--dark) .sui-facet__item-count {
    color: #9ca3af;
  }
  
  :global(.sui-search--dark) .sui-facet__loading {
    color: #9ca3af;
  }
  
  :global(.sui-search--dark) .sui-facet__loading-spinner {
    border-color: rgba(255, 255, 255, 0.1);
    border-left-color: #93c5fd;
  }
  
  :global(.sui-search--dark) .sui-facet__show-more-button {
    color: #93c5fd;
  }
  
  .sui-facet__item-label--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .sui-facet__item-label--disabled .sui-facet__item-value,
  .sui-facet__item-label--disabled .sui-facet__item-count {
    color: #9ca3af;
  }
  
  .sui-facet__mode-toggle {
    margin-left: 0.5rem;
    padding: 0.125rem 0.375rem;
    font-size: 0.7rem;
    background-color: #e5e7eb;
    border: none;
    border-radius: 0.25rem;
    color: #4b5563;
    cursor: pointer;
  }
  
  .sui-facet__mode-toggle:hover {
    background-color: #d1d5db;
  }
  
  .sui-facet__actions {
    margin: 0.5rem 0;
    display: flex;
    justify-content: flex-end;
  }
  
  .sui-facet__clear-year-button {
    background: none;
    border: none;
    font-size: 0.75rem;
    color: #3a56e4;
    cursor: pointer;
    text-decoration: underline;
  }
  
  .sui-facet__clear-year-button:hover {
    color: #2a46d4;
  }
  
  :global(.sui-search--dark) .sui-facet__mode-toggle {
    background-color: #374151;
    color: #d1d5db;
  }
  
  :global(.sui-search--dark) .sui-facet__mode-toggle:hover {
    background-color: #4b5563;
  }
  
  :global(.sui-search--dark) .sui-facet__clear-year-button {
    color: #93c5fd;
  }
  
  .sui-facet__mode-indicator {
    font-size: 0.75rem;
    color: #6b7280;
    background-color: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    margin-left: 0.5rem;
  }
</style> 