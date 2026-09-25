<!-- 与comparison.svelte基本结构相同，但修改为论文机构对比 -->
<script>
  import { onMount, createEventDispatcher } from 'svelte';
  
  // 添加 initNewChat 作为属性
  export let initNewChat;
  
  // 关闭面板
  const dispatch = createEventDispatcher();
  function closePanel() { dispatch('close'); }
  
  let org1Input = "";
  let org2Input = "";
  let org1 = "";
  let org2 = "";
  let org1Suggestions = []; // [{ name: 'xxx', id: 123 }]
  let org2Suggestions = [];
  let showOrg1Dropdown = false;
  let showOrg2Dropdown = false;
  let isLoading = false;
  let errorMessage = "";
  let specialRequest = "";
  let org1Id = null;
  let org2Id = null;
  
  // 机构基本信息
  let institutionInfo = {
    org1: {
      name: "",
      type: "",
      description: ""
    },
    org2: {
      name: "",
      type: "",
      description: ""
    }
  };

  // ES接口地址
  const ES_URL = "http://81.70.12.153:9388/sci_papers_v2_new/_search";

  // 查询ES数据库机构名（nested聚合，对齐homebody的实现）
  async function fetchOrgSuggestions(query, which) {
    if (!query) {
      if (which === 1) org1Suggestions = [];
      if (which === 2) org2Suggestions = [];
      return;
    }
    try {
      const body = {
        size: 30,
        _source: false,
        stored_fields: [],
        track_total_hits: false,
        sort: ["_score"],
        query: {
          nested: {
            path: "Author_List",
            score_mode: "max",
            query: {
              bool: {
                must: [
                  {
                    match_phrase_prefix: {
                      "Author_List.Affiliation_Details.Affiliation_Name": query
                    }
                  }
                ],
                should: [
                  {
                    term: {
                      "Author_List.Affiliation_Details.Affiliation_Name.keyword": {
                        value: query,
                        boost: 5
                      }
                    }
                  }
                ]
              }
            },
            inner_hits: {
              name: "aff_hits",
              size: 50,
              _source: {
                includes: [
                  "Author_List.Affiliation_Details.Affiliation_Name",
                  "Author_List.AffiliationID",
                  "Affiliation_Details.Affiliation_Name",
                  "AffiliationID"
                ]
              },
              sort: [{ "_score": "desc" }]
            }
          }
        }
      };
      const res = await fetch(ES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      const seen = new Set();
      const out = [];
      for (const h of data?.hits?.hits || []) {
        const ih = h?.inner_hits?.aff_hits?.hits?.hits || [];
        for (const nh of ih) {
          const src = nh?._source || {};
          const affName = src?.Author_List?.Affiliation_Details?.Affiliation_Name
                       ?? src?.Affiliation_Details?.Affiliation_Name;
          const affId = src?.Author_List?.AffiliationID
                     ?? src?.AffiliationID;
          if (affName && affId) {
            const key = `${affName}::${affId}`;
            if (!seen.has(key)) {
              seen.add(key);
              out.push({ name: affName, id: affId, display: affName });
            }
          }
        }
      }
      if (which === 1) org1Suggestions = out;
      if (which === 2) org2Suggestions = out;
    } catch (e) {
      if (which === 1) org1Suggestions = [];
      if (which === 2) org2Suggestions = [];
    }
  }

  // 只允许选择建议中的机构，并自动查简介
  async function selectOrg(suggestion, which) {
    if (which === 1) {
      org1Input = suggestion.name;
      org1 = suggestion.name;
      org1Id = suggestion.id;
      showOrg1Dropdown = false;
      institutionInfo.org1.name = suggestion.name;
      institutionInfo.org1.type = "待确定";
      institutionInfo.org1.description = "简介加载中...";
      institutionInfo = { ...institutionInfo };
      institutionInfo.org1.description = await fetchWikiSummary(suggestion.name);
      institutionInfo = { ...institutionInfo };
    }
    if (which === 2) {
      org2Input = suggestion.name;
      org2 = suggestion.name;
      org2Id = suggestion.id;
      showOrg2Dropdown = false;
      institutionInfo.org2.name = suggestion.name;
      institutionInfo.org2.type = "待确定";
      institutionInfo.org2.description = "简介加载中...";
      institutionInfo = { ...institutionInfo };
      institutionInfo.org2.description = await fetchWikiSummary(suggestion.name);
      institutionInfo = { ...institutionInfo };
    }
  }

  // 失焦时校验并自动查简介
  async function validateOrg(which) {
    if (which === 1) {
      const found = org1Suggestions.find(s => s.name === org1Input);
      if (found) {
        org1 = found.name;
        org1Id = found.id;
        institutionInfo.org1.name = org1;
        institutionInfo.org1.type = "待确定";
        institutionInfo.org1.description = "简介加载中...";
        institutionInfo = { ...institutionInfo };
        institutionInfo.org1.description = await fetchWikiSummary(org1);
        institutionInfo = { ...institutionInfo };
      } else {
        org1Input = "";
        org1 = "";
        org1Id = null;
        institutionInfo.org1 = { name: "", type: "", description: "" };
        institutionInfo = { ...institutionInfo };
      }
    }
    if (which === 2) {
      const found = org2Suggestions.find(s => s.name === org2Input);
      if (found) {
        org2 = found.name;
        org2Id = found.id;
        institutionInfo.org2.name = org2;
        institutionInfo.org2.type = "待确定";
        institutionInfo.org2.description = "简介加载中...";
        institutionInfo = { ...institutionInfo };
        institutionInfo.org2.description = await fetchWikiSummary(org2);
        institutionInfo = { ...institutionInfo };
      } else {
        org2Input = "";
        org2 = "";
        org2Id = null;
        institutionInfo.org2 = { name: "", type: "", description: "" };
        institutionInfo = { ...institutionInfo };
      }
    }
  }

  // 获取维基百科简介
  async function fetchWikiSummary(title) {
    try {
      const url = `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const res = await fetch(url);
      if (!res.ok) return '暂无简介';
      const data = await res.json();
      return data.extract || '暂无简介';
    } catch (e) {
      return '暂无简介';
    }
  }

  // 分析按钮处理函数
  async function handleAnalysis() {
    if (!org1 || !org2 || !org1Id || !org2Id) {
      errorMessage = "请选择两个机构名称";
      return;
    }
    isLoading = true;
    errorMessage = "";
    try {
      const data = {
        org1,
        org1Id,
        org2,
        org2Id,
        specialRequest
      };
      const prompt = `请对如下两个机构进行论文机构对比分析：${JSON.stringify(data, null, 2)}`;
      generateReportWithPrompt(prompt, "论文机构对比主题轨迹报告");
    } catch (error) {
      errorMessage = `分析失败: ${error.message || '未知错误'}`;
    } finally {
      isLoading = false;
    }
  }

  // 修改事件处理函数
  function showPatent() {
    dispatch('showPatent');
  }

  function showPaper() {
    dispatch('showPaper');
  }

  function showCooperate() {
    dispatch('showCooperate');
  }

  function showPatentComparison() {
    dispatch('showPatentComparison');
  }

  function showPaperComparison() {
    dispatch('showPaperComparison');
  }

  function generateReportWithPrompt(prompt, modelName) {
    closePanel();
    try {
      const homePanel = document.querySelector('.home-absolute-panel');
      if (homePanel) {
        const closeEvent = new CustomEvent('home:close');
        window.dispatchEvent(closeEvent);
      }
      const appContainer = document.getElementById('app') || document.querySelector('.app-container');
      if (appContainer) {
        appContainer.dispatchEvent(new CustomEvent('close:home'));
      }
    } catch (error) {
      console.error('尝试关闭home组件时出错:', error);
    }
    // 调用 initNewChat 创建新对话
    if (typeof initNewChat === 'function') {
            initNewChat();
        }
    setTimeout(() => {
      setTimeout(() => {
        try {
          const modelSelectorButton = document.querySelector('#model-selector-0-button') || 
            document.querySelector('[aria-label="选择一个模型"]') ||
            document.querySelector('[data-menu-trigger]') ||
            document.querySelector('[data-melt-dropdown-menu-trigger]');
          if (modelSelectorButton) {
            modelSelectorButton.click();
            setTimeout(() => {
              const allButtons = Array.from(document.querySelectorAll('button[data-value]'));
              const targetBtn = allButtons.find(btn => btn.textContent && btn.textContent.includes(modelName));
              if (targetBtn) {
                targetBtn.click();
              } else if (allButtons.length > 0) {
                allButtons[0].click();
              }
              setTimeout(() => {
                const inputField = document.querySelector('textarea[placeholder]') || 
                  document.querySelector('.textarea') ||
                  document.querySelector('[contenteditable="true"]');
                if (inputField) {
                  if (inputField.tagName.toLowerCase() === 'textarea') {
                    inputField.value = prompt;
                  } else {
                    inputField.textContent = prompt;
                  }
                  const inputEvent = new Event('input', { bubbles: true });
                  inputField.dispatchEvent(inputEvent);
                  const changeEvent = new Event('change', { bubbles: true });
                  inputField.dispatchEvent(changeEvent);
                  setTimeout(() => {
                    const sendButton = document.querySelector('button[aria-label="Send message"]') ||
                      document.querySelector('button[type="submit"]') ||
                      Array.from(document.querySelectorAll('button')).find(btn => {
                        return btn.textContent.includes('发送') || 
                          btn.textContent.includes('Send') ||
                          btn.querySelector('svg[data-icon="paper-plane"]') ||
                          btn.classList.contains('send-button');
                      });
                    if (sendButton && !sendButton.disabled) {
                      sendButton.click();
                    }
                  }, 800);
                }
              }, 800);
            }, 800);
          }
        } catch (error) {
          console.error('自动化流程执行出错:', error);
        }
      }, 500);
    }, 100);
  }
</script>

<div class="panel-inner bg-white dark:bg-gray-800 rounded overflow-hidden shadow-lg w-full h-full">
  <!-- 顶部标题栏 -->
  <div class="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
    <!-- 左侧标题 -->
    <div class="flex items-center">
      <span class="text-lg font-medium">科技大数据智能多模查询与分析系统</span>
      <div class="download-container ml-2 relative"
     on:mouseenter={() => document.getElementById('paperComparisonDownloadMenu').classList.remove('hidden')}
     on:mouseleave={() => {
        setTimeout(() => {
          const menu = document.getElementById('paperComparisonDownloadMenu');
          const isHovered = menu.matches(':hover');
          if (!isHovered) {
            menu.classList.add('hidden');
          }
        }, 100);
     }}>
          <button class="download-btn text-gray-600 hover:text-primary flex items-center text-xs">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
            <span class="ml-1">客户端</span>
          </button>
          <div id="paperComparisonDownloadMenu" 
               class="download-options absolute hidden bg-white dark:bg-gray-700 shadow-lg rounded py-2 z-50 w-36"
               on:mouseenter={() => document.getElementById('paperComparisonDownloadMenu').classList.remove('hidden')}
               on:mouseleave={() => document.getElementById('paperComparisonDownloadMenu').classList.add('hidden')}>
            <a href="/download/windows.zip" download class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">Windows 下载</a>
            <a href="/download/macos.zip" download class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">macOS 下载</a>
            <a href="/download/linux.zip" download class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">Linux 下载</a>
          </div>
        </div>
    </div>
    
    <!-- 右侧按钮组和关闭按钮 -->
    <div class="flex items-center">
      <!-- 导航按钮 -->
      <div class="flex items-center space-x-6 mr-6">
        <div class="relative"
             on:mouseenter={() => document.getElementById('paperComparisonMenu').classList.remove('hidden')}
             on:mouseleave={() => {
                setTimeout(() => {
                  const menu = document.getElementById('paperComparisonMenu');
                  const isHovered = menu.matches(':hover');
                  if (!isHovered) {
                    menu.classList.add('hidden');
                  }
                }, 100);
             }}
             on:focus={() => document.getElementById('paperComparisonMenu').classList.remove('hidden')}>
          <button class="text-primary font-medium hover:text-primary/80 flex items-center">
            <span>机构轨迹对比</span>
          </button>
          <div id="paperComparisonMenu" 
               class="absolute hidden bg-white dark:bg-gray-700 shadow-lg rounded py-2 z-50 w-36 left-1/2 transform -translate-x-1/2"
               style="top: 100%; margin-top: 5px;"
               on:mouseenter={() => document.getElementById('paperComparisonMenu').classList.remove('hidden')}
               on:mouseleave={() => document.getElementById('paperComparisonMenu').classList.add('hidden')}>
            <button class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                    on:click={showPatentComparison}>专利机构对比</button>
            <button class="block px-4 py-2 text-sm text-primary font-medium dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left">
              论文机构对比
            </button>
          </div>
        </div>
        <button class="text-gray-700 hover:text-primary transition-colors" on:click={showCooperate}>产研合作</button>
        <button class="text-gray-700 hover:text-primary transition-colors" on:click={showPatent}>专利轨迹分析</button>
        <button class="text-gray-700 hover:text-primary transition-colors" on:click={showPaper}>论文轨迹分析</button>
      </div>
      
      <!-- 关闭按钮 -->
      <button 
        class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        on:click={closePanel}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
  
  <!-- 内容区域 -->
  <div class="content-area">
    <div class="homebody-container">
      <main class="container mx-auto px-4 py-8">
        <div class="mb-8">
          <h2 class="text-2xl font-bold text-gray-800 mb-2">论文机构对比分析</h2>
          <p class="text-gray-600">
            通过多维度数据对比，深入了解不同机构的论文发表情况与学术影响力
          </p>
        </div>

        <!-- 错误信息 -->
        {#if errorMessage}
          <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {errorMessage}
          </div>
        {/if}

        <!-- 搜索区域 -->
        <div class="flex flex-col md:flex-row gap-4 mb-8">
          <div class="w-full md:w-[45%] relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i class="ri-search-line text-gray-400"></i>
            </div>
            <input
              type="search"
              bind:value={org1Input}
              class="search-input w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded focus:outline-none focus:border-primary"
              placeholder="请输入第一个机构名称（英文名）"
              on:input={() => { fetchOrgSuggestions(org1Input, 1); showOrg1Dropdown = true; }}
              on:focus={() => { if (org1Suggestions.length) showOrg1Dropdown = true; }}
              on:blur={() => { setTimeout(() => { showOrg1Dropdown = false; validateOrg(1); }, 200); }}
              autocomplete="off"
            />
            <!-- 修改第一个机构搜索的下拉菜单 -->
            {#if showOrg1Dropdown && org1Suggestions.length}
              <ul class="absolute z-10 bg-white border border-gray-200 w-full mt-1 rounded shadow max-h-64 overflow-y-auto">
                {#each org1Suggestions as suggestion}
                  <li
                    class="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    on:mousedown={() => selectOrg(suggestion, 1)}
                  >{suggestion.name}</li>
                {/each}
              </ul>
            {/if}
          </div>

          <div class="w-full md:w-[45%] relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i class="ri-search-line text-gray-400"></i>
            </div>
            <input
              type="search"
              bind:value={org2Input}
              class="search-input w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded focus:outline-none focus:border-primary"
              placeholder="请输入第二个机构名称（英文名）"
              on:input={() => { fetchOrgSuggestions(org2Input, 2); showOrg2Dropdown = true; }}
              on:focus={() => { if (org2Suggestions.length) showOrg2Dropdown = true; }}
              on:blur={() => { setTimeout(() => { showOrg2Dropdown = false; validateOrg(2); }, 200); }}
              autocomplete="off"
            />
            <!-- 修改第二个机构搜索的下拉菜单 -->
            {#if showOrg2Dropdown && org2Suggestions.length}
              <ul class="absolute z-10 bg-white border border-gray-200 w-full mt-1 rounded shadow max-h-64 overflow-y-auto">
                {#each org2Suggestions as suggestion}
                  <li
                    class="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    on:mousedown={() => selectOrg(suggestion, 2)}
                  >{suggestion.name}</li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>

        <!-- 基础信息对比 -->
        <div class="mb-8 info-compare-section">
          <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
            <div class="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-full mr-2">
              <i class="ri-building-line text-primary"></i>
            </div>
            基础信息对比
          </h3>
          <div class="flex flex-col md:flex-row gap-6 h-full">
            <div class="w-full md:w-1/2 bg-white rounded-lg p-4 card-shadow info-compare-card">
              <div class="flex justify-between items-center mb-2">
                <h4 class="text-lg font-bold text-primary">{institutionInfo.org1.name}</h4>
                <span class="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{institutionInfo.org1.type}</span>
              </div>
              <div class="mt-2 info-compare-desc">
                <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {institutionInfo.org1.description || '暂无介绍'}
                </p>
              </div>
            </div>
            <div class="w-full md:w-1/2 bg-white rounded-lg p-4 card-shadow info-compare-card">
              <div class="flex justify-between items-center mb-2">
                <h4 class="text-lg font-bold text-primary">{institutionInfo.org2.name}</h4>
                <span class="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">{institutionInfo.org2.type}</span>
              </div>
              <div class="mt-2 info-compare-desc">
                <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {institutionInfo.org2.description || '暂无介绍'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- 分析区域在内容底部 -->
        <div class="analysis-footer-bar">
          <div class="flex flex-row gap-6 items-end w-full max-w-5xl mx-auto px-4">
            <!-- 特殊要求输入卡片 -->
            <div class="flex-1 bg-white rounded-lg p-4 card-shadow" style="min-height:80px;max-height:120px;">
              <label class="block text-sm font-medium text-gray-700 mb-2">特殊要求（可选）</label>
              <textarea
                class="w-full border border-gray-200 rounded p-2 text-sm resize-none focus:outline-none focus:border-primary mb-4"
                rows="3"
                style="min-height:48px;max-height:48px;margin-bottom:10px;"
                placeholder="请输入对分析的特殊要求，如关注某些指标、对比方式等"
                bind:value={specialRequest}
              ></textarea>
            </div>
            <!-- 正方形分析按钮 -->
            <div class="flex-shrink-0 flex items-end">
              <button
  class="w-20 h-20 rounded-lg text-lg font-medium shadow-md flex items-center justify-center analysis-btn-white analysis-btn"
  on:click={handleAnalysis}
  disabled={isLoading}
  style="min-width:5rem;min-height:5rem;"
>
  {#if isLoading}
    <span class="text-xs">分析中...</span>
  {:else}
    对比<br>分析
  {/if}
</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</div>

<style>
  /* 与comparison.svelte相同的样式 */
  .panel-inner {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  z-index: 50;
}
:global(.dark) .panel-inner {
  background: #1f2937;
}
.content-area {
  flex: 1;
  /* overflow-y: auto;  // 移除滚动条 */
  position: relative;
}
.homebody-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.search-input:focus {
  box-shadow: 0 0 0 2px rgba(30, 61, 89, 0.2);
  outline: none;
}
.card-shadow {
  box-shadow: 0 4px 12px rgba(30, 61, 89, 0.08);
  transition: all 0.3s ease;
}
.card-shadow:hover {
  box-shadow: 0 8px 24px rgba(30, 61, 89, 0.12);
  transform: translateY(-2px);
}
input[type="search"]::-webkit-search-decoration,
input[type="search"]::-webkit-search-cancel-button,
input[type="search"]::-webkit-search-results-button,
input[type="search"]::-webkit-search-results-decoration {
  display: none;
}
.bg-primary {
  background-color: #1E3D59;
}
.text-primary {
  color: #1E3D59;
}
.border-primary {
  border-color: #1E3D59;
}
/* 加载动画 */
.loading-spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.analysis-footer-bar {
  background: #fff;
  border-top: 1px solid #e5e7eb;
  z-index: 10;
  padding-top: 12px;
  padding-bottom: 12px;
  margin-top: 20px;
}
@media (max-width: 768px) {
  .analysis-footer-bar {
    padding-left: 0;
    padding-right: 0;
  }
}
/* 统一卡片、输入框、内容区域不出现滚动条 */
.card-shadow,
input,
textarea,
.content-area,
.homebody-container {
  overflow: visible !important;
}
.info-compare-section {
  min-height: 300px;
  max-height: 300px;
  overflow: hidden;
  margin-bottom: 2rem;
}
.info-compare-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.info-compare-desc {
  flex: 1;
  overflow-y: auto;
  min-height: 160px;
  max-height: 160px;
}
.analysis-btn-white {
  background: #fff !important;
  color: #222 !important;
  border: 1.5px solid #222;
  font-weight: 600;
  transition: background 0.2s, color 0.2s, border 0.2s;
}
.analysis-btn-white:hover:enabled {
  background: #f3f4f6 !important;
  color: #111 !important;
  border-color: #111;
}
.analysis-btn-white:disabled {
  color: #aaa !important;
  border-color: #ddd;
  background: #f9f9f9 !important;
  cursor: not-allowed;
}
.analysis-btn {
  white-space: pre-line;
  text-align: center;
  line-height: 1.2;
}
.download-options {
    top: 100%;
    left: 0;
    margin-top: -2px;
    padding-top: 8px;
}

.download-btn {
    font-size: 0.75rem;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    transition: all 0.2s;
}

.download-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
}

:global(.dark) .download-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
}
</style>
