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
        
.qa-answer-input {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  border: 2px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: 0.95em;
  font-family: inherit;
  resize: vertical;
  line-height: 1.5;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.qa-answer-input:focus {
  outline: none;
}

.qa-answer-input::placeholder {
  color: var(--text-faint);
  font-style: italic;
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
        outline: none;
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
      font-size:13px;
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
        background: var(--background-primary);
        border-radius: 4px;
      }

      .user-answer {
        font-weight: 500;
        padding: 2px 6px;
        border-radius: 3px;
      }

      .user-answer.correct {
       background-color: rgba(40, 167, 69, 0.1)  !important;
        color:  #2ea043;
      }

      .user-answer.partial {
         background-color: rgba(255, 193, 7, 0.15) !important;
        color: #ff9f0a;
      }

      .user-answer.wrong {
        background-color: rgba(220, 53, 69, 0.1) !important;
        color: #e5534b;
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

      /* ============================================================================
         Action Row - 按钮布局
         ============================================================================ */
      .action-row {
        position: relative;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 20px;
        padding: 0 20px;
        min-height: 60px;
      }

      /* 中间的主要按钮(评级或显示答案) */
      .action-row .rating-buttons,
      .action-row .show-answer-btn {
        flex: 0 1 auto;
      }

      /* 翻页按钮定位到左下角和右下角 */

      .show-answer-btn {
        padding: 10px 32px;
        font-size: 1em;
        border: 2px solid var(--interactive-accent);
        border-radius: 8px;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
      }

      .show-answer-btn:hover {
        background: var(--interactive-accent-hover);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
/* 翻页按钮 - 纯文本样式 */
    button.nav-btn {
        padding: 8px 12px;
        background: transparent; !important
        border: none;!important
        cursor: pointer;
        font-size: 1.2em;
       color: var(--text-muted) !important;
        transition: all 0.2s;
        box-shadow: none;!important
      }

     button.nav-btn:hover {
        background: transparent;!important
        border: none !important
        color: var(--text-normal) !important;
        transform: scale(1.2);
        box-shadow: none;!important
      }

      .nav-btn:active {
        transform: scale(1.1);
      }

      /* action-row 中的定位 */
      .action-row .nav-btn {
        position: absolute;
      }

      .action-row .prev-btn {
        left: 0px;
      }

      .action-row .next-btn {
        right: 0px;
      }

      .prev-btn:hover {
        padding-left: 8px;
        transform: translateX(-3px) scale(1.2);
      }

      .next-btn:hover {
        padding-right: 8px;
        transform: translateX(3px) scale(1.2);
      }


      
      .show-answer-btn {
        padding: 10px 32px;
        font-size: 1em;
      }

      .rating-area {
        margin: 15px 0 10px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 40px; 
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

   

      .cloze-blank {
        display: inline-block;
        min-width: 60px;
        padding: 2px 8px;
        color: var(--text-muted);
        font-family: monospace;
        font-size: 0.9em;
      }

          

      .table-answer, .table-question {
        padding: 0 !important;
      }

      .cloze-table-columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 16px;
      }

      .user-answer-cell {
        display: inline;
        padding: 0px 4px;
        border-radius: 3px;
        font-weight: 600;
      }

      .user-answer-cell.correct {
         color: #2ea043;
      }

      .user-answer-cell.partial {
        color: #ff9f0a;

      }

      .user-answer-cell.wrong {
       color: #e5534b;

      }

      /* 表格单元格正确性颜色 */
.learning-system-table.user-answer-table td.cell-correct,
.learning-system-table.user-answer-table th.cell-correct {
  background-color: rgba(40, 167, 69, 0.1);
}

.learning-system-table.user-answer-table td.cell-partial,
.learning-system-table.user-answer-table th.cell-partial {
  background-color: rgba(255, 193, 7, 0.15);
}

.learning-system-table.user-answer-table td.cell-wrong,
.learning-system-table.user-answer-table th.cell-wrong {
  background-color: rgba(220, 53, 69, 0.1);
}

.learning-system-table.user-answer-table .user-answer-cell {
  font-weight: 500;
}
// 在 reviewStyle.inject() 中添加提示样式

.cloze-input-hint {
  font-size: 0.85em;
  color: var(--text-muted);
  margin-bottom: 12px;
  padding: 8px;
  background: var(--background-secondary);
  border-radius: 4px;
  border-left: 3px solid var(--interactive-accent);
}
// 在 reviewStyle.inject() 方法中添加:

/* 单个输入框样式 */
.single-input-group {
  margin-bottom: 16px;
}

.cloze-single-input {
  width: 100%;
  padding: 12px;
  font-size: 14px;
  border: 2px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
  color: var(--text-normal);
  transition: border-color 0.2s;
}

.cloze-single-input:focus {
  outline: none;
}



.cloze-input-hint code {
  background: var(--background-modifier-border);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--font-monospace);
  font-size: 0.9em;
}

/* 预览区域 */
.answer-preview-area {
  margin-top: 16px;
  padding: 12px;
  background: var(--background-secondary);
  border-radius: 6px;
}

.answer-preview-area h5 {
  margin: 0 0 8px 0;
  font-size: 0.9em;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.preview-list {
  margin: 0;
  padding-left: 24px;
  list-style: decimal;
}

.preview-item {
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  font-family: var(--font-monospace);
  font-size: 0.9em;
}

.preview-item.filled {
  background: var(--background-primary);
  color: var(--text-normal);
  font-weight: 500;
}

.preview-item.empty {
  background: transparent;
  color: var(--text-faint);
  font-style: italic;
}


/* ============================================================================
   Table Styles
   ============================================================================ */
.learning-system-table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}

.learning-system-table th,
.learning-system-table td {
  line-height: 1.4;
  height: 22px;        
  padding: 2px 4px;
  text-align: left;
   vertical-align: middle;
  border: 1px solid var(--background-modifier-border);
}

.learning-system-table th {
  background: var(--background-secondary);
  font-weight: 400;
  color: var(--text-normal);
}

.learning-system-table td {
  color: var(--text-normal);
}

.learning-system-table tr:hover td {
  background: var(--background-modifier-hover);
}

/* ← 新增:被挖空的单元格背景色(显示答案前) */
.learning-system-table td:has(.cloze-blank),
.learning-system-table th:has(.cloze-blank) {
  background-color: rgba(80, 126, 91, 0.1);
}
.learning-system-table th.has-cloze {
  background-color: rgba(40, 167, 69, 0.15) !important;
  border-left: 2px solid rgba(40, 167, 69, 0.6);
}
/* ← 新增:被挖空的单元格背景色(显示答案后,已揭示) */
.learning-system-table td:has(span.revealed),
.learning-system-table th:has(span.revealed)
{
  background-color: rgba(70, 113, 80, 0.15);
  border-left: 2px solid rgba(40, 167, 69, 0.5);
}

/* User Answer Table - Cell correctness background */
.user-answer-table td.cell-correct {
  background-color: rgba(76, 125, 85, 0.15);
}

/* 预览答案的样式 */
.preview-answer {

  color: #4a9eff;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
}

.preview-table .cloze-blank {
  color: #666;
  padding: 2px 8px;
  border-radius: 3px;
}


`
      ;
}
  }