// src/ui/components/ContentCard.ts  卡片内容
// import { StyleLoader } from '../style/sidebarStyle'
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';
import { ViewState } from '../state/ViewState';
import { MarkdownRenderer } from 'obsidian'; // 

export interface CardCallbacks {
  onJumpToSource: (unit: ContentUnit) => void;
  onJumpToFlashcard?: (card: Flashcard) => void; 
  onToggleAnnotation: (card: HTMLElement, unit: ContentUnit) => void;
  onQuickFlashcard: (unit: ContentUnit) => void;
  onShowContextMenu: (event: MouseEvent, unit: ContentUnit) => void;
  onFlashcardContextMenu?: (event: MouseEvent, card: Flashcard) => void;
  getAnnotationContent?: (unitId: string) => string | undefined;
  getContentUnit?: (unitId: string) => ContentUnit | undefined;  
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
    card.setAttribute('data-unit-id', unit.id);
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
    
    // ⭐ 直接在 card 级别处理所有点击
    card.onclick = (e) => {
      console.log('🎯 [Card onclick] Triggered', {
        target: (e.target as HTMLElement).className,
        targetTag: (e.target as HTMLElement).tagName
      });
      
      const target = e.target as HTMLElement;
      
      // 排除工具按钮和 checkbox
      if (target.closest('.grid-card-tools') || 
          target.closest('.batch-checkbox') ||
          target.closest('.grid-card-header')) {
        console.log('🎯 [Card] Ignored - clicked on excluded element');
        return;
      }
      
      // 点击内容区域 = 打开批注
      if (target.closest('.grid-card-content')) {
        console.log('🎯 [Card] Opening annotation');
        e.stopPropagation();
        this.callbacks.onToggleAnnotation(card, unit);
        return;
      }
    };
    
    card.style.cursor = 'default';
  
    if (this.state.batchMode) {
      this.renderCheckbox(card, unit.id, this.state.selectedUnitIds.has(unit.id));
    }
  
    const header = card.createDiv({ cls: 'grid-card-header' });
    this.renderTypeIndicator(header, unit);
    
    const fileName = this.renderFileName(header, unit);
    fileName.onclick = (e) => {
      console.log('🎯 [FileName] Clicked');
      e.stopPropagation();
      this.callbacks.onJumpToSource(unit);
    };
    fileName.style.cursor = 'pointer';
    
    this.renderGridTools(header, unit);
  
