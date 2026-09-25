// 数据库API配置
export const dbConfig = {
  apiBaseUrl: 'http://81.70.12.153:12456/api',
  endpoints: {
    platformDynamics: '/platform_dynamics',
    technicalServices: '/technical_services',
    researchFindings: '/research_findings',
    cooperativePartners: '/cooperative_partners'
  }
};

// 获取完整API端点URL
export function getApiUrl(endpoint) {
  return `${dbConfig.apiBaseUrl}${endpoint}`;
}

// 获取所有API端点URL
export function getAllApiUrls() {
  return {
    platformDynamics: getApiUrl(dbConfig.endpoints.platformDynamics),
    technicalServices: getApiUrl(dbConfig.endpoints.technicalServices),
    researchFindings: getApiUrl(dbConfig.endpoints.researchFindings),
    cooperativePartners: getApiUrl(dbConfig.endpoints.cooperativePartners)
  };
}
