import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import type LearningSystemPlugin from '../main';
import { Flashcard } from '../core/FlashcardManager';
import { CardScheduler, ReviewEase } from '../core/CardScheduler';

export const VIEW_TYPE_REVIEW = 'learning-system-review';

export class ReviewView extends ItemView {
  plugin: LearningSystemPlugin;
  private scheduler: CardScheduler;
  private dueCards: Flashcard[] = [];
  private currentCardIndex: number = 0;
  private currentCard: Flashcard | null = null;
  private showAnswer: boolean = false;
  private startTime: number = 0;
  private userAnswers: string[] = [];
  private userAnswer: string = ''; // QA 卡片的用户答案

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
    this.addStyles();
  }

  async onClose() {}

  private async loadDueCards() {
    this.dueCards = this.plugin.flashcardManager.getDueCards();
    this.currentCardIndex = 0;
    this.showAnswer = false;
  }

  private render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('review-container');

    if (this.dueCards.length === 0) {
      this.renderNoDueCards(container);
      return;
    }

    const newCard = this.dueCards[this.currentCardIndex];
    
    // 如果切换到新卡片，重置状态
    if (this.currentCard?.id !== newCard?.id) {
      this.userAnswers = [];
      this.userAnswer = '';
      this.showAnswer = false;
      this.startTime = Date.now();
    }
    
    this.currentCard = newCard;
    
    // 如果显示问题且开始时间为0，设置开始时间
    if (!this.showAnswer && this.startTime === 0) {
      this.startTime = Date.now();
    }

    // 进度条
    this.renderProgress(container);

    // 卡片区域
    const cardArea = container.createDiv({ cls: 'card-area' });

    if (this.showAnswer) {
      this.renderAnswer(cardArea);
    } else {
      this.renderQuestion(cardArea);
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
    closeBtn.addEventListener('click', () => {
      this.leaf.detach();
    });
  }

  private renderProgress(container: Element) {
    const progressBar = container.createDiv({ cls: 'progress-bar' });
    
    const stats = progressBar.createDiv({ cls: 'progress-stats' });
    stats.createSpan({ 
      text: `${this.currentCardIndex + 1} / ${this.dueCards.length}`,
      cls: 'progress-text'
    });

    const remaining = this.dueCards.length - this.currentCardIndex - 1;
    stats.createSpan({ 
      text: `${remaining} remaining`,
      cls: 'remaining-text'
    });

    const barContainer = progressBar.createDiv({ cls: 'bar-container' });
    const bar = barContainer.createDiv({ cls: 'bar' });
    const progress = ((this.currentCardIndex + 1) / this.dueCards.length) * 100;
    bar.style.width = `${progress}%`;
  }

  private renderQuestion(container: HTMLElement) {
    if (!this.currentCard) return;

    // 卡片信息
    const cardInfo = container.createDiv({ cls: 'card-info' });
    cardInfo.createSpan({ 
      text: this.currentCard.type === 'qa' ? '📝 Q&A' : '✏️ Cloze',
      cls: 'card-type'
    });
    cardInfo.createSpan({ 
      text: `Deck: ${this.currentCard.deck}`,
      cls: 'card-deck'
    });

    // 问题区域
    const questionArea = container.createDiv({ cls: 'question-area' });
    questionArea.createEl('h3', { text: 'Question' });
    
    const questionText = questionArea.createDiv({ cls: 'question-text' });
    questionText.textContent = this.currentCard.front;

    // 完形填空输入框
    if (this.currentCard.type === 'cloze' && this.currentCard.cloze) {
      const inputArea = container.createDiv({ cls: 'cloze-input-area' });
      inputArea.createEl('h4', { text: 'Fill in the blanks:' });

      // 确保 userAnswers 数组有足够的长度
      if (this.userAnswers.length < this.currentCard.cloze.deletions.length) {
        this.userAnswers = new Array(this.currentCard.cloze.deletions.length).fill('');
      }

      this.currentCard.cloze.deletions.forEach((deletion, index) => {
        const inputGroup = inputArea.createDiv({ cls: 'input-group' });
        inputGroup.createSpan({ text: `${index + 1}. ` });
        
        const input = inputGroup.createEl('input', {
          type: 'text',
          placeholder: 'Your answer...',
          cls: 'cloze-input',
          value: this.userAnswers[index] || ''
        });
        
        input.addEventListener('input', (e) => {
          this.userAnswers[index] = (e.target as HTMLInputElement).value;
        });
      });
    }

    // QA 卡片输入框
    if (this.currentCard.type === 'qa') {
      const inputArea = container.createDiv({ cls: 'qa-input-area' });
      inputArea.createEl('h4', { text: 'Your Answer:' });
      
      const textarea = inputArea.createEl('textarea', {
        placeholder: 'Type your answer here...',
        cls: 'qa-input',
        value: this.userAnswer
      });
      
      textarea.addEventListener('input', (e) => {
        this.userAnswer = (e.target as HTMLTextAreaElement).value;
      });
    }

    // 按钮区域
    const buttonArea = container.createDiv({ cls: 'button-area' });

    // 跳转到源文件
    const jumpBtn = buttonArea.createEl('button', {
      text: '↗ Jump to Source',
      cls: 'jump-btn'
    });
    jumpBtn.addEventListener('click', () => this.jumpToSource());

    // 显示答案按钮
    const showAnswerBtn = buttonArea.createEl('button', {
      text: 'Show Answer',
      cls: 'mod-cta show-answer-btn'
    });
    showAnswerBtn.addEventListener('click', () => {
      this.showAnswer = true;
      this.render();
    });
  }

  private renderAnswer(container: HTMLElement) {
    if (!this.currentCard) return;

    // 卡片信息
    const cardInfo = container.createDiv({ cls: 'card-info' });
    cardInfo.createSpan({ 
      text: this.currentCard.type === 'qa' ? '📝 Q&A' : '✏️ Cloze',
      cls: 'card-type'
    });
    cardInfo.createSpan({ 
      text: `Deck: ${this.currentCard.deck}`,
      cls: 'card-deck'
    });

    // 问题回顾
    const questionReview = container.createDiv({ cls: 'question-review' });
    questionReview.createEl('h4', { text: 'Question:' });
    questionReview.createDiv({ 
      text: this.currentCard.front,
      cls: 'review-text'
    });

    // 答案区域
    const answerArea = container.createDiv({ cls: 'answer-area' });
    answerArea.createEl('h3', { text: 'Answer' });

    if (this.currentCard.type === 'cloze' && this.currentCard.cloze) {
      // 显示完整文本
      const fullText = answerArea.createDiv({ cls: 'full-text' });
      fullText.textContent = this.currentCard.cloze.original;

      // 显示用户答案对比
      if (this.userAnswers.length > 0) {
        const comparison = answerArea.createDiv({ cls: 'answer-comparison' });
        comparison.createEl('h4', { text: 'Your Answers:' });

        this.currentCard.cloze.deletions.forEach((deletion, index) => {
          const item = comparison.createDiv({ cls: 'comparison-item' });
          item.createSpan({ text: `${index + 1}. ` });

          const userAnswer = this.userAnswers[index] || '';
          const evaluation = this.scheduler.evaluateAnswer(
            deletion.answer,
            userAnswer
          );

          const userSpan = item.createEl('span', {
            text: userAnswer || '(empty)',
            cls: `user-answer ${evaluation.correctness}`
          });
          
          // 确保类名正确设置
          userSpan.classList.add('user-answer', evaluation.correctness);

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
    } else {
      // Q&A 答案
      const correctAnswer = this.currentCard.back as string;
      
      // 显示正确答案
      const answerText = answerArea.createDiv({ cls: 'answer-text' });
      answerText.textContent = correctAnswer;

      // 显示用户答案对比
      if (this.userAnswer.trim()) {
        const comparison = answerArea.createDiv({ cls: 'answer-comparison qa-comparison' });
        comparison.createEl('h4', { text: 'Your Answer:' });

        const evaluation = this.scheduler.evaluateAnswer(
          correctAnswer,
          this.userAnswer
        );

        // 详细的调试信息
        console.log('=== Answer Evaluation Debug ===');
        console.log('User Answer:', this.userAnswer);
        console.log('Correct Answer:', correctAnswer);
        console.log('Evaluation Result:', evaluation);
        console.log('Correctness:', evaluation.correctness);
        console.log('Similarity:', evaluation.similarity);

        const userAnswerDiv = comparison.createDiv({ cls: 'comparison-item' });
        const userAnswerElement = userAnswerDiv.createEl('div', {
          text: this.userAnswer || '(empty)'
        });
        
        // 清除所有可能的类名，然后重新添加
        userAnswerElement.className = '';
        userAnswerElement.classList.add('qa-user-answer', 'user-answer', evaluation.correctness);
        
        // 验证类名是否正确设置
        console.log('Applied classes:', userAnswerElement.className);
        console.log('Has correct class:', userAnswerElement.classList.contains('correct'));
        console.log('Has partial class:', userAnswerElement.classList.contains('partial'));
        console.log('Has wrong class:', userAnswerElement.classList.contains('wrong'));
        
        // 直接设置样式用于调试
        if (evaluation.correctness === 'wrong') {
          userAnswerElement.style.backgroundColor = '#f44336';
          userAnswerElement.style.color = 'white';
          console.log('Applied wrong answer styles directly');
        } else if (evaluation.correctness === 'partial') {
          userAnswerElement.style.backgroundColor = '#FFC000';
          userAnswerElement.style.color = 'white';
          console.log('Applied partial answer styles directly');
        } else if (evaluation.correctness === 'correct') {
          userAnswerElement.style.backgroundColor = '#4caf50';
          userAnswerElement.style.color = 'white';
          console.log('Applied correct answer styles directly');
        }

        comparison.createEl('h4', { text: 'Correct Answer:', cls: 'correct-answer-label' });
        const correctAnswerDiv = comparison.createDiv({ cls: 'comparison-item' });
        correctAnswerDiv.createEl('div', {
          text: correctAnswer,
          cls: 'correct-answer qa-correct-answer'
        });

        if (evaluation.correctness === 'partial') {
          const similarityInfo = comparison.createEl('div', {
            cls: 'similarity-info qa-similarity'
          });
          similarityInfo.textContent = `Similarity: ${Math.round(evaluation.similarity * 100)}%`;
        }
      }
    }

    // 评级按钮
    const ratingArea = container.createDiv({ cls: 'rating-area' });
    ratingArea.createEl('h4', { text: 'How well did you know this?' });

    const buttonGroup = ratingArea.createDiv({ cls: 'rating-buttons' });

    const ratings: { ease: ReviewEase; label: string; color: string }[] = [
      { ease: 'again', label: 'Again\n< 1 min', color: 'red' },
      { ease: 'hard', label: 'Hard\n< 10 min', color: 'orange' },
      { ease: 'good', label: 'Good\n1 day', color: 'blue' },
      { ease: 'easy', label: 'Easy\n4 days', color: 'green' }
    ];

    ratings.forEach(({ ease, label, color }) => {
      const btn = buttonGroup.createEl('button', {
        cls: `rating-btn rating-${color}`
      });
      
      const lines = label.split('\n');
      btn.createEl('div', { text: lines[0], cls: 'rating-label' });
      btn.createEl('div', { text: lines[1], cls: 'rating-interval' });

      btn.addEventListener('click', () => this.submitReview(ease));
    });

    // 操作按钮组
    const actionButtons = ratingArea.createDiv({ cls: 'action-buttons' });
    
    // 跳转按钮
    const jumpBtn = actionButtons.createEl('button', {
      text: '↗ Jump to Source',
      cls: 'jump-btn-small'
    });
    jumpBtn.addEventListener('click', () => this.jumpToSource());

    // 删除按钮
    const deleteBtn = actionButtons.createEl('button', {
      text: '🗑️ Delete Card',
      cls: 'delete-btn-small'
    });
    deleteBtn.addEventListener('click', async () => {
      if (!this.currentCard) return;
      if (confirm('确定要删除这张闪卡吗？删除后将从复习队列中移除。')) {
        await this.deleteFlashcard(this.currentCard.id);
      }
    });
  }

  private async submitReview(ease: ReviewEase) {
    if (!this.currentCard) return;

    const timeSpent = (Date.now() - this.startTime) / 1000; // 秒

    // 对于完形填空和 QA 卡片，使用用户答案
    const userAnswer = this.currentCard.type === 'cloze' 
      ? this.userAnswers 
      : this.currentCard.type === 'qa'
      ? this.userAnswer
      : undefined;

    // 计算新的调度
    const { updatedCard, reviewLog } = this.scheduler.schedule(
      this.currentCard,
      ease,
      timeSpent,
      userAnswer
    );

    // 更新卡片
    await this.plugin.flashcardManager.updateCard(updatedCard);

    // 记录日志
    await this.plugin.flashcardManager.logReview({
      id: `log-${Date.now()}`,
      ...reviewLog
    });

    // 下一张卡片
    this.currentCardIndex++;
    this.showAnswer = false;
    this.userAnswers = [];
    this.userAnswer = '';

    if (this.currentCardIndex >= this.dueCards.length) {
      // 复习完成
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

    // 打开文件并跳转
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
      
      // 从当前复习队列中移除
      this.dueCards = this.dueCards.filter(card => card.id !== cardId);
      
      // 如果删除的是当前卡片，移动到下一张
      if (this.currentCard?.id === cardId) {
        if (this.currentCardIndex >= this.dueCards.length) {
          this.currentCardIndex = Math.max(0, this.dueCards.length - 1);
        }
        this.currentCard = null;
      }
      
      // 重新渲染
      await this.loadDueCards();
      this.render();
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      new Notice('❌ 删除闪卡失败');
    }
  }

  private addStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .review-container {
        padding: 20px;
        max-width: 800px;
        margin: 0 auto;
      }

      /* 空状态 */
      .empty-state {
        text-align: center;
        padding: 60px 20px;
      }

      .empty-state h2 {
        font-size: 2em;
        margin-bottom: 10px;
      }

      .stats-summary {
        margin: 30px 0;
        padding: 20px;
        background: var(--background-secondary);
        border-radius: 8px;
        text-align: left;
        max-width: 300px;
        margin-left: auto;
        margin-right: auto;
      }

      /* 进度条 */
      .progress-bar {
        margin-bottom: 30px;
      }

      .progress-stats {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
      }

      .progress-text {
        font-weight: 600;
        font-size: 1.1em;
      }

      .remaining-text {
        color: var(--text-muted);
      }

      .bar-container {
        height: 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        overflow: hidden;
      }

      .bar {
        height: 100%;
        background: var(--interactive-accent);
        transition: width 0.3s ease;
      }

      /* 卡片区域 */
      .card-area {
        background: var(--background-primary);
        border: 2px solid var(--background-modifier-border);
        border-radius: 12px;
        padding: 30px;
        min-height: 400px;
      }

      .card-info {
        display: flex;
        gap: 15px;
        margin-bottom: 25px;
        padding-bottom: 15px;
        border-bottom: 1px solid var(--background-modifier-border);
      }

      .card-type, .card-deck {
        padding: 4px 12px;
        background: var(--background-secondary);
        border-radius: 12px;
        font-size: 0.9em;
      }

      /* 问题区域 */
      .question-area, .answer-area {
        margin: 25px 0;
      }

      .question-area h3, .answer-area h3 {
        margin-bottom: 15px;
        color: var(--text-muted);
      }

      .question-text, .answer-text {
        font-size: 1.3em;
        line-height: 1.6;
        padding: 20px;
        background: var(--background-secondary);
        border-radius: 8px;
      }

      /* 完形填空输入 */
      .cloze-input-area {
        margin: 25px 0;
      }

      .cloze-input-area h4 {
        margin-bottom: 15px;
        color: var(--text-muted);
      }

      .input-group {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }

      .cloze-input {
        flex: 1;
        padding: 10px 15px;
        border: 2px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        font-size: 1em;
      }

      .cloze-input:focus {
        border-color: var(--interactive-accent);
        outline: none;
      }

      /* QA 卡片输入 */
      .qa-input-area {
        margin: 25px 0;
      }

      .qa-input-area h4 {
        margin-bottom: 15px;
        color: var(--text-muted);
      }

      .qa-input {
        width: 100%;
        min-height: 120px;
        padding: 12px 15px;
        border: 2px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        font-size: 1em;
        font-family: inherit;
        resize: vertical;
        line-height: 1.6;
      }

      .qa-input:focus {
        border-color: var(--interactive-accent);
        outline: none;
      }

      /* 答案对比 */
      .question-review {
        margin-bottom: 20px;
        padding: 15px;
        background: var(--background-secondary-alt);
        border-radius: 8px;
      }

      .question-review h4 {
        margin: 0 0 10px 0;
        color: var(--text-muted);
        font-size: 0.9em;
      }

      .review-text {
        color: var(--text-muted);
      }

      .full-text {
        font-size: 1.2em;
        line-height: 1.6;
        padding: 20px;
        background: var(--background-secondary);
        border-radius: 8px;
        margin-bottom: 20px;
      }

      .answer-comparison {
        padding: 15px;
        background: var(--background-secondary-alt);
        border-radius: 8px;
      }

      .answer-comparison h4 {
        margin: 0 0 15px 0;
        color: var(--text-muted);
        font-size: 0.9em;
      }

      .comparison-item {
        padding: 10px;
        margin-bottom: 8px;
        background: var(--background-primary);
        border-radius: 6px;
      }

      .user-answer {
        font-weight: 500;
        padding: 2px 6px;
        border-radius: 3px;
      }

      .user-answer.correct {
        background: var(--background-modifier-success, #4caf50) !important;
        color: var(--text-on-accent, white) !important;
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
      }

      /* QA 卡片对比样式 */
      .qa-comparison {
        margin-top: 20px;
      }

      .qa-user-answer {
        padding: 15px;
        border-radius: 6px;
        margin-bottom: 15px;
        white-space: pre-wrap;
        word-break: break-word;
      }

      /* 确保QA卡片的用户答案也能正确显示颜色 - 使用最高优先级 */
      .qa-user-answer.correct,
      .user-answer.correct.qa-user-answer,
      div.qa-user-answer.correct,
      div.user-answer.correct.qa-user-answer,
      .comparison-item .qa-user-answer.correct,
      .comparison-item .user-answer.correct.qa-user-answer {
        background: var(--background-modifier-success, #4caf50) !important;
        background-color: #4caf50 !important;
        color: var(--text-on-accent, white) !important;
        color: white !important;
      }

      .qa-user-answer.partial,
      .user-answer.partial.qa-user-answer,
      div.qa-user-answer.partial,
      div.user-answer.partial.qa-user-answer,
      .comparison-item .qa-user-answer.partial,
      .comparison-item .user-answer.partial.qa-user-answer {
        background: #FFC000 !important;
        background-color: #FFC000 !important;
        color: white !important;
      }

      .qa-user-answer.wrong,
      .user-answer.wrong.qa-user-answer,
      div.qa-user-answer.wrong,
      div.user-answer.wrong.qa-user-answer,
      .comparison-item .qa-user-answer.wrong,
      .comparison-item .user-answer.wrong.qa-user-answer {
        background: var(--background-modifier-error, #f44336) !important;
        background-color: #f44336 !important;
        color: white !important;
      }

      .qa-correct-answer {
        padding: 15px;
        border-radius: 6px;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .correct-answer-label {
        margin-top: 20px !important;
        margin-bottom: 10px !important;
      }

      .qa-similarity {
        margin-top: 10px;
        padding: 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        text-align: center;
      }

      /* 按钮区域 */
      .button-area {
        display: flex;
        gap: 15px;
        justify-content: center;
        margin-top: 30px;
      }

      .show-answer-btn {
        padding: 12px 40px;
        font-size: 1.1em;
      }

      .jump-btn, .jump-btn-small {
        padding: 10px 20px;
      }

      .action-buttons {
        display: flex;
        gap: 10px;
        margin-top: 15px;
        justify-content: center;
      }

      .delete-btn-small {
        padding: 8px 16px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        cursor: pointer;
        transition: all 0.2s;
        color: var(--text-normal);
      }

      .delete-btn-small:hover {
        background: var(--color-red);
        border-color: var(--color-red);
        color: white;
      }

      /* 评级区域 */
      .rating-area {
        margin-top: 30px;
        text-align: center;
      }

      .rating-area h4 {
        margin-bottom: 20px;
        color: var(--text-muted);
      }

      .rating-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-bottom: 20px;
      }

      .rating-btn {
        flex: 1;
        max-width: 150px;
        padding: 20px;
        border: 2px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-primary);
        cursor: pointer;
        transition: all 0.2s;
      }

      .rating-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
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
        font-size: 1.1em;
        margin-bottom: 5px;
      }

      .rating-interval {
        font-size: 0.9em;
        color: var(--text-muted);
      }
    `;

    document.head.appendChild(styleEl);
  }
}