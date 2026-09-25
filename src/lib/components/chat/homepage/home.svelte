<script>
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import Homebody from './homebody.svelte';
    import FloatingPanel from '../FloatingPanel.svelte'; // 导入浮动面板组件
    import Cooperate from './cooperate.svelte'; // 导入产研合作组件
    import Comparison from './comparison.svelte'; // 导入机构对比组件
    import ComparisonPaper from './comparison_paper.svelte'; // 导入论文机构对比组件
    
    // 添加 initNewChat 作为属性
    export let initNewChat;
    
    const dispatch = createEventDispatcher();
    let homePanel;
    let resizeTimer;
    
    // 1. 回归使用条件渲染但改进状态管理
    let currentPanel = 'home'; // 默认显示主页
    let searchType = 'patents';
    // 不再需要双击检测变量
    
    onMount(() => {
        // 添加事件监听器
        const handleHomeClose = () => {
            dispatch('close');
        };
        
        // 监听关闭事件
        window.addEventListener('home:close', handleHomeClose);
        
        // 添加到 onMount 钩子中
        function alignPanels() {
            const homePanel = document.querySelector('.panel-inner');
            const searchPanel = document.querySelector('.search-panel-container');
            const floatingPanel = document.querySelector('.floating-panel');
            
            if (homePanel && searchPanel) {
                const rect = homePanel.getBoundingClientRect();
                searchPanel.style.top = `${rect.top}px`;
                searchPanel.style.left = `${rect.left}px`;
                searchPanel.style.width = `${rect.width}px`;
                searchPanel.style.height = `${rect.height}px`;
                
                // 确保浮动面板也有相同的尺寸
                if (floatingPanel) {
                    floatingPanel.style.width = '100%';
                    floatingPanel.style.height = '100%';
                }
            }
        }
        
        // 监听窗口大小变化
        window.addEventListener('resize', alignPanels);
        setTimeout(alignPanels, 100); // 初始调整
        
        // 添加函数处理全局事件
        function handleOpenFloatingPanel(event) {
            const { type } = event.detail;
            // 设置正确的面板状态
            searchType = type;
            currentPanel = 'search';
        }
        
        // 添加事件监听器
        window.addEventListener('openFloatingPanel', handleOpenFloatingPanel);
        
        return () => {
            // window.removeEventListener('resize', adjustSize);
            // document.removeEventListener('click', adjustSize);
            if (resizeTimer) clearTimeout(resizeTimer);
            // observer.disconnect();
            // unsubscribe();
            window.removeEventListener('home:close', handleHomeClose);
            window.removeEventListener('resize', alignPanels);
            window.removeEventListener('openFloatingPanel', handleOpenFloatingPanel);
        };
    });
    
    // 修改处理函数，统一处理所有导航事件
    function handlePanelEvents(event) {
        const type = event.detail;
        switch(type) {
            case 'patents':
            case 'showPatent':
                showPatentPanel();
                break;
            case 'papers':
            case 'showPaper':
                showPaperPanel();
                break;
            case 'showCooperate':
                showCooperate();
                break;
            case 'showComparison':
            case 'showPatentComparison':
                showComparison();
                break;
            case 'showPaperComparison':
                showPaperComparison();
                break;
        }
    }
    
    // 2. 修改面板切换函数，先设置新面板再关闭旧面板
    function showPatentPanel() {
        // 先检查当前是否已在搜索页面，是则只需更改搜索类型
        if (currentPanel === 'search') {
            // 如果已经在搜索页面，并且当前类型已是patents，则执行重置
            if (searchType === 'patents') {
                // 通知搜索组件重置状态
                const resetEvent = new CustomEvent('reset-search-type', { 
                    detail: { type: searchType },
                    bubbles: true
                });
                document.dispatchEvent(resetEvent);
            } else {
                // 发送事件通知当前面板保存滚动位置
                const searchPanel = document.querySelector('.sui-layout');
                if (searchPanel) {
                    searchPanel.dispatchEvent(new CustomEvent('save-search-state', { bubbles: true }));
                }
                // 设置为专利搜索类型
                searchType = 'patents';
            }
        } else {
            // 不在搜索页面则正常切换
            searchType = 'patents';
            setTimeout(() => {
                currentPanel = 'search';
            }, 0);
        }
    }

    function showPaperPanel() {
        // 先检查当前是否已在搜索页面，是则只需更改搜索类型
        if (currentPanel === 'search') {
            // 如果已经在搜索页面，并且当前类型已是papers，则执行重置
            if (searchType === 'papers') {
                // 通知搜索组件重置状态
                const resetEvent = new CustomEvent('reset-search-type', { 
                    detail: { type: searchType },
                    bubbles: true
                });
                document.dispatchEvent(resetEvent);
            } else {
                // 发送事件通知当前面板保存滚动位置
                const searchPanel = document.querySelector('.sui-layout');
                if (searchPanel) {
                    searchPanel.dispatchEvent(new CustomEvent('save-search-state', { bubbles: true }));
                }
                // 设置为论文搜索类型
                searchType = 'papers';
            }
        } else {
            // 不在搜索页面则正常切换
            searchType = 'papers';
            setTimeout(() => {
                currentPanel = 'search';
            }, 0);
        }
    }

    function showCooperate() {
        currentPanel = 'cooperate';
    }
    
    function showComparison() {
        currentPanel = 'comparison';
    }
    
    function showPaperComparison() {
        currentPanel = 'paperComparison';
    }

    function handlePanelClose() {
        currentPanel = 'home';
    }
    

    function handlePanelChange(event) {
        currentPanel = event.detail.panel;
    }
