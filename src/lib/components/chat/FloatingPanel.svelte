<!-- 在你原始代码的script部分添加导入 -->
<script lang="ts">
    import Searchkit from 'searchkit'
    import SearchkitInstantsearchClient from '@searchkit/instantsearch-client'
    import instantsearch from 'instantsearch.js'
    import {
        searchBox,
        refinementList,
        hits,
        pagination,
        rangeInput,
        rangeSlider
    } from 'instantsearch.js/es/widgets'
    import { createEventDispatcher, onMount } from 'svelte';
    import PatentSearch from './elasticsearch/ElasticsearchSearch.svelte';
    import PaperSearch from './elasticsearch/elasticsearch_paper/ElasticsearchSearch.svelte';
    

    const config = {
        connection: {
        host: 'http://10.254.29.16:9388'
        },
        search_settings: {
            highlight_attributes: ['PaperTitle'],
            search_attributes: [
                { field: 'PaperTitle', weight: 3 },
                { field: 'abstract', weight: 2 },
                'OriginalVenue',
                'Publisher',
                'DOI'
            ],
            result_attributes: [
                'PaperTitle',
                'abstract',
                'DOI',
                'Year',
                'Date',
                'OriginalVenue',
                'Publisher',
                'CitationCount'
            ],
            facet_attributes: [
                { attribute: 'Year', field: 'Year', type: 'numeric' },
                { attribute: 'DocType', field: 'DocType.keyword', type: 'string' },
                { attribute: 'Publisher', field: 'Publisher.keyword', type: 'string' },
                { attribute: 'OriginalVenue', field: 'OriginalVenue.keyword', type: 'string' },
                { attribute: 'CitationCount', field: 'CitationCount', type: 'numeric' }
            ],
            sorting: {
                default: {
                    field: '_score',
                    order: 'desc'
                },
                latest: {
                    field: 'Year',
                    order: 'desc'
                },
                most_cited: {
                    field: 'CitationCount',
                    order: 'desc'
                }
            },
            snippet_attributes: ['abstract'],
            query_rules: []
        }
    };

    // 初始化 Searchkit 客户端
    const searchkitClient = new Searchkit(config);

    // 使用 Searchkit 客户端初始化 InstantSearch.js 客户端
    const searchClient = SearchkitInstantsearchClient(searchkitClient);

    // 创建 InstantSearch 实例
    const search = instantsearch({
        indexName: 'imdb_movies',  // 设置为你需要的索引名
        searchClient: searchClient
    });

    // 添加所需的 widgets
    // search.addWidgets([
    //     searchBox({ container: '#searchbox' }),
    //     refinementList({ container: '#type-list', attribute: 'type' }),
    //     refinementList({ container: '#actors-list', attribute: 'actors' }),
    //     rangeInput({ container: '#rating-range', attribute: 'rating' }),
    //     rangeInput({ container: '#metascore-range', attribute: 'metascore' }),
    //     // hits({ container: '#hits', templates: { item: hitTemplate } }),
    //     pagination({ container: '#pagination' })
    // ]);

    // 启动搜索
    

  

    // 创建事件分发器
    const dispatch = createEventDispatcher();
    
    // 组件属性
    export let info = {}; // 要显示的信息对象
    export let fullscreen = false; // 是否覆盖整个主内容区
    export let mainContentRef = null; // 允许从外部传入对主内容区的引用
    export let searchType = 'patents'; // 默认为专利搜索
    export let pendingAnalysis = null;
    export let initNewChat: Function;

    // 面板引用
    let panelElement;
    let isPositioned = false;
    let resizeObserver;
    let initialRender = true; // 添加一个标记来控制初始渲染
    
    // 检测是否为暗黑模式
    let isDarkMode = false;
    
    // 添加锁定变量
    let isTypeSwitching = false;

    // 在onMount之前定义函数
    function handleResetEvent(event) {
        // 同时触发document和window上的事件，增加捕获机会
        document.dispatchEvent(new CustomEvent('reset-search-state'));
        window.dispatchEvent(new CustomEvent('reset-search-state'));
        
        // 仍然保留对特定元素的尝试
        const searchPanel = document.querySelector('.search-panel-container .sui-layout') || 
                           document.querySelector('.sui-layout');
        if (searchPanel) {
            searchPanel.dispatchEvent(new CustomEvent('reset-search-state'));
        }
    }

    onMount(() => {
        // 组件挂载后先隐藏面板，防止闪烁
        if (fullscreen && panelElement) {
            panelElement.style.visibility = 'hidden';
        }
        
        // 检测是否为暗黑模式
        isDarkMode = document.documentElement.classList.contains('dark');
        
        // 在组件挂载后延迟执行定位
        setTimeout(() => {
            positionPanel();
            // 定位完成后再显示面板
            if (fullscreen && panelElement) {
                panelElement.style.visibility = 'visible';
            }
            initialRender = false;
        }, 50);
        
        // 添加窗口大小变化的监听器
        window.addEventListener('resize', positionPanel);
        
        // 设置ResizeObserver来监听主内容区大小变化
        setupResizeObserver();
        
        // 将生成报告方法共享给全局
        window.originalGenerateReportWithPrompt = generateReportWithPrompt;
        
        // 处理待处理的分析请求
        if (pendingAnalysis) {
            setTimeout(() => {
                generateReportWithPrompt(
                    pendingAnalysis.prompt, 
                    pendingAnalysis.modelName
                );
                dispatch('analysisComplete');
            }, 500);
        }
        
        // 使用命名函数添加监听器
        window.addEventListener('reset-search-type', handleResetEvent);
        
        // 清理函数
        return () => {
            window.removeEventListener('resize', positionPanel);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            window.originalGenerateReportWithPrompt = null;
            // 移除相同的函数引用
            window.removeEventListener('reset-search-type', handleResetEvent);
        };
        
    });
    
    // 处理搜索完成事件
    function handleSearchComplete(event) {
        console.log('搜索完成:', event.detail);
    }
    
    // 处理搜索结果点击事件
    function handleResultClick(event) {
        console.log('搜索结果点击:', event.detail);
    }
    
    // 处理生成报告事件
    function handleGenerateReport(event) {
        console.log('生成报告事件:', event.detail);
        const { paperTitle, paperId, abstract } = event.detail;
        // 拼接prompt，带上摘要和PaperID
        const prompt = `请你生成论文《${paperTitle}》的分析报告，PaperID=${paperId}\n摘要：${abstract}`;
        generateReportWithPrompt(prompt, "论文主题轨迹报告");
    }
    
    // 处理分析机构事件
    function handleAnalyzeInstitution(event) {
        console.log('分析机构事件:', event.detail);
        const { institutionName, institutionId } = event.detail;
        // 拼接prompt，带上机构Affiliation_ID，不带摘要
        const prompt = `请你分析机构\"${institutionName}\"，AffiliationID=${institutionId || '未知ID'}`;
        generateReportWithPrompt(prompt, "机构主题轨迹报告");
    }

    // 处理分析作者事件
    function handleAnalyzeAuthor(event) {
        console.log('分析作者事件:', event.detail);
        const { authorName, authorId, affiliation } = event.detail;
        // 拼接prompt，包含作者信息和所属机构
        const prompt = `请你分析作者"${authorName}"，AuthorID=${authorId || '未知ID'}，所属机构: ${affiliation}`;
        generateReportWithPrompt(prompt, "作者主题轨迹报告");
    }

    // 处理分析专利事件
    function handleAnalyzePatent(event) {
        console.log('分析专利事件:', event.detail);
        const { title, result } = event.detail;
        const prompt = `请你分析专利《${title}》。`;
        generateReportWithPrompt(prompt, "专利主题轨迹报告");
    }

    // 处理分析申请人事件
    function handleAnalyzeApplicant(event) {
        console.log('分析申请人事件:', event.detail);
        const { applicant, result } = event.detail;
        const prompt = `请你分析专利申请人"${applicant}"。`;
        generateReportWithPrompt(prompt, "专利申请人主题轨迹报告");
    }

    // 处理分析发明人事件
    function handleAnalyzeInventor(event) {
        console.log('分析发明人事件:', event.detail);
        const { inventor, result } = event.detail;
        const prompt = `请你分析专利发明人"${inventor}"。`;
        generateReportWithPrompt(prompt, "专利发明人主题轨迹报告");
    }

    function setupResizeObserver() {
        if (typeof ResizeObserver !== 'undefined' && fullscreen) {
            resizeObserver = new ResizeObserver((entries) => {
                // 当观察到的元素大小变化时，重新定位面板
                positionPanel();
            });
            
            // 尝试观察主内容区
            setTimeout(() => {
                try {
                    const mainContentArea = findMainContentArea();
                    if (mainContentArea) {
                        resizeObserver.observe(mainContentArea);
                        console.log('ResizeObserver已设置');
                    }
                } catch (err) {
                    console.error('设置ResizeObserver时出错:', err);
                }
            }, 200);
        }
    }
    
    function findMainContentArea() {
        // 首先尝试使用传入的引用
        if (mainContentRef) return mainContentRef;
        
        // 更新选择器列表，优先使用更精确的选择器定位主内容区
        const selectors = [
            // 首先尝试找到最准确的主内容区选择器
            '#chat-container > .flex-1',
            '#chat-container > div.flex-1',
            '.flex-1.min-w-0.flex.flex-col',
            // 更通用的备选选择器
            '.flex-1',
            '#chat-container > div:first-child',
            '.min-w-0',
            '[role="main"]',
            'main',
            '.main-content'
        ];
        
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && isValidElement(element)) {
                console.log(`找到主内容区: ${selector}`);
                return element;
            }
        }
        
        // 如果找不到，尝试使用更智能的查找方法
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            // 查找chat-container中的第一个flex-1子元素
            const flexChildren = chatContainer.querySelectorAll('.flex-1');
            for (const child of flexChildren) {
                if (isValidElement(child)) {
                    console.log('通过chat-container找到flex-1子元素');
                    return child;
                }
            }
            
            // 如果依然找不到，尝试直接使用第一个子元素
            const firstChild = chatContainer.children[0];
            if (firstChild && isValidElement(firstChild)) {
                console.log('使用chat-container的第一个子元素');
                return firstChild;
            }
        }
        
        console.log('未找到主内容区');
        return null;
    }
    
    function isValidElement(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        // 检查元素是否有合理的尺寸
        return rect.width > 100 && rect.height > 100;
    }
    
    function positionPanel() {
        // 检查是否在搜索面板内，如果是则跳过自定义定位
        if (panelElement && panelElement.closest('.search-panel-container')) {
            console.log('在搜索面板内，跳过自定义定位');
            return;
        }
        
        if (!fullscreen || !panelElement) return;
        
        try {
            // 查找主内容区
            const mainContentArea = findMainContentArea();
            
            if (mainContentArea) {
                // 获取主内容区的位置和尺寸
                const rect = mainContentArea.getBoundingClientRect();
                
                // 确保位置和尺寸是合理的
                if (rect.width > 100 && rect.height > 100) {
                    // 应用样式到面板元素，使其完全覆盖主内容区
                    panelElement.style.position = 'fixed';
                    panelElement.style.top = `${rect.top}px`;
                    panelElement.style.left = `${rect.left}px`;
                    panelElement.style.width = `${rect.width}px`;
                    panelElement.style.height = `${rect.height}px`;
                    panelElement.style.zIndex = '50';
                    panelElement.style.overflow = 'hidden'; // 改为hidden，内容元素自己管理滚动
                    
                    isPositioned = true;
                    console.log('面板已定位到主内容区:', rect);
                } else {
                    console.log('获取到的矩形尺寸过小:', rect);
                    fallbackPosition();
                }
            } else {
                console.log('未找到主内容区');
                fallbackPosition();
            }
        } catch (error) {
            console.error('定位面板时出错:', error);
            fallbackPosition();
        }
    }
    
    // 改进的备用定位方案
    function fallbackPosition() {
        if (panelElement && fullscreen) {
            // 查找Chat容器
            const chatContainer = document.getElementById('chat-container');
            if (chatContainer) {
                const containerRect = chatContainer.getBoundingClientRect();
                // 假设地图区占据1/3宽度，主内容区占据2/3宽度
                const mainContentWidth = containerRect.width * 2/3;
                
                // 应用样式覆盖主内容区
                panelElement.style.position = 'fixed';
                panelElement.style.top = `${containerRect.top}px`;
                panelElement.style.left = `${containerRect.left}px`;
                panelElement.style.width = `${mainContentWidth}px`;
                panelElement.style.height = `${containerRect.height}px`;
                panelElement.style.zIndex = '50';
                panelElement.style.overflow = 'hidden'; // 改为hidden，内容元素自己管理滚动
                
                isPositioned = true;
                console.log('使用改进的备用定位:', { 
                    top: containerRect.top, 
                    left: containerRect.left, 
                    width: mainContentWidth, 
                    height: containerRect.height 
                });
                return;
            }
            
            // 如果还是找不到合适的定位，使用视口尺寸的估计值
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            // 估计页面头部的高度
            const estimatedHeaderHeight = 60;
            
            // 估计内容区域的尺寸和位置
            let top = estimatedHeaderHeight;
            let left = 0;
            let width = viewportWidth * 0.7; // 约为视口宽度的70%
            let height = viewportHeight - estimatedHeaderHeight;
            
            // 应用样式
            panelElement.style.position = 'fixed';
            panelElement.style.top = `${top}px`;
            panelElement.style.left = `${left}px`;
            panelElement.style.width = `${width}px`;
            panelElement.style.height = `${height}px`;
            panelElement.style.zIndex = '50';
            panelElement.style.overflow = 'hidden'; // 改为hidden，内容元素自己管理滚动
            
            isPositioned = true;
            console.log('使用视口大小的备用定位:', { top, left, width, height });
        }
    }
    
    // 关闭面板的方法
    function closePanel() {
        // 发送关闭事件，添加关闭home的标志
        dispatch('close', { closeHome: true });
        
        // 尝试查找并直接关闭home组件
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
        
        // 确保面板自身也关闭
        dispatch('close');
    }
    
    function closePanel1() { dispatch('close'); }

     // 新的通用生成报告方法，按模型名称选择
     function generateReportWithPrompt(prompt, modelName) {
        console.log("关闭面板并新建对话");
        
        // 触发保存搜索状态的代码
        const searchPanel = document.querySelector('.sui-layout');
        if (searchPanel) {
            // 通过CustomEvent通知ElasticsearchSearch组件保存状态
            const event = new CustomEvent('save-search-state', { bubbles: true });
            searchPanel.dispatchEvent(event);
        }
        
        // 关闭面板
        closePanel();
        
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
                                    try {
                                        // 模拟粘贴事件
                                        const clipboardData = new DataTransfer();
                                        clipboardData.setData('text/plain', prompt);
                                        const pasteEvent = new ClipboardEvent('paste', {
                                            bubbles: true,
                                            cancelable: true,
                                            clipboardData
                                        });
                                        inputField.dispatchEvent(pasteEvent);
                                    } catch (e) {
                                        // 回退到直接赋值
                                        inputField.value = prompt;
                                        const inputEvent = new Event('input', { bubbles: true });
                                        inputField.dispatchEvent(inputEvent);
                                    }
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

    // 修改自定义事件
    function handleTypeChange(type) {
      // 如果点击的是当前显示的类型，触发重置
      if (type === searchType) {
        console.log(`当前已在${type}页面，执行重置操作`);
        
        // 根据类型触发不同的重置事件
        if (type === 'patents') {
          window.dispatchEvent(new CustomEvent('reset-patents-search'));
        } else if (type === 'papers') {
          window.dispatchEvent(new CustomEvent('reset-papers-search'));
        }
        
        return; // 重置后不再继续切换类型
      }
      
      // 否则继续原有的类型切换逻辑
      if (isTypeSwitching) return;
      
      isTypeSwitching = true;
      console.log('切换搜索类型:', searchType, '->', type);
      
      // 先发出事件让当前组件保存状态
      const searchPanel = document.querySelector('.sui-layout');
      if (searchPanel) {
        const saveEvent = new CustomEvent('save-search-state', { 
          bubbles: true,
          detail: { fromType: searchType, toType: type } 
        });
        searchPanel.dispatchEvent(saveEvent);
      }
      
      // 切换类型
      setTimeout(() => {
        searchType = type;
        dispatch('typeChange', type);
        
        setTimeout(() => {
          isTypeSwitching = false;
        }, 300);
      }, 50);
    }

    // 添加事件处理函数
    function handleAnalysisRequest(event) {
        const { type, data } = event.detail;
        if (data) {
            pendingAnalysis = data;
            // 这里可以根据需要处理分析请求，而不立即显示面板
            generateReportWithPrompt(data.prompt, data.modelName);
        }
    }
</script>

{#if fullscreen}
    <!-- 覆盖主内容区的面板 -->
    <div 
    bind:this={panelElement}
    class="floating-panel bg-white dark:bg-gray-800 rounded-none overflow-hidden shadow-none w-full h-full"
    style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; margin: 0; padding: 0; flex: 1; display: flex; flex-direction: column;"
>
        <!-- 内容容器 - 为搜索界面提供滚动功能 -->
        <div class="h-full flex flex-col overflow-hidden">
            <!-- 顶部标题栏 -->
            <div class="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
                <!-- 左侧标题 -->
                <div class="flex items-center">
                    <span class="text-lg font-medium">科技大数据智能多模查询与分析系统</span>
                    <div class="download-container ml-2 relative"
                         on:mouseenter={() => document.getElementById('floatingPanelDownloadMenu').classList.remove('hidden')}
                         on:mouseleave={() => {
                            setTimeout(() => {
                              const menu = document.getElementById('floatingPanelDownloadMenu');
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
                        <div id="floatingPanelDownloadMenu" 
                             class="download-options absolute hidden bg-white dark:bg-gray-700 shadow-lg rounded py-2 z-50 w-36"
                             on:mouseenter={() => document.getElementById('floatingPanelDownloadMenu').classList.remove('hidden')}
                             on:mouseleave={() => document.getElementById('floatingPanelDownloadMenu').classList.add('hidden')}>
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
                             on:mouseenter={() => document.getElementById('floatingPanelComparisonMenu').classList.remove('hidden')}
                             on:mouseleave={() => {
                                setTimeout(() => {
                                  const menu = document.getElementById('floatingPanelComparisonMenu');
                                  const isHovered = menu.matches(':hover');
                                  if (!isHovered) {
                                    menu.classList.add('hidden');
                                  }
                                }, 100);
                             }}
                             on:focus={() => document.getElementById('floatingPanelComparisonMenu').classList.remove('hidden')}>
                            <button class="text-gray-700 hover:text-primary transition-colors flex items-center">
                                <span>机构轨迹对比</span>
                            </button>
                            <div id="floatingPanelComparisonMenu" 
                                 class="absolute hidden bg-white dark:bg-gray-700 shadow-lg rounded py-2 z-50 w-36 left-1/2 transform -translate-x-1/2"
                                 style="top: 100%; margin-top: 5px;"
                                 on:mouseenter={() => document.getElementById('floatingPanelComparisonMenu').classList.remove('hidden')}
                                 on:mouseleave={() => document.getElementById('floatingPanelComparisonMenu').classList.add('hidden')}>
                                <button class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                        on:click={() => dispatch('showPatentComparison')}>专利机构对比</button>
                                <button class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                        on:click={() => dispatch('showPaperComparison')}>论文机构对比</button>
                            </div>
                        </div>
                        <button 
                            class="text-gray-700 hover:text-primary transition-colors"
                            on:click={() => dispatch('showCooperate')}
                        >
                            产研合作
                        </button>
                        <button 
                            class={searchType === 'patents' ? "text-primary font-medium hover:text-primary/80" : "text-gray-700 hover:text-primary transition-colors"}
                            on:click={() => handleTypeChange('patents')}
                        >
                            专利轨迹分析
                        </button>
                        <button 
                            class={searchType === 'papers' ? "text-primary font-medium hover:text-primary/80" : "text-gray-700 hover:text-primary transition-colors"}
                            on:click={() => handleTypeChange('papers')}
                        >
                            论文轨迹分析
                        </button>
                    </div>
                
                <!-- 关闭按钮 -->
                <button 
                    class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    on:click={closePanel1}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                </div>
            </div>
            
            <!-- 搜索区域 - 自己负责滚动 -->
            <div class="flex-grow overflow-hidden">
                {#if searchType === 'patents'}
                    <PatentSearch 
                        darkMode={isDarkMode}
                        on:searchComplete={handleSearchComplete}
                        on:resultClick={handleResultClick}
                        on:analyzePatent={handleAnalyzePatent}
                        on:analyzeApplicant={handleAnalyzeApplicant}
                        on:analyzeInventor={handleAnalyzeInventor}
                    />
                {:else if searchType === 'papers'}
                    <PaperSearch 
                        darkMode={isDarkMode}
                        on:searchComplete={handleSearchComplete}
                        on:resultClick={handleResultClick}
                        on:generateReport={handleGenerateReport}
                        on:analyzeInstitution={handleAnalyzeInstitution}
                        on:analyzeAuthor={handleAnalyzeAuthor}
                    />
                {:else}
                    <div class="p-4 text-center">
                        未知的搜索类型：{searchType}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{:else}
    <div class="p-4 bg-white dark:bg-gray-800 rounded shadow-lg">
        <div class="text-center text-gray-800 dark:text-gray-200">
            请设置 fullscreen=true 以显示搜索界面
        </div>
    </div>
{/if}

<style>
    /* 添加样式确保精确重合 */
    :global(.fixed-panel) {
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
    }
    
    /* 确保内部div填满容器 */
    div[bind\:this="panelElement"] {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        border-radius: 0 !important;
        box-shadow: none !important;
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
</style>

<!-- 在组件模板中添加事件监听 -->
<svelte:window on:analysisRequest={handleAnalysisRequest}/>