// src/ui/components/BatchActions.ts  批量操作

import { ViewState } from '../state/ViewState';
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';

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

  constructor(state: ViewState, callbacks: BatchActionCallbacks) {
    this.state = state;
    this.callbacks = callbacks;
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
      text: isAllChecked ? '✓ 取消全选' : '☐ 全选',
      cls: `${btnClass} ${isAllChecked ? 'completed' : ''}`,
      title: isAllChecked 
        ? '取消当前页面的全选' 
        : `全选当前 ${itemCount} 项`
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
        ? '没有可选项' 
        : '请先选择"有批注"或"无批注"';
    }
    
    selectAllBtn.addEventListener('click', () => {
      if (isAllChecked) {
        this.callbacks.onDeselectAll();
      } else {
        this.callbacks.onSelectAll();
      }
    });
    
    return selectAllBtn;
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
      const createBtn = this.createButton(
        container,
        styleClass === 'sidebar' 
          ? `⚡(${this.state.selectedUnitIds.size})` 
          : `⚡ 批量制卡 (${this.state.selectedUnitIds.size})`,
        `batch-create-cards-btn-${btnPrefix}`,
        '批量制卡',
        () => {
          if (this.state.selectedUnitIds.size === 0) {
            // 这里应该触发 Notice，但为了解耦，通过回调处理
            this.callbacks.onBatchCreate();
          } else {
            this.callbacks.onBatchCreate();
          }
        }
      );
      
      createBtn.addEventListener('mouseenter', () => {
        createBtn.style.background = 'var(--interactive-accent)';
        createBtn.style.color = 'white';
      });
      
      createBtn.addEventListener('mouseleave', () => {
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
        : `🗑️ 删除 (${count})`,
      `batch-delete-btn-${btnPrefix}`,
      '批量删除',
      () => this.callbacks.onBatchDelete()
    );
    
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.background = 'var(--color-red)';
      deleteBtn.style.color = 'white';
    });
    
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.background = 'var(--background-secondary)';
      deleteBtn.style.color = '';
    });
    
    // 取消按钮
    const cancelBtn = this.createButton(
      container,
      styleClass === 'sidebar' ? '✕' : '✕ 退出',
      `cancel-selection-btn-${btnPrefix}`,
      '退出批量模式并清空所有选择',
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
    
    btn.addEventListener('click', onClick);
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
      onChange((e.target as HTMLInputElement).checked);
    });
    
    return checkbox;
  }
}