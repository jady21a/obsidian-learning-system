// src/ui/components/TableRenderer.ts
import { CardScheduler } from '../../core/CardScheduler';

export class TableRenderer {
  // 检测是否为表格格式
  static isTableFormat(text: string): boolean {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return false;
    
    const hasSeparator = lines.some(line => /^\|?[\s-:|]+\|?$/.test(line.trim()));
    const pipeLines = lines.filter(line => line.includes('|')).length;
    
    return hasSeparator || pipeLines >= lines.length * 0.7;
  }

  // 渲染表格
  static renderTable(markdown: string, showAnswer: boolean = false): HTMLElement {
    const container = document.createElement('div');
    
    if (!markdown?.trim()) {
      container.textContent = '(empty table)';
      return container;
    }

    const lines = markdown.trim().split('\n');
    if (lines.length < 2) {
      container.textContent = markdown;
      return container;
    }

    const table = container.createEl('table', { 
      cls: 'learning-system-table flashcard-review-table' 
    });

    const separatorIndex = this.findSeparatorIndex(lines);
    
    if (separatorIndex > 0) {
      this.renderTableWithHeader(table, lines, separatorIndex, showAnswer);
    } else {
      this.renderTableWithoutHeader(table, lines, showAnswer);
    }

    return container;
  }

  // 查找分隔符位置
  private static findSeparatorIndex(lines: string[]): number {
    return lines.findIndex(line => {
      const cleaned = line.replace(/[\s|]/g, '');
      return cleaned.length >= 3 && /^[-:]+$/.test(cleaned);
    });
  }

  // 渲染带表头的表格
  private static renderTableWithHeader(
    table: HTMLElement,
    lines: string[],
    separatorIndex: number,
    showAnswer: boolean
  ) {
    // 表头
    const headerCells = this.parseCells(lines[separatorIndex - 1]);
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');
    
    headerCells.forEach(cell => {
      const th = headerRow.createEl('th');
      th.innerHTML = this.processCellContent(cell, showAnswer);
    });

    // 数据行
    const tbody = table.createEl('tbody');
    for (let i = separatorIndex + 1; i < lines.length; i++) {
      this.renderTableRow(tbody, lines[i], showAnswer);
    }
  }

  // 渲染无表头的表格
  private static renderTableWithoutHeader(
    table: HTMLElement,
    lines: string[],
    showAnswer: boolean
  ) {
    const tbody = table.createEl('tbody');
    lines.forEach(line => this.renderTableRow(tbody, line, showAnswer));
  }

  // 渲染单行
  private static renderTableRow(
    tbody: HTMLElement,
    line: string,
    showAnswer: boolean
  ) {
    if (!line.trim()) return;
    
    const cells = this.parseCells(line);
    if (cells.length === 0) return;
    
    const row = tbody.createEl('tr');
    cells.forEach(cell => {
      const td = row.createEl('td');
      td.innerHTML = this.processCellContent(cell, showAnswer);
    });
  }

  // 解析单元格
  private static parseCells(line: string): string[] {
    console.log(`parseCells: line="${line}"`);
    
    let trimmed = line.trim();
    if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
    if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
    
    const cells = trimmed
      .split('|')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    
    console.log('  → cells:', cells);
    return cells;
  }

  // 处理单元格内容
  private static processCellContent(cell: string, showAnswer: boolean): string {
    console.log(`processCellContent: cell="${cell}", showAnswer=${showAnswer}`);
    if (!cell.includes('==')) {
      console.log('  → 不包含 ==, 返回原样');
      return cell;
    }
    if (showAnswer) {
      const result = cell.replace(/==([^=]+)==/g, '<span class="revealed">$1</span>');
      console.log('  → showAnswer=true, 返回:', result);
      return result;
    } else {
      const result = cell.replace(/==([^=]+)==/g, '<span class="cloze-blank"></span>');
      console.log('  → showAnswer=false, 返回:', result);
      return result;
    }
  }

