// SidebarOverviewView.ts - 完整实现版本
import { ItemView, WorkspaceLeaf, TFile, Menu, Notice, Modal, App } from 'obsidian';
import type LearningSystemPlugin from '../main';
import { ContentUnit } from '../core/DataManager';
import { Flashcard } from '../core/FlashcardManager';
import { QuickFlashcardCreator } from '../core/QuickFlashcardCreator';

export const VIEW_TYPE_SIDEBAR_OVERVIEW = 'learning-system-sidebar-overview';
export const VIEW_TYPE_MAIN_OVERVIEW = 'learning-system-main-overview';

type FilterMode = 'all' | 'annotated' | 'flashcards';
type DisplayMode = 'sidebar' | 'main';
type GroupMode = 'file' |  'annotation' | 'tag' | 'date';
type ViewType = 'notes' | 'cards';

export  class SidebarOverviewView extends ItemView {
  plugin: LearningSystemPlugin;
  
  // 状态管理
  private forceMainMode: boolean = false;
  private searchQuery: string = '';
  private filterMode: FilterMode = 'all';
  private groupMode: GroupMode = 'file';
  private selectedFile: string | null = null;
  private displayMode: DisplayMode = 'sidebar'; 
  private viewType: ViewType = 'notes';
  private activeMenuId: string | null = null;
  private savedScrollPosition: number = 0;
  private shouldRestoreScroll: boolean = false;
  private batchMode: boolean = false;
  private selectedUnitIds: Set<string> = new Set();
  private selectedCardIds: Set<string> = new Set();

  
  // 性能优化
  private searchDebounceTimer: number | null = null;
  private isRendering: boolean = false;

