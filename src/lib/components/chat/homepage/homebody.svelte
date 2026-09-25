<script>
  import { onMount } from 'svelte';
  import Markdownpage from './Markdownpage.svelte';
  import ScholarOverlay from './ScholarOverlay.svelte';
  import { dbConfig, getAllApiUrls } from './databaseconfig.js';

  // 添加 initNewChat 作为属性
  export let initNewChat;

  let currentSlide = 0;
  let slidesContainer;
  let dotsContainer;
  let slides = [];
  let dots = [];

  // 添加Markdown显示状态控制
  let showMarkdown = false;
  let markdownTitle = "";
  let markdownType = "article";
  let markdownContent = "";

  // 数据存储变量
  let newsData = [];        // 平台动态
  let servicesData = [];    // 技术服务
  let researchData = [];    // 研究成果
  let partnersData = [];    // 合作伙伴
  let isLoading = true;     // 加载状态

  // 搜索框下拉菜单相关变量
  let dataSourceText = "论文";
  let entityTypeText = "作者";
  let dataSourceActive = false;
  let entityTypeActive = false;
  
  // 搜索建议相关变量
  let searchInput = "";
  let searchTerm = "";
  let searchId = null;
  let searchAffiliation = null; // 存储机构信息
  let searchSuggestions = [];
  let showSearchSuggestions = false;
  let isSearching = false;

  // 学术作者查询相关变量
  const SCHOLAR_AUTHORS_URL = "http://81.70.12.153:8060/search/authors";
  const SCHOLAR_PUBLICATIONS_URL = "http://81.70.12.153:8060/search/publications";
  let scholarInput = "";
  let scholarTerm = "";
  let scholarSuggestions = [];
  let showScholarSuggestions = false;
  let isScholarSearching = false;
  let isScholarQuerying = false;
  let scholarSelectedAuthorId = null;
  let scholarPublications = [];
  let scholarSuggestionTimer;
  let showScholarResults = false;
  let scholarResultsData = { authorName: "", authorId: "", count: 0, papers: [] };
  let scholarDownloadUrl = "";

  // 添加新增机构输入框相关变量
  let affiliationInput = "";
  let affiliationTerm = "";
  let affiliationId = null;
  let affiliationSuggestions = [];
  let showAffiliationSuggestions = false;
  let isAffiliationSearching = false;
  let displayedAffiliationSuggestions = [];
  let affiliationCurrentPage = 1;
  let hasMoreAffiliationSuggestions = false;
  let affiliationSuggestionTimer;
  let affiliationLastQueryKey = "";
  let affiliationEsFrom = 0;
  let affiliationEsHasMore = false; // 专利聚合一次性返回所有结果，不需要分页
  let affiliationSuggestionsSeen = new Set();

  // 渲染分页（前端限制一次渲染过多）
  let displayedSuggestions = [];
  let currentPage = 1;
  const suggestionsPerPage = 200;
  let hasMoreSuggestions = false;

  // ES数据库URL
  const PATENT_ES_URL = "http://81.70.12.153:9388/patents/_search";
  const PAPER_ES_URL = "http://81.70.12.153:9388/sci_papers_v2_new/_search";

  // ES分页（服务端侧）参数与状态（用于 inner_hits 方案）
  // 修改 ES分页参数，减小每次加载量
  const TOP_LEVEL_SIZE = 30;     // 从120降到30，加快首次响应
  const INNER_HITS_SIZE = 50;    // 从100降到50，减轻服务器负担
  let esFrom = 0;                 // 顶层分页偏移
  let esHasMore = false;          // 是否还有更多顶层数据
  let suggestionsSeen = new Set();// 去重：name+id
  let lastQueryKey = "";          // 模式+query 变化时重置
  let suggestionTimer;            // 输入防抖计时器

  // 在变量声明部分添加
  let affiliationAuthorId = null; // 存储机构对应的作者ID

  // Markdown打开函数
  function openMarkdown(title, more, type) {
    markdownTitle = title;
    markdownType = type || "article";
    markdownContent = more || "";
    showMarkdown = true;
    // 防止背景滚动
    document.body.style.overflow = 'hidden';
  }

  // Markdown关闭函数，将由Markdownpage组件调用
  function closeMarkdown() {
    showMarkdown = false;
    // 恢复背景滚动
    document.body.style.overflow = '';
  }

  function showSlide(index) {
    if (slides && slides.length > 0) {
      slides.forEach(slide => slide.classList.remove('active'));
      dots.forEach(dot => dot.classList.remove('active'));
      slides[index].classList.add('active');
      dots[index].classList.add('active');
      currentSlide = index;
    }
  }

  // 轮播图点击事件处理函数
  function handleDotClick(index) {
    showSlide(index);
  }

  // 获取所有数据的函数
  async function fetchAllData() {
    const apiUrls = getAllApiUrls();
    
    try {
      // 并行获取所有数据以提高性能
      const [newsResponse, servicesResponse, researchResponse, partnersResponse] = await Promise.all([
        fetch(apiUrls.platformDynamics),
        fetch(apiUrls.technicalServices),
        fetch(apiUrls.researchFindings),
        fetch(apiUrls.cooperativePartners)
      ]);
      
      if (newsResponse.ok) {
        newsData = await newsResponse.json();
      }
      if (servicesResponse.ok) {
        servicesData = await servicesResponse.json();
      }
      if (researchResponse.ok) {
        researchData = await researchResponse.json();
      }
      if (partnersResponse.ok) {
        partnersData = await partnersResponse.json();
      }
    } catch (error) {
      console.error('获取数据时出错:', error);
    } finally {
      isLoading = false;
    }
  }

  function modeKey() {
    return `${dataSourceText}:${entityTypeText}`;
  }

  function resetSuggestionState() {
    searchSuggestions = [];
    displayedSuggestions = [];
    currentPage = 1;
    hasMoreSuggestions = false;

    esFrom = 0;
    esHasMore = false;
    suggestionsSeen = new Set();
  }

  // 添加重置机构建议状态的函数
  function resetAffiliationSuggestionState() {
    affiliationSuggestions = [];
    displayedAffiliationSuggestions = [];
    affiliationCurrentPage = 1;
    hasMoreAffiliationSuggestions = false;

    affiliationEsFrom = 0;
    affiliationEsHasMore = false;
    affiliationSuggestionsSeen = new Set();
  }

  // 修改搜索输入处理函数，支持作者-机构联动
  function handleSearchInput() {
    clearTimeout(suggestionTimer);
    showSearchSuggestions = true;
    // 清除之前的结果，但保留加载状态
    if (searchInput.trim().length >= 2) {
      isSearching = true;
    }
    
    suggestionTimer = setTimeout(() => {
      if (affiliationId && entityTypeText === "作者") {
        // 如果已经选择了机构，获取该机构的所有作者
        fetchPaperAffiliationAuthors(affiliationId);
      } else {
        // 否则按照原有作者搜索逻辑
        fetchSearchSuggestions(searchInput);
      }
    }, 250);
  }

  // 根据选择的数据源和实体类型获取搜索建议（支持 append 追加）
  async function fetchSearchSuggestions(query, append = false) {
    const q = (query || "").trim();
    if (!q || q.length < 2) {
      resetSuggestionState();
      return;
    }

    const key = `${modeKey()}|${q}`;
    if (!append && key !== lastQueryKey) {
      lastQueryKey = key;
      resetSuggestionState();
    }

    isSearching = true;
    try {
      // 设置超时处理
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('查询超时')), 8000)
      );
      
      const fetchPromise = async () => {
        if (dataSourceText === "论文") {
          if (entityTypeText === "作者") {
            await fetchPaperAuthorSuggestions(q);
          } else if (entityTypeText === "机构") {
            await fetchPaperInstitutionSuggestions(q);
          }
        } else if (dataSourceText === "专利") {
          if (entityTypeText === "作者") {
            await fetchPatentAuthorSuggestions(q);
          } else if (entityTypeText === "机构") {
            await fetchPatentInstitutionSuggestions(q);
          }
        }
      };
      
      // 使用 Promise.race 实现超时控制
      await Promise.race([fetchPromise(), timeoutPromise]);

      // 更新显示的建议（前端渲染分页）
      updateDisplayedSuggestions();
      showSearchSuggestions = true;
    } catch (error) {
      console.error("搜索建议获取失败:", error);
      resetSuggestionState();
    } finally {
      isSearching = false;
    }
  }
  
  // 论文-作者搜索建议（inner_hits，服务端分页；完全匹配优先）
  async function fetchPaperAuthorSuggestions(query) {
    const body = {
      size: TOP_LEVEL_SIZE,
      from: esFrom,
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
                    "Author_List.Author_Details.Author_Name": query
                  }
                }
              ],
              should: [
                {
                  term: {
                    "Author_List.Author_Details.Author_Name.keyword": {
                      value: query,
                      boost: 5
                    }
                  }
                }
              ]
            }
          },
          inner_hits: {
            name: "author_hits",
            size: INNER_HITS_SIZE,
            _source: {
              includes: [
                "Author_List.Author_Details.Author_Name",
                "Author_List.AuthorID",
                "Author_List.Affiliation_Details.Affiliation_Name",
                "Author_Details.Author_Name",
                "AuthorID",
                "Affiliation_Details.Affiliation_Name"
              ]
            },
            sort: [
              { "_score": "desc" }
            ]
          }
        }
      }
    };

    const res = await fetch(PAPER_ES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) return;

    const data = await res.json();
    const hits = data?.hits?.hits || [];
    
    // 创建一个临时集合存储已添加的作者名
    const addedAuthorNames = new Set();
    const tempSuggestions = []; // 临时存储，以便后续排序
    
    for (const h of hits) {
      const ih = h?.inner_hits?.author_hits?.hits?.hits || [];
      for (const nh of ih) {
        const src = nh?._source || {};
        const name = src?.Author_List?.Author_Details?.Author_Name ?? src?.Author_Details?.Author_Name;
        const id = src?.Author_List?.AuthorID ?? src?.AuthorID;
        const rawAff = src?.Author_List?.Affiliation_Details?.Affiliation_Name ?? 
          src?.Affiliation_Details?.Affiliation_Name;
        const score = nh?._score || 0; // 保存相关度分数

        // 只根据作者名去重，不考虑ID
        if (name && !addedAuthorNames.has(name)) {
          addedAuthorNames.add(name);
          tempSuggestions.push({
            name,
            id,  // 仍然保存ID以备将来需要
            affiliation: rawAff,
            score: score // 保存相关度分数
          });
        }
      }
    }
    
    // 按相关度分数降序排序
    tempSuggestions.sort((a, b) => b.score - a.score);
    
    // 排序后赋值给searchSuggestions
    searchSuggestions = tempSuggestions;

    esFrom += TOP_LEVEL_SIZE;
    esHasMore = hits.length === TOP_LEVEL_SIZE;
  }
  
  // 论文-机构搜索建议（inner_hits，服务端分页；完全匹配优先）
  async function fetchPaperInstitutionSuggestions(query) {
    const body = {
      size: TOP_LEVEL_SIZE,
      from: esFrom,
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
            size: INNER_HITS_SIZE,
            _source: {
              includes: [
                "Author_List.Affiliation_Details.Affiliation_Name",
                "Author_List.AffiliationID",
                "Affiliation_Details.Affiliation_Name",
                "AffiliationID"
              ]
            },
            sort: [
              { "_score": "desc" }
            ]
          }
        }
      }
    };

    const res = await fetch(PAPER_ES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) return;

    const data = await res.json();
    const hits = data?.hits?.hits || [];

    for (const h of hits) {
      const ih = h?.inner_hits?.aff_hits?.hits?.hits || [];
      for (const nh of ih) {
        const src = nh?._source || {};
        const affName = src?.Author_List?.Affiliation_Details?.Affiliation_Name
                 ?? src?.Affiliation_Details?.Affiliation_Name;
        const affId = src?.Author_List?.AffiliationID
                ?? src?.AffiliationID;
        if (affName && affId) {
          const key = `${affName}::${affId}`;
          if (!suggestionsSeen.has(key)) {
            suggestionsSeen.add(key);
            searchSuggestions.push({
              name: affName,
              id: affId,
              display: affName
            });
          }
        }
      }
    }

    esFrom += TOP_LEVEL_SIZE;
    esHasMore = hits.length === TOP_LEVEL_SIZE;
  }
  
  // 专利-作者搜索建议（保持原方案）
  async function fetchPatentAuthorSuggestions(query) {
    const body = {
      size: 0,
      aggs: {
        inventors: {
          terms: {
            field: "发明人.keyword",
            size: 10,
            include: `.*${query}.*`
          }
        }
      }
    };
    
    const res = await fetch(PATENT_ES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      searchSuggestions = [];
      return;
    }
    
    const data = await res.json();
    const inventors = data.aggregations?.inventors?.buckets || [];
    searchSuggestions = inventors.map(b => ({ name: b.key, id: b.key }));
  }
  
  // 专利-机构搜索建议（保持原方案）
  async function fetchPatentInstitutionSuggestions(query) {
    const body = {
      size: 0,
      aggs: {
        applicants: {
          terms: {
            field: "申请人.keyword",
            size: 10,
            include: `.*${query}.*`
          }
        }
      }
    };
    
    const res = await fetch(PATENT_ES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      searchSuggestions = [];
      return;
    }
    
    const data = await res.json();
    const applicants = data.aggregations?.applicants?.buckets || [];
    searchSuggestions = applicants.map(b => ({ name: b.key, id: b.key }));
  }

  // 论文-作者机构关联查询
  async function fetchPaperAuthorAffiliations(authorName, append = false, filter = "") {
    console.log("查询作者相关机构:", authorName, "过滤条件:", filter);
    
    if (!append) {
      resetAffiliationSuggestionState();
    }
    
    if (!authorName) {
      console.log("作者名为空，无法查询机构");
      return;
    }
    
    isAffiliationSearching = true;
    
    try {
      // 构建基本查询
      const mustClauses = [
        {
          match: {
            "Author_List.Author_Details.Author_Name": authorName
          }
        }
      ];
      
      // 如果有过滤条件，使用不同的查询策略
      if (filter && filter.trim().length > 0) {
        // 使用match_phrase_prefix进行前缀匹配，并提高相关度
        mustClauses.push({
          match_phrase_prefix: {
            "Author_List.Affiliation_Details.Affiliation_Name": {
              query: filter,
              boost: 10  // 提高匹配度权重
            }
          }
        });
        
        // 添加模糊匹配以涵盖更多结果
        mustClauses.push({
          match: {
            "Author_List.Affiliation_Details.Affiliation_Name": {
              query: filter,
              fuzziness: "AUTO"
            }
          }
        });
      }
      
      // 构建完整查询
      const body = {
        size: 30,
        from: affiliationEsFrom,
        _source: false,
        stored_fields: [],
        track_total_hits: true,
        query: {
          nested: {
            path: "Author_List",
            query: {
              bool: {
                must: mustClauses
              }
            },
            inner_hits: {
              name: "aff_hits",
              size: 100,
              _source: {
                includes: [
                  "Author_List.Author_Details.Author_Name",
                  "Author_List.AuthorID",
                  "Author_List.Affiliation_Details.Affiliation_Name",
                  "Author_List.AffiliationID"
                ]
              },
              sort: [
                { "_score": "desc" }  // 按相关性排序
              ]
            }
          }
        }
      };

      console.log("发送机构查询请求...");
      const res = await fetch(PAPER_ES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        console.error("机构查询请求失败:", res.status);
        return;
      }

      const data = await res.json();
      const hits = data?.hits?.hits || [];
      console.log("获取到机构记录数:", hits.length);

      // 如果不是追加模式，清空之前的建议
      if (!append) {
        affiliationSuggestions = [];
        affiliationSuggestionsSeen = new Set();
      }
      
      // 处理结果并确保按相关性排序
      const tempSuggestions = [];
      
      for (const h of hits) {
        const ih = h?.inner_hits?.aff_hits?.hits?.hits || [];
        for (const nh of ih) {
          const src = nh?._source || {};
          const affName = src?.Affiliation_Details?.Affiliation_Name;
          const affId = src?.AffiliationID;
          const authorId = src?.AuthorID;
          const score = nh?._score || 0;
          
          if (affName) {
            // 使用机构名+作者ID作为去重键，这样同机构不同作者ID会显示多次
            const key = `${affName}::${authorId || 'unknown'}`;
            if (!affiliationSuggestionsSeen.has(key)) {
              affiliationSuggestionsSeen.add(key);
              tempSuggestions.push({
                name: affName,
                id: affId,
                authorId: authorId,  // 保存作者ID
                // 显示格式：机构名 (作者ID)
                display: affName + (authorId ? ` (${authorId})` : ''),
                score: score
              });
            }
          }
        }
      }
      
      // 按相关性排序
      tempSuggestions.sort((a, b) => b.score - a.score);
      
      // 添加到结果列表
      affiliationSuggestions = [...affiliationSuggestions, ...tempSuggestions];
      
      // 更新分页状态
      affiliationEsFrom += 30;
      affiliationEsHasMore = hits.length === 30;
      
      console.log("处理后机构建议总数:", affiliationSuggestions.length);
      
      if (affiliationSuggestions.length > 0) {
        updateDisplayedAffiliationSuggestions();
        showAffiliationSuggestions = true;
      } else {
        console.log("未找到相关机构");
      }
    } catch (error) {
      console.error("获取作者机构列表失败:", error);
    } finally {
      isAffiliationSearching = false;
    }
  }

  // 论文-作者作者关联查询
  async function fetchPaperAffiliationAuthors(affiliationId) {
    resetSuggestionState();
    
    const body = {
      size: TOP_LEVEL_SIZE,
      _source: false,
      stored_fields: [],
      track_total_hits: false,
      query: {
        nested: {
          path: "Author_List",
          query: {
            bool: {
              must: [
                {
                  term: {
                    "Author_List.AffiliationID": affiliationId
                  }
                }
              ]
            }
          },
          inner_hits: {
            name: "author_hits",
            size: INNER_HITS_SIZE,
            _source: {
              includes: [
                "Author_List.Author_Details.Author_Name",
                "Author_List.AuthorID"
              ]
            }
          }
        }
      }
    };

    try {
      const res = await fetch(PAPER_ES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) return;

      const data = await res.json();
      const hits = data?.hits?.hits || [];

      for (const h of hits) {
        const ih = h?.inner_hits?.author_hits?.hits?.hits || [];
        for (const nh of ih) {
          const src = nh?._source || {};
          const name = src?.Author_List?.Author_Details?.Author_Name;
          const id = src?.Author_List?.AuthorID;
          
          if (name && id) {
            const key = `${name}::${id}`;
            if (!suggestionsSeen.has(key)) {
              suggestionsSeen.add(key);
              searchSuggestions.push({
                name,
                id,
                display: name,
                affiliation: affiliationInput
              });
            }
          }
        }
      }
      
      updateDisplayedSuggestions();
      showSearchSuggestions = true;
    } catch (error) {
      console.error("获取机构作者列表失败:", error);
    } finally {
      isSearching = false;
    }
  }
  
  // 选择建议项
  function selectSuggestion(suggestion) {
    // 只显示作者名，不包含机构信息
    searchInput = suggestion.name;
    searchTerm = suggestion.name;  // 保存作者名称
    searchId = suggestion.id;      // 仍然保存ID，但主要使用姓名查询
    searchAffiliation = suggestion.affiliation;
    showSearchSuggestions = false;
    
    // 清空当前机构输入
    affiliationInput = "";
    affiliationTerm = "";
    affiliationId = null;
  }

  // 更新显示的建议（前端渲染分页）
  function updateDisplayedSuggestions() {
    const endIndex = currentPage * suggestionsPerPage;
    displayedSuggestions = searchSuggestions.slice(0, endIndex);
    // 只要本地还有没渲染完或服务端还有更多，就显示"加载更多"
    hasMoreSuggestions = (displayedSuggestions.length < searchSuggestions.length) || esHasMore;
  }

  // 加载更多（优先渲染本地未显示的；不足则继续请求下一页ES）
  async function loadMoreSuggestions() {
    // 先增加本地渲染页
    if (displayedSuggestions.length < searchSuggestions.length) {
      currentPage++;
      updateDisplayedSuggestions();
      return;
    }
    // 若本地已显示全部但服务端还有更多，继续拉取
    if (esHasMore && !isSearching) {
      await fetchSearchSuggestions(searchInput, true);
      currentPage++;
      updateDisplayedSuggestions();
    }
  }
  
  // 失焦时验证输入
  function validateSearchInput() {
    setTimeout(() => {
      showSearchSuggestions = false;
      const input = (searchInput || "").trim();
      const found = searchSuggestions.find((s) => {
        const display = s.display || s.name;
        return display === input || s.name === input;
      });
      if (found) {
        searchTerm = found.name;
        searchId = found.id;
        searchAffiliation = found.affiliation;
        searchInput = found.display || found.name;
        return;
      }
      if (searchId) return;
      searchInput = "";
      searchTerm = "";
      searchId = null;
    }, 200);
  }

  // 学术作者查询输入与请求
  function resetScholarSuggestionState() {
    scholarSuggestions = [];
    showScholarSuggestions = false;
    scholarSelectedAuthorId = null;
  }

  function handleScholarInput() {
    clearTimeout(scholarSuggestionTimer);
    const value = scholarInput.trim();
    scholarTerm = "";
    scholarSelectedAuthorId = null;

    if (value.length < 2) {
      resetScholarSuggestionState();
      return;
    }

    scholarSuggestionTimer = setTimeout(() => {
      fetchScholarSuggestions(value);
    }, 500);
  }

  async function fetchScholarSuggestions(query) {
    isScholarSearching = true;
    try {
      const res = await fetch(`${SCHOLAR_AUTHORS_URL}?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        throw new Error(`作者列表请求失败: ${res.status}`);
      }
      const data = await res.json();
      scholarSuggestions = (data || []).map((item) => ({
        id: item.author_id,
        name: item.author_name,
        publicationTitle: item.publication?.title,
        publicationYear: item.publication?.year
      }));
      showScholarSuggestions = scholarSuggestions.length > 0;
    } catch (error) {
      console.error("获取作者建议失败:", error);
      resetScholarSuggestionState();
    } finally {
      isScholarSearching = false;
    }
  }

  function selectScholarSuggestion(suggestion) {
    scholarInput = suggestion.name;
    scholarTerm = suggestion.name;
    scholarSelectedAuthorId = suggestion.id;
    showScholarSuggestions = false;
  }

  function validateScholarInput() {
    setTimeout(() => {
      showScholarSuggestions = false;
      const input = (scholarInput || "").trim();
      const found = scholarSuggestions.find((s) => s.name === input);
      if (found) {
        scholarTerm = found.name;
        scholarSelectedAuthorId = found.id;
        scholarInput = found.name;
        return;
      }
      if (scholarSelectedAuthorId) return;
      scholarInput = "";
      scholarTerm = "";
      scholarSelectedAuthorId = null;
    }, 200);
  }

  function handleScholarSearch() {
    if (isScholarQuerying) return;

    const query = (scholarTerm || scholarInput).trim();
    if (!query) {
      alert("请输入想要查询的学术作者名");
      return;
    }

    // 关闭下拉框
    showScholarSuggestions = false;

    // 打开新标签页进行查询
    window.open(`/scholar?name=${encodeURIComponent(query)}`, "_blank");
  }

  function buildScholarDownloadUrl(name = "", id = "") {
    if (!name) return "";
    const params = new URLSearchParams();
    params.set("author_name", name);
    if (id) {
      params.set("author_id", id);
    }
    return `http://81.70.12.153:8060/download/publications?${params.toString()}`;
  }

  function closeScholarResults() {
    showScholarResults = false;
    document.body.style.overflow = '';
  }

  // 修改机构输入处理函数，支持专利作者
  function handleAffiliationInput() {
    clearTimeout(affiliationSuggestionTimer);
    
    const inputText = affiliationInput.trim().toLowerCase();
    
    // 如果已选择作者，使用输入文本过滤相关机构
    if (searchTerm && entityTypeText === "作者") {
      isAffiliationSearching = true;
      
      affiliationSuggestionTimer = setTimeout(() => {
        if (dataSourceText === "论文") {
          // 使用过滤条件查询
          fetchPaperAuthorAffiliations(searchTerm, false, inputText);
        } else if (dataSourceText === "专利") {
          // 专利查询支持过滤
          fetchPatentAuthorAffiliations(searchTerm, false, inputText);
        }
      }, 250);
      return;
    }
    
    // 如果有已加载的机构建议，先从本地过滤
    if (affiliationSuggestions.length > 0) {
      // 显示匹配的机构
      const filtered = affiliationSuggestions.filter(suggestion => 
        suggestion.name && suggestion.name.toLowerCase().includes(inputText)
      );
      
      // 更新显示内容，但不修改原始数据
      displayedAffiliationSuggestions = inputText ? filtered : affiliationSuggestions.slice(0, suggestionsPerPage);
      showAffiliationSuggestions = true;
      return;
    }
    
    // 如果没有本地数据或过滤后没有结果，进行远程搜索
    if (inputText.length >= 2) {
      isAffiliationSearching = true;
      
      affiliationSuggestionTimer = setTimeout(() => {
        fetchAffiliationSuggestions(inputText);
      }, 250);
    } else {
      resetAffiliationSuggestionState();
    }
  }

  // 机构搜索建议
  async function fetchAffiliationSuggestions(query, append = false) {
    const q = (query || "").trim();
    if (!q || q.length < 2) {
      resetAffiliationSuggestionState();
      return;
    }

    const key = `${modeKey()}|${q}`;
    if (!append && key !== affiliationLastQueryKey) {
      affiliationLastQueryKey = key;
      resetAffiliationSuggestionState();
    }

    isAffiliationSearching = true;
    try {
      // 如果已经选择了作者，获取该作者的所有机构
      if (searchId && entityTypeText === "作者") {
        await fetchPaperAuthorAffiliations(searchId);
        return;
      }
      
      // 否则按照原有机构搜索逻辑
      if (dataSourceText === "论文") {
        await fetchPaperInstitutionSuggestions(q);
      } else if (dataSourceText === "专利") {
        await fetchPatentInstitutionSuggestions(q);
      }
      
      updateDisplayedAffiliationSuggestions();
      showAffiliationSuggestions = true;
    } catch (error) {
      console.error("机构搜索建议获取失败:", error);
      resetAffiliationSuggestionState();
    } finally {
      isAffiliationSearching = false;
    }
  }

  // 更新显示的机构建议
  function updateDisplayedAffiliationSuggestions() {
    const endIndex = affiliationCurrentPage * suggestionsPerPage;
    displayedAffiliationSuggestions = affiliationSuggestions.slice(0, endIndex);
    console.log("更新显示的机构建议:", displayedAffiliationSuggestions.length);
    hasMoreAffiliationSuggestions = (displayedAffiliationSuggestions.length < affiliationSuggestions.length) || affiliationEsHasMore;
  }

  // 加载更多机构建议
  async function loadMoreAffiliationSuggestions() {
    console.log("尝试加载更多机构建议");
    
    // 先增加本地渲染页
    if (displayedAffiliationSuggestions.length < affiliationSuggestions.length) {
      affiliationCurrentPage++;
      updateDisplayedAffiliationSuggestions();
      return;
    }
    
    // 若本地已显示全部但服务端还有更多，继续拉取
    if (affiliationEsHasMore && !isAffiliationSearching && searchTerm) {
      console.log("从服务器加载更多机构建议");
      await fetchPaperAuthorAffiliations(searchTerm, true);
      affiliationCurrentPage++;
      updateDisplayedAffiliationSuggestions();
    }
  }

  // 选择机构建议
  function selectAffiliationSuggestion(suggestion) {
    affiliationInput = suggestion.display || suggestion.name;
    affiliationTerm = suggestion.name;
    affiliationId = suggestion.id;
    // 添加对应的作者ID保存
    affiliationAuthorId = suggestion.authorId || searchId;
    showAffiliationSuggestions = false;
  }

  // 机构输入框失焦验证
  function validateAffiliationInput() {
    setTimeout(() => {
      showAffiliationSuggestions = false;
      const input = (affiliationInput || "").trim();
      const found = affiliationSuggestions.find((s) => {
        const display = s.display || s.name;
        return display === input || s.name === input;
      });
      if (found) {
        affiliationTerm = found.name;
        affiliationId = found.id;
        affiliationInput = found.display || found.name;
        return;
      }
      if (affiliationId) return;
      affiliationInput = "";
      affiliationTerm = "";
      affiliationId = null;
    }, 200);
  }

  // 修改专利作者机构关联查询函数，支持过滤
  async function fetchPatentAuthorAffiliations(authorName, append = false, filter = "") {
    console.log("查询专利发明人相关机构:", authorName, "过滤条件:", filter);
    
    if (!append) {
      resetAffiliationSuggestionState();
    }
    
    if (!authorName) {
      console.log("发明人名为空，无法查询机构");
      return;
    }
    
    isAffiliationSearching = true;
    
    try {
      // 专利发明人与机构关联查询
      const body = {
        size: 0,
        aggs: {
          by_author: {
            filter: {
              term: {
                "发明人.keyword": authorName
              }
            },
            aggs: {
              applicants: {
                terms: {
                  field: "申请人.keyword",
                  size: 100,
                  // 如果有过滤条件，使用更精确的正则
                  ...(filter ? { include: `.*${filter.split('').join('.*')}.*` } : {})
                }
              }
            }
          }
        }
      };

      console.log("发送专利机构查询请求...");
      const res = await fetch(PATENT_ES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        console.error("专利机构查询请求失败:", res.status);
        return;
      }

      const data = await res.json();
      const buckets = data?.aggregations?.by_author?.applicants?.buckets || [];
      console.log("获取到专利机构数:", buckets.length, "过滤条件:", filter || "无");

      // 如果不是追加模式，清空之前的建议
      if (!append) {
        affiliationSuggestions = [];
        affiliationSuggestionsSeen = new Set();
      }
      
      // 处理专利机构数据并计算相关性分数
      const tempSuggestions = [];
      
      for (const bucket of buckets) {
        const affName = bucket.key;
        const affId = bucket.key;
        const count = bucket.doc_count;
        
        // 计算简单的相关性分数，优先显示名称开头匹配的结果
        let score = count; // 基础分数是文档数
        
        if (filter) {
          const lowerFilter = filter.toLowerCase();
          const lowerName = affName.toLowerCase();
          
          if (lowerName.startsWith(lowerFilter)) {
            score += 1000; // 开头匹配加高分
          } else if (lowerName.includes(lowerFilter)) {
            score += 500; // 包含匹配加中等分数
          }
          
          // 只保留匹配的结果
          if (!lowerName.includes(lowerFilter)) {
            continue;
          }
        }
        
        if (affName) {
          const key = `${affName}`;
          if (!affiliationSuggestionsSeen.has(key)) {
            affiliationSuggestionsSeen.add(key);
            tempSuggestions.push({
              name: affName,
              id: affId,
              display: `${affName} (${count})`,
              score: score
            });
          }
        }
      }
      
      // 按相关性排序
      tempSuggestions.sort((a, b) => b.score - a.score);
      
      // 添加到结果列表
      affiliationSuggestions = [...affiliationSuggestions, ...tempSuggestions];
      
      // 更新分页状态
      affiliationEsHasMore = false; // 专利聚合一次性返回所有结果，不需要分页
      
      console.log("处理后专利机构建议总数:", affiliationSuggestions.length);
      
      if (affiliationSuggestions.length > 0) {
        updateDisplayedAffiliationSuggestions();
        showAffiliationSuggestions = true;
      } else {
        console.log("未找到相关专利机构");
      }
    } catch (error) {
      console.error("获取专利机构列表失败:", error);
    } finally {
      isAffiliationSearching = false;
    }
  }

  // 确保机构输入框获得焦点时显示该作者的所有机构
  function handleAffiliationFocus() {
    console.log("机构输入框获得焦点");
    
    // 先清空可能的旧建议
    showAffiliationSuggestions = false;
    
    // 如果已选择作者/发明人，根据数据源类型查询相关机构
    if (searchTerm && entityTypeText === "作者") {
      if (dataSourceText === "论文") {
        console.log("查询论文作者机构:", searchTerm);
        fetchPaperAuthorAffiliations(searchTerm);
      } else if (dataSourceText === "专利") {
        console.log("查询专利发明人机构:", searchTerm);
        fetchPatentAuthorAffiliations(searchTerm);
      }
    } else {
      console.log("未选择作者或不是作者模式");
      if (affiliationSuggestions.length > 0) {
        showAffiliationSuggestions = true;
      }
    }
  }
  
  // 下拉菜单选项点击处理函数
  function handleDataSourceClick(value) {
    dataSourceText = value;
    dataSourceActive = false;
    // 清空搜索结果 + ES分页状态
    searchInput = "";
    searchTerm = "";
    searchId = null;
    affiliationInput = "";
    affiliationTerm = "";
    affiliationId = null;
    lastQueryKey = "";
    affiliationLastQueryKey = "";
    resetSuggestionState();
    resetAffiliationSuggestionState();
  }
  
  function handleEntityTypeClick(value) {
    entityTypeText = value;
    entityTypeActive = false;
    // 清空搜索结果 + ES分页状态
    searchInput = "";
    searchTerm = "";
    searchId = null;
    affiliationInput = "";
    affiliationTerm = "";
    affiliationId = null;
    lastQueryKey = "";
    affiliationLastQueryKey = "";
    resetSuggestionState();
    resetAffiliationSuggestionState();
  }

  // 添加四种不同的分析方法
  function analyzePaperPerson(searchTerm, searchId) {
    const prompt = `请对以下作者在论文中的学术发展进行主题轨迹分析：
作者名称：${searchTerm}，作者ID：${searchId || '未知'}`;
    generateReportWithPrompt(prompt, "作者主题轨迹报告");
  }

  function analyzePaperOrganization(searchTerm, searchId) {
    const prompt = `请对以下机构在论文研究中的发展进行主题轨迹分析：
机构名称：${searchTerm}，机构ID：${searchId || '未知'}`;
    generateReportWithPrompt(prompt, "机构主题轨迹报告");
  }

  function analyzePatentPerson(searchTerm, searchId) {
    const prompt = `请对以下发明人在专利申请中的发展进行主题轨迹分析：
发明人名称：${searchTerm}`;
    generateReportWithPrompt(prompt, "专利发明人主题轨迹报告");
  }

  function analyzePatentOrganization(searchTerm, searchId) {
    const prompt = `请对以下机构在专利申请中的发展进行主题轨迹分析：
申请人名称：${searchTerm}`;
    generateReportWithPrompt(prompt, "专利申请人主题轨迹报告");
  }

  // 修改主按钮点击处理函数
  function analyzeTrajectory() {
    if (!searchTerm) {
      alert("请选择有效的搜索项");
      return;
    }
    
    // 当选择论文作者或专利作者时，需要同时验证作者和机构
    if ((dataSourceText === "论文" || dataSourceText === "专利") && entityTypeText === "作者" && !affiliationTerm) {
      alert("请同时选择作者和机构");
      return;
    }

    if (dataSourceText === "论文") {
      if (entityTypeText === "作者") {
        // 使用作者和机构信息进行分析，使用对应的作者ID
        const actualAuthorId = affiliationAuthorId || searchId; // 优先使用从机构选择得到的作者ID
        const prompt = `请对以下作者在论文中的学术发展进行主题轨迹分析：
作者名称：${searchTerm}，作者ID：${actualAuthorId || '未知'}
所属机构：${affiliationTerm || '未知'}`;
        generateReportWithPrompt(prompt, "作者主题轨迹报告");
      } else if (entityTypeText === "机构") {
        analyzePaperOrganization(searchTerm, searchId);
      }
    } else if (dataSourceText === "专利") {
      if (entityTypeText === "作者") {
        // 修改为使用作者和机构信息进行分析
        const prompt = `请对以下发明人在专利申请中的发展进行主题轨迹分析：
发明人名称：${searchTerm}
所属机构：${affiliationTerm || '未知'}`;
        generateReportWithPrompt(prompt, "专利发明人主题轨迹报告");
      } else if (entityTypeText === "机构") {
        analyzePatentOrganization(searchTerm, searchId);
      }
    }
  }

  // 生成报告的通用函数（略，保持原样）
  function generateReportWithPrompt(prompt, modelName) {
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

  // 切换下拉菜单显示状态
  function toggleDropdown(type) {
    if (type === 'dataSource') {
      dataSourceActive = !dataSourceActive;
      entityTypeActive = false;
    } else if (type === 'entityType') {
      entityTypeActive = !entityTypeActive;
      dataSourceActive = false;
    }
  }
  
  // 点击外部关闭下拉菜单
  function handleClickOutside(event) {
    const dataSourceBtn = document.getElementById('dataSourceBtn');
    const entityTypeBtn = document.getElementById('entityTypeBtn');
    if (dataSourceBtn && !dataSourceBtn.contains(event.target)) {
      dataSourceActive = false;
    }
    if (entityTypeBtn && !entityTypeBtn.contains(event.target)) {
      entityTypeActive = false;
    }
  }

  onMount(async () => {
    if (slidesContainer) {
      slides = slidesContainer.querySelectorAll('.hero-slide');
    }
    if (dotsContainer) {
      dots = dotsContainer.querySelectorAll('.slider-dot');
    }
    const interval = setInterval(() => {
      if (slides && slides.length > 0) {
        let nextSlide = (currentSlide + 1) % slides.length;
        showSlide(nextSlide);
      }
    }, 10000);
    await fetchAllData();
    document.addEventListener('click', handleClickOutside);
    return () => {
      clearInterval(interval);
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/remixicon/4.6.0/remixicon.min.css">
</svelte:head>

<style>
  :where([class^="ri-"])::before { content: "\f3c2"; }
  :global(body) { font-family: "Noto Sans SC", sans-serif; }
  .hero-slider { position: relative; height: min(500px, 40vh); overflow: hidden; margin: 0; width: 100%; }
  .hero-slide { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 0.5s ease-in-out; }
  .hero-slide.active { opacity: 1; }
  .hero-slide img { width: 100%; height: 100%; object-fit: cover; object-position: center; }
  .hero-slide .content { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; z-index: 2; }
  .hero-slide .overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.4); z-index: 1; }
  .slider-dots { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 10; }
  .slider-dot { width: 12px; height: 12px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.5); cursor: pointer; }
  .slider-dot.active { background-color: #fff; }
  :global(.homebody-wrapper) main { padding-left: 0; margin-left: 0; }
  .news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .service-grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, auto); gap: 0.75rem; width: 100%; }
  @media (min-width: 768px) { .service-grid { grid-auto-flow: row; grid-template-rows: auto auto; } }
  .research-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
  .partner-grid { display: flex; flex-wrap: nowrap; justify-content: space-between; width: 100%; overflow-x: hidden; gap: 0.5rem; }
  .partner-grid > div { flex: 1 1 0; min-width: 0; padding: 0.25rem !important; margin: 0; display: flex; flex-direction: column; align-items: center; }
  .partner-grid .w-10.h-10 { width: 1.75rem !important; height: 1.75rem !important; min-width: 1.75rem; margin-bottom: 0.5rem !important; }
  .partner-grid .text-xs { font-size: 0.65rem !important; white-space: nowrap; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  footer { padding: 0 !important; margin: 0 !important; border: none !important; border-top: 1px solid rgba(255, 255, 255, 0.2) !important; }
  footer p, footer a { color: #333333 !important; font-weight: 500; opacity: 1 !important; }
  @media (max-width: 768px) { .news-grid, .research-grid { grid-template-columns: repeat(2, 1fr); } .hero-slider { height: min(350px, 35vh); } }
  @media (max-width: 640px) { .news-grid, .service-grid, .research-grid { grid-template-columns: 1fr; } }
  @media (max-width: 480px) { .hero-slider { height: min(300px, 30vh); } }
  :global(.homebody-container) main { width: 100%; max-width: 100%; }
  .news-grid, .service-grid, .research-grid, .partner-grid { width: 100%; max-width: 100%; }
  .hero-slider { width: 100%; max-width: 100%; }
  .container { width: 100%; max-width: 100%; padding-left: 0.5rem; padding-right: 0.5rem; margin-left: auto; margin-right: auto; box-sizing: border-box; }
  img { max-width: 100%; height: auto; }
  .news-grid > div, .service-grid > div, .research-grid > div, .partner-grid > div { width: 100%; min-width: 0; overflow: hidden; }
  .homebody-wrapper { width: 100%; transform: none; transform-origin: top center; overflow-x: hidden; max-width: 100%; }
  :global(.homebody-wrapper .container) { max-width: 100%; width: 100%; padding-left: 0.25rem; padding-right: 0.25rem; }
  :global(.homebody-wrapper section) { margin-top: 0; margin-bottom: 0; padding-top: 1.5rem; padding-bottom: 1.5rem; }
  :global(.homebody-wrapper footer) { padding: 0 !important; margin: 0 !important; border-top: none !important; }
  :global(.homebody-wrapper) { display: flex; flex-direction: column; }
  :global(.homebody-wrapper main) { margin-bottom: 0 !important; padding-bottom: 0 !important; }
  :global(.home-panel) { margin-bottom: 0 !important; padding-bottom: 0 !important; }
  section { padding-top: 1.5rem; padding-bottom: 1.5rem; margin: 0; }
  section:last-of-type { padding-bottom: 0; }
  .service-grid > div { padding: 0.75rem; }
  :global(body), :global(html), :global(#app) { min-height: 100%; margin: 0; padding: 0; }
  .service-grid-container { width: 100%; }
  main { margin-bottom: 0 !important; padding-bottom: 0 !important; }
  footer .container { padding: 0.25rem 0.5rem !important; margin: 0 !important; }
  footer .border-t { padding: 0.25rem 0 !important; border: none !important; }
  :global(.homebody-wrapper) { margin-bottom: 0 !important; padding-bottom: 0 !important; }
  :global(.flex-grow.overflow-auto), :global(.home-panel) { padding-bottom: 0 !important; margin-bottom: 0 !important; }
  section:last-of-type { padding-bottom: 0 !important; margin-bottom: 0 !important; }
  main { display: flex; flex-direction: column; min-height: 100%; margin: 0 !important; padding: 0 !important; }
  footer { margin-top: auto !important; padding: 0.5rem 0 !important; width: 100%; border-top: 1px solid rgba(255, 255, 255, 0.2) !important; }
  section:nth-last-child(2) { margin-bottom: 1.5rem !important; padding-bottom: 0; }
  :global(.homebody-wrapper), :global(.flex-grow.overflow-auto), :global(.home-panel), :global(.homebody-container) { margin-bottom: 0 !important; padding-bottom: 0 !important; }
  footer .container { padding: 0.25rem 0.5rem !important; }
  section { display: block !important; width: 100% !important; max-width: 100% !important; padding: 2rem 0 !important; margin: 0 !important; position: relative !important; overflow: visible !important; }
  .container { width: 100% !important; max-width: 100% !important; padding-left: 1rem !important; padding-right: 1rem !important; display: block !important; }
  .news-grid, .service-grid, .research-grid { width: 100% !important; display: grid !important; position: relative !important; }
  :global(.homebody-wrapper) { transform: none !important; width: 100% !important; overflow-x: hidden !important; }
  .hero-slider { position: relative !important; height: min(500px, 40vh) !important; width: 100% !important; overflow: hidden !important; }
  .markdown-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; background-color: var(--light-bg); overflow-y: auto; }
  button.text-primary, button.text-white { padding: 0; font-size: inherit; font-family: inherit; display: flex; align-items: center; }
  .line-clamp-2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .line-clamp-5 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 5; overflow: hidden; }
  .search-card { box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15); margin-top: 0; position: relative; z-index: 20; background-color: #fff; border-radius: 0.75rem; }
  .dropdown-content { display: none; position: absolute; z-index: 30; min-width: 120px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); background-color: white; border-radius: 0.5rem; overflow: hidden; }
  .dropdown.active .dropdown-content { display: block; }
  .rounded-button { border-radius: 8px !important; }
  [class^="ri-"] { font-family: 'remixicon' !important; display: inline-block; }
  .ri-arrow-down-s-line:before { content: "\ea4e" !important; }
  .ri-search-line:before { content: "\f0d1" !important; }
  .search-button { background: linear-gradient(135deg, #57B5E7 0%, #4A90E2 100%) !important; color: white !important; padding-left: 1.75rem !important; padding-right: 1.75rem !important; font-weight: 500 !important; transition: all 0.3s ease !important; border: none !important; box-shadow: 0 4px 10px rgba(74, 144, 226, 0.25) !important; }
  .search-button:hover { background: linear-gradient(135deg, #4A90E2 0%, #57B5E7 100%) !important; box-shadow: 0 6px 15px rgba(74, 144, 226, 0.4) !important; transform: translateY(-1px) !important; }
  .search-button[aria-disabled="true"] { opacity: 0.55; pointer-events: none; }
  .search-card-stack { display: flex; flex-direction: column; gap: 3rem; }
  @media (min-width: 768px) { .search-card-stack { gap: 4rem; } }
</style>

<!-- 主内容区 -->
<main>
  <!-- 轮播图区域 -->
  <section class="hero-slider">
    <div bind:this={slidesContainer}>
      <div class="hero-slide active">
        <img src="https://bigdatatechnologies-1251522225.cos.ap-shanghai.myqcloud.com/fig1.jpg" alt="智能数据驱动产业升级">
        <div class="overlay"></div>
        <div class="content">
          <div class="container mx-auto px-4">
            <div class="text-white max-w-2xl">
              <h2 class="text-4xl font-bold mb-4">智能数据驱动产业升级</h2>
              <p class="text-xl mb-6">利用AI技术挖掘产业大数据，助力企业数字化转型</p>
            </div>
          </div>
        </div>
      </div>
      <div class="hero-slide">
        <img src="https://bigdatatechnologies-1251522225.cos.ap-shanghai.myqcloud.com/fig2.jpg" alt="数字化产业分析平台">
        <div class="overlay"></div>
        <div class="content">
          <div class="container mx-auto px-4">
            <div class="text-white max-w-2xl">
              <h2 class="text-4xl font-bold mb-4">数字化产业分析平台</h2>
              <p class="text-xl mb-6">深度挖掘行业数据，提供精准的市场洞察</p>
            </div>
          </div>
        </div>
      </div>
      <div class="hero-slide">
        <img src="https://bigdatatechnologies-1251522225.cos.ap-shanghai.myqcloud.com/fig3.jpg" alt="产业链智能分析系统">
        <div class="overlay"></div>
        <div class="content">
          <div class="container mx-auto px-4">
            <div class="text-white max-w-2xl">
              <h2 class="text-4xl font-bold mb-4">产业链智能分析系统</h2>
              <p class="text-xl mb-6">全方位产业链数据整合，智能预测行业趋势</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="slider-dots" bind:this={dotsContainer}>
      <div class="slider-dot active" on:click={() => handleDotClick(0)}></div>
      <div class="slider-dot" on:click={() => handleDotClick(1)}></div>
      <div class="slider-dot" on:click={() => handleDotClick(2)}></div>
    </div>
  </section>
  
  <!-- 搜索框区域 - UI部分修改 -->
  <section class="py-4 bg-white">
    <div class="container mx-auto px-4">
      <div class="search-card-stack">
        <div class="search-card bg-white rounded-xl p-8 w-full">
        <h2 class="text-xl font-medium text-gray-800 mb-6">科技主题轨迹分析</h2>
        <div class="flex flex-col md:flex-row gap-4 items-center">
          <!-- 数据源 -->
          <div class="dropdown relative w-full md:w-36 {dataSourceActive ? 'active' : ''}">
            <button id="dataSourceBtn" class="w-full bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded flex items-center justify-between !rounded-button whitespace-nowrap" on:click|stopPropagation={() => toggleDropdown('dataSource')}>
              <span>{dataSourceText}</span>
              <span class="w-5 h-5 flex items-center justify-center"><i class="ri-arrow-down-s-line"></i></span>
            </button>
            <div class="dropdown-content bg-white rounded mt-1 w-full">
              <div class="py-2">
                <div class="data-source-option px-4 py-2 hover:bg-gray-100 cursor-pointer" on:click={() => handleDataSourceClick('论文')}>论文</div>
                <div class="data-source-option px-4 py-2 hover:bg-gray-100 cursor-pointer" on:click={() => handleDataSourceClick('专利')}>专利</div>
              </div>
            </div>
          </div>
          <!-- 主体类型 -->
          <div class="dropdown relative w-full md:w-36 {entityTypeActive ? 'active' : ''}">
            <button id="entityTypeBtn" class="w-full bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded flex items-center justify-between !rounded-button whitespace-nowrap" on:click|stopPropagation={() => toggleDropdown('entityType')}>
              <span>{entityTypeText}</span>
              <span class="w-5 h-5 flex items-center justify-center"><i class="ri-arrow-down-s-line"></i></span>
            </button>
            <div class="dropdown-content bg-white rounded mt-1 w-full">
              <div class="py-2">
                <div class="entity-type-option px-4 py-2 hover:bg-gray-100 cursor-pointer" on:click={() => handleEntityTypeClick('作者')}>作者</div>
                <div class="entity-type-option px-4 py-2 hover:bg-gray-100 cursor-pointer" on:click={() => handleEntityTypeClick('机构')}>机构</div>
              </div>
            </div>
          </div>

          <!-- 主搜索输入框 - 当论文+作者模式时显示双输入框 -->
          {#if (dataSourceText === "论文" || dataSourceText === "专利") && entityTypeText === "作者"}
            <!-- 作者输入框 -->
            <div class="relative flex-1 w-full">
              <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <span class="w-5 h-5 flex items-center justify-center text-gray-400"><i class="ri-search-line"></i></span>
              </div>
              
              <input
                type="text"
                bind:value={searchInput}
                class="search-input w-full bg-white border border-gray-200 text-gray-700 py-3 pl-12 pr-4 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm !rounded-button"
                placeholder="请输入作者名称..."
                on:input={handleSearchInput}
                on:focus={() => { if (searchSuggestions.length) showSearchSuggestions = true; }}
                on:blur={validateSearchInput}
                autocomplete="off"
              />
              {#if showSearchSuggestions && displayedSuggestions.length > 0}
                <ul class="absolute z-50 bg-white border border-gray-200 w-full mt-1 rounded shadow-lg max-h-60 overflow-y-auto">
                  {#each displayedSuggestions as suggestion}
                    <li class="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm" on:mousedown={() => selectSuggestion(suggestion)}>
                      {suggestion.name}
                    </li>
                  {/each}
                  {#if hasMoreSuggestions}
                    <li class="px-4 py-2 text-center border-t border-gray-100">
                      <button
                        class="w-full text-primary hover:text-primary-dark text-sm py-1 hover:bg-gray-50 transition-colors"
                        on:mousedown|preventDefault={() => loadMoreSuggestions()}
                      >
                        加载更多
                      </button>
                    </li>
                  {/if}
                </ul>
              {/if}
            </div>
            
            <!-- 机构输入框 -->
            <div class="relative flex-1 w-full">
              <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <span class="w-5 h-5 flex items-center justify-center text-gray-400"><i class="ri-building-line"></i></span>
              </div>
              
              <input
                type="text"
                bind:value={affiliationInput}
                class="search-input w-full bg-white border border-gray-200 text-gray-700 py-3 pl-12 pr-4 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm !rounded-button"
                placeholder="请输入机构名称..."
                on:input={handleAffiliationInput}
                on:focus={handleAffiliationFocus}
                on:blur={validateAffiliationInput}
                autocomplete="off"
              />
              <!-- 机构下拉建议列表 -->
              {#if showAffiliationSuggestions && displayedAffiliationSuggestions.length > 0}
                <ul class="absolute z-50 bg-white border border-gray-200 w-full mt-1 rounded shadow-lg max-h-60 overflow-y-auto">
                  {#each displayedAffiliationSuggestions as suggestion}
                    <li class="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm" on:mousedown={() => selectAffiliationSuggestion(suggestion)}>
                      {suggestion.display || suggestion.name}
                    </li>
                  {/each}
                  {#if hasMoreAffiliationSuggestions}
                    <li class="px-4 py-2 text-center border-t border-gray-100">
                      <button
                        class="w-full text-primary hover:text-primary-dark text-sm py-1 hover:bg-gray-50 transition-colors"
                        on:mousedown|preventDefault={() => loadMoreAffiliationSuggestions()}
                      >
                        加载更多
                      </button>
                    </li>
                  {/if}
                </ul>
              {/if}
            </div>
          {:else}
            <!-- 原有的单一输入框 -->
            <div class="relative flex-1 w-full">
              <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <span class="w-5 h-5 flex items-center justify-center text-gray-400"><i class="ri-search-line"></i></span>
              </div>
              
              <input
                type="text"
                bind:value={searchInput}
                class="search-input w-full bg-white border border-gray-200 text-gray-700 py-3 pl-12 pr-4 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm !rounded-button"
                placeholder="请输入{entityTypeText === '作者' ? '作者' : '机构'}名称..."
                on:input={handleSearchInput}
                on:focus={() => { if (searchSuggestions.length) showSearchSuggestions = true; }}
                on:blur={validateSearchInput}
                autocomplete="off"
              />
              {#if showSearchSuggestions && displayedSuggestions.length > 0}
                <ul class="absolute z-50 bg-white border border-gray-200 w-full mt-1 rounded shadow-lg max-h-60 overflow-y-auto">
                  {#each displayedSuggestions as suggestion}
                    <li class="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm" on:mousedown={() => selectSuggestion(suggestion)}>
                      {suggestion.display || suggestion.name}
                    </li>
                  {/each}
                  {#if hasMoreSuggestions}
                    <li class="px-4 py-2 text-center border-t border-gray-100">
                      <button
                        class="w-full text-primary hover:text-primary-dark text-sm py-1 hover:bg-gray-50 transition-colors"
                        on:mousedown|preventDefault={() => loadMoreSuggestions()}
                      >
                        加载更多
                      </button>
                    </li>
                  {/if}
                </ul>
              {/if}
            </div>
          {/if}

          <!-- 搜索按钮 -->
          <button class="w-full md:w-auto search-button py-4 px-8 rounded transition-colors duration-200 !rounded-button whitespace-nowrap" on:click={analyzeTrajectory}>
            轨迹主题分析
          </button>
        </div>
      </div>
      <!-- <div class="search-card bg-white rounded-xl p-8 w-full">
          <h2 class="text-xl font-medium text-gray-800 mb-6">学术作者查询</h2>
          <div class="flex flex-col md:flex-row gap-4 items-center">
            <div class="relative flex-1 w-full">
              <div class="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                <span class="w-5 h-5 flex items-center justify-center text-gray-400"><i class="ri-search-line"></i></span>
              </div>
              <input
                type="text"
                bind:value={scholarInput}
                class="search-input w-full bg-white border border-gray-200 text-gray-700 py-3 pl-12 pr-4 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm !rounded-button"
                placeholder="请输入想要查询的学术作者名（英文）"
                on:input={handleScholarInput}
                on:focus={() => { if (scholarSuggestions.length) showScholarSuggestions = true; }}
                on:blur={validateScholarInput}
                autocomplete="off"
              />
              {#if (showScholarSuggestions && scholarSuggestions.length > 0) || isScholarSearching}
                <ul class="absolute z-50 bg-white border border-gray-200 w-full mt-1 rounded shadow-lg max-h-60 overflow-y-auto">
                  {#if isScholarSearching && scholarSuggestions.length === 0}
                    <li class="px-4 py-2 text-sm text-gray-500">正在加载作者...</li>
                  {:else if scholarSuggestions.length === 0}
                    <li class="px-4 py-2 text-sm text-gray-500">暂无匹配作者</li>
                  {:else}
                    {#each scholarSuggestions as suggestion}
                      <li class="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm space-y-1" on:mousedown={() => selectScholarSuggestion(suggestion)}>
                        <div class="font-medium text-gray-800">{suggestion.name}</div>
                        {#if suggestion.id}
                          <p class="text-xs text-gray-500">ID：{suggestion.id}</p>
                        {/if}
                        {#if suggestion.publicationTitle}
                          <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {suggestion.publicationTitle}{suggestion.publicationYear ? ` · ${suggestion.publicationYear}` : ""}
                          </p>
                        {/if}
                      </li>
                    {/each}
                  {/if}
                </ul>
              {/if}
            </div>
            <button
              type="button"
              class="w-full md:w-auto search-button py-4 px-8 rounded transition-colors duration-200 !rounded-button whitespace-nowrap text-center disabled:opacity-60"
              on:click={handleScholarSearch}
              disabled={isScholarQuerying}
            >
              {isScholarQuerying ? "查询中..." : "作者查询"}
            </button>
          </div>
        </div>
      </div>
    </div> -->
  </section>
  
  <!-- 以下内容保持原有结构（平台动态/技术服务/研究成果/合作伙伴/页脚） -->
  <section class="py-8 bg-white">
    <div class="container mx-auto px-4">
      <h2 class="text-2xl font-bold text-primary mb-6 flex items-center">
        <span class="w-1 h-8 bg-primary mr-3"></span>轨迹数据
      </h2>
      <div class="news-grid">
        {#if isLoading}
          <p>正在加载数据...</p>
        {:else if newsData.length === 0}
          <p>暂无轨迹数据</p>
        {:else}
          {#each newsData.slice(0, 3) as news}
            <div class="bg-white shadow-sm rounded overflow-hidden">
              <img src={news.imageurl || "https://via.placeholder.com/400x250"} alt={news.title} class="w-full h-40 object-cover object-top">
              <div class="p-4">
                <h3 class="text-base font-bold mb-2 line-clamp-2">{news.title}</h3>
                <p class="text-gray-600 mb-3 text-sm line-clamp-5">{news.introduction}</p>
                <div class="flex justify-between items-center">
                  <span class="text-gray-500 text-xs">{new Date(news.date).toISOString().split('T')[0]}</span>
                  <a href={news.more.startsWith('http') ? news.more : `https://${news.more}`} target="_blank" rel="noopener noreferrer" class="text-primary text-xs flex items-center bg-transparent border-none cursor-pointer">
                    阅读更多 <i class="ri-arrow-right-line ml-1"></i>
                  </a>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </section>

  <!-- ==================== 新增的 Chatbot 区域 ==================== -->
  <section class="py-8 bg-gray-50">
    <div class="container mx-auto px-4">
      <h2 class="text-2xl font-bold text-primary mb-6 flex items-center">
        <span class="w-1 h-8 bg-primary mr-3"></span>helmdb智能查询助手
      </h2>
      <!-- 加一个圆角和阴影的卡片容器来包裹 iframe -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style="height: 700px;">
        <iframe
         src="http://81.70.12.153:8050/chatbot/E0yZaINpXISegJwV"
         style="width: 100%; height: 100%;"
         frameborder="0"
         allow="microphone">
        </iframe>
      </div>
    </div>
  </section>
  <!-- ========================================================= -->

  <section class="py-8 bg-gray-50">
    <div class="container mx-auto px-4">
      <h2 class="text-2xl font-bold text-primary mb-6 flex items-center">
        <span class="w-1 h-8 bg-primary mr-3"></span>技术服务
      </h2>
      <div class="service-grid-container">
        <div class="service-grid">
          {#if isLoading}
            <p>正在加载数据...</p>
          {:else if servicesData.length === 0}
            <p>暂无技术服务数据</p>
          {:else}
            {#each servicesData.slice(0, 6) as service}
              <div class="bg-white shadow-sm rounded p-4">
                <div class="flex items-center justify-center w-12 h-12 bg-primary bg-opacity-10 rounded-full mb-3">
                  <i class="ri-database-2-line text-primary ri-lg"></i>
                </div>
                <h3 class="text-lg font-bold mb-2">{service.title}</h3>
                <ul class="space-y-2">
                  <li>
                    <div class="flex justify-between mb-1">
                      <span class="font-medium text-sm">{service.introduction || service.title}</span>
                    </div>
                    <p class="text-gray-600 text-xs">{service.text}</p>
                  </li>
                  <li>
                    <button on:click={() => openMarkdown(service.title, service.more, "service")} class="text-primary text-xs flex items-center mt-2 bg-transparent border-none cursor-pointer">
                      查看详情 <i class="ri-arrow-right-line ml-1"></i>
                    </button>
                  </li>
                </ul>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </section>

  <section class="py-8 bg-white">
    <div class="container mx-auto px-4">
      <h2 class="text-2xl font-bold text-primary mb-6 flex items-center">
        <span class="w-1 h-8 bg-primary mr-3"></span>演示示例
      </h2>
      <div class="research-grid">
        {#if isLoading}
          <p>正在加载数据...</p>
        {:else if researchData.length === 0}
          <p>暂无研究成果数据</p>
        {:else}
          {#each researchData.slice(0, 4) as research, i}
            <div class="rounded overflow-hidden shadow-sm relative h-56 group">
              <div class="absolute inset-0 bg-gradient-to-t from-red-800 to-red-500 flex flex-col justify-end p-4 text-white">
                <h3 class="text-lg font-bold mb-1">{research.title}</h3>
                <p class="text-xs mb-3 opacity-80">{research.introduction}</p>
                <a
                  href={research.more?.startsWith('http') ? research.more : `https://${research.more || ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-white text-xs flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer"
                >
                  查看详情 <i class="ri-arrow-right-line ml-1"></i>
                </a>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </section>

  <section class="py-8 bg-white">
    <div class="container mx-auto px-4">
      <h2 class="text-2xl font-bold text-primary mb-6 flex items-center">
        <span class="w-1 h-8 bg-primary mr-3"></span>合作伙伴
      </h2>
      <div class="partner-grid">
        {#if isLoading}
          <p>正在加载数据...</p>
        {:else if partnersData.length === 0}
          <p>暂无合作伙伴数据</p>
        {:else}
          {#each partnersData.slice(0, 6) as partner}
            <div class="flex flex-col items-center justify-center p-3 border border-gray-200 rounded">
              <div class="w-10 h-10 flex items-center justify-center mb-2">
                <i class="ri-building-4-line text-gray-700 ri-lg"></i>
              </div>
              <span class="text-gray-700 text-xs font-medium">{partner.name}</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </section>

  <footer class="bg-primary text-white w-full">
    <div class="container mx-auto px-4">
      <div class="flex flex-col md:flex-row justify之间 items-center">
        <p class="text-sm mb-0">© 2025 武汉大学 版权所有</p>
        <div class="flex space-x-4">
          <a href="#" class="text-sm hover:underline">隐私政策</a>
          <a href="#" class="text-sm hover:underline">使用条款</a>
          <a href="#" class="text-sm hover:underline">网站地图</a>
        </div>
      </div>
    </div>
  </footer>
</main>

{#if showMarkdown}
  <div class="markdown-overlay">
    <Markdownpage 
      title={markdownTitle} 
      content={markdownContent}
      contentType={markdownType} 
      onClose={closeMarkdown} 
    />
  </div>
{/if}
{#if showScholarResults}
  <div class="markdown-overlay">
    <ScholarOverlay
      authorName={scholarResultsData.authorName}
      authorId={scholarResultsData.authorId}
      count={scholarResultsData.count}
      papers={scholarResultsData.papers}
      downloadUrl={scholarDownloadUrl}
      on:close={closeScholarResults}
    />
  </div>
{/if}

