<script>
  import { onMount } from 'svelte';
  import { marked } from 'marked'; // 直接导入marked库
  
  // 接收传入的参数
  export let title = "示例Markdown文档";
  export let content = "";
  export let contentType = "article"; // article, service, research
  export let onClose = () => {}; // 新增关闭回调函数
  
  // 如果没有传入内容，使用默认的Markdown内容
  const defaultContent = `# Markdown示例文档

## 简介

Markdown是一种轻量级标记语言，创始人为约翰·格鲁伯（John Gruber）。

## 基本语法

### 标题

标题使用#号来表示，例如：
# 一级标题 (在Markdown中使用 # 表示)
## 二级标题 (在Markdown中使用 ## 表示)

### 强调

**这是粗体文本**

*这是斜体文本*

### 列表

无序列表：
* 项目1
* 项目2
* 项目3

有序列表：
1. 第一项
2. 第二项
3. 第三项

### 链接和图片

[这是一个链接](https://github.com)

### 引用

> 这是一段引用的文本

### 代码块

\`\`\`javascript
function sayHello() {
  console.log('你好，世界！');
}
\`\`\`

### 表格

| 名称 | 说明 |
| --- | --- |
| Markdown | 轻量级标记语言 |
| HTML | 超文本标记语言 |`;

  // 根据contentType生成不同的内容
  function generateContent() {
    // 如果传入了content，直接使用传入的content
    if (content && content.trim() !== "") {
      return content;
    }
    
    // 否则根据contentType生成默认内容
    if (contentType === "service") {
      return `# ${title}

## 服务介绍

这是我们提供的一项专业服务，旨在帮助企业实现数字化转型。

## 服务内容

- 数据收集与整理
- 数据分析与挖掘
- 行业洞察与报告
- 决策支持与建议

## 服务流程

1. **需求调研**：了解企业现状和需求
2. **方案设计**：根据需求定制解决方案
3. **实施落地**：专业团队执行方案
4. **效果评估**：定期评估实施效果

## 成功案例

> "通过使用该服务，我们公司的生产效率提高了30%，成本降低了15%。" —— 某制造业企业CEO

如需了解更多信息，请与我们联系。`;
    } else if (contentType === "research") {
      return `# ${title}

## 研究背景

在全球化和信息化快速发展的今天，本研究旨在探索新形势下的发展路径。

## 研究方法

- 文献综述
- 实证研究
- 案例分析
- 专家访谈

## 主要发现

1. 数字技术正在重塑产业链结构
2. 跨界融合成为产业升级的主要路径
3. 智能化转型是提升竞争力的关键

## 研究意义

本研究对政府政策制定、企业战略规划具有重要参考价值。

## 相关论文

| 论文标题 | 发表期刊 | 发表时间 |
| --- | --- | --- |
| 《数字经济时代的产业升级路径》 | 《经济研究》 | 2024年 |
| 《智能制造与产业链重构》 | 《管理学报》 | 2023年 |

更多研究成果持续更新中...`;
    } else {
      return defaultContent;
    }
  }
  
  // 标题变量
  let documentTitle = title;
  
  // 获取Markdown内容
  let markdownContent = generateContent();
  
  // 渲染后的HTML内容
  let renderedHtml = "";
  
  // 暗色模式状态
  let isDarkMode = false;
  
  // 主题图标和文本
  let themeIcon = "🌙";
  let themeText = "切换暗色模式";
  
  // 切换暗色模式的函数
  function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    
    if (isDarkMode) {
      themeIcon = "☀️";
      themeText = "切换亮色模式";
      localStorage.setItem('theme', 'dark');
    } else {
      themeIcon = "🌙";
      themeText = "切换暗色模式";
      localStorage.setItem('theme', 'light');
    }
  }
  
  // 返回首页/关闭
  function goBack() {
    // 调用传入的关闭回调
    onClose();
  }
  
  onMount(() => {
    // 检查并应用保存的主题
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      isDarkMode = true;
      themeIcon = "☀️";
      themeText = "切换亮色模式";
    }
    
    try {
      // 设置marked选项
      marked.setOptions({
        breaks: true,
        gfm: true
      });
      
      // 渲染Markdown
      renderedHtml = marked.parse(markdownContent);
    } catch (e) {
      console.error("渲染Markdown时出错:", e);
      renderedHtml = `<h1>Markdown渲染错误</h1><p>错误信息: ${e.message}</p>`;
    }
  });
