// reviewView.ts - 重构版本
import { ItemView, WorkspaceLeaf, TFile, Notice,MarkdownView } from 'obsidian';
import type LearningSystemPlugin from '../../main';
import { Flashcard } from '../../core/FlashcardManager';
import { CardScheduler, ReviewEase } from '../../core/CardScheduler';
import { FlashcardEditModal } from '../components/modals/FlashcardEditModal';
import { ReviewStateManager,ReviewState } from '../stats/reviewStateManager';
// import { ReviewKeyboardHandler } from './ReviewKeyboardHandler';
import { TableRenderer } from '../components/TableRenderer';
import { CardRendererFactory } from '../components/reviewCardRender';
import { setCssProps } from '../utils/setCssProps';
import {
  renderMindmapGroupQuestion,
  renderMindmapGroupAnswer,
  type MindmapCardMeta,
  type GroupQuestionTarget,
  type GroupAnswerTarget,
} from './MindmapReview';


import { t,Language } from '../../i18n/translations';

export const VIEW_TYPE_REVIEW = 'learning-system-review';


// ============================================================================
// 主视图类
// ============================================================================
export class ReviewView extends ItemView {
  plugin: LearningSystemPlugin;
  private language: Language;
  private scheduler: CardScheduler;
  private dueCards: Flashcard[] = [];
  private currentCardIndex: number = 0;
  private currentCard: Flashcard | null = null;
  private stateManager: ReviewStateManager = new ReviewStateManager();
  private reviewedCardIds: Set<string> = new Set(); // 跟踪已复习的卡片
  // mindmap 分组复习状态
  private mmInputs: Record<string, HTMLInputElement[]> | null = null;
  private mmCaptured: Record<string, string[]> | null = null;
  private mmAnswerTargets: GroupAnswerTarget[] | null = null;
  private mmGraded = false;

  constructor(leaf: WorkspaceLeaf, plugin: LearningSystemPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.language = this.plugin.settings.language || 'en';
    this.scheduler = new CardScheduler();
  }

  getViewType(): string {
    return VIEW_TYPE_REVIEW;
  }

  getDisplayText(): string {
    return 'Flashcard review';
  }

  getIcon(): string {
    return 'layers';
  }

  async onOpen() {
    await this.loadDueCards();
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
    this.reviewedCardIds.clear(); 
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
    emptyState.createEl('h2', { text: '🎉 All done!' });
    emptyState.createEl('p', { text: 'No cards due for review right now.' });

    const stats = this.plugin.flashcardManager.getStats();
    const statsDiv = emptyState.createDiv({ cls: 'stats-summary' });
    statsDiv.createEl('p', { text: `Total cards: ${stats.total}` });
    statsDiv.createEl('p', { text: `New cards: ${stats.new}` });
    statsDiv.createEl('p', { text: `Reviewed today: ${stats.reviewedToday}` });

    const closeBtn = emptyState.createEl('button', {
      text: 'Close review',
      cls: 'mod-cta'
    });
    
    closeBtn.onclick = async () => {
      await this.cleanupReviewedCards();
      this.leaf?.detach();
    };
  }

  private renderProgress(container: Element) {
    const progressBar = container.createDiv({ cls: 'progress-bar' });
    
    const stats = progressBar.createDiv({ cls: 'progress-stats' });
    const reviewed = this.reviewedCardIds.size;
    const total = this.dueCards.length;
    
    stats.createSpan({ 
      text: `${reviewed} / ${total} reviewed`,
      cls: 'progress-text'
    });
  
    const barContainer = progressBar.createDiv({ cls: 'bar-container' });
    const bar = barContainer.createDiv({ cls: 'bar' });
    const progress = (reviewed / total) * 100;
    setCssProps(bar, { width: `${progress}%` });
  }

