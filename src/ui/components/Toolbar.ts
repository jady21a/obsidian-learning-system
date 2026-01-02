// src/ui/components/Toolbar.ts  工具栏组件
import { ViewState, FilterMode, GroupMode } from '../state/ViewState';
import { t, Language } from '../../i18n/translations';

export class Toolbar {
  private state: ViewState;
  private onSearchChange: (query: string) => void;
  private onFilterChange: (mode: FilterMode) => void;
  private onGroupChange: (mode: GroupMode) => void;
  private onCheckReview?: () => void;
  private language: Language;

  constructor(
    state: ViewState,
    callbacks: {
      onSearchChange: (query: string) => void;
      onFilterChange: (mode: FilterMode) => void;
      onGroupChange: (mode: GroupMode) => void;
      onCheckReview?: () => void; 
      checkFilterHasNotes?: (mode: FilterMode) => boolean;
      checkGroupHasNotes?: (mode: GroupMode) => boolean;
    },
    language: Language = 'en' 
  ) {
    this.state = state;
    this.onSearchChange = callbacks.onSearchChange;
    this.onFilterChange = callbacks.onFilterChange;
    this.onGroupChange = callbacks.onGroupChange;
    this.onCheckReview = callbacks.onCheckReview; 
    this.checkFilterHasNotes = callbacks.checkFilterHasNotes;
    this.checkGroupHasNotes = callbacks.checkGroupHasNotes;
  
    this.language = language;
  }
  private checkFilterHasNotes?: (mode: FilterMode) => boolean;
  private checkGroupHasNotes?: (mode: GroupMode) => boolean;

  private t(key: string, params?: Record<string, string | number>): string {
    return t(key, this.language, params);
  }
  /**
   * 渲染侧边栏工具栏
   */
  renderSidebarToolbar(container: HTMLElement): HTMLElement {
    const toolbar = container.createDiv({ cls: 'sidebar-toolbar' });
    
    this.renderSearchBox(toolbar);
    this.renderFilterChips(toolbar);
    this.renderGroupSwitcher(toolbar);
    this.renderStatsRow(toolbar);
    
    return toolbar;
  }

  /**
   * 渲染主界面工具栏
   */
  renderMainToolbar(container: HTMLElement): HTMLElement {
    const toolbar = container.createDiv({ cls: 'main-toolbar' });
    
    this.renderSearchBox(toolbar, true);
    this.renderGroupSwitcher(toolbar, true);
    
    return toolbar;
  }

  private renderSearchBox(container: HTMLElement, isMain = false): void {
    const searchContainer = container.createDiv({ cls: 'search-container' });
    const searchInput = searchContainer.createEl('input', {
      type: 'text',
     placeholder: this.t('toolbar.search'), 
      cls: isMain ? 'search-input-main' : 'search-input'
    });
    
    searchInput.value = this.state.searchQuery;
    
    searchInput.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.onSearchChange(value);
    });

    
  }

  private renderFilterChips(container: HTMLElement): void {
    const filters = container.createDiv({ cls: 'filter-chips' });
    
    const filterOptions: Array<{ mode: FilterMode; icon: string; label: string ;tooltip:string}> = [
      
      { mode: 'all', icon: '📝', label: 'notes',tooltip:'allNotes' },
      { mode: 'annotated', icon: '💬', label: 'annotated' ,tooltip:'annotated' },
      { mode: 'flashcards', icon: '🃏', label: 'flashcards',tooltip:'flashcards' }
    ];

    filterOptions.forEach(({ mode, icon, label ,tooltip}) => {
    const hasNotes = this.checkFilterHasNotes ? this.checkFilterHasNotes(mode) : true;
    const isActive = this.state.filterMode === mode;
    
    const chip = filters.createDiv({
      cls: `filter-chip ${isActive ? 'active' : ''} ${!hasNotes ? 'disabled' : ''}`,
      text: `${icon}`,
    });
    
    // ⭐ 设置提示文本
    if (!hasNotes) {
      chip.setAttribute('title', 'No notes of this type in the current file');
      chip.style.opacity = '0.4';
      chip.style.cursor = 'not-allowed';
    } else {
      chip.setAttribute('title', tooltip);
    }
    
    chip.addEventListener('click', () => {
            this.onFilterChange(mode);
    });
    });
  }

  private renderGroupSwitcher(container: HTMLElement, isMain = false): void {
    const groupSwitcher = container.createDiv({ 
      cls: isMain ? 'group-switcher-main' : 'group-switcher' 
    });
    
    const groupOptions: Array<{ mode: GroupMode; icon: string; label?: string; tooltip: string }> = 
      isMain ? [
        { mode: 'file', icon: '📁', label: 'file', tooltip: 'by file' },
        { mode: 'annotation', icon: '💬', label: 'annotattion', tooltip: 'by annotation' },
        { mode: 'tag', icon: '🏷️', label: 'tag', tooltip: 'by tag' },
        { mode: 'date', icon: '📅', label: 'date', tooltip: 'by date' }
      ] : [
        { mode: 'file', icon: '📁', tooltip: 'by file' },
        { mode: 'tag', icon: '🏷️', tooltip: 'by tag' },
        { mode: 'date', icon: '📅', tooltip: 'by date' }
      ];

    groupOptions.forEach(({ mode, icon, label, tooltip }) => {
    // ⭐ 检查是否有可用笔记（侧边栏模式下才检查）
    const hasNotes = (this.state.displayMode === 'sidebar' && this.checkGroupHasNotes) 
      ? this.checkGroupHasNotes(mode) 
      : true;
    const isActive = this.state.groupMode === mode;
    
    const btn = groupSwitcher.createDiv({
      cls: `${isMain ? 'group-btn-main' : 'group-btn'} ${
        isActive ? 'active' : ''
      } ${!hasNotes ? 'disabled' : ''}`
    });
    
    btn.innerHTML = isMain ? `${icon} ` : icon;
    
    // ⭐ 设置提示文本
    if (!hasNotes) {
      btn.setAttribute('title', 'Notes in the current file cannot be grouped this way');
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.setAttribute('title', tooltip);
    }
    
    btn.addEventListener('click', () => {

      this.onGroupChange(mode);
    });
    });
  }

  private renderStatsRow(container: HTMLElement): void {
    const statsRow = container.createDiv({ cls: 'stats-row' });
    
    // 这里会由 BatchActions 组件填充
    // 预留容器供外部使用
    statsRow.setAttribute('data-stats-container', 'true');
  }
  // 新增:渲染复习检查按钮的方法
renderReviewCheckButton(container: HTMLElement): HTMLElement | null {
  if (!this.onCheckReview) return null;
  
  const reviewBtn = container.createEl('button', {
    cls: 'review-check-btn-stats',
    attr: { 
      'aria-label': 'Check for Cards to Review'
    }
  });
  reviewBtn.innerHTML = '🔔'; 
  reviewBtn.addEventListener('click', () => {
    this.onCheckReview?.();
  });
  
  return reviewBtn;
}
private hasNotesForFilter(mode: FilterMode): boolean {
  // 这个方法需要访问数据，所以需要通过回调或者直接访问 state
  // 暂时返回 true，稍后通过构造函数传入检查函数
  return true;
}

private hasNotesForGroup(mode: GroupMode): boolean {
  return true;
}

}