  // 渲染带用户答案的表格（完形填空用）
  static renderTableWithUserAnswers(
    originalMarkdown: string,
    deletions: Array<{ answer: string }>,
    userAnswers: string[],
    scheduler: CardScheduler
  ): HTMLElement {
    const container = document.createElement('div');
    const lines = originalMarkdown.trim().split('\n');
    
    if (lines.length < 2) {

      container.textContent = originalMarkdown;
      return container;
    }

    const table = container.createEl('table', { 
      cls: 'learning-system-table flashcard-review-table user-answer-table' 
    });

    const separatorIndex = this.findSeparatorIndex(lines);
    let deletionIndex = 0;
// 渲染表头
if (separatorIndex > 0) {
 
  const headerCells = this.parseCells(lines[separatorIndex - 1]);
  
  const thead = table.createEl('thead');
  const headerRow = thead.createEl('tr');
  
  let headerIndex = 0;  // ← 表头独立计数
headerCells.forEach(cell => {
  const th = headerRow.createEl('th');
  const result = this.processCellWithUserAnswerAndClass(
    cell, deletions, userAnswers, deletionIndex, scheduler
  );
  th.innerHTML = result.html;
  if (result.correctnessClass) {
    th.classList.add(result.correctnessClass);
  }
  if (cell.includes('==')) {
    deletionIndex++;
  }
});

  
}


// 渲染数据行
const tbody = table.createEl('tbody');
const startRow = separatorIndex > 0 ? separatorIndex + 1 : 0;

for (let i = startRow; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  
  const cells = this.parseCells(line);
  if (cells.length === 0) continue;
  
  const row = tbody.createEl('tr');
  cells.forEach(cell => {
    const td = row.createEl('td');
    const result = this.processCellWithUserAnswerAndClass(
      cell, deletions, userAnswers, deletionIndex, scheduler
    );
    td.innerHTML = result.html;
    if (result.correctnessClass) {
      td.classList.add(result.correctnessClass);
    }
    if (cell.includes('==')) {  // ← 改成这样,与表头逻辑一致
      deletionIndex++;
    }
  });
}

    return container;
  }

  // 处理带用户答案的单元格
  private static processCellWithUserAnswer(
    cell: string,
    deletions: Array<{ answer: string }>,
    userAnswers: string[],
    deletionIndex: number,
    scheduler: CardScheduler
  ): string {
    if (!cell.includes('==')) return cell;
    
    const match = cell.match(/==([^=]+)==/);
    if (!match || deletionIndex >= deletions.length) {
      return cell.replace(/==([^=]+)==/g, '<span class="cloze-blank"></span>');
    }
    
    const correctAnswer = deletions[deletionIndex].answer;
    const userAnswer = userAnswers[deletionIndex] || '';
    const evaluation = scheduler.evaluateAnswer(correctAnswer, userAnswer);
    
    const displayText = userAnswer || '(empty)';
    const correctnessClass = evaluation.correctness;
    
    return cell.replace(
      /==([^=]+)==/g,
      `<span class="user-answer-cell ${correctnessClass}">${displayText}</span>`
    );
  }

  // 处理带用户答案的单元格(返回 HTML 和正确性类)
  private static processCellWithUserAnswerAndClass(
    cell: string,
    deletions: Array<{ answer: string }>,
    userAnswers: string[],
    deletionIndex: number,
    scheduler: CardScheduler
  ): { html: string; correctnessClass: string | null } {
    
    const match = cell.match(/==([^=]+)==/);
    if (!match) {  // ← 如果没有匹配到完整的挖空标记
      return { html: cell, correctnessClass: null };
    }
  
    if (!match || deletionIndex >= deletions.length) {
      return { 
        html: cell.replace(/==([^=]+)==/g, '<span class="cloze-blank"></span>'),
        correctnessClass: null
      };
    }
    
    const correctAnswer = deletions[deletionIndex].answer;
    const userAnswer = userAnswers[deletionIndex] || '';
    const evaluation = scheduler.evaluateAnswer(correctAnswer, userAnswer);
    
    const displayText = userAnswer || '(empty)';
    const correctnessClass = evaluation.correctness;
    
    const html = cell.replace(
      /==([^=]+)==/g,
      `<span class="user-answer-cell ${correctnessClass}">${displayText}</span>`
    );
    
    
    return { html, correctnessClass: `cell-${correctnessClass}` };
  }
}