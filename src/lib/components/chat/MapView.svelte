<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import Home from './homepage/home.svelte';
    import SearchPanel from './SearchPanel.svelte';
    import { searchNearbyInstitutions } from './elasticsearch/elasticsearch_paper/index.js';
    import { WEBUI_NAME} from '$lib/stores';
    // 可以添加任何需要的属性
    export let initialCoordinates = [39.9042, 116.4074]; // 默认坐标（北京）
    export let zoom = 13; // 默认缩放级别
    // 添加这一行接收initNewChat作为属性
    export let initNewChat = () => {}; // 默认为空函数
    
    // 地图实例引用
    let map;
    let marker;
    let markers;
    let coordinates = "Loading...";
    let lastUpdated = new Date().toLocaleString();
    let institutionName = "";
    let isSearchPanelVisible = false;
    let searchResults = [];
    let searchQuery = "";
    let isLoading = false;
    let isMapLoading = true;
    let rectangleCorners = null;
    // 浮动窗口状态
    let isPanelVisible = false;
    let drawnItems;
    // 浮动窗口状态 - 控制 Home 和 FloatingPanel 的显示
    let isHomeVisible = false; // 默认不显示首页
    let isFloatingPanelVisible = false;
    let preRendered = false;
    
    // 引用主内容区和容器
    let mainContentElement = null;
    let mapContainer;
    let markerCache = new Map();
    
    // 位置信息内容 - 将传递给 Home 和 FloatingPanel
    $: locationInfo = {
        title: "位置信息",
        coordinates,
        institutionName,
        lastUpdated,
        rectangleCorners
    };

    const dispatch = createEventDispatcher();
    

    // 添加可见标记更新函数
    function updateVisibleMarkers() {
        const bounds = map.getBounds();
        const zoom = map.getZoom();
        let visibleCount = 0;
                
        markers.eachLayer((layer) => {
            if (bounds.contains(layer.getLatLng())) {
                visibleCount++;
            }
        });
                
        // 如果可见点数量过多，调整聚合
        if (visibleCount > 10000) {
            markers.options.maxClusterRadius = Math.min(100, markers.options.maxClusterRadius + 20);
            markers.refreshClusters();
        }
    }

    // 辅助函数：将地理坐标范围转换为瓦片范围
    function getTileBoundsForLatLngBounds(bounds, zoom) {
        const min = map.project(bounds.getSouthWest(), zoom);
        const max = map.project(bounds.getNorthEast(), zoom);
        
        return {
            min: {
                x: Math.floor(min.x / 256),
                y: Math.floor(min.y / 256)
            },
            max: {
                x: Math.floor(max.x / 256),
                y: Math.floor(max.y / 256)
            }
        };
    }


    // 区域分析处理函数
    window.startAreaAnalysis = function() {
        if (window.currentAreaData) {
            const { bounds, institutions } = window.currentAreaData;
            
            // 构建简化的 GeoJSON 对象
            const geoJSON = {
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [[
                        [bounds.getWest(), bounds.getNorth()],
                        [bounds.getEast(), bounds.getNorth()],
                        [bounds.getEast(), bounds.getSouth()],
                        [bounds.getWest(), bounds.getSouth()],
                        [bounds.getWest(), bounds.getNorth()] // 闭合多边形
                    ]]
                }
            };
            
            // 调用我们新定义的方法
            window.mapInstance.triggerAreaAnalysis(geoJSON, institutions);
            
            // 关闭地图弹窗
            map.closePopup();
        }
    };


    window.generateReportFromArea = function() {
        // 添加调试日志
        console.log('generateReportFromArea 被调用');
        if (drawnItems && drawnItems.getLayers().length > 0) {
            const rectangle = drawnItems.getLayers()[0];
            if (rectangle) {
                const bounds = rectangle.getBounds();
                
                const nw = [bounds.getNorth().toFixed(4), bounds.getWest().toFixed(4)];
                const se = [bounds.getSouth().toFixed(4), bounds.getEast().toFixed(4)];

                // 构建 GeoJSON 对象
                const geoJSON = {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [bounds.getWest(), bounds.getNorth()],
                            [bounds.getEast(), bounds.getNorth()],
                            [bounds.getEast(), bounds.getSouth()],
                            [bounds.getWest(), bounds.getSouth()]
                        ]]
                    }
                };
                
                // 创建分析提示
                const areaPrompt = `请分析该区域内的机构分布：${JSON.stringify(geoJSON)}`;

                // 创建自定义弹窗
                const customPopup = L.popup({
                    className: 'custom-popup',
                    closeButton: true,
                    autoClose: true,
                    closeOnEscapeKey: true
                });

                // 创建弹窗内容元素
                const popupContent = document.createElement('div');
                popupContent.className = 'select-area-info';
                popupContent.innerHTML = `
                    <h3 class="font-bold mb-2">已选择区域</h3>
                    <p>范围: ${nw[0]}, ${nw[1]} 至 ${se[0]}, ${se[1]}</p>
                    
                    <button id="area-analysis-btn" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm mt-2">
                        分析该区域
                    </button>
                `;

                // 在矩形中心显示弹窗
                customPopup
                    .setLatLng(bounds.getCenter())
                    .setContent(popupContent)
                    .openOn(map);

                // 添加按钮点击事件处理
                setTimeout(() => {
                    const btn = popupContent.querySelector('#area-analysis-btn');
                    if (btn) {
                        // 确保使用一致的ID格式
                        btn.onclick = () => generateReportWithPrompt(areaPrompt, '区域主题轨迹报告');
                    }
                }, 0);

                // 存储当前区域数据供后续使用
                window.currentAreaData = {
                    bounds,
                    
                };
            } else {
                console.error('未找到绘制的图形');
            }
        }
    };

    async function getInstitutionName(point) {
        try {
            // 示例：用瓦片服务的接口获取机构名称
            const response = await fetch(`http://81.70.12.153:3000/institution-name?lat=${point.lat}&lng=${point.lng}`);
            const data = await response.json();

            // 假定返回数据包含机构名称
            return data.name || `机构 (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`;
        } catch (error) {
            console.error('获取机构名称失败:', error);
            return '未知机构';
        }
    }
