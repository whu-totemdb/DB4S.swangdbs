/**
 * @typedef {Object} InstitutionResult
 * @property {number} id - 机构ID
 * @property {string} name - 机构名称
 * @property {string} [gridId] - Grid ID
 * @property {string} [country] - 国家代码
 * @property {{lat: number, lon: number}} location - 地理位置
 * @property {{
*   hIndex?: number,
*   productivity?: number,
*   averageC10?: number,
*   averageLogC10?: number
* }} metrics - 机构指标
* @property {string} [officialPage] - 官方网页
* @property {number} [distance] - 距离（单位：千米）
*/

/**
* @typedef {Object} ElasticsearchHit
* @property {{
*   AffiliationID: number,
*   Affiliation_Name: string,
*   GridID?: string,
*   ISO3166Code?: string,
*   location: {lat: number, lon: number},
*   'H-index'?: number,
*   Productivity?: number,
*   Average_C10?: number,
*   Average_LogC10?: number,
*   Official_Page?: string
* }} _source - ES返回的源数据
* @property {number[]} [sort] - 排序值
*/
export function createSearchkitConfig() {
  return {
    connection: {
      host: 'http://81.70.12.153:9388',
      index: 'sci_papers_v2_v4'
    },
    search_settings: {
      highlight_attributes: [
        'Paper_Details.PaperTitle',
        'Abstract.PaperAbstract',
        'Paper_Details.Publisher',
        'Paper_Details.OriginalVenue',
        'Author_List.Author_Details.Author_Name',
        'Author_List.Affiliation_Details.Affiliation_Name'
      ],
      search_attributes: [
        { field: 'Paper_Details.PaperTitle', weight: 1.2 },
        { field: 'Abstract', weight: 2 },
        { field: 'Paper_Details.OriginalVenue', weight: 1.5 },
        'Paper_Details.Publisher',
        'Paper_Basic.DOI',
        { field: 'Author_List.Author_Details.Author_Name', weight: 3 },
        { field: 'Author_List.Affiliation_Details.Affiliation_Name', weight: 2.5 }
      ],
      result_attributes: [
        'PaperID',
        'Paper_Details.PaperTitle',
        'Abstract',
        'Paper_Basic.DOI',
        'Paper_Basic.Year',
        'Paper_Basic.Date',
        'Paper_Details.OriginalVenue',
        'Paper_Details.Publisher',
        'Paper_Basic.Citation_Count',
        'Paper_Details.DocType',
        'Paper_Basic.Reference_Count',
        'Paper_Details.Volume',
        'Paper_Details.Issue',
        'Author_List',
        'BookTitle',
        'JournalID'
      ],
      facet_attributes: [
        { attribute: 'Year', field: 'Paper_Basic.Year', type: 'numeric' },
        { attribute: 'DocType', field: 'Paper_Details.DocType', type: 'string' },
        { 
          attribute: 'CitationCount', 
          field: 'Paper_Basic.Citation_Count', 
          type: 'range',
          ranges: [
            { from: 0, to: 10, name: '0-9' },
            { from: 10, to: 50, name: '10-49' },
            { from: 50, to: 100, name: '50-99' },
            { from: 100, to: 500, name: '100-499' },
            { from: 500, to: 1000, name: '500-999' },
            { from: 1000, to: null, name: '1000+' }
          ] 
        }
      ],
      snippet_attributes: [
        'Abstract', 
        'Paper_Details.PaperTitle', 
        'Paper_Details.Publisher', 
        'Paper_Details.OriginalVenue', 
        'Author_List.Author_Details.Author_Name',
        'Author_List.Affiliation_Details.Affiliation_Name'
      ]
    }
  };
}

/**
 * @typedef {Object} Location
 * @property {number} lat - 纬度
 * @property {number} lon - 经度
 */

/**
 * 验证位置信息是否有效
 * @param {Location} location - 位置对象
 * @throws {Error} 当位置参数无效时抛出错误
 */
function validateLocation(location) {
  if (!location || typeof location.lat !== 'number' || typeof location.lon !== 'number') {
    throw new Error('无效的位置参数');
  }
  if (location.lat < -90 || location.lat > 90) {
    throw new Error('纬度必须在 -90 到 90 之间');
  }
  if (location.lon < -180 || location.lon > 180) {
    throw new Error('经度必须在 -180 到 180 之间');
  }
}

/**
 * 格式化搜索结果
 * @param {any} hit - ES搜索结果
 */