  private renderTopActions(container: HTMLElement) {
    const actionsBar = container.createDiv({ cls: 'top-actions-bar' });

    // Jump to Source 按钮
    const jumpBtn = actionsBar.createEl('button', {
      cls: 'top-action-btn jump-icon-btn',
      attr: { 'aria-label': 'Jump to source' }
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
    setCssProps(dropdown, { display: 'none' });

    // 菜单项配置
    const menuItems = [
      {
        label: '✏️ Edit card',
        onClick: () => this.editCurrentFlashcard()
      },
      {
        label: '🔄 Reset card stats',
        onClick: async () => {
          if (this.currentCard && confirm(t('confirm.resetCardStats', this.language))) {
            await this.resetCardStats(this.currentCard.id);
          }
        }
      },
      {
        label: '📚 Reset deck stats',
        onClick: async () => {
          if (this.currentCard) {
            const deckName = this.currentCard.deck;
            if (confirm(t('confirm.resetDeckStats', this.language, { deck: deckName }))) {
              await this.plugin.analyticsEngine.clearDeckStats(deckName);
             new Notice(t('notice.deckStatsReset', this.language, { deck: deckName }));
            await this.loadDueCards();
              this.render();
            }
          }
        }
      },
      {
        label: '🗑️ Delete card',
        onClick: async () => {
          if (this.currentCard && confirm(t('confirm.deleteFlashcard', this.language))) {
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
        void item.onClick();
        setCssProps(dropdown, { display: 'none' });
      });
    });

    // 切换下拉菜单
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = dropdown.style.getPropertyValue('display') === 'none';
      setCssProps(dropdown, { display: isHidden ? 'block' : 'none' });
    });

    document.addEventListener('click', () => {
      setCssProps(dropdown, { display: 'none' });
    });

    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /** 若该卡来自 mindmap 挖空,返回复习用的定位信息;否则 null。 */
  private getMindmapMeta(card: Flashcard): MindmapCardMeta | null {
    if (card.type !== 'cloze') return null;
    const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
    if (!unit || unit.extractRule?.ruleId !== 'mindmap-cloze') return null;
    const mm = unit.metadata?.customData?.mindmap as MindmapCardMeta | undefined;
    return mm ?? null;
  }

  /** 返回当前卡所属 mindmap 分组(同源文件、到期、未复习的挖空卡)。 */
  private getMindmapGroup(card: Flashcard): { sourceFile: string; cards: Flashcard[] } | null {
    const mm = this.getMindmapMeta(card);
    if (!mm || !mm.sourceFile) return null;
    const src = mm.sourceFile;
    const cards = this.dueCards.filter((c) => {
      if (this.reviewedCardIds.has(c.id)) return false;
      return this.getMindmapMeta(c)?.sourceFile === src;
    });
    return cards.length ? { sourceFile: src, cards } : null;
  }

  /** 该卡 → 问题面挖空目标(挖空区间相对节点文本)。 */
  private toQuestionTarget(card: Flashcard): GroupQuestionTarget {
    const mm = this.getMindmapMeta(card)!;
    const nodeText = mm.path[mm.path.length - 1] ?? '';
    const deletions =
      mm.mode === 'whole' ? [{ index: 0, answer: nodeText }] : [...mm.deletions].sort((a, b) => a.index - b.index);
    return { cardId: card.id, path: mm.path, nodeText, deletions };
  }

  /** 在地图下方按「序号 + 路径 + 输入框」建立答题列表,返回 cardId → 输入框数组。 */
  private buildMindmapInputs(
    listDiv: HTMLElement,
    targets: GroupQuestionTarget[]
  ): Record<string, HTMLInputElement[]> {
    listDiv.empty();
    const map: Record<string, HTMLInputElement[]> = {};
    let n = 0;
    for (const t of targets) {
      const hint = t.path.slice(0, -1).join(' / ') || '(顶层)';
      const arr: HTMLInputElement[] = [];
      for (const d of [...t.deletions].sort((a, b) => a.index - b.index)) {
        n++;
        const row = listDiv.createDiv({ cls: 'mm-blank-row' });
        row.createSpan({ cls: 'mm-blank-no', text: `${n}.` });
        row.createSpan({ cls: 'mm-blank-hint', text: hint });
        const input = row.createEl('input', {
          cls: 'mm-cloze-input',
          attr: { type: 'text', placeholder: `${d.answer.length} 字` },
        });
        arr.push(input);
      }
      map[t.cardId] = arr;
    }
    return map;
  }

  /** 翻面前把各输入框的值按 cardId 收集起来。 */
  private captureMindmapInputs() {
    const cap: Record<string, string[]> = {};
    if (this.mmInputs) {
      for (const [cid, els] of Object.entries(this.mmInputs)) {
        cap[cid] = els.map((e) => e.value);
      }
    }
    this.mmCaptured = cap;
  }

  /** 评估整组(逐空自动评级写回调度),再以答案面重渲染导图 + 下方对比列表。 */
  private async gradeAndRenderMindmapGroup(
    group: { sourceFile: string; cards: Flashcard[] },
    mapDiv: HTMLElement,
    listDiv: HTMLElement
  ) {
    if (!this.mmGraded) {
      this.mmAnswerTargets = await this.gradeMindmapGroup(group);
      this.mmGraded = true;
    }
    const targets = this.mmAnswerTargets ?? [];
    const ok = await renderMindmapGroupAnswer(this.app, mapDiv, group.sourceFile, targets);
    if (!ok) {
      mapDiv.empty();
      mapDiv.createEl('p', { text: '源文件已变化,无法重建导图。', cls: 'setting-item-description' });
    }
    this.renderMindmapComparison(listDiv, targets);
  }

  /** 翻面后在地图下方显示「序号 + 路径 + 正确答案(错误附你的答案)」对比列表。 */
  private renderMindmapComparison(listDiv: HTMLElement, targets: GroupAnswerTarget[]) {
    listDiv.empty();
    let n = 0;
    for (const t of targets) {
      const hint = t.path.slice(0, -1).join(' / ') || '(顶层)';
      const sorted = [...t.deletions]
        .map((d, i) => ({ ...d, i }))
        .sort((a, b) => a.index - b.index);
      for (const d of sorted) {
        n++;
        const blank = t.blanks[d.i] ?? { user: '', correct: false };
        const row = listDiv.createDiv({ cls: 'mm-blank-row' });
        row.createSpan({ cls: 'mm-blank-no', text: `${n}.` });
        row.createSpan({ cls: 'mm-blank-hint', text: hint });
        row.createSpan({ cls: blank.correct ? 'mm-cloze-correct' : 'mm-cloze-wrong', text: d.answer });
        if (!blank.correct) {
          row.createSpan({
            cls: 'mm-cloze-user',
            text: blank.user ? `你的: ${blank.user}` : '(未填)',
          });
        }
        row.createSpan({ cls: 'mm-cmp-mark', text: blank.correct ? ' ✓' : ' ✗' });
      }
    }
  }

  /** 逐空用 evaluateAnswer 自动评级并写回各卡调度,返回答案面渲染目标。 */
  private async gradeMindmapGroup(group: {
    sourceFile: string;
    cards: Flashcard[];
  }): Promise<GroupAnswerTarget[]> {
    const targets: GroupAnswerTarget[] = [];
    const timeSpent = (Date.now() - this.stateManager.getState().startTime) / 1000;

    for (const card of group.cards) {
      const mm = this.getMindmapMeta(card)!;
      const nodeText = mm.path[mm.path.length - 1] ?? '';
      const deletions =
        mm.mode === 'whole'
          ? [{ index: 0, answer: nodeText }]
          : [...mm.deletions].sort((a, b) => a.index - b.index);
      const userArr = this.mmCaptured?.[card.id] ?? [];

      // 逐空判定对错(用于着色)
      const blanks = deletions.map((d, k) => {
        const user = (userArr[k] ?? '').trim();
        const ev = this.scheduler.evaluateAnswer(d.answer, user);
        return { user, correct: ev.correctness !== 'wrong' };
      });

      // 整卡评估 → 评级 → 写回调度
      const correctArr = deletions.map((d) => d.answer);
      const overall =
        correctArr.length === 1
          ? this.scheduler.evaluateAnswer(correctArr[0], userArr[0] ?? '')
          : this.scheduler.evaluateAnswer(correctArr, this.padArray(userArr, correctArr.length));
      const ease = this.scheduler.suggestEase(overall.similarity);

      const { updatedCard, reviewLog } = this.scheduler.schedule(card, ease, timeSpent, userArr);
      await this.plugin.flashcardManager.updateCard(updatedCard);
      await this.plugin.flashcardManager.logReview({
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        cycle: this.plugin.analyticsEngine.getCurrentCycleNumber(),
        ...reviewLog,
      });
      await this.plugin.unlockSystem.onCardReviewed();
      this.reviewedCardIds.add(card.id);

      targets.push({ path: mm.path, nodeText, deletions, blanks });
    }
    return targets;
  }

  private padArray(arr: string[], len: number): string[] {
    return Array.from({ length: len }, (_, i) => arr[i] ?? '');
  }

  /** 整组复习完成后推进到下一张未复习的卡。 */
  private async advancePastMindmapGroup() {
    this.resetReviewState();
    this.mmInputs = null;
    this.mmCaptured = null;
    this.mmAnswerTargets = null;
    this.mmGraded = false;

    const next = this.findNextUnreviewedCard(0);
    if (next === -1) {
      new Notice('✅ Review session complete!');
      this.currentCard = null;
      this.dueCards = [];
      this.render();
    } else {
      this.currentCardIndex = next;
      this.updateCurrentCard('next');
      this.render();
    }
  }

  private renderQuestionView(container: HTMLElement) {
    if (!this.currentCard) return;

    // 卡片信息
    this.renderCardInfo(container);

    // 问题区域
    const questionArea = container.createDiv({ cls: 'question-area' });
    questionArea.createEl('h3', { text: 'Question' });

    const group = this.getMindmapGroup(this.currentCard);
    if (group) {
      // mindmap 分组:同源文件的所有到期挖空汇总到一张卡;
      // 地图里挖空显示为带编号的横线,下方是对应编号的输入框列表
      const targets = group.cards.map((c) => this.toQuestionTarget(c));
      const mapDiv = questionArea.createDiv({ cls: 'mindmap-review-card' });
      const listDiv = questionArea.createDiv({ cls: 'mm-blank-list' });
      this.mmCaptured = null;
      this.mmAnswerTargets = null;
      this.mmGraded = false;
      void renderMindmapGroupQuestion(this.app, mapDiv, group.sourceFile, targets).then((ok) => {
        if (!ok) {
          mapDiv.remove();
          questionArea.createEl('p', { text: '源文件已变化,无法重建导图。', cls: 'setting-item-description' });
        }
      });
      this.mmInputs = this.buildMindmapInputs(listDiv, targets);

      // 点击地图即翻面(先收集输入)
      mapDiv.addEventListener('click', () => {
        if (!this.stateManager.getState().showAnswer) {
          this.captureMindmapInputs();
          this.stateManager.setShowAnswer(true);
          this.render();
        }
      });

      // Show answer 按钮(Tab/箭头由 go() 统一处理:也会先收集输入再翻面)
      const actionRow = container.createDiv({ cls: 'action-row' });
      const showBtn = actionRow.createEl('button', { text: 'Show answer', cls: 'mod-cta show-answer-btn' });
      showBtn.addEventListener('click', () => {
        this.captureMindmapInputs();
        this.stateManager.setShowAnswer(true);
        this.render();
      });
      return;
    }

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

    const group = this.getMindmapGroup(this.currentCard);
    if (group) {
      const answerArea = container.createDiv({ cls: 'answer-area' });
      answerArea.createEl('h3', { text: 'Answer' });
      const mapDiv = answerArea.createDiv({ cls: 'mindmap-review-card' });
      const listDiv = answerArea.createDiv({ cls: 'mm-blank-list mm-cmp-list' });
      const actionRow = container.createDiv({ cls: 'action-row' });
      const nextBtn = actionRow.createEl('button', { text: 'Next', cls: 'mod-cta' });
      nextBtn.addEventListener('click', () => void this.advancePastMindmapGroup());
      void this.gradeAndRenderMindmapGroup(group, mapDiv, listDiv);
      return;
    }

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
      reviewTextDiv.innerHTML = (this.currentCard.cloze?.original || this.currentCard.front).replace(
        /==([^=]+)==/g,
        '<span class="cloze-underline">$1</span>'
      );
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

    // mindmap 分组卡:正面→捕获输入并翻面;背面→推进过整组
    const mmCard = !!this.currentCard && !!this.getMindmapMeta(this.currentCard)?.sourceFile;
    if (mmCard && direction === 'next') {
      if (!state.showAnswer) {
        this.captureMindmapInputs();
        this.stateManager.setShowAnswer(true);
        this.render();
      } else {
        void this.advancePastMindmapGroup();
      }
      return;
    }

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
    
    // 👇 修改这里,确保包含周期信息
    await this.plugin.flashcardManager.logReview({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // 更唯一的ID
      cycle: this.plugin.analyticsEngine.getCurrentCycleNumber(), // 👈 添加周期号
      ...reviewLog
    });
    
    await this.plugin.unlockSystem.onCardReviewed();
  
    // ✅ 标记为已复习,但不从列表中删除
    this.reviewedCardIds.add(this.currentCard.id);
    
    // ✅ 清除该卡片的答案缓存
    this.stateManager.clearCache(this.currentCard.id);
    
    // ✅ 重置状态
    this.resetReviewState();
  
    // ✅ 移动到下一张未复习的卡片
    const nextUnreviewedIndex = this.findNextUnreviewedCard(this.currentCardIndex + 1);
    
    if (nextUnreviewedIndex === -1) {
      // ⭐ 所有卡片都已复习 - 不设置 currentCard 为 null
      new Notice(`✅ Review session complete!`);
      // ⭐ 设置一个标志让 render 知道复习已完成
      this.currentCard = null;
      this.dueCards = []; // ⭐ 清空列表,触发 renderNoDueCards
      this.render();
    } else {
      this.currentCardIndex = nextUnreviewedIndex;
      this.updateCurrentCard('next');
      this.render();
    }
  }
  private findNextUnreviewedCard(startIndex: number): number {
    for (let i = startIndex; i < this.dueCards.length; i++) {
      if (!this.reviewedCardIds.has(this.dueCards[i].id)) {
        return i;
      }
    }
    return -1; // 没有找到未复习的卡片
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
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        const editor = view.editor;
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
      new Notice(t('notice.flashcardDeleted', this.language));
   
      
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
   
   new Notice(t('notice.deleteFlashcardFailed', this.language));
    }
  }

