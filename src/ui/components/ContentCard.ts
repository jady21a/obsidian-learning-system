// src/ui/components/ContentCard.ts  卡片内容
// import { StyleLoader } from '../style/sidebarStyle'
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';
import { ViewState } from '../stats/ViewState';
import { t, Language } from '../../i18n/translations';
import { setCssProps } from '../utils/setCssProps';


export interface CardCallbacks {
  onJumpToSource: (unit: ContentUnit) => void;
  onJumpToFlashcard?: (card: Flashcard) => void; 
  onToggleAnnotation: (card: HTMLElement, unit: ContentUnit) => void;
  onQuickFlashcard: (unit: ContentUnit) => void;
  onShowContextMenu: (event: MouseEvent, unit: ContentUnit) => void;
  onFlashcardContextMenu?: (event: MouseEvent, card: Flashcard) => void;
  getAnnotationContent?: (unitId: string) => string | undefined;
  getContentUnit?: (unitId: string) => ContentUnit | undefined;
  /**
   * 可选:为 mindmap 来源的闪卡渲染只读迷你导图作为预览。
   * 返回 false 表示无法渲染(如源文件缺失),调用方回退到标准内容。
   */
  renderMindmapPreview?: (container: HTMLElement, card: Flashcard) => Promise<boolean>;
}

export class ContentCard {
  private state: ViewState;
  private callbacks: CardCallbacks;

