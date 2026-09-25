  // 处理生成报告按钮点击
  function handleGenerateReport(result) {
    console.log("生成报告:", result);
    // 使用论文标题作为分析对象，这对应于"论文分析报告生成"模型
    const paperTitle = result[titleField]?.raw || "未知论文";
    const paperId = result.PaperID?.raw || "未知ID";
    dispatch('generateReport', { institutionName: paperTitle, institutionId: paperId });
  }
  
  // 处理机构分析按钮点击
  function handleAnalyzeInstitution(result) {
    console.log("分析机构:", result);
    // 使用发表机构作为分析对象，这对应于"机构主题轨迹报告生成"模型
    const institutionName = result.Publisher?.raw || "未知机构";
    const institutionId = result.PaperID?.raw || "未知ID";
    dispatch('analyzeInstitution', { institutionName, institutionId, result });
  } 