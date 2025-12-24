// src/ui/components/Toolbar.ts
import { ViewState, FilterMode, GroupMode } from '../state/ViewState';

export class Toolbar {
  private state: ViewState;
  private onSearchChange: (query: string) => void;
  private onFilterChange: (mode: FilterMode) => void;
  private onGroupChange: (mode: GroupMode) => void;

  constructor(
    state: ViewState,
    callbacks: {
      onSearchChange: (query: string) => void;
      onFilterChange: (mode: FilterMode) => void;
      onGroupChange: (mode: GroupMode) => void;
    }
  ) {
    this.state = state;
    this.onSearchChange = callbacks.onSearchChange;
    this.onFilterChange = callbacks.onFilterChange;
    this.onGroupChange = callbacks.onGroupChange;
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
      placeholder: isMain ? '🔍 搜索...' : '🔍 搜索笔记...',
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
    
    const filterOptions: Array<{ mode: FilterMode; icon: string; label: string }> = [
      { mode: 'all', icon: '📝', label: 'allnotes' },
      { mode: 'annotated', icon: '💬', label: 'comment' },
      { mode: 'flashcards', icon: '🃏', label: 'flashcards' }
    ];

    filterOptions.forEach(({ mode, icon, label }) => {
      const chip = filters.createDiv({
        cls: `filter-chip ${this.state.filterMode === mode ? 'active' : ''}`,
        text: `${icon} ${label}`
      });
      
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
        { mode: 'file', icon: '📁', label: '文件', tooltip: '按文件' },
        { mode: 'annotation', icon: '💬', label: '批注', tooltip: '按批注' },
        { mode: 'tag', icon: '🏷️', label: '标签', tooltip: '按标签' },
        { mode: 'date', icon: '📅', label: '日期', tooltip: '按日期' }
      ] : [
        { mode: 'file', icon: '📁', tooltip: '按文件' },
        { mode: 'tag', icon: '🏷️', tooltip: '按标签' },
        { mode: 'date', icon: '📅', tooltip: '按日期' }
      ];

    groupOptions.forEach(({ mode, icon, label, tooltip }) => {
      const btn = groupSwitcher.createDiv({
        cls: `${isMain ? 'group-btn-main' : 'group-btn'} ${
          this.state.groupMode === mode ? 'active' : ''
        }`
      });
      
      btn.innerHTML = isMain ? `${icon} ` : icon;
      btn.setAttribute('title', tooltip);
      
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
}