// src/ui/styles/StyleLoader.ts

/**
 * 样式加载器 - 负责注入和管理 CSS
 */
export class StyleLoader {
    private static styleId = 'learning-sideOverview-styles';
    private static isInjected = false;
  
    /**
     * 注入样式到页面
     */
    static inject(): void {
      if (this.isInjected || document.getElementById(this.styleId)) {
        return;
      }
  
      const styleEl = document.createElement('style');
      styleEl.id = this.styleId;
      styleEl.textContent = this.getStyles();
      document.head.appendChild(styleEl);
      
      this.isInjected = true;
    }
  
    /**
     * 移除样式
     */
    static remove(): void {
      const styleEl = document.getElementById(this.styleId);
      if (styleEl) {
        styleEl.remove();
        this.isInjected = false;
      }
    }
  
    /**
     * 获取所有样式（从这里统一管理）
     */
    private static getStyles(): string {
      return `
  /* ==================== CSS 变量配置 ==================== */
  .learning-overview-container {
    --overview-sidebar-width: 250px;
    --overview-card-gap: 8px;
    --overview-border-radius: 6px;
    --overview-transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* ==================== 全局容器 ==================== */
  .learning-overview-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--background-primary);
  }
  
  /* ==================== 侧边栏模式 ==================== */
  .learning-overview-container[data-mode="sidebar"] {
    padding: 0;
  }
  
  .sidebar-toolbar {
    padding: 12px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    flex-shrink: 0;
    position: relative;
    z-index: 10;
  }
  
  .sidebar-content-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--overview-card-gap);
    position: relative;
    z-index: 1;
  }
  
  /* ==================== 工具栏组件 ==================== */
  .search-container {
    margin-bottom: 10px;
      pointer-events: auto;
  }
  
  .search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--overview-border-radius);
    font-size: 13px;
    background: var(--background-primary);
    color: var(--text-normal);
    transition: var(--overview-transition);
      pointer-events: auto;
  }
  
  .search-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }
  
  .filter-chips {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }
  
  .filter-chip {
    flex: 1;
    text-align: center;
    padding: 6px 8px;
    font-size: 11px;
    border-radius: 12px;
    background: var(--background-secondary);
    cursor: pointer;
    transition: var(--overview-transition);
    border: 1px solid transparent;
  }
  
  .filter-chip:hover {
    background: var(--background-modifier-hover);
  }
  
  .filter-chip.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    font-weight: 600;
    border-color: var(--interactive-accent);
  }
  
  .group-switcher {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }
  
  .group-btn {
    flex: 1;
    text-align: center;
    padding: 6px;
    font-size: 16px;
    border-radius: var(--overview-border-radius);
    background: var(--background-secondary);
    cursor: pointer;
    transition: var(--overview-transition);
    border: 1px solid transparent;
  }
  
  .group-btn:hover {
    background: var(--background-modifier-hover);
  }
  
  .group-btn.active {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    transform: scale(1.05);
  }
  
  /* ==================== 批量操作 ==================== */
  .stats-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 3px;
  }
  
.stats-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.stats-center {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: flex-start;
}

.stats-right {
  display: flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
  margin-left: auto; /* 推到最右侧 */
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 复习检查按钮样式 */
.review-check-btn-stats {
  width: 32px;
  height: 32px;
  padding: 0;
  cursor: pointer;
  font-size: 14px;
  transition: var(--overview-transition);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
   background-color: transparent;
   border:none;
}

.review-check-btn-stats:hover {
  background: var(--interactive-accent);
  color: white;
  border-color: var(--interactive-accent);
  transform: scale(1.1);
}

.review-check-btn-stats:active {
  transform: scale(0.95);
}

/* 如果有待复习卡片,添加提示动画 */
.review-check-btn-stats.has-due {
  animation: bellRing 2s ease-in-out infinite;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: #667eea;
}

@keyframes bellRing {
  0%, 100% {
    transform: rotate(0deg);
  }
  10%, 30% {
    transform: rotate(-10deg);
  }
  20%, 40% {
    transform: rotate(10deg);
  }
  50% {
    transform: rotate(0deg);
  }
}

  .batch-create-cards-btn-sidebar,
  .batch-delete-btn-sidebar,
  .cancel-selection-btn-sidebar {
    padding: 6px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--overview-border-radius);
    background: var(--background-secondary);
    cursor: pointer;
    transition: var(--overview-transition);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
  }
  
  .batch-create-cards-btn-sidebar:hover {
    background: var(--interactive-accent);
    color: white;
    border-color: var(--interactive-accent);
  }
  
  .batch-delete-btn-sidebar:hover {
    background: var(--color-red);
    color: white;
    border-color: var(--color-red);
  }
  
  .cancel-selection-btn-sidebar:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    border-color: var(--text-muted);
  }
  
  .batch-create-cards-btn-header,
  .batch-delete-btn-header,
  .cancel-selection-btn-header {
    padding: 8px 16px;
    font-size: 13px;
    border-radius: var(--overview-border-radius);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    cursor: pointer;
    transition: var(--overview-transition);
    font-weight: 500;
    white-space: nowrap;
  }
  
  .batch-create-cards-btn-header:hover {
    background: var(--interactive-accent);
    color: white;
    border-color: var(--interactive-accent);
  }
  
  .batch-delete-btn-header:hover {
    background: var(--color-red);
    color: white;
    border-color: var(--color-red);
  }
  
  .cancel-selection-btn-header:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    border-color: var(--text-muted);
  }
  
  .select-all-btn-sidebar {
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--overview-border-radius);
    background: var(--background-secondary);
    cursor: pointer;
    transition: var(--overview-transition);
    font-size: 11px;
    font-weight: 500;
    flex-shrink: 0;
  }
  
  .select-all-btn-sidebar:hover,
  .select-all-btn-sidebar.completed {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: white;
  }
  
  .select-all-btn-header {
    padding: 8px 16px;
    font-size: 13px;
    border-radius: var(--overview-border-radius);
    background: var(--background-secondary);
    color: var(--text-normal);
    border: 1px solid var(--background-modifier-border);
    cursor: pointer;
    transition: var(--overview-transition);
    font-weight: 500;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
  
  .select-all-btn-header:hover,
  .select-all-btn-header.completed {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }
  
  .stats-badge {
    text-align: center;
    font-size: 11px;
    color: var(--text-muted);
    padding: 4px;
    flex: 1;
  }
  
  .batch-actions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
    flex-wrap: wrap;
    padding: 8px;
    background: var(--background-secondary-alt);
    border-radius: var(--overview-border-radius);
    animation: slideDown 0.2s ease;
  }
  
  /* ==================== 卡片样式 ==================== */
  .compact-card {
    display: flex;
    gap: 8px;
    padding: 10px;
    margin: 4px 0;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--overview-border-radius);
    transition: var(--overview-transition);
  }
  
  .compact-card:hover {
    border-color: var(--interactive-accent);
    background: var(--background-primary-alt);
    transform: translateX(2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .card-indicator {
    width: 4px;
    border-radius: 2px;
    background: var(--background-modifier-border);
    flex-shrink: 0;
    transition: var(--overview-transition);
  }
  
  .card-indicator.type-qa {
    background: linear-gradient(to bottom, transparent 0%, transparent 50%, #10b981 50%, #10b981 100%);
  }
  
  .card-indicator.type-cloze {
    background: linear-gradient(to bottom, transparent 0%, transparent 50%, #FFF176 50%, #FFF176 100%);
  }
  
  .card-indicator.type-text {
    background: linear-gradient(to bottom, transparent 0%, transparent 50%, #6b7280 50%, #6b7280 100%);
  }
  
  .card-indicator.type-qa.has-annotation {
    background: linear-gradient(to bottom, #3b82f6 0%, #3b82f6 50%, #10b981 50%, #10b981 100%);
  }
  
  .card-indicator.type-cloze.has-annotation {
    background: linear-gradient(to bottom, #3b82f6 0%, #3b82f6 50%, #FFF176 50%, #FFF176 100%);
  }
  
  .card-indicator.type-text.has-annotation {
    background: linear-gradient(to bottom, #3b82f6 0%, #3b82f6 50%, #6b7280 50%, #6b7280 100%);
  }
  
  .type-indicator {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .type-indicator.type-qa {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }
  
  .type-indicator.type-cloze {
    background: rgba(255, 241, 118, 0.2);
    color: #FFF176;
  }
  
  .type-indicator.type-text {
    background: rgba(107, 114, 128, 0.2);
    color: #6b7280;
  }
  
  .card-content {
    flex: 1;
    min-width: 0;
  }
  
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2px;
  }
  
  .card-tools {
    display: flex;
    gap: 4px;
  }
  
  .tool-btn {
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
    border-radius: 4px;
    transition: var(--overview-transition);
  }
  
  .tool-btn:hover {
    background: var(--background-modifier-hover);
  }
  
  .annotation-btn {
    cursor: pointer;
    font-size: 13px;
  }
  

  
  .note-text {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-normal);
    cursor: pointer;
    word-wrap: break-word;
    word-break: break-word;
    white-space: normal;
    overflow-wrap: break-word;
    margin-bottom: 6px;
  }
  
  .note-text:hover {
    color: var(--interactive-accent);
  }
  
  .qa-question {
    font-weight: 500;
    color: var(--text-normal);
  }
  
  .qa-separator {
    color: var(--text-muted);
    margin: 0 4px;
  }
  
  .qa-answer {
    color: var(--text-accent);
    font-style: italic;
  }
  
  .cloze-highlight {
    color: #f59e0b;
    font-weight: 500;
    padding: 1px 3px;
    border-radius: 3px;
  }
  
  .annotation-preview {
    font-size: 11px;
    line-height: 1.4;
    color: var(--text-muted);
    padding: 6px 8px;
    background: var(--background-secondary);
    border-radius: 4px;
    margin-top: 6px;
    border-left: 3px solid var(--interactive-accent);
    cursor: pointer;
    transition: var(--overview-transition);
  }
  
  .annotation-preview:hover {
    background: var(--background-modifier-hover);
  }
  
  .card-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  
  .tag {
    padding: 2px 6px;
    background: var(--tag-background);
    color: var(--tag-color);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 500;
  }
  
  .badge {
    padding: 2px 6px;
    background: var(--background-modifier-border);
    border-radius: 4px;
    font-size: 10px;
  }
  
  .group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: var(--background-secondary);
    border-radius: var(--overview-border-radius);
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  
/* ==================== 批注编辑器 ==================== */
.inline-annotation-editor {
  display: block !important;
  visibility: visible !important;
  margin-top: 8px;
  padding: 0;
  background: transparent;
}
  
  .inline-annotation-textarea {
    width: 100%;
    min-height: 80px;
    padding: 12px 14px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--overview-border-radius);
    background: var(--background-primary-alt);
    color: var(--text-normal);
    font-family: var(--font-text);
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
    transition: var(--overview-transition);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .inline-annotation-textarea:focus {
    outline: none;
    border-color: var(--interactive-accent);
    background: var(--background-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  
  .inline-annotation-textarea::placeholder {
    color: var(--text-faint);
    font-style: italic;
  }
  
  .inline-annotation-hint {
    margin-top: 6px;
    font-size: 11px;
    color: var(--text-faint);
    font-style: italic;
    text-align: left;
  }
  
  .grid-card .inline-annotation-editor {
    margin-top: 8px;
  }
  
  .grid-card .inline-annotation-textarea {
    min-height: 100px;
    font-size: 14px;
    padding: 8px 14px;
  }
  
  /* ==================== 主界面布局 ==================== */
  .main-layout {
    display: grid;
    grid-template-columns: var(--overview-sidebar-width) 1fr;
    gap: 1px;
    height: 100%;
    background: var(--background-modifier-border);
  }
  
  .left-panel {
    background: var(--background-primary);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  
  .right-panel {
    background: var(--background-primary);
    overflow-y: auto;
    padding: var(--overview-card-gap);
  }
  
  .fixed-entries {
    padding: 12px;
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .entry-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--overview-border-radius);
    cursor: pointer;
    transition: var(--overview-transition);
    font-size: 13px;
    font-weight: 500;
    background: var(--background-secondary);
  }
  
  .entry-btn:hover {
    background: var(--background-modifier-hover);
    transform: translateX(2px);
  }
  
  .entry-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  /* ==================== 主界面工具栏 ==================== */
  .main-toolbar {
    padding: 12px;
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
  }
  
  .search-input-main {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--overview-border-radius);
    font-size: 13px;
    background: var(--background-primary);
    color: var(--text-normal);
    margin-bottom: 10px;
    transition: var(--overview-transition);
  }
  
  .search-input-main:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }
  
  .group-switcher-main {
    display: flex;
    gap: 6px;
  }
  
  .group-btn-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 10px;
    font-size: 12px;
    border-radius: var(--overview-border-radius);
    background: var(--background-secondary);
    cursor: pointer;
    transition: var(--overview-transition);
    font-weight: 500;
  }
  
  .group-btn-main:hover {
    background: var(--background-modifier-hover);
    transform: translateY(-1px);
  }
  
  .group-btn-main.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .batch-actions-main {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  
  .batch-actions-main .batch-mode-btn,
  .batch-actions-main .select-all-btn,
  .batch-actions-main .batch-delete-btn,
  .batch-actions-main .batch-create-cards-btn {
    padding: 8px 16px;
    font-size: 12px;
  }
  
  .batch-actions-main .select-all-btn:hover {
    background: var(--interactive-accent);
    border-color: var(--interactive-accent);
    color: white;
  }
  
  .panel-title {
    font-size: 13px;
    font-weight: 600;
    padding: 12px;
    margin: 0;
    color: var(--text-muted);
  }
  
  .file-list {
    padding: 0 8px 8px 8px;
    flex: 1;
    overflow-y: auto;
  }
  
  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--overview-border-radius);
    cursor: pointer;
    transition: var(--overview-transition);
    margin-bottom: 4px;
  }
  
  .file-item:hover {
    background: var(--background-modifier-hover);
  }
  
  .file-item.selected {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
  
  .file-icon {
    font-size: 14px;
  }
  
  .file-name {
    flex: 1;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .file-count {
    font-size: 11px;
    padding: 2px 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
  }
  
  .file-item.selected .file-count {
    background: rgba(255, 255, 255, 0.2);
  }
  
  /* ==================== 网格布局 ==================== */
  .grid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--background-modifier-border);
  }
  
  .grid-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }
  
  .content-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: var(--overview-card-gap);
  }
  
  .grid-card {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: var(--overview-card-gap);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .grid-card:hover {
    border-color: var(--interactive-accent);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
  
  .grid-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--background-modifier-border);
  }
  
  .grid-card-tools {
    display: flex;
    gap: 4px;
  }
  
  .tool-btn-grid {
    cursor: pointer;
    font-size: 16px;
    padding: 4px 6px;
    border-radius: 4px;
    transition: var(--overview-transition);
  }
  
  .tool-btn-grid:hover {
    background: var(--background-modifier-hover);
    transform: scale(1.1);
  }
  
  .grid-note-text {
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-normal);
    cursor: pointer;
    margin-bottom: 10px;
    word-wrap: break-word;
    word-break: break-word;
    white-space: normal;
    overflow-wrap: break-word;
  }
  
  .grid-note-text:hover {
    color: var(--interactive-accent);
  }
  
  .grid-annotation {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-muted);
    padding: 10px;
    background: var(--background-secondary);
    border-radius: 4px;
    border-left: 3px solid var(--interactive-accent);
    margin-top: 10px;
    cursor: pointer;
    transition: var(--overview-transition);
  }
  
  .grid-annotation:hover {
    background: var(--background-modifier-hover);
  }
  
  .grid-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  
  .tag-grid {
    padding: 4px 8px;
    background: var(--tag-background);
    color: var(--tag-color);
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }
  
  .grid-card-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 10px;
    border-top: 1px solid var(--background-modifier-border);
    font-size: 11px;
  }
  
  .doc-name {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .line-info {
    color: var(--text-muted);
  }
  
  .badge-grid {
    padding: 3px 8px;
    background: var(--background-secondary);
    border-radius: 4px;
  }
  
  /* ==================== 闪卡样式 ==================== */
  .flashcard-item {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 8px;
    padding: 16px;
    transition: var(--overview-transition);
  }
  
  .flashcard-item:hover {
    border-color: var(--interactive-accent);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .flashcard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .flashcard-type {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
  }
  
  .flashcard-type.qa {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
  }
  
  .flashcard-type.cloze {
    background: rgba(255, 241, 118, 0.2);
    color: #FFF176;
  }
  
  .flashcard-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .flashcard-question,
  .flashcard-answer {
    font-size: 13px;
    line-height: 1.5;
  }
  
  /* ==================== 空状态 ==================== */
  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
    font-size: 14px;
    position: relative;
    z-index: 1;
  }
  
  .empty-hint {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
    font-size: 13px;
  }
  
  .empty-right-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
  }
  
  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  .empty-text {
    font-size: 14px;
  }
  
  /* ==================== 动画 ==================== */
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* ==================== 响应式 ==================== */
  @media (max-width: 768px) {
    .main-layout {
      grid-template-columns: 1fr;
    }
  
    .left-panel {
      display: none;
    }
  
    .content-grid {
      grid-template-columns: 1fr;
    }
    }


/* 复习图标*/


.review-check-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--overview-border-radius);
  background: var(--background-secondary);
  cursor: pointer;
  font-size: 18px;
  transition: var(--overview-transition);
  flex-shrink: 0;
}

.review-check-btn:hover {
  background: var(--interactive-accent);
  border-color: var(--interactive-accent);
  transform: scale(1.05);
}
@keyframes pulse {
  0%, 100% {
    opacity: 0.85;
  }
  50% {
    opacity: 1;
  }
}

/* 复习提醒具体样式 */
.content-list-review-reminder {

}

.reminder-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.reminder-icon {
  font-size: 24px;
}

.reminder-text strong {
  font-size: 16px;
  font-weight: 600;
}

.reminder-progress {
  margin-bottom: 12px;
}



.progress-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 13px;
  opacity: 0.9;
}

.reminder-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}



.streak-info {
  opacity: 0.95;
}

.reminder-actions {
  display: flex;
  justify-content: flex-end;
}

.reminder-btn.primary {

  font-weight: 500;
  cursor: pointer;
}

.reminder-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* 卡片中表格的完形填空高亮 - 橙色 */
.learning-system-table .card-cloze-highlight {
  background-color: rgba(255, 140, 0, 0.25);
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: 500;
}
    
  /* ==================== 等级徽章图标 ==================== */
.level-badge-icon {
  padding: 4px 6px ;
  color: var(--text-muted);
  border-radius: 7px;
  font-size: 0.85em;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 0px;
  user-select: none;
}

.level-badge-icon:hover {
  transform: translateY(-2px);
}

/* ==================== 等级信息模态框 ==================== */
.level-info-modal {
  padding: 20px;
  max-width: 600px;
}

.level-info-modal h2 {
  text-align: center;
  margin-bottom: 24px;
  font-size: 1.8em;
}

.level-info-modal h3 {
  margin-top: 20px;
  margin-bottom: 12px;
  color: var(--text-muted);
  font-size: 1.1em;
}

.progress-section,
.stats-section,
.milestones-section {
  margin-bottom: 24px;
}

.progress-box {
  padding: 16px;
  background: var(--background-secondary);
  border-radius: 8px;
  border-left: 4px solid var(--interactive-accent);
  line-height: 1.8;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.stats-grid .stat-item {
  padding: 12px;
  background: var(--background-secondary);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-icon {
  font-size: 1.5em;
}

.stat-label {
  font-size: 0.85em;
  color: var(--text-muted);
}

.stat-value {
  font-size: 1.3em;
  font-weight: bold;
  color: var(--text-accent);
}

.milestones-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.milestone-item {
  padding: 12px;
  background: var(--background-secondary);
  border-radius: 8px;
  border-left: 3px solid var(--interactive-accent);
}

.milestone-message {
  font-weight: 500;
  margin-bottom: 4px;
}

.milestone-date {
  font-size: 0.85em;
  color: var(--text-muted);
}

.modal-footer {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

.modal-footer button {
  padding: 8px 24px;
  background: var(--interactive-accent);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1em;
}

.modal-footer button:hover {
  background: var(--interactive-accent-hover);
}
  

/* 卡片类型标识 */
.card-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  margin-right: auto;
  text-transform: uppercase;
}

.card-type-badge.type-qa {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

.card-type-badge.type-cloze {
  background: rgba(255, 241, 118, 0.2);
  color: #FFF176;
}

/* 确保 header 使用 flex 布局并对齐 */
.grid-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 闪卡复习时间样式 */
.flashcard-review-info {
  margin-top: 8px;
  display: flex;
  justify-content: center;
}

.review-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: 500;
  background: var(--background-secondary);
  color: var(--text-muted);
}

.review-time.overdue {
  background: var(--background-modifier-error-hover);
  color: var(--text-error);
}

.review-time.upcoming {
  color: var(--text-on-accent);
}

.review-icon {
  font-size: 1em;
  line-height: 1;
}

.review-text {
  white-space: nowrap;
}

      `;
    }
  }