function formatResult(hit) {
  return {
    name: hit._source.Affiliation_Name || null,
    AffiliationID: hit._source.AffiliationID || null,
    gridId: hit._source.GridID || null,
    country: hit._source.ISO3166Code || null,
    location: hit._source.Location ? {
      lat: hit._source.Location.Latitude || null,
      lon: hit._source.Location.Longitude || null
    } : null,
    metrics: hit._source.Metrics || null,
    officialPage: hit._source.Official_Page || null,
    distance: hit.sort?.[0] || null
  };
}
// 添加地理位置搜索的配置
export function createGeoSearchConfig() {
  return {
    connection: {
      host: 'http://81.70.12.153:9388',
      index: 'subset_cs_sciscinet_affiliations'
    },
    search_settings: {
      result_attributes: [
        "AffiliationID",
        "Affiliation_Name",
        "GridID",
        "ISO3166Code",
        "location",
        "H-index",
        "Productivity",
        "Average_C10",
        "Average_LogC10",
        "Official_Page"
      ],
      // 搜索半径配置
      search_radius: 100 // 默认搜索半径（米）
    }
  };
}
/**
 * 搜索附近的机构
 * @param {Object} location - 位置对象
 * @param {number} location.lat - 纬度
 * @param {number} location.lon - 经度
 * @returns {Promise<InstitutionResult | null>} 返回最近的机构信息，如果未找到则返回 null
 */
// 添加地理位置搜索函数
export async function searchNearbyInstitutions(location, searchRadius = "1km") {
  try {
    const { lat, lon } = location || {};
    
    // 验证坐标
    if (!lat || !lon) {
      console.log('未提供坐标信息');
      return null;
    }

    // 构建地理位置查询，添加距离过滤
    const query = {
      query: {
        bool: {
          must: [
            {
              geo_distance: {
                distance: searchRadius, // 使用传入的搜索半径
                location: {
                  lat: lat,
                  lon: lon
                }
              }
            }
          ]
        }
      },
      sort: [
        {
          _geo_distance: {
            location: {
              lat: lat,
              lon: lon
            },
            order: "asc", // 按距离升序排序
            unit: "km",
            mode: "min",
            distance_type: "arc"
          }
        }
      ],
      size: 1, // 只返回最近的一个点
      _source: true
    };

    const response = await fetch(`${createGeoSearchConfig().connection.host}/${createGeoSearchConfig().connection.index}/_search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query)
    });

    if (!response.ok) {
      throw new Error(`查询失败: ${response.status}`);
    }

    const data = await response.json();
    if (!data.hits?.hits?.length) {
      console.log('1公里范围内未找到匹配的机构，坐标:', { lat, lon });
      return null;
    }
    /**
   * 格式化机构搜索结果
   * @param {ElasticsearchHit} hit - Elasticsearch 返回的原始数据
   * @returns {InstitutionResult} 格式化后的机构信息
   */
    // 格式化结果
    const formatResult = (hit) => ({
      id: hit._source.AffiliationID,
      name: hit._source.Affiliation_Name,
      gridId: hit._source.GridID,
      country: hit._source.ISO3166Code,
      location: hit._source.location,
      metrics: {
        hIndex: hit._source['H-index'],
        productivity: hit._source.Productivity,
        averageC10: hit._source.Average_C10,
        averageLogC10: hit._source.Average_LogC10
      },
      officialPage: hit._source.Official_Page,
      distance: hit.sort?.[0] // 返回距离（单位：千米）
    });

    const hit = data.hits.hits[0];
    return formatResult(hit);

  } catch (error) {
    console.error('机构查询失败:', error);
    console.log('查询失败的位置坐标:', {
      纬度: location?.lat,
      经度: location?.lon
    });
    return null;
  }
}

export const SORT_OPTIONS = [
  { name: "相关度", value: [] },
  {
    name: "最新发表",
    value: [{ field: "Paper_Basic.Year", direction: "desc" }]
  },
  {
    name: "最早发表",
    value: [{ field: "Paper_Basic.Year", direction: "asc" }]
  },
  {
    name: "引用量最高",
    value: [{ field: "Paper_Basic.Citation_Count", direction: "desc" }]
  }
  // 如需“标题/期刊”排序，请在 ES 为
  // Paper_Details.PaperTitle / Paper_Details.OriginalVenue
  // 增加 keyword 子字段后再启用：
  // { name: "标题", value: [{ field: "Paper_Details.PaperTitle.keyword", direction: "asc" }] },
  // { name: "期刊/会议", value: [{ field: "Paper_Details.OriginalVenue.keyword", direction: "asc" }] },
];

export const THEME_VARIABLES = {
  light: {
    '--sui-border-color': '#e5e7eb',
    '--sui-background-color': '#ffffff',
    '--sui-text-color': '#333333'
  },
  dark: {
    '--sui-border-color': '#4a5568',
    '--sui-background-color': '#1f2937',
    '--sui-text-color': '#e5e7eb'
  }
};

// 中文翻译facet名称
const facetLabels = {
  'DocType': '文档类型',
  'Publisher': '出版商',
  'OriginalVenue': '期刊/会议',
  'Year': '出版年份',
  'Paper_Basic.Year': '出版年份',
  'CitationCount': '引用量',
  'Author_List.Author_Details.Author_Name': '作者'
};

export { facetLabels }; 