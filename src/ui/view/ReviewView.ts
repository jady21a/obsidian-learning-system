// reviewView.ts - 重构版本
import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import type LearningSystemPlugin from '../../main';
import { Flashcard } from '../../core/FlashcardManager';
import { CardScheduler, ReviewEase } from '../../core/CardScheduler';
import { FlashcardEditModal } from '../components/modals/FlashcardEditModal';
import { ReviewStateManager,ReviewState } from '../state/reviewStateManager';
// import { ReviewKeyboardHandler } from './ReviewKeyboardHandler';
import { TableRenderer } from '../components/TableRenderer';
import { CardRendererFactory } from '../components/reviewCardRender';

import { reviewStyle } from '../style/reviewStyle';
export const VIEW_TYPE_REVIEW = 'learning-system-review';


// ============================================================================
// 主视图类
// ============================================================================
export class ReviewView extends ItemView {
  plugin: LearningSystemPlugin;
  private scheduler: CardScheduler;
  private dueCards: Flashcard[] = [];
  private currentCardIndex: number = 0;
  private currentCard: Flashcard | null = null;
  private stateManager: ReviewStateManager = new ReviewStateManager();

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
    reviewStyle.inject();
    this.render();
    this.registerKeyboardHandlers();
  }

  async onClose() {
    document.removeEventListener('keydown', this.keyboardHandler);
  }

  // ============================================================================
  // 状态管理
  // ============================================================================


  private resetReviewState() {
    this.stateManager.reset();

  }

  private updateCurrentCard(direction: 'next' | 'prev' = 'next') {
    const newCard = this.dueCards[this.currentCardIndex];
    const isSameCard = this.currentCard?.id === newCard?.id;
    
    this.stateManager.updateForNewCard(newCard, isSameCard, direction);
    this.currentCard = newCard;
  }

  // ============================================================================
  // 数据加载
  // ============================================================================
  private async loadDueCards() {
    this.dueCards = this.plugin.flashcardManager.getDueCards();
    this.currentCardIndex = 0;
    this.resetReviewState();
    this.stateManager.reset();
    this.updateCurrentCard('next');
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

    // this.updateCurrentCard();
    this.renderProgress(container);
    
    const cardArea = container.createDiv({ cls: 'card-area' });
    this.renderTopActions(cardArea);
    
    if (this.stateManager.getState().showAnswer) {
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
    renderer.renderQuestion(
      questionArea, 
      this.currentCard, 
      this.stateManager.getState(),
      {
        setUserAnswer: (answer: string) => {
          this.stateManager.setUserAnswer(answer);
        },
        setUserAnswers: (answers: string[]) => {
          this.stateManager.setUserAnswers(answers);
        }
      }
    );
    // 显示答案按钮 + 翻页按钮在同一行
    const actionRow = container.createDiv({ cls: 'action-row' });
    this.renderNavigationButton(actionRow, 'prev');
    this.renderShowAnswerButton(actionRow);  // 复用原方法
    this.renderNavigationButton(actionRow, 'next');
  }

  private renderAnswerView(container: HTMLElement) {
    if (!this.currentCard) return;
  
    // 卡片信息
    this.renderCardInfo(container);
  
    // 只有在非表格问题时才显示问题回顾
    const isQuestionTable = TableRenderer.isTableFormat(this.currentCard.front);
    const isAnswerTable = this.currentCard.type === 'cloze' 
      ? TableRenderer.isTableFormat(this.currentCard.cloze?.original || '')
      : TableRenderer.isTableFormat(
          Array.isArray(this.currentCard.back) 
            ? (this.currentCard.back[0] || '') 
            : this.currentCard.back as string
        );
    
    if (!isQuestionTable && !isAnswerTable) {
      this.renderQuestionReview(container);
    }
  
    // 使用策略模式渲染答案
    const renderer = CardRendererFactory.getRenderer(this.currentCard.type);
    renderer.renderAnswer(container, this.currentCard, this.stateManager.getState(), this.scheduler);
  
      // 评级按钮 + 翻页按钮在同一行
      const actionRow = container.createDiv({ cls: 'action-row' });
      this.renderNavigationButton(actionRow, 'prev');
      this.renderRatingButtons(actionRow);  // 复用原方法,传入容器
      this.renderNavigationButton(actionRow, 'next');
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
    const showAnswerBtn = container.createEl('button', {
      text: 'Show Answer',
      cls: 'mod-cta show-answer-btn',
      attr: { title: 'Press Enter or Tab' }
    });
    showAnswerBtn.addEventListener('click', () => {
      this.stateManager.setShowAnswer(true);
      this.render();
    });
  }

  private renderRatingButtons(container: HTMLElement) {
    const buttonGroup = container.createDiv({ cls: 'rating-buttons' });

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


  private renderNavigationButton(container: HTMLElement, type: 'prev' | 'next') {
    const btn = container.createEl('button', {
      cls: `nav-btn ${type}-btn`,
      text: type === 'prev' ? '←' : '→'
    });
  
    btn.addEventListener('click', () => {
      this.go(type);
    });
  }
  
  
  private go(direction: 'prev' | 'next') {
    const state = this.stateManager.getState();
  
    if (direction === 'next') {
      if (!state.showAnswer) {
        // 正面 → 背面

        const hasCurrentInput = this.currentCard?.type === 'cloze'
          ? state.userAnswers.some(ans => ans && ans.trim() !== '')
          : state.userAnswer.trim() !== '';
        
        
        if (!hasCurrentInput) {
          this.stateManager.reset();
        }
        
        this.stateManager.setShowAnswer(true);
      
      } else {
        // 背面 → 下一张卡正面
        if (this.currentCardIndex < this.dueCards.length - 1) {
          // ✅ 在清除缓存前,先保存当前答案
          if (this.currentCard) {
            this.stateManager.saveAnswerToCache(this.currentCard.id);
          }
          
          this.currentCardIndex++;
          // ✅ 先更新卡片引用
          this.currentCard = this.dueCards[this.currentCardIndex];
          // ✅ 然后清空状态(不是清除缓存!)
          this.resetReviewState();
          this.updateCurrentCard('next');
          
          // ❌ 移除这行,不要清除缓存
          // this.stateManager.clearCache(this.currentCard.id);
        } else {
          new Notice('Already at last card');
        }
      }
    }
  
    if (direction === 'prev') {
      if (state.showAnswer) {
        // 背面 → 正面
        this.stateManager.setShowAnswer(false);
        this.stateManager.reset();
        this.stateManager.setShowAnswer(false);
      } else {
        // 正面 → 上一张卡背面
        if (this.currentCardIndex > 0) {
          if (this.currentCard) {
            this.stateManager.saveAnswerToCache(this.currentCard.id);
          }
          this.currentCardIndex--;
          this.stateManager.reset();
          this.updateCurrentCard('prev');
          this.stateManager.setShowAnswer(true);
        } else {
          new Notice('Already at first card');
        }
      }
    }
    
    this.render();
  }

  // ============================================================================
  // 交互处理
  // ============================================================================
  private async submitReview(ease: ReviewEase) {
    if (!this.currentCard) return;
  
    const timeSpent = (Date.now() - this.stateManager.getState().startTime) / 1000;
  
    const userAnswer = this.currentCard.type === 'cloze' 
      ? this.stateManager.getState().userAnswers 
      : this.currentCard.type === 'qa'
      ? this.stateManager.getState().userAnswer
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
  
    // ✅ 提交后清除该卡片的答案缓存
    this.stateManager.clearCache(this.currentCard.id);
  
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
        // Shift+Tab: 后退
        this.go('prev');
      } else {
        // Tab: 前进
        this.go('next');
      }
      return;
    }

    // 数字键评分
    if (this.stateManager.getState().showAnswer && !isInInput) {
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