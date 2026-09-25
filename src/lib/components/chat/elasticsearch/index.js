import moment from 'moment';

export const createSearchkitConfig = (indexType = 'patents') => {
  // 基础配置
  const baseConfig = {
    connection: {
      host: "http://81.70.12.153:9388",
      apiKey: null // 无需认证
    }
  };
  
  // 专利搜索配置
  if (indexType === 'patents') {
    return {
      ...baseConfig,
      connection: {
        ...baseConfig.connection,
        index: "patents"
      },
      search_settings: {
        highlight_attributes: ['专利名称', '摘要文本', '主权项内容'],
        search_attributes: [
          { field: '专利名称', weight: 1.2 },
          { field: '摘要文本', weight: 2 },
          { field: '主权项内容', weight: 1 },
          { field: '申请人', weight: 3 },
          { field: '发明人', weight: 2.5 },
          'IPC分类号'
        ],
        result_attributes: [
          '专利名称',
          '申请号',
          '申请人',
          '专利类型',
          '申请人类型',
          '发明人',
          '摘要文本',
          '主权项内容',
          'IPC分类号',
          'IPC主分类号',
          '申请年份',
          '公开公告日',
          '授权公告日',
          '被引证次数'
        ],
        facet_attributes: [
          { attribute: '申请人类型.keyword', field: '申请人类型.keyword', type: 'string' },
          { attribute: '专利类型.keyword', field: '专利类型.keyword', type: 'string' },
          { attribute: 'IPC主分类号.keyword', field: 'IPC主分类号.keyword', type: 'string' },
          { attribute: '申请年份', field: '申请年份', type: 'numeric' }
        ],
        snippet_attributes: ['摘要文本', '专利名称', '主权项内容'],
        disjunctive_facets: [
          '申请人类型.keyword',
          '专利类型.keyword',
          'IPC主分类号.keyword',
          '申请年份'
        ]
      }
    };
  } 
  // 论文搜索配置 - 更新为新的配置
  else if (indexType === 'papers') {
    return {
      ...baseConfig,
      connection: {
        ...baseConfig.connection,
        index: "cs_sci_papers"
      },
      search_settings: {
        highlight_attributes: [
          'Paper_Details.PaperTitle',
          'Abstract',
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
        ],
        disjunctive_facets: [
          'Year',
          'DocType',
          'CitationCount'
        ]
      }
    };
  }
};

// 更新排序选项
export const SORT_OPTIONS = {
  patents: [
    {
      name: "相关度",
      value: []
    },
    {
      name: "申请年份(新→旧)",
      value: [
        {
          field: "申请年份",
          direction: "desc"
        }
      ]
    },
    {
      name: "申请年份(旧→新)",
      value: [
        {
          field: "申请年份",
          direction: "asc"
        }
      ]
    }
  ],
  papers: [
    {
      name: "相关度",
      value: []
    },
    {
      name: "最新发表",
      value: [
        {
          field: "Paper_Basic.Year",
          direction: "desc"
        }
      ]
    },
    {
      name: "最早发表",
      value: [
        {
          field: "Paper_Basic.Year",
          direction: "asc"
        }
      ]
    },
    {
      name: "引用量最高",
      value: [
        {
          field: "Paper_Basic.Citation_Count",
          direction: "desc"
        }
      ]
    },
    {
      name: "标题",
      value: [
        {
          field: "Paper_Details.PaperTitle.keyword",
          direction: "asc"
        }
      ]
    },
    {
      name: "期刊/会议",
      value: [
        {
          field: "Paper_Details.OriginalVenue.keyword",
          direction: "asc"
        }
      ]
    },
    {
      name: "出版商",
      value: [
        {
          field: "Paper_Details.Publisher.keyword",
          direction: "asc"
        }
      ]
    }
  ]
};

// 添加主题变量
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

// 添加中文翻译facet名称
export const facetLabels = {
  // 专利facet标签
  '申请人类型.keyword': '申请人类型',
  '专利类型.keyword': '专利类型',
  'IPC主分类号.keyword': 'IPC主分类号',
  '申请年份': '申请年份',
  
  // 论文facet标签
  'DocType': '文档类型',
  'Publisher': '出版商',
  'OriginalVenue': '期刊/会议',
  'Year': '出版年份',
  'Paper_Basic.Year': '出版年份',
  'CitationCount': '引用量',
  'Author_List.Author_Details.Author_Name': '作者'
};