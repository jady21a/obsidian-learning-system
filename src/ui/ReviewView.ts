// reviewView.ts
import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import type LearningSystemPlugin from '../main';
import { Flashcard } from '../core/FlashcardManager';
import { CardScheduler, ReviewEase } from '../core/CardScheduler';
import { FlashcardEditModal } from './SidebarOverviewView';

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
    this.registerKeyboardHandlers();
  }

  async onClose() {}

  private async loadDueCards() {
    this.dueCards = this.plugin.flashcardManager.getDueCards();
    this.currentCardIndex = 0;
    this.showAnswer = false;
    document.removeEventListener('keydown', this.keyboardHandler);
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

    // 添加右上角操作按钮
    this.renderTopActions(cardArea);

    if (this.showAnswer) {
      this.renderAnswer(cardArea);
    } else {
      this.renderQuestion(cardArea);
    }
  }

  private renderTopActions(container: HTMLElement) {
    const actionsBar = container.createDiv({ cls: 'top-actions-bar' });
  
    // Jump to source 按钮
    const jumpBtn = actionsBar.createEl('button', {
      cls: 'top-action-btn jump-icon-btn',
      attr: { 'aria-label': 'Jump to Source' }
    });
    jumpBtn.innerHTML = '↗';
    jumpBtn.addEventListener('click', () => this.jumpToSource());
  
    // More 菜单
    const moreBtn = actionsBar.createEl('button', {
      cls: 'top-action-btn more-btn',
      attr: { 'aria-label': 'More actions' }
    });
    moreBtn.innerHTML = '⋯';
    
    const dropdown = actionsBar.createDiv({ cls: 'more-dropdown' });
    dropdown.style.display = 'none';
  
    // 编辑选项
    const editOption = dropdown.createEl('div', {
      cls: 'dropdown-item'
    });
    editOption.innerHTML = '✏️ Edit Card';
    editOption.addEventListener('click', () => {
      if (!this.currentCard) return;
      this.editCurrentFlashcard();
      dropdown.style.display = 'none';
    });
  

  
    // 分隔线
    // dropdown.createEl('div', { cls: 'dropdown-divider' });
  
    // **新增: 清除当前卡片统计**
    const resetCardOption = dropdown.createEl('div', {
      cls: 'dropdown-item'
    });
    resetCardOption.innerHTML = '🔄 Reset Card Stats';
    resetCardOption.addEventListener('click', async () => {
      if (!this.currentCard) return;
      if (confirm('确定要重置这张卡片的学习进度吗？卡片将回到"新卡片"状态。')) {
        await this.resetCardStats(this.currentCard.id);
      }
      dropdown.style.display = 'none';
    });
  
    // **新增: 清除当前卡组统计**
    const resetDeckOption = dropdown.createEl('div', {
      cls: 'dropdown-item'
    });
    resetDeckOption.innerHTML = '📚 Reset Deck Stats';
    resetDeckOption.addEventListener('click', async () => {
      if (!this.currentCard) return;
      const deckName = this.currentCard.deck;
      if (confirm(`确定要重置卡组"${deckName}"的所有学习进度吗？该卡组的所有卡片将回到"新卡片"状态。`)) {
        await this.plugin.analyticsEngine.clearDeckStats(deckName);
        new Notice(`✅ 卡组"${deckName}"的统计已重置`);
        await this.loadDueCards();
        this.render();
      }
      dropdown.style.display = 'none';
    });
        // 删除选项
        const deleteOption = dropdown.createEl('div', {
          cls: 'dropdown-item delete-item'
        });
        deleteOption.innerHTML = '🗑️ Delete Card';
        deleteOption.addEventListener('click', async () => {
          if (!this.currentCard) return;
          if (confirm('确定要删除这张闪卡吗？删除后将从复习队列中移除。')) {
            await this.deleteFlashcard(this.currentCard.id);
          }
          dropdown.style.display = 'none';
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
  
  // **新增: 重置单张卡片统计的方法**
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
      ease: 2.5,  // 改为 ease
      due: Date.now(),
      lapses: 0,
      reps: 0,
      state: 'new'
    };

    await this.plugin.flashcardManager.updateCard(card);
    
    // 清除该卡片的复习日志
    const logs = this.plugin.flashcardManager['reviewLogs'] || [];
    this.plugin.flashcardManager['reviewLogs'] = logs.filter(
      log => log.flashcardId !== cardId
    );
    await this.plugin.dataManager.save(); // 改用 dataManager
    
    new Notice('✅ 卡片统计已重置');
    this.currentCard = card;
    this.render();
  } catch (error) {
    console.error('Error resetting card stats:', error);
    new Notice('❌ 重置统计失败');
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
        if (index === 0) {
          setTimeout(() => input.focus(), 50);
        }
      
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
      setTimeout(() => textarea.focus(), 50);
    }

    // 按钮区域
    const buttonArea = container.createDiv({ cls: 'button-area' });

    // 显示答案按钮
    const showAnswerBtn = buttonArea.createEl('button', {
      text: 'Show Answer',
      cls: 'mod-cta show-answer-btn',
      attr: { title: 'Press Enter or Tab'} 
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
      
      // 创建两列容器（无论是否有用户答案都显示）
      const comparison = answerArea.createDiv({ cls: 'answer-comparison qa-comparison' });
      
      // 如果有用户答案，计算评估结果
      const evaluation = this.userAnswer.trim() 
        ? this.scheduler.evaluateAnswer(correctAnswer, this.userAnswer)
        : null;
    
      const columnsContainer = comparison.createDiv({ cls: 'qa-columns-container' });
      
      // 左列：Correct Answer（始终显示）
      const correctColumn = columnsContainer.createDiv({ cls: 'qa-column' });
      correctColumn.createEl('h4', { text: 'Correct Answer:', cls: 'column-label' });
      const correctAnswerDiv = correctColumn.createDiv({ cls: 'comparison-item' });
      correctAnswerDiv.createEl('div', {
        text: correctAnswer,
        cls: 'correct-answer qa-correct-answer'
      });
    
      // 右列：Your Answer（始终显示，但可能为空）
      const userColumn = columnsContainer.createDiv({ cls: 'qa-column' });
      userColumn.createEl('h4', { text: 'Your Answer:', cls: 'column-label' });
      const userAnswerDiv = userColumn.createDiv({ cls: 'comparison-item' });
      const userAnswerElement = userAnswerDiv.createEl('div', {
        text: this.userAnswer.trim() || '(no answer provided)',
        cls: 'qa-user-answer'
      });
      
      // 只有在有用户答案时才添加评估样式
      if (evaluation) {
        userAnswerElement.classList.add('user-answer', evaluation.correctness);
        
        // 相似度信息（只在 partial 时显示）
        if (evaluation.correctness === 'partial') {
          const similarityInfo = comparison.createEl('div', {
            cls: 'similarity-info qa-similarity'
          });
          similarityInfo.textContent = `Similarity: ${Math.round(evaluation.similarity * 100)}%`;
        }
      } else {
        // 没有答案时的样式
        userAnswerElement.classList.add('no-answer');
      }
    }

    // 评级按钮
    const ratingArea = container.createDiv({ cls: 'rating-area' });

    const buttonGroup = ratingArea.createDiv({ cls: 'rating-buttons' });

    const ratings: { ease: ReviewEase; label: string; color: string; key: string}[] = [
      { ease: 'again', label: 'Again\n < 1 min', color: 'red' , key: '1' },
      { ease: 'hard', label: 'Hard\n < 10 min', color: 'orange' , key: '2' },
      { ease: 'good', label: 'Good\n 1 day', color: 'blue' , key: '3' },
      { ease: 'easy', label: 'Easy\n 4 days', color: 'green', key: '4'  }
    ];

    ratings.forEach(({ ease, label, color,key }) => {
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
          
          // 刷新当前卡片显示
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

  // 快捷键
  private keyboardHandler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      // Tab 键处理
  if (e.key === 'Tab') {
    e.preventDefault();
    
    if (e.shiftKey) {
      // Shift + Tab: 回到题面
      if (this.showAnswer) {
        this.showAnswer = false;
        this.render();
      }
    } else {
      // Tab: 显示答案或下一张
      if (!this.showAnswer) {
        this.showAnswer = true;
        this.render();
      } else {
        // 已显示答案,直接按 "Good" 评分进入下一张
        this.submitReview('good');
      }
    }
    return;
  }

    
    // 数字键评分（只在显示答案且不在输入框时有效）
    if (this.showAnswer) {
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

  private addStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
    .review-container {
        padding: 16px;
        max-width: 800px;
        margin: 0 auto;
      }

      /* 空状态 */
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

      /* 进度条 */
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

      .remaining-text {
        color: var(--text-muted);
        font-size: 0.9em;
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

      /* 卡片区域 */
      .card-area {
        background: var(--background-primary);
        border: 2px solid var(--background-modifier-border);
        border-radius: 10px;
        padding: 20px;
        min-height: 350px;
        position: relative;
      }

      /* 右上角操作栏 */
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

      .jump-icon-btn {
        font-weight: bold;
      }

      .more-btn {
        font-weight: bold;
        letter-spacing: 1px;
      }

      /* 下拉菜单 */
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

      .dropdown-item:first-child {
        border-radius: 6px 6px 0 0;
      }

      .dropdown-item:last-child {
        border-radius: 0 0 6px 6px;
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

      /* 问题区域 */
      .question-area, .answer-area {
        margin: 16px 0;
      }

      .question-area h3, .answer-area h3 {
        margin-bottom: 10px;
        color: var(--text-muted);
        font-size: 1em;
      }

      .question-text, .answer-text {
        font-size: 1.2em;
        line-height: 1.5;
        padding: 14px;
        background: var(--background-secondary);
        border-radius: 6px;
      }

      /* 完形填空输入 */
      .cloze-input-area {
        margin: 16px 0;
      }

      .cloze-input-area h4 {
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

      .cloze-input:focus {
        border-color: var(--interactive-accent);
        outline: none;
      }

      /* QA 卡片输入 */
      .qa-input-area {
        margin: 16px 0;
      }

      .qa-input-area h4 {
        margin-bottom: 10px;
        color: var(--text-muted);
        font-size: 0.9em;
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

      .qa-input:focus {
        border-color: var(--interactive-accent);
        outline: none;
      }

      /* 答案对比 */
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
        font-size: 0.85em;
      }

      /* QA 卡片对比样式 */
      .qa-comparison {
        margin-top: 12px;
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

.qa-user-answer,
.qa-correct-answer {
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

/* 相似度信息放在两列下方 */
.qa-similarity {
  margin-top: 8px;
  padding: 6px;
  background: var(--background-secondary);
  border-radius: 4px;
  text-align: center;
  font-size: 0.85em;
  grid-column: 1 / -1;
}




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


      .correct-answer-label {
        margin-top: 12px !important;
        margin-bottom: 6px !important;
      }

      .qa-similarity {
        margin-top: 8px;
        padding: 6px;
        background: var(--background-secondary);
        border-radius: 4px;
        text-align: center;
        font-size: 0.85em;
      }

      /* 按钮区域 */
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

      /* 评级区域 */
      .rating-area {
        margin: 15px 0 10px 0;
        text-align: center;
      }

      .rating-area h4 {
        margin-bottom: 12px;
        color: var(--text-muted);
        font-size: 0.9em;
      }

      .rating-buttons {
        display: flex;
        gap: 20px;
        justify-content: center;
        margin-bottom: 0;
      }

      .rating-btn {
        flex: 1;
        max-width: 120px;
        hight:100px;
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
        /* 快捷键提示 */
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

/* Show Answer 按钮 tooltip */
.show-answer-btn {
  position: relative;
}
  .cloze-input:focus,
.qa-input:focus {
  border-color: var(--interactive-accent);
  outline: none;
  box-shadow: 0 0 0 2px var(--interactive-accent-hover);
}
  /* 无答案状态 */
.qa-user-answer.no-answer {
  background: var(--background-secondary);
  color: var(--text-muted);
  font-style: italic;
  border: 2px dashed var(--background-modifier-border);
  /* 下拉菜单分隔线 */

}
    `;

    document.head.appendChild(styleEl);
  }
}