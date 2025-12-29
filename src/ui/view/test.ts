// src/ui/SidebarOverviewView.ts - 重构后版本
import { StyleLoader } from '../style/sidebarStyle'

import { QuickFlashcardCreator } from '../../core/QuickFlashcardCreator';
import { ItemView, WorkspaceLeaf, TFile, Menu, Notice, Modal, Setting, TextAreaComponent, ButtonComponent,App, MarkdownView} from 'obsidian';
import type LearningSystemPlugin from '../../main';
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';

// 导入新的组件和状态管理
import { FilterMode, GroupMode, ViewState } from '../state/ViewState';
import { Toolbar }  from '../components/Toolbar';
import { BatchActions, BatchActionCallbacks } from '../components/BatchActions';
import { ContentList } from '../components/ContentList';
import { ContentCard, CardCallbacks } from '../components/ContentCard';
import { AnnotationEditor, AnnotationEditorCallbacks } from '../components/AnnotationEditor';
import { sideOverviewService } from '../service/sideOverviewService';
import { ManualFlashcardModal } from '../components/modals/ManualFlashcardModal';
import { EditFlashcardModal } from '../components/modals/EditFlashcardModal';
import { 
  ContextMenuBuilder, 
  ContentUnitMenuCallbacks, 
  FlashcardMenuCallbacks 
} from '../components/ContextMenuBuilder';


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
  private overviewService: sideOverviewService; 

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
    console.log('[OverviewView] Opening view...');
    this.detectDisplayMode();
    
    // 注册事件监听
    if (!this.state.forceMainMode) {
      this.registerActiveLeafChange();
    }
    
    // 先渲染界面
    this.render();
    StyleLoader.inject();
    
    // 界面渲染后再检查复习提醒
    await new Promise(resolve => setTimeout(resolve, 100));
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
    this.overviewService = new sideOverviewService(this.plugin, this.state);
    // 工具栏回调
    this.toolbar = new Toolbar(this.state, {
      onSearchChange: (query) => this.handleSearchChange(query),
      onFilterChange: (mode) => this.handleFilterChange(mode),
      onGroupChange: (mode) => this.handleGroupChange(mode),
      onCheckReview: () => this.checkReviewReminder()
    });
    
    
    // 批量操作回调
    const batchCallbacks: BatchActionCallbacks = {
      onSelectAll: () => this.handleSelectAll(),
      onDeselectAll: () => this.handleDeselectAll(),
      onBatchCreate: () => this.handleBatchCreate(),
      onBatchDelete: () => this.handleBatchDelete(),
      onCancel: () => this.handleBatchCancel()
    };
    this.batchActions = new BatchActions(this.state, batchCallbacks,this.toolbar);
    
    // 卡片回调
    const cardCallbacks: CardCallbacks = {
      onJumpToSource: (unit) => this.jumpToSource(unit),
      onJumpToFlashcard: (card) => this.jumpToFlashcardSource(card), 
      onToggleAnnotation: (card, unit) => this.annotationEditor.toggle(card, unit),
      onQuickFlashcard: (unit) => this.quickGenerateFlashcard(unit),
      onShowContextMenu: (event, unit) => this.showContextMenu(event, unit),
      onFlashcardContextMenu: (event, card) => this.showFlashcardContextMenu(event, card),
      getAnnotationContent: (unitId) => {
        const ann = this.plugin.annotationManager.getContentAnnotation(unitId);
        return ann?.content;
      },
      getContentUnit: (unitId) => {
        const allUnits = this.plugin.dataManager.getAllContentUnits();
        
        
        if (allUnits.length > 0) {
          allUnits.slice(0, 10).forEach(u => {
          });
        }
        
        // 尝试直接获取
        const unit = this.plugin.dataManager.getContentUnit(unitId);
        
        if (unit) {
          return unit;
        } else {
          
          const allFlashcards = this.plugin.flashcardManager.getAllFlashcards();
          
          // 找出问题：这个 flashcard 的 sourceContentId 对应的 unit 是否存在
          const matchingUnit = allUnits.find(u => u.id === unitId);
          if (!matchingUnit) {
          }
          
          return undefined;
        }
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

// src/ui/SidebarOverviewView.ts

private renderSidebarMode(container: HTMLElement): void {
  // 1. 渲染工具栏
  const toolbarEl = this.toolbar.renderSidebarToolbar(container);

  // 2. 创建统计行
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
  
  // 4. 创建左侧容器(全选按钮)
  const leftActions = statsRow.createDiv({ cls: 'stats-left' });
  this.batchActions.renderSelectAllButton(leftActions, items, 'sidebar');
  
  // 5. 创建中间容器(批量操作按钮)
  const centerActions = statsRow.createDiv({ cls: 'stats-center' });
  this.batchActions.renderActionButtons(centerActions, 'sidebar');
  
  // 6. 创建右侧容器(复习检查按钮)
  const rightActions = statsRow.createDiv({ cls: 'stats-right' });
  this.batchActions.renderReviewCheckButton(rightActions, 'sidebar');
  
  // 7. 创建内容列表容器
  const contentListEl = container.createDiv({ cls: 'sidebar-content-list' });
  
  // 8. 先渲染内容
  const units = this.getFilteredUnits();
  this.contentList.renderCompactList(contentListEl, units);
  
  // 9. ⭐ 渲染完成后,将提醒插入到最前面
  this.insertReviewReminderAtTop(contentListEl);
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
  await this.overviewService.jumpToSource(unit, this.app);
}

private async jumpToFlashcardSource(card: Flashcard): Promise<void> {
  try {
    // 首先尝试通过 ContentUnit 跳转
    const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
    
    if (unit) {
      await this.jumpToSource(unit);
      return;
    }
    const file = this.app.vault.getAbstractFileByPath(card.sourceFile);
    if (!(file instanceof TFile)) {
      new Notice('❌ 源文件不存在');
      return;
    }
    
    // 打开文件
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    
    // 如果有 anchorLink，尝试跳转到具体位置
    if (card.anchorLink) {
      // 从 anchorLink 提取 blockId
      // 格式: [[filename#^block-id]]
      const blockIdMatch = card.anchorLink.match(/\^\S+/);
      if (blockIdMatch) {
        const blockId = blockIdMatch[0].substring(1); // 移除 ^
        
        // 等待编辑器加载
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 正确获取 MarkdownView
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.editor) {
          const editor = view.editor;
          const content = editor.getValue();
          const lines = content.split('\n');
          
          // 查找 block ID
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`^${blockId}`)) {
              editor.setCursor({ line: i, ch: 0 });
              editor.scrollIntoView({ from: { line: i, ch: 0 }, to: { line: i, ch: 0 } }, true);
              break;
            }
          }
        }
      }
    }
    
    new Notice('✅ 已跳转到源文件');
  } catch (error) {
    console.error('Error jumping to flashcard source:', error);
    new Notice('❌ 跳转失败');
  }
}