  constructor(leaf: WorkspaceLeaf, plugin: LearningSystemPlugin, forceMainMode = false) {
    super(leaf);
    this.plugin = plugin;
    this.forceMainMode = forceMainMode;  


  const activeFile = this.app.workspace.getActiveFile();
  if (activeFile) {
    this.selectedFile = activeFile.path;
  }
    // **修改: 添加防抖的 resize 监听**
    let resizeTimer: number;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        this.detectDisplayMode();
        this.render();
      }, 150);
    });
    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      this.detectDisplayMode();
      this.render();
    });
  }

  getViewType(): string {
    // return this.forceMainMode ? VIEW_TYPE_MAIN_OVERVIEW : VIEW_TYPE_SIDEBAR_OVERVIEW;
  //  调试
    const viewType = this.forceMainMode ? VIEW_TYPE_MAIN_OVERVIEW : VIEW_TYPE_SIDEBAR_OVERVIEW;

    return viewType;
  }

  getDisplayText(): string {
    return 'Learning Overview';
  }

  getIcon(): string {
    return 'book-marked';
  }

  async onOpen() {

    
    this.detectDisplayMode();
  
    if (!this.forceMainMode) {
      this.registerEvent(
        this.app.workspace.on('active-leaf-change', () => {
          const activeFile = this.app.workspace.getActiveFile();
          if (activeFile && this.displayMode === 'sidebar') {
            this.selectedFile = activeFile.path;
            this.refresh();
          }
        })
      );
    }

    
    this.render();
    
    this.addStyles();
  }

  // ==================== 核心方法 ====================
  
  /**
   * 检测当前显示模式（侧边栏 vs 主界面）
   */
  private detectDisplayMode() {
    if (this.forceMainMode) {
      this.displayMode = 'main';
      return;
    }
    const parentSplit = (this.leaf as any).parentSplit;
    const isLeftSidebar = parentSplit?.type === 'split' && 
                          this.app.workspace.leftSplit === parentSplit;
    const isRightSidebar = parentSplit?.type === 'split' && 
                           this.app.workspace.rightSplit === parentSplit;
    
    const containerEl = this.containerEl;
    const width = containerEl.clientWidth;
    const isNarrow = width < 500;
    
    const isSidebar = isLeftSidebar || isRightSidebar || isNarrow;

    this.displayMode = isSidebar ? 'sidebar' : 'main';
    
  }

  /**
   * 刷新视图
   */
  refresh() {
    
    // 🔧 如果正在渲染，标记需要再次刷新
    if (this.isRendering) {
      requestAnimationFrame(() => {
        this.refresh();
      });
      return;
    }
    
    // 🔧 清除搜索防抖定时器
    if (this.searchDebounceTimer !== null) {
      window.clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    
    // 🔧 标记需要恢复滚动位置
    this.shouldRestoreScroll = true;
    
    this.render();
  }

//render拆分函数
private resetInteractionState(container: HTMLElement) {
  container.style.pointerEvents = 'auto';
  const toolbar = container.querySelector('.sidebar-toolbar') as HTMLElement;
  if (toolbar) {
    toolbar.style.pointerEvents = 'auto';
    toolbar.style.position = 'relative';
    toolbar.style.zIndex = '100';
  }
}
private saveScrollPosition(container:HTMLElement){
  if (this.displayMode === 'sidebar') {
    const contentList = container.querySelector('.sidebar-content-list') as HTMLElement;
    if (contentList) {
      this.savedScrollPosition = contentList.scrollTop;
    }
  }
  
}


  /**
   * 主渲染方法
   */
  
  private render() {

      // 🔧 验证数据是否已加载
  const allUnits = this.plugin.dataManager.getAllContentUnits();
  const unitsWithCards = allUnits.filter(u => u.flashcardIds.length > 0);

    if (this.isRendering) {
      return;
    }
    if (this.searchDebounceTimer !== null) {
      window.clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    this.isRendering = true;
    
    const container = this.containerEl.children[1] as HTMLElement;
    
   
    // 如果是侧边栏模式，总是保存当前滚动位置
    this.saveScrollPosition(container);
    // 🔧 清除所有可能阻塞交互的样式
    this.resetInteractionState(container)
      // ✅ 如果是主界面模式且没有选中，初始化默认选中
  if (this.displayMode === 'main' && !this.selectedFile && this.viewType === 'notes') {
    const units = this.getFilteredUnits();
    const grouped = this.groupUnits(units);
    if (grouped.length > 0) {
      this.selectedFile = grouped[0].groupKey;
    }
  }
    container.empty();
    container.addClass('learning-overview-container');
    container.setAttribute('data-mode', this.displayMode);
  
    // 根据模式渲染不同布局
    if (this.displayMode === 'sidebar') {
      this.renderSidebarMode(container);
    } else {
      this.renderMainMode(container);
    }
    
    // 如果需要恢复滚动位置
    if (this.displayMode === 'sidebar' && this.shouldRestoreScroll) {
      const contentList = container.querySelector('.sidebar-content-list') as HTMLElement;
      if (contentList) {
        requestAnimationFrame(() => {
          contentList.scrollTop = this.savedScrollPosition;

        });
      }
    }
    
    this.isRendering = false;
  }
  
  /**
   * 仅刷新内容区域（不重新渲染整个视图）
   */
  private refreshContent() {
    const container = this.containerEl.children[1] as HTMLElement;
    
    if (this.displayMode === 'sidebar') {
      const contentList = container.querySelector('.sidebar-content-list') as HTMLElement;
      if (contentList) {
        // 保存滚动位置
        this.savedScrollPosition = contentList.scrollTop;
        
        contentList.empty();
        this.renderCompactContentList(contentList);
        
        // 恢复滚动位置
        requestAnimationFrame(() => {
          contentList.scrollTop = this.savedScrollPosition;
        });
      }
    } else {
      const rightPanel = container.querySelector('.right-panel') as HTMLElement;
      if (rightPanel) {
        rightPanel.empty();
        this.renderRightPanel(rightPanel);
      }
    }
  }

  // ==================== 侧边栏模式渲染 ====================
  
  private renderSidebarMode(container: HTMLElement) {
    // 顶部工具栏
    this.renderSidebarToolbar(container);
    
    // 内容列表（紧凑模式）
    const contentList = container.createDiv({ cls: 'sidebar-content-list' });
    this.renderCompactContentList(contentList);
  }

  private renderSidebarToolbar(container: HTMLElement) {
    const toolbar = container.createDiv({ cls: 'sidebar-toolbar' });
    
    // 搜索框
    const searchContainer = toolbar.createDiv({ cls: 'search-container' });
    const searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: '🔍 搜索笔记...',
      cls: 'search-input'
    });
    searchInput.value = this.searchQuery;
    
    searchInput.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.searchQuery = value;
      
      if (this.searchDebounceTimer !== null) {
        window.clearTimeout(this.searchDebounceTimer);
      }
      
      this.searchDebounceTimer = window.setTimeout(() => {
        this.selectedUnitIds.clear();
        this.selectedCardIds.clear();
        this.refreshContent();
      }, 300);
    });
  
    // 过滤器
    const filters = toolbar.createDiv({ cls: 'filter-chips' });
    
    const filterOptions = [
      { mode: 'all' as FilterMode, icon: '📝', label: 'allnotes' },
      { mode: 'annotated' as FilterMode, icon: '💬', label: 'comment' },
      { mode: 'flashcards' as FilterMode, icon: '🃏', label: 'flashcards' }
    ];
  
    filterOptions.forEach(({ mode, icon, label }) => {
      const chip = filters.createDiv({
        cls: `filter-chip ${this.filterMode === mode ? 'active' : ''}`,
        text: `${icon} ${label}`  
      });
      chip.addEventListener('click', () => {
        if (this.filterMode !== mode) {
          this.filterMode = mode;
          this.selectedUnitIds.clear();
          this.selectedCardIds.clear();
          this.batchMode = false;
          this.shouldRestoreScroll = false;
          this.render();
        }
      });
    });
  
    // 分组模式切换
    const groupSwitcher = toolbar.createDiv({ cls: 'group-switcher' });
    
    const groupOptions = [
      { mode: 'file' as GroupMode, icon: '📁', tooltip: '按文件' },
      { mode: 'tag' as GroupMode, icon: '🏷️', tooltip: '按标签' },
      { mode: 'date' as GroupMode, icon: '📅', tooltip: '按日期' }
    ];
  
    groupOptions.forEach(({ mode, icon, tooltip }) => {
      const btn = groupSwitcher.createDiv({
        cls: `group-btn ${this.groupMode === mode ? 'active' : ''}`,
        text: icon
      });
      btn.addEventListener('click', () => {
        if (this.groupMode !== mode) {
          this.groupMode = mode;
          
          if (this.displayMode === 'sidebar') {
            const activeFile = this.app.workspace.getActiveFile();
            this.selectedFile = activeFile ? activeFile.path : null;
          } else {
            this.selectedFile = null;
          }
          
          this.selectedUnitIds.clear();
          this.selectedCardIds.clear();
          this.batchMode = false;
          this.render();
        }
      });
    });
  
    // 统计信息和批量操作按钮
    const statsRow = toolbar.createDiv({ cls: 'stats-row' });
  
    // 全选按钮
    this.createSelectAllButton(statsRow, 'sidebar');
  
    // 批量操作按钮
    this.createBatchActionButtons(statsRow, 'sidebar');
  
  }


  /**
   * 渲染紧凑内容列表（侧边栏模式）
   */
  private renderCompactContentList(container: HTMLElement) {
    let units = this.getFilteredUnits();

  // 新增:如果是侧边栏模式且有选中文件,只显示该文件的笔记
  if (this.displayMode === 'sidebar' && this.selectedFile) {
    units = units.filter(unit => unit.source.file === this.selectedFile);
  }

  if (units.length === 0) {
    // 🔧 添加这段:显示提示信息
    const emptyDiv = container.createDiv({ cls: 'empty-state' });
    
    if (this.selectedFile) {
      emptyDiv.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 10px;">📭</div>
          <div style="color: var(--text-muted);">当前文档暂无笔记</div>
          <div style="font-size: 12px; color: var(--text-faint); margin-top: 8px;">
            ${this.filterMode !== 'all' ? '尝试切换其他过滤器查看' : '开始高亮文本来创建笔记'}
          </div>
        </div>
      `;
    } else {
      emptyDiv.textContent = '暂无内容';
    }
    
    return;
  }

    const grouped = this.groupUnits(units);

    grouped.forEach(({ groupKey, units: groupUnits }) => {
      const groupEl = container.createDiv({ cls: 'content-group' });

      // 分组标题
      const header = groupEl.createDiv({ cls: 'group-header' });
      header.createSpan({ text: this.getGroupIcon(this.groupMode), cls: 'group-icon' });
      header.createSpan({ text: groupKey, cls: 'group-title' });
      header.createSpan({ text: `${groupUnits.length}`, cls: 'group-count' });

      // 内容卡片列表
      groupUnits.forEach(unit => {
        this.renderCompactCard(groupEl, unit);
      });
    });
  }

  /**
   * 渲染紧凑卡片（侧边栏模式）
   */
  private renderCompactCard(container: HTMLElement, unit: ContentUnit) {
    const card = container.createDiv({ cls: 'compact-card' });

    // 批量选择模式：添加checkbox
    if (this.batchMode) {
      const checkbox = card.createEl('input', {
        type: 'checkbox',
        cls: 'batch-checkbox'
      });
      checkbox.setAttribute('data-unit-id', unit.id);
      checkbox.checked = this.selectedUnitIds.has(unit.id);
      checkbox.addEventListener('change', (e) => {
        if ((e.target as HTMLInputElement).checked) {
          this.selectedUnitIds.add(unit.id);
        } else {
          this.selectedUnitIds.delete(unit.id);
        }
        this.render();
      });
    }

// 左侧指示器
const indicator = card.createDiv({ cls: 'card-indicator' });

// 🔧 根据 unit.type 添加不同的类
if (unit.type === 'QA') {
  indicator.addClass('type-qa');
} else if (unit.type === 'cloze') {
  indicator.addClass('type-cloze');
} else if (unit.type === 'text') {
  indicator.addClass('type-text');
}

// 保留原有的批注和闪卡状态
if (unit.annotationId) indicator.addClass('has-annotation');
if (unit.flashcardIds.length > 0) indicator.addClass('has-flashcard');
    

// 内容区域
const content = card.createDiv({ cls: 'card-content' });

// 左上角：批注图标
const header = content.createDiv({ cls: 'card-header' });

// 整行执行左侧逻辑
header.addEventListener('click', () => {
  this.toggleInlineAnnotation(card, unit);
});

// 按钮不需要任何逻辑，点击会自然触发 header 的逻辑
const annotationBtn = header.createDiv({ cls: 'annotation-btn' });
annotationBtn.innerHTML = '💬';


// 右上角工具按钮（阻止冒泡）
const tools = header.createDiv({ cls: 'card-tools' });
tools.addEventListener('click', (e) => {
  e.stopPropagation(); // 关键！保证右侧按钮不触发整行点击
});
  


// 2. 非批量模式下的闪卡按钮
if (!this.batchMode) {
  const flashcardBtn = tools.createDiv({ cls: 'tool-btn flashcard-btn' });
  flashcardBtn.innerHTML = '⚡';
  flashcardBtn.setAttribute('aria-label', '生成闪卡');
  flashcardBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    this.quickGenerateFlashcard(unit);
  });
}

    // 更多操作按钮
    const moreBtn = tools.createDiv({ cls: 'tool-btn more-btn' });
    moreBtn.innerHTML = '⋮';
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showContextMenu(e, unit);
    });

// 笔记内容（点击跳转到原文）
const noteText = content.createDiv({ cls: 'note-text' });

let displayHTML = '';

// 如果是 QA 类型，用不同样式显示问题和答案
if (unit.type === 'QA' && unit.answer) {
  displayHTML = `<span class="qa-question">${unit.content}</span> <span class="qa-separator">::</span> <span class="qa-answer">${unit.answer}</span>`;
}
// 如果是 cloze 类型，高亮显示答案
else if (unit.type === 'cloze' && unit.fullContext) {
  let context = unit.fullContext.replace(/==/g, '');
  const answer = unit.content;
  displayHTML = context.replace(
    answer, 
    `<span class="cloze-highlight">${answer}</span>`
  );
}
// 纯文本
else {
  displayHTML = unit.content;
}

noteText.innerHTML = displayHTML;

noteText.addEventListener('click', () => {
  this.jumpToSource(unit);
});

    // 显示批注（如果有）
    const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
    if (annotation) {
      const annEl = content.createDiv({ cls: 'annotation-preview' });
      const annText = annotation.content.length > 60
        ? annotation.content.substring(0, 60) + '...'
        : annotation.content;
      annEl.textContent = `💬 ${annText}`;
      
      // 点击批注预览也可以展开编辑
      annEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleInlineAnnotation(card, unit);
      });
    }

    // 标签和元信息
    const meta = content.createDiv({ cls: 'card-meta' });
    
    if (unit.metadata.tags.length > 0) {
      unit.metadata.tags.slice(0, 2).forEach(tag => {
        meta.createSpan({ text: `#${tag}`, cls: 'tag' });
      });
      if (unit.metadata.tags.length > 2) {
        meta.createSpan({ text: `+${unit.metadata.tags.length - 2}`, cls: 'tag-more' });
      }
    }

    if (unit.flashcardIds.length > 0) {
      meta.createSpan({ text: `🃏 ${unit.flashcardIds.length}`, cls: 'badge' });
    }
  }

  // ==================== 主界面模式渲染 ====================
  
  private renderMainMode(container: HTMLElement) {
    const layout = container.createDiv({ cls: 'main-layout' });

    // 左侧面板
    const leftPanel = layout.createDiv({ cls: 'left-panel' });
    if (!this.selectedFile && this.viewType === 'notes') {
      const units = this.getFilteredUnits();
      const grouped = this.groupUnits(units);
      if (grouped.length > 0) {
        this.selectedFile = grouped[0].groupKey; // 自动选中第一个
      }
    }
    this.renderLeftPanel(leftPanel);

    // 右侧面板
    const rightPanel = layout.createDiv({ cls: 'right-panel' });
    this.renderRightPanel(rightPanel);
  }

  private renderLeftPanel(container: HTMLElement) {
        // 搜索和过滤
    this.renderMainToolbar(container);
    // 顶部固定入口
    this.renderFixedEntries(container);



    // 文件列表
    this.renderFileList(container);
  }



  private renderMainToolbar(container: HTMLElement) {
    const toolbar = container.createDiv({ cls: 'main-toolbar' });
  
    // 搜索框
    const searchInput = toolbar.createEl('input', {
      type: 'text',
      placeholder: '🔍 搜索...',
      cls: 'search-input-main'
    });
    searchInput.value = this.searchQuery;
    
    // 使用防抖优化搜索
    searchInput.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.searchQuery = value;
      
      // 清除之前的定时器
      if (this.searchDebounceTimer !== null) {
        window.clearTimeout(this.searchDebounceTimer);
      }
      
      // 设置新的定时器
      this.searchDebounceTimer = window.setTimeout(() => {
        this.selectedFile = null;
        // 只刷新右侧面板
        const container = this.containerEl.children[1] as HTMLElement;
        const rightPanel = container.querySelector('.right-panel') as HTMLElement;
        if (rightPanel) {
          rightPanel.empty();
          this.renderRightPanel(rightPanel);
        }
        
        // 更新文件列表
        const fileListContainer = container.querySelector('.file-list') as HTMLElement;
        if (fileListContainer) {
          fileListContainer.empty();
          this.renderFileListContent(fileListContainer);
        }
        // this.selectedUnitIds.clear();
        // this.selectedCardIds.clear();
      }, 300); // 300ms 防抖
    });
  
    // 分组模式切换（笔记和卡片视图都显示）- 移除条件判断
    const groupSwitcher = toolbar.createDiv({ cls: 'group-switcher-main' });
    
    const groupOptions = [
      { mode: 'file' as GroupMode, icon: '📁', label: '文件' },
      { mode: 'annotation' as GroupMode, icon: '💬', label: '批注' },
      { mode: 'tag' as GroupMode, icon: '🏷️', label: '标签' },
      { mode: 'date' as GroupMode, icon: '📅', label: '日期' }
    ];
  
    groupOptions.forEach(({ mode, icon, label }) => {
      const btn = groupSwitcher.createDiv({
        cls: `group-btn-main ${this.groupMode === mode ? 'active' : ''}`,
      });
      btn.innerHTML = `${icon} `;
      btn.addEventListener('click', () => {
        if (this.groupMode !== mode) {
          this.groupMode = mode;
          this.selectedFile = null; // 🔧 清空选择
          this.selectedUnitIds.clear();
          this.selectedCardIds.clear();
          this.batchMode = false;
          this.render();
          
          // 刷新文件列表和右侧面板
          const container = this.containerEl.children[1] as HTMLElement;
          const fileListContainer = container.querySelector('.file-list') as HTMLElement;
          if (fileListContainer) {
            fileListContainer.empty();
            this.renderFileListContent(fileListContainer);
          }
          const rightPanel = container.querySelector('.right-panel') as HTMLElement;
          if (rightPanel) {
            rightPanel.empty();
            this.renderRightPanel(rightPanel);
          }
        }
      });
    });

  }
  private renderFixedEntries(container: HTMLElement) {
    const entries = container.createDiv({ cls: 'fixed-entries' });

    // 全部笔记按钮
    const allNotesBtn = entries.createDiv({
      cls: `entry-btn ${this.viewType === 'notes' ? 'active' : ''}`,
    });
    allNotesBtn.innerHTML = '📝 <span>All Notes</span>';
    allNotesBtn.addEventListener('click', () => {
      this.viewType = 'notes';
      this.selectedFile = null;
      this.selectedUnitIds.clear();
      this.selectedCardIds.clear();
      this.batchMode = false;
      this.render();
    });

    // Card List 按钮
    const cardListBtn = entries.createDiv({
      cls: `entry-btn ${this.viewType === 'cards' ? 'active' : ''}`,
    });
    cardListBtn.innerHTML = '🃏 <span>Card List</span>';
    cardListBtn.addEventListener('click', () => {
      this.viewType = 'cards';
      this.selectedFile = null;
      this.selectedUnitIds.clear();
      this.selectedCardIds.clear();
      this.batchMode = false;
      this.render();
    });
  }
  private renderFileList(container: HTMLElement) {
    const titleText = this.viewType === 'cards' ? '闪卡分组' : '文档列表';
    // container.createEl('h3', { text: titleText, cls: 'panel-title' });

    container.createEl('h3', { text: '📁 文档列表', cls: 'panel-title' });

    const fileListContainer = container.createDiv({ cls: 'file-list' });
    this.renderFileListContent(fileListContainer);
  }
  
  private renderFileListContent(container: HTMLElement) {
    container.empty();
    
    // 支持闪卡和笔记的统一分组处理
    let grouped: Array<{ groupKey: string; units?: ContentUnit[]; cards?: Flashcard[]; count: number }>;
    
    if (this.viewType === 'cards') {
      const flashcards = this.plugin.flashcardManager.getAllFlashcards();
      const cardGroups = this.groupFlashcards(flashcards);
      grouped = cardGroups.map(g => ({ groupKey: g.groupKey, cards: g.cards, count: g.cards.length }));
    } else {
      const units = this.getFilteredUnits();
      const unitGroups = this.groupUnits(units);
      grouped = unitGroups.map(g => ({ groupKey: g.groupKey, units: g.units, count: g.units.length }));
    }
  
    if (grouped.length === 0) {
      container.createDiv({
        text: '暂无文档',
        cls: 'empty-hint'
      });
      return;
    }
    
    if (!this.selectedFile && grouped.length > 0) {
      this.selectedFile = grouped[0].groupKey;
    }
  
    grouped.forEach(({ groupKey, count }) => {
      const fileItem = container.createDiv({
        cls: `file-item ${this.selectedFile === groupKey ? 'selected' : ''}`
      });
  
      fileItem.innerHTML = `
        <span class="file-icon">${this.getGroupIcon(this.groupMode)}</span>
        <span class="file-name">${groupKey}</span>
        <span class="file-count">${count}</span>
      `;
  
      fileItem.addEventListener('click', () => {
   
        try {
          if (this.selectedFile !== groupKey) {
            this.selectedFile = groupKey;
            

            
            // 更新选中状态
            const allItems = container.querySelectorAll('.file-item');
            allItems.forEach(item => item.removeClass('selected'));
            fileItem.addClass('selected');
            
            // 刷新右侧面板
            const mainContainer = this.containerEl.children[1] as HTMLElement;
            const rightPanel = mainContainer.querySelector('.right-panel') as HTMLElement;
            if (rightPanel) {

              rightPanel.empty();
              this.renderRightPanel(rightPanel);
            }
          }
        } catch (error) {
          console.error('[fileItem click] Error:', error);
          new Notice('⚠️ 切换分组时出错，请重试');
        }
      });
    });
  }

  private renderRightPanel(container: HTMLElement) {

    if (this.viewType === 'cards') {
      if (!this.selectedFile) {
        const flashcards = this.plugin.flashcardManager.getAllFlashcards();
        const grouped = this.groupFlashcards(flashcards);
        if (grouped.length > 0) {
          this.selectedFile = grouped[0].groupKey;

        } else {
          const empty = container.createDiv({ cls: 'empty-right-panel' });
          empty.innerHTML = `
            <div class="empty-icon">📭</div>
            <div class="empty-text">暂无闪卡</div>
          `;
          return;
        }
      }
      
      // 渲染闪卡网格（会根据 selectedFile 过滤）
      this.renderFlashcardsGrid(container);
      return;
    }
// 自动选中第一个
    if (!this.selectedFile) {
      const units = this.getFilteredUnits();
      const grouped = this.groupUnits(units);
      
      if (grouped.length > 0) {
        this.selectedFile = grouped[0].groupKey;
        // 触发左侧文件列表更新选中状态
        const container = this.containerEl.children[1] as HTMLElement;
        const fileListContainer = container.querySelector('.file-list') as HTMLElement;
        if (fileListContainer) {
          const firstItem = fileListContainer.querySelector('.file-item');
          firstItem?.addClass('selected');
        }
      } else {
        // 真的没有数据
        const empty = container.createDiv({ cls: 'empty-right-panel' });
        empty.innerHTML = `
          <div class="empty-icon">📭</div>
          <div class="empty-text">暂无内容</div>
        `;
        return;
      }
    }

    // 渲染内容网格
    this.renderContentGrid(container);
  }

  /**
   * 渲染内容网格（主界面模式）
   */
  private renderContentGrid(container: HTMLElement) {
    const header = container.createDiv({ cls: 'grid-header' });
    
    const title = header.createEl('h2', { text: this.selectedFile || '内容' });
    
// 按钮容器
const headerActions = header.createDiv({ cls: 'header-actions' });
// 批量操作按钮
this.createBatchActionButtons(headerActions, 'header');
// 全选按钮
this.createSelectAllButton(headerActions, 'header');



    const gridContainer = container.createDiv({ cls: 'content-grid' });
    
    const units = this.getFilteredUnits().filter(unit => {
      if (this.groupMode === 'file') {
        return unit.source.file === this.selectedFile;
      }else if (this.groupMode === 'annotation'){
        const hasAnnotation = this.selectedFile === '有批注';
        return hasAnnotation ? !!unit.annotationId : !unit.annotationId;
      }
       else if (this.groupMode === 'tag') {
        return unit.metadata.tags.includes(this.selectedFile!);
      } else if (this.groupMode === 'date') {
        return this.formatDate(new Date(unit.metadata.createdAt)) === this.selectedFile;
      }
      return false;
    });

    if (units.length === 0) {
      gridContainer.createDiv({
        text: '📭 暂无内容',
        cls: 'empty-state'
      });
      return;
    }

    units.forEach(unit => {
      this.renderGridCard(gridContainer, unit);
    });
  }
  /**
 * 渲染闪卡网格（类似 renderContentGrid）
 */
  private renderFlashcardsGrid(container: HTMLElement) {
    const header = container.createDiv({ cls: 'grid-header' });
    
    header.createEl('h2', { text: this.selectedFile || '闪卡' });

// 按钮容器
const headerActions = header.createDiv({ cls: 'header-actions' });

// 批量操作按钮
this.createBatchActionButtons(headerActions, 'header');

// 全选按钮
this.createSelectAllButton(headerActions, 'header');




    const gridContainer = container.createDiv({ cls: 'content-grid' });
    
    const flashcards = this.plugin.flashcardManager.getAllFlashcards();
    
    // 改进过滤逻辑
    const filteredCards = flashcards.filter(card => {
      if (!this.selectedFile) return false;
      
      if (this.groupMode === 'file') {
        // 按文件过滤
        return card.sourceFile === this.selectedFile;
      } 

      if (this.groupMode === 'annotation') {
        // 🔧 按批注过滤
        const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
        const hasAnnotation = this.selectedFile === '有批注';
        if (hasAnnotation) {
          return unit && !!unit.annotationId;
        } else {
          return !unit || !unit.annotationId;
        }
      }

      if (this.groupMode === 'tag') {
        // 按标签过滤
        const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
        
        // 检查笔记单元的标签
        if (unit && unit.metadata.tags && unit.metadata.tags.includes(this.selectedFile)) {
          return true;
        }
        
        // 检查卡片自己的标签
        if (card.tags && card.tags.includes(this.selectedFile)) {
          return true;
        }
        
        // 检查 deck
        if (card.deck === this.selectedFile) {
          return true;
        }
        
        // 检查"未分类"
        if (this.selectedFile === '未分类' && 
            (!card.tags || card.tags.length === 0) && 
            !card.deck &&
            (!unit || !unit.metadata.tags || unit.metadata.tags.length === 0)) {
          return true;
        }
        
        return false;
      }
      
      if (this.groupMode === 'date') {
        // 按日期过滤
        const cardDate = this.formatDate(new Date(card.metadata.createdAt));
        return cardDate === this.selectedFile;
      }
      
      return false;
    });
  

  
    if (filteredCards.length === 0) {
      gridContainer.createDiv({ text: '📭 该分组下暂无闪卡', cls: 'empty-state' });
      return;
    }
  
    filteredCards.forEach(card => {
      this.renderFlashcardGridCard(gridContainer, card);
    });
  }

  /**
   * 渲染网格卡片（主界面模式）
   */
  private renderGridCard(container: HTMLElement, unit: ContentUnit) {
    const card = container.createDiv({ cls: 'grid-card' });

    // 批量选择模式：添加checkbox
    if (this.batchMode) {
      const checkbox = card.createEl('input', {
        type: 'checkbox',
        cls: 'batch-checkbox'
      });
      checkbox.setAttribute('data-unit-id', unit.id);
      checkbox.checked = this.selectedUnitIds.has(unit.id);
      checkbox.addEventListener('change', (e) => {
        if ((e.target as HTMLInputElement).checked) {
          this.selectedUnitIds.add(unit.id);
        } else {
          this.selectedUnitIds.delete(unit.id);
        }
         this.render();
      });
    }

    // 顶部：文档名称
    const header = card.createDiv({ cls: 'grid-card-header' });

header.addEventListener('click', () => {
  this.jumpToSource(unit);
});


    // 🔧 添加类型指示器
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

    const fileName = unit.source.file.split('/').pop()?.replace('.md', '') || '';
    header.createSpan({ text: fileName, cls: 'doc-name' });

    // 右上角工具按钮
    const tools = header.createDiv({ cls: 'grid-card-tools' });
    


// 非批量模式下的闪卡按钮
if (!this.batchMode) {
  const flashcardBtn = tools.createDiv({ cls: 'tool-btn-grid' });
  flashcardBtn.innerHTML = '⚡';
  flashcardBtn.setAttribute('aria-label', '生成闪卡');
  flashcardBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    this.quickGenerateFlashcard(unit);
  });
}

    const moreBtn = tools.createDiv({ cls: 'tool-btn-grid' });
    moreBtn.innerHTML = '⋮';
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showContextMenu(e, unit);
    });

    // 笔记内容（点击展开批注编辑）
    const content = card.createDiv({ cls: 'grid-card-content' });
    const noteText = content.createDiv({ cls: 'grid-note-text' });

