// src/ui/SidebarOverviewView.ts - 重构后版本
import { StyleLoader } from './style/StyleLoader'

import { ItemView, WorkspaceLeaf, TFile, Menu, Notice, Modal, Setting, TextAreaComponent, ButtonComponent,App } from 'obsidian';
import type LearningSystemPlugin from '../main';
import { ContentUnit } from '../core/DataManager';
import { Flashcard } from '../core/FlashcardManager';

// 导入新的组件和状态管理
import { FilterMode, GroupMode, ViewState } from './state/ViewState';
import { Toolbar }  from './components/Toolbar';
import { BatchActions, BatchActionCallbacks } from './components/BatchActions';
import { ContentList } from './components/ContentList';
import { ContentCard, CardCallbacks } from './components/ContentCard';
import { AnnotationEditor, AnnotationEditorCallbacks } from './components/AnnotationEditor';

export const VIEW_TYPE_SIDEBAR_OVERVIEW = 'learning-system-sidebar-overview';
export const VIEW_TYPE_MAIN_OVERVIEW = 'learning-system-main-overview';

export class SidebarOverviewView extends ItemView {
  plugin: LearningSystemPlugin;
  
  // 使用状态管理器
  private state: ViewState;
  
  // 使用组件
  private toolbar: Toolbar;
  private batchActions: BatchActions;
  private contentList: ContentList;
  private annotationEditor: AnnotationEditor;
  

  private _forceMainMode: boolean;
  constructor(leaf: WorkspaceLeaf, plugin: LearningSystemPlugin, forceMainMode = false) {
    super(leaf);
    this.plugin = plugin;
    
    this._forceMainMode = forceMainMode;
    // 初始化状态
    this.state = new ViewState(forceMainMode);
    
    // 初始化组件
    this.initializeComponents();
    
    // 设置初始选中文件
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      this.state.selectedFile = activeFile.path;
    }
    
