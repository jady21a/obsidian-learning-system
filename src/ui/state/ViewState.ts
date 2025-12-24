// src/ui/state/ViewState.ts
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';

export type FilterMode = 'all' | 'annotated' | 'flashcards';
export type DisplayMode = 'sidebar' | 'main';
export type GroupMode = 'file' | 'annotation' | 'tag' | 'date';
export type ViewType = 'notes' | 'cards';

export class ViewState {
  // 显示状态
  forceMainMode: boolean = false;
  displayMode: DisplayMode = 'sidebar';
  viewType: ViewType = 'notes';
  
  // 过滤和分组
  searchQuery: string = '';
  filterMode: FilterMode = 'all';
  groupMode: GroupMode = 'file';
  selectedFile: string | null = null;
  
  // 批量操作
  batchMode: boolean = false;
  selectedUnitIds: Set<string> = new Set();
  selectedCardIds: Set<string> = new Set();
  
  // UI状态
  activeMenuId: string | null = null;
  savedScrollPosition: number = 0;
  shouldRestoreScroll: boolean = false;
  
  // 性能优化
  searchDebounceTimer: number | null = null;
  isRendering: boolean = false;

  constructor(forceMainMode: boolean = false) {
    this.forceMainMode = forceMainMode;
    this.displayMode = forceMainMode ? 'main' : 'sidebar';
  }

  // 状态重置方法
  clearSelection() {
    this.selectedUnitIds.clear();
    this.selectedCardIds.clear();
    this.batchMode = false;
  }
// 切换批量模式
  toggleBatchMode(): void {
    this.batchMode = !this.batchMode;
    if (!this.batchMode) {
      this.clearSelection();
    }
  }
  // 搜索相关
  setSearchQuery(query: string) {
    this.searchQuery = query;
  }

  // 过滤器切换
  setFilterMode(mode: FilterMode) {
    if (this.filterMode !== mode) {
      this.filterMode = mode;
      this.clearSelection();
      return true;
    }
    return false;
  }

  // 分组模式切换
  setGroupMode(mode: GroupMode) {
    if (this.groupMode !== mode) {
      this.groupMode = mode;
      this.selectedFile = null;
      this.clearSelection();
      return true;
    }
    return false;
  }

  // 视图类型切换
  setViewType(type: ViewType) {
    if (this.viewType !== type) {
      this.viewType = type;
      this.selectedFile = null;
      this.clearSelection();
      return true;
    }
    return false;
  }

  // 批量选择
  toggleUnitSelection(unitId: string) {
    if (this.selectedUnitIds.has(unitId)) {
      this.selectedUnitIds.delete(unitId);
    } else {
      this.selectedUnitIds.add(unitId);
    }
  }

  toggleCardSelection(cardId: string) {
    if (this.selectedCardIds.has(cardId)) {
      this.selectedCardIds.delete(cardId);
    } else {
      this.selectedCardIds.add(cardId);
    }
  }

  // 全选逻辑
  selectAllUnits(units: ContentUnit[]) {
    units.forEach(unit => this.selectedUnitIds.add(unit.id));
    this.batchMode = true;
  }

  selectAllCards(cards: Flashcard[]) {
    cards.forEach(card => this.selectedCardIds.add(card.id));
    this.batchMode = true;
  }

  // 取消全选
  deselectAllUnits(units: ContentUnit[]) {
    units.forEach(unit => this.selectedUnitIds.delete(unit.id));
  }

  deselectAllCards(cards: Flashcard[]) {
    cards.forEach(card => this.selectedCardIds.delete(card.id));
  }

  // 判断是否全选
  isAllSelected(items: ContentUnit[] | Flashcard[]): boolean {
    if (items.length === 0) return false;
    
    if (this.viewType === 'cards') {
      return (items as Flashcard[]).every(card => 
        this.selectedCardIds.has(card.id)
      );
    } else {
      return (items as ContentUnit[]).every(unit => 
        this.selectedUnitIds.has(unit.id)
      );
    }
  }

  // 获取选中数量
  getSelectedCount(): number {
    return this.viewType === 'cards' 
      ? this.selectedCardIds.size 
      : this.selectedUnitIds.size;
  }
}