// 添加瓦片加载队列
const loadQueue = new Set();
    const MAX_CONCURRENT_LOADS = 4;

    //瓦片服务
    async function loadTileLayer() {
        if (!map) {
            console.error('地图实例不存在');
            return;
        }
        console.log('开始加载所有图层');
        try {
            const LEVEL_CONFIG = {
                worldwide: { zoom_range: [0, 2], search_radius: "1000km" },
                continent: { zoom_range: [3, 4], search_radius: "500km" },
                country: { zoom_range: [5, 6], search_radius: "100km" },
                region: { zoom_range: [7, 8], search_radius: "50km" },
                city: { zoom_range: [9, 9], search_radius: "10km" },
                district: { zoom_range: [10, 11], search_radius: "5km" },
                street: { zoom_range: [12, 14], search_radius: "1km", autoLocate: true},
                detail: { zoom_range: [15, 17], search_radius: "0.5km", autoLocate: true}
            };

            const layers = {};

            // 基础图层类
            const BasePointLayer = L.TileLayer.extend({
                initialize: function(url, options) {
                    L.TileLayer.prototype.initialize.call(this, url, options);
                    this._cache = new Map();
                    this.on('loading', () => console.log(`开始加载图层: ${options.layerName}`));
                    this.on('load', () => {
                        console.log(`图层加载完成: ${options.layerName}`);
                        console.log('瓦片缓存大小:', this._cache.size);
                        console.log('当前可见瓦片数:', Object.keys(this._tiles).length);
                    });
                    // 添加移动监听
                    if (this._map) {
                        this._map.on('movestart', () => {
                            this._preloadTiles();
                        });

                        this._map.on('move', L.Util.throttle(() => {
                            this._preloadTiles();
                        }, 250));
                        this._map.on('zoomend', () => {
                            this._preloadAdjacentLevels(); // 缩放结束时预加载相邻层级
                            this._cleanupUnusedLayers(); // 清理不需要的图层
                        });
                    }
                },
                    // 新增：预加载相邻层级
                    _preloadAdjacentLevels: function() {
                    if (this.options.opacity === 0) return;
                    const currentZoom = this._map.getZoom();
                    const layerConfig = LEVEL_CONFIG[this.layerName];
                    
                    // 扩大预加载范围到±2个缩放级别
                    Object.entries(LEVEL_CONFIG).forEach(([level, config]) => {
                        // 预加载相邻层级
                        if (Math.abs(config.zoom_range[0] - currentZoom) <= 2) {
                            this._ensureLayerLoaded(level);
                            // 预加载该层级的瓦片
                            this._preloadTilesForLevel(level);
                        }
                    });
                },

                // 新增：为特定层级预加载瓦片
                _preloadTilesForLevel: function(level) {
                    const layer = layers[level];
                    if (!layer) return;
                    
                    const bounds = this._map.getBounds().pad(0.5);
                    const zoom = LEVEL_CONFIG[level].zoom_range[0];
                    const tileBounds = this._getTileBounds(bounds, zoom);
                    
                    // 优先加载视野范围内的瓦片
                    this._loadVisibleTiles(tileBounds, zoom);
                },

                // 新增：确保图层加载
                _ensureLayerLoaded: function(level) {
                    if (!layers[level]) {
                        const config = LEVEL_CONFIG[level];
                        layers[level] = new BasePointLayer(
                            `http://81.70.12.153:3000/tiles/${level}/{z}/{x}/{y}.png`,
                            {
                                minZoom: config.zoom_range[0],
                                maxZoom: config.zoom_range[1],
                                layerName: level,
                                keepBuffer: 4,
                                updateWhenIdle: false,
                                updateWhenZooming: false,
                                opacity: 0,
                                noWrap: true,
                                reuseTiles: true
                            }
                        );
                        map.addLayer(layers[level]);
                    }
                },
                showLayer: function() {
                    if (this.options.opacity === 1) return;
                    this.setOpacity(1);
                    this._update(); // 确保瓦片更新
                },

                hideLayer: function() {
                    if (this.options.opacity === 0) return;
                    this.setOpacity(0);
                },

                // 新增：清理不需要的图层
                _cleanupUnusedLayers: function() {
                    const currentZoom = this._map.getZoom();
                    Object.entries(layers).forEach(([level, layer]) => {
                        const config = LEVEL_CONFIG[level];
                        if (Math.abs(config.zoom_range[0] - currentZoom) > 2) {
                            map.removeLayer(layer);
                            delete layers[level];
                        }
                    });
                },
                createTile: function(coords, done) {
                    const key = this._tileCoordsToKey(coords);
                    
                    // 添加日志，方便调试
                    console.log(`加载瓦片: ${coords.x}, ${coords.y}, ${coords.z}`);
                    
                    // 缓存检查
                    if (this._cache.has(key)) {
                        const cachedTile = this._cache.get(key);
                        if (done) done(null, cachedTile);
                        return cachedTile;
                    }

                    const tile = new Image();
                    let retryCount = 0;
                    const maxRetries = 3;
                    
                    const loadTile = () => {
                        tile.onload = () => {
                            this._cache.set(key, tile);
                            console.log(`瓦片加载成功: ${coords.x}, ${coords.y}, ${coords.z}`);
                            if (done) done(null, tile);
                        };
                        
                        tile.onerror = (e) => {
                            if (retryCount < maxRetries) {
                                retryCount++;
                                console.log(`重试加载瓦片 ${retryCount}次: ${coords.x}, ${coords.y}, ${coords.z}`);
                                setTimeout(loadTile, 1000 * retryCount); // 递增重试间隔
                            } else if (done) {
                                console.error(`瓦片加载失败: ${coords.x}, ${coords.y}, ${coords.z}`);
                                done(e);
                            }
                        };

                        tile.src = this.getTileUrl(coords);
                    };

                    loadTile();
                    return tile;
                },

                _handleClick: async function(e) {
                    try {
                        const zoom = this._map.getZoom();
                        let searchRadius = "1km";

                        for (const [level, config] of Object.entries(LEVEL_CONFIG)) {
                            if (zoom >= config.zoom_range[0] && zoom <= config.zoom_range[1]) {
                                searchRadius = config.search_radius;
                                break;
                            }
                        }

                        const institutionData = await searchNearbyInstitutions({
                            lat: e.latlng.lat,
                            lon: e.latlng.lng
                        }, searchRadius);
                        
                        // 如果没有搜到机构数据
                        if (!institutionData || !institutionData.location) {
                            // 关闭当前地图上的所有弹窗
                            map.closePopup();
                            return;
                        }

                        const targetLatLng = L.latLng(
                            institutionData.location.lat,
                            institutionData.location.lon
                        );
                        
                        map.flyTo(targetLatLng, map.getZoom(), {
                            duration: 1.5,
                            easeLinearity: 0.25
                        });

                        const marker = L.marker(targetLatLng, {
                            icon: L.divIcon({
                                className: 'institution-marker',
                                html: '<div class="pulse"></div>',
                                iconSize: [15, 15]
                            })
                        }).addTo(map);

                        setTimeout(() => marker.remove(), 3000);

                        // 创建弹窗内容元素
                        const popupContent = document.createElement('div');
                        popupContent.className = 'flex flex-col';
                        popupContent.innerHTML = `
                            <h3 class="font-bold mb-2">${institutionData.name}</h3>
                            <p class="text-sm mb-2">ID: ${institutionData.id || '无'}</p>
                            <p class="text-sm mb-2">坐标: ${institutionData.location.lat.toFixed(4)}, ${institutionData.location.lon.toFixed(4)}</p>
                            <button id="generate-report-btn" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm">
                                生成分析报告
                            </button>
                        `;
                            
                        // 创建并显示弹窗
                        const popup = L.popup()
                            .setLatLng(targetLatLng)
                            .setContent(popupContent)
                            .openOn(map);

                        // 添加按钮点击事件处理
                        setTimeout(() => {
                            const btn = popupContent.querySelector('#generate-report-btn');
                            if (btn) {
                                const affiliationId = institutionData.id || '未知ID';
                                const prompt = `请分析机构"${institutionData.name}"，ID=${affiliationId}`;
                                btn.onclick = () => generateReportWithPrompt(prompt, '机构主题轨迹报告');
                            }
                        }, 0);
                        
                        
                    } catch (error) {
                        console.error('搜索机构失败:', error);
                    }
                },
                _getTileBounds: function(bounds, zoom) {
                    const min = this._map.project(bounds.getSouthWest(), zoom);
                    const max = this._map.project(bounds.getNorthEast(), zoom);
                    return {
                        min: {
                            x: Math.floor(min.x / 256),
                            y: Math.floor(min.y / 256)
                        },
                        max: {
                            x: Math.floor(max.x / 256),
                            y: Math.floor(max.y / 256)
                        }
                    };
                },

                _keyToTileCoords: function(key) {
                    const parts = key.split(':');
                    return {
                        z: parseInt(parts[0], 10),
                        x: parseInt(parts[1], 10),
                        y: parseInt(parts[2], 10)
                    };
                },

                _update: function() {
                    // 调用父类的 _update 方法
                    L.TileLayer.prototype._update.call(this);
                    
                    // 只在图层可见时执行
                    if (this.options.opacity === 0) return;
                    
                    // 获取当前视野范围
                    // const bounds = this._map.getBounds();
                    // const zoom = this._map.getZoom();
                    
                    // 获取当前视野内的瓦片范围
                    // const tileBounds = this._getTileBounds(bounds, zoom);
                    
                    // 显示当前可见瓦片数
                    const visibleTilesCount = Object.keys(this._tiles).length;
                    console.log(`${this.options.layerName} 当前可见瓦片数: ${visibleTilesCount}`);
                    
                    // 加载视野范围内的瓦片
                    // this._loadVisibleTiles(tileBounds, zoom);
                },
                _loadVisibleTiles: function(tileBounds, zoom) {
                    if (loadQueue.size >= MAX_CONCURRENT_LOADS) return;
                    
                    // 遍历视野范围内的瓦片
                    for (let x = tileBounds.min.x - 1; x <= tileBounds.max.x + 1; x++) {
                        for (let y = tileBounds.min.y - 1; y <= tileBounds.max.y + 1; y++) {
                            const coords = {x, y, z: zoom};
                            const key = this._tileCoordsToKey(coords);
                            
                            if (!this._cache.has(key) && !this._tiles[key] && !loadQueue.has(key)) {
                                if (loadQueue.size >= MAX_CONCURRENT_LOADS) break;
                                
                                loadQueue.add(key);
                                this.createTile(coords, (error, tile) => {
                                    loadQueue.delete(key);
                                    if (error) {
                                        console.error(`瓦片加载失败: ${key}`);
                                        return;
                                    }
                                    this._cache.set(key, tile);
                                    this._tiles[key] = {
                                        el: tile,
                                        coords: coords,
                                        current: true
                                    };
                                    this._pruneTiles(); // 清理不需要的瓦片
                                });
                            }
                        }
                    }
                },
                _pruneTiles: function() {
                    if (this.options.opacity === 0) return;
                    const MAX_CACHE_SIZE = 1000;
                    const PRUNE_THRESHOLD = 0.8; // 当使用率达到80%时开始清理
                    
                    if (this._cache.size > MAX_CACHE_SIZE * PRUNE_THRESHOLD) {
                        // 获取当前视野范围
                        const bounds = this._map.getBounds();
                        const zoom = this._map.getZoom();
                        
                        // 将缓存转换为数组，以便排序和筛选
                        const cachedTiles = Array.from(this._cache.entries()).map(([key, tile]) => {
                            const coords = this._keyToTileCoords(key);
                            return {
                                key,
                                tile,
                                coords,
                                // 计算瓦片到当前视野中心的距离
                                distance: this._getDistanceFromCenter(coords, bounds.getCenter(), zoom)
                            };
                        });
                        
                        // 按距离排序，保留距离当前视野较近的瓦片
                        cachedTiles.sort((a, b) => b.distance - a.distance);
                        
                        // 删除距离较远的瓦片
                        const tilesToRemove = cachedTiles.slice(MAX_CACHE_SIZE * 0.6);
                        tilesToRemove.forEach(({key}) => this._cache.delete(key));
                        
                        console.log(`清理了 ${tilesToRemove.length} 个瓦片缓存`);
                    }
                },
                _preloadTiles: function() {
                    const bounds = this._map.getBounds();
                    const zoom = this._map.getZoom();
                    // 扩大预加载范围
                    const expandedBounds = bounds.pad(0.5); // 扩大50%
                    const tileBounds = this._getTileBounds(expandedBounds, zoom);
                    
                    // 优先加载视野内的瓦片
                    this._loadTilesInOrder(tileBounds, zoom);
                },

                // 优先级加载
                _loadTilesInOrder: function(tileBounds, zoom) {
                    const visibleTiles = [];
                    const peripheralTiles = [];
                    
                    for (let x = tileBounds.min.x; x <= tileBounds.max.x; x++) {
                        for (let y = tileBounds.min.y; y <= tileBounds.max.y; y++) {
                            const coords = {x, y, z: zoom};
                            const key = this._tileCoordsToKey(coords);
                            
                            if (this._isInViewport(coords)) {
                                visibleTiles.push({coords, key});
                            } else {
                                peripheralTiles.push({coords, key});
                            }
                        }
                    }
                    
                    // 先加载可见瓦片
                    visibleTiles.forEach(tile => this._loadTile(tile.coords, tile.key));
                    // 再加载周边瓦片
                    peripheralTiles.forEach(tile => this._loadTile(tile.coords, tile.key));
                },

                // 计算瓦片到中心点的距离
                _getDistanceFromCenter: function(coords, center, zoom) {
                    const tileCenter = this._getTileLatLng(coords);
                    return center.distanceTo(tileCenter);
                },

                // 获取瓦片中心点的经纬度
                _getTileLatLng: function(coords) {
                    const tileSize = this.getTileSize();
                    const pixelPoint = L.point(
                        coords.x * tileSize.x + tileSize.x / 2,
                        coords.y * tileSize.y + tileSize.y / 2
                    );
                    return this._map.unproject(pixelPoint, coords.z);
                },
                _removeTiles: function () {
                    if (L.TileLayer.prototype._removeTiles) {
                        L.TileLayer.prototype._removeTiles.call(this);
                    } else {
                        // 手动清理瓦片
                        for (let key in this._tiles) {
                            if (this._tiles[key].el && this._tiles[key].el.parentNode) {
                                this._tiles[key].el.parentNode.removeChild(this._tiles[key].el);
                            }
                        }
                        this._tiles = {};
                    }
                }
            });
            
            const currentZoom = map.getZoom();
            for (const [level, config] of Object.entries(LEVEL_CONFIG)) {
                if (currentZoom >= config.zoom_range[0] && currentZoom <= config.zoom_range[1]) {
                    const layer = new BasePointLayer(
                        `http://81.70.12.153:3000/tiles/${level}/{z}/{x}/{y}.png`, 
                        {
                            minZoom: config.zoom_range[0],
                            maxZoom: config.zoom_range[1],
                            layerName: level,
                            keepBuffer: 4, // 保持更多的瓦片缓存
                            updateWhenIdle: true,
                            updateWhenZooming: true,
                            zIndex: 500,
                            opacity: 1,  
                            noWrap: true,  // 禁止瓦片环绕
                            unloadInvisibleTiles: false,  // 禁止卸载不可见瓦片
                            reuseTiles: true,  // 添加这个选项
                            className: `tile-layer-${level}`,  // 添加唯一类名
                            bounds: L.latLngBounds([-90, -180], [90, 180])  // 添加边界限制
                        }
                    );
                    layers[level] = layer;
                    map.addLayer(layer);
                    layer.setZIndex(500);
                    console.log(`初始加载${level}图层`);
                }
            }
            // 预加载 detail 图层
            if (!layers['detail']) {
                const detailConfig = LEVEL_CONFIG['detail'];
                layers['detail'] = new BasePointLayer(
                    `http://81.70.12.153:3000/tiles/detail/{z}/{x}/{y}.png`,
                    {
                        minZoom: detailConfig.zoom_range[0],
                        maxZoom: detailConfig.zoom_range[1],
                        layerName: 'detail',
                        keepBuffer: 8,
                        updateWhenIdle: false,
                        updateWhenZooming: false,
                        zIndex: 500,
                        opacity: 0, // 初始设置为透明
                        noWrap: true,
                        reuseTiles: true,
                        preload: Infinity,
                        className: 'tile-layer-detail'
                    }
                );
                map.addLayer(layers['detail']);
                console.log('预加载 detail 图层');
            }

            // 添加点击事件处理
            map.on('click', async function(e) {
                const zoom = map.getZoom();
                let currentLayer = null;

                for (const [level, config] of Object.entries(LEVEL_CONFIG)) {
                    if (zoom >= config.zoom_range[0] && zoom <= config.zoom_range[1]) {
                        currentLayer = layers[level];
                        break;
                    }
                }

                if (currentLayer) {
                    await currentLayer._handleClick(e);
                }
            });
            // 监听缩放事件，直接控制图层显示
            let currentLevel = null;
            let _zoomTimer;
            let updateTimer;
            map.on('moveend zoomend', function() {
                clearTimeout(updateTimer);
                updateTimer = setTimeout(() => {
                    const currentZoom = map.getZoom();
                    console.log('当前缩放级别:', currentZoom);
                    
                    for (const [level, config] of Object.entries(LEVEL_CONFIG)) {
                        const layer = layers[level];
                        
                        // 判断是否在当前缩放范围内
                        const isInZoomRange = currentZoom >= config.zoom_range[0] && 
                                            currentZoom <= config.zoom_range[1];

                        if (isInZoomRange) {
                            // 如果图层不存在，创建新图层
                            if (!layer) {
                                layers[level] = new BasePointLayer(
                                    `http://81.70.12.153:3000/tiles/${level}/{z}/{x}/{y}.png`,
                                    {
                                        minZoom: config.zoom_range[0],
                                        maxZoom: config.zoom_range[1],
                                        layerName: level,
                                        keepBuffer: 4,
                                        updateWhenIdle: true,
                                        updateWhenZooming: true,
                                        zIndex: 500,
                                        opacity: 1,
                                        noWrap: true,
                                        unloadInvisibleTiles: false,
                                        reuseTiles: true,
                                        className: `tile-layer-${level}`,
                                        bounds: L.latLngBounds([-90, -180], [90, 180])
                                    }
                                );
                                map.addLayer(layers[level]);
                            } else {
                                // 如果图层存在但未添加到地图，则添加
                                if (!map.hasLayer(layer)) {
                                    map.addLayer(layer);
                                }
                                // 显示图层
                                layer.showLayer();
                            }
                            layer.setZIndex(500);
                            console.log(`${level}图层已激活，当前可见瓦片数：${Object.keys(layer._tiles).length}`);
                        } else if (layer) {
                            // 不在缩放范围内且图层存在，则隐藏
                            layer.hideLayer();
                        }
                    }
                }, 100);
            });

        } catch (error) {
            console.error('加载图层失败:', error);
        }
    }

    // 辅助函数：获取瓦片信息
    function getTileInfo(latlng, zoom) {
        const tileSize = 256;
        const x = Math.floor((latlng.lng + 180) / 360 * Math.pow(2, zoom));
        const y = Math.floor((1 - Math.log(Math.tan(latlng.lat * Math.PI / 180) + 1 / Math.cos(latlng.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
        return { x, y, z: zoom };
    }
    
    // 添加搜索类型状态
    let searchType = 'patents';
    
    onMount(() => {
        WEBUI_NAME.set('科技大数据智能多模查询与分析系统');
        // 只在本 session 第一次加载时调用
        if (!sessionStorage.getItem('mapViewFirstLoaded')) {
            toggleHomePanel();
            sessionStorage.setItem('mapViewFirstLoaded', 'true');
        }
        
        setTimeout(() => {
            mainContentElement = document.querySelector('#chat-container > .flex-1') || 
                                document.querySelector('.flex-1.min-w-0.flex.flex-col') ||
                                document.querySelector('.flex-1');
            console.log("找到主内容区:", mainContentElement);
            
            // 初始化地图的函数（在找到主内容区后初始化地图）
            try {
               // 初始化地图
               if (typeof L !== 'undefined') {
                    initMap();
                } else {
                    console.error('Leaflet 未加载');
                }
            } catch (error) {
                console.error('地图初始化失败:', error);
            } finally {
                isMapLoading = false;
            }
        }, 100);

        

        // 清理函数 - 当组件卸载时执行
        return () => {
            if (map) {
                if (markers) {
                    map.off('moveend', updateVisibleMarkers);
                    markers.clearLayers();
                }
                map.remove();
                markerCache.clear(); // 清理缓存
            }
        };
        
        // 确保在各种情况下都调用面板大小调整
        forceAdjustWithDelay();
        
        // 确保在DOM变化后调整
        observer = new MutationObserver(forceAdjustWithDelay); // Assign to the existing variable
        observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: true 
        });
        
        // 监听窗口大小变化
        window.addEventListener('resize', forceAdjustWithDelay);

        
        // Moved from nested onMount: Initialize window.mapInstance here
        window.mapInstance = {
            triggerReportGeneration,
            triggerAreaAnalysis
        };
        
        // 将函数暴露到全局作用域
        window.generateReportWithPrompt = generateReportWithPrompt;
        
        return cleanup; // Return the cleanup function
    });
    
    function initMap() {
        const L = window.L; // 确保使用全局的 L 对象
        if (!mapContainer) {
            console.error('地图容器未找到');
            return;
        }
        if (typeof L !== 'undefined' && mapContainer) {
            // 初始化地图，设置视图中心和缩放级别
            map = L.map(mapContainer, {
                maxZoom: 17,  // 设置最大缩放级别为17
                minZoom: 3    // 设置最小缩放级别
            }).setView([initialCoordinates[0], initialCoordinates[1]], zoom);            
            // 添加高德图层
            L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
                subdomains: ["1","2","3","4"],
                maxZoom: 17,
                minZoom: 3,
                zIndex: 100  // 明确比你后面的图层低
            }).addTo(map);
                        
            // 添加标记
            // marker = L.marker([initialCoordinates[0], initialCoordinates[1]]).addTo(map);
            // marker.bindPopup("<b>当前位置</b>").openPopup();
            
            // 显示坐标
            coordinates = `${initialCoordinates[0].toFixed(4)}, ${initialCoordinates[1].toFixed(4)}`;
            
            // 等待地图加载完成后再加载瓦片图层
            map.whenReady(() => {
                loadTileLayer();
            });

            // 添加绘制控件
            drawnItems = new L.FeatureGroup().addTo(map);
            const drawControl = new L.Control.Draw({
                draw: {
                    marker: false,
                    circle: false,
                    circlemarker: false,
                    polyline: false,
                    polygon: false,
                    rectangle: {
                        shapeOptions: {
                            color: '#3388ff',
                            weight: 2,
                            opacity: 0.5,
                            fillOpacity: 0.2,
                            dashArray: '5, 5',
                            clickable: true
                        },
                        // 添加以下配置
                        repeatMode: false,  // 禁止重复绘制
                        showArea: true,     // 显示面积
                        metric: true        // 使用公制单位
                    }
                },
                edit: false  // 禁用编辑功能
            });
            map.addControl(drawControl);

             // 添加鼠标松开事件
             map.on('mouseup', () => {
                const handler = map._handler;
                if (handler && handler instanceof L.Draw.Rectangle) {
                    handler.completeShape(); // 强制完成绘制
                    // 可以添加以下代码来确保绘制工具被禁用
                    handler.disable();
                }
            });

            // 绘制开始时清除之前的图形
            map.on(L.Draw.Event.DRAWSTART, () => {
                console.log('开始绘制');
                drawnItems.clearLayers();
            });

            map.on(L.Draw.Event.CREATED, e => {
                console.log('绘制完成', e);
                drawnItems.clearLayers();
                const layer = e.layer;
                drawnItems.addLayer(layer);
                window.generateReportFromArea();
                lastUpdated = new Date().toLocaleString();
            });

            // 确保地图正确渲染
            map.invalidateSize();
        }
    }

    function updateMarker([lat, lng], title) {
        coordinates = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        lastUpdated = new Date().toLocaleString();
        institutionName = title;
        rectangleCorners = null; // 新位置清除选区
        map.flyTo([lat, lng], 15, { animate: true, duration: 1.2 });
        marker.setLatLng([lat, lng]).bindPopup(`<b>${title}</b><br>坐标: ${coordinates}`).openPopup();
        locationInfo = { ...locationInfo, coordinates, institutionName };
        isSearchPanelVisible = false;
    }

    // 机构搜索方法
    async function searchInstitution() {
        console.log('开始搜索:', searchQuery);
        if (!searchQuery) return;
        
        try {
            isLoading = true;
             const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`,
                {
                    headers: {
                        'User-Agent': 'Microsoft-Edge/(1257690997@qq.com)' // 必须添加
                    }
                }
            );
            const data = await response.json();
            searchResults = data.map(result => ({
                name: result.display_name,
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon)
            }));
            // 在 API 响应后添加
            console.log('收到搜索结果:', data);
        } catch (error) {
            console.error("搜索失败:", error);
            searchResults = [];
            dispatch('error', error.message);
        } finally {
        isLoading = false;
        }
    }

    // 定位到搜索结果
    function locateOnMap(coords, name) {
        if (!map || !marker) return;
        
        // 添加动画效果
        map.flyTo(coords, 15, {
            animate: true,
            duration: 1.5
        });
        map.setView(coords, 15);
        coordinates = `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
        lastUpdated = new Date().toLocaleString();
        institutionName = name.split(',')[0];
        marker
            .setLatLng(coords)
            .bindPopup(`<b>${institutionName || "未知机构"}</b><br>坐标: ${coordinates}`)
            .openPopup();
        isSearchPanelVisible = false;
        locationInfo = {
            ...locationInfo,
            coordinates,
            institutionName
        };
    }
    
    // 切换 Home 面板的显示状态
    function toggleHomePanel() {
        console.log("切换首页显示状态，当前状态:", isHomeVisible);
        
        // 如果FloatingPanel正在显示，先关闭它
        if (isFloatingPanelVisible) {
            isFloatingPanelVisible = false;
            // 不要切换Home，直接显示它
            isHomeVisible = true;
            return;
        }
        
        // 先调整面板大小，再切换显示状态
       
            adjustPanelSize();
            isHomeVisible = !isHomeVisible;
            if (map) map.invalidateSize();
      
    }
    
    // 显示FloatingPanel
    function showFloatingPanel() {
        console.log("显示FloatingPanel");
        // 关闭Home面板
        isHomeVisible = false;
        // 显示FloatingPanel
        isFloatingPanelVisible = true;
        
        setTimeout(adjustPanelSize, 100);
    }
    
    // 处理关闭事件
    function handleClose() {
        console.log("处理关闭事件");
        isHomeVisible = false;
        isFloatingPanelVisible = false;
        
        // 确保地图重新渲染以适应布局变化
        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 100);
    }
    
    // 修改处理浮动面板显示的函数
    function handleShowFloatingPanel(event) {
        // 获取事件详情中的搜索类型
        if (event && event.detail && event.detail.searchType) {
            searchType = event.detail.searchType;
        } else {
            searchType = 'patents'; // 默认为专利搜索
        }
        
        showFloatingPanel = true;
        
    }
    
    // 改进adjustPanelSize函数
    function adjustPanelSize() {
        const mapComponent = document.querySelector('.map-component');
        const homePanel = document.getElementById('home-panel');
        if (mapComponent && homePanel) {
            const mapRect = mapComponent.getBoundingClientRect();
            homePanel.style.width = mapRect.left + 'px';
            homePanel.style.left = '0';
            homePanel.style.right = 'auto';
        }
    }
    
    // 确保在多个时间点调用此函数
    function forceAdjustWithDelay() {
        setTimeout(adjustPanelSize, 0);
        setTimeout(adjustPanelSize, 100);
        setTimeout(adjustPanelSize, 300);
    }

   

    function generateReportWithPrompt(prompt, modelName) {
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

<div class="map-component w-full h-full flex flex-col relative">
    <!-- 地图容器 - 占满整个区域 -->
    <div bind:this={mapContainer} class="w-full h-full absolute inset-0 z-10"></div>
    
    <!-- 操作按钮 - 横向排列在右上角 -->
    <div class="absolute right-4 top-4 z-20 flex flex-row gap-2">
        <!-- 显示信息按钮 -->
        <button 
            class="w-auto h-10 bg-white shadow-md flex items-center justify-center transition-all hover:bg-gray-100 px-3"
            on:click={toggleHomePanel}
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <span class="text-base font-medium">检索系统</span>
        </button>
        
    </div>
    
    <!-- 搜索面板 -->
    {#if isSearchPanelVisible}
        <SearchPanel 
            bind:searchQuery
            {searchResults}
            {isLoading}
            on:search={searchInstitution}
            on:locate={e => locateOnMap([e.detail.lat, e.detail.lon], e.detail.name)}
            on:close={() => isSearchPanelVisible = false}
            mainContentRef={mainContentElement}
        />
    {/if}
</div>

<!-- Home 面板 -->
<div
  class="fixed-panel home-panel"
  id="home-panel"
  style:display={isHomeVisible ? 'flex' : 'none'}
>
  <Home 
    mainContentRef={mainContentElement}
    on:close={handleClose}
    on:showFloatingPanel={handleShowFloatingPanel}
    info={locationInfo}
    fullscreen={true}
    {initNewChat}
  />
</div>



<svelte:head>
    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    
    <!-- Leaflet JS -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

    <!-- Leaflet.draw CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css" />
    
    <!-- Leaflet.draw JS -->
    <script src="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js"></script>

    <!-- MarkerCluster CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />
    
    <!-- MarkerCluster JS -->
    <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js"></script>
</svelte:head>

<style>
    /* 确保地图组件和容器占满全高 */
    .map-component {
        display: flex;
        flex-direction: column;
        height: 100%;
        position: relative;
        z-index: 1;
    }
    
    /* 确保地图正确显示 */
    :global(.leaflet-container) {
        z-index: 1;
        height: 100%;
        min-height: 200px; /* 设置最小高度，防止过小 */
    }



    /* 确保搜索面板在顶层 */
    :global(.search-panel) {
        position: fixed;
        z-index: 1000;
        right: 20px;
        top: 80px;
    }
    /* 聚合点样式 */
    :global(.marker-cluster-small) {
        background-color: rgba(181, 226, 140, 0.6);
    }
    :global(.marker-cluster-small div) {
        background-color: rgba(110, 204, 57, 0.6);
    }
    :global(.marker-cluster-medium) {
        background-color: rgba(241, 211, 87, 0.6);
    }
    :global(.marker-cluster-medium div) {
        background-color: rgba(240, 194, 12, 0.6);
    }
    :global(.marker-cluster-large) {
        background-color: rgba(253, 156, 115, 0.6);
    }
    :global(.marker-cluster-large div) {
        background-color: rgba(241, 128, 23, 0.6);
    }
     /* 自定义弹出框样式 */
    :global(.leaflet-popup-content) {
        margin: 10px;
    }
    
    :global(.leaflet-popup-content button) {
        margin-top: 8px;
        width: 100%;
        transition: background-color 0.2s;
    }
    
    :global(.leaflet-popup-content h3) {
        margin: 0;
        color: #333;
    }
    
    :global(.leaflet-popup-content p) {
        margin: 4px 0;
        color: #666;
    }
    /* 选区样式 */
    :global(.leaflet-draw-tooltip) {
        background: rgba(0, 0, 0, 0.7);
        border: none;
        border-radius: 4px;
        color: white;
    }

    :global(.select-area-info) {
        min-width: 200px;
    }

    :global(.select-area-info button) {
        width: 100%;
        margin-top: 8px;
    }

    /* 绘制时的矩形样式 */
    :global(.leaflet-draw-rectangle) {
        cursor: crosshair;
    }
    
    :global(.tile-loading) {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.8);
        padding: 10px;
        border-radius: 4px;
        z-index: 1000;
    }

    /* 修改 fixed-panel 样式 */
    .fixed-panel {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        height: 100vh !important;
        z-index: 999 !important;
        background-color: white;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        overflow: hidden !important;
        display: flex ;
        flex-direction: column !important;
        padding: 0 !important;
        margin: 0 !important;
    }
    
    /* 强制确保fixed-panel定位正确 */
    .home-panel {
        z-index: 2000 !important;
    }
    
    /* 确保地图组件始终显示在panel右侧 */
    .map-component {
        position: relative;
        z-index: 1;
        right: 0;
        height: 100%;
    }
    
    /* 如果是暗色模式，添加深色背景 */
    :global(.dark) .fixed-panel {
        background-color: #1f2937;
    }
    
    /* 确保两个面板使用相同的基础样式 */
    #home-panel, #floating-panel {
        transition: width 0.1s ease-out;
    }
    
    /* 确保fixed-panel正确显示 */
    .fixed-panel {
        display: flex;
        flex-direction: column !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
    }

    /* 按钮样式 */
    :global(.rounded-button) {
        border-radius: 8px;
    }
    
    /* :global(.ri-search-line)::before,
    :global(.ri-menu-fold-line)::before,
    :global(.ri-menu-unfold-line)::before {
        content: "\f3c2";
    } */
    
    /* 确保地图容器撑满整个区域 */
    .map-component {
        width: 100%;
        height: 100%;
        position: relative;
        overflow: hidden;
    }

    /* 地图控制按钮样式 */
    .map-component button {
        border: 1px solid rgba(0,0,0,0.1);
    }
    
    .map-component button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
</style>