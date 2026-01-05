// src/ui/components/ContentList.ts   内容列表
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';
import { ViewState, GroupMode } from '../state/ViewState';
import { ContentCard, CardCallbacks } from './ContentCard';

export interface GroupedUnits {
  groupKey: string;
  units: ContentUnit[];
}

export interface GroupedCards {
  groupKey: string;
  cards: Flashcard[];
}

export class ContentList {
  private state: ViewState;
  private cardRenderer: ContentCard;

  constructor(state: ViewState, cardCallbacks: CardCallbacks) {
    this.state = state;
    this.cardRenderer = new ContentCard(state, cardCallbacks);
  }

  /**
   * 渲染紧凑列表（侧边栏模式）
   */
  renderCompactList(container: HTMLElement, units: ContentUnit[]): void {
    // ⭐ 找出正在编辑的 unit IDs
    const editingUnitIds = new Set<string>();
    container.querySelectorAll('.compact-card[data-editing="true"]').forEach((card: HTMLElement) => {
      const unitId = card.getAttribute('data-unit-id');
      if (unitId) {
        editingUnitIds.add(unitId);
      }
    });
  
    // ⭐ 保留正在编辑的卡片 DOM
    const editingCardsMap = new Map<string, HTMLElement>();
    editingUnitIds.forEach(unitId => {
      const card = container.querySelector(`[data-unit-id="${unitId}"]`);
      if (card) {
        editingCardsMap.set(unitId, card as HTMLElement);
      }
    });
  
    // ⭐ 只删除非编辑状态的元素
    const allElements = Array.from(container.children);
    allElements.forEach((el: HTMLElement) => {
      const unitId = el.getAttribute('data-unit-id');
      if (!unitId || !editingUnitIds.has(unitId)) {
        el.remove();
      }
    });
  
    if (units.length === 0 && editingUnitIds.size === 0) {
      this.renderEmptyState(container);
      return;
    }
  
    const grouped = this.groupUnits(units);
  
    grouped.forEach(({ groupKey, units: groupUnits }) => {
      const groupEl = container.createDiv({ cls: 'content-group' });
      this.renderGroupHeader(groupEl, groupKey, groupUnits.length);
  
      groupUnits.forEach(unit => {
        // ⭐ 如果有保存的编辑中卡片，直接重用
        const existingCard = editingCardsMap.get(unit.id);
        if (existingCard) {
          groupEl.appendChild(existingCard);
        } else {
          this.cardRenderer.renderCompact(groupEl, unit);
        }
      });
    });
  }
  /**
 * 渲染紧凑列表（侧边栏模式 - 不分组）
 */
renderCompactListWithoutGrouping(container: HTMLElement, units: ContentUnit[]): void {
  const existingCards = container.querySelectorAll('.compact-card, .group-section, .empty-state');
  existingCards.forEach(el => el.remove());

  if (units.length === 0) {
    this.renderEmptyState(container);
    return;
  }

  // ⭐ 直接渲染，不分组
  units.forEach(unit => {
    this.cardRenderer.renderCompact(container, unit);
  });
}
  /**
   * 渲染内容网格（主界面模式）
   */
  renderContentGrid(container: HTMLElement, units: ContentUnit[]): void {
    container.empty();

    if (units.length === 0) {
      this.renderEmptyState(container);
      return;
    }

    units.forEach(unit => {
      this.cardRenderer.renderGrid(container, unit);
    });
  }

  /**
   * 渲染闪卡网格
   */
  renderFlashcardsGrid(container: HTMLElement, cards: Flashcard[]): void {
    container.empty();

    if (cards.length === 0) {
      container.createDiv({ 
        text: '📭 该分组下暂无闪卡', 
        cls: 'empty-state' 
      });
      return;
    }

    cards.forEach(card => {
      this.cardRenderer.renderFlashcardGrid(container, card);
    });
  }

  /**
   * 分组笔记单元
   */
  groupUnits(units: ContentUnit[]): GroupedUnits[] {
    const grouped = new Map<string, ContentUnit[]>();

    units.forEach(unit => {
      const keys = this.getGroupKeys(unit);
      
      keys.forEach(key => {
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(unit);
      });
    });

    return this.sortGroups(grouped);
  }

