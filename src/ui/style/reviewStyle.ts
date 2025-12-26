/**
 * 样式加载器 - 负责注入和管理 CSS
 */
export class reviewStyle {
    private static styleId = 'learning-review-styles';
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
       .review-container {
        padding: 16px;
        max-width: 800px;
        margin: 0 auto;
      }

      .empty-state {
        text-align: center;
        padding: 40px 20px;
      }

      .empty-state h2 {
        font-size: 1.8em;
        margin-bottom: 8px;
      }

      .stats-summary {
        margin: 20px 0;
        padding: 16px;
        background: var(--background-secondary);
        border-radius: 8px;
        text-align: left;
        max-width: 300px;
        margin-left: auto;
        margin-right: auto;
      }

      .progress-bar {
        margin-bottom: 20px;
      }

      .progress-stats {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .progress-text {
        font-weight: 600;
        font-size: 1em;
      }

      .bar-container {
        height: 6px;
        background: var(--background-secondary);
        border-radius: 3px;
        overflow: hidden;
      }

      .bar {
        height: 100%;
        background: var(--interactive-accent);
        transition: width 0.3s ease;
      }

      .card-area {
        background: var(--background-primary);
        border: 2px solid var(--background-modifier-border);
        border-radius: 10px;
        padding: 20px;
        min-height: 350px;
        position: relative;
      }

      .top-actions-bar {
        position: absolute;
        top: 16px;
        right: 16px;
        display: flex;
        gap: 6px;
        z-index: 10;
      }

      .top-action-btn {
        width: 32px;
        height: 32px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        color: var(--text-normal);
        padding: 0;
      }

      .top-action-btn:hover {
        background: var(--background-modifier-hover);
        border-color: var(--interactive-accent);
      }

      .more-dropdown {
        position: absolute;
        top: 38px;
        right: 0;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 150px;
        z-index: 100;
      }

      .dropdown-item {
        padding: 8px 14px;
        cursor: pointer;
        transition: background 0.2s;
        white-space: nowrap;
        font-size: 0.9em;
      }

      .dropdown-item:hover {
        background: var(--background-modifier-hover);
      }

      .delete-item:hover {
        background: var(--background-modifier-error-hover);
        color: var(--color-red);
      }

      .card-info {
        display: flex;
        gap: 10px;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--background-modifier-border);
        padding-right: 80px;
      }

      .card-type, .card-deck {
        padding: 3px 10px;
        background: var(--background-secondary);
        border-radius: 10px;
        font-size: 0.85em;
      }

      .question-area, .answer-area {
        margin: 16px 0;
      }

      .question-text {
        font-size: 1.2em;
        line-height: 1.5;
        padding: 14px;
        background: var(--background-secondary);
        border-radius: 6px;
      }

      .cloze-input-area, .qa-input-area {
        margin: 16px 0;
      }

      .cloze-input-area h4, .qa-input-area h4 {
        margin-bottom: 10px;
        color: var(--text-muted);
        font-size: 0.9em;
      }

