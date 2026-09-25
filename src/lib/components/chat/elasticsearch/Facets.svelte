<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  interface FacetValueItem {
    value: string;
    count: number;
  }
  
  interface Facet {
    data: FacetValueItem[];
  }
  
  interface Filter {
    field: string;
    values: string[];
    type: string;
  }
  
  export let facets: Record<string, Facet> = {};
  export let filters: Filter[] = [];
  export let elasticsearch: any = null; // Elasticsearch客户端实例
  export let index: string = ''; // 索引名称
  
  const dispatch = createEventDispatcher();
  
  // 搜索状态
  let searchQueries: Record<string, string> = {};
  let searchResults: Record<string, FacetValueItem[] | null> = {};
  let searchLoading: Record<string, boolean> = {};
  
  // 处理facet值选择
  function handleFacetValueSelect(facetName: string, value: string): void {
    // 创建新的过滤器
    const newFilter: Filter = {
      field: facetName,
      values: [value],
      type: "any"
    };
    
    // 检查是否已经有这个字段的过滤器
    const existingFilterIndex = filters.findIndex(f => f.field === facetName);
    
    let newFilters: Filter[];
    if (existingFilterIndex >= 0) {
      // 如果已存在过滤器，则更新它
      const existingFilter = filters[existingFilterIndex];
      const valueExists = existingFilter.values.includes(value);
      
      if (valueExists) {
        // 如果值已存在，则移除它
        const newValues = existingFilter.values.filter(v => v !== value);
        
        if (newValues.length === 0) {
          // 如果没有值了，则移除整个过滤器
          newFilters = filters.filter((_, i) => i !== existingFilterIndex);
        } else {
          // 否则更新过滤器值
          newFilters = [...filters];
          newFilters[existingFilterIndex] = {
            ...existingFilter,
            values: newValues
          };
        }
      } else {
        // 如果值不存在，则添加它
        newFilters = [...filters];
        newFilters[existingFilterIndex] = {
          ...existingFilter,
          values: [...existingFilter.values, value]
        };
      }
    } else {
      // 如果不存在过滤器，则添加新过滤器
      newFilters = [...filters, newFilter];
    }
    
    console.log("应用过滤器:", newFilters);
    dispatch('filterChange', newFilters);
  }
  
  // 检查值是否已选中
  function isValueSelected(facetName: string, value: string): boolean {
    const facetFilter = filters.find(f => f.field === facetName);
    return facetFilter ? facetFilter.values.includes(value) : false;
  }
  
  // 确认是否有facets数据
  $: hasFacets = facets && Object.keys(facets).length > 0;
  
  // Elasticsearch字段搜索
  async function searchFacetValues(facetName: string, searchQuery: string): Promise<void> {
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
      searchResults[facetName] = buckets.map((bucket: any) => ({
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
  
  function handleSearchInput(event: Event, facetName: string): void {
    const searchValue = (event.target as HTMLInputElement).value;
    if (searchValue.length >= 1) {
      searchFacetValues(facetName, searchValue);
    } else {
      // 清空搜索结果，显示原始facet值
      searchResults[facetName] = null;
    }
  }
</script>

{#if hasFacets}
  <div>
    {#each Object.entries(facets) as [facetName, facet]}
      <div class="sui-facet">
        <div class="sui-facet__title">
          {facetName.replace(/\.keyword$/, '')}
        </div>
        
        <!-- 添加搜索框 -->
        <div class="sui-facet-search">
          <input 
            class="sui-facet-search__text-input" 
            type="search" 
            placeholder="搜索 {facetName.replace(/\.keyword$/, '')}"
            on:input={(e) => handleSearchInput(e, facetName)}
            value={searchQueries[facetName] || ''}
          />
        </div>
        
        <div class="sui-multi-checkbox-facet">
          <ul class="sui-facet__list">
            {#if searchLoading[facetName]}
              <li>
                <div class="sui-facet__loading">
                  正在搜索...
                </div>
              </li>
            {:else if searchResults[facetName]}
              <!-- 显示搜索结果 -->
              {#if searchResults[facetName].length > 0}
                {#each searchResults[facetName] as valueItem}
                  {@const isSelected = isValueSelected(facetName, valueItem.value)}
                  <li>
                    <label class="sui-multi-checkbox-facet__option-label">
                      <input 
                        type="checkbox" 
                        class="sui-multi-checkbox-facet__option-input"
                        checked={isSelected}
                        on:change={() => handleFacetValueSelect(facetName, valueItem.value)}
                      />
                      <span>{valueItem.value}</span>
                      <span class="sui-multi-checkbox-facet__option-count">
                        {valueItem.count}
                      </span>
                    </label>
                  </li>
                {/each}
              {:else}
                <li>
                  <div class="sui-facet__empty">
                    没有找到匹配的选项
                  </div>
                </li>
              {/if}
            <!-- 显示原始facet数据 -->
            {:else if facet.data && facet.data.length > 0}
              {#each facet.data as valueItem}
                {@const isSelected = isValueSelected(facetName, valueItem.value)}
                <li>
                  <label class="sui-multi-checkbox-facet__option-label">
                    <input 
                      type="checkbox" 
                      class="sui-multi-checkbox-facet__option-input"
                      checked={isSelected}
                      on:change={() => handleFacetValueSelect(facetName, valueItem.value)}
                    />
                    <span>{valueItem.value}</span>
                    <span class="sui-multi-checkbox-facet__option-count">
                      {valueItem.count}
                    </span>
                  </label>
                </li>
              {/each}
            {:else}
              <li>
                <div class="sui-facet__empty">
                  没有可用选项
                </div>
              </li>
            {/if}
          </ul>
        </div>
      </div>
    {/each}
  </div>
{:else}
  <div class="sui-facet">
    <div class="sui-facet__title">
      没有可用过滤器
    </div>
  </div>
{/if}

<style>
  .sui-facets {
    margin-bottom: 20px;
  }
  
  .sui-facet {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .sui-facet:last-child {
    border-bottom: none;
  }
  
  .sui-facet__title {
    font-size: 14px;
    text-transform: uppercase;
    color: #6b7280;
    letter-spacing: 1px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  
  .sui-facet-search {
    margin-bottom: 10px;
  }
  
  .sui-facet-search__text-input {
    width: 100%;
    padding: 6px 12px;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: 14px;
    background-color: white;
    color: #000;
  }
  
  :global(.dark) .sui-facet-search__text-input {
    background-color: #1E1E1E;
    color: white;
    border-color: #374151;
  }
  
  .sui-facet-search__text-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px #3b82f6;
  }
  
  .sui-multi-checkbox-facet {
    position: relative;
  }
  
  .sui-facet__list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .sui-multi-checkbox-facet__option-label {
    display: flex;
    align-items: center;
    padding: 6px 0;
    cursor: pointer;
    font-size: 14px;
    color: #4b5563;
  }
  
  .sui-multi-checkbox-facet__option-input {
    margin-right: 8px;
    cursor: pointer;
    color: #3a56e4;
    width: 16px;
    height: 16px;
  }
  
  .sui-multi-checkbox-facet__option-count {
    margin-left: auto;
    color: #9ca3af;
    font-size: 12px;
    background: #f3f4f6;
    min-width: 24px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    padding: 0 8px;
  }
  
  .sui-facet__empty {
    color: #9ca3af;
    font-size: 13px;
    padding: 8px 0;
    font-style: italic;
  }
  
  .sui-facet__loading {
    color: #6b7280;
    font-size: 13px;
    padding: 8px 0;
    font-style: italic;
  }
  
  /* 暗色模式适配 */
  :global(.dark) .sui-facet {
    border-bottom-color: #4a5568;
  }
  
  :global(.dark) .sui-facet__title {
    color: #a0aec0;
  }
  
  :global(.dark) .sui-multi-checkbox-facet__option-label {
    color: #e2e8f0;
  }
  
  :global(.dark) .sui-multi-checkbox-facet__option-count {
    background-color: #374151;
    color: #d1d5db;
  }
  
  :global(.dark) .sui-facet__empty {
    color: #9ca3af;
  }
  
  :global(.dark) .sui-facet__loading {
    color: #9ca3af;
  }
</style> 