private async saveAnnotation(unitId: string, content: string): Promise<void> {
  await this.overviewService.saveAnnotation(unitId, content);
}

private async quickGenerateFlashcard(unit: ContentUnit): Promise<void> {
  await this.overviewService.quickGenerateFlashcard(unit);
  
  // 刷新 UI
  requestAnimationFrame(() => {
    this.refresh();
  });
}
  // ==================== 右键菜单 ====================
private showContextMenu(event: MouseEvent, unit: ContentUnit): void {
  const callbacks: ContentUnitMenuCallbacks = {
    onJumpToSource: (unit) => this.jumpToSource(unit),
    
    onToggleAnnotation: (unit) => {
      const card = event.target as HTMLElement;
      const cardEl = card.closest('.compact-card, .grid-card') as HTMLElement;
      if (cardEl) {
        this.annotationEditor.toggle(cardEl, unit);
      }
    },
    
    onEditFlashcard: (unit) => {
      const cardId = unit.flashcardIds[0];
      const card = this.plugin.flashcardManager.getFlashcard(cardId);
      if (card) {
        new EditFlashcardModal(this.app, this.plugin, card).open();
      } else {
        new Notice('⚠️ 找不到对应的闪卡');
      }
    },
    
    onQuickGenerate: (unit) => this.quickGenerateFlashcard(unit),
    
    onCreateQA: (unit) => {
      new ManualFlashcardModal(this.app, this.plugin, unit, 'qa').open();
    },
    
    onCreateCloze: (unit) => {
      new ManualFlashcardModal(this.app, this.plugin, unit, 'cloze').open();
    },
    
    onViewStats: () => {
      this.plugin.activateStats();
    },
    
    onDelete: async (unit) => {
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
    }
  };
  
  const menu = ContextMenuBuilder.buildContentUnitMenu(unit, callbacks);
  menu.showAtMouseEvent(event);
}
  
  private openManualFlashcardModal(unit: ContentUnit, type: 'qa' | 'cloze'): void {

    
    new ManualFlashcardModal(this.app, this.plugin, unit, type).open();
  }


  private showFlashcardContextMenu(event: MouseEvent, card: Flashcard): void {
    const callbacks: FlashcardMenuCallbacks = {
      onJumpToSource: async (card) => {
        await this.overviewService.jumpToFlashcardSource(card.id, this.app);
      },
      
      onEdit: (card) => {
        new EditFlashcardModal(this.app, this.plugin, card).open();
      },
      
      onViewStats: (card) => {
        const statsText = ContextMenuBuilder.formatFlashcardStats(card);
        new Notice(statsText, 10000);
      },
      
      onDelete: async (card) => {
        if (confirm('确定要删除这张闪卡吗？')) {
          await this.plugin.flashcardManager.deleteCard(card.id);
          new Notice('🗑️ 闪卡已删除');
          this.refresh();
        }
      }
    };
    
    const menu = ContextMenuBuilder.buildFlashcardMenu(card, callbacks);
    menu.showAtMouseEvent(event);
  }
  

  private openEditFlashcardModal(card: Flashcard): void {
    
    new EditFlashcardModal(this.app, this.plugin, card).open();
  }
    // ==================== 批量操作 ====================

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
    const { QuickFlashcardCreator } = await import('../../core/QuickFlashcardCreator');
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
    
    const { success, failed } = await this.overviewService.batchDeleteNotes(
      this.state.selectedUnitIds
    );
    
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

  // ==================== 复习检查 ====================
