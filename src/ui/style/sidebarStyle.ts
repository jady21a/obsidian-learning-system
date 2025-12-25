// src/ui/styles/StyleLoader.ts

/**
 * 样式加载器 - 负责注入和管理 CSS
 */
export class StyleLoader {
    private static styleId = 'learning-overview-styles';
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
  
  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
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
    margin-bottom: 6px;
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
    font-size: 14px;
    padding: 4px;
    border-radius: 4px;
    transition: var(--overview-transition);
  }
  
  .annotation-btn:hover {
    background: var(--background-modifier-hover);
    transform: scale(1.1);
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
    margin-top: 8px;
    padding: 0;
    background: transparent;
    animation: slideDown 0.15s ease-out;
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
    // pointer-events: none;
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
      `;
    }
  }