      .input-group {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .cloze-input {
        flex: 1;
        padding: 8px 12px;
        border: 2px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        font-size: 0.95em;
      }

      .cloze-input:focus, .qa-input:focus {
        border-color: var(--interactive-accent);
        outline: none;
        box-shadow: 0 0 0 2px var(--interactive-accent-hover);
      }

      .qa-input {
        width: 100%;
        min-height: 100px;
        padding: 10px 12px;
        border: 2px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        font-size: 0.95em;
        font-family: inherit;
        resize: vertical;
        line-height: 1.5;
      }

      .question-review {
        margin-bottom: 12px;
        padding: 10px;
        background: var(--background-secondary-alt);
        border-radius: 6px;
      }

      .question-review h4 {
        margin: 0 0 6px 0;
        color: var(--text-muted);
        font-size: 0.85em;
      }

      .review-text {
        color: var(--text-muted);
        font-size: 0.95em;
      }

      .full-text {
        font-size: 1.1em;
        line-height: 1.5;
        padding: 12px;
        background: var(--background-secondary);
        border-radius: 6px;
        margin-bottom: 12px;
      }

      .answer-comparison {
        padding: 10px;
        background: var(--background-secondary-alt);
        border-radius: 6px;
        margin-top: 12px;
      }

      .answer-comparison h4 {
        margin: 0 0 8px 0;
        color: var(--text-muted);
        font-size: 0.85em;
      }

      .comparison-item {
        padding: 8px;
        margin-bottom: 6px;
        background: var(--background-primary);
        border-radius: 4px;
      }

      .user-answer {
        font-weight: 500;
        padding: 2px 6px;
        border-radius: 3px;
      }

      .user-answer.correct {
        background: var(--background-modifier-success, #4caf50) !important;
        color: white !important;
      }

      .user-answer.partial {
        background: #FFC000 !important;
        color: white !important;
      }

      .user-answer.wrong {
        background: var(--background-modifier-error, #f44336) !important;
        color: white !important;
      }

      .correct-answer {
        color: var(--text-accent);
        font-weight: 500;
      }

      .similarity-info {
        color: var(--text-muted);
        font-style: italic;
        font-size: 0.85em;
      }

      .qa-columns-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 12px;
      }

      .qa-column {
        display: flex;
        flex-direction: column;
      }

      .column-label {
        margin: 0 0 8px 0 !important;
        color: var(--text-muted);
        font-size: 0.85em;
      }

      .qa-user-answer, .qa-correct-answer {
        padding: 12px;
        border-radius: 6px;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 0.95em;
        line-height: 1.5;
        min-height: 60px;
      }

      .qa-correct-answer {
        background: var(--background-secondary);
      }

      .qa-user-answer.correct {
        background: #4caf50 !important;
        color: white !important;
      }

      .qa-user-answer.partial {
        background: #FFC000 !important;
        color: white !important;
      }

      .qa-user-answer.wrong {
        background: #f44336 !important;
        color: white !important;
      }

      .qa-user-answer.no-answer {
        background: var(--background-secondary);
        color: var(--text-muted);
        font-style: italic;
        border: 2px dashed var(--background-modifier-border);
      }

      .button-area {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 20px;
      }

      .show-answer-btn {
        padding: 10px 32px;
        font-size: 1em;
      }

      .rating-area {
        margin: 15px 0 10px 0;
        text-align: center;
      }

      .rating-buttons {
        display: flex;
        gap: 20px;
        justify-content: center;
      }

      .rating-btn {
        flex: 1;
        max-width: 120px;
        padding: 14px 8px;
        border: 2px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-primary);
        cursor: pointer;
        transition: all 0.2s;
      }

      .rating-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
      }

      .rating-red:hover { 
        border-color: var(--color-red);
        background: var(--background-modifier-error-hover);
      }

      .rating-orange:hover { 
        border-color: #FFC000;
        background: rgba(255, 192, 0, 0.1);
      }

      .rating-blue:hover { 
        border-color: var(--interactive-accent);
        background: var(--background-modifier-hover);
      }

      .rating-green:hover { 
        border-color: var(--color-green);
        background: var(--background-modifier-success-hover);
      }

      .rating-label {
        font-weight: 600;
        font-size: 1em;
        margin-bottom: 4px;
      }

      .rating-interval {
        font-size: 0.85em;
        color: var(--text-muted);
      }

      .rating-hotkey {
        font-size: 0.75em;
        color: var(--text-muted);
        margin-top: 4px;
        opacity: 0.7;
      }

      .rating-btn:hover .rating-hotkey {
        opacity: 1;
        color: var(--text-normal);
      }

      .learning-system-table, .flashcard-review-table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0;
        background: var(--background-primary);
      }

      .learning-system-table th, .learning-system-table td,
      .flashcard-review-table th, .flashcard-review-table td {
        padding: 10px 12px;
        text-align: left;
        border: 1px solid var(--background-modifier-border);
      }

      .learning-system-table th, .flashcard-review-table th {
        background: var(--background-secondary);
        font-weight: 600;
        color: var(--text-normal);
      }

      .learning-system-table tr:hover, .flashcard-review-table tr:hover {
        background: var(--background-modifier-hover);
      }

      .cloze-blank {
        display: inline-block;
        min-width: 60px;
        padding: 2px 8px;
        background: var(--background-secondary);
        border: 2px dashed var(--text-muted);
        border-radius: 4px;
        color: var(--text-muted);
        font-family: monospace;
        font-size: 0.9em;
      }

      mark.revealed {
        background: var(--text-highlight-bg);
        color: var(--text-normal);
        padding: 2px 4px;
        border-radius: 3px;
        font-weight: 600;
      }

      .table-answer, .table-question {
        padding: 0 !important;
      }

      .cloze-table-columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }

      .user-answer-cell {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: 600;
      }

      .user-answer-cell.correct {
        background: #4caf50 !important;
        color: white !important;
      }

      .user-answer-cell.partial {
        background: #FFC000 !important;
        color: white !important;
      }

      .user-answer-cell.wrong {
        background: #f44336 !important;
        color: white !important;
      }

      `
      ;
    }
  }