// 🔧 显示完整内容，不截断
let displayHTML = '';

// 如果是 QA 类型，用不同样式显示问题和答案
if (unit.type === 'QA' && unit.answer) {
  displayHTML = `<span>${unit.content}</span> <span >::</span> <span >${unit.answer}</span>`;
}
// 如果是 cloze 类型，高亮显示答案
else if (unit.type === 'cloze' && unit.fullContext) {
  // 🔧 先去除 fullContext 中的 == 标记
  const context = unit.fullContext;
  const answer = unit.content;
  
  // 然后用 span 高亮答案
  displayHTML = context.replace(
    answer, 
    `<span >${answer}</span>`
  );
}
// 纯文本
else {
  displayHTML = unit.content;
}

noteText.innerHTML = displayHTML;


noteText.addEventListener('click', () => {
  this.toggleInlineAnnotation(card, unit);
});

    // 显示批注
    const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
    if (annotation) {
      const annEl = content.createDiv({ cls: 'grid-annotation' });
      annEl.innerHTML = `<strong>批注：</strong>${annotation.content}`;
      
      // 点击批注也可以展开编辑
      annEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleInlineAnnotation(card, unit);
      });
    }

    // 标签
    if (unit.metadata.tags.length > 0) {
      const tags = content.createDiv({ cls: 'grid-tags' });
      unit.metadata.tags.forEach(tag => {
        tags.createSpan({ text: `#${tag}`, cls: 'tag-grid' });
      });
    }

    // 底部元信息
    const meta = card.createDiv({ cls: 'grid-card-meta' });
    meta.createSpan({ text: `L${unit.source.position.line}`, cls: 'line-info' });
    
    if (unit.flashcardIds.length > 0) {
      meta.createSpan({ text: `🃏 ${unit.flashcardIds.length}`, cls: 'badge-grid' });
    }
  }
/**
 * 渲染闪卡网格卡片（带下拉菜单）
 */