    const content = card.createDiv({ cls: 'grid-card-content' });
    content.style.cursor = 'pointer'; // ⭐ 添加指针样式
    
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
    header.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (!(e.target as HTMLElement).closest('.batch-checkbox')) {
        // 使用新的回调处理 flashcard 跳转
        if (this.callbacks.onJumpToFlashcard) {
          this.callbacks.onJumpToFlashcard(card);
        }
      }
    });


    const tools = header.createDiv({ cls: 'grid-card-tools' });
    const moreBtn = tools.createDiv({ cls: 'tool-btn-grid' });
    moreBtn.innerHTML = '⋮';
    moreBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
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
      e.stopPropagation();
      e.preventDefault();
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
    
    // ⭐ 删除所有 header.addEventListener 代码
    // 因为现在由容器级别的事件委托处理
    
    const annotationBtn = header.createDiv({ cls: 'annotation-btn' });
    this.renderSideLine(annotationBtn, unit);    
  
    const tools = header.createDiv({ cls: 'card-tools' });
    
    // ⭐ 保留 tools 的事件阻止（防止冒泡到 header）
    tools.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
    }, true);
  
    if (!this.state.batchMode) {
      const flashcardBtn = tools.createDiv({ cls: 'tool-btn flashcard-btn' });
      flashcardBtn.innerHTML = '⚡';
      flashcardBtn.setAttribute('aria-label', 'Generate Flashcards');
      flashcardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.callbacks.onQuickFlashcard(unit);
      }, true);
    }
  
    const moreBtn = tools.createDiv({ cls: 'tool-btn more-btn' });
    moreBtn.innerHTML = '⋮';
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.callbacks.onShowContextMenu(e, unit);
    }, true);
  }

  private renderCardContent(content: HTMLElement, unit: ContentUnit): void {
    const noteText = content.createDiv({ cls: 'note-text' });
  
    if (this.isTableContent(unit.fullContext || unit.content)) {
      this.renderMarkdownContent(noteText, unit);
    } else {
      let displayHTML = this.formatContent(unit);
      noteText.innerHTML = displayHTML;
    }
  
    // ⭐ 只绑定跳转功能,不干扰批注点击
    noteText.addEventListener('click', (e) => {
      e.stopPropagation();
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
  private renderSideLine(meta: HTMLElement, unit: ContentUnit): void {
    meta.createSpan({ text: `L${unit.source.position.line}`, cls: 'line-info' });
    
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
      annEl.textContent = `${annText}`;
  
      // ⭐ 删除所有 addEventListener 代码
      // 因为现在由容器级别的事件委托处理
    }
  }

  private renderCardMeta(content: HTMLElement, unit: ContentUnit): void {
    const meta = content.createDiv({ cls: 'card-meta' });
    if (unit.flashcardIds.length > 0) {
      meta.createSpan({ 
        text: `🃏 ${unit.flashcardIds.length}`, 
        cls: 'badge' 
      });
    } 
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

  private renderFileName(header: HTMLElement, unit: ContentUnit): HTMLElement {
    const fileName = unit.source.file.split('/').pop()?.replace('.md', '') || '';
    const fileNameSpan = header.createSpan({ text: fileName, cls: 'doc-name' });
    return fileNameSpan;
  }

  private renderGridTools(header: HTMLElement, unit: ContentUnit): void {
    const tools = header.createDiv({ cls: 'grid-card-tools' });

    if (!this.state.batchMode) {
      const flashcardBtn = tools.createDiv({ cls: 'tool-btn-grid' });
      flashcardBtn.innerHTML = '⚡';
      flashcardBtn.setAttribute('aria-label', 'Generate Flashcards');
      flashcardBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.callbacks.onQuickFlashcard(unit);
      });
    }

    const moreBtn = tools.createDiv({ cls: 'tool-btn-grid' });
    moreBtn.innerHTML = '⋮';
    moreBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.callbacks.onShowContextMenu(e, unit);
    });
  }

  private renderGridContent(content: HTMLElement, card: HTMLElement, unit: ContentUnit): void {
    const noteText = content.createDiv({ cls: 'grid-note-text' });
    
    if (this.isTableContent(unit.fullContext || unit.content)) {
      this.renderMarkdownContent(noteText, unit);
    } else {
      noteText.innerHTML = this.formatContent(unit);
    }
    
    // ⭐ 添加所有可能的事件监听
    noteText.addEventListener('mousedown', (e) => {
      console.log('🎯 [NoteText] MouseDown', {
        target: e.target,
        button: e.button,
        defaultPrevented: e.defaultPrevented
      });
    });
    
    noteText.addEventListener('mouseup', (e) => {
      console.log('🎯 [NoteText] MouseUp');
    });
    
    noteText.addEventListener('click', (e) => {
      console.log('🎯 [NoteText] Click Event!', {
        target: (e.target as HTMLElement).tagName,
        targetClass: (e.target as HTMLElement).className,
        currentTarget: (e.currentTarget as HTMLElement).className,
        defaultPrevented: e.defaultPrevented,
        propagationStopped: e.cancelBubble
      });
      
      e.stopPropagation();
      
      console.log('🎯 [NoteText] About to call onToggleAnnotation');
      this.callbacks.onToggleAnnotation(card, unit);
    });
    
    noteText.style.cursor = 'pointer';
    
    // ⭐ 验证事件监听器已绑定
    console.log('🎯 [NoteText] Event listeners attached for unit:', unit.id);
  }
  
  private renderGridAnnotation(content: HTMLElement, card: HTMLElement, unit: ContentUnit): void {
    if (!this.callbacks.getAnnotationContent) return;
    
    const annotationContent = this.callbacks.getAnnotationContent(unit.id);
    if (annotationContent) {
      const annEl = content.createDiv({ cls: 'grid-annotation' });
      annEl.innerHTML = `${annotationContent}`;
      
      annEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
      });
      
      annEl.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
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


  // 🆕 添加表格检测方法
  private isTableContent(content: string | undefined): boolean {
    if (!content) return false;
    const lines = content.trim().split('\n');
    return lines.length >= 2 && 
           lines.every(line => line.includes('|')) &&
           !!lines[1]?.match(/^\s*\|[\s:-]+\|/);
  }

  // 🆕 添加 Markdown 渲染方法
  private renderMarkdownContent(container: HTMLElement, unit: ContentUnit): void {
    container.empty();
    
    let content = unit.fullContext || unit.content;
    
    // 🆕 检查是否为表格
    if (this.isTableContent(content)) {
      // 手动渲染表格
      this.renderTableWithHighlights(container, content);
    } else {
      // 使用 Markdown 渲染器
      const { MarkdownRenderer } = require('obsidian');
      content = content.replace(/==([^=]+)==/g, '<span class="highlight">$1</span>');
      MarkdownRenderer.renderMarkdown(content, container, unit.source.file, null);
    }
  }
  
  // 🆕 添加手动表格渲染方法
private renderTableWithHighlights(container: HTMLElement, markdown: string): void {
  
  const lines = markdown.trim().split('\n');
  
  const table = container.createEl('table', { cls: 'learning-system-table' });
  
  // 解析表头
  const headerCells = lines[0]
    .split('|')
    .map(c => c.trim())
    .filter(c => c);
  
  
  const thead = table.createEl('thead');
  const headerRow = thead.createEl('tr');
  headerCells.forEach((cell, index) => {
    const th = headerRow.createEl('th');
    
    if (cell.includes('==')) {
      const processed = cell.replace(
        /==([^=]+)==/g, 
        '<span style="background-color: rgba(255, 140, 0, 0.25); padding: 2px 4px; border-radius: 3px; font-weight: 500;">$1</span>'
      );
      th.innerHTML = processed;

    } else {
      th.textContent = cell;
    }
  });
  
  // 解析数据行
  const tbody = table.createEl('tbody');
  for (let i = 2; i < lines.length; i++) {
    
    const cells = lines[i]
      .split('|')
      .map(c => c.trim())
      .filter(c => c);
    
    if (cells.length === 0) continue;
    
    const row = tbody.createEl('tr');
    cells.forEach((cell, index) => {
      const td = row.createEl('td');
      
      if (cell.includes('==')) {
        const processed = cell.replace(
          /==([^=]+)==/g, 
          '<span style="background-color: rgba(255, 140, 0, 0.25); padding: 2px 4px; border-radius: 3px; font-weight: 500;">$1</span>'
        );
        td.innerHTML = processed;
      } else {
        td.textContent = cell;
      }
    });
  }
  
}
}
  

 