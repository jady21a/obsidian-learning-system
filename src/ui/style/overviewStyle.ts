/**
 * 样式加载器 - 负责注入和管理 CSS
 */
export class overviewStyle {
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
      /* 工具栏样式 */
      .learning-system-toolbar {
        padding: 10px;
        border-bottom: 1px solid var(--background-modifier-border);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .search-container { display: flex; }

      .search-input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
      }

      .group-container {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .group-label {
        color: var(--text-muted);
        font-size: 0.9em;
      }

      .group-select {
        padding: 4px 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
      }

      .refresh-btn {
        padding: 4px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 16px;
      }

      .refresh-btn:hover { background: var(--background-modifier-hover); }

      .stats-container {
        color: var(--text-muted);
        font-size: 0.9em;
      }

      /* 内容区域样式 */
      .learning-system-content {
        padding: 10px;
        overflow-y: auto;
      }

      .empty-state {
        text-align: center;
        color: var(--text-muted);
        padding: 40px 20px;
      }

      .file-group, .tag-group, .date-group { margin-bottom: 20px; }

      .group-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: var(--background-secondary);
        border-radius: 6px;
        cursor: pointer;
        margin-bottom: 8px;
      }

      .group-header:hover { background: var(--background-modifier-hover); }

      .group-title {
        flex: 1;
        display: flex;
        align-items: center;
        font-weight: 500;
      }

      .group-icon { margin-right: 4px; }

      .count-badge {
        background: var(--interactive-accent);
        color: white;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 0.85em;
        font-weight: 500;
      }

      .collapse-btn {
        color: var(--text-muted);
        user-select: none;
        cursor: pointer;
      }

      /* 文件批注显示 */
      .file-annotation-display {
        margin: 8px 0 12px 0;
        padding: 8px 12px;
        background: var(--background-secondary-alt);
        border-radius: 4px;
        font-size: 0.9em;
      }

      .file-annotation-item {
        padding: 4px 0;
        color: var(--text-muted);
      }

      .file-annotation-item strong { color: var(--text-normal); }

      /* 内容卡片样式 */
      .group-content {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-left: 8px;
      }

      .content-card {
        padding: 12px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        transition: all 0.2s;
      }

      .content-card:hover {
        border-color: var(--interactive-accent);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .card-content {
        margin-bottom: 8px;
        display: flex;
        align-items: flex-start;
        gap: 4px;
        flex-wrap: wrap;
      }

      .type-icon { color: var(--text-muted); }

      .content-text {
        flex: 1;
        line-height: 1.5;
        word-wrap: break-word;
      }

      .clickable-content {
        cursor: pointer;
        transition: all 0.2s;
        padding: 4px;
        border-radius: 4px;
      }

      .clickable-content:hover {
        background: var(--background-modifier-hover);
        color: var(--interactive-accent);
      }

      .annotation-badge, .flashcard-badge {
        font-size: 14px;
        cursor: pointer;
        margin-left: 4px;
      }

      .annotation-badge.has-annotation {
        color: var(--interactive-accent);
      }

      /* 批注显示样式 */
      .annotation-display {
        margin: 10px 0;
        padding: 12px;
        background: var(--background-secondary-alt);
        border-left: 3px solid var(--interactive-accent);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .annotation-display:hover {
        background: var(--background-modifier-hover);
        border-left-color: var(--interactive-accent-hover);
      }

      .annotation-content-display {
        line-height: 1.6;
        color: var(--text-normal);
        margin-bottom: 6px;
      }

      .annotation-content-display strong {
        color: var(--text-muted);
        font-size: 0.9em;
      }

      .annotation-timestamp {
        font-size: 0.8em;
        color: var(--text-faint);
        text-align: right;
      }

      .annotation-badge-display {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 12px;
        color: white;
        font-size: 0.85em;
        font-weight: 500;
        margin-right: 8px;
        margin-bottom: 6px;
      }

      /* 内联批注输入 */
      .annotation-input-container {
        margin: 12px 0;
        padding: 12px;
        background: var(--background-primary);
        border: 2px solid var(--interactive-accent);
        border-radius: 6px;
        animation: slideDown 0.2s ease;
      }

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

      .annotation-textarea {
        width: 100%;
        padding: 10px;
        margin-bottom: 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-secondary);
        color: var(--text-normal);
        font-family: inherit;
        font-size: 1em;
        resize: vertical;
        min-height: 60px;
      }

      .annotation-textarea:focus {
        outline: none;
        border-color: var(--interactive-accent);
        background: var(--background-primary);
      }

      .annotation-textarea::placeholder {
        color: var(--text-faint);
      }

      .annotation-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .annotation-buttons button {
        padding: 6px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.9em;
      }

      .annotation-delete-btn {
        background: transparent;
        color: var(--text-muted);
      }

      .annotation-delete-btn:hover {
        color: var(--color-red);
      }

      .annotation-save-btn {
        background: var(--interactive-accent);
        color: white;
      }

      .annotation-save-btn:hover {
        opacity: 0.8;
      }

      /* 元数据区域 */
      .card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 0.9em;
        color: var(--text-muted);
      }