</script>

<svelte:head>
  <!-- 引入GitHub风格的Markdown CSS -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
  <!-- 引入代码高亮CSS -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css">
  <!-- 引入动画库 -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
</svelte:head>

<div class={isDarkMode ? "markdown-page dark-mode" : "markdown-page"}>
  <!-- 顶部导航栏 -->
  <div class="navbar">
    <div class="navbar-container">
      <div class="flex items-center gap-2">
        <button class="back-button" on:click={goBack}>
          <i class="ri-arrow-left-line"></i> 返回
        </button>
        <span class="navbar-brand">
          {documentTitle}
        </span>
      </div>
      <button class="theme-switch" on:click={toggleDarkMode}>
        <span class="theme-icon">{themeIcon}</span>
        <span class="theme-text">{themeText}</span>
      </button>
    </div>
  </div>

  <div class="container">
    <!-- 主要内容卡片 -->
    <div class="card animate__animated animate__fadeInUp">
      <div class="header">
        <h1 class="title">{documentTitle}</h1>
      </div>
      
      <div class="markdown-body">
        <!-- 使用Svelte的@html指令插入HTML内容 -->
        {@html renderedHtml}
      </div>
    </div>
    
    <div class="footer">
      <p>© 2025 学术资源检索系统 | Markdown文档查看器</p>
    </div>
  </div>
</div>

