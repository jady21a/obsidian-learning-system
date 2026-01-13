// src/ui/components/BatchActions.ts  批量操作

import { ViewState } from '../stats/ViewState';
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';
import { Toolbar } from './Toolbar';
import { t, Language } from '../../i18n/translations'; 


export interface BatchActionCallbacks {
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchCreate: () => void;
  onBatchDelete: () => void;
  onCancel: () => void;
}

export class BatchActions {
  private state: ViewState;
  private callbacks: BatchActionCallbacks;
  private toolbar?: Toolbar; 
  private language: Language;

  constructor(
    state: ViewState, 
    callbacks: BatchActionCallbacks,
    toolbar?: Toolbar,
    language: Language = 'en'
  ) {
    this.state = state;
    this.callbacks = callbacks;
    this.toolbar = toolbar;
    this.language = language; 
  }
  private t(key: string, params?: Record<string, string | number>): string {
    return t(key, this.language, params);
  }
  /**
   * 渲染全选按钮
   */
  renderSelectAllButton(
    container: HTMLElement, 
    visibleItems: ContentUnit[] | Flashcard[],
    styleClass: 'sidebar' | 'header'
  ): HTMLElement {
    const btnClass = styleClass === 'sidebar' 
      ? 'select-all-btn-sidebar' 
      : 'select-all-btn-header';
    
    const isAllChecked = this.state.isAllSelected(visibleItems);
    const itemCount = visibleItems.length;
    
    const selectAllBtn = container.createEl('button', {
      text: isAllChecked 
      ? `✓ ${this.t('batch.deselectAll')}`  
      : `☐ ${this.t('batch.selectAll')}`,   
    cls: `${btnClass} ${isAllChecked ? 'completed' : ''}`,
    title: isAllChecked 
      ? this.t('batch.deselectAll.tooltip')  
      : this.t('batch.selectAll.tooltip', { count: itemCount }) 
  });
    
    const shouldDisable = (
      itemCount === 0 ||
      (this.state.groupMode === 'annotation' && 
       this.state.displayMode === 'main' && 
       !this.state.selectedFile)
    );
    
    if (shouldDisable) {
      selectAllBtn.disabled = true;
      selectAllBtn.style.opacity = '0.5';
      selectAllBtn.style.cursor = 'not-allowed';
      selectAllBtn.title = itemCount === 0 
        ? this.t('batch.noItems')  
        : this.t('batch.selectAnnotationFirst');
    }
    
    selectAllBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
  
      
      if (isAllChecked) {
        this.callbacks.onDeselectAll();
      } else {
        this.callbacks.onSelectAll();
      }
    });
    
    return selectAllBtn;
  }
  // 新增:渲染复习检查按钮(独立方法)
  renderReviewCheckButton(container: HTMLElement, mode: 'sidebar' | 'header'): void {
    if (mode === 'sidebar' && this.toolbar) {
      this.toolbar.renderReviewCheckButton(container);
    }
  }
  /**
   * 渲染批量操作按钮组
   */
  renderActionButtons(
    container: HTMLElement,
    styleClass: 'sidebar' | 'header'
  ): void {
    if (!this.state.batchMode) return;
    
    const btnPrefix = styleClass === 'sidebar' ? 'sidebar' : 'header';
    
    // 制卡按钮（仅笔记视图）
    if (this.state.viewType === 'notes') {
      const count = this.state.selectedUnitIds.size;
      const createBtn = this.createButton(
        container,
        styleClass === 'sidebar' 
        ? `⚡(${count})` 
        : `⚡ ${this.t('batch.create')} (${count})`,
      `batch-create-cards-btn-${btnPrefix}`,
      this.t('batch.create.tooltip'),
        () => {
          if (this.state.selectedUnitIds.size === 0) {
            // 这里应该触发 Notice，但为了解耦，通过回调处理
            this.callbacks.onBatchCreate();
          } else {
            this.callbacks.onBatchCreate();
          }
        }
      );
      
      createBtn.addEventListener('mouseenter', (e) => {
        e.stopPropagation();
        e.preventDefault();
    
        createBtn.style.background = 'var(--interactive-accent)';
        createBtn.style.color = 'white';
      });
      
      createBtn.addEventListener('mouseleave', (e) => {
        e.stopPropagation();
        e.preventDefault();
    
        createBtn.style.background = 'var(--background-secondary)';
        createBtn.style.color = '';
      });
    }
    
    // 删除按钮
    const count = this.state.getSelectedCount();
    const deleteBtn = this.createButton(
      container,
      styleClass === 'sidebar' 
      ? `🗑️(${count})` 
      : `🗑️ ${this.t('batch.delete')} (${count})`, 
    `batch-delete-btn-${btnPrefix}`,
    this.t('batch.delete.tooltip'), 
      () => this.callbacks.onBatchDelete()
    );
    
    deleteBtn.addEventListener('mouseenter', (e) => {
      e.stopPropagation();
      e.preventDefault();
  
      deleteBtn.style.background = 'var(--color-red)';
      deleteBtn.style.color = 'white';
    });
    
    deleteBtn.addEventListener('mouseleave', (e) => {
      e.stopPropagation();
      e.preventDefault();
  
      deleteBtn.style.background = 'var(--background-secondary)';
      deleteBtn.style.color = '';
    });
    
    // 取消按钮
    const cancelBtn = this.createButton(
      container,
      styleClass === 'sidebar' 
      ? '✕' 
      : `✕ ${this.t('batch.cancel')}`, 
    `cancel-selection-btn-${btnPrefix}`,
    this.t('batch.cancel.tooltip'), 
    () => this.callbacks.onCancel()
    
    );

  }

  private createButton(
    container: HTMLElement,
    text: string,
    className: string,
    title: string,
    onClick: () => void
  ): HTMLElement {
    const btn = container.createEl('button', {
      text,
      cls: className,
      title
    });
    
    btn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      onClick();
    });
    return btn;
  }

  /**
   * 渲染批量选择 Checkbox
   */
  renderCheckbox(
    container: HTMLElement,
    itemId: string,
    isSelected: boolean,
    onChange: (checked: boolean) => void
  ): HTMLInputElement {
    const checkbox = container.createEl('input', {
      type: 'checkbox',
      cls: 'batch-checkbox'
    });
    
    checkbox.setAttribute('data-item-id', itemId);
    checkbox.checked = isSelected;
    
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      e.preventDefault();
      onChange((e.target as HTMLInputElement).checked);
    });
    
    return checkbox;
  }
}