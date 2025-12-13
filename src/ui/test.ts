// SidebarOverviewView.ts - 响应式版本
import { ItemView, WorkspaceLeaf, TFile, Menu, Notice, Modal, App } from 'obsidian';
import type LearningSystemPlugin from '../main';
import { ContentUnit } from '../core/DataManager';
import { VIEW_TYPE_OVERVIEW } from './OverviewView';

export const VIEW_TYPE_SIDEBAR_OVERVIEW = 'learning-system-sidebar-overview';

export class SidebarOverviewView extends ItemView {
  plugin: LearningSystemPlugin;
  private searchQuery: string = '';
  private filterMode: 'all' | 'annotated' | 'flashcards' = 'all';
  private selectedFile: string | null = null;
  private displayMode: 'sidebar' | 'main' = 'sidebar'; // 新增：显示模式

  constructor(leaf: WorkspaceLeaf, plugin: LearningSystemPlugin) {
    super(leaf);
    this.plugin = plugin;
    
    // 监听文件变化
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.refresh();
      })
    );

    // 监听布局变化以检测位置
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.detectDisplayMode();
        this.render();
      })
    );
  }

  getViewType(): string {
    return VIEW_TYPE_SIDEBAR_OVERVIEW;
  }

  getDisplayText(): string {
    return 'Learning Overview';
  }

  getIcon(): string {
    return 'book-marked';
  }

  async onOpen() {
    this.detectDisplayMode();
    this.render();
    this.addResponsiveStyles();
  }

  // 检测当前视图在侧边栏还是主区域
  private detectDisplayMode() {
    // 方法1: 检查 leaf 的父容器
    const parentSplit = (this.leaf as any).parentSplit;
    const isLeftSidebar = parentSplit?.type === 'split' && 
                          this.app.workspace.leftSplit === parentSplit;
    const isRightSidebar = parentSplit?.type === 'split' && 
                           this.app.workspace.rightSplit === parentSplit;
    
    // 方法2: 检查容器宽度
    const containerEl = this.containerEl;
    const width = containerEl.clientWidth;
    const isNarrow = width < 500;
    
    // 如果在左/右侧边栏，或者宽度小于500px，则使用侧边栏模式
    const isSidebar = isLeftSidebar || isRightSidebar || isNarrow;

    this.displayMode = isSidebar ? 'sidebar' : 'main';
  }

  refresh() {
    this.render();
  }

  private render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('sidebar-overview-responsive');
    container.setAttribute('data-mode', this.displayMode);

    if (this.displayMode === 'sidebar') {
      this.renderSidebarMode(container);
    } else {
      this.renderMainMode(container);
    }
  }

  // ==================== 侧边栏模式（图2）====================
  private renderSidebarMode(container: HTMLElement) {
    // 顶部工具栏
    this.renderCompactToolbar(container);

    // 内容列表（单栏）
    const contentList = container.createDiv({ cls: 'content-list-sidebar' });
    this.renderContentList(contentList, true);
  }

  // ==================== 主界面模式（图1）====================
  private renderMainMode(container: HTMLElement) {
    const mainLayout = container.createDiv({ cls: 'main-layout-three-column' });

    // 左侧：文件列表
    const leftPanel = mainLayout.createDiv({ cls: 'left-panel' });
    this.renderFileList(leftPanel);

    // 中间：内容预览
    const middlePanel = mainLayout.createDiv({ cls: 'middle-panel' });
    this.renderContentPreview(middlePanel);

    // 右侧：详细信息
    const rightPanel = mainLayout.createDiv({ cls: 'right-panel' });
    this.renderDetailPanel(rightPanel);
  }

  // ==================== 共用组件 ====================
  private renderCompactToolbar(container: HTMLElement) {
    const toolbar = container.createDiv({ cls: 'compact-toolbar' });

    // 搜索框
    const searchInput = toolbar.createEl('input', {
      type: 'text',
      placeholder: '🔍 搜索高亮或评论...',
      cls: 'compact-search'
    });
    searchInput.value = this.searchQuery;
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.render();
    });

    // 过滤标签
    const filters = toolbar.createDiv({ cls: 'compact-filters' });
    
    const filterButtons = [
      { mode: 'all', icon: '📝', label: 'All' },
      { mode: 'annotated', icon: '💬', label: 'Notes' },
      { mode: 'flashcards', icon: '🃏', label: 'Cards' }
    ] as const;

    filterButtons.forEach(({ mode, icon, label }) => {
      const btn = filters.createDiv({
        cls: `filter-chip ${this.filterMode === mode ? 'active' : ''}`,
        text: `${icon} ${label}`
      });
      btn.addEventListener('click', () => {
        this.filterMode = mode;
        this.render();
      });
    });

    // 统计信息
    const stats = this.getFilteredStats();
    toolbar.createDiv({
      cls: 'compact-stats',
      text: `${stats.count} items`
    });
  }

  // 左侧：文件列表（主界面模式）
  private renderFileList(container: HTMLElement) {
    container.createEl('h3', { text: '📁 Files', cls: 'panel-title' });

    const fileListContainer = container.createDiv({ cls: 'file-list-main' });
    
    const units = this.getFilteredUnits();
    const grouped = this.groupByFile(units);

    grouped.forEach(({ filePath, units: fileUnits }) => {
      const fileItem = fileListContainer.createDiv({ 
        cls: `file-item-main ${this.selectedFile === filePath ? 'selected' : ''}`
      });

      const fileName = filePath.split('/').pop()?.replace('.md', '') || filePath;
      
      fileItem.createSpan({ text: '📄', cls: 'file-icon' });
      fileItem.createSpan({ text: fileName, cls: 'file-name' });
      fileItem.createSpan({ text: `${fileUnits.length}`, cls: 'count-badge' });

      fileItem.addEventListener('click', () => {
        this.selectedFile = filePath;
        this.render();
      });
    });
  }

  // 中间：内容预览（主界面模式）
  private renderContentPreview(container: HTMLElement) {
    if (!this.selectedFile) {
      const empty = container.createDiv({ cls: 'empty-preview' });
      empty.createEl('div', { text: '👈 选择文件查看内容', cls: 'empty-hint' });
      return;
    }

    const fileName = this.selectedFile.split('/').pop()?.replace('.md', '') || '';
    
    const header = container.createDiv({ cls: 'preview-header' });
    header.createEl('h3', { text: fileName });
    
    const openBtn = header.createEl('button', { text: '↗ 打开', cls: 'open-btn' });
    openBtn.addEventListener('click', async () => {
      const file = this.app.vault.getAbstractFileByPath(this.selectedFile!);
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf(false).openFile(file);
      }
    });

    const contentList = container.createDiv({ cls: 'preview-content-list' });
    const units = this.plugin.dataManager.getContentUnitsByFile(this.selectedFile);
    
    units.forEach(unit => {
      this.renderContentCard(contentList, unit, 'preview');
    });
  }

  // 右侧：详细信息（主界面模式）
  private renderDetailPanel(container: HTMLElement) {
    container.createEl('h3', { text: '📊 Statistics', cls: 'panel-title' });

    const stats = this.getFilteredStats();
    
    const statsGrid = container.createDiv({ cls: 'stats-grid' });
    
    [
      { label: '总高亮', value: stats.count, icon: '📝' },
      { label: '已批注', value: stats.withAnnotations, icon: '💬' },
      { label: '已制卡', value: stats.withFlashcards, icon: '🃏' }
    ].forEach(({ label, value, icon }) => {
      const statItem = statsGrid.createDiv({ cls: 'stat-item' });
      statItem.createDiv({ text: icon, cls: 'stat-icon' });
      statItem.createDiv({ text: value.toString(), cls: 'stat-value' });
      statItem.createDiv({ text: label, cls: 'stat-label' });
    });

    // 最近活动
    container.createEl('h4', { text: '🕐 Recent', cls: 'section-title' });
    const recentList = container.createDiv({ cls: 'recent-list' });
    
    const units = this.getFilteredUnits();
    const recent = units.slice(0, 5);
    
    recent.forEach(unit => {
      const item = recentList.createDiv({ cls: 'recent-item' });
      const text = unit.content.length > 30 
        ? unit.content.substring(0, 30) + '...'
        : unit.content;
      item.textContent = text;
      
      item.addEventListener('click', async () => {
        await this.openContentInSource(unit);
      });
    });
  }

  // 渲染内容列表（通用）
  private renderContentList(container: HTMLElement, compact: boolean = false) {
    const units = this.getFilteredUnits();

    if (units.length === 0) {
      container.createDiv({
        text: '📭 No items found',
        cls: 'empty-state'
      });
      return;
    }

    const grouped = this.groupByFile(units);

    grouped.forEach(({ filePath, units: fileUnits }) => {
      const groupEl = container.createDiv({ cls: 'file-group' });

      // 文件头
      const header = groupEl.createDiv({ cls: 'file-header' });
      const fileName = filePath.split('/').pop()?.replace('.md', '') || filePath;
      
      header.createSpan({ text: '📄', cls: 'file-icon' });
      header.createSpan({ text: fileName, cls: 'file-name' });
      header.createSpan({ text: `${fileUnits.length}`, cls: 'count-badge' });

      // 内容项
      fileUnits.forEach(unit => {
        this.renderContentCard(groupEl, unit, compact ? 'compact' : 'normal');
      });
    });
  }

  // 渲染内容卡片
  private renderContentCard(
    container: HTMLElement, 
    unit: ContentUnit,
    mode: 'compact' | 'normal' | 'preview' = 'normal'
  ) {
    const card = container.createDiv({ cls: `content-card content-card-${mode}` });

    // 左侧指示器
    if (mode === 'compact') {
      const indicator = card.createDiv({ cls: 'card-indicator' });
      if (unit.annotationId) indicator.addClass('has-annotation');
      if (unit.flashcardIds.length > 0) indicator.addClass('has-flashcard');
    }

    const content = card.createDiv({ cls: 'card-content' });

    // 行号标签（侧边栏模式显示）
    if (mode === 'compact') {
      const lineLabel = content.createDiv({ cls: 'line-label' });
      lineLabel.createSpan({ text: '✏️', cls: 'edit-icon' });
      lineLabel.createSpan({ text: `L${unit.source.position.line}`, cls: 'line-number' });
    }

    // 笔记文本
    const noteText = content.createDiv({ cls: 'note-text' });
    const maxLength = mode === 'compact' ? 60 : 120;
    const text = unit.content.length > maxLength
      ? unit.content.substring(0, maxLength) + '...'
      : unit.content;
    noteText.textContent = text;

    // 批注显示
    const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
    if (annotation) {
      const annEl = content.createDiv({ cls: 'annotation-text' });
      const annText = annotation.content.length > 50
        ? annotation.content.substring(0, 50) + '...'
        : annotation.content;
      annEl.textContent = annText;
      
      if (mode !== 'compact') {
        const timestamp = content.createDiv({ cls: 'timestamp' });
        timestamp.textContent = new Date(annotation.metadata.createdAt).toLocaleString();
      }
    }

    // 底部元数据
    if (mode !== 'compact') {
      const meta = content.createDiv({ cls: 'card-meta' });
      
      if (unit.metadata.tags.length > 0) {
        unit.metadata.tags.slice(0, 2).forEach(tag => {
          meta.createSpan({ text: tag, cls: 'tag' });
        });
      }

      if (unit.flashcardIds.length > 0) {
        meta.createSpan({ text: `🃏 ${unit.flashcardIds.length}`, cls: 'badge' });
      }
    }

    // 点击事件
    card.addEventListener('click', async () => {
      await this.openContentInSource(unit);
    });

    // 右键菜单
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, unit);
    });
  }

  private async openContentInSource(unit: ContentUnit) {
    const file = this.app.vault.getAbstractFileByPath(unit.source.file);
    if (!(file instanceof TFile)) return;

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);

    setTimeout(() => {
      const view = this.app.workspace.getActiveViewOfType(ItemView);
      if (view) {
        const editor = (view as any).editor;
        if (editor) {
          const line = unit.source.position.line;
          editor.setCursor({ line, ch: 0 });
          editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
          
          setTimeout(() => {
            editor.setSelection({ line, ch: 0 }, { line, ch: 999 });
          }, 100);
        }
      }
    }, 100);
  }

  private showContextMenu(e: MouseEvent, unit: ContentUnit) {
    const menu = new Menu();

    menu.addItem((item) =>
      item.setTitle('📖 Open in editor').onClick(async () => {
        await this.openContentInSource(unit);
      })
    );

    menu.addItem((item) =>
      item.setTitle('💬 Add/Edit note').onClick(async () => {
        await this.quickEditAnnotation(unit);
      })
    );

    menu.addSeparator();

    menu.addItem((item) =>
      item.setTitle('⚡ Create flashcard').onClick(async () => {
        const { QuickFlashcardCreator } = await import('../core/QuickFlashcardCreator');
        const creator = new QuickFlashcardCreator(this.plugin);
        await creator.createSmartCard(unit);
        this.refresh();
        new Notice('Flashcard created!');
      })
    );

    menu.addItem((item) =>
      item.setTitle('🗑 Delete').onClick(async () => {
        if (confirm('Delete this highlight?')) {
          await this.plugin.dataManager.deleteContentUnit(unit.id);
          this.refresh();
        }
      })
    );

    menu.showAtMouseEvent(e);
  }

  private async quickEditAnnotation(unit: ContentUnit) {
    const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
    const existingText = annotation?.content || '';

    const newText = await this.promptForText(
      'Add/Edit Note',
      existingText,
      'Enter your note...'
    );

    if (newText !== null) {
      if (newText.trim()) {
        if (annotation) {
          await this.plugin.annotationManager.updateAnnotation(annotation.id, {
            content: newText
          });
        } else {
          await this.plugin.annotationManager.addContentAnnotation(unit.id, newText);
        }
        new Notice('Note saved!');
      } else if (annotation) {
        await this.plugin.annotationManager.deleteAnnotation(annotation.id);
        new Notice('Note deleted!');
      }
      this.refresh();
    }
  }

  private promptForText(
    title: string,
    defaultValue: string,
    placeholder: string
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new (class extends Modal {
        result: string | null = null;

        constructor(app: App) {
          super(app);
        }

        onOpen() {
          const { contentEl } = this;
          contentEl.createEl('h3', { text: title });

          const textarea = contentEl.createEl('textarea', {
            cls: 'quick-annotation-textarea',
            placeholder
          });
          textarea.value = defaultValue;
          textarea.style.width = '100%';
          textarea.style.minHeight = '100px';

          const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
          
          const saveBtn = buttonContainer.createEl('button', {
            text: 'Save',
            cls: 'mod-cta'
          });
          saveBtn.addEventListener('click', () => {
            this.result = textarea.value;
            this.close();
          });

          const cancelBtn = buttonContainer.createEl('button', {
            text: 'Cancel'
          });
          cancelBtn.addEventListener('click', () => {
            this.close();
          });

          textarea.focus();
        }

        onClose() {
          resolve(this.result);
        }
      })(this.app);

      modal.open();
    });
  }

  // ==================== 工具方法 ====================
  private getFilteredUnits(): ContentUnit[] {
    let units = this.plugin.dataManager.getAllContentUnits();

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      units = units.filter(unit =>
        unit.content.toLowerCase().includes(query) ||
        unit.source.file.toLowerCase().includes(query)
      );
    }

    if (this.filterMode === 'annotated') {
      units = units.filter(u => u.annotationId);
    } else if (this.filterMode === 'flashcards') {
      units = units.filter(u => u.flashcardIds.length > 0);
    }

    return units;
  }

  private groupByFile(units: ContentUnit[]) {
    const grouped = new Map<string, ContentUnit[]>();
    
    units.forEach(unit => {
      if (!grouped.has(unit.source.file)) {
        grouped.set(unit.source.file, []);
      }
      grouped.get(unit.source.file)!.push(unit);
    });

    return Array.from(grouped.entries())
      .map(([filePath, units]) => ({ filePath, units }))
      .sort((a, b) => b.units.length - a.units.length);
  }

  private getFilteredStats() {
    const units = this.getFilteredUnits();

    return {
      count: units.length,
      withAnnotations: units.filter(u => u.annotationId).length,
      withFlashcards: units.filter(u => u.flashcardIds.length > 0).length
    };
  }

  private addResponsiveStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      /* ==================== 基础布局 ==================== */
      .sidebar-overview-responsive {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* ==================== 侧边栏模式 ==================== */
      .sidebar-overview-responsive[data-mode="sidebar"] {
        padding: 0;
      }

      .compact-toolbar {
        padding: 12px;
        border-bottom: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
      }

      .compact-search {
        width: 100%;
        padding: 6px 10px;
        margin-bottom: 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        font-size: 13px;
      }

      .compact-filters {
        display: flex;
        gap: 6px;
        margin-bottom: 8px;
      }

      .filter-chip {
        flex: 1;
        text-align: center;
        padding: 4px 8px;
        font-size: 11px;
        border-radius: 12px;
        background: var(--background-secondary);
        cursor: pointer;
        transition: all 0.2s;
      }

      .filter-chip:hover {
        background: var(--background-modifier-hover);
      }

      .filter-chip.active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        font-weight: 600;
      }

      .compact-stats {
        font-size: 11px;
        color: var(--text-muted);
        text-align: center;
      }

      .content-list-sidebar {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }

      /* ==================== 主界面三栏布局 ==================== */
      .main-layout-three-column {
        display: grid;
        grid-template-columns: 250px 1fr 280px;
        gap: 1px;
        height: 100%;
        background: var(--background-modifier-border);
      }

      .left-panel, .middle-panel, .right-panel {
        background: var(--background-primary);
        overflow-y: auto;
        padding: 16px;
      }

      .panel-title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 12px;
        color: var(--text-normal);
      }

      /* 左侧文件列表 */
      .file-list-main {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .file-item-main {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .file-item-main:hover {
        background: var(--background-modifier-hover);
      }

      .file-item-main.selected {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
      }

      .file-item-main .file-name {
        flex: 1;
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-item-main .count-badge {
        font-size: 11px;
        padding: 2px 6px;
        background: rgba(255,255,255,0.1);
        border-radius: 10px;
      }

      /* 中间预览区 */
      .preview-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--background-modifier-border);
      }

      .preview-header h3 {
        font-size: 16px;
        margin: 0;
      }

      .open-btn {
        padding: 4px 12px;
        font-size: 12px;
        border-radius: 4px;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        cursor: pointer;
      }

      .preview-content-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .empty-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-muted);
      }

      /* 右侧统计面板 */
      .stats-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        margin-bottom: 24px;
      }

      .stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px;
        background: var(--background-secondary);
        border-radius: 8px;
      }

      .stat-icon {
        font-size: 24px;
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--text-normal);
      }

      .stat-label {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 4px;
      }

      .section-title {
        font-size: 12px;
        font-weight: 600;
        margin: 16px 0 8px;
        color: var(--text-muted);
        text-transform: uppercase;
      }

      .recent-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .recent-item {
        padding: 8px;
        font-size: 12px;
        background: var(--background-secondary);
        border-radius: 4px;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: background 0.2s;
      }

      .recent-item:hover {
        background: var(--background-modifier-hover);
      }

      /* ==================== 内容卡片 ==================== */
      .file-group {
        margin-bottom: 16px;
      }

      .file-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        background: var(--background-secondary);
        border-radius: 6px;
        margin-bottom: 4px;
        font-weight: 600;
      }

      .file-header .file-name {
        flex: 1;
        font-size: 13px;
      }

      .content-card {
        display: flex;
        gap: 8px;
        padding: 10px;
        margin: 4px 0;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .content-card:hover {
        border-color: var(--interactive-accent);
        background: var(--background-primary-alt);
        transform: translateX(2px);
      }

      /* 紧凑卡片（侧边栏） */
      .content-card-compact {
        font-size: 12px;
      }

      .content-card-compact .card-indicator {
        width: 4px;
        border-radius: 2px;
        background: var(--background-modifier-border);
        flex-shrink: 0;
      }

      .card-indicator.has-annotation {
        background: linear-gradient(to bottom, #3b82f6 0%, #3b82f6 50%, transparent 50%);
      }

      .card-indicator.has-flashcard {
        background: linear-gradient(to bottom, transparent 0%, transparent 50%, #10b981 50%);
      }

      .card-indicator.has-annotation.has-flashcard {
        background: linear-gradient(to bottom, #3b82f6 0%, #3b82f6 50%, #10b981 50%);
      }

      .card-content {
        flex: 1;
        min-width: 0;
      }

      .line-label {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 4px;
        font-size: 11px;
        color: var(--text-muted);
      }

      .note-text {
        line-height: 1.4;
        color: var(--text-normal);
        margin-bottom: 4px;
      }

      .annotation-text {
        font-size: 11px;
        line-height: 1.3;
        color: var(--text-muted);
        padding: 4px 6px;
        background: var(--background-secondary);
        border-radius: 4px;
        margin-top: 6px;
      }

      .timestamp {
        font-size: 10px;
        color: var(--text-faint);
        margin-top: 4px;
      }

      .card-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        font-size: 11px;
      }
        .tag {
    padding: 2px 6px;
    background: var(--tag-background);
    color: var(--tag-color);
    border-radius: 4px;
    font-size: 10px;
  }

  .badge {
    padding: 2px 6px;
    background: var(--background-modifier-border);
    border-radius: 4px;
    font-size: 10px;
  }

  .empty-state {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .quick-annotation-textarea {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 8px;
    font-family: var(--font-interface);
    font-size: 13px;
    resize: vertical;
  }

  .modal-button-container {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 16px;
  }
`;
document.head.appendChild(styleEl);
  }}