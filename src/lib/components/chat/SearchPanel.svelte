<script>
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();

    export let searchQuery = "";
    export let searchResults = [];
    export let isLoading = false;

    function handleSearch() {
        dispatch('search');
    }

    function handleLocate(result) {
        dispatch('locate', { 
            lat: result.lat,
            lon: result.lon,
            name: result.name || result.display_name
        });
    }
</script>

<div class="search-panel">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 max-h-[80vh] overflow-y-auto">
        <!-- 头部 -->
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold">机构搜索</h3>
            <button 
                on:click={() => dispatch('close')}
                class="text-gray-500 hover:text-gray-700"
            >
                ✕
            </button>
        </div>

        <!-- 搜索输入 -->
        <div class="flex gap-2 mb-4">
            <input 
                bind:value={searchQuery}
                type="text" 
                placeholder="输入机构名称..."
                class="flex-1 px-3 py-2 border rounded-md"
                on:keydown={(e) => e.key === 'Enter' && handleSearch()}
            >
            <button 
                on:click={handleSearch}
                class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md"
            >
                搜索
            </button>
        </div>

        <!-- 加载状态 -->
        {#if isLoading}
            <div class="text-center py-4 text-gray-500">
                <svg class="animate-spin h-5 w-5 mr-3 ..." viewBox="0 0 24 24">
                    <!-- 加载动画SVG -->
                </svg>
                搜索中...
            </div>
        {:else}
            <!-- 搜索结果 -->
            <div class="space-y-3">
                {#each searchResults as result}
                    <div 
                        class="p-3 border rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                        on:click={() => handleLocate(result)}
                    >
                        <div class="font-medium">{result.name}</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400">
                            纬度: {result.lat.toFixed(4)}, 经度: {result.lon.toFixed(4)}
                        </div>
                    </div>
                {:else}
                    <div class="text-gray-500 text-center py-4">
                        {#if searchQuery}
                            未找到相关结果
                        {:else}
                            请输入机构名称进行搜索
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .search-panel {
        z-index: 1000;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    }

    @media (max-width: 640px) {
        .search-panel {
            width: 90vw;
            right: 0;
        }
    }
</style>