private renderFlashcardGridCard(container: HTMLElement, card: Flashcard) {
  const cardEl = container.createDiv({ cls: 'grid-card flashcard-grid-card' });

  // 批量选择
  if (this.batchMode) {
    const checkbox = cardEl.createEl('input', {
      type: 'checkbox',
      cls: 'batch-checkbox'
    });
    checkbox.setAttribute('data-card-id', card.id);
    checkbox.checked = this.selectedCardIds.has(card.id);
    checkbox.addEventListener('change', (e) => {
      if ((e.target as HTMLInputElement).checked) {
        this.selectedCardIds.add(card.id);
      } else {
        this.selectedCardIds.delete(card.id);
      }
      this.render();
    });
  }

  // 顶部
  const header = cardEl.createDiv({ cls: 'grid-card-header' });
  header.addEventListener('click', async () => {
    const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
    if (unit) {
      await this.jumpToSource(unit);
    } else {
      // 如果找不到笔记单元，尝试直接打开文件
      const file = this.app.vault.getAbstractFileByPath(card.sourceFile);
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf(false).openFile(file);
        new Notice('✅ 已打开源文件');
      } else {
        new Notice('⚠️ 找不到原始笔记');
      }
    }
  });

  const typeLabel = header.createDiv({
    cls: `flashcard-type ${card.type}`,
    text: card.type === 'qa' ? 'Q&A' : '填空'
  });

  // 右上角下拉菜单按钮
  const tools = header.createDiv({ cls: 'grid-card-tools' });
  const moreBtn = tools.createDiv({ cls: 'tool-btn-grid' });
  moreBtn.innerHTML = '⋮';
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    this.showFlashcardContextMenu(e, card);
  });

  // 卡片内容
  const content = cardEl.createDiv({ cls: 'grid-card-content' });
  
  const question = content.createDiv({ cls: 'flashcard-question' });
  question.innerHTML = `<strong>问题：</strong>${card.front}`;
  
  const answer = content.createDiv({ cls: 'flashcard-answer' });
  const answerText = Array.isArray(card.back) ? card.back.join(', ') : card.back;
  answer.innerHTML = `<strong>答案：</strong>${answerText}`;

  // 底部元信息
  const meta = cardEl.createDiv({ cls: 'grid-card-meta' });
  meta.createSpan({
    text: this.formatDate(new Date(card.metadata.createdAt)),
    cls: 'flashcard-date'
  });
}
  /**
   * 渲染闪卡列表
   */
  private renderCardsList(container: HTMLElement) {
    const header = container.createDiv({ cls: 'cards-header' });
    header.createEl('h2', { text: '🃏 所有闪卡' });

    const cardsContainer = container.createDiv({ cls: 'cards-grid' });
    
    const flashcards = this.plugin.flashcardManager.getAllFlashcards();

    
    if (flashcards.length === 0) {
      cardsContainer.createDiv({
        text: '📭 暂无闪卡',
        cls: 'empty-state'
      });
      return;
    }

    flashcards.forEach(card => {
      const cardEl = cardsContainer.createDiv({ cls: 'flashcard-item' });

      // 批量选择模式：添加checkbox
      if (this.batchMode) {
        const checkbox = cardEl.createEl('input', {
          type: 'checkbox',
          cls: 'batch-checkbox'
        });
        checkbox.setAttribute('data-card-id', card.id);
        checkbox.checked = this.selectedCardIds.has(card.id);
        checkbox.addEventListener('change', (e) => {
          if ((e.target as HTMLInputElement).checked) {
            this.selectedCardIds.add(card.id);
          } else {
            this.selectedCardIds.delete(card.id);
          }
          this.render();
        });
      }

      const cardHeader = cardEl.createDiv({ cls: 'flashcard-header' });
      const typeLabel = cardHeader.createDiv({
        cls: `flashcard-type ${card.type}`,
        text: card.type === 'qa' ? 'Q&A' : '填空'
      });
      
      cardHeader.createSpan({
        text: this.formatDate(new Date(card.metadata.createdAt)),
        cls: 'flashcard-date'
      });

      // 添加删除按钮
      const deleteBtn = cardHeader.createEl('button', {
        text: '🗑️',
        cls: 'flashcard-delete-btn'
      });
      deleteBtn.setAttribute('aria-label', '删除闪卡');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('确定要删除这张闪卡吗？')) {
          await this.deleteFlashcard(card.id);
        }
      });

      const cardBody = cardEl.createDiv({ cls: 'flashcard-body' });
      
      const question = cardBody.createDiv({ cls: 'flashcard-question' });
      question.innerHTML = `<strong>问题：</strong>${card.front}`;
      
      const answer = cardBody.createDiv({ cls: 'flashcard-answer' });
      const answerText = Array.isArray(card.back) ? card.back.join(', ') : card.back;
      answer.innerHTML = `<strong>答案：</strong>${answerText}`;
    });
  }

  // ==================== 交互方法 ====================

  /**
   * 切换内联批注编辑器
   */
  private toggleInlineAnnotation(cardEl: HTMLElement, unit: ContentUnit) {
    // 检查是否已经存在编辑器
    let existingEditor = cardEl.querySelector('.inline-annotation-editor') as HTMLElement;
    
    if (existingEditor) {
      // 如果已存在，移除编辑器并恢复批注预览
      existingEditor.remove();
      
      // 恢复批注预览显示
      const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
      if (annotation) {
        const content = cardEl.querySelector('.card-content, .grid-card-content') as HTMLElement;
        const existingPreview = content.querySelector('.annotation-preview, .grid-annotation');
        if (!existingPreview) {
          this.recreateAnnotationPreview(content, cardEl, unit, annotation.content);
        }
      }
      return;
    }

    // 获取现有批注
    const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
    
    // 找到批注预览元素或插入位置
    const content = cardEl.querySelector('.card-content, .grid-card-content') as HTMLElement;
    const annotationPreview = content.querySelector('.annotation-preview, .grid-annotation') as HTMLElement;
    const isGridCard = cardEl.classList.contains('grid-card');
    
    // 如果有批注预览，替换它；否则在合适位置插入
    const editor = document.createElement('div');
    editor.className = 'inline-annotation-editor';
    
    const textarea = document.createElement('textarea');
    textarea.className = 'inline-annotation-textarea';
    textarea.placeholder = 'Add comment...';
    textarea.value = annotation?.content || '';
    textarea.setAttribute('data-unit-id', unit.id);
    
    const hint = document.createElement('div');
    hint.className = 'inline-annotation-hint';
    hint.textContent = 'Shift + Enter 换行';
    
    editor.appendChild(textarea);
    editor.appendChild(hint);
    
    // 替换或插入编辑器
    if (annotationPreview) {
      // 替换批注预览
      annotationPreview.replaceWith(editor);
    } else {
      // 在笔记文本后面插入
      const noteText = content.querySelector('.note-text, .grid-note-text') as HTMLElement;
      if (noteText) {
        noteText.after(editor);
      } else {
        content.appendChild(editor);
      }
    }

    // 自动聚焦
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    

    
// 失焦时自动保存
textarea.addEventListener('blur', async (e) => {
  // 如果点击的是其他元素，自动保存
  const relatedTarget = e.relatedTarget as HTMLElement;
  if (!relatedTarget || !editor.contains(relatedTarget)) {
    // 延迟保存，确保编辑器还在 DOM 中
    setTimeout(async () => {
      if (editor.parentElement) {
        await this.saveInlineAnnotation(editor, unit, textarea.value);
      }
    }, 100);
  }
});

// Tab 键保存
textarea.addEventListener('keydown', async (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    await this.saveInlineAnnotation(editor, unit, textarea.value);
  }
});
  }
  
  /**
   * 保存内联批注
   */
  private async saveInlineAnnotation(editorEl: HTMLElement, unit: ContentUnit, text: string) {
    
    const trimmedText = text.trim();
    const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
    
    if (trimmedText) {
      if (annotation) {
        await this.plugin.annotationManager.updateAnnotation(annotation.id, {
          content: trimmedText
        });
      } else {
        await this.plugin.annotationManager.addContentAnnotation(unit.id, trimmedText);
      }
    } else if (annotation) {
      await this.plugin.annotationManager.deleteAnnotation(annotation.id);
      new Notice('🗑️ 批注已删除');
    }
    
    const card = editorEl.closest('.compact-card, .grid-card') as HTMLElement;
    
    editorEl.remove();
    
    if (trimmedText && card) {
      const content = card.querySelector('.card-content, .grid-card-content') as HTMLElement;
      
      if (content) {
        this.recreateAnnotationPreview(content, card, unit, trimmedText);
              // 🔧 新增：更新 indicator
      const indicator = card.querySelector('.card-indicator') as HTMLElement;
      if (indicator && !indicator.classList.contains('has-annotation')) {
        indicator.classList.add('has-annotation');
      }
    }
  } else if (!trimmedText && card) {
    // 🔧 如果删除了批注，移除 indicator 的批注样式
    const indicator = card.querySelector('.card-indicator') as HTMLElement;
    if (indicator && indicator.classList.contains('has-annotation')) {
      indicator.classList.remove('has-annotation');
      }
    }
  }
  
  /**
   * 取消内联批注编辑
   */
  private cancelInlineAnnotation(editorEl: HTMLElement, cardEl: HTMLElement, unit: ContentUnit) {
    // 移除编辑器
    editorEl.remove();
    
    // 恢复批注预览（如果有）
    const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
    if (annotation) {
      const content = cardEl.querySelector('.card-content, .grid-card-content') as HTMLElement;
      this.recreateAnnotationPreview(content, cardEl, unit, annotation.content);
    }
  }
  
  /**
   * 重新创建批注预览
   */
  private recreateAnnotationPreview(
    contentEl: HTMLElement, 
    cardEl: HTMLElement, 
    unit: ContentUnit, 
    annotationText: string
  ) {
    
    const existingPreview = contentEl.querySelector('.annotation-preview, .grid-annotation');
    if (existingPreview) {
      existingPreview.remove();
    }
    
    const isGridCard = cardEl.classList.contains('grid-card');
    const annEl = document.createElement('div');
    annEl.className = isGridCard ? 'grid-annotation' : 'annotation-preview';
    
    if (isGridCard) {
      annEl.innerHTML = `<strong>批注：</strong>${annotationText}`;
    } else {
      const displayText = annotationText.length > 60
        ? annotationText.substring(0, 60) + '...'
        : annotationText;
      annEl.textContent = `💬 ${displayText}`;
    }
    
    
    // 点击事件
    annEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleInlineAnnotation(cardEl, unit);
    });
    
    // 🔧 新增：Tab 键事件
    annEl.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        this.toggleInlineAnnotation(cardEl, unit);
      }
    });
    
    const noteText = contentEl.querySelector('.note-text, .grid-note-text') as HTMLElement;
    if (noteText) {
      noteText.insertAdjacentElement('afterend', annEl);
      
      const inserted = contentEl.querySelector('.annotation-preview, .grid-annotation');
    } else {
      contentEl.appendChild(annEl);
    }
    
    
    // 🔧 设置 tabindex 使其可以接收焦点
    annEl.setAttribute('tabindex', '0');
    annEl.focus();
    
  }

  /**
   * 打开批注编辑器（模态框方式，保留用于右键菜单）
   */
  private async openAnnotationEditor(unit: ContentUnit) {
    const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
    const existingText = annotation?.content || '';

    const modal = new AnnotationModal(
      this.app,
      existingText,
      async (newText: string) => {
        if (newText.trim()) {
          if (annotation) {
            await this.plugin.annotationManager.updateAnnotation(annotation.id, {
              content: newText
            });
          } else {
            await this.plugin.annotationManager.addContentAnnotation(unit.id, newText);
          }
          new Notice('✅ 批注已保存');
        } else if (annotation) {
          await this.plugin.annotationManager.deleteAnnotation(annotation.id);
          new Notice('🗑️ 批注已删除');
        }
        this.refresh();
      }
    );

    modal.open();
  }

  /**
   * 跳转到原文
   */
  private async jumpToSource(unit: ContentUnit) {

    
    const file = this.app.vault.getAbstractFileByPath(unit.source.file);
    if (!(file instanceof TFile)) {
      new Notice('⚠️ 文件不存在');
      return;
    }
  
    // 标记需要恢复滚动
    this.shouldRestoreScroll = true;

    
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

  /**
   * 快速生成闪卡
   */
  private async quickGenerateFlashcard(unit: ContentUnit) {
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
  /**
 * 显示批量操作菜单
 */
private showBatchMenu(event: MouseEvent, unit?: ContentUnit) {
  const menu = new Menu();



  // 已经在批量模式，显示批量操作选项
  menu.addItem((item) =>
    item
      .setTitle(this.isAllSelected() ? '☑ select' : '☐ AllSelect')
      .setIcon('check-square')
      .onClick(() => {
        this.toggleSelectAll();
      })
  );

  menu.addSeparator();

  if (this.viewType === 'notes') {
    menu.addItem((item) =>
      item
        .setTitle(`⚡ 批量制卡 (${this.selectedUnitIds.size})`)
        .setIcon('zap')
        .onClick(() => {
          this.batchCreateFlashcards();
        })
    );
  }

  menu.addItem((item) =>
    item
      .setTitle(`🗑️ 删除选中 (${this.viewType === 'cards' ? this.selectedCardIds.size : this.selectedUnitIds.size})`)
      .setIcon('trash')
      .onClick(() => {
        if (this.viewType === 'cards') {
          this.batchDeleteFlashcards();
        } else {
          this.batchDeleteNotes();
        }
      })
  );

  menu.addSeparator();

  menu.addItem((item) =>
    item
      .setTitle('✓ 退出批量模式')
      .setIcon('x')
      .onClick(() => {
        this.batchMode = false;
        this.selectedUnitIds.clear();
        this.selectedCardIds.clear();
        this.render();
      })
  );

  menu.showAtMouseEvent(event);
}

  /**
   * 显示上下文菜单
   */
  private showContextMenu(event: MouseEvent, unit: ContentUnit) {
    const menu = new Menu();

    menu.addItem((item) =>
      item
        .setTitle('📖 跳转到原文')
        .setIcon('arrow-up-right')
        .onClick(() => this.jumpToSource(unit))
    );

    menu.addItem((item) =>
      item
        .setTitle('💬 编辑批注')
        .setIcon('message-square')
        .onClick(() => this.openAnnotationEditor(unit))
    );

    menu.addSeparator();
    if (unit.flashcardIds.length > 0) {
      menu.addItem((item) =>
        item
          .setTitle('✏️ 编辑闪卡')
          .setIcon('edit')
          .onClick(() => this.editFlashcardsForUnit(unit,event))
      );
      menu.addSeparator();
    }
    menu.addItem((item) =>
      item
        .setTitle('⚡ 生成闪卡')
        .setIcon('zap')
        .onClick(() => this.quickGenerateFlashcard(unit))
    );
  
    menu.addItem((item) =>
      item
        .setTitle('➕ 创建 QA 闪卡')
        .setIcon('plus')
        .onClick(async () => {
          await this.createFlashcard(unit, 'qa');
        })
    );

    menu.addItem((item) =>
      item
        .setTitle('➕ 创建填空闪卡')
        .setIcon('plus')
        .onClick(async () => {
          await this.createFlashcard(unit, 'cloze');
        })
    );

    menu.addSeparator();

    menu.addItem((item) =>
      item
        .setTitle('查看统计')
        .setIcon('bar-chart')
        .onClick(() => {
          this.plugin.activateStats();
        })
    );

    menu.addSeparator();

    menu.addItem((item) =>
      item
        .setTitle('🗑️ 删除笔记')
        .setIcon('trash')
        .onClick(async () => {
          if (confirm('确定要删除这条笔记吗？')) {
            // 🔧 先删除关联的闪卡
            if (unit.flashcardIds.length > 0) {
              for (const cardId of unit.flashcardIds) {
                await this.plugin.flashcardManager.deleteCard(cardId);
              }
            }
            
            // 再删除笔记
            await this.plugin.dataManager.deleteContentUnit(unit.id);
            new Notice('🗑️ 笔记已删除');
            this.refresh();
          }
        })
    );

    menu.showAtMouseEvent(event);
  }
/**
 * 编辑笔记单元关联的闪卡
 */
private editFlashcardsForUnit(unit: ContentUnit, event?: MouseEvent) {
  if (unit.flashcardIds.length === 0) {
    new Notice('⚠️ 该笔记没有关联的闪卡');
    return;
  }

  // 如果只有一张闪卡,直接编辑
  if (unit.flashcardIds.length === 1) {
    const allCards = this.plugin.flashcardManager.getAllFlashcards();
    const card = allCards.find(c => c.id === unit.flashcardIds[0]);
    if (card) {
      this.editFlashcard(card);
    } else {
      new Notice('⚠️ 找不到该闪卡');
    }
    return;
  }

  // 如果有多张闪卡,显示选择菜单
  const menu = new Menu();
  const allCards = this.plugin.flashcardManager.getAllFlashcards();
  
  unit.flashcardIds.forEach((cardId, index) => {
    const card = allCards.find(c => c.id === cardId);
    if (card) {
      const typeLabel = card.type === 'qa' ? 'Q&A' : '填空';
      const preview = card.front.length > 30 
        ? card.front.substring(0, 30) + '...' 
        : card.front;
      
      menu.addItem((item) =>
        item
          .setTitle(`${index + 1}. ${typeLabel}: ${preview}`)
          .onClick(() => this.editFlashcard(card))
      );
    }
  });

  // 在鼠标位置显示菜单
  if (event) {
    menu.showAtMouseEvent(event);
  } else {
    menu.showAtPosition({ x: 100, y: 100 }); // 默认位置
  }
}
/**
 * 显示闪卡上下文菜单
 */
private showFlashcardContextMenu(event: MouseEvent, card: Flashcard) {
  const menu = new Menu();

  // 跳转到原文
  menu.addItem((item) =>
    item
      .setTitle('📖 跳转到原文')
      .setIcon('arrow-up-right')
      .onClick(async () => {
        // 修改：使用 sourceContentId
        const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
        if (unit) {
          await this.jumpToSource(unit);
        } else {
          // 如果找不到笔记单元，尝试直接打开文件
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
      .setIcon('edit')
      .onClick(() => {
        this.editFlashcard(card);
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

  // 删除卡片
  menu.addItem((item) =>
    item
      .setTitle('🗑️ 删除卡片')
      .setIcon('trash')
      .onClick(async () => {
        if (confirm('确定要删除这张闪卡吗？')) {
          await this.deleteFlashcard(card.id);
        }
      })
  );

  menu.showAtMouseEvent(event);
}
  /**
   * 创建特定类型的闪卡
   */
  private async createFlashcard(unit: ContentUnit, type: 'qa' | 'cloze') {
    const modal = new FlashcardCreationModal(
      this.app,
      unit,
      type,
      async (question: string, answer: string) => {
        try {
          if (type === 'qa') {
            // 创建问答卡
            await this.plugin.flashcardManager.createQACard(
              unit.id,
              question,
              answer
            );
          } else {
            // 创建完形填空卡 - 简单处理，将整个答案作为一个空
            const deletions = [{
              index: 0,
              answer: answer
            }];
            await this.plugin.flashcardManager.createClozeCard(
              unit.id,
              question,
              deletions
            );
          }
          
          new Notice(`✅ ${type === 'qa' ? 'QA' : '填空'}闪卡已创建`);
          this.refresh();
        } catch (error) {
          console.error('Error creating flashcard:', error);
          new Notice('❌ 创建闪卡失败');
        }
      }
    );

    modal.open();
  }

  /**
   * 在编辑器中打开文件
   */
  private async openFileInEditor(filePath: string) {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
    } else {
      new Notice('⚠️ 无法打开文件');
    }
  }

  /**
   * 删除闪卡
   */
  private async deleteFlashcard(cardId: string) {
    try {
      await this.plugin.flashcardManager.deleteCard(cardId);
      new Notice('🗑️ 闪卡已删除');
      this.refresh();
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      new Notice('❌ 删除闪卡失败');
    }
  }
/**
 * 编辑闪卡
 */
private editFlashcard(card: Flashcard) {
  const modal = new FlashcardEditModal(
    this.app,
    card,
    async (question: string, answer: string) => {
      try {
        // 创建更新后的卡片对象
        const updatedCard: Flashcard = {
          ...card,
          front: question,
          back: card.type === 'cloze' ? [answer] : answer,
          metadata: {
            ...card.metadata,
            updatedAt: Date.now()
          }
        };
        
        // 如果 updateCard 只接受一个参数
        await this.plugin.flashcardManager.updateCard(updatedCard);
        
        new Notice('✅ 闪卡已更新');
        this.refresh();
      } catch (error) {
        console.error('Error updating flashcard:', error);
        new Notice('❌ 更新闪卡失败');
      }
    }
  );
  modal.open();
}
  /**
   * 更新批量操作按钮
   */
  private updateBatchButtons() {
    const container = this.containerEl.children[1] as HTMLElement;
    const batchActions = container.querySelector('.batch-actions') as HTMLElement;
    if (batchActions) {
      const selectAllBtn = batchActions.querySelector('.select-all-btn') as HTMLElement;
      const deleteBtn = batchActions.querySelector('.batch-delete-btn') as HTMLElement;
      const createBtn = batchActions.querySelector('.batch-create-cards-btn') as HTMLElement;
      
      if (selectAllBtn) {
        selectAllBtn.textContent = this.isAllSelected() ? '☑ 选择' : '☐ 全选';
      }
      
      if (deleteBtn) {
        const count = this.viewType === 'cards' ? this.selectedCardIds.size : this.selectedUnitIds.size;
        deleteBtn.textContent = `🗑️ 删除选中 (${count})`;
      }
      
      if (createBtn) {
        createBtn.textContent = `⚡ 批量制卡 (${this.selectedUnitIds.size})`;
      }
    }
      // 更新 header 中的全选按钮
  const headerSelectBtn = container.querySelector('.select-all-btn-header') as HTMLElement;
  if (headerSelectBtn) {
    headerSelectBtn.textContent = this.isAllSelected() ? '☑ 选择' : '☐ 全选';
  }
  
  // 更新侧边栏中的全选按钮
  const sidebarSelectBtn = container.querySelector('.select-all-btn-sidebar') as HTMLElement;
  if (sidebarSelectBtn) {
    sidebarSelectBtn.textContent = this.isAllSelected() ? '☑ 选择' : '☐ 全选';
  }
  }

  /**
   * 批量删除闪卡
   */
  private async batchDeleteFlashcards() {
    if (this.selectedCardIds.size === 0) {
      new Notice('⚠️ 请先选择要删除的闪卡');
      return;
    }

    if (!confirm(`确定要删除选中的 ${this.selectedCardIds.size} 张闪卡吗？`)) {
      return;
    }

    let success = 0;
    let failed = 0;

    for (const cardId of this.selectedCardIds) {
      try {
        await this.plugin.flashcardManager.deleteCard(cardId);
        success++;
      } catch (error) {
        console.error('Error deleting flashcard:', error);
        failed++;
      }
    }

    this.selectedCardIds.clear();
    new Notice(`✅ 已删除 ${success} 张闪卡${failed > 0 ? `，${failed} 张失败` : ''}`);
    this.refresh();
  }

/**
 * 批量删除笔记
 */
private async batchDeleteNotes() {
  if (this.selectedUnitIds.size === 0) {
    new Notice('⚠️ 请先选择要删除的笔记');
    return;
  }

  if (!confirm(`确定要删除选中的 ${this.selectedUnitIds.size} 条笔记吗？`)) {
    return;
  }

  let success = 0;
  let failed = 0;

  for (const unitId of this.selectedUnitIds) {
    try {
      // 🔧 获取笔记
      const unit = this.plugin.dataManager.getContentUnit(unitId);
      
      if (unit) {
        // 🔧 先删除关联的闪卡
        if (unit.flashcardIds.length > 0) {
          for (const cardId of unit.flashcardIds) {
            await this.plugin.flashcardManager.deleteCard(cardId);
          }
        }
      }
      
      // 再删除笔记
      await this.plugin.dataManager.deleteContentUnit(unitId);
      success++;
    } catch (error) {
      console.error('Error deleting note:', error);
      failed++;
    }
  }

  this.selectedUnitIds.clear();
  this.batchMode = false;
  new Notice(`✅ 已删除 ${success} 条笔记${failed > 0 ? `，${failed} 条失败` : ''}`);
  this.refresh();
}

  /**
   * 检查是否全选
   */
  private isAllSelected(): boolean {
    const visible = this.getVisibleItems();
    
    if (this.viewType === 'cards') {
      const cards = visible.cards || [];
      return cards.length > 0 && this.selectedCardIds.size === cards.length;
    } else {
      const units = visible.units || [];
      return units.length > 0 && this.selectedUnitIds.size === units.length;
    }
  }

  /**
   * 切换全选/取消
   */
 /**
 * 切换全选/取消
 */
/**
 * 全选当前可见项
 */
private toggleSelectAll() {
  console.log('🔍 [toggleSelectAll] ========== 开始执行 ==========');
  
  const visible = this.getVisibleItems();
  
  if (this.viewType === 'cards') {
    const cards = visible.cards || [];
    
    if (cards.length === 0) {
      new Notice('⚠️ 没有可选择的闪卡');
      return;
    }
    
    // 🔧 改为：只执行全选，不做取消
    cards.forEach(card => this.selectedCardIds.add(card.id));
    
  } else {
    const units = visible.units || [];
    
    if (units.length === 0) {
      if (this.displayMode === 'sidebar' && (this.groupMode === 'tag' || this.groupMode === 'date')) {
        new Notice('⚠️ 没有可选择的笔记');
      } else if (this.groupMode === 'annotation' && !this.selectedFile) {
        new Notice('⚠️ 请先选择"有批注"或"无批注"分组');
      } else if (this.displayMode === 'main' && !this.selectedFile) {
        new Notice('⚠️ 请先选择一个分组');
      } else {
        new Notice('⚠️ 没有可选择的笔记');
      }
      return;
    }
    
    // 🔧 改为：只执行全选，不做取消
    units.forEach(unit => this.selectedUnitIds.add(unit.id));
  }
  
  this.batchMode = true;
  this.render();
}

/**
 * 取消全选（仅取消全选状态，保持批量模式）
 */
private cancelSelectAll() {
  // 获取当前可见的所有项
  const visible = this.getVisibleItems();
  
  if (this.viewType === 'cards') {
    const cards = visible.cards || [];
    // 从选中集合中移除当前可见的所有卡片
    cards.forEach(card => this.selectedCardIds.delete(card.id));
  } else {
    const units = visible.units || [];
    // 从选中集合中移除当前可见的所有笔记
    units.forEach(unit => this.selectedUnitIds.delete(unit.id));
  }
  
  // 🔧 关键修改：不退出批量模式，即使选中数为0
  // 保持 batchMode = true，让用户可以继续手动选择
  
  this.render();
}
  /**
 * 自动全选当前可见项目
 */
  private autoSelectAll() {
    this.selectedUnitIds.clear();
    this.selectedCardIds.clear();
    
    const visible = this.getVisibleItems();
    
    if (this.viewType === 'cards') {
      const cards = visible.cards || [];
      cards.forEach(card => this.selectedCardIds.add(card.id));
    } else {
      const units = visible.units || [];
      units.forEach(unit => this.selectedUnitIds.add(unit.id));
    }
    
    if (this.selectedUnitIds.size > 0 || this.selectedCardIds.size > 0) {
      this.batchMode = true;
    }
  }
/**
 * 清除所有选择
 */
private clearSelection() {
  this.selectedUnitIds.clear();
  this.selectedCardIds.clear();
  this.batchMode = false;
  this.render();
}
  /**
   * 更新所有checkbox状态
   */
  private updateCheckboxes() {
    const container = this.containerEl.children[1] as HTMLElement;
    const checkboxes = container.querySelectorAll('.batch-checkbox') as NodeListOf<HTMLInputElement>;
    
    checkboxes.forEach(checkbox => {
      if (this.viewType === 'cards') {
        const cardId = checkbox.getAttribute('data-card-id');
        if (cardId) {
          checkbox.checked = this.selectedCardIds.has(cardId);
        }
      } else {
        const unitId = checkbox.getAttribute('data-unit-id');
        if (unitId) {
          checkbox.checked = this.selectedUnitIds.has(unitId);
        }
      }
    });
  }

  /**
   * 批量创建闪卡
   */
  private async batchCreateFlashcards() {
    if (this.selectedUnitIds.size === 0) {
      new Notice('⚠️ 请先选择要创建闪卡的笔记');
      return;
    }

    const units = Array.from(this.selectedUnitIds)
      .map(id => this.plugin.dataManager.getContentUnit(id))
      .filter(u => u !== undefined && u.flashcardIds.length === 0) as ContentUnit[];

    if (units.length === 0) {
      new Notice('⚠️ 选中的笔记都已创建过闪卡');
      return;
    }

    // 显示选择类型的模态框
    const { BatchCreateModal } = await import('./OverviewView');
    const quickCreator = new QuickFlashcardCreator(this.plugin);
    const modal = new BatchCreateModal(
      this.app,
      this.plugin,
      quickCreator,
      units,
      () => {
        this.selectedUnitIds.clear();
        this.refresh();
      }
    );
    modal.open();
  }

  // ==================== 工具方法 ====================

  /**
   * 获取过滤后的内容单元
   */
  private getFilteredUnits(): ContentUnit[] {
    let units = this.plugin.dataManager.getAllContentUnits();

    // 搜索过滤
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      units = units.filter(unit =>
        unit.content.toLowerCase().includes(query) ||
        unit.source.file.toLowerCase().includes(query) ||
        unit.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // 类型过滤
    if (this.filterMode === 'annotated') {
      units = units.filter(u => u.annotationId);
    } else if (this.filterMode === 'flashcards') {
      units = units.filter(u => u.flashcardIds.length > 0);
    }

    return units;
  }

  /**
   * 分组内容单元
   */
  private groupUnits(units: ContentUnit[]): Array<{ groupKey: string; units: ContentUnit[] }> {
    const grouped = new Map<string, ContentUnit[]>();

    units.forEach(unit => {
      let key: string;

      switch (this.groupMode) {
        case 'file':
          key = unit.source.file;
          break;
          case 'annotation':
  // 按是否有批注分组
  const hasAnnotation = unit.annotationId ? '有批注' : '无批注';
  if (!grouped.has(hasAnnotation)) grouped.set(hasAnnotation, []);
  grouped.get(hasAnnotation)!.push(unit);
  return;
        case 'tag':
          unit.metadata.tags.forEach(tag => {
            if (!grouped.has(tag)) grouped.set(tag, []);
            grouped.get(tag)!.push(unit);
          });
          return;
        case 'date':
          key = this.formatDate(new Date(unit.metadata.createdAt));
          break;
        default:
          key = '未分组';
      }

      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(unit);
    });

    return Array.from(grouped.entries())
    .map(([groupKey, units]) => ({ groupKey, units }))
    .sort((a, b) => {
        // 如果是批注分组，"有批注"排在前面
  if (this.groupMode === 'annotation') {
    if (a.groupKey === '有批注') return -1;
    if (b.groupKey === '有批注') return 1;
    return 0;
  }
      // 如果是日期分组，按日期降序排列
      if (this.groupMode === 'date') {
        return b.groupKey.localeCompare(a.groupKey); // 日期字符串降序
      }
      // 其他分组按数量降序
      return b.units.length - a.units.length;
    });
  }
/**
 * 分组闪卡（类似 groupUnits）
 */
private groupFlashcards(flashcards: Flashcard[]): Array<{ groupKey: string; cards: Flashcard[] }> {
  const grouped = new Map<string, Flashcard[]>();

  flashcards.forEach(card => {
    let keys: string[] = [];
    
    // 获取关联的笔记单元
    const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);

    switch (this.groupMode) {
      case 'file':
        keys = [card.sourceFile];
        break;

      case 'annotation':
        // ✅ 删除这行重复声明
        // const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
        if (unit && unit.annotationId) {
          keys = ['有批注'];
        } else {
          keys = ['无批注'];
        }
        break;
      
      case 'tag':
        // 优先使用笔记单元的标签
        if (unit && unit.metadata.tags.length > 0) {
          keys = unit.metadata.tags;
        }   
        // 其次使用卡片自己的标签
        else if (card.tags && card.tags.length > 0) {
          keys = card.tags;
        } 
        // 最后使用 deck 作为标签
        else if (card.deck) {
          keys = [card.deck];
        }
        // 如果都没有，放入"未分类"
        else {
          keys = ['未分类'];
        }
        break;
        
      case 'date':
        keys = [this.formatDate(new Date(card.metadata.createdAt))];
        break;
        
      default:
        keys = ['未分组'];
    }

    // 将卡片添加到所有匹配的分组中
    keys.forEach(key => {
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(card);
    });
  });

  // 转换为数组并排序
  const result = Array.from(grouped.entries())
    .map(([groupKey, cards]) => ({ groupKey, cards }))
    .sort((a, b) => {
      // 如果是批注分组，"有批注"排在前面
      if (this.groupMode === 'annotation') {
        if (a.groupKey === '有批注') return -1;
        if (b.groupKey === '有批注') return 1;
        return 0;
      }

      // 如果是日期分组，按日期降序排列
      if (this.groupMode === 'date') {
        return b.groupKey.localeCompare(a.groupKey);
      }
      // 其他分组按数量降序
      return b.cards.length - a.cards.length;
    });

  return result;
}
  /**
   * 获取统计信息
   */
  private getFilteredStats() {
    const units = this.getFilteredUnits();
    return {
      count: units.length,
      withAnnotations: units.filter(u => u.annotationId).length,
      withFlashcards: units.filter(u => u.flashcardIds.length > 0).length
    };
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  /**
   * 获取分组图标
   */
  private getGroupIcon(mode: GroupMode): string {
    switch (mode) {
      case 'file': return '📄';
      case 'annotation': return '💬';
      case 'tag': return '🏷️';
      case 'date': return '📅';
      default: return '📁';
    }
  }

  /**
 * 创建全选按钮（统一样式和行为）
 */
  private createSelectAllButton(container: HTMLElement, styleClass: 'sidebar' | 'header'): HTMLElement {
    const btnClass = styleClass === 'sidebar' 
      ? 'select-all-btn-sidebar' 
      : 'select-all-btn-header';
    
    const isAllChecked = this.isAllSelected();
    const visible = this.getVisibleItems();
    
    const itemCount = this.viewType === 'cards' 
      ? (visible.cards?.length || 0) 
      : (visible.units?.length || 0);
    
    // 🔧 修改按钮文本逻辑
    const selectAllBtn = container.createEl('button', {
      text: isAllChecked ? '✓ 取消全选' : '☐ 全选',  // 改为"取消全选"
      cls: `${btnClass} ${isAllChecked ? 'completed' : ''}`,
      title: isAllChecked ? '取消当前页面的全选' : `全选当前 ${itemCount} 项`
    });
    
    const shouldDisable = (
      itemCount === 0 ||
      (this.groupMode === 'annotation' && this.displayMode === 'main' && !this.selectedFile)
    );
    
    if (shouldDisable) {
      selectAllBtn.disabled = true;
      selectAllBtn.style.opacity = '0.5';
      selectAllBtn.style.cursor = 'not-allowed';
      selectAllBtn.title = itemCount === 0 
        ? '没有可选项' 
        : '请先选择"有批注"或"无批注"';
    }
    
    // 🔧 修改点击事件
    selectAllBtn.addEventListener('click', () => {
      if (isAllChecked) {
        this.cancelSelectAll();  // 如果已全选，执行取消全选
      } else {
        this.toggleSelectAll();  // 否则执行全选
      }
    });
    
    return selectAllBtn;
  }
/**
 * 创建批量操作按钮组（制卡、删除、取消）
 */
private createBatchActionButtons(
  container: HTMLElement, 
  styleClass: 'sidebar' | 'header'
): void {
  if (!this.batchMode) return;
  
  const btnPrefix = styleClass === 'sidebar' ? 'sidebar' : 'header';
  
  // 制卡按钮（仅笔记视图）
  if (this.viewType === 'notes') {
    const createBtn = container.createEl('button', {
      text: styleClass === 'sidebar' 
        ? `⚡(${this.selectedUnitIds.size})` 
        : `⚡ 批量制卡 (${this.selectedUnitIds.size})`,
      cls: `batch-create-cards-btn-${btnPrefix}`,
      title: '批量制卡'
    });
    createBtn.addEventListener('click', () => {
      if (this.selectedUnitIds.size === 0) {
        new Notice('⚠️ 请先选择要创建闪卡的笔记');
        return;
      }
      this.batchCreateFlashcards();
    });
  }
  
  // 删除按钮
  const count = this.viewType === 'cards' 
    ? this.selectedCardIds.size 
    : this.selectedUnitIds.size;
  
  const deleteBtn = container.createEl('button', {
    text: styleClass === 'sidebar' 
      ? `🗑️(${count})` 
      : `🗑️ 删除 (${count})`,
    cls: `batch-delete-btn-${btnPrefix}`,
    title: '批量删除'
  });
  deleteBtn.addEventListener('click', () => {
    if (count === 0) {
      new Notice('⚠️ 请先选择要删除的项目');
      return;
    }
    if (this.viewType === 'cards') {
      this.batchDeleteFlashcards();
    } else {
      this.batchDeleteNotes();
    }
  });
  
// 取消按钮（完全退出批量模式）
const cancelBtn = container.createEl('button', {
  text: styleClass === 'sidebar' ? '✕' : '✕ 退出',  // 改为更明确的"退出"
  cls: `cancel-selection-btn-${btnPrefix}`,
  title: '退出批量模式并清空所有选择'  // 改为更明确的提示
});
cancelBtn.addEventListener('click', () => {
  this.clearSelection();  // 完全清空
});
}

// 提取全选功能
/**
 * 获取当前可见的所有项（笔记或闪卡）
 */
private getVisibleItems(): { units?: ContentUnit[]; cards?: Flashcard[] } {
  console.log('🔍 [getVisibleItems] ========== 开始执行 ==========');
  console.log('🔍 [getVisibleItems] viewType:', this.viewType);
  console.log('🔍 [getVisibleItems] displayMode:', this.displayMode);
  console.log('🔍 [getVisibleItems] groupMode:', this.groupMode);
  console.log('🔍 [getVisibleItems] selectedFile:', this.selectedFile);

  if (this.viewType === 'cards') {
    // 闪卡视图逻辑
    const allFlashcards = this.plugin.flashcardManager.getAllFlashcards();
    
    if (this.displayMode === 'sidebar') {
      // 侧边栏模式：返回所有闪卡或当前分组的闪卡
      if (!this.selectedFile) {
        return { cards: allFlashcards };
      }
      
      const filteredCards = allFlashcards.filter(card => {
        if (this.groupMode === 'file') {
          return card.sourceFile === this.selectedFile;
        } else if (this.groupMode === 'annotation') {
          const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
          const hasAnnotation = this.selectedFile === '有批注';
          return hasAnnotation ? (unit && !!unit.annotationId) : (!unit || !unit.annotationId);
        } else if (this.groupMode === 'tag') {
          const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
          return (unit && unit.metadata.tags.includes(this.selectedFile!)) ||
                 (card.tags && card.tags.includes(this.selectedFile!)) ||
                 (card.deck === this.selectedFile);
        } else if (this.groupMode === 'date') {
          return this.formatDate(new Date(card.metadata.createdAt)) === this.selectedFile;
        }
        return false;
      });
      return { cards: filteredCards };
    } else {
      // 主界面模式
      if (!this.selectedFile) {
        return { cards: [] };
      }
      
      const filteredCards = allFlashcards.filter(card => {
        if (this.groupMode === 'file') {
          return card.sourceFile === this.selectedFile;
        } else if (this.groupMode === 'annotation') {
          const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
          const hasAnnotation = this.selectedFile === '有批注';
          return hasAnnotation ? (unit && !!unit.annotationId) : (!unit || !unit.annotationId);
        } else if (this.groupMode === 'tag') {
          const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
          return (unit && unit.metadata.tags.includes(this.selectedFile!)) ||
                 (card.tags && card.tags.includes(this.selectedFile!)) ||
                 (card.deck === this.selectedFile) ||
                 (this.selectedFile === '未分类' && 
                  (!card.tags || card.tags.length === 0) && 
                  !card.deck &&
                  (!unit || !unit.metadata.tags || unit.metadata.tags.length === 0));
        } else if (this.groupMode === 'date') {
          return this.formatDate(new Date(card.metadata.createdAt)) === this.selectedFile;
        }
        return false;
      });
      return { cards: filteredCards };
    }
  } else {
    // 笔记视图
    let units = this.getFilteredUnits();
    console.log('🔍 [getVisibleItems] 初始 getFilteredUnits() 返回数量:', units.length);
    
    if (this.displayMode === 'sidebar') {
      console.log('🔍 [getVisibleItems] 进入侧边栏模式处理');
      
      if (!this.selectedFile) {
        console.log('🔍 [getVisibleItems] selectedFile 不存在，返回空数组');
        return { units: [] };
      }
      
      console.log('🔍 [getVisibleItems] selectedFile 存在:', this.selectedFile);
      
      // 🔧 所有模式都只显示当前文件的笔记
      units = units.filter(unit => unit.source.file === this.selectedFile);
      console.log('🔍 [getVisibleItems] 按当前文件过滤后数量:', units.length);
      
      // 🔧 如果是 annotation 模式，还需要按批注状态再过滤一次
      if (this.groupMode === 'annotation') {
        const hasAnnotation = units.some(u => !!u.annotationId);
        // annotation 模式在侧边栏不使用 '有批注'/'无批注' 这样的 selectedFile
        // 而是显示当前文件的所有笔记，按是否有批注分组
        // 所以这里不需要额外过滤
        console.log('🔍 [getVisibleItems] annotation 模式，保持当前文件所有笔记');
      }
      
      console.log('🔍 [getVisibleItems] 侧边栏最终返回 units 数量:', units.length);
      return { units };
    } else {
      // 主界面模式
      console.log('🔍 [getVisibleItems] 进入主界面模式处理');
      
      if (!this.selectedFile) {
        console.log('🔍 [getVisibleItems] selectedFile 不存在，返回空数组');
        return { units: [] };
      }
      
      if (this.groupMode === 'file') {
        units = units.filter(unit => unit.source.file === this.selectedFile);
      } else if (this.groupMode === 'annotation') {
        const hasAnnotation = this.selectedFile === '有批注';
        units = units.filter(unit => hasAnnotation ? !!unit.annotationId : !unit.annotationId);
      } else if (this.groupMode === 'tag') {
        units = units.filter(unit => unit.metadata.tags.includes(this.selectedFile!));
      } else if (this.groupMode === 'date') {
        units = units.filter(unit => 
          this.formatDate(new Date(unit.metadata.createdAt)) === this.selectedFile
        );
      }
      
      console.log('🔍 [getVisibleItems] 主界面最终返回 units 数量:', units.length);
      return { units };
    }
  }
}




  /**
   * 添加样式
   */
  private addStyles() {
    if (document.getElementById('learning-overview-styles')) {
      return;
    }
    const styleEl = document.createElement('style');
    styleEl.id = 'learning-overview-styles';
    
    // 检查是否已经添加
    if (document.getElementById('learning-overview-styles')) {
      return;
    }

    styleEl.textContent = `
      /* ==================== 全局容器 ==================== */
      .learning-overview-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: var(--background-primary);
      }

      /* ==================== 侧边栏模式样式 ==================== */
      .learning-overview-container[data-mode="sidebar"] {
        padding: 0;
      }

      .sidebar-toolbar {
        padding: 12px;
        border-bottom: 1px solid var(--background-modifier-border);
        background: var(--background-primary);
        flex-shrink: 0;
          position: relative; /* 🔧 添加 */
  z-index: 10;
      }

      .search-container {
        margin-bottom: 10px;
      }

      .search-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        font-size: 13px;
        background: var(--background-primary);
        color: var(--text-normal);
      }

      .search-input:focus {
        outline: none;
        border-color: var(--interactive-accent);
      }

      .filter-chips {
        display: flex;
        gap: 6px;
        margin-bottom: 10px;
      }

      .filter-chip {
        flex: 1;
        text-align: center;
        padding: 6px 8px;
        font-size: 11px;
        border-radius: 12px;
        background: var(--background-secondary);
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
      }

      .filter-chip:hover {
        background: var(--background-modifier-hover);
      }

      .filter-chip.active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        font-weight: 600;
        border-color: var(--interactive-accent);
      }

      .group-switcher {
        display: flex;
        gap: 6px;
        margin-bottom: 10px;
      }

      .group-btn {
        flex: 1;
        text-align: center;
        padding: 6px;
        font-size: 16px;
        border-radius: 6px;
        background: var(--background-secondary);
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid transparent;
      }

      .group-btn:hover {
        background: var(--background-modifier-hover);
      }

      .group-btn.active {
        background: var(--interactive-accent);
        border-color: var(--interactive-accent);
        transform: scale(1.05);
      }
/* 在 .stats-badge 样式之前添加 */
.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3px;
}
/* 头部操作按钮容器 */
.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 批量操作按钮样式 - 侧边栏 */
.batch-create-cards-btn-sidebar,
.batch-delete-btn-sidebar {
  padding: 6px 6px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.batch-create-cards-btn-sidebar:hover {
  background: var(--interactive-accent);
  color: white;
  border-color: var(--interactive-accent);
}

.batch-delete-btn-sidebar:hover {
  background: var(--color-red);
  color: white;
  border-color: var(--color-red);
}

/* 批量操作按钮样式 - 主界面 */
.batch-create-cards-btn-header,
.batch-delete-btn-header {
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  white-space: nowrap;
}

.batch-create-cards-btn-header:hover {
  background: var(--interactive-accent);
  color: white;
  border-color: var(--interactive-accent);
}

.batch-delete-btn-header:hover {
  background: var(--color-red);
  color: white;
  border-color: var(--color-red);
}
.select-all-btn-sidebar {
  padding: 6px 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0; /* 防止按钮被压缩 */
}

.select-all-btn-sidebar:hover {
  background: var(--interactive-accent);
  border-color: var(--interactive-accent);
  color: white;
}

.stats-badge {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  padding: 4px;
  flex: 1; /* 占据剩余空间 */
}
      .stats-badge {
        text-align: center;
        font-size: 11px;
        color: var(--text-muted);
        padding: 4px;
      }
.select-all-btn-header {
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 6px;
  background: var(--background-secondary);
  color: var(--text-normal);
  border: 1px solid var(--background-modifier-border);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.select-all-btn-header:hover {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

/* 完成状态的高亮样式 */
.select-all-btn-header.completed {
  background: var(--interactive-accent);
  border-color: var(--interactive-accent);
  color: var(--text-on-accent);
}

.select-all-btn-header.completed:hover {
  opacity: 0.9;
}

.select-all-btn-sidebar {
  padding: 6px 12px;

  background: var(--background-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 11px;
  font-weight: 500;
  margin-right: auto; /* 靠左对齐 */
}

.select-all-btn-sidebar:hover {
  background: var(--interactive-accent);
  border-color: var(--interactive-accent);
  color: white;
}
  /* 取消选择按钮 - 侧边栏 */
.cancel-selection-btn-sidebar {
  padding: 6px 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  color: var(--text-muted);
}

.cancel-selection-btn-sidebar:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
  border-color: var(--text-muted);
}

/* 取消选择按钮 - 主界面 */
.cancel-selection-btn-header {
  padding: 8px 16px;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
  white-space: nowrap;
  color: var(--text-muted);
}

.cancel-selection-btn-header:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
  border-color: var(--text-muted);
}

/* 完成状态的全选按钮高亮 */
.select-all-btn-sidebar.completed,
.select-all-btn-header.completed {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}
      .batch-actions {
        display: flex;
        gap: 6px;
        margin-top: 10px;
        flex-wrap: wrap;
      }

      .batch-mode-btn,
      .select-all-btn,
      .batch-delete-btn,
      .batch-create-cards-btn {
        padding: 6px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-secondary);
        cursor: pointer;
        transition: all 0.2s;
        font-size: 11px;
        font-weight: 500;
      }

      .select-all-btn:hover {
        background: var(--interactive-accent);
        border-color: var(--interactive-accent);
        color: white;
      }

      .batch-mode-btn:hover {
        background: var(--background-modifier-hover);
      }

      .batch-delete-btn:hover {
        background: var(--color-red);
        border-color: var(--color-red);
        color: white;
      }

      .batch-create-cards-btn:hover {
        background: var(--interactive-accent);
        border-color: var(--interactive-accent);
        color: white;
      }

      .batch-checkbox {
        margin-right: 8px;
        cursor: pointer;
      }

      .sidebar-content-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
          position: relative; /* 🔧 添加 */
  z-index: 1; /* 🔧 添加 */
      }

      .content-group {
        margin-bottom: 16px;
      }

      .group-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        background: var(--background-secondary);
        border-radius: 6px;
        margin-bottom: 6px;
        font-size: 12px;
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .group-icon {
        font-size: 14px;
      }

      .group-title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .group-count {
        padding: 2px 6px;
        background: var(--background-modifier-border);
        border-radius: 10px;
        font-size: 10px;
      }

      .compact-card {
        display: flex;
        gap: 8px;
        padding: 10px;
        margin: 4px 0;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        transition: all 0.2s;
      }

      .compact-card:hover {
        border-color: var(--interactive-accent);
        background: var(--background-primary-alt);
        transform: translateX(2px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }

/* 基础指示器样式 */
.card-indicator {
  width: 4px;
  border-radius: 2px;
  background: var(--background-modifier-border);
  flex-shrink: 0;
  transition: all 0.2s;
}


/* 🔧 没有批注时：上半透明，下半显示类型颜色 */
.card-indicator.type-qa {
  background: linear-gradient(
    to bottom,
    transparent 0%,
    transparent 50%,
    #10b981 50%,
    #10b981 100%
  );
}

.card-indicator.type-cloze {
  background: linear-gradient(
    to bottom,
    transparent 0%,
    transparent 50%,
       #FFF176 50%,
    #FFF176 100%

  );
}

.card-indicator.type-text {
  background: linear-gradient(
    to bottom,
    transparent 0%,
    transparent 50%,
    #6b7280 50%,
    #6b7280 100%
  );
}

/* 🔧 有批注时：上半蓝色，下半类型颜色 */
.card-indicator.type-qa.has-annotation {
  background: linear-gradient(
    to bottom, 
    #3b82f6 0%, 
    #3b82f6 50%, 
    #10b981 50%,
    #10b981 100%
  );
}

.card-indicator.type-cloze.has-annotation {
  background: linear-gradient(
    to bottom, 
    #3b82f6 0%, 
    #3b82f6 50%, 
        #FFF176 50%,
    #FFF176 100%

  );
}

.card-indicator.type-text.has-annotation {
  background: linear-gradient(
    to bottom, 
    #3b82f6 0%, 
    #3b82f6 50%, 
    #6b7280 50%,
    #6b7280 100%
  );
}

/* 🔧 默认样式（没有类型时的兜底） */
.card-indicator:not(.type-qa):not(.type-cloze):not(.type-text) {
  background: linear-gradient(
    to bottom,
    transparent 0%,
    transparent 50%,
    var(--background-modifier-border) 50%,
    var(--background-modifier-border) 100%
  );
}

.card-indicator.has-annotation:not(.type-qa):not(.type-cloze):not(.type-text) {
  background: linear-gradient(
    to bottom,
    #3b82f6 0%,
    #3b82f6 50%,
    var(--background-modifier-border) 50%,
    var(--background-modifier-border) 100%
  );
}



.type-indicator {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.type-indicator.type-qa {
  background: rgba(16, 185, 129, 0.2);

  color: #10b981;
}

.type-indicator.type-cloze {
  background: rgba(255, 241, 118, 0.2);
    color: #FFF176;

}

.type-indicator.type-text {
  background: rgba(107, 114, 128, 0.2);
  color: #6b7280;
}

      .card-content {
        flex: 1;
        min-width: 0;
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }

      .annotation-btn {
        cursor: pointer;
        font-size: 14px;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .annotation-btn:hover {
        background: var(--background-modifier-hover);
        transform: scale(1.1);
      }

      .card-tools {
        display: flex;
        gap: 4px;
      }

      .tool-btn {
        cursor: pointer;
        font-size: 14px;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .tool-btn:hover {
        background: var(--background-modifier-hover);
      }

      .flashcard-btn:hover {
        background: rgba(251, 191, 36, 0.2);
      }

      .more-btn:hover {
        background: var(--background-modifier-hover);
      }

.note-text {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-normal);
  cursor: pointer;
  word-wrap: break-word;
  word-break: break-word;
  white-space: normal;
  overflow-wrap: break-word;
  margin-bottom: 6px;
}

.note-text:hover {
  color: var(--interactive-accent);
}

/* 🔧 QA 样式 */
.qa-question {
  font-weight: 500;
  color: var(--text-normal);
}

.qa-separator {
  color: var(--text-muted);
  margin: 0 4px;
}

.qa-answer {
  color: var(--text-accent);
  font-style: italic;
}

/* 🔧 Cloze 高亮样式 */
.cloze-highlight {

  color: #f59e0b;
  font-weight: 500;
  padding: 1px 3px;
  border-radius: 3px;
}

      .annotation-preview {
        font-size: 11px;
        line-height: 1.4;
        color: var(--text-muted);
        padding: 6px 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        margin-top: 6px;
        border-left: 3px solid var(--interactive-accent);
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .annotation-preview:hover {
        background: var(--background-modifier-hover);
      }

      .card-meta {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      
      /* ==================== 内联批注编辑器 ==================== */
      .inline-annotation-editor {
        margin-top: 8px;
        padding: 0;
        background: transparent;
        animation: slideDown 0.15s ease-out;
      }
      
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .inline-annotation-textarea {
        width: 100%;
        min-height: 80px;
        padding: 12px 14px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary-alt);
        color: var(--text-normal);
        font-family: var(--font-text);
        font-size: 13px;
        line-height: 1.5;
        resize: vertical;
        transition: all 0.2s;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      
      .inline-annotation-textarea:focus {
        outline: none;
        border-color: var(--interactive-accent);
        background: var(--background-primary);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
      
      .inline-annotation-textarea::placeholder {
        color: var(--text-faint);
        font-style: italic;
      }
      
      .inline-annotation-hint {
        margin-top: 6px;
        font-size: 11px;
        color: var(--text-faint);
        font-style: italic;
        text-align: left;
      }
      
      /* 网格卡片的内联编辑器样式 */
      .grid-card .inline-annotation-editor {
        margin-top: 8px;
      }
      
      .grid-card .inline-annotation-textarea {
        min-height: 100px;
        font-size: 14px;
        padding: 8px 14px;
      }
      
      .grid-card .inline-annotation-hint {
        font-size: 12px;
        margin-top: 8px;
      }

      .tag {
        padding: 2px 6px;
        background: var(--tag-background);
        color: var(--tag-color);
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
      }

      .tag-more {
        padding: 2px 6px;
        background: var(--background-modifier-border);
        color: var(--text-muted);
        border-radius: 4px;
        font-size: 10px;
      }

      .badge {
        padding: 2px 6px;
        background: var(--background-modifier-border);
        border-radius: 4px;
        font-size: 10px;
      }

      /* ==================== 主界面模式样式 ==================== */
      .main-layout {
        display: grid;
        grid-template-columns: 250px 1fr;
        gap: 1px;
        height: 100%;
        background: var(--background-modifier-border);
      }

      .left-panel {
        background: var(--background-primary);
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }

      .right-panel {
        background: var(--background-primary);
        overflow-y: auto;
        padding: 8px;
      }

      .fixed-entries {
        padding: 12px;
        border-bottom: 1px solid var(--background-modifier-border);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .entry-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 13px;
        font-weight: 500;
        background: var(--background-secondary);
      }

      .entry-btn:hover {
        background: var(--background-modifier-hover);
        transform: translateX(2px);
      }

      .entry-btn.active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
      }

      .main-toolbar {
        padding: 12px;
        border-bottom: 1px solid var(--background-modifier-border);
      }

      .batch-actions-main {
        display: flex;
        gap: 8px;
        margin-top: 10px;
        flex-wrap: wrap;
      }

      .batch-actions-main .batch-mode-btn,
      .batch-actions-main .select-all-btn,
      .batch-actions-main .batch-delete-btn,
      .batch-actions-main .batch-create-cards-btn {
        padding: 8px 16px;
        font-size: 12px;
      }

      .batch-actions-main .select-all-btn:hover {
        background: var(--interactive-accent);
        border-color: var(--interactive-accent);
        color: white;
      }

      .search-input-main {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        font-size: 13px;
        background: var(--background-primary);
        color: var(--text-normal);
        margin-bottom: 10px;
      }

      .search-input-main:focus {
        outline: none;
        border-color: var(--interactive-accent);
      }

      .group-switcher-main {
        display: flex;
        gap: 6px;
      }

      .group-btn-main {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 8px 10px;
        font-size: 12px;
        border-radius: 6px;
        background: var(--background-secondary);
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
      }

      .group-btn-main:hover {
        background: var(--background-modifier-hover);
        transform: translateY(-1px);
      }

      .group-btn-main.active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
      }

      .panel-title {
        font-size: 13px;
        font-weight: 600;
        padding: 12px;
        margin:0;
        color: var(--text-muted);
      }

      .file-list {
        padding: 0 8px 8px 8px;
        flex: 1;
        overflow-y: auto;
      }

      .file-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 4px;
      }

      .file-item:hover {
        background: var(--background-modifier-hover);
      }

      .file-item.selected {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
      }

      .file-icon {
        font-size: 14px;
      }

      .file-name {
        flex: 1;
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-count {
        font-size: 11px;
        padding: 2px 6px;
        background: rgba(255,255,255,0.1);
        border-radius: 10px;
      }

      .file-item.selected .file-count {
        background: rgba(255,255,255,0.2);
      }

      .empty-right-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-muted);
      }

      .empty-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }

      .empty-text {
        font-size: 14px;
      }

      .grid-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 2px solid var(--background-modifier-border);
      }

      .grid-header h2 {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }

      .open-file-btn {
        padding: 8px 16px;
        font-size: 13px;
        border-radius: 6px;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
        cursor: pointer;
        transition: all 0.2s;
        font-weight: 500;
      }

      .open-file-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .content-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 8px;
      }

      .grid-card {
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        padding: 8px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .grid-card:hover {
        border-color: var(--interactive-accent);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateY(-2px);
      }

      .grid-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--background-modifier-border);
      }

      .doc-name {
        font-size: 11px;
        color: var(--text-muted);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .grid-card-tools {
        display: flex;
        gap: 4px;
      }

      .tool-btn-grid {
        cursor: pointer;
        font-size: 16px;
        padding: 4px 6px;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .tool-btn-grid:hover {
        background: var(--background-modifier-hover);
        transform: scale(1.1);
      }

      .grid-card-content {
        margin-bottom: 12px;
      }

.grid-note-text {
  font-size: 13px;  /* 🔧 从 14px 改为 13px */
  line-height: 1.6;
  color: var(--text-normal);
  cursor: pointer;
  margin-bottom: 10px;
  word-wrap: break-word;  /* 🔧 允许换行 */
  word-break: break-word;
  white-space: normal;
  overflow-wrap: break-word;
}

.grid-note-text:hover {
  color: var(--interactive-accent);
}


      .grid-annotation {
        font-size: 12px;
        line-height: 1.5;
        color: var(--text-muted);
        padding: 10px;
        background: var(--background-secondary);
        border-radius: 4px;
        border-left: 3px solid var(--interactive-accent);
        margin-top: 10px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .grid-annotation:hover {
        background: var(--background-modifier-hover);
      }

      .grid-annotation strong {
        color: var(--text-normal);
      }

      .grid-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }

      .tag-grid {
        padding: 4px 8px;
        background: var(--tag-background);
        color: var(--tag-color);
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
      }

      .grid-card-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 10px;
        border-top: 1px solid var(--background-modifier-border);
        font-size: 11px;
      }

      .line-info {
        color: var(--text-muted);
      }

      .badge-grid {
        padding: 3px 8px;
        background: var(--background-secondary);
        border-radius: 4px;
      }

      .cards-header {
        margin-bottom: 20px;
      }

      .cards-header h2 {
        font-size: 18px;
        font-weight: 600;
      }

      .cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 8px;
      }

      .flashcard-item {
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        padding: 16px;
        transition: all 0.2s;
      }

      .flashcard-item:hover {
        border-color: var(--interactive-accent);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }

      .flashcard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .flashcard-delete-btn {
        padding: 4px 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 14px;
        border-radius: 4px;
        transition: all 0.2s;
        opacity: 0.6;
      }

      .flashcard-delete-btn:hover {
        opacity: 1;
        background: var(--background-modifier-hover);
        color: var(--color-red);
      }

      .flashcard-type {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
      }

      .flashcard-type.qa {
              background: rgba(16, 185, 129, 0.2);

        color: #10b981;
      }

      .flashcard-type.cloze {

         background: rgba(255, 241, 118, 0.2);
         color: #FFF176;
      }

      .flashcard-date {
        font-size: 11px;
        color: var(--text-muted);
      }

      .flashcard-body {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .flashcard-question,
      .flashcard-answer {
        font-size: 13px;
        line-height: 1.5;
      }

      .flashcard-question strong,
      .flashcard-answer strong {
        color: var(--text-muted);
        font-size: 11px;
        display: block;
        margin-bottom: 4px;
      }

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 14px;
  pointer-events: none; /* 🔧 关键！空状态不拦截点击 */
  position: relative;
  z-index: 1; /* 🔧 确保在工具栏下方 */
}

      .empty-hint {
        text-align: center;
        padding: 20px;
        color: var(--text-muted);
        font-size: 13px;
      }

      /* ==================== 响应式 ==================== */
      @media (max-width: 768px) {
        .main-layout {
          grid-template-columns: 1fr;
        }

        .left-panel {
          display: none;
        }

        .content-grid,
        .cards-grid {
          grid-template-columns: 1fr;
        }
          .batch-btn {
          font-size: 14px;
          position: relative;
        }

      .batch-btn:hover {
        background: rgba(59, 130, 246, 0.2);
        transform: scale(1.05);
      }

      /* 批量模式激活状态 */
      .compact-card.batch-mode .batch-btn,
      .grid-card.batch-mode .batch-btn {
        background: rgba(59, 130, 246, 0.3);
        color: var(--interactive-accent);
      }

      .batch-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
  padding: 8px;
  background: var(--background-secondary-alt);
  border-radius: 6px;
  animation: slideDown 0.2s ease;
}
/* 批量操作按钮禁用状态（数量为0时的视觉反馈） */
.batch-create-cards-btn-sidebar:has-text("(0)"),
.batch-delete-btn-sidebar:has-text("(0)"),
.batch-create-cards-btn-header:has-text("(0)"),
.batch-delete-btn-header:has-text("(0)") {
  opacity: 0.5;
  cursor: not-allowed;
}
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    
  }
}
      }
    `;

    document.head.appendChild(styleEl);
  }

  async onClose() {
    // 清理定时器
    if (this.searchDebounceTimer !== null) {
      window.clearTimeout(this.searchDebounceTimer);
    }
    
  }
}

// ==================== 批注编辑模态框 ====================
class AnnotationModal extends Modal {
  private result: string | null = null;
  private onSubmit: (text: string) => void;
  private defaultValue: string;

  constructor(app: App, defaultValue: string, onSubmit: (text: string) => void) {
    super(app);
    this.defaultValue = defaultValue;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl('h3', { text: '✏️ 编辑批注' });

    const textarea = contentEl.createEl('textarea', {
      cls: 'annotation-textarea',
      placeholder: '输入你的批注...',
      
      
    });
    textarea.value = this.defaultValue;
    textarea.style.width = '100%';
    textarea.style.minHeight = '120px';
    textarea.style.padding = '10px';
    textarea.style.border = '1px solid var(--background-modifier-border)';
    textarea.style.borderRadius = '6px';
    textarea.style.fontFamily = 'var(--font-interface)';
    textarea.style.fontSize = '14px';
    textarea.style.resize = 'vertical';
    textarea.style.marginTop = '12px';

    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.marginTop = '16px';

    const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
    cancelBtn.style.padding = '8px 16px';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    const saveBtn = buttonContainer.createEl('button', {
      text: '保存',
      cls: 'mod-cta'
    });
    saveBtn.style.padding = '8px 16px';
    saveBtn.style.borderRadius = '6px';
    saveBtn.addEventListener('click', () => {
      this.result = textarea.value;
      this.close();
    });

    textarea.focus();
    
    // 快捷键支持
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        this.result = textarea.value;
        this.close();
      }
    });
  }

  onClose() {
    
    const { contentEl } = this;
    contentEl.empty();
    
    if (this.result !== null) {
      this.onSubmit(this.result);
    }
  }
}

// ==================== 闪卡创建模态框 ====================
class FlashcardCreationModal extends Modal {
  private unit: ContentUnit;
  private type: 'qa' | 'cloze';
  private onSubmit: (question: string, answer: string) => void;

  constructor(
    app: App,
    unit: ContentUnit,
    type: 'qa' | 'cloze',
    onSubmit: (question: string, answer: string) => void
  ) {
    super(app);
    this.unit = unit;
    this.type = type;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl('h3', {
      text: `🃏 创建${this.type === 'qa' ? 'Q&A' : '填空'}闪卡`
    });

    // 显示原文
    const sourceDiv = contentEl.createDiv({ cls: 'flashcard-source' });
    sourceDiv.style.padding = '10px';
    sourceDiv.style.background = 'var(--background-secondary)';
    sourceDiv.style.borderRadius = '6px';
    sourceDiv.style.marginTop = '12px';
    sourceDiv.style.marginBottom = '12px';
    sourceDiv.style.fontSize = '13px';
    sourceDiv.style.color = 'var(--text-muted)';
    sourceDiv.innerHTML = `<strong>原文：</strong>${this.unit.content}`;

    // 问题输入
    contentEl.createEl('label', {
      text: this.type === 'qa' ? '问题' : '填空题干',
      cls: 'flashcard-label'
    }).style.display = 'block';
    
    const questionInput = contentEl.createEl('textarea', {
      cls: 'flashcard-input',
      placeholder: this.type === 'qa' 
        ? '输入问题...' 
        : '用 {{c1::...}} 标记需要填空的内容'
    });
    questionInput.style.width = '100%';
    questionInput.style.minHeight = '80px';
    questionInput.style.padding = '10px';
    questionInput.style.border = '1px solid var(--background-modifier-border)';
    questionInput.style.borderRadius = '6px';
    questionInput.style.marginTop = '8px';
    questionInput.style.marginBottom = '12px';
    questionInput.style.fontSize = '14px';
    questionInput.style.resize = 'vertical';

    // 答案输入
    contentEl.createEl('label', {
      text: '答案',
      cls: 'flashcard-label'
    }).style.display = 'block';
    
    const answerInput = contentEl.createEl('textarea', {
      cls: 'flashcard-input',
      placeholder: '输入答案...'
    });
    answerInput.value = this.unit.content;
    answerInput.style.width = '100%';
    answerInput.style.minHeight = '80px';
    answerInput.style.padding = '10px';
    answerInput.style.border = '1px solid var(--background-modifier-border)';
    answerInput.style.borderRadius = '6px';
    answerInput.style.marginTop = '8px';
    answerInput.style.fontSize = '14px';
    answerInput.style.resize = 'vertical';

    // 按钮
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.marginTop = '16px';

    const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
    cancelBtn.style.padding = '8px 16px';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    const createBtn = buttonContainer.createEl('button', {
      text: '创建',
      cls: 'mod-cta'
    });
    createBtn.style.padding = '8px 16px';
    createBtn.style.borderRadius = '6px';
    createBtn.addEventListener('click', () => {
      const question = questionInput.value.trim();
      const answer = answerInput.value.trim();
      
      if (!question || !answer) {
        new Notice('⚠️ 请填写完整信息');
        return;
      }
      
      this.onSubmit(question, answer);
      this.close();
    });

    questionInput.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
// ==================== 闪卡编辑模态框 ====================
export class FlashcardEditModal extends Modal {
  private card: Flashcard;
  private onSubmit: (question: string, answer: string) => void;

  constructor(
    app: App,
    card: Flashcard,
    onSubmit: (question: string, answer: string) => void
  ) {
    super(app);
    this.card = card;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl('h3', { text: '✏️ 编辑闪卡' });

    // 问题输入
    contentEl.createEl('label', { text: '问题' }).style.display = 'block';
    const questionInput = contentEl.createEl('textarea', {
      cls: 'flashcard-input'
    });
    questionInput.value = this.card.front;
    questionInput.style.width = '100%';
    questionInput.style.minHeight = '80px';
    questionInput.style.padding = '10px';
    questionInput.style.marginTop = '8px';
    questionInput.style.marginBottom = '12px';

    // 答案输入
    contentEl.createEl('label', { text: '答案' }).style.display = 'block';
    const answerInput = contentEl.createEl('textarea', {
      cls: 'flashcard-input'
    });
    answerInput.value = Array.isArray(this.card.back) 
      ? this.card.back.join(', ') 
      : this.card.back;
    answerInput.style.width = '100%';
    answerInput.style.minHeight = '80px';
    answerInput.style.padding = '10px';
    answerInput.style.marginTop = '8px';

    // 按钮
    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '8px';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.marginTop = '16px';

    const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = buttonContainer.createEl('button', {
      text: '保存',
      cls: 'mod-cta'
    });
    saveBtn.addEventListener('click', () => {
      const question = questionInput.value.trim();
      const answer = answerInput.value.trim();
      if (!question || !answer) {
        new Notice('⚠️ 请填写完整信息');
        return;
      }
      this.onSubmit(question, answer);
      this.close();
    });

    questionInput.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}