      .tags-container {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .tag {
        background: var(--background-secondary);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.85em;
      }

      .heading-info {
        color: var(--text-muted);
        font-style: italic;
      }

      /* 操作按钮 */
      .card-actions {
        display: flex;
        gap: 6px;
      }

      .action-btn {
        padding: 4px 10px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }

      .action-btn:hover {
        background: var(--interactive-accent);
        color: white;
        border-color: var(--interactive-accent);
      }

      .delete-btn:hover {
        background: var(--color-red);
        border-color: var(--color-red);
      }

      /* 一键创建闪卡按钮组 */
      .flashcard-btn-group {
        display: flex;
        gap: 0;
      }

      .quick-card-btn {
        border-radius: 4px 0 0 4px;
        border-right: none;
      }

      .more-card-btn {
        border-radius: 0 4px 4px 0;
        padding: 4px 6px;
        font-size: 10px;
      }

      .quick-card-btn:hover, .more-card-btn:hover {
        background: var(--interactive-accent);
        color: white;
      }

      .batch-create-btn {
        padding: 6px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--interactive-accent);
        color: white;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
      }

      .batch-create-btn:hover {
        opacity: 0.8;
      }

      .batch-actions-overview {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .batch-mode-btn,
      .select-all-btn,
      .batch-delete-btn,
      .batch-create-cards-btn {
        padding: 6px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.9em;
        font-weight: 500;
      }

      .select-all-btn:hover {
        background: var(--interactive-accent);
        border-color: var(--interactive-accent);
        color: white;
      }

      .batch-mode-btn:hover {
        background: var(--background-modifier-hover);
      }

      .batch-delete-btn:hover {
        background: var(--color-red);
        border-color: var(--color-red);
        color: white;
      }

      .batch-create-cards-btn:hover {
        background: var(--interactive-accent);
        border-color: var(--interactive-accent);
        color: white;
      }

      .batch-checkbox {
        margin-right: 8px;
        cursor: pointer;
      }
      


/* 复习提醒横幅 */
.review-reminder-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reminder-icon {
  font-size: 32px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.reminder-content {
  flex: 1;
  color: white;
}

.reminder-content strong {
  display: block;
  font-size: 1.1em;
  margin-bottom: 4px;
}

.reminder-content p {
  margin: 0;
  font-size: 0.9em;
  opacity: 0.9;
}

.reminder-actions {
  display: flex;
  gap: 8px;
}

.reminder-review-btn,
.reminder-dismiss-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.reminder-review-btn {
  background: white;
  color: var(--interactive-accent);
}

.reminder-review-btn:hover {
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.reminder-dismiss-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.reminder-dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}


      `
      ;
    }
  }