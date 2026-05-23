// src/ui/components/ContentList.ts   内容列表
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';
import { ViewState, GroupMode } from '../stats/ViewState';
import { ContentCard, CardCallbacks } from './ContentCard';
import { t } from '../../i18n/translations';

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
  private language: 'en' | 'zh-CN';

  constructor(state: ViewState, cardCallbacks: CardCallbacks, language: 'en' | 'zh-CN' = 'en') {
    this.state = state;
    this.cardRenderer = new ContentCard(state, cardCallbacks);
    this.language = language;

  }
  setLanguage(language: 'en' | 'zh-CN'): void {
    this.language = language;
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
        text: t('contentList.empty.noFlashcards', this.language),
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
    const annotatedKey = t('contentList.group.annotated', this.language);
  
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
          if (a.groupKey === annotatedKey) return -1;
          if (b.groupKey === annotatedKey) return 1;
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
        return [unit.annotationId 
          ? t('contentList.group.annotated', this.language)
          : t('contentList.group.notAnnotated', this.language)
        ];
      
      case 'tag':
        return unit.metadata.tags.length > 0 
          ? unit.metadata.tags 
          : [t('group.uncategorized', this.language)];
      
      case 'date':
        return [this.formatDate(new Date(unit.metadata.createdAt))];
      
      default:
        return [t('group.uncategorized', this.language)];
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
          return [t('contentList.group.annotated', this.language)];
        } else {
          return [t('contentList.group.notAnnotated', this.language)];
        }
      
      case 'tag':
        if (unit && unit.metadata.tags.length > 0) {
          return unit.metadata.tags;
        } else if (card.tags && card.tags.length > 0) {
          return card.tags;
        } else if (card.deck) {
          return [card.deck];
        } else {
          return [t('group.uncategorized', this.language)];
        }
      
      case 'date':
        return [this.formatDate(new Date(card.metadata.createdAt))];
      
      default:
        return [t('group.uncategorized', this.language)];
    }
  }

  /**
   * 排序分组
   */
  private sortGroups(grouped: Map<string, ContentUnit[]>): GroupedUnits[] {
    const annotatedKey = t('contentList.group.annotated', this.language);
    
    return Array.from(grouped.entries())
      .map(([groupKey, units]) => ({ groupKey, units }))
      .sort((a, b) => {
        if (this.state.groupMode === 'annotation') {
          if (a.groupKey === annotatedKey) return -1;
          if (b.groupKey === annotatedKey) return 1;
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
      const box = emptyDiv.createDiv({ cls: 'empty-state-box' });
      box.createDiv({ cls: 'empty-state-icon', text: '📭' });
      box.createDiv({ cls: 'empty-state-main', text: t('contentList.empty.noNotes', this.language) });
      box.createDiv({
        cls: 'empty-state-hint',
        text: this.state.filterMode !== 'all'
          ? t('contentList.empty.tryFilter', this.language)
          : t('contentList.empty.startHighlight', this.language),
      });
    } else {
      emptyDiv.setText(t('contentList.empty.noContent', this.language));
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