// 每日提醒复习
// 手动触发复习提醒检查
public checkReviewReminder(): void {
  console.log('[Review Check] Manual check triggered');
  
  const dueCards = this.getDueFlashcards();
  console.log('[Review Check] Found due cards:', dueCards.length);
  
  if (dueCards.length === 0) {
    new Notice('✅ 目前没有需要复习的卡片');
    return;
  }
  
  // 检查当前提醒是否已忽略
  const dismissed = localStorage.getItem('learning-system-reminder-dismissed');
  const isCurrentlyDismissed = dismissed === new Date().toDateString();
  
  if (isCurrentlyDismissed) {
    // 当前已忽略 -> 清除忽略状态,显示提醒
    console.log('[Review Check] Showing reminder');
    localStorage.removeItem('learning-system-reminder-dismissed');
  } else {
    // 当前显示中 -> 忽略提醒,隐藏
    console.log('[Review Check] Hiding reminder');
    this.markReminderDismissed();
  }
    
  // 重新渲染
  this.refresh();
  
  // 如果是显示提醒,滚动到顶部
  if (isCurrentlyDismissed) {
    requestAnimationFrame(() => {
      const contentList = this.containerEl.querySelector('.sidebar-content-list') as HTMLElement;
      if (contentList) {
        contentList.scrollTop = 0;
      }
    });
  }
}
private renderReviewReminderIfNeeded(container: HTMLElement): void {
  // 如果今天已经忽略过提醒,就不再显示
  if (this.isReminderDismissedToday()) {
    console.log('[Review Check] Reminder already dismissed today');
    return;
  }
  
  const dueCards = this.getDueFlashcards();
  console.log('[Review Check] Found due cards:', dueCards.length);
  
  if (dueCards.length > 0) {
    console.log('[Review Check] Showing reminder for', dueCards.length, 'cards');
    this.renderReviewBanner(container, dueCards.length);
  }
}
private renderReviewBanner(container: HTMLElement, count: number): void {
  console.log('[Review Check] Creating reminder banner...');
  
  // 创建紧凑的提醒横幅
  const banner = container.createDiv({ cls: 'content-list-review-reminder' });
  
  const header = banner.createDiv({ cls: 'reminder-header' });
  header.createSpan({ text: '📚', cls: 'reminder-icon' });
  
  const textContent = header.createDiv({ cls: 'reminder-text' });
  textContent.createEl('strong', { text: `${count} 张卡片待复习` });
    // 计算最紧急的卡片
    const dueCards = this.getDueFlashcards();
    const mostUrgent = dueCards.reduce((earliest, card) => 
      card.scheduling.due < earliest ? card.scheduling.due : earliest
    , Date.now());
    
    const hoursSinceDue = Math.floor((Date.now() - mostUrgent) / (1000 * 60 * 60));
    
    if (hoursSinceDue > 0) {
      textContent.createEl('span', { 
        text: `已过期 ${hoursSinceDue} 小时 ⏰`, 
        cls: 'reminder-urgent' 
      });
    }

  textContent.createEl('span', { text: '保持每日复习习惯 💪', cls: 'reminder-hint' });
    // ⭐ 添加进度条（可选）
    const allCards = this.plugin.flashcardManager.getAllFlashcards().length;
    if (allCards > 0) {
      const progress = banner.createDiv({ cls: 'reminder-progress' });
      const percentage = Math.round((count / allCards) * 100);
      progress.innerHTML = `
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${percentage}%"></div>
        </div>
        <span class="progress-text">${percentage}% 需要复习</span>
      `;
    }

  const actions = banner.createDiv({ cls: 'reminder-actions' });
  
  const reviewBtn = actions.createEl('button', {
    text: '开始复习',
    cls: 'reminder-btn primary'
  });
  reviewBtn.addEventListener('click', () => {
    this.startReview();
    banner.remove();
  });
  
  const dismissBtn = actions.createEl('button', {
    text: '✕',
    cls: 'reminder-btn dismiss',
    attr: { 'aria-label': '稍后提醒' }
  });
  dismissBtn.addEventListener('click', () => {
    banner.remove();
    this.markReminderDismissed();
  });
  
  console.log('[Review Check] Reminder banner created');
}



