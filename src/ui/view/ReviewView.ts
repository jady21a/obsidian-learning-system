// reviewView.ts - 重构版本
import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import type LearningSystemPlugin from '../../main';
import { Flashcard } from '../../core/FlashcardManager';
import { CardScheduler, ReviewEase } from '../../core/CardScheduler';
import { FlashcardEditModal } from '../components/modals/FlashcardEditModal';

import { reviewStyle } from '../style/reviewStyle';
export const VIEW_TYPE_REVIEW = 'learning-system-review';

// ============================================================================
// 辅助类：表格渲染器
// ============================================================================
class TableRenderer {
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
    let trimmed = line.trim();
    if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
    if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
    
    return trimmed
      .split('|')
      .map(c => c.trim())
      .filter(c => c.length > 0);
  }

  // 处理单元格内容
  private static processCellContent(cell: string, showAnswer: boolean): string {
    if (!cell.includes('==')) return cell;
    
    if (showAnswer) {
      return cell.replace(/==([^=]+)==/g, '<mark class="revealed">$1</mark>');
    } else {
      return cell.replace(/==([^=]+)==/g, '<span class="cloze-blank">[___]</span>');
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
      
      headerCells.forEach(cell => {
        const th = headerRow.createEl('th');
        th.innerHTML = this.processCellWithUserAnswer(
          cell, deletions, userAnswers, deletionIndex, scheduler
        );
        if (cell.includes('==')) deletionIndex++;
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
        td.innerHTML = this.processCellWithUserAnswer(
          cell, deletions, userAnswers, deletionIndex, scheduler
        );
        if (cell.includes('==')) deletionIndex++;
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
      return cell.replace(/==([^=]+)==/g, '<span class="cloze-blank">[___]</span>');
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
}

// ============================================================================
// 辅助类：卡片渲染器（策略模式）
// ============================================================================
interface CardRenderStrategy {
  renderQuestion(container: HTMLElement, card: Flashcard, state: ReviewState): void;
  renderAnswer(
    container: HTMLElement, 
    card: Flashcard, 
    state: ReviewState, 
    scheduler: CardScheduler
  ): void;
}

class ClozeCardRenderer implements CardRenderStrategy {
  renderQuestion(container: HTMLElement, card: Flashcard, state: ReviewState): void {
    // 问题文本
    const questionText = container.createDiv({ cls: 'question-text' });
    const isTable = TableRenderer.isTableFormat(card.front);
    
    if (isTable) {
      const tableEl = TableRenderer.renderTable(card.front, false);
      questionText.appendChild(tableEl);
      questionText.classList.add('table-question');
    } else {
      questionText.textContent = card.front;
    }

    // 输入框
    if (card.cloze) {
      const inputArea = container.createDiv({ cls: 'cloze-input-area' });
      inputArea.createEl('h4', { text: 'Fill in the blanks:' });

      // 确保数组长度
      if (state.userAnswers.length < card.cloze.deletions.length) {
        state.userAnswers = new Array(card.cloze.deletions.length).fill('');
      }

      card.cloze.deletions.forEach((deletion, index) => {
        const inputGroup = inputArea.createDiv({ cls: 'input-group' });
        inputGroup.createSpan({ text: `${index + 1}. ` });
        
        const input = inputGroup.createEl('input', {
          type: 'text',
          placeholder: 'Your answer...',
          cls: 'cloze-input',
          value: state.userAnswers[index] || ''
        });
        
        input.addEventListener('input', (e) => {
          state.userAnswers[index] = (e.target as HTMLInputElement).value;
        });

        if (index === 0) {
          setTimeout(() => input.focus(), 50);
        }
      });
    }
  }

  renderAnswer(
    container: HTMLElement,
    card: Flashcard,
    state: ReviewState,
    scheduler: CardScheduler
  ): void {
    if (!card.cloze) return;

    const answerArea = container.createDiv({ cls: 'answer-area' });
    const isOriginalTable = TableRenderer.isTableFormat(card.cloze.original);

    if (isOriginalTable) {
      this.renderTableAnswer(answerArea, card, state, scheduler);
    } else {
      this.renderTextAnswer(answerArea, card, state, scheduler);
    }
  }

  private renderTableAnswer(
    answerArea: HTMLElement,
    card: Flashcard,
    state: ReviewState,
    scheduler: CardScheduler
  ) {
    const columnsContainer = answerArea.createDiv({ cls: 'cloze-table-columns' });
    
    // 左列：正确答案
    const correctColumn = columnsContainer.createDiv({ cls: 'qa-column' });
    correctColumn.createEl('h4', { text: 'Correct Answer:', cls: 'column-label' });
    const correctDiv = correctColumn.createDiv({ cls: 'comparison-item' });
    const tableEl = TableRenderer.renderTable(card.cloze!.original, true);
    correctDiv.appendChild(tableEl);
    correctDiv.classList.add('table-answer');
    
    // 右列：用户答案
    const userColumn = columnsContainer.createDiv({ cls: 'qa-column' });
    userColumn.createEl('h4', { text: 'Your Answer:', cls: 'column-label' });
    const userDiv = userColumn.createDiv({ cls: 'comparison-item' });
    
    if (state.userAnswers.length > 0 && state.userAnswers.some(a => a.trim())) {
      const userTableEl = TableRenderer.renderTableWithUserAnswers(
        card.cloze!.original,
        card.cloze!.deletions,
        state.userAnswers,
        scheduler
      );
      userDiv.appendChild(userTableEl);
      userDiv.classList.add('table-answer');
    } else {
      const emptyTableEl = TableRenderer.renderTable(card.front, false);
      userDiv.appendChild(emptyTableEl);
      userDiv.classList.add('table-answer', 'no-answer');
    }

    // 详细对比
    this.renderDetailedComparison(answerArea, card, state, scheduler);
  }

  private renderTextAnswer(
    answerArea: HTMLElement,
    card: Flashcard,
    state: ReviewState,
    scheduler: CardScheduler
  ) {
    const fullText = answerArea.createDiv({ cls: 'full-text' });
    fullText.textContent = card.cloze!.original;
    
    this.renderDetailedComparison(answerArea, card, state, scheduler);
  }

  private renderDetailedComparison(
    answerArea: HTMLElement,
    card: Flashcard,
    state: ReviewState,
    scheduler: CardScheduler
  ) {
    if (state.userAnswers.length === 0) return;

    const comparison = answerArea.createDiv({ cls: 'answer-comparison' });
    comparison.createEl('h4', { text: 'Answer Details:' });

    card.cloze!.deletions.forEach((deletion, index) => {
      const item = comparison.createDiv({ cls: 'comparison-item' });
      item.createSpan({ text: `${index + 1}. ` });

      const userAnswer = state.userAnswers[index] || '';
      const evaluation = scheduler.evaluateAnswer(deletion.answer, userAnswer);

      item.createEl('span', {
        text: userAnswer || '(empty)',
        cls: `user-answer ${evaluation.correctness}`
      });
      
      item.createSpan({ text: ' → ' });
      
      item.createEl('span', {
        text: deletion.answer,
        cls: 'correct-answer'
      });

      if (evaluation.correctness === 'partial') {
        item.createEl('small', {
          text: ` (${Math.round(evaluation.similarity * 100)}% match)`,
          cls: 'similarity-info'
        });
      }
    });
  }
}

class QACardRenderer implements CardRenderStrategy {
  renderQuestion(container: HTMLElement, card: Flashcard, state: ReviewState): void {
    // 问题文本
    const questionText = container.createDiv({ cls: 'question-text' });
    const isTable = TableRenderer.isTableFormat(card.front);
    
    if (isTable) {
      const tableEl = TableRenderer.renderTable(card.front, false);
      questionText.appendChild(tableEl);
      questionText.classList.add('table-question');
    } else {
      questionText.textContent = card.front;
    }

    // 输入框
    const inputArea = container.createDiv({ cls: 'qa-input-area' });
    inputArea.createEl('h4', { text: 'Your Answer:' });
    
    const textarea = inputArea.createEl('textarea', {
      placeholder: 'Type your answer here...',
      cls: 'qa-input',
      value: state.userAnswer
    });
    
    textarea.addEventListener('input', (e) => {
      state.userAnswer = (e.target as HTMLTextAreaElement).value;
    });
    
    setTimeout(() => textarea.focus(), 50);
  }

  renderAnswer(
    container: HTMLElement,
    card: Flashcard,
    state: ReviewState,
    scheduler: CardScheduler
  ): void {
    const answerArea = container.createDiv({ cls: 'answer-area' });
    
    // 获取正确答案
    const correctAnswer = Array.isArray(card.back) 
      ? (card.back[0] || card.back.join('\n'))
      : card.back as string;
    
    const isTable = TableRenderer.isTableFormat(correctAnswer);
    const evaluation = state.userAnswer.trim() 
      ? scheduler.evaluateAnswer(correctAnswer, state.userAnswer)
      : null;

    const comparison = answerArea.createDiv({ 
      cls: 'answer-comparison qa-comparison' 
    });
    const columnsContainer = comparison.createDiv({ cls: 'qa-columns-container' });
    
    // 左列：正确答案
    this.renderCorrectAnswerColumn(columnsContainer, correctAnswer, isTable);
    
    // 右列：用户答案
    this.renderUserAnswerColumn(
      columnsContainer, 
      state.userAnswer, 
      isTable, 
      evaluation
    );

    // 相似度信息
    if (evaluation?.correctness === 'partial') {
      const similarityInfo = comparison.createEl('div', {
        cls: 'similarity-info qa-similarity'
      });
      similarityInfo.textContent = `Similarity: ${Math.round(evaluation.similarity * 100)}%`;
    }
  }

  private renderCorrectAnswerColumn(
    container: HTMLElement,
    correctAnswer: string,
    isTable: boolean
  ) {
    const correctColumn = container.createDiv({ cls: 'qa-column' });
    correctColumn.createEl('h4', { text: 'Correct Answer:', cls: 'column-label' });
    const correctAnswerDiv = correctColumn.createDiv({ cls: 'comparison-item' });
    
    if (isTable) {
      const tableEl = TableRenderer.renderTable(correctAnswer, true);
      correctAnswerDiv.appendChild(tableEl);
      correctAnswerDiv.classList.add('table-answer');
    } else {
      correctAnswerDiv.createEl('div', {
        text: correctAnswer,
        cls: 'correct-answer qa-correct-answer'
      });
    }
  }

  private renderUserAnswerColumn(
    container: HTMLElement,
    userAnswer: string,
    isTable: boolean,
    evaluation: any
  ) {
    const userColumn = container.createDiv({ cls: 'qa-column' });
    userColumn.createEl('h4', { text: 'Your Answer:', cls: 'column-label' });
    const userAnswerDiv = userColumn.createDiv({ cls: 'comparison-item' });

    const isUserAnswerTable = TableRenderer.isTableFormat(userAnswer.trim());
    const shouldRenderAsTable = isUserAnswerTable || (isTable && userAnswer.trim());

    if (shouldRenderAsTable && userAnswer.trim()) {
      try {
        const userTableEl = TableRenderer.renderTable(userAnswer, true);
        userAnswerDiv.appendChild(userTableEl);
        userAnswerDiv.classList.add('table-answer');
        
        if (evaluation) {
          userAnswerDiv.classList.add('user-answer', evaluation.correctness);
        }
      } catch (error) {
        this.renderTextUserAnswer(userAnswerDiv, userAnswer, evaluation);
      }
    } else {
      this.renderTextUserAnswer(userAnswerDiv, userAnswer, evaluation);
    }
  }

  private renderTextUserAnswer(
    container: HTMLElement,
    userAnswer: string,
    evaluation: any
  ) {
    const userAnswerElement = container.createEl('div', {
      text: userAnswer.trim() || '(no answer provided)',
      cls: 'qa-user-answer'
    });
    
    if (evaluation) {
      userAnswerElement.classList.add('user-answer', evaluation.correctness);
    } else {
      userAnswerElement.classList.add('no-answer');
    }
  }
}

// ============================================================================
// 卡片渲染器工厂
// ============================================================================
class CardRendererFactory {
  private static renderers = new Map<string, CardRenderStrategy>([
    ['cloze', new ClozeCardRenderer()],
    ['qa', new QACardRenderer()]
  ]);

  static getRenderer(cardType: string): CardRenderStrategy {
    const renderer = this.renderers.get(cardType);
    if (!renderer) {
      throw new Error(`Unknown card type: ${cardType}`);
    }
    return renderer;
  }
}

// ============================================================================
// 复习状态
// ============================================================================
interface ReviewState {
  showAnswer: boolean;
  startTime: number;
  userAnswers: string[];
  userAnswer: string;
}

// ============================================================================
// 主视图类
// ============================================================================
export class ReviewView extends ItemView {
  plugin: LearningSystemPlugin;
  private scheduler: CardScheduler;
  private dueCards: Flashcard[] = [];
  private currentCardIndex: number = 0;
  private currentCard: Flashcard | null = null;
  private reviewState: ReviewState = this.createInitialState();

  constructor(leaf: WorkspaceLeaf, plugin: LearningSystemPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.scheduler = new CardScheduler();
  }

  getViewType(): string {
    return VIEW_TYPE_REVIEW;
  }

  getDisplayText(): string {
    return 'Flashcard Review';
  }

  getIcon(): string {
    return 'layers';
  }

  async onOpen() {
    await this.loadDueCards();
    this.render();
    reviewStyle.inject();
    this.registerKeyboardHandlers();
  }

  async onClose() {
    document.removeEventListener('keydown', this.keyboardHandler);
  }

  // ============================================================================
  // 状态管理
  // ============================================================================
  private createInitialState(): ReviewState {
    return {
      showAnswer: false,
      startTime: 0,
      userAnswers: [],
      userAnswer: ''
    };
  }

  private resetReviewState() {
    this.reviewState = this.createInitialState();
  }

  private updateCurrentCard() {
    const newCard = this.dueCards[this.currentCardIndex];
    if (this.currentCard?.id !== newCard?.id) {
      this.resetReviewState();
      this.currentCard = newCard;
    }
    if (!this.reviewState.showAnswer && this.reviewState.startTime === 0) {
      this.reviewState.startTime = Date.now();
    }
  }

  // ============================================================================
  // 数据加载
  // ============================================================================
  private async loadDueCards() {
    this.dueCards = this.plugin.flashcardManager.getDueCards();
    this.currentCardIndex = 0;
    this.resetReviewState();
  }

  // ============================================================================
  // 渲染逻辑
  // ============================================================================
  private render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('review-container');

    if (this.dueCards.length === 0) {
      this.renderNoDueCards(container);
      return;
    }

    this.updateCurrentCard();
    this.renderProgress(container);
    
    const cardArea = container.createDiv({ cls: 'card-area' });
    this.renderTopActions(cardArea);
    
    if (this.reviewState.showAnswer) {
      this.renderAnswerView(cardArea);
    } else {
      this.renderQuestionView(cardArea);
    }
  }

  private renderNoDueCards(container: Element) {
    const emptyState = container.createDiv({ cls: 'empty-state' });
    emptyState.createEl('h2', { text: '🎉 All Done!' });
    emptyState.createEl('p', { text: 'No cards due for review right now.' });

    const stats = this.plugin.flashcardManager.getStats();
    const statsDiv = emptyState.createDiv({ cls: 'stats-summary' });
    statsDiv.createEl('p', { text: `Total cards: ${stats.total}` });
    statsDiv.createEl('p', { text: `New cards: ${stats.new}` });
    statsDiv.createEl('p', { text: `Reviewed today: ${stats.reviewedToday}` });

    const closeBtn = emptyState.createEl('button', {
      text: 'Close Review',
      cls: 'mod-cta'
    });
    
    closeBtn.onclick = () => {
      this.leaf?.detach();
    };
  }

  private renderProgress(container: Element) {
    const progressBar = container.createDiv({ cls: 'progress-bar' });
    
    const stats = progressBar.createDiv({ cls: 'progress-stats' });
    stats.createSpan({ 
      text: `${this.currentCardIndex + 1} / ${this.dueCards.length}`,
      cls: 'progress-text'
    });

    const barContainer = progressBar.createDiv({ cls: 'bar-container' });
    const bar = barContainer.createDiv({ cls: 'bar' });
    const progress = ((this.currentCardIndex + 1) / this.dueCards.length) * 100;
    bar.style.width = `${progress}%`;
  }

  private renderTopActions(container: HTMLElement) {
    const actionsBar = container.createDiv({ cls: 'top-actions-bar' });

    // Jump to Source 按钮
    const jumpBtn = actionsBar.createEl('button', {
      cls: 'top-action-btn jump-icon-btn',
      attr: { 'aria-label': 'Jump to Source' }
    });
    jumpBtn.innerHTML = '↗';
    jumpBtn.addEventListener('click', () => this.jumpToSource());

    // More 菜单
    this.renderMoreMenu(actionsBar);
  }

  private renderMoreMenu(actionsBar: HTMLElement) {
    const moreBtn = actionsBar.createEl('button', {
      cls: 'top-action-btn more-btn',
      attr: { 'aria-label': 'More actions' }
    });
    moreBtn.innerHTML = '⋯';
    
    const dropdown = actionsBar.createDiv({ cls: 'more-dropdown' });
    dropdown.style.display = 'none';

    // 菜单项配置
    const menuItems = [
      {
        label: '✏️ Edit Card',
        onClick: () => this.editCurrentFlashcard()
      },
      {
        label: '🔄 Reset Card Stats',
        onClick: async () => {
          if (this.currentCard && confirm('确定要重置这张卡片的学习进度吗？')) {
            await this.resetCardStats(this.currentCard.id);
          }
        }
      },
      {
        label: '📚 Reset Deck Stats',
        onClick: async () => {
          if (this.currentCard) {
            const deckName = this.currentCard.deck;
            if (confirm(`确定要重置卡组"${deckName}"的所有学习进度吗？`)) {
              await this.plugin.analyticsEngine.clearDeckStats(deckName);
              new Notice(`✅ 卡组"${deckName}"的统计已重置`);
              await this.loadDueCards();
              this.render();
            }
          }
        }
      },
      {
        label: '🗑️ Delete Card',
        onClick: async () => {
          if (this.currentCard && confirm('确定要删除这张闪卡吗？')) {
            await this.deleteFlashcard(this.currentCard.id);
          }
        },
        className: 'delete-item'
      }
    ];

    // 创建菜单项
    menuItems.forEach(item => {
      const menuItem = dropdown.createEl('div', {
        cls: `dropdown-item ${item.className || ''}`
      });
      menuItem.innerHTML = item.label;
      menuItem.addEventListener('click', () => {
        item.onClick();
        dropdown.style.display = 'none';
      });
    });

    // 切换下拉菜单
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', () => {
      dropdown.style.display = 'none';
    });

    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  private renderQuestionView(container: HTMLElement) {
    if (!this.currentCard) return;

    // 卡片信息
    this.renderCardInfo(container);

    // 问题区域
    const questionArea = container.createDiv({ cls: 'question-area' });
    questionArea.createEl('h3', { text: 'Question' });

    // 使用策略模式渲染
    const renderer = CardRendererFactory.getRenderer(this.currentCard.type);
    renderer.renderQuestion(questionArea, this.currentCard, this.reviewState);

    // 显示答案按钮
    this.renderShowAnswerButton(container);
  }

  private renderAnswerView(container: HTMLElement) {
    if (!this.currentCard) return;

    // 卡片信息
    this.renderCardInfo(container);

    // 问题回顾
    this.renderQuestionReview(container);

    // 使用策略模式渲染答案
    const renderer = CardRendererFactory.getRenderer(this.currentCard.type);
    renderer.renderAnswer(container, this.currentCard, this.reviewState, this.scheduler);

    // 评级按钮
    this.renderRatingButtons(container);
  }

  private renderCardInfo(container: HTMLElement) {
    if (!this.currentCard) return;

    const cardInfo = container.createDiv({ cls: 'card-info' });
    cardInfo.createSpan({ 
      text: this.currentCard.type === 'qa' ? '📝 Q&A' : '✏️ Cloze',
      cls: 'card-type'
    });
    cardInfo.createSpan({ 
      text: `Deck: ${this.currentCard.deck}`,
      cls: 'card-deck'
    });
  }

  private renderQuestionReview(container: HTMLElement) {
    if (!this.currentCard) return;

    const questionReview = container.createDiv({ cls: 'question-review' });
    questionReview.createEl('h4', { text: 'Question:' });

    const reviewTextDiv = questionReview.createDiv({ cls: 'review-text' });
    const isQuestionTable = TableRenderer.isTableFormat(this.currentCard.front);
    
    if (isQuestionTable) {
      const tableEl = TableRenderer.renderTable(this.currentCard.front, false);
      reviewTextDiv.appendChild(tableEl);
      reviewTextDiv.classList.add('table-question');
    } else {
      reviewTextDiv.textContent = this.currentCard.front;
    }
  }

  private renderShowAnswerButton(container: HTMLElement) {
    const buttonArea = container.createDiv({ cls: 'button-area' });
    const showAnswerBtn = buttonArea.createEl('button', {
      text: 'Show Answer',
      cls: 'mod-cta show-answer-btn',
      attr: { title: 'Press Enter or Tab' }
    });
    showAnswerBtn.addEventListener('click', () => {
      this.reviewState.showAnswer = true;
      this.render();
    });
  }

  private renderRatingButtons(container: HTMLElement) {
    const ratingArea = container.createDiv({ cls: 'rating-area' });
    const buttonGroup = ratingArea.createDiv({ cls: 'rating-buttons' });

    const ratings: Array<{
      ease: ReviewEase;
      label: string;
      color: string;
      key: string;
    }> = [
      { ease: 'again', label: 'Again\n < 1 min', color: 'red', key: '1' },
      { ease: 'hard', label: 'Hard\n < 10 min', color: 'orange', key: '2' },
      { ease: 'good', label: 'Good\n 1 day', color: 'blue', key: '3' },
      { ease: 'easy', label: 'Easy\n 4 days', color: 'green', key: '4' }
    ];

    ratings.forEach(({ ease, label, color, key }) => {
      const btn = buttonGroup.createEl('button', {
        cls: `rating-btn rating-${color}`,
        attr: { title: `Press ${key}` }
      });
      
      const lines = label.split('\n');
      btn.createEl('div', { text: lines[0], cls: 'rating-label' });
      btn.createEl('div', { text: lines[1], cls: 'rating-interval' });
      btn.createEl('div', { text: `(${key})`, cls: 'rating-hotkey' });

      btn.addEventListener('click', () => this.submitReview(ease));
    });
  }

  // ============================================================================
  // 交互处理
  // ============================================================================
  private async submitReview(ease: ReviewEase) {
    if (!this.currentCard) return;

    const timeSpent = (Date.now() - this.reviewState.startTime) / 1000;

    const userAnswer = this.currentCard.type === 'cloze' 
      ? this.reviewState.userAnswers 
      : this.currentCard.type === 'qa'
      ? this.reviewState.userAnswer
      : undefined;

    const { updatedCard, reviewLog } = this.scheduler.schedule(
      this.currentCard,
      ease,
      timeSpent,
      userAnswer
    );

    await this.plugin.flashcardManager.updateCard(updatedCard);
    await this.plugin.flashcardManager.logReview({
      id: `log-${Date.now()}`,
      ...reviewLog
    });

    this.currentCardIndex++;
    this.resetReviewState();

    if (this.currentCardIndex >= this.dueCards.length) {
      new Notice(`✅ Review session complete! Reviewed ${this.dueCards.length} cards.`);
      await this.loadDueCards();
    }

    this.render();
  }

  private async jumpToSource() {
    if (!this.currentCard) return;

    const file = this.app.vault.getAbstractFileByPath(this.currentCard.sourceFile);
    if (!(file instanceof TFile)) {
      new Notice('Source file not found');
      return;
    }

    const contentUnit = this.plugin.dataManager.getContentUnit(
      this.currentCard.sourceContentId
    );

    if (!contentUnit) {
      new Notice('Source content not found');
      return;
    }

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);

    setTimeout(() => {
      const view = this.app.workspace.getActiveViewOfType(ItemView);
      if (view) {
        const editor = (view as any).editor;
        if (editor) {
          editor.setCursor({ line: contentUnit.source.position.line, ch: 0 });
          editor.scrollIntoView({
            from: { line: contentUnit.source.position.line, ch: 0 },
            to: { line: contentUnit.source.position.line, ch: 0 }
          }, true);
        }
      }
    }, 100);
  }

  private async deleteFlashcard(cardId: string) {
    try {
      await this.plugin.flashcardManager.deleteCard(cardId);
      new Notice('🗑️ 闪卡已删除');
      
      this.dueCards = this.dueCards.filter(card => card.id !== cardId);
      
      if (this.currentCard?.id === cardId) {
        if (this.currentCardIndex >= this.dueCards.length) {
          this.currentCardIndex = Math.max(0, this.dueCards.length - 1);
        }
        this.currentCard = null;
      }
      
      await this.loadDueCards();
      this.render();
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      new Notice('❌ 删除闪卡失败');
    }
  }

  private editCurrentFlashcard() {
    if (!this.currentCard) return;

    const modal = new FlashcardEditModal(
      this.app,
      this.currentCard,
      async (question: string, answer: string) => {
        try {
          const updatedCard: Flashcard = {
            ...this.currentCard!,
            front: question,
            back: this.currentCard!.type === 'cloze' ? [answer] : answer,
            metadata: {
              ...this.currentCard!.metadata,
              updatedAt: Date.now()
            }
          };
          
          await this.plugin.flashcardManager.updateCard(updatedCard);
          new Notice('✅ 闪卡已更新');
          
          this.currentCard = updatedCard;
          this.render();
        } catch (error) {
          console.error('Error updating flashcard:', error);
          new Notice('❌ 更新闪卡失败');
        }
      }
    );
    modal.open();
  }

  private async resetCardStats(cardId: string) {
    try {
      const card = this.plugin.flashcardManager.getFlashcard(cardId);
      if (!card) return;

      card.stats = {
        totalReviews: 0,
        correctCount: 0,
        averageTime: 0,
        lastReview: 0,
        difficulty: 0.3
      };
      card.scheduling = {
        interval: 0,
        ease: 2.5,
        due: Date.now(),
        lapses: 0,
        reps: 0,
        state: 'new'
      };

      await this.plugin.flashcardManager.updateCard(card);
      
      const logs = this.plugin.flashcardManager['reviewLogs'] || [];
      this.plugin.flashcardManager['reviewLogs'] = logs.filter(
        log => log.flashcardId !== cardId
      );
      await this.plugin.dataManager.save();
      
      new Notice('✅ 卡片统计已重置');
      this.currentCard = card;
      this.render();
    } catch (error) {
      console.error('Error resetting card stats:', error);
      new Notice('❌ 重置统计失败');
    }
  }

  // ============================================================================
  // 键盘处理
  // ============================================================================
  private keyboardHandler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

    // Tab 键处理
    if (e.key === 'Tab') {
      e.preventDefault();
      
      if (e.shiftKey) {
        if (this.reviewState.showAnswer) {
          this.resetReviewState();
          this.render();
        }
      } else {
        if (!this.reviewState.showAnswer) {
          this.reviewState.showAnswer = true;
          this.render();
        } else {
          this.submitReview('good');
        }
      }
      return;
    }

    // 数字键评分
    if (this.reviewState.showAnswer && !isInInput) {
      const ratingMap: { [key: string]: ReviewEase } = {
        '1': 'again',
        '2': 'hard',
        '3': 'good',
        '4': 'easy'
      };
      
      if (ratingMap[e.key]) {
        e.preventDefault();
        this.submitReview(ratingMap[e.key]);
      }
    }
  };

  private registerKeyboardHandlers() {
    document.addEventListener('keydown', this.keyboardHandler);
  }

  // ============================================================================
  // 样式
  // ============================================================================

}