  /**
   * 分组闪卡
   */
  groupFlashcards(
    cards: Flashcard[], 
    getUnit: (cardId: string) => ContentUnit | undefined
  ): GroupedCards[] {
    const grouped = new Map<string, Flashcard[]>();

    cards.forEach(card => {
      const unit = getUnit(card.sourceContentId);
      const keys = this.getFlashcardGroupKeys(card, unit);
      
      keys.forEach(key => {
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(card);
      });
    });

    return Array.from(grouped.entries())
      .map(([groupKey, cards]) => ({ groupKey, cards }))
      .sort((a, b) => {
        if (this.state.groupMode === 'annotation') {
          if (a.groupKey === '有批注') return -1;
          if (b.groupKey === '有批注') return 1;
          return 0;
        }
        if (this.state.groupMode === 'date') {
          return b.groupKey.localeCompare(a.groupKey);
        }
        return b.cards.length - a.cards.length;
      });
  }

  /**
   * 获取单元的分组键
   */
  private getGroupKeys(unit: ContentUnit): string[] {
    switch (this.state.groupMode) {
      case 'file':
        return [unit.source.file];
      
      case 'annotation':
        return [unit.annotationId ? '有批注' : '无批注'];
      
      case 'tag':
        return unit.metadata.tags.length > 0 
          ? unit.metadata.tags 
          : ['未分类'];
      
      case 'date':
        return [this.formatDate(new Date(unit.metadata.createdAt))];
      
      default:
        return ['未分组'];
    }
  }

  /**
   * 获取闪卡的分组键
   */
  private getFlashcardGroupKeys(card: Flashcard, unit?: ContentUnit): string[] {
    switch (this.state.groupMode) {
      case 'file':
        return [card.sourceFile];
      
      case 'annotation':
        if (unit && unit.annotationId) {
          return ['有批注'];
        } else {
          return ['无批注'];
        }
      
      case 'tag':
        if (unit && unit.metadata.tags.length > 0) {
          return unit.metadata.tags;
        } else if (card.tags && card.tags.length > 0) {
          return card.tags;
        } else if (card.deck) {
          return [card.deck];
        } else {
          return ['未分类'];
        }
      
      case 'date':
        return [this.formatDate(new Date(card.metadata.createdAt))];
      
      default:
        return ['未分组'];
    }
  }

  /**
   * 排序分组
   */
  private sortGroups(grouped: Map<string, ContentUnit[]>): GroupedUnits[] {
    return Array.from(grouped.entries())
      .map(([groupKey, units]) => ({ groupKey, units }))
      .sort((a, b) => {
        if (this.state.groupMode === 'annotation') {
          if (a.groupKey === '有批注') return -1;
          if (b.groupKey === '有批注') return 1;
          return 0;
        }
        if (this.state.groupMode === 'date') {
          return b.groupKey.localeCompare(a.groupKey);
        }
        return b.units.length - a.units.length;
      });
  }

  /**
   * 渲染分组头部
   */
  private renderGroupHeader(container: HTMLElement, groupKey: string, count: number): void {
    const header = container.createDiv({ cls: 'group-header' });
    header.createSpan({ 
      text: this.getGroupIcon(this.state.groupMode), 
      cls: 'group-icon' 
    });
    header.createSpan({ text: groupKey, cls: 'group-title' });
    header.createSpan({ text: `${count}`, cls: 'group-count' });
  }

  /**
   * 渲染空状态
   */
  private renderEmptyState(container: HTMLElement): void {
    const emptyDiv = container.createDiv({ cls: 'empty-state' });
    
    if (this.state.selectedFile && this.state.displayMode === 'sidebar') {
      emptyDiv.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 10px;">📭</div>
          <div style="color: var(--text-muted);">当前文档暂无笔记</div>
          <div style="font-size: 12px; color: var(--text-faint); margin-top: 8px;">
            ${this.state.filterMode !== 'all' ? '尝试切换其他过滤器查看' : '开始高亮文本来创建笔记'}
          </div>
        </div>
      `;
    } else {
      emptyDiv.textContent = '暂无内容';
    }
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
   * 格式化日期
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }
}