</script>

<div bind:this={homePanel} class="home-absolute-panel">
    <div class="panel-inner bg-white dark:bg-gray-800 rounded overflow-hidden shadow-lg w-full h-full"
         style={currentPanel !== 'home' ? 'visibility: hidden; position: absolute;' : ''}>
        <!-- 顶部标题栏 -->
        <div class="flex justify-between items-center p-3 border-b border-gray-200 dark:border-gray-700">
            <!-- 左侧标题 -->
            <div class="flex items-center">
                <span class="text-lg font-medium">科技大数据智能多模查询与分析系统</span>
                <!-- 修改下载按钮及下拉菜单 -->
                <div class="download-container ml-2 relative"
                     on:mouseenter={() => document.getElementById('homeDownloadMenu').classList.remove('hidden')}
                     on:mouseleave={() => {
                        setTimeout(() => {
                          const menu = document.getElementById('homeDownloadMenu');
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
                    <div id="homeDownloadMenu" 
                         class="download-options absolute hidden bg-white dark:bg-gray-700 shadow-lg rounded py-2 z-50 w-36"
                         on:mouseenter={() => document.getElementById('homeDownloadMenu').classList.remove('hidden')}
                         on:mouseleave={() => document.getElementById('homeDownloadMenu').classList.add('hidden')}>
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
                         on:mouseenter={() => document.getElementById('homeComparisonMenu').classList.remove('hidden')}
                         on:mouseleave={() => {
                            // 添加延时，让鼠标有时间移动到下拉菜单
                            setTimeout(() => {
                              const menu = document.getElementById('homeComparisonMenu');
                              const isHovered = menu.matches(':hover');
                              if (!isHovered) {
                                menu.classList.add('hidden');
                              }
                            }, 100);
                         }}
                         on:focus={() => document.getElementById('homeComparisonMenu').classList.remove('hidden')}>
                        <button class="text-gray-700 hover:text-primary transition-colors flex items-center">
                            <span>机构轨迹对比</span>
                        </button>
                        <div id="homeComparisonMenu" 
                             class="absolute hidden bg-white dark:bg-gray-700 shadow-lg rounded py-2 z-50 w-36 left-1/2 transform -translate-x-1/2"
                             style="top: 100%; margin-top: 5px;"
                             on:mouseenter={() => document.getElementById('homeComparisonMenu').classList.remove('hidden')}
                             on:mouseleave={() => document.getElementById('homeComparisonMenu').classList.add('hidden')}>
                            <button class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                    on:click={showComparison}>专利机构对比</button>
                            <button class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                    on:click={showPaperComparison}>论文机构对比</button>
                        </div>
                    </div>
                    <button 
                      class="text-gray-700 hover:text-primary transition-colors"
                      on:click={showCooperate}
                    >
                      产研合作
                    </button>
                    <button 
                      class="text-gray-700 hover:text-primary transition-colors"
                      on:click={showPatentPanel}
                    >
                      专利轨迹分析
                    </button>
                    <button 
                      class="text-gray-700 hover:text-primary transition-colors"
                      on:click={showPaperPanel}
                    >
                      论文轨迹分析
                    </button>
                </div>
                
                <!-- 关闭按钮 -->
                <button 
                    class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    on:click={() => dispatch('close')}
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
                <Homebody {initNewChat} />
            </div>
        </div>
    </div>
    
    <!-- 使用条件渲染来显示活动面板 -->
    {#if currentPanel === 'search'}
        <div class="search-panel-container">
            <FloatingPanel
                {initNewChat}
                searchType={searchType} 
                on:close={handlePanelClose}
                on:typeChange={handlePanelEvents}
                on:showCooperate={showCooperate}
                on:showPatentComparison={showComparison}
                on:showPaperComparison={showPaperComparison}
                title={searchType === 'patents' ? "专利检索" : "论文检索"}
                fullscreen={true}
            />
        </div>
    {:else if currentPanel === 'cooperate'}
        <div class="search-panel-container">
            <Cooperate 
                on:close={handlePanelClose}
                on:showPatent={showPatentPanel}
                on:showPaper={showPaperPanel}
                on:showCooperate={showCooperate}
                on:showPatentComparison={showComparison}
                on:showPaperComparison={showPaperComparison}
                on:panelChange={handlePanelChange}
                {initNewChat}
            />
        </div>
    {:else if currentPanel === 'comparison'}
        <div class="search-panel-container">
            <Comparison 
                on:close={handlePanelClose}
                on:showPatent={showPatentPanel}
                on:showPaper={showPaperPanel}
                on:showCooperate={showCooperate}
                on:showPaperComparison={showPaperComparison}
                on:panelChange={handlePanelChange}
                {initNewChat}
            />
        </div>
    {:else if currentPanel === 'paperComparison'}
        <div class="search-panel-container">
            <ComparisonPaper 
                on:close={handlePanelClose}
                on:showPatent={showPatentPanel}
                on:showPaper={showPaperPanel}
                on:showCooperate={showCooperate}
                on:showPatentComparison={showComparison}
                on:panelChange={handlePanelChange}
                {initNewChat}
            />
        </div>
    {/if}
</div>

<style>
    /* 确保home-absolute-panel撑满父容器 */
    .home-absolute-panel {
        width: 100% ;
        height: 100% ;
        display: flex ;
        flex-direction: column;
    }
    
    /* 确保内部panel-inner撑满home-absolute-panel */
    .panel-inner {
        flex: 1 ;
        width: 100% ;
        height: 100% ;
        display: flex ;
        flex-direction: column;
        margin: 0 ;
        padding: 0 t;
        border-radius: 0 ; /* 移除圆角 */
        box-shadow: none ; /* 移除阴影 */
    }
    
    :global(.dark) .home-absolute-panel {
        background-color: #1f2937;
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
    
    /* 滚动条样式 */
    .content-area::-webkit-scrollbar {
        width: 8px;
    }
    
    .content-area::-webkit-scrollbar-track {
        background: #f1f1f1;
    }
    
    .content-area::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
    }
    
    .content-area::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
    
    :global(.dark) .content-area::-webkit-scrollbar-track {
        background: #2d3748;
    }
    
    :global(.dark) .content-area::-webkit-scrollbar-thumb {
        background: #4a5568;
    }
    
    :global(.dark) .content-area::-webkit-scrollbar-thumb:hover {
        background: #718096;
    }
    
    /* 确保搜索面板容器占满空间 */
    .search-panel-container {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        z-index: 50;
        display: flex !important;
    }
    
    /* 确保FloatingPanel组件占满父容器 */
    :global(.search-panel-container .floating-panel) {
        width: 100% !important;
        height: 100% !important;
        position: absolute ;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
    }
    
    :global(.search-panel-container .floating-panel > div) {
        width: 100% !important;
        height: 100% !important;
        position: absolute ;
        top: 0 !important;
        left: 0 !important;
        flex: 1 !important;
        display: flex;
        flex-direction: column !important;
    }

    .download-options {
        top: 100%;
        left: 0;
        margin-top: -2px; /* 负边距确保无缝连接 */
        padding-top: 8px; /* 增加顶部内边距确保视觉上与按钮分开 */
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