  private editCurrentFlashcard() {
    if (!this.currentCard) return;

    const modal = new FlashcardEditModal(
      this.app,
      this.plugin,  
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
          new Notice(t('notice.flashcardUpdated', this.language));
          
          this.currentCard = updatedCard;
          this.render();
        } catch (error) {
          console.error('Error updating flashcard:', error);
          new Notice(t('notice.updateFlashcardFailed', this.language));
        }
      },
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
      
      await this.plugin.flashcardManager.clearCardReviewLogs(cardId);

      await this.plugin.dataManager.save();
      
      new Notice(t('notice.cardStatsReset', this.language));
 
      this.currentCard = card;
      this.render();
    } catch (error) {
      console.error('Error resetting card stats:', error);
     new Notice(t('notice.resetStatsFailed', this.language));
    }
  }

  // ============================================================================
  // 键盘处理
  // ============================================================================
  private keyboardHandler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    // mindmap 分组卡走自动评级,不响应数字键评分
    const inMindmapGroup = !!this.currentCard && !!this.getMindmapMeta(this.currentCard)?.sourceFile;

    // Tab 键处理(与其它卡统一:正面→翻面,背面→下一张/下一组)
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

    // 数字键评分(分组卡走自动评级,不响应数字键)
    if (this.stateManager.getState().showAnswer && !isInInput && !inMindmapGroup) {
      const ratingMap: { [key: string]: ReviewEase } = {
        '1': 'again',
        '2': 'hard',
        '3': 'good',
        '4': 'easy'
      };
      
      if (ratingMap[e.key]) {
        e.preventDefault();
        void this.submitReview(ratingMap[e.key]);
      }
    }
  };

  private registerKeyboardHandlers() {
    document.addEventListener('keydown', this.keyboardHandler);
  }
  private async cleanupReviewedCards() {
    this.reviewedCardIds.clear();
  }
  // ============================================================================
  // 样式
  // ============================================================================


}