<style>
  :root {
    --primary-color: #0366d6;
    --primary-hover: #0255b3;
    --dark-primary: #58a6ff;
    --dark-bg: #0d1117;
    --light-bg: #f6f8fa;
    --card-bg: white;
    --dark-card-bg: #161b22;
    --border-color: #eaecef;
    --dark-border: #30363d;
    --text-color: #24292e;
    --dark-text: #c9d1d9;
    --secondary-text: #6a737d;
    --dark-secondary: #8b949e;
    --header-bg: #f8f9fa;
    --dark-header-bg: #161b22;
    --navbar-bg: #24292e;
    --dark-navbar-bg: #161b22;
    --success-color: #238636;
    --success-hover: #2ea043;
  }
  
  /* 滚动条样式 */
  :global(.markdown-page ::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }
  
  :global(.markdown-page ::-webkit-scrollbar-track) {
    background: #f1f1f1;
  }
  
  :global(.markdown-page ::-webkit-scrollbar-thumb) {
    background: #888;
    border-radius: 4px;
  }
  
  :global(.markdown-page ::-webkit-scrollbar-thumb:hover) {
    background: #555;
  }
  
  .markdown-page {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: var(--text-color);
    background-color: var(--light-bg);
    margin: 0;
    padding: 0;
    transition: background-color 0.3s ease, color 0.3s ease;
    scroll-behavior: smooth;
    min-height: 100vh;
  }
  
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
  }
  
  .card {
    background-color: var(--card-bg);
    border-radius: 12px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    margin-bottom: 30px;
    transition: all 0.3s ease;
    animation: fadeIn 0.5s ease-out;
  }
  
  .card:hover {
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
    transform: translateY(-3px);
  }
  
  .header {
    padding: 20px 30px;
    border-bottom: 1px solid var(--border-color);
    background-color: var(--header-bg);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .title {
    margin: 0;
    color: var(--primary-color);
    font-size: 1.8rem;
    font-weight: 600;
  }
  
  .markdown-body {
    padding: 30px;
  }
  
  .theme-switch {
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 10px 18px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .theme-switch:hover {
    background-color: var(--primary-hover);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  .theme-switch:active {
    transform: translateY(0);
  }
  
  /* 返回按钮 */
  .back-button {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 14px;
    padding: 5px 10px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }
  
  .back-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  /* 顶部导航栏 */
  .navbar {
    background-color: var(--navbar-bg);
    padding: 15px 0;
    color: white;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    position: sticky;
    top: 0;
    z-index: 1000;
  }
  
  .navbar-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 900px;
    margin: 0 auto;
    padding: 0 20px;
  }
  
  .navbar-brand {
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .navbar-brand img {
    width: 32px;
    height: 32px;
  }
  
  /* 黑暗模式样式 */
  .dark-mode {
    background-color: var(--dark-bg);
    color: var(--dark-text);
  }
  
  .dark-mode .card {
    background-color: var(--dark-card-bg);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  }
  
  .dark-mode .header {
    border-bottom: 1px solid var(--dark-border);
    background-color: var(--dark-header-bg);
  }
  
  .dark-mode .title {
    color: var(--dark-primary);
  }
  
  .dark-mode .navbar {
    background-color: var(--dark-navbar-bg);
    border-bottom: 1px solid var(--dark-border);
  }
  
  .dark-mode .theme-switch {
    background-color: var(--success-color);
  }
  
  .dark-mode .theme-switch:hover {
    background-color: var(--success-hover);
  }
  
  :global(.dark-mode ::-webkit-scrollbar-track) {
    background: #1a1a1a;
  }
  
  :global(.dark-mode ::-webkit-scrollbar-thumb) {
    background: #555;
  }
  
  :global(.dark-mode ::-webkit-scrollbar-thumb:hover) {
    background: #777;
  }
  
  /* 添加页脚 */
  .footer {
    text-align: center;
    padding: 30px 20px;
    margin-top: 40px;
    color: var(--secondary-text);
    font-size: 14px;
    border-top: 1px solid var(--border-color);
    background-color: var(--card-bg);
  }
  
  .dark-mode .footer {
    border-top: 1px solid var(--dark-border);
    color: var(--dark-secondary);
    background-color: var(--dark-card-bg);
  }
  
  /* 响应式设计 */
  @media (max-width: 768px) {
    .container {
      padding: 15px;
    }
    
    .header {
      padding: 15px 20px;
      flex-direction: column;
      align-items: flex-start;
    }
    
    .theme-switch {
      margin-top: 10px;
    }
    
    .markdown-body {
      padding: 20px;
    }
  }
  
  /* 特色区块 */
  .feature-section {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 20px;
    margin: 40px 0;
  }
  
  .feature-card {
    flex: 1 1 250px;
    background-color: var(--card-bg);
    border-radius: 12px;
    padding: 25px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
    text-align: center;
  }
  
  .dark-mode .feature-card {
    background-color: var(--dark-card-bg);
  }
  
  .feature-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  }
  
  .feature-icon {
    font-size: 2.5rem;
    margin-bottom: 15px;
    color: var(--primary-color);
  }
  
  .feature-title {
    font-size: 1.2rem;
    font-weight: 600;
    margin-bottom: 10px;
  }
  
  .feature-description {
    color: var(--secondary-text);
    font-size: 0.95rem;
    line-height: 1.5;
  }
  
  .dark-mode .feature-icon {
    color: var(--dark-primary);
  }
  
  .dark-mode .feature-description {
    color: var(--dark-secondary);
  }
  
  /* 图片样式 */
  .banner-image {
    width: 100%;
    max-height: 250px;
    object-fit: cover;
    border-radius: 8px 8px 0 0;
  }
  
  :global(.markdown-content img) {
    max-width: 100%;
    border-radius: 6px;
    margin: 15px 0;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
  }
  
  :global(.markdown-content img:hover) {
    transform: scale(1.02);
  }
  
  /* 加载动画 */
  .loading {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 50px 0;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-left-color: var(--primary-color);
    animation: spin 1s linear infinite;
  }
  
  .dark-mode .spinner {
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-left-color: var(--dark-primary);
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  /* 错误消息 */
  .error {
    background-color: #ffebe9;
    color: #cf222e;
    padding: 15px;
    border-radius: 6px;
    border-left: 4px solid #cf222e;
    margin: 15px 0;
  }
  
  .dark-mode .error {
    background-color: rgba(207, 34, 46, 0.1);
    color: #ff7b72;
  }
</style>