    // 监听窗口大小变化（防抖）
    this.setupResizeListener();
  }

  // ==================== 生命周期方法 ====================

  getViewType(): string {
    const forceMainMode = this._forceMainMode || false;
    return forceMainMode 
      ? VIEW_TYPE_MAIN_OVERVIEW 
      : VIEW_TYPE_SIDEBAR_OVERVIEW;
  }

  getDisplayText(): string {
    return 'Learning Overview';
  }

  getIcon(): string {
    return 'book-marked';
  }

  async onOpen() {
    this.detectDisplayMode();
    
    // 注册事件监听
    if (!this.state.forceMainMode) {
      this.registerActiveLeafChange();
    }
    
    this.render();
    StyleLoader.inject(); 
  }

  async onClose() {
    // 清理定时器
    if (this.state.searchDebounceTimer !== null) {
      window.clearTimeout(this.state.searchDebounceTimer);
    }
    
    // 关闭所有活动的编辑器
    this.annotationEditor.closeAll();
  }

  // ==================== 初始化方法 ====================

  private initializeComponents(): void {
    // 工具栏回调
    this.toolbar = new Toolbar(this.state, {
      onSearchChange: (query) => this.handleSearchChange(query),
      onFilterChange: (mode) => this.handleFilterChange(mode),
      onGroupChange: (mode) => this.handleGroupChange(mode)
    });
    
    
    // 批量操作回调
    const batchCallbacks: BatchActionCallbacks = {
      onSelectAll: () => this.handleSelectAll(),
      onDeselectAll: () => this.handleDeselectAll(),
      onBatchCreate: () => this.handleBatchCreate(),
      onBatchDelete: () => this.handleBatchDelete(),
      onCancel: () => this.handleBatchCancel()
    };
    this.batchActions = new BatchActions(this.state, batchCallbacks);
    
    // 卡片回调
    const cardCallbacks: CardCallbacks = {
      onJumpToSource: (unit) => this.jumpToSource(unit),
      onToggleAnnotation: (card, unit) => this.annotationEditor.toggle(card, unit),
      onQuickFlashcard: (unit) => this.quickGenerateFlashcard(unit),
      onShowContextMenu: (event, unit) => this.showContextMenu(event, unit),
      onFlashcardContextMenu: (event, card) => this.showFlashcardContextMenu(event, card),
      getAnnotationContent: (unitId) => {
        const ann = this.plugin.annotationManager.getContentAnnotation(unitId);
        return ann?.content;
      }
    };
    
    this.contentList = new ContentList(this.state, cardCallbacks);
    
    // 批注编辑器回调
    const annotationCallbacks: AnnotationEditorCallbacks = {
      onSave: async (unitId, content) => {
        await this.saveAnnotation(unitId, content);
      },
      onCancel: (unitId) => {
        // 取消编辑，不做任何操作
      },
      getAnnotationContent: (unitId) => {
        const ann = this.plugin.annotationManager.getContentAnnotation(unitId);
        return ann?.content;
      }
    };
    this.annotationEditor = new AnnotationEditor(annotationCallbacks);
  }

  private setupResizeListener(): void {
    let resizeTimer: number;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        this.detectDisplayMode();
        this.render();
      }, 150);
    });
  }

  private registerActiveLeafChange(): void {
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && this.state.displayMode === 'sidebar') {
          this.state.selectedFile = activeFile.path;
          this.refresh();
        }
      })
    );
  }

  // ==================== 显示模式检测 ====================

  private detectDisplayMode(): void {
    if (this.state.forceMainMode) {
      this.state.displayMode = 'main';
      return;
    }
    
    const parentSplit = (this.leaf as any).parentSplit;
    const isLeftSidebar = parentSplit?.type === 'split' && 
                          this.app.workspace.leftSplit === parentSplit;
    const isRightSidebar = parentSplit?.type === 'split' && 
                           this.app.workspace.rightSplit === parentSplit;
    
    const width = this.containerEl.clientWidth;
    const isNarrow = width < 500;
    
    const isSidebar = isLeftSidebar || isRightSidebar || isNarrow;
    this.state.displayMode = isSidebar ? 'sidebar' : 'main';
  }

  // ==================== 渲染方法 ====================

  refresh(): void {
    if (this.state.isRendering) {
      requestAnimationFrame(() => this.refresh());
      return;
    }
    
    if (this.state.searchDebounceTimer !== null) {
      window.clearTimeout(this.state.searchDebounceTimer);
      this.state.searchDebounceTimer = null;
    }
    
    this.state.shouldRestoreScroll = true;
    this.render();
  }

  private render(): void {
    if (this.state.isRendering) return;
    
    this.state.isRendering = true;
    
    const container = this.containerEl.children[1] as HTMLElement;
    
    // 保存滚动位置
    if (this.state.displayMode === 'sidebar') {
      const contentList = container.querySelector('.sidebar-content-list') as HTMLElement;
      if (contentList) {
        this.state.savedScrollPosition = contentList.scrollTop;
      }
    }
    
    // 清空容器
    container.empty();
    container.addClass('learning-overview-container');
    container.setAttribute('data-mode', this.state.displayMode);
    
    // 根据模式渲染
    if (this.state.displayMode === 'sidebar') {
      this.renderSidebarMode(container);
    } else {
      this.renderMainMode(container);
    }
    
    // 恢复滚动位置
    if (this.state.displayMode === 'sidebar' && this.state.shouldRestoreScroll) {
      const contentList = container.querySelector('.sidebar-content-list') as HTMLElement;
      if (contentList) {
        requestAnimationFrame(() => {
          contentList.scrollTop = this.state.savedScrollPosition;
        });
      }
    }
    
    this.state.isRendering = false;
  }

  private renderSidebarMode(container: HTMLElement): void {

    // 1. 渲染工具栏
    const toolbarEl = this.toolbar.renderSidebarToolbar(container);

    // 2. 创建统计行(如果 Toolbar 没有创建)
    let statsRow = toolbarEl.querySelector('.stats-row') as HTMLElement;

    if (!statsRow) {
      statsRow = toolbarEl.createDiv({ cls: 'stats-row' });
      statsRow.setAttribute('data-stats-container', 'true');
    }
    
    // 3. 获取可见项目
    const visibleItems = this.getVisibleItems();
    const items = this.state.viewType === 'cards' 
      ? (visibleItems.cards || []) 
      : (visibleItems.units || []);
    
    // 4. 渲染批量操作按钮
    this.batchActions.renderSelectAllButton(statsRow, items, 'sidebar');
    this.batchActions.renderActionButtons(statsRow, 'sidebar');
    
    // 5. 渲染内容列表
    const contentListEl = container.createDiv({ cls: 'sidebar-content-list' });
    const units = this.getFilteredUnits();
    this.contentList.renderCompactList(contentListEl, units);
  }

  private renderMainMode(container: HTMLElement): void {

    const layout = container.createDiv({ cls: 'main-layout' });

    // 左侧面板
    const leftPanel = layout.createDiv({ cls: 'left-panel' });
    this.renderLeftPanel(leftPanel);
    
    // 右侧面板
    const rightPanel = layout.createDiv({ cls: 'right-panel' });
    this.renderRightPanel(rightPanel);
  }

  private renderLeftPanel(container: HTMLElement): void {
    // 工具栏
    this.toolbar.renderMainToolbar(container);
    
    // 固定入口（All Notes, Card List）
    this.renderFixedEntries(container);
    
    // 文件列表
    this.renderFileList(container);
  }

  private renderRightPanel(container: HTMLElement): void {
    if (this.state.viewType === 'cards') {
      this.renderFlashcardsView(container);
      return;
    }
    
    // 自动选中第一个分组
    if (!this.state.selectedFile) {
      const units = this.getFilteredUnits();
      const grouped = this.contentList.groupUnits(units);
      if (grouped.length > 0) {
        this.state.selectedFile = grouped[0].groupKey;
      }
    }
    
    if (!this.state.selectedFile) {
      this.renderEmptyRightPanel(container);
      return;
    }
    
    // 渲染头部
    const header = container.createDiv({ cls: 'grid-header' });
    header.createEl('h2', { text: this.state.selectedFile || '内容' });
    
    const headerActions = header.createDiv({ cls: 'header-actions' });
    const visibleItems = this.getVisibleItems();
    const items = (visibleItems.units || []);
    
    this.batchActions.renderActionButtons(headerActions, 'header');
    this.batchActions.renderSelectAllButton(headerActions, items, 'header');
    
    // 渲染网格
    const gridContainer = container.createDiv({ cls: 'content-grid' });
    const filteredUnits = this.getFilteredUnitsForSelectedGroup();
    this.contentList.renderContentGrid(gridContainer, filteredUnits);
  }

  private renderFlashcardsView(container: HTMLElement): void {
    const flashcards = this.plugin.flashcardManager.getAllFlashcards();
    
    if (!this.state.selectedFile) {
      const grouped = this.contentList.groupFlashcards(
        flashcards,
        (id) => this.plugin.dataManager.getContentUnit(id)
      );
      if (grouped.length > 0) {
        this.state.selectedFile = grouped[0].groupKey;
      }
    }
    
    if (!this.state.selectedFile) {
      this.renderEmptyRightPanel(container);
      return;
    }
    
    // 渲染头部
    const header = container.createDiv({ cls: 'grid-header' });
    header.createEl('h2', { text: this.state.selectedFile || '闪卡' });
    
    const headerActions = header.createDiv({ cls: 'header-actions' });
    const visibleItems = this.getVisibleItems();
    const items = (visibleItems.cards || []);
    
    this.batchActions.renderActionButtons(headerActions, 'header');
    this.batchActions.renderSelectAllButton(headerActions, items, 'header');
    
    // 渲染闪卡网格
    const gridContainer = container.createDiv({ cls: 'content-grid' });
    const filteredCards = this.getFilteredCardsForSelectedGroup();
    this.contentList.renderFlashcardsGrid(gridContainer, filteredCards);
  }

  private renderFixedEntries(container: HTMLElement): void {
    const entries = container.createDiv({ cls: 'fixed-entries' });
    
    const allNotesBtn = entries.createDiv({
      cls: `entry-btn ${this.state.viewType === 'notes' ? 'active' : ''}`
    });
    allNotesBtn.innerHTML = '📝 <span>All Notes</span>';
    allNotesBtn.addEventListener('click', () => {
      if (this.state.setViewType('notes')) {
        this.render();
      }
    });
    
    const cardListBtn = entries.createDiv({
      cls: `entry-btn ${this.state.viewType === 'cards' ? 'active' : ''}`
    });
    cardListBtn.innerHTML = '🃏 <span>Card List</span>';
    cardListBtn.addEventListener('click', () => {
      if (this.state.setViewType('cards')) {
        this.render();
      }
    });
  }

  private renderFileList(container: HTMLElement): void {
    container.createEl('h3', { text: '📁 文档列表', cls: 'panel-title' });
    
    const fileListContainer = container.createDiv({ cls: 'file-list' });
    this.renderFileListContent(fileListContainer);
  }

  private renderFileListContent(container: HTMLElement): void {
    container.empty();
    
    let grouped: Array<{ groupKey: string; count: number }>;
    
    if (this.state.viewType === 'cards') {
      const flashcards = this.plugin.flashcardManager.getAllFlashcards();
      const cardGroups = this.contentList.groupFlashcards(
        flashcards,
        (id) => this.plugin.dataManager.getContentUnit(id)
      );
      grouped = cardGroups.map(g => ({ 
        groupKey: g.groupKey, 
        count: g.cards.length 
      }));
    } else {
      const units = this.getFilteredUnits();
      const unitGroups = this.contentList.groupUnits(units);
      grouped = unitGroups.map(g => ({ 
        groupKey: g.groupKey, 
        count: g.units.length 
      }));
    }
    
    if (grouped.length === 0) {
      container.createDiv({ text: '暂无文档', cls: 'empty-hint' });
      return;
    }
    
    if (!this.state.selectedFile && grouped.length > 0) {
      this.state.selectedFile = grouped[0].groupKey;
    }
    
    grouped.forEach(({ groupKey, count }) => {
      const fileItem = container.createDiv({
        cls: `file-item ${this.state.selectedFile === groupKey ? 'selected' : ''}`
      });
      
      fileItem.innerHTML = `
        <span class="file-icon">${this.getGroupIcon()}</span>
        <span class="file-name">${groupKey}</span>
        <span class="file-count">${count}</span>
      `;
      
      fileItem.addEventListener('click', () => {
        if (this.state.selectedFile !== groupKey) {
          this.state.selectedFile = groupKey;
          
          const allItems = container.querySelectorAll('.file-item');
          allItems.forEach(item => item.removeClass('selected'));
          fileItem.addClass('selected');
          
          this.refreshRightPanel();
        }
      });
    });
  }

  private renderEmptyRightPanel(container: HTMLElement): void {
    const empty = container.createDiv({ cls: 'empty-right-panel' });
    empty.innerHTML = `
      <div class="empty-icon">📭</div>
      <div class="empty-text">暂无内容</div>
    `;
  }

  // ==================== 事件处理方法 ====================

  private handleSearchChange(query: string): void {
    this.state.setSearchQuery(query);
    
    if (this.state.searchDebounceTimer !== null) {
      window.clearTimeout(this.state.searchDebounceTimer);
    }
    
    this.state.searchDebounceTimer = window.setTimeout(() => {
      this.state.clearSelection();
      this.refresh();
    }, 300);
  }

  private handleFilterChange(mode: typeof this.state.filterMode): void {
    if (this.state.setFilterMode(mode)) {
      this.state.shouldRestoreScroll = false;
      this.render();
    }
  }

  private handleGroupChange(mode: typeof this.state.groupMode): void {
    if (this.state.setGroupMode(mode)) {
      this.render();
    }
  }

  private handleSelectAll(): void {
    const visible = this.getVisibleItems();
    
    if (this.state.viewType === 'cards') {
      const cards = visible.cards || [];
      if (cards.length === 0) {
        new Notice('⚠️ 没有可选择的闪卡');
        return;
      }
      this.state.selectAllCards(cards);
    } else {
      const units = visible.units || [];
      if (units.length === 0) {
        new Notice('⚠️ 没有可选择的笔记');
        return;
      }
      this.state.selectAllUnits(units);
    }
    
    this.render();
  }

  private handleDeselectAll(): void {
    const visible = this.getVisibleItems();
    
    if (this.state.viewType === 'cards') {
      this.state.deselectAllCards(visible.cards || []);
    } else {
      this.state.deselectAllUnits(visible.units || []);
    }
    
    this.render();
  }

  private handleBatchCreate(): void {
    if (this.state.selectedUnitIds.size === 0) {
      new Notice('⚠️ 请先选择要创建闪卡的笔记');
      return;
    }
    
    // 调用批量创建逻辑
    this.batchCreateFlashcards();
  }

  private handleBatchDelete(): void {
    if (this.state.getSelectedCount() === 0) {
      new Notice('⚠️ 请先选择要删除的项目');
      return;
    }
    
    if (this.state.viewType === 'cards') {
      this.batchDeleteFlashcards();
    } else {
      this.batchDeleteNotes();
    }
  }

  private handleBatchCancel(): void {
    this.state.clearSelection();
    this.render();
  }

  // ==================== 数据获取方法 ====================

  private getFilteredUnits(): ContentUnit[] {
    let units = this.plugin.dataManager.getAllContentUnits();
    
    // 搜索过滤
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      units = units.filter(unit =>
        unit.content.toLowerCase().includes(query) ||
        unit.source.file.toLowerCase().includes(query) ||
        unit.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // 类型过滤
    if (this.state.filterMode === 'annotated') {
      units = units.filter(u => u.annotationId);
    } else if (this.state.filterMode === 'flashcards') {
      units = units.filter(u => u.flashcardIds.length > 0);
    }
    
    // 侧边栏模式：只显示当前文件的笔记
    if (this.state.displayMode === 'sidebar' && this.state.selectedFile) {
      units = units.filter(unit => unit.source.file === this.state.selectedFile);
    }
    
    return units;
  }

  private getFilteredUnitsForSelectedGroup(): ContentUnit[] {
    const units = this.getFilteredUnits();
    const selected = this.state.selectedFile;
  
    if (!selected) return [];
  
    return units.filter(unit => {
      if (this.state.groupMode === 'file') {
        return unit.source.file === selected;
  
      } else if (this.state.groupMode === 'annotation') {
        const hasAnnotation = selected === '有批注';
        return hasAnnotation ? !!unit.annotationId : !unit.annotationId;
  
      } else if (this.state.groupMode === 'tag') {
        return unit.metadata.tags.includes(selected);
  
      } else if (this.state.groupMode === 'date') {
        return (
          this.formatDate(new Date(unit.metadata.createdAt)) === selected
        );
      }
      return false;
    });
  }
  

  private getFilteredCardsForSelectedGroup(): Flashcard[] {
    const flashcards = this.plugin.flashcardManager.getAllFlashcards();
    const selected = this.state.selectedFile;
    if (!selected) return [];
    
    return flashcards.filter(card => {
      if (this.state.groupMode === 'file') {
        return card.sourceFile === this.state.selectedFile;
      } else if (this.state.groupMode === 'annotation') {
        const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
        const hasAnnotation = this.state.selectedFile === '有批注';
        return hasAnnotation ? (unit && !!unit.annotationId) : (!unit || !unit.annotationId);
      } else if (this.state.groupMode === 'tag') {
        const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
        return (unit && unit.metadata.tags.includes(selected)) ||
               (card.tags && card.tags.includes(selected)) ||
               (card.deck === this.state.selectedFile) ||
               (this.state.selectedFile === '未分类' && 
                (!card.tags || card.tags.length === 0) && 
                !card.deck &&
                (!unit || !unit.metadata.tags || unit.metadata.tags.length === 0));
      } else if (this.state.groupMode === 'date') {
        return this.formatDate(new Date(card.metadata.createdAt)) === this.state.selectedFile;
      }
      return false;
    });
  }

  private getVisibleItems(): { units?: ContentUnit[]; cards?: Flashcard[] } {
    if (this.state.viewType === 'cards') {
      const cards = this.getFilteredCardsForSelectedGroup();
      return { cards };
    } else {
      const units = this.state.displayMode === 'sidebar' 
        ? this.getFilteredUnits() 
        : this.getFilteredUnitsForSelectedGroup();
      return { units };
    }
  }

  // ==================== 业务逻辑方法 ====================

  private async jumpToSource(unit: ContentUnit): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(unit.source.file);
    if (!(file instanceof TFile)) {
      new Notice('⚠️ 文件不存在');
      return;
    }
    
    this.state.shouldRestoreScroll = true;
    
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    
    setTimeout(() => {
      const view = this.app.workspace.getActiveViewOfType(ItemView);
      if (view) {
        const editor = (view as any).editor;
        if (editor) {
          const line = unit.source.position.line;
          const lineCount = editor.lineCount();
          const validLine = Math.min(line, lineCount - 1);
          
          editor.setCursor({ line: validLine, ch: 0 });
          editor.scrollIntoView(
            { from: { line: validLine, ch: 0 }, to: { line: validLine, ch: 0 } },
            true
          );
          
          setTimeout(() => {
            try {
              const lineLength = editor.getLine(validLine)?.length || 0;
              editor.setSelection(
                { line: validLine, ch: 0 },
                { line: validLine, ch: lineLength }
              );
            } catch (e) {
              console.error('Selection error:', e);
            }
          }, 100);
        }
      }
    }, 200);
  }

  private async saveAnnotation(unitId: string, content: string): Promise<void> {
    const trimmedText = content.trim();
    const annotation = this.plugin.annotationManager.getContentAnnotation(unitId);
    
    if (trimmedText) {
      if (annotation) {
        await this.plugin.annotationManager.updateAnnotation(annotation.id, {
          content: trimmedText
        });
      } else {
        await this.plugin.annotationManager.addContentAnnotation(unitId, trimmedText);
      }
    } else if (annotation) {
      await this.plugin.annotationManager.deleteAnnotation(annotation.id);
      new Notice('🗑️ 批注已删除');
    }
  }

  private async quickGenerateFlashcard(unit: ContentUnit): Promise<void> {
    try {
      const { QuickFlashcardCreator } = await import('../core/QuickFlashcardCreator');
      const creator = new QuickFlashcardCreator(this.plugin);
      await creator.createSmartCard(unit);
      new Notice('⚡ 闪卡已生成');
      this.refresh();
    } catch (error) {
      new Notice('❌ 生成闪卡失败');
      console.error(error);
    }
  }

  private showContextMenu(event: MouseEvent, unit: ContentUnit): void {
    const menu = new Menu();
    
    // 跳转到原文
    menu.addItem((item) =>
      item
        .setTitle('📖 跳转到原文')
        .setIcon('arrow-up-right')
        .onClick(() => this.jumpToSource(unit))
    );
    
    // 编辑批注
    menu.addItem((item) =>
      item
        .setTitle('💬 编辑批注')
        .setIcon('message-square')
        .onClick(() => {
          const card = event.target as HTMLElement;
          const cardEl = card.closest('.compact-card, .grid-card') as HTMLElement;
          if (cardEl) {
            this.annotationEditor.toggle(cardEl, unit);
          }
        })
    );
    
    menu.addSeparator();
    
    // 编辑闪卡 (如果已有闪卡)//
    if (unit.flashcardIds.length > 0) {
      menu.addItem((item) =>
        item
          .setTitle('✏️ 编辑闪卡')
          .setIcon('pencil')
          .onClick(() => {
            const cardId = unit.flashcardIds[0];
            const card = this.plugin.flashcardManager.getFlashcard(cardId);
            if (card) {
              this.openEditFlashcardModal(card);
            } else {
              new Notice('⚠️ 找不到对应的闪卡');
            }
          })
      );
    }
    
    
    // 生成闪卡 (AI智能生成)
    menu.addItem((item) =>
      item
        .setTitle('⚡ 生成闪卡')
        .setIcon('zap')
        .onClick(() => this.quickGenerateFlashcard(unit))
    );
    
    // 创建 QA 闪卡
    menu.addItem((item) =>
      item
        .setTitle('➕ 创建 QA 闪卡')
        .setIcon('plus')
        .onClick(() => {
          this.openManualFlashcardModal(unit, 'qa');
        })
    );
    
    // 创建填空闪卡
    menu.addItem((item) =>
      item
        .setTitle('➕ 创建填空闪卡')
        .setIcon('plus')
        .onClick(() => {
          this.openManualFlashcardModal(unit, 'cloze');
        })
    );
    
    menu.addSeparator();
    
    // 查看统计
    menu.addItem((item) =>
      item
        .setTitle('📊 查看统计')
        .setIcon('bar-chart')
        .onClick(() => {
          this.plugin.activateStats();
        })
    );
    
    menu.addSeparator();
    
    // 删除笔记
    menu.addItem((item) =>
      item
        .setTitle('🗑️ 删除笔记')
        .setIcon('trash')
        .onClick(async () => {
          if (confirm('确定要删除这条笔记吗？')) {
            if (unit.flashcardIds.length > 0) {
              for (const cardId of unit.flashcardIds) {
                await this.plugin.flashcardManager.deleteCard(cardId);
              }
            }
            await this.plugin.dataManager.deleteContentUnit(unit.id);
            new Notice('🗑️ 笔记已删除');
            this.refresh();
          }
        })
    );
    
    menu.showAtMouseEvent(event);
  }
  
  private openManualFlashcardModal(unit: ContentUnit, type: 'qa' | 'cloze'): void {
    class ManualFlashcardModal extends Modal {
      unit: ContentUnit;
      type: 'qa' | 'cloze';
      plugin: LearningSystemPlugin;
      question: string = '';
      answer: string = '';
      
      constructor(app: App, plugin: LearningSystemPlugin, unit: ContentUnit, type: 'qa' | 'cloze') {
        super(app);
        this.plugin = plugin;
        this.unit = unit;
        this.type = type;
        
        // 根据类型设置默认值
        if (type === 'qa') {
          this.question = unit.type === 'QA' ? unit.content : unit.content;
          this.answer = unit.type === 'QA' && unit.answer ? unit.answer : '';
        } else {
          this.question = unit.fullContext || unit.content;
          this.answer = unit.content;
        }
      }
      
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('manual-flashcard-modal');
        
        contentEl.createEl('h2', { 
          text: this.type === 'qa' ? '✏️ 创建 QA 闪卡' : '✏️ 创建填空闪卡' 
        });
        
        contentEl.createEl('p', {
          text: this.type === 'qa' 
            ? '创建一张问答卡片，可以自定义问题和答案' 
            : '创建一张填空卡片，在完整文本中标记要挖空的内容',
          cls: 'modal-description'
        });
        
        // 问题/完整文本
        new Setting(contentEl)
          .setName(this.type === 'qa' ? '问题 (Front)' : '完整文本')
          .setDesc(this.type === 'qa' ? '卡片正面显示的问题' : '包含答案的完整句子或段落')
          .addTextArea((text: TextAreaComponent) => {
            text
              .setValue(this.question)
              .setPlaceholder(
                this.type === 'qa' 
                  ? '例如: 什么是间隔重复?' 
                  : '例如: 间隔重复是一种学习技术'
              )
              .onChange((value: string) => this.question = value);
            text.inputEl.rows = 4;
            text.inputEl.style.width = '100%';
          });
        
        // 答案/挖空内容
        new Setting(contentEl)
          .setName(this.type === 'qa' ? '答案 (Back)' : '挖空内容')
          .setDesc(this.type === 'qa' ? '卡片背面显示的答案' : '要被挖空的关键词或短语')
          .addTextArea((text: TextAreaComponent) => {
            text
              .setValue(this.answer)
              .setPlaceholder(
                this.type === 'qa' 
                  ? '例如: 间隔重复是一种学习技术...' 
                  : '例如: 间隔重复'
              )
              .onChange((value: string) => this.answer = value);
            text.inputEl.rows = 3;
            text.inputEl.style.width = '100%';
          });
        
        // 按钮组
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        
        new Setting(buttonContainer)
          .addButton((btn: ButtonComponent) => btn
            .setButtonText('取消')
            .onClick(() => this.close())
          )
          .addButton((btn: ButtonComponent) => btn
            .setButtonText('创建闪卡')
            .setCta()
            .onClick(async () => await this.createFlashcard())
          );
      }
      
      async createFlashcard() {
        // 验证输入
        if (!this.question.trim()) {
          new Notice('⚠️ 问题/文本不能为空');
          return;
        }
        if (!this.answer.trim()) {
          new Notice('⚠️ 答案不能为空');
          return;
        }
        
        try {
          // 使用 FlashcardManager 的 createFlashcardFromUnit 方法
          await this.plugin.flashcardManager.createFlashcardFromUnit(
            this.unit,
            {
              customQuestion: this.question.trim(),
              customAnswer: this.answer.trim(),
              cardType: this.type
            }
          );
          
          new Notice(
            this.type === 'qa' 
              ? '✅ QA 闪卡已创建' 
              : '✅ 填空闪卡已创建'
          );
          
          this.close();
          
          // 刷新视图
          const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_SIDEBAR_OVERVIEW)[0]?.view ||
                       this.app.workspace.getLeavesOfType(VIEW_TYPE_MAIN_OVERVIEW)[0]?.view;
          if (view && 'refresh' in view) {
            (view as any).refresh();
          }
          
        } catch (error) {
          new Notice('❌ 创建闪卡失败');
          console.error('Error creating flashcard:', error);
        }
      }
      
      onClose() {
        const { contentEl } = this;
        contentEl.empty();
      }
    }
    
    new ManualFlashcardModal(this.app, this.plugin, unit, type).open();
  }


  private showFlashcardContextMenu(event: MouseEvent, card: Flashcard): void {
    const menu = new Menu();
    
    // 跳转到原文
    menu.addItem((item) =>
      item
        .setTitle('📖 跳转到原文')
        .setIcon('arrow-up-right')
        .onClick(async () => {
          const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
          if (unit) {
            await this.jumpToSource(unit);
          } else {
            const file = this.app.vault.getAbstractFileByPath(card.sourceFile);
            if (file instanceof TFile) {
              await this.app.workspace.getLeaf(false).openFile(file);
              new Notice('✅ 已打开源文件');
            } else {
              new Notice('⚠️ 找不到原始笔记');
            }
          }
        })
    );
    
    // 编辑卡片
    menu.addItem((item) =>
      item
        .setTitle('✏️ 编辑卡片')
        .setIcon('pencil')
        .onClick(() => {
          this.openEditFlashcardModal(card);
        })
    );
    
    menu.addSeparator();
    
    // 查看统计
    menu.addItem((item) =>
      item
        .setTitle('📊 查看统计')
        .setIcon('bar-chart')
        .onClick(() => {
          const createdDate = new Date(card.metadata.createdAt).toLocaleString('zh-CN');
          const lastReview = card.stats.lastReview 
            ? new Date(card.stats.lastReview).toLocaleString('zh-CN')
            : '未复习';
          const nextReview = new Date(card.scheduling.due).toLocaleString('zh-CN');
          const accuracy = card.stats.totalReviews > 0 
            ? ((card.stats.correctCount / card.stats.totalReviews) * 100).toFixed(1)
            : '0';
          
          new Notice(
            `📊 闪卡统计\n` +
            `━━━━━━━━━━━━━━━\n` +
            `📁 文件: ${card.sourceFile.split('/').pop()}\n` +
            `🃏 类型: ${card.type === 'qa' ? 'Q&A' : '填空'}\n` +
            `📚 卡组: ${card.deck}\n` +
            `🏷️ 标签: ${card.tags?.length > 0 ? card.tags.join(', ') : '无'}\n` +
            `━━━━━━━━━━━━━━━\n` +
            `📈 复习次数: ${card.stats.totalReviews}\n` +
            `✅ 正确次数: ${card.stats.correctCount}\n` +
            `📊 正确率: ${accuracy}%\n` +
            `⏱️ 平均用时: ${card.stats.averageTime.toFixed(1)}秒\n` +
            `🎯 难度: ${(card.stats.difficulty * 100).toFixed(0)}%\n` +
            `━━━━━━━━━━━━━━━\n` +
            `📅 创建时间: ${createdDate}\n` +
            `🔄 上次复习: ${lastReview}\n` +
            `⏰ 下次复习: ${nextReview}\n` +
            `📏 间隔: ${card.scheduling.interval}天\n` +
            `💪 熟练度: ${card.scheduling.ease.toFixed(2)}`,
            10000
          );
        })
    );
    
    menu.addSeparator();
    
    // 删除卡片
    menu.addItem((item) =>
      item
        .setTitle('🗑️ 删除卡片')
        .setIcon('trash')
        .onClick(async () => {
          if (confirm('确定要删除这张闪卡吗？')) {
            await this.plugin.flashcardManager.deleteCard(card.id);
            new Notice('🗑️ 闪卡已删除');
            this.refresh();
          }
        })
    );
    
    menu.showAtMouseEvent(event);
  }
  
  private openEditFlashcardModal(card: Flashcard): void {
    class EditFlashcardModal extends Modal {
      card: Flashcard;
      plugin: LearningSystemPlugin;
      front: string;
      back: string;
      
      constructor(app: App, plugin: LearningSystemPlugin, card: Flashcard) {
        super(app);
        this.plugin = plugin;
        this.card = card;
        this.front = card.front;
        this.back = Array.isArray(card.back) ? card.back.join(', ') : card.back;
      }
      
      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('edit-flashcard-modal');
        
        contentEl.createEl('h2', { 
          text: '✏️ 编辑闪卡' 
        });
        
        contentEl.createEl('p', {
          text: `编辑 ${this.card.type === 'qa' ? 'Q&A' : '填空'}卡片内容`,
          cls: 'modal-description'
        });
        
        // 卡片信息
        const infoDiv = contentEl.createDiv({ cls: 'card-info' });
        infoDiv.innerHTML = `
          <div style="background: var(--background-secondary); padding: 10px; border-radius: 6px; margin-bottom: 15px;">
            <div style="font-size: 0.9em; color: var(--text-muted);">
              📁 ${this.card.sourceFile.split('/').pop()}<br>
              📚 卡组: ${this.card.deck}<br>
              📊 复习: ${this.card.stats.totalReviews}次 | 正确: ${this.card.stats.correctCount}次
            </div>
          </div>
        `;
        
        // 问题/前面
        new Setting(contentEl)
          .setName(this.card.type === 'qa' ? '问题 (Front)' : '完整文本')
          .setDesc('卡片正面显示的内容')
          .addTextArea((text: TextAreaComponent) => {
            text
              .setValue(this.front)
              .onChange((value: string) => this.front = value);
            text.inputEl.rows = 4;
            text.inputEl.style.width = '100%';
          });
        
        // 答案/后面
        new Setting(contentEl)
          .setName(this.card.type === 'qa' ? '答案 (Back)' : '挖空答案')
          .setDesc(this.card.type === 'qa' ? '卡片背面显示的答案' : '多个答案用逗号分隔')
          .addTextArea((text: TextAreaComponent) => {
            text
              .setValue(this.back)
              .onChange((value: string) => this.back = value);
            text.inputEl.rows = 3;
            text.inputEl.style.width = '100%';
          });
        
        // 按钮组
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        
        new Setting(buttonContainer)
          .addButton((btn: ButtonComponent) => btn
            .setButtonText('取消')
            .onClick(() => this.close())
          )
          .addButton((btn: ButtonComponent) => btn
            .setButtonText('保存')
            .setCta()
            .onClick(async () => await this.saveFlashcard())
          );
      }
      
      async saveFlashcard() {
        // 验证输入
        if (!this.front.trim()) {
          new Notice('⚠️ 问题/文本不能为空');
          return;
        }
        if (!this.back.trim()) {
          new Notice('⚠️ 答案不能为空');
          return;
        }
        
        try {
          // 更新卡片
          this.card.front = this.front.trim();
          
          if (this.card.type === 'cloze') {
            // 填空卡：将逗号分隔的答案转换为数组
            this.card.back = this.back.split(',').map(s => s.trim()).filter(s => s);
          } else {
            // 问答卡：保持字符串
            this.card.back = this.back.trim();
          }
          
          this.card.metadata.updatedAt = Date.now();
          
          await this.plugin.flashcardManager.updateCard(this.card);
          
          new Notice('✅ 闪卡已更新');
          this.close();
          
          // 刷新视图
          const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_SIDEBAR_OVERVIEW)[0]?.view ||
                       this.app.workspace.getLeavesOfType(VIEW_TYPE_MAIN_OVERVIEW)[0]?.view;
          if (view && 'refresh' in view) {
            (view as any).refresh();
          }
          
        } catch (error) {
          new Notice('❌ 保存失败');
          console.error('Error updating flashcard:', error);
        }
      }
      
      onClose() {
        const { contentEl } = this;
        contentEl.empty();
      }
    }
    
    new EditFlashcardModal(this.app, this.plugin, card).open();
  }

  private async batchCreateFlashcards(): Promise<void> {
    const units = Array.from(this.state.selectedUnitIds)
      .map(id => this.plugin.dataManager.getContentUnit(id))
      .filter(u => u !== undefined && u.flashcardIds.length === 0) as ContentUnit[];
    
    if (units.length === 0) {
      new Notice('⚠️ 选中的笔记都已创建过闪卡');
      return;
    }
    
    // 显示批量创建模态框
    const { BatchCreateModal } = await import('./OverviewView');
    const { QuickFlashcardCreator } = await import('../core/QuickFlashcardCreator');
    const quickCreator = new QuickFlashcardCreator(this.plugin);
    const modal = new BatchCreateModal(
      this.app,
      this.plugin,
      quickCreator,
      units,
      () => {
        this.state.clearSelection();
        this.refresh();
      }
    );
    modal.open();
  }

  private async batchDeleteNotes(): Promise<void> {
    if (!confirm(`确定要删除选中的 ${this.state.selectedUnitIds.size} 条笔记吗？`)) {
      return;
    }
    
    let success = 0;
    let failed = 0;
    
    for (const unitId of this.state.selectedUnitIds) {
      try {
        const unit = this.plugin.dataManager.getContentUnit(unitId);
        
        if (unit) {
          if (unit.flashcardIds.length > 0) {
            for (const cardId of unit.flashcardIds) {
              await this.plugin.flashcardManager.deleteCard(cardId);
            }
          }
        }
        
        await this.plugin.dataManager.deleteContentUnit(unitId);
        success++;
      } catch (error) {
        console.error('Error deleting note:', error);
        failed++;
      }
    }
    
    this.state.clearSelection();
    new Notice(`✅ 已删除 ${success} 条笔记${failed > 0 ? `，${failed} 条失败` : ''}`);
    this.refresh();
  }

  private async batchDeleteFlashcards(): Promise<void> {
    if (!confirm(`确定要删除选中的 ${this.state.selectedCardIds.size} 张闪卡吗？`)) {
      return;
    }
    
    let success = 0;
    let failed = 0;
    
    for (const cardId of this.state.selectedCardIds) {
      try {
        await this.plugin.flashcardManager.deleteCard(cardId);
        success++;
      } catch (error) {
        console.error('Error deleting flashcard:', error);
        failed++;
      }
    }
    
    this.state.clearSelection();
    new Notice(`✅ 已删除 ${success} 张闪卡${failed > 0 ? `，${failed} 张失败` : ''}`);
    this.refresh();
  }

  // ==================== 工具方法 ====================

  private refreshRightPanel(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    const rightPanel = container.querySelector('.right-panel') as HTMLElement;
    if (rightPanel) {
      rightPanel.empty();
      this.renderRightPanel(rightPanel);
    }
  }

  private getGroupIcon(): string {
    switch (this.state.groupMode) {
      case 'file': return '📄';
      case 'annotation': return '💬';
      case 'tag': return '🏷️';
      case 'date': return '📅';
      default: return '📁';
    }
  }

  private formatDate(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  
  }

  // ==================== 样式添加 ====================


}