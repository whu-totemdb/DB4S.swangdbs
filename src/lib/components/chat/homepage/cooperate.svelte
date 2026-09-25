<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import Select from 'svelte-select';
  import ipcOptions from './ipc.json';

  // 添加 initNewChat 作为属性
  export let initNewChat;

  // 搜索与筛选状态
  let searchTerm = '';
  let applicantType = '';
  let ipcCode = '';
  let region = '';
  let yearFrom = new Date().getFullYear() - 4;
  let yearTo = new Date().getFullYear();
  let specialRequirement = '';

  // 申请人类型选项
  const applicantTypeOptions = [
    { label: '全部', value: '' },
    { label: '高校', value: 'university' },
    { label: '企业', value: 'company' },
    { label: '研究所', value: 'institute' }
  ];

  // 省份选项（可补充完整）
  const regionOptions = [
    { label: '全部', value: '' },
    { label: '北京', value: '北京' },
    { label: '上海', value: '上海' },
    { label: '广东', value: '广东' },
    { label: '江苏', value: '江苏' },
    { label: '浙江', value: '浙江' },
    { label: '山东', value: '山东' },
    { label: '四川', value: '四川' },
    { label: '湖北', value: '湖北' },
    { label: '陕西', value: '陕西' },
    { label: '重庆', value: '重庆' },
    { label: '天津', value: '天津' },
    { label: '辽宁', value: '辽宁' },
    { label: '吉林', value: '吉林' },
    { label: '黑龙江', value: '黑龙江' },
    { label: '河北', value: '河北' },
    { label: '山西', value: '山西' },
    { label: '内蒙古', value: '内蒙古' },
    { label: '安徽', value: '安徽' },
    { label: '福建', value: '福建' },
    { label: '江西', value: '江西' },
    { label: '河南', value: '河南' },
    { label: '湖南', value: '湖南' },
    { label: '广西', value: '广西' },
    { label: '海南', value: '海南' },
    { label: '贵州', value: '贵州' },
    { label: '云南', value: '云南' },
    { label: '西藏', value: '西藏' },
    { label: '甘肃', value: '甘肃' },
    { label: '青海', value: '青海' },
    { label: '宁夏', value: '宁夏' },
    { label: '新疆', value: '新疆' },
    { label: '香港', value: '香港' },
    { label: '澳门', value: '澳门' },
    { label: '台湾', value: '台湾' }
  ];

  // 关闭面板
  const dispatch = createEventDispatcher();
  function closePanel() { dispatch('close'); }

  // 重置筛选条件
  function handleReset() {
    searchTerm = '';
    applicantType = '';
    ipcCode = '';
    region = '';
    yearFrom = new Date().getFullYear() - 4;
    yearTo = new Date().getFullYear();
    specialRequirement = '';
  }

  function generateReportWithPrompt(prompt, modelName) {
    console.log("shutdowm");
    closePanel();

    // 直接关闭home面板（仿照FloatingPanel）
    try {
      // 查找home组件的容器元素
      const homePanel = document.querySelector('.home-absolute-panel');
      if (homePanel) {
        // 如果找到home面板，触发其关闭事件
        const closeEvent = new CustomEvent('home:close');
        window.dispatchEvent(closeEvent);
        console.log('已触发home组件关闭事件');
      }

      // 查找主应用容器，通知应用关闭home
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
      // 选择模型（按名称）
      setTimeout(() => {
        try {
          const modelSelectorButton = document.querySelector('#model-selector-0-button') || 
            document.querySelector('[aria-label="选择一个模型"]') ||
            document.querySelector('[data-menu-trigger]') ||
            document.querySelector('[data-melt-dropdown-menu-trigger]');
          if (modelSelectorButton) {
            modelSelectorButton.click();
            setTimeout(() => {
              // 按名称查找模型按钮
              const allButtons = Array.from(document.querySelectorAll('button[data-value]'));
              const targetBtn = allButtons.find(btn => btn.textContent && btn.textContent.includes(modelName));
              if (targetBtn) {
                targetBtn.click();
                console.log(`已选择模型: ${modelName}`);
              } else if (allButtons.length > 0) {
                allButtons[0].click();
                console.log('未找到指定模型，已选择第一个');
              }
              // 填写prompt
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
                      console.log('已点击发送按钮');
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

  // 2. 修改 analyzeCooperation
  function analyzeCooperation() {
    const data = {
      paperText: searchTerm,
      applicantType,
      ipcCode,
      region,
      yearFrom,
      yearTo,
      specialRequirement
    };
    const prompt = `请分析如下产研合作需求：${JSON.stringify(data, null, 2)}`;
    generateReportWithPrompt(prompt, "产研合作主题轨迹报告");
  }

  // 修改跳转函数处理
  function showPatent() {
    dispatch('showPatent');
  }

  function showPaper() {
    dispatch('showPaper');
  }
</script>

<div class="panel-inner bg-white dark:bg-gray-800 rounded overflow-hidden shadow-lg w-full h-full">
  <!-- 顶部标题栏 -->
  <div class="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
    <!-- 左侧标题 -->
    <div class="flex items-center">
      <span class="text-lg font-medium">科技大数据智能多模查询与分析系统</span>
      <div class="download-container ml-2 relative"
           on:mouseenter={() => document.getElementById('cooperateDownloadMenu').classList.remove('hidden')}
           on:mouseleave={() => {
              setTimeout(() => {
                const menu = document.getElementById('cooperateDownloadMenu');
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
        <div id="cooperateDownloadMenu" 
             class="download-options absolute hidden bg-white dark:bg-gray-700 shadow-lg rounded py-2 z-50 w-36"
             on:mouseenter={() => document.getElementById('cooperateDownloadMenu').classList.remove('hidden')}
             on:mouseleave={() => document.getElementById('cooperateDownloadMenu').classList.add('hidden')}>
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
             on:mouseenter={() => document.getElementById('cooperateComparisonMenu').classList.remove('hidden')}
             on:mouseleave={() => {
                setTimeout(() => {
                  const menu = document.getElementById('cooperateComparisonMenu');
                  const isHovered = menu.matches(':hover');
                  if (!isHovered) {
                    menu.classList.add('hidden');
                  }
                }, 100);
             }}
             on:focus={() => document.getElementById('cooperateComparisonMenu').classList.remove('hidden')}>
  <button class="text-gray-700 hover:text-primary transition-colors flex items-center">
    <span>机构轨迹对比</span>
  </button>
  <div id="cooperateComparisonMenu" 
       class="absolute hidden bg-white dark:bg-gray-700 shadow-lg rounded py-2 z-50 w-36 left-1/2 transform -translate-x-1/2"
       style="top: 100%; margin-top: 5px;"
       on:mouseenter={() => document.getElementById('cooperateComparisonMenu').classList.remove('hidden')}
       on:mouseleave={() => document.getElementById('cooperateComparisonMenu').classList.add('hidden')}>
    <button class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
            on:click={() => dispatch('showPatentComparison')}>专利机构对比</button>
    <button class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
            on:click={() => dispatch('showPaperComparison')}>论文机构对比</button>
  </div>
</div>
        <button 
          class="text-primary font-medium hover:text-primary/80"
        >
          产研合作
        </button>
        <button 
          class="text-gray-700 hover:text-primary transition-colors"
          on:click={showPatent}
>
          专利轨迹分析
</button>
<button 
  class="text-gray-700 hover:text-primary transition-colors"
  on:click={showPaper}
>
  论文轨迹分析
</button>
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
    <div class="homebody-container p-8">
      <div class="flex flex-row gap-8">
        <!-- 搜索框区域 -->
        <div class="w-1/2 bg-white rounded shadow-sm p-6">
          <div class="mb-4">
            <label for="paper-search" class="block text-sm font-medium text-gray-700 mb-2">论文</label>
            <textarea
              id="paper-search"
              class="search-input w-full pl-4 pr-4 py-3 border border-gray-200 rounded focus:border-primary transition-colors"
              placeholder="请输入需要合作的论文研究方向，摘要等内容"
              rows="20"
              bind:value={searchTerm}
            ></textarea>
          </div>
        </div>

        <!-- 右侧筛选条件和按钮 -->
        <div class="w-1/2 flex flex-col gap-8">
          <!-- 筛选条件区域 -->
          <div class="w-full bg-white rounded shadow-sm p-6">
            <h3 class="text-lg font-medium mb-4">专利筛选条件</h3>
            <div class="grid grid-cols-1 gap-6">
              <!-- 申请人类型 -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">申请人类型</label>
                <div class="flex flex-wrap gap-3">
                  {#each applicantTypeOptions as opt}
                    <label>
                      <input type="radio" name="applicantType" value={opt.value} bind:group={applicantType} />
                      <span class="ml-1">{opt.label}</span>
                    </label>
                  {/each}
                </div>
              </div>

              <!-- 区域（省份） -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">区域</label>
                <Select
                  class="region-select"
                  items={regionOptions}
                  bind:value={region}
                  labelField="label"
                  valueField="value"
                  maxHeight={160}
                  clearable={false}
                  placeholder="请选择区域"
                />
              </div>

              <!-- IPC分类号 -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">IPC分类号</label>
                <Select
                  class="ipc-select"
                  items={ipcOptions}
                  bind:value={ipcCode}
                  labelField="label"
                  valueField="value"
                  maxHeight={160}
                  clearable={false}
                  placeholder="请选择IPC分类号"
                />
              </div>

              <!-- 申请年份区间 -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">申请年份区间</label>
                <div class="flex items-center space-x-4">
                  <input 
                    type="number" 
                    bind:value={yearFrom} 
                    class="w-24 px-3 py-2 border border-gray-200 rounded text-sm" 
                    min="1900" 
                    max={yearTo}
                  />
                  <span class="text-gray-500">至</span>
                  <input 
                    type="number" 
                    bind:value={yearTo} 
                    class="w-24 px-3 py-2 border border-gray-200 rounded text-sm" 
                    min={yearFrom} 
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>
            </div>

            <div class="mt-6 flex justify-end">
              <button class="px-4 py-2 bg-gray-100 text-gray-700 rounded mr-3" on:click={handleReset}>重置</button>
            </div>
          </div>

          <!-- 分析按钮和特殊要求输入框横向排列 -->
          <div class="w-full flex flex-row items-center justify-end gap-4 mt-4">
            <!-- 特殊要求输入框 -->
            <div class="flex-1">
              <textarea
                class="special-input w-full px-3 py-2 border border-gray-200 rounded text-sm"
                rows="3"
                placeholder="请输入特殊要求（可选）"
                bind:value={specialRequirement}
              ></textarea>
            </div>
            <!-- 正方形分析按钮 -->
            <button 
              class="analysis-btn-white rounded-lg text-base font-medium shadow-md flex items-center justify-center analysis-btn"
              on:click={analyzeCooperation}
              style="width:64px;height:64px;min-width:64px;min-height:64px;"
              title="产研合作分析"
            >
              合作<br>分析
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
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
    overflow-y: auto;
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
    outline: none;
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.3);
  }
  .bg-primary {
    background: #2196F3;
  }
  .text-primary {
    color: #1E3D59;
  }
  textarea.search-input {
    resize: none;
  }
  .special-input {
    resize: none;
    background: #f9fafb;
  }
  .analysis-btn {
    white-space: pre-line;
    text-align: center;
    line-height: 1.2;
  }
  .region-select {
    height: 36px;
    font-size: 14px;
    padding-top: 2px;
    padding-bottom: 2px;
    line-height: 1.2;
    box-sizing: border-box;
    min-height: unset;
    max-height: unset;
  }
  .ipc-select {
    font-size: 14px;
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