private getDueFlashcards() {
  const allCards = this.plugin.flashcardManager.getAllFlashcards();
  const now = Date.now();
  
  console.log('[Review Check] Total cards:', allCards.length);
  console.log('[Review Check] Current time:', now, new Date(now));
  
  const dueCards = allCards.filter(card => {
    const isDue = card.scheduling.due <= now;
    if (isDue) {
      console.log('[Review Check] Due card:', card.id, 'due:', new Date(card.scheduling.due));
    }
    return isDue;
  });
  
  return dueCards;
}


private startReview() {
  // 激活复习视图
  this.plugin.activateReview();
}

private markReminderDismissed() {
  // 保存今天已忽略的状态(可选功能)
  const today = new Date().toDateString();
  localStorage.setItem('learning-system-reminder-dismissed', today);
}

private isReminderDismissedToday(): boolean {
  const today = new Date().toDateString();
  const dismissed = localStorage.getItem('learning-system-reminder-dismissed');
  return dismissed === today;
}
private insertReviewReminderAtTop(container: HTMLElement): void {
  // 如果今天已经忽略过提醒,就不再显示
  if (this.isReminderDismissedToday()) {
    console.log('[Review Check] Reminder already dismissed today');
    return;
  }
  
  const dueCards = this.getDueFlashcards();
  console.log('[Review Check] Found due cards:', dueCards.length);
  
  if (dueCards.length > 0) {
    console.log('[Review Check] Showing reminder for', dueCards.length, 'cards');
    
    // 创建横幅
    const banner = this.createReviewBanner(dueCards.length);
    
    // ⭐ 插入到容器最前面
    if (container.firstChild) {
      container.insertBefore(banner, container.firstChild);
    } else {
      container.appendChild(banner);
    }
  }
}

private createReviewBanner(count: number): HTMLElement {
console.log('[Review Check] Creating reminder banner...');

// 创建临时容器用于构建元素
const tempDiv = document.createElement('div');
const banner = tempDiv.createDiv({ cls: 'content-list-review-reminder' });

const header = banner.createDiv({ cls: 'reminder-header' });
header.createSpan({ text: '', cls: 'reminder-icon' });

const textContent = header.createDiv({ cls: 'reminder-text' });
textContent.createEl('strong', { text: `📚${count} 张卡片待复习` });
textContent.createEl('span', { text: '保持每日复习习惯 💪', cls: 'reminder-hint' });

const actions = banner.createDiv({ cls: 'reminder-actions' });

const reviewBtn = actions.createEl('button', {
  text: '开始复习',
  cls: 'reminder-btn primary'
});
reviewBtn.addEventListener('click', () => {
  this.startReview();
  banner.remove();
});



console.log('[Review Check] Reminder banner created');
return banner;
}

}