  constructor(state: ViewState, callbacks: CardCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
  }
  private getLanguage(): Language {
    // 从 Obsidian 设置中获取语言，如果是中文则返回 'zh-CN'，否则返回 'en'
    const lang = (window as unknown as { moment?: { locale: () => string } })
  .moment?.locale() ?? 'en';
    return lang.startsWith('zh') ? 'zh-CN' : 'en';
  }
  /**
   * 渲染紧凑卡片（侧边栏模式）
   */
  renderCompact(container: HTMLElement, unit: ContentUnit): void {
    const card = container.createDiv({ cls: 'compact-card' });
    card.setAttribute('data-unit-id', unit.id);
    
    const existingCard = container.querySelector(`[data-unit-id="${unit.id}"]`);
    if (existingCard?.getAttribute('data-editing') === 'true') {
      return;
    }
    // ⭐ 使用捕获阶段 + mousedown，但不调用 preventDefault
    card.addEventListener('mousedown', (e) => {
      // ⭐ 只处理左键点击
      if (e.button !== 0) {
        return;
      }
      
      const target = e.target as HTMLElement;
      
      // 排除工具按钮等
      if (target.closest('.card-tools') || 
          target.closest('.batch-checkbox') ||
          target.closest('.annotation-btn')) {
        return;
      }
      
      // 排除编辑器内部
      if (target.closest('.inline-annotation-editor')) {
        return;
      }
      
  // ⭐ 点击内容区域打开批注
  if (target.closest('.note-text') || target.closest('.annotation-preview')) {
    
    e.stopPropagation();
    // ⭐ 阻止默认行为,防止干扰聚焦
    e.preventDefault();
        
        this.callbacks.onToggleAnnotation(card, unit);
      }
    }, false); // ⭐ false = 冒泡阶段（默认）
  
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
  card.setAttribute('data-unit-id', unit.id); // ⭐ 添加这行，方便查找
  
  card.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    // 排除工具按钮、checkbox、header
    if (target.closest('.grid-card-tools') || 
        target.closest('.batch-checkbox') ||
        target.closest('.grid-card-header') ||
        target.closest('.doc-name')) {
      return;
    }
    
    // 点击内容区域 = 打开批注
    if (target.closest('.grid-card-content')) {
      e.stopPropagation();
      this.callbacks.onToggleAnnotation(card, unit);
    }
  });
  
  setCssProps(card, { cursor: 'default' });

  if (this.state.batchMode) {
    this.renderCheckbox(card, unit.id, this.state.selectedUnitIds.has(unit.id));
  }

  const header = card.createDiv({ cls: 'grid-card-header' });
  this.renderTypeIndicator(header, unit);
  
  const fileName = this.renderFileName(header, unit);
  fileName.onclick = (e) => {
    e.stopPropagation();
    this.callbacks.onJumpToSource(unit);
  };
  setCssProps(fileName, { cursor: 'pointer' });
  
  this.renderGridTools(header, unit);

  const content = card.createDiv({ cls: 'grid-card-content' });
  setCssProps(content, { cursor: 'pointer' });
  
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
    const cardType = header.createDiv({ cls: 'card-type-badge' });
    const srcUnit = this.callbacks.getContentUnit?.(card.sourceContentId);
    const isMindmap = srcUnit?.extractRule?.ruleId === 'mindmap-cloze';
    cardType.textContent = isMindmap ? 'Mindmap' : card.type === 'qa' ? 'Q&A' : 'Cloze';
    cardType.addClass(`type-${isMindmap ? 'mindmap' : card.type}`);
    
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
    moreBtn.setText('⋮');
    moreBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (this.callbacks.onFlashcardContextMenu) {
        this.callbacks.onFlashcardContextMenu(e, card);
      }
    });

    const content = cardEl.createDiv({ cls: 'grid-card-content' });
    if (isMindmap && this.callbacks.renderMindmapPreview) {
      content.addClass('grid-card-mindmap-preview');
      void this.callbacks.renderMindmapPreview(content, card).then((ok) => {
        if (!ok) {
          content.empty();
          content.removeClass('grid-card-mindmap-preview');
          this.renderFlashcardContent(content, card);
        }
      });
    } else {
      this.renderFlashcardContent(content, card);
    }

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
    
    // ⭐ 左侧批注按钮区域 - 点击跳转原文
    const annotationBtn = header.createDiv({ cls: 'annotation-btn' });
    this.renderSideLine(annotationBtn, unit);
    
    // ⭐ 使用 mousedown 代替 click，并且只 stopPropagation
    annotationBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.callbacks.onJumpToSource(unit);
    });
    setCssProps(annotationBtn, { cursor: 'pointer' });
  
    // ⭐ 右侧工具按钮区域
    const tools = header.createDiv({ cls: 'card-tools' });
    
    // 阻止工具区域事件冒泡
    tools.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
  
    if (!this.state.batchMode) {
      const flashcardBtn = tools.createDiv({ cls: 'tool-btn flashcard-btn' });
      flashcardBtn.setText('⚡');
      flashcardBtn.setAttribute('aria-label', 'Generate flashcards');
      flashcardBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.callbacks.onQuickFlashcard(unit);
      });
    }
  
    const moreBtn = tools.createDiv({ cls: 'tool-btn more-btn' });
    moreBtn.setText('⋮');
    moreBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.callbacks.onShowContextMenu(e, unit);
    });
  }

  private renderCardContent(content: HTMLElement, unit: ContentUnit): void {
    const noteText = content.createDiv({ cls: 'note-text' });
  
    if (this.isTableContent(unit.fullContext || unit.content)) {
      this.renderMarkdownContent(noteText, unit);
    } else {
      this.formatInto(noteText, unit);
    }

    // ⭐ 只设置样式,不绑定事件
    setCssProps(noteText, { cursor: 'pointer' });
  }


  /**
   * 把 unit 的内容渲染到目标元素(用 DOM API,不走 innerHTML 拼接,避免 XSS 风险)。
   * - QA:question / :: / answer 三段 span;
   * - cloze:把 ==X== 包裹的片段渲染为 .cloze-highlight 高亮 span;
   * - 手工提取的内容保留换行(转 <br>)。
   */
  private formatInto(el: HTMLElement, unit: ContentUnit): void {
    el.empty();
    const isManual = unit.extractRule?.extractedBy === 'manual';

    const appendWithBreaks = (parent: HTMLElement, text: string) => {
      if (!isManual) { parent.appendText(text); return; }
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        parent.appendText(line);
        if (i < lines.length - 1) parent.createEl('br');
      });
    };

    const appendClozeText = (parent: HTMLElement, text: string) => {
      const re = /==([^=]+)==/g;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) appendWithBreaks(parent, text.slice(last, m.index));
        const span = parent.createSpan({ cls: 'cloze-highlight' });
        appendWithBreaks(span, m[1]);
        last = m.index + m[0].length;
      }
      if (last < text.length) appendWithBreaks(parent, text.slice(last));
    };

    if (unit.type === 'QA' && unit.answer) {
      const q = el.createSpan({ cls: 'qa-question' });
      appendWithBreaks(q, unit.content);
      el.appendText(' ');
      el.createSpan({ cls: 'qa-separator', text: '::' });
      el.appendText(' ');
      const a = el.createSpan({ cls: 'qa-answer' });
      appendWithBreaks(a, unit.answer);
      return;
    }
    if (unit.type === 'cloze') {
      if (unit.fullContext) {
        appendClozeText(el, unit.fullContext);
      } else {
        appendWithBreaks(el, unit.content.replace(/==/g, ''));
      }
      return;
    }
    appendWithBreaks(el, unit.content);
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
    if (!annotationContent) return;
    
    // ⭐ 移除 isEditing 检查,直接检查是否已有预览
    const existingPreview = content.querySelector('.annotation-preview');
    if (existingPreview) {
      return;
    }
    
    // ⭐ 检查是否有编辑器(更可靠)
    const existingEditor = content.querySelector('.inline-annotation-editor');
    if (existingEditor) {
      return;
    }
    
    

    const annEl = content.createDiv({ cls: 'annotation-preview' });
    const displayText = annotationContent.length > 60
      ? annotationContent.substring(0, 60) + '...'
      : annotationContent;
    annEl.textContent = `💬 ${displayText}`;
    
    // 点击事件
    annEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onToggleAnnotation(card, unit);
    });
    
    // Tab 键事件
    annEl.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.onToggleAnnotation(card, unit);
      }
    });
    
    const noteText = content.querySelector('.note-text, .grid-note-text') as HTMLElement;
    if (noteText) {
      noteText.insertAdjacentElement('afterend', annEl);
    } else {
      content.appendChild(annEl);
    }
    
    annEl.setAttribute('tabindex', '0');
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
        meta.createSpan({ text: `${tag}`, cls: 'tag' });
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
      // eslint-disable-next-line obsidianmd/ui/sentence-case -- "Q&A" is an acronym
      typeIndicator.textContent = 'Q&A';
    } else if (unit.type === 'cloze') {
      const isMindmap = unit.extractRule?.ruleId === 'mindmap-cloze';
      typeIndicator.addClass(isMindmap ? 'type-mindmap' : 'type-cloze');
      typeIndicator.textContent = isMindmap ? 'Mindmap' : 'Cloze';
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
      flashcardBtn.setText('⚡');
      flashcardBtn.setAttribute('aria-label', 'Generate flashcards');
      flashcardBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.callbacks.onQuickFlashcard(unit);
      });
    }

    const moreBtn = tools.createDiv({ cls: 'tool-btn-grid' });
    moreBtn.setText('⋮');
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
      this.formatInto(noteText, unit);
    }
    
    // ⭐ 简化事件处理：只保留 click
    noteText.addEventListener('click', (e) => {
      
      e.stopPropagation();
      // ⭐ 移除 preventDefault
      this.callbacks.onToggleAnnotation(card, unit);
    });
    
    setCssProps(noteText, { cursor: 'pointer' });
  }
  
  private renderGridAnnotation(content: HTMLElement, card: HTMLElement, unit: ContentUnit): void {
    if (!this.callbacks.getAnnotationContent) return;
    
    const annotationContent = this.callbacks.getAnnotationContent(unit.id);
    if (annotationContent) {
      const annEl = content.createDiv({ cls: 'grid-annotation' });
      annEl.setText(`💬 ${annotationContent}`);
      
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
        tags.createSpan({ text: `${tag}`, cls: 'tag-grid' });
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
    const lang = this.getLanguage();
    const question = content.createDiv({ cls: 'flashcard-question' });
    question.createEl('strong', { text: `${t('card.question', lang)}：` });
    question.appendText(card.front);

    const answer = content.createDiv({ cls: 'flashcard-answer' });
    const answerText = Array.isArray(card.back) ? card.back.join(', ') : card.back;
    answer.createEl('strong', { text: `${t('card.answer', lang)}：` });
    answer.appendText(answerText);
  }

  private renderFlashcardMeta(meta: HTMLElement, card: Flashcard): void {
    meta.createSpan({
      text: this.formatDate(new Date(card.metadata.createdAt)),
      cls: 'flashcard-date'
    });
    const reviewInfo = meta.createDiv({ cls: 'flashcard-review-info' });

    const dueDate = new Date(card.scheduling.due);
    const now = new Date();
    const isOverdue = dueDate < now;

    const timeText = this.formatReviewTime(dueDate, now, isOverdue);

    const wrap = reviewInfo.createSpan({ cls: `review-time ${isOverdue ? 'overdue' : 'upcoming'}` });
    wrap.createSpan({ cls: 'review-text', text: timeText });
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }
  private formatReviewTime(dueDate: Date, now: Date, isOverdue: boolean): string {
    const lang = this.getLanguage();
    const diff = Math.abs(dueDate.getTime() - now.getTime());
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (isOverdue) {
      if (hours < 1) {
        return minutes < 1 ? t('card.justDue', lang) : t('card.delayedMinutes', lang, { minutes: String(minutes) });
      } else if (hours < 24) {
        return t('card.delayedHours', lang, { hours: String(hours) });
      } else {
        return t('card.delayedDays', lang, { days: String(days) });
      }
    } else {
      if (hours < 1) {
        return t('card.dueInMinutes', lang, { minutes: String(minutes) });
      } else if (hours < 24) {
        return t('card.dueInHours', lang, { hours: String(hours) });
      } else {
        return t('card.dueInDays', lang, { days: String(days) });
      }
    }
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
  
  
  // 把单元格文本里的 ==X== 渲染成 .cloze-highlight 高亮 span(DOM 构造,无 innerHTML)
  const renderCellInto = (parent: HTMLElement, cell: string) => {
    if (!cell.includes('==')) { parent.setText(cell); return; }
    const re = /==([^=]+)==/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cell)) !== null) {
      if (m.index > last) parent.appendText(cell.slice(last, m.index));
      parent.createSpan({ cls: 'cloze-highlight', text: m[1] });
      last = m.index + m[0].length;
    }
    if (last < cell.length) parent.appendText(cell.slice(last));
  };

  const thead = table.createEl('thead');
  const headerRow = thead.createEl('tr');
  headerCells.forEach((cell) => {
    const th = headerRow.createEl('th');
    renderCellInto(th, cell);
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
    cells.forEach((cell) => {
      const td = row.createEl('td');
      renderCellInto(td, cell);
    });
  }
  
}
}
  

 