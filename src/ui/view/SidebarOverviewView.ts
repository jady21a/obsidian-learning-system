// src/ui/SidebarOverviewView.ts - 重构后版本
import { StyleLoader } from '../style/sidebarStyle'
import { reviewStyle } from '../style/reviewStyle';
import { t } from '../../i18n/translations';

import { QuickFlashcardCreator } from '../../core/QuickFlashcardCreator';
import { ItemView, WorkspaceLeaf, TFile, Menu, Notice, Modal, Setting, TextAreaComponent, ButtonComponent,App, MarkdownView} from 'obsidian';
import type LearningSystemPlugin from '../../main';
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';

// 导入新的组件和状态管理
import { FilterMode, GroupMode, ViewState } from '../stats/ViewState';
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
import { BatchCreateModal } from '../components/modals/BatchCreateModal';
import { LevelInfoModal ,UnlockProgress} from '../../core/UnlockSystem'


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

  private isOpeningEditor: boolean = false;
  private savingAnnotations: Set<string> = new Set();

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
        
        const editor = document.querySelector('.cm-editor');
        if (editor) {
          const stopEditorCapture = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.closest('.learning-overview-container')) {
              e.stopPropagation();
              e.stopImmediatePropagation();
            }
          };
          
          editor.addEventListener('mousedown', stopEditorCapture, true);
          editor.addEventListener('click', stopEditorCapture, true);
        }
    // 禁用编辑器自动聚焦
    const editorContainer = document.querySelector('.cm-content');
    if (editorContainer) {
      (editorContainer as HTMLElement).style.pointerEvents = 'auto';
      editorContainer.addEventListener('mousedown', (e) => {
        // 如果点击的是搜索框区域，不让编辑器处理
        const searchBox = document.querySelector('.search-container');
        if (searchBox && searchBox.contains(e.target as Node)) {
          e.stopPropagation();
          e.preventDefault();
        }
      }, true);
    }
    
    // 确保侧边栏模式下设置当前活动文件
    if (this.state.displayMode === 'sidebar') {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile) {
        this.state.selectedFile = activeFile.path;
      }
    }
    
    // 注册事件监听
    if (!this.state.forceMainMode) {
      this.registerActiveLeafChange();
    }
    
    this.state.updateDueCount(this.plugin.flashcardManager);
    
    // 先渲染界面
    this.render();
    StyleLoader.inject();
    reviewStyle.inject();
    
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
      onCheckReview: () => this.checkReviewReminder(),

      checkFilterHasNotes: (mode) => this.checkFilterHasNotes(mode),
      checkGroupHasNotes: (mode) => this.checkGroupHasNotes(mode)
    }, this.plugin.settings.language); 
    
    
    // 批量操作回调
    const batchCallbacks: BatchActionCallbacks = {
      onSelectAll: () => this.handleSelectAll(),
      onDeselectAll: () => this.handleDeselectAll(),
      onBatchCreate: () => this.handleBatchCreate(),
      onBatchDelete: () => this.handleBatchDelete(),
      onCancel: () => this.handleBatchCancel()
    };
    this.batchActions = new BatchActions(this.state, batchCallbacks,this.toolbar,  this.plugin.settings.language);
    
    // 卡片回调
    const cardCallbacks: CardCallbacks = {
      onJumpToSource: (unit) => this.jumpToSource(unit),
      onJumpToFlashcard: (card) => this.jumpToFlashcardSource(card), 
      onToggleAnnotation: (card, unit) => {
        // 🎯 Lv2 权限检查
        if (!this.plugin.unlockSystem.tryUseFeature('annotation', 'Annotation')) {
          return;
        }
        
        // ⭐ 设置锁
        this.isOpeningEditor = true;
        
        this.annotationEditor.toggle(card, unit);
        
        setTimeout(() => {
          this.isOpeningEditor = false;
        }, 500); 
      },
      onQuickFlashcard: (unit) => this.quickGenerateFlashcard(unit),
      onShowContextMenu: (event, unit) => this.showContextMenu(event, unit),
      onFlashcardContextMenu: (event, card) => this.showFlashcardContextMenu(event, card),
      getAnnotationContent: (unitId) => {
        const ann = this.plugin.annotationManager.getContentAnnotation(unitId);
        return ann?.content;
      },
      getContentUnit: (unitId) => {
        const allUnits = this.plugin.dataManager.getAllContentUnits();
        const unit = this.plugin.dataManager.getContentUnit(unitId);
        
        if (unit) {
          return unit;
        } else {
          return undefined;
        }
      }
    };
    
    this.contentList = new ContentList(this.state, cardCallbacks);
    
// 批注编辑器回调
const annotationCallbacks: AnnotationEditorCallbacks = {
  onSave: async (unitId, content) => {
   
    // ⭐ 防重复：如果正在保存，直接返回
    if (this.savingAnnotations.has(unitId)) {
      return;
    }
    
    // ⭐ 标记为正在保存
    this.savingAnnotations.add(unitId);
    
    try {
     
      
      await this.saveAnnotation(unitId, content);
      requestAnimationFrame(() => {
        this.refresh();
      });
    } finally {
      setTimeout(() => {
        this.savingAnnotations.delete(unitId);
      }, 100);
    }
    
  },
  
  onCancel: (unitId) => {
    this.savingAnnotations.delete(unitId);
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
    this.registerEvent(
      this.app.workspace.on('file-open', (file) => {
        if (file && this.state.displayMode === 'sidebar') {
          this.state.selectedFile = file.path;
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
  
  const hasActiveEditors = document.querySelector('.inline-annotation-editor') !== null;
  if (hasActiveEditors || this.isOpeningEditor) {
    return;
  }
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
  const currentFileUnits = this.getFilteredUnits(); 
  const items = this.state.viewType === 'cards' 
    ? this.getFilteredCardsForCurrentFile() 
    : currentFileUnits;
  
  
  // 4. 创建左侧容器(全选按钮)
  const leftActions = statsRow.createDiv({ cls: 'stats-left' });
  this.batchActions.renderSelectAllButton(leftActions, items, 'sidebar');
  
  // 5. 创建中间容器(批量操作按钮)
  const centerActions = statsRow.createDiv({ cls: 'stats-center' });
  this.batchActions.renderActionButtons(centerActions, 'sidebar');
  
// 显示等级徽章（Lv1-Lv4 始终显示，Lv5 显示30分钟后隐藏）
const progress = this.plugin.unlockSystem.getProgress();
const shouldShowFullBadge = this.shouldShowFullLevelBadge(progress);

if (shouldShowFullBadge) {
  const levelBadge = container.createDiv({ cls: 'level-badge' });

  const levelName = this.t(`level.${progress.currentLevel}`);

  levelBadge.textContent = `Lv${progress.currentLevel}:  ${levelName}`;
  levelBadge.style.fontSize = '1em';

  const progressText = container.createDiv({ cls: 'progress-text' });
  progressText.innerHTML = this.plugin.unlockSystem.getNextStepsForLevel(progress.currentLevel).replace(/\n/g, '<br>');
  progressText.style.fontSize = '0.93em';
  
  // 添加第一条分隔线
  const divider = container.createDiv({ cls: 'level-divider' });
  divider.style.width = 'calc(100% - 24px)';
  divider.style.height = '1px';
  divider.style.backgroundColor = 'var(--background-modifier-border)';
  divider.style.margin = '12px auto';
}

// 6. 创建右侧容器(等级徽章 + 复习检查按钮)
const rightActions = statsRow.createDiv({ cls: 'stats-right' });

// ⭐ Lv5 且30分钟后显示小徽章（复用上面的 progress 变量）
if (!shouldShowFullBadge && progress.currentLevel === 5) {
  this.renderLevelBadge(rightActions, progress);
}

this.batchActions.renderReviewCheckButton(rightActions, 'sidebar');
  
  // 7. 创建内容列表容器
  const contentListEl = container.createDiv({ cls: 'sidebar-content-list' });
  
  // 8. 先渲染内容
  this.contentList.renderCompactList(contentListEl, currentFileUnits);

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
    allNotesBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (this.state.setViewType('notes')) {
        this.render();
      }
    });
    
    const cardListBtn = entries.createDiv({
      cls: `entry-btn ${this.state.viewType === 'cards' ? 'active' : ''}`
    });
    cardListBtn.innerHTML = '🃏 <span>Card List</span>';
    cardListBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (this.state.setViewType('cards')) {
        this.render();
      }
    });
  }

  private renderFileList(container: HTMLElement): void {
    container.createEl('h3', { text: this.t('fileList.title'), cls: 'panel-title' });

    const fileListContainer = container.createDiv({ cls: 'file-list' });
    this.renderFileListContent(fileListContainer);
  }

  private renderFileListContent(container: HTMLElement): void {
    container.empty();
    
    let grouped: Array<{ groupKey: string; count: number }>;
    
    if (this.state.viewType === 'cards') {
      const flashcards = this.plugin.flashcardManager.getAllFlashcards();
      
      // ⭐ 按批注分组时的特殊处理
      if (this.state.groupMode === 'annotation') {
        const annotatedCards: Flashcard[] = [];
        const unannotatedCards: Flashcard[] = [];
        
        // 分类闪卡：有批注 vs 无批注
        flashcards.forEach(card => {
          const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
          if (unit && unit.annotationId) {
            annotatedCards.push(card);
          } else {
            unannotatedCards.push(card);
          }
        });
        
        // 按文件分组有批注的闪卡
        const fileGroups = new Map<string, Flashcard[]>();
        annotatedCards.forEach(card => {
          const fileName = card.sourceFile;
          if (!fileGroups.has(fileName)) {
            fileGroups.set(fileName, []);
          }
          fileGroups.get(fileName)!.push(card);
        });
        
        // 构建分组列表
        grouped = [];
        
        // 添加各个文件的有批注闪卡
        fileGroups.forEach((cards, fileName) => {
          grouped.push({
            groupKey: fileName,
            count: cards.length
          });
        });
        
        // 添加"无批注"分组（如果有无批注的闪卡）
        if (unannotatedCards.length > 0) {
          grouped.push({
            groupKey: 'filter.unannotated',
            count: unannotatedCards.length
          });
        }
      } else {
        // 其他分组模式
        const cardGroups = this.contentList.groupFlashcards(
          flashcards,
          (id) => this.plugin.dataManager.getContentUnit(id)
        );
        grouped = cardGroups.map(g => ({ 
          groupKey: g.groupKey, 
          count: g.cards.length 
        }));
      }
    } else {
      // Notes 视图
      const units = this.getFilteredUnits();
      
      // ⭐ 按批注分组时的特殊处理
      if (this.state.groupMode === 'annotation') {
        const annotatedUnits = units.filter(u => u.annotationId);
        const unannotatedUnits = units.filter(u => !u.annotationId);
        
        // 按文件分组有批注的笔记
        const fileGroups = new Map<string, ContentUnit[]>();
        annotatedUnits.forEach(unit => {
          const fileName = unit.source.file;
          if (!fileGroups.has(fileName)) {
            fileGroups.set(fileName, []);
          }
          fileGroups.get(fileName)!.push(unit);
        });
        
        // 构建分组列表
        grouped = [];
        
        // 添加各个文件的有批注笔记
        fileGroups.forEach((units, fileName) => {
          grouped.push({
            groupKey: fileName,
            count: units.length
          });
        });
        
        // 添加"无批注"分组（如果有无批注的笔记）
        if (unannotatedUnits.length > 0) {
          grouped.push({
            groupKey: 'filter.unannotated',
            count: unannotatedUnits.length
          });
        }
      } else {
        // 其他分组模式
        const unitGroups = this.contentList.groupUnits(units);
        grouped = unitGroups.map(g => ({ 
          groupKey: g.groupKey, 
          count: g.units.length 
        }));
      }
    }
    
    if (grouped.length === 0) {
      container.createDiv({ text: this.t('empty.noDocuments'), cls: 'empty-hint' });
      return;
    }
    
    if (!this.state.selectedFile && grouped.length > 0) {
      this.state.selectedFile = grouped[0].groupKey;
    }
    
    grouped.forEach(({ groupKey, count }) => {
      const fileItem = container.createDiv({
        cls: `file-item ${this.state.selectedFile === groupKey ? 'selected' : ''}`
      });
      
      // ⭐ 特殊显示"无批注"分组
      const displayName = groupKey === 'filter.unannotated' 
        ? this.t('filter.unannotated')
        : groupKey;
      
      fileItem.innerHTML = `
        <span class="file-icon">${this.getGroupIcon()}</span>
        <span class="file-name">${displayName}</span>
        <span class="file-count">${count}</span>
      `;
      
      fileItem.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (this.state.selectedFile !== groupKey) {
          this.annotationEditor.closeAll();
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
      <div class="empty-text">${this.t('empty.noContent')}</div>
    `;
  }

  // ==================== 事件处理方法 ====================

private handleSearchChange(query: string): void {
  this.state.setSearchQuery(query);
  
  if (this.state.searchDebounceTimer !== null) {
    window.clearTimeout(this.state.searchDebounceTimer);
  }
  
  this.state.searchDebounceTimer = window.setTimeout(() => {
    const hasActiveEditors = document.querySelector('.inline-annotation-editor') !== null;
    if (hasActiveEditors) {
      return;
    }
    this.state.clearSelection();
    this.refreshContentOnly();  // ⭐ 只刷新内容区域
  }, 300);
}

// 添加新方法:只刷新内容列表
private refreshContentOnly(): void {
  // ⭐ 如果正在打开编辑器，跳过刷新
  if (this.isOpeningEditor) {
    return;
  }
  
  const hasActiveEditors = document.querySelector('.inline-annotation-editor') !== null;
  if (hasActiveEditors) {
    return;
  }
  const container = this.containerEl.children[1] as HTMLElement;
  
  if (this.state.displayMode === 'sidebar') {
    const contentList = container.querySelector('.sidebar-content-list') as HTMLElement;
    if (contentList) {
      const scrollPos = contentList.scrollTop;

      const editingCards = new Map<string, HTMLElement>();
      contentList.querySelectorAll('.inline-annotation-editor').forEach((editor: HTMLElement) => {
        const card = editor.closest('[data-unit-id]') as HTMLElement;
        if (card) {
          const unitId = card.getAttribute('data-unit-id');
          if (unitId) {
            editingCards.set(unitId, editor.cloneNode(true) as HTMLElement);
          }
        }
      });

      contentList.empty();
      const currentFileUnits = this.getFilteredUnits();
      this.contentList.renderCompactList(contentList, currentFileUnits);
      this.insertReviewReminderAtTop(contentList);
      
      if (editingCards.size > 0) {
        requestAnimationFrame(() => {
          editingCards.forEach((editor, unitId) => {
            const card = contentList.querySelector(`[data-unit-id="${unitId}"]`) as HTMLElement;
            if (card) {
              card.setAttribute('data-editing', 'true');
              
              const preview = card.querySelector('.annotation-preview');
              if (preview) {
                preview.replaceWith(editor);
                
                const textarea = editor.querySelector('textarea') as HTMLTextAreaElement;
                if (textarea) {
                  this.annotationEditor['bindEditorEvents'](textarea, unitId);
                  requestAnimationFrame(() => {
                    textarea.focus();
                  });
                }
              }
            }
          });
        });
      }
            
      contentList.scrollTop = scrollPos;
    }
  } else {
    this.refreshRightPanel();
    
    const fileListContainer = container.querySelector('.file-list') as HTMLElement;
    if (fileListContainer) {
      this.renderFileListContent(fileListContainer);
    }
  }
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
        new Notice(this.t('notice.noSelection'));
        return;
      }
      this.state.selectAllCards(cards);
    } else {
      const units = visible.units || [];
      if (units.length === 0) {
        new Notice(this.t('notice.noSelection'));
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
      new Notice(this.t('notice.noSelection'));
      return;
    }
    
    // 调用批量创建逻辑
    this.batchCreateFlashcards();
  }

  private handleBatchDelete(): void {
    if (this.state.getSelectedCount() === 0) {
      new Notice(this.t('notice.noSelection'));
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
    // 侧边栏模式：只显示当前文件的笔记
    if (this.state.displayMode === 'sidebar' && this.state.selectedFile) {
      units = units.filter(unit => unit.source.file === this.state.selectedFile);
    }

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
        // ⭐ 修改：按批注分组时的过滤逻辑
        if (selected === 'filter.unannotated') {
          // 显示所有无批注的笔记
          return !unit.annotationId;
        } else {
          // 显示特定文件的有批注笔记
          return unit.source.file === selected && !!unit.annotationId;
        }
  
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
  // ⭐ 修改：按批注分组时的过滤逻辑
  const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
  
  if (selected === 'filter.unannotated') {
    // 显示所有无批注的闪卡
    return !unit || !unit.annotationId;
  } else {
    // 显示特定文件的有批注闪卡
    return card.sourceFile === selected && unit && !!unit.annotationId;
  }
      } else if (this.state.groupMode === 'tag') {
        const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
        return (unit && unit.metadata.tags.includes(selected)) ||
               (card.tags && card.tags.includes(selected)) ||
               (card.deck === this.state.selectedFile) ||
               (this.state.selectedFile === 'group.uncategorized' && 
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
      new Notice(this.t('notice.fileNotFound'));
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
    
    new Notice(this.t('notice.jumpedToSource'));
  } catch (error) {
    console.error('Error jumping to flashcard source:', error);
    new Notice(this.t('notice.jumpFailed'));
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
        // 🎯 Lv2 权限检查
  if (!this.plugin.unlockSystem.tryUseFeature('annotation', 'Annotation')) {
    return;
  }
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
        new Notice(this.t('notice.flashcardNotFound'));

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
  
  await this.plugin.dataManager.deleteContentUnit(unit.id, 'user-deleted');
  
  new Notice(this.t('notice.movedToTrash'));
  this.refresh();
  
}
  };
  
  const menu = ContextMenuBuilder.buildContentUnitMenu(unit, callbacks,this.plugin.settings.language);
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
        await this.plugin.flashcardManager.deleteCard(card.id, 'user-deleted');
        new Notice(this.t('notice.movedToTrash'));
        this.refresh();
      }
    };
    
    const menu = ContextMenuBuilder.buildFlashcardMenu(card, callbacks,this.plugin.settings.language);
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
      new Notice(this.t('notice.alreadyHasFlashcards'));

      return;
    }
    
    // 显示批量创建模态框
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
    // 获取删除统计
    const stats = this.state.getDeleteStats(this.plugin);
    
    // 构建确认消息
    let confirmMsg = this.t('confirm.deleteItems');
    const details: string[] = [];
    
    if (stats.notes > 0) {
      details.push(this.t('confirm.notesCount', { count: stats.notes }));
    }
    if (stats.cards > 0) {
      details.push(this.t('confirm.cardsCount', { count: stats.cards }));
    }
    
    if (details.length > 0) {
      confirmMsg += '\n\n' + details.join('\n');
    }
    
    if (!confirm(confirmMsg)) {
      return;
    }
    
    const { success, failed } = await this.overviewService.batchDeleteNotes(
      this.state.selectedUnitIds
    );
    
    this.state.clearSelection();
    new Notice(this.t('notice.batchDeleted', { success, failed: failed > 0 ? failed : 0 }));
    this.refresh();
  }

  private async batchDeleteFlashcards(): Promise<void> {
    const stats = this.state.getDeleteStats(this.plugin);
    
    const confirmMsg = this.t('confirm.deleteFlashcards', { count: stats.cards });
    
    if (!confirm(confirmMsg)) {
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
    new Notice(this.t('notice.batchDeleted', { success, failed: failed > 0 ? failed : 0 }));
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

private getFilteredCardsForCurrentFile(): Flashcard[] {
  if (this.state.displayMode !== 'sidebar' || !this.state.selectedFile) {
    return [];
  }
  
  const flashcards = this.plugin.flashcardManager.getAllFlashcards();
  return flashcards.filter(card => card.sourceFile === this.state.selectedFile);
}
private checkFilterHasNotes(mode: FilterMode): boolean {
  // 只在侧边栏模式下检查当前文件
  if (this.state.displayMode !== 'sidebar' || !this.state.selectedFile) {
    return true;
  }
  
  const units = this.plugin.dataManager.getAllContentUnits()
    .filter(u => u.source.file === this.state.selectedFile);
  
  if (mode === 'all') {
    return units.length > 0;
  } else if (mode === 'annotated') {
    return units.some(u => u.annotationId);
  } else if (mode === 'flashcards') {
    return units.some(u => u.flashcardIds.length > 0);
  }
  
  return true;
}

private checkGroupHasNotes(mode: GroupMode): boolean {
  // 只在侧边栏模式下检查
  if (this.state.displayMode !== 'sidebar' || !this.state.selectedFile) {
    return true;
  }
  
  const units = this.plugin.dataManager.getAllContentUnits()
    .filter(u => u.source.file === this.state.selectedFile);
  
  if (units.length === 0) return false;
  
  if (mode === 'file') {
    return true; // 文件分组始终可用
  } else if (mode === 'tag') {
    return units.some(u => u.metadata.tags.length > 0);
  } else if (mode === 'date') {
    return true; // 日期分组始终可用
  } else if (mode === 'annotation') {
    return units.some(u => u.annotationId);
  }
  
  return true;
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

// ==================== 等级徽章显示 ====================

/**
 * 判断是否显示完整的等级徽章
 * Lv1-4: 始终显示
 * Lv5: 达成后30分钟内显示，之后隐藏
 */
private shouldShowFullLevelBadge(progress: UnlockProgress): boolean {
  if (progress.currentLevel < 5) {
    return true;
  }
  
  // Lv5: 检查是否在30分钟内
  const lv5UnlockedTime = progress.levelUnlockedAt[5];
  if (!lv5UnlockedTime) {
    return false;
  }
  
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;
  return (now - lv5UnlockedTime) < thirtyMinutes;
}

/**
 * 渲染小型等级徽章（Lv5专用）
 */
private renderLevelBadge(container: HTMLElement, progress: UnlockProgress): void {
  const levelBadge = container.createDiv({ cls: 'level-badge-icon' });
  

  const levelName = this.t(`level.${progress.currentLevel}`);
  levelBadge.textContent = `Lv${progress.currentLevel}`;
  levelBadge.title = `${this.t('level.current')}: ${levelName} - ${this.t('level.clickDetails')}`;
  
  // 点击显示等级详情
  levelBadge.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    new LevelInfoModal(this.app, progress, this.plugin.unlockSystem).open();
  });
}
  // ==================== 复习检查 ====================
// 每日提醒复习
// 手动触发复习提醒检查
public checkReviewReminder(): void {
  const isDismissed = this.isReminderDismissedToday();
  
  if (isDismissed) {
    // 显示提醒
    localStorage.removeItem('learning-system-reminder-dismissed');
  } else {
    // 隐藏提醒
    this.markReminderDismissed();
  }
  
  this.refresh();
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
  if (this.isReminderDismissedToday()) return;
  
  // ⭐ 直接从 FlashcardManager 获取实际数量
  const dueCount = this.plugin.flashcardManager.getDueCards().length;
  
  if (dueCount === 0) return;
  
  const banner = this.createReviewBanner(dueCount);
  container.insertBefore(banner, container.firstChild);
    // 在 banner 后面添加第二条分隔线
    const divider2 = document.createElement('div');
    divider2.className = 'review-divider';
    divider2.style.width = '100%';
    divider2.style.height = '1px';
    divider2.style.backgroundColor = 'var(--background-modifier-border)';
    divider2.style.margin = '12px 0';
    
    if (banner.nextSibling) {
      container.insertBefore(divider2, banner.nextSibling);
    } else {
      container.appendChild(divider2);
    }
}



private createReviewBanner(count: number): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'content-list-review-reminder';
  
  // ⭐ 获取当前待复习的卡片
  const dueCards = this.plugin.flashcardManager.getDueCards();
  const actualDueCount = dueCards.length;
  
  // ⭐ 正确的逻辑：计算今天的复习任务总数
  // 今天复习过的卡片 = 今天复习过且今天到期的卡片
  const allCards = this.plugin.flashcardManager.getAllFlashcards();
  const today = new Date().setHours(0, 0, 0, 0);
  
  // 获取今天到期的所有卡片ID（包括已复习和未复习）
  const todayDueCardIds = new Set(
    allCards
      .filter(card => {
        const dueDate = new Date(card.scheduling.due).setHours(0, 0, 0, 0);
        return dueDate <= today;
      })
      .map(card => card.id)
  );
  
  // 统计今天已复习的卡片（且属于今天的任务）
  const reviewedToday = allCards.filter(card => {
    if (!card.stats.lastReview) return false;
    const lastReviewDate = new Date(card.stats.lastReview).setHours(0, 0, 0, 0);
    return lastReviewDate === today && todayDueCardIds.has(card.id);
  }).length;
  
  // ⭐ 今天的总任务数 = 已完成 + 待完成
  const totalToday = reviewedToday + actualDueCount;
  const progressPercent = totalToday > 0 ? Math.round((reviewedToday / totalToday) * 100) : 0;
  
  // 计算最紧急的卡片延后时间
  const mostUrgent = dueCards.length > 0 
    ? dueCards.reduce((earliest, card) => 
        card.scheduling.due < earliest ? card.scheduling.due : earliest
      , Date.now())
    : Date.now();
  const hoursSinceDue = Math.floor((Date.now() - mostUrgent) / (1000 * 60 * 60));
  
  // 获取延后提示文本
  const delayText = this.getDelayText(hoursSinceDue);
  
  // 获取连续复习天数
  const streakDays = this.getReviewStreak();
  
  banner.innerHTML = `
  <div class="reminder-header">
    <div class="reminder-text">
 <strong>${this.t('review.todayProgress', { reviewed: reviewedToday, total: totalToday })}</strong>  
    </div>
  </div>
  
  <div class="reminder-stats">
    <div class="stat-item delay-warning">
      ${delayText}
    </div>
    ${streakDays > 0 ? `
      <div class="stat-item streak-info">
         ${this.t('review.streak', { days: streakDays })}
      </div>
    ` : ''}
  </div>
  
  <div class="reminder-actions">
    <button class="reminder-btn primary">${this.t('review.start')}</button>
  </div>
`;

// 设置字体大小
banner.style.fontSize = '0.85em';
// 设置按钮居中
const actions = banner.querySelector('.reminder-actions') as HTMLElement;
if (actions) {
  actions.style.display = 'flex';
  actions.style.justifyContent = 'center';
}
  
  banner.querySelector('.primary')!.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    this.startReview();
    banner.remove();
    this.markReminderDismissed();
  });
  
  return banner;
}

// 新增辅助方法 1: 获取延后提示文本
private getDelayText(hoursSinceDue: number): string {
  if (hoursSinceDue < 1) {
    return this.t('review.justDue');
  } else if (hoursSinceDue < 6) {
    return this.t('review.delayedHoursShort', { hours: hoursSinceDue });
  } else if (hoursSinceDue < 24) {
    return this.t('review.urgentHours', { hours: hoursSinceDue });
  } else {
    const days = Math.floor(hoursSinceDue / 24);
    return this.t('review.urgentDays', { days });
  }
}

// 新增辅助方法 2: 获取连续复习天数
private getReviewStreak(): number {
  const allCards = this.plugin.flashcardManager.getAllFlashcards();
  
  // 按日期分组统计复习记录
  const reviewDates = new Set<string>();
  allCards.forEach(card => {
    if (card.stats.lastReview) {
      const dateStr = new Date(card.stats.lastReview)
        .toLocaleDateString('zh-CN');
      reviewDates.add(dateStr);
    }
  });
  
  // 计算连续天数
  let streak = 0;
  let checkDate = new Date();
  
  while (streak < 365) { // 最多检查一年
    const dateStr = checkDate.toLocaleDateString('zh-CN');
    if (reviewDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}
private t(key: string, params?: Record<string, string | number>): string {
  return t(key, this.plugin.settings.language, params);
}
}