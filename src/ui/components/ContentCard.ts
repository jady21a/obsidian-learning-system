// src/ui/components/ContentCard.ts
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';
import { ViewState } from '../state/ViewState';

export interface CardCallbacks {
  onJumpToSource: (unit: ContentUnit) => void;
  onToggleAnnotation: (card: HTMLElement, unit: ContentUnit) => void;
  onQuickFlashcard: (unit: ContentUnit) => void;
  onShowContextMenu: (event: MouseEvent, unit: ContentUnit) => void;
  onFlashcardContextMenu?: (event: MouseEvent, card: Flashcard) => void;
  getAnnotationContent?: (unitId: string) => string | undefined;
}

export class ContentCard {
  private state: ViewState;
  private callbacks: CardCallbacks;

  constructor(state: ViewState, callbacks: CardCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
  }

  /**
   * 渲染紧凑卡片（侧边栏模式）
   */
  renderCompact(container: HTMLElement, unit: ContentUnit): void {
    const card = container.createDiv({ cls: 'compact-card' });

    // 批量选择 checkbox
    if (this.state.batchMode) {
      this.renderCheckbox(card, unit.id, this.state.selectedUnitIds.has(unit.id));
    }

    // 左侧指示器
    this.renderIndicator(card, unit);

    // 内容区域
    const content = card.createDiv({ cls: 'card-content' });
    this.renderCardHeader(content, card, unit);
    this.renderCardContent(content, unit);
    this.renderAnnotationPreview(content, card, unit);
    this.renderCardMeta(content, unit);
  }

  /**
   * 渲染网格卡片（主界面模式）
   */
  renderGrid(container: HTMLElement, unit: ContentUnit): void {
    const card = container.createDiv({ cls: 'grid-card' });

    if (this.state.batchMode) {
      this.renderCheckbox(card, unit.id, this.state.selectedUnitIds.has(unit.id));
    }

    const header = card.createDiv({ cls: 'grid-card-header' });
    header.addEventListener('click', () => {
      this.callbacks.onJumpToSource(unit);
    });

    this.renderTypeIndicator(header, unit);
    this.renderFileName(header, unit);
    this.renderGridTools(header, unit);

    const content = card.createDiv({ cls: 'grid-card-content' });
    this.renderGridContent(content, card, unit);
    this.renderGridAnnotation(content, card, unit);
    this.renderGridTags(content, unit);

    const meta = card.createDiv({ cls: 'grid-card-meta' });
    this.renderGridMeta(meta, unit);
  }

  /**
   * 渲染闪卡网格
   */
  renderFlashcardGrid(container: HTMLElement, card: Flashcard): void {
    const cardEl = container.createDiv({ cls: 'grid-card flashcard-grid-card' });

    if (this.state.batchMode) {
      this.renderCheckbox(cardEl, card.id, this.state.selectedCardIds.has(card.id));
    }

    const header = cardEl.createDiv({ cls: 'grid-card-header' });
    header.addEventListener('click', () => {
      // 通过回调处理跳转逻辑
      if (this.callbacks.onFlashcardContextMenu) {
        // 这里需要特殊处理，因为闪卡跳转需要先找到对应的 ContentUnit
      }
    });

    const typeLabel = header.createDiv({
      cls: `flashcard-type ${card.type}`,
      text: card.type === 'qa' ? 'Q&A' : '填空'
    });

    const tools = header.createDiv({ cls: 'grid-card-tools' });
    const moreBtn = tools.createDiv({ cls: 'tool-btn-grid' });
    moreBtn.innerHTML = '⋮';
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.callbacks.onFlashcardContextMenu) {
        this.callbacks.onFlashcardContextMenu(e, card);
      }
    });

    const content = cardEl.createDiv({ cls: 'grid-card-content' });
    this.renderFlashcardContent(content, card);

    const meta = cardEl.createDiv({ cls: 'grid-card-meta' });
    this.renderFlashcardMeta(meta, card);
  }

  // ========== 私有渲染方法 ==========

  private renderCheckbox(card: HTMLElement, itemId: string, isChecked: boolean): void {
    const checkbox = card.createEl('input', {
      type: 'checkbox',
      cls: 'batch-checkbox'
    });
    checkbox.setAttribute('data-item-id', itemId);
    checkbox.checked = isChecked;
    
    checkbox.addEventListener('change', (e) => {
      if ((e.target as HTMLInputElement).checked) {
        if (this.state.viewType === 'cards') {
          this.state.selectedCardIds.add(itemId);
        } else {
          this.state.selectedUnitIds.add(itemId);
        }
      } else {
        if (this.state.viewType === 'cards') {
          this.state.selectedCardIds.delete(itemId);
        } else {
          this.state.selectedUnitIds.delete(itemId);
        }
      }
      // 触发重新渲染（通过回调）
    });
  }

  private renderIndicator(card: HTMLElement, unit: ContentUnit): void {
    const indicator = card.createDiv({ cls: 'card-indicator' });

    if (unit.type === 'QA') {
      indicator.addClass('type-qa');
    } else if (unit.type === 'cloze') {
      indicator.addClass('type-cloze');
    } else if (unit.type === 'text') {
      indicator.addClass('type-text');
    }

    if (unit.annotationId) indicator.addClass('has-annotation');
    if (unit.flashcardIds.length > 0) indicator.addClass('has-flashcard');
  }

  private renderCardHeader(content: HTMLElement, card: HTMLElement, unit: ContentUnit): void {
    const header = content.createDiv({ cls: 'card-header' });
    
    header.addEventListener('click', () => {
      this.callbacks.onToggleAnnotation(card, unit);
    });

    const annotationBtn = header.createDiv({ cls: 'annotation-btn' });
    annotationBtn.innerHTML = '💬';

    const tools = header.createDiv({ cls: 'card-tools' });
    tools.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    if (!this.state.batchMode) {
      const flashcardBtn = tools.createDiv({ cls: 'tool-btn flashcard-btn' });
      flashcardBtn.innerHTML = '⚡';
      flashcardBtn.setAttribute('aria-label', '生成闪卡');
      flashcardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onQuickFlashcard(unit);
      });
    }

    const moreBtn = tools.createDiv({ cls: 'tool-btn more-btn' });
    moreBtn.innerHTML = '⋮';
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onShowContextMenu(e, unit);
    });
  }

  private renderCardContent(content: HTMLElement, unit: ContentUnit): void {
    const noteText = content.createDiv({ cls: 'note-text' });

    let displayHTML = this.formatContent(unit);
    noteText.innerHTML = displayHTML;

    noteText.addEventListener('click', () => {
      this.callbacks.onJumpToSource(unit);
    });
  }

  private formatContent(unit: ContentUnit): string {
    if (unit.type === 'QA' && unit.answer) {
      return `<span class="qa-question">${unit.content}</span> <span class="qa-separator">::</span> <span class="qa-answer">${unit.answer}</span>`;
    } else if (unit.type === 'cloze' && unit.fullContext) {
      let context = unit.fullContext.replace(/==/g, '');
      const answer = unit.content;
      return context.replace(
        answer, 
        `<span class="cloze-highlight">${answer}</span>`
      );
    } else {
      return unit.content;
    }
  }

  private renderAnnotationPreview(
    content: HTMLElement, 
    card: HTMLElement, 
    unit: ContentUnit
  ): void {
    if (!this.callbacks.getAnnotationContent) return;
    
    const annotationContent = this.callbacks.getAnnotationContent(unit.id);
    if (annotationContent) {
      const annEl = content.createDiv({ cls: 'annotation-preview' });
      const annText = annotationContent.length > 60
        ? annotationContent.substring(0, 60) + '...'
        : annotationContent;
      annEl.textContent = `💬 ${annText}`;
      
      annEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onToggleAnnotation(card, unit);
      });
    }
  }

  private renderCardMeta(content: HTMLElement, unit: ContentUnit): void {
    const meta = content.createDiv({ cls: 'card-meta' });
    
    if (unit.metadata.tags.length > 0) {
      unit.metadata.tags.slice(0, 2).forEach(tag => {
        meta.createSpan({ text: `#${tag}`, cls: 'tag' });
      });
      if (unit.metadata.tags.length > 2) {
        meta.createSpan({ 
          text: `+${unit.metadata.tags.length - 2}`, 
          cls: 'tag-more' 
        });
      }
    }

    if (unit.flashcardIds.length > 0) {
      meta.createSpan({ 
        text: `🃏 ${unit.flashcardIds.length}`, 
        cls: 'badge' 
      });
    }
  }

  private renderTypeIndicator(header: HTMLElement, unit: ContentUnit): void {
    const typeIndicator = header.createDiv({ cls: 'type-indicator' });
    if (unit.type === 'QA') {
      typeIndicator.addClass('type-qa');
      typeIndicator.textContent = 'Q&A';
    } else if (unit.type === 'cloze') {
      typeIndicator.addClass('type-cloze');
      typeIndicator.textContent = 'Cloze';
    } else {
      typeIndicator.addClass('type-text');
      typeIndicator.textContent = 'Text';
    }
  }

  private renderFileName(header: HTMLElement, unit: ContentUnit): void {
    const fileName = unit.source.file.split('/').pop()?.replace('.md', '') || '';
    header.createSpan({ text: fileName, cls: 'doc-name' });
  }

  private renderGridTools(header: HTMLElement, unit: ContentUnit): void {
    const tools = header.createDiv({ cls: 'grid-card-tools' });

    if (!this.state.batchMode) {
      const flashcardBtn = tools.createDiv({ cls: 'tool-btn-grid' });
      flashcardBtn.innerHTML = '⚡';
      flashcardBtn.setAttribute('aria-label', '生成闪卡');
      flashcardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onQuickFlashcard(unit);
      });
    }

    const moreBtn = tools.createDiv({ cls: 'tool-btn-grid' });
    moreBtn.innerHTML = '⋮';
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onShowContextMenu(e, unit);
    });
  }

  private renderGridContent(content: HTMLElement, card: HTMLElement, unit: ContentUnit): void {
    const noteText = content.createDiv({ cls: 'grid-note-text' });
    noteText.innerHTML = this.formatContent(unit);
    
    noteText.addEventListener('click', () => {
      this.callbacks.onToggleAnnotation(card, unit);
    });
  }

  private renderGridAnnotation(content: HTMLElement, card: HTMLElement, unit: ContentUnit): void {
    if (!this.callbacks.getAnnotationContent) return;
    
    const annotationContent = this.callbacks.getAnnotationContent(unit.id);
    if (annotationContent) {
      const annEl = content.createDiv({ cls: 'grid-annotation' });
      annEl.innerHTML = `<strong>批注：</strong>${annotationContent}`;
      
      annEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.callbacks.onToggleAnnotation(card, unit);
      });
    }
  }

  private renderGridTags(content: HTMLElement, unit: ContentUnit): void {
    if (unit.metadata.tags.length > 0) {
      const tags = content.createDiv({ cls: 'grid-tags' });
      unit.metadata.tags.forEach(tag => {
        tags.createSpan({ text: `#${tag}`, cls: 'tag-grid' });
      });
    }
  }

  private renderGridMeta(meta: HTMLElement, unit: ContentUnit): void {
    meta.createSpan({ text: `L${unit.source.position.line}`, cls: 'line-info' });
    
    if (unit.flashcardIds.length > 0) {
      meta.createSpan({ 
        text: `🃏 ${unit.flashcardIds.length}`, 
        cls: 'badge-grid' 
      });
    }
  }

  private renderFlashcardContent(content: HTMLElement, card: Flashcard): void {
    const question = content.createDiv({ cls: 'flashcard-question' });
    question.innerHTML = `<strong>问题：</strong>${card.front}`;
    
    const answer = content.createDiv({ cls: 'flashcard-answer' });
    const answerText = Array.isArray(card.back) ? card.back.join(', ') : card.back;
    answer.innerHTML = `<strong>答案：</strong>${answerText}`;
  }

  private renderFlashcardMeta(meta: HTMLElement, card: Flashcard): void {
    meta.createSpan({
      text: this.formatDate(new Date(card.metadata.createdAt)),
      cls: 'flashcard-date'
    });
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }
 
  
}
