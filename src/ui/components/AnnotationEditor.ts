// src/ui/components/AnnotationEditor.ts    批注编辑器
import { ContentUnit } from '../../core/DataManager';

export interface AnnotationEditorCallbacks {
  onSave: (unitId: string, content: string) => Promise<void>;
  onCancel: (unitId: string) => void;
  getAnnotationContent: (unitId: string) => string | undefined;
  onAnnotationCompleted?: () => Promise<void>;
}

export class AnnotationEditor {
  private callbacks: AnnotationEditorCallbacks;
  private activeEditors: Map<string, HTMLElement> = new Map();
  private toggleLock: Map<string, number> = new Map();

  private isOpening: boolean = false;


  constructor(callbacks: AnnotationEditorCallbacks) {
    this.callbacks = callbacks;
  }

/**
 * 切换内联批注编辑器
 */
toggle(cardEl: HTMLElement, unit: ContentUnit): void {
  if (this.isOpening) {
    return;
  }

  const now = Date.now();
  const lastToggle = this.toggleLock.get(unit.id) || 0;
  
  // ⭐ 修改：只对同一个 unit 进行防抖，不同 unit 可以立即切换
  if (now - lastToggle < 200) {
    return;
  }

  this.toggleLock.set(unit.id, now);
  

  // ⭐ 使用更严格的检查
  const existingEditor = cardEl.querySelector('.inline-annotation-editor');
  const isCurrentEditing = !!existingEditor;
  
  
  if (isCurrentEditing) {
    this.close(cardEl, unit);
    return;
  }

  // ⭐ 清理残留预览
  const content = cardEl.querySelector('.card-content, .grid-card-content');
  const oldPreviews = content?.querySelectorAll('.annotation-preview, .grid-annotation');
  if (oldPreviews && oldPreviews.length > 0) {
    oldPreviews.forEach(el => el.remove());
  }

  // ⭐ 修改：先关闭其他编辑器，再异步打开新编辑器
  this.closeAllOthers(unit.id);
  
  // ⭐ 使用 requestAnimationFrame 确保关闭操作完成后再打开
  requestAnimationFrame(() => {
    this.open(cardEl, unit);
  });
}

/**
 * 关闭除指定 unitId 外的所有编辑器
 */
private closeAllOthers(currentUnitId: string): void {
  const allEditingCards = document.querySelectorAll('[data-editing="true"]');
  
  if (allEditingCards.length > 0) {
    
    allEditingCards.forEach((card) => {
      const unitId = card.getAttribute('data-unit-id');
      if (unitId && unitId !== currentUnitId) {
        const unit = { id: unitId } as ContentUnit;
        this.close(card as HTMLElement, unit);
      }
    });
  }
}

/**
 * 打开编辑器
 */
private open(cardEl: HTMLElement, unit: ContentUnit): void {
  this.isOpening = true;
  
  
  cardEl.setAttribute('data-editing', 'true');
  
  const annotationContent = this.callbacks.getAnnotationContent(unit.id);
  const content = cardEl.querySelector('.card-content, .grid-card-content') as HTMLElement;
  
  const existingPreviews = content?.querySelectorAll('.annotation-preview, .grid-annotation');
  existingPreviews?.forEach(el => el.remove());
  
  const existingEditors = content?.querySelectorAll('.inline-annotation-editor');
  existingEditors?.forEach(el => el.remove());
  
  const editor = this.createEditor(unit.id, annotationContent || '');
  
  const noteText = content?.querySelector('.note-text, .grid-note-text') as HTMLElement;
  if (noteText) {
    noteText.insertAdjacentElement('afterend', editor);
  } else {
    content?.appendChild(editor);
  }
  

  const textarea = editor.querySelector('textarea') as HTMLTextAreaElement;

  // ⭐ 延迟聚焦,确保 DOM 完全渲染
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
  });

  this.activeEditors.set(unit.id, editor);
  
  
  setTimeout(() => {
    this.isOpening = false;
  }, 200);
  
}
  /**
   * 关闭编辑器
   */

  private close(cardEl: HTMLElement, unit: ContentUnit): void {
    
    const editor = cardEl.querySelector('.inline-annotation-editor') as HTMLElement;
    if (!editor) {
      cardEl.removeAttribute('data-editing');
      this.activeEditors.delete(unit.id);
      return;
    }
  
    editor.remove();
    this.activeEditors.delete(unit.id);
    cardEl.removeAttribute('data-editing');
  
    // ⭐ 修改:立即重建预览,不使用 requestAnimationFrame
    const annotationContent = this.callbacks.getAnnotationContent(unit.id);
    if (annotationContent) {
      const content = cardEl.querySelector('.card-content, .grid-card-content') as HTMLElement;
      
      // ⭐ 先清理旧预览
      const oldPreview = content?.querySelector('.annotation-preview, .grid-annotation');
      if (oldPreview) {
        oldPreview.remove();
      }
      
      // ⭐ 立即创建新预览
      if (content) {
        this.recreatePreview(content, cardEl, unit, annotationContent);
      }
    }
  }

/**
 * 创建编辑器元素
 */
private createEditor(unitId: string, defaultValue: string): HTMLElement {
  const editor = document.createElement('div');
  editor.className = 'inline-annotation-editor';
  


  const textarea = document.createElement('textarea');
  textarea.className = 'inline-annotation-textarea';
  textarea.placeholder = 'Add comment...';
  textarea.value = defaultValue;
  textarea.setAttribute('data-unit-id', unitId);
  
  const hint = document.createElement('div');
  hint.className = 'inline-annotation-hint';
  hint.textContent = 'Shift + Enter to insert a new line';
  
  editor.appendChild(textarea);
  editor.appendChild(hint);
    // ⭐ 监控样式被修改
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          console.error('🚨 [Editor] Style was modified!', {
            oldValue: mutation.oldValue,
            newValue: editor.getAttribute('style'),
            stack: new Error().stack
          });
        }
      });
    });
    
    observer.observe(editor, {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['style']
    });

  
  // 绑定其他事件
  this.bindEditorEvents(textarea, unitId);

  return editor;
}


/**
 * 绑定编辑器事件
 */
private bindEditorEvents(textarea: HTMLTextAreaElement, unitId: string): void {
  // ⭐ 保存 blur 处理器的引用，以便在 Tab 时移除
  const blurHandler = async (e: FocusEvent) => {
    
    const relatedTarget = e.relatedTarget as HTMLElement;
    const editor = textarea.closest('.inline-annotation-editor') as HTMLElement;
    const card = editor?.closest('.compact-card, .grid-card') as HTMLElement;
    
    // 检查焦点是否移到编辑器外部
    if (!relatedTarget || !editor?.contains(relatedTarget)) {
      setTimeout(async () => {
        if (editor?.parentElement && card) {
          const trimmedText = textarea.value.trim();
          const originalContent = this.callbacks.getAnnotationContent(unitId) || '';
          
          // 只有内容发生变化时才保存
          if (trimmedText !== originalContent) {
            await this.callbacks.onSave(unitId, trimmedText);
          }
          
          const unit = { id: unitId } as ContentUnit;
          this.close(card, unit);
        }
      }, 150);
    }
  };
  
  textarea.addEventListener('blur', blurHandler);

  // Tab 键保存
  textarea.addEventListener('keydown', async (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();

      (textarea as any)._tabPressed = true;
      const editor = textarea.closest('.inline-annotation-editor') as HTMLElement;
      const card = editor?.closest('.compact-card, .grid-card') as HTMLElement;
      
      if (editor && card) {
        // ⭐ 关键：在 remove 前移除 blur 监听器，彻底阻止重复触发
        textarea.removeEventListener('blur', blurHandler);
        
        const trimmedText = textarea.value.trim();
        const originalContent = this.callbacks.getAnnotationContent(unitId) || '';
        editor.remove();
        this.activeEditors.delete(unitId);
        card.removeAttribute('data-editing');
        
        // 只有内容改变时才保存
        if (trimmedText !== originalContent) {
          await this.callbacks.onSave(unitId, trimmedText);
        }
        
        // 更新预览和指示器
        if (trimmedText) {
          const content = card.querySelector('.card-content, .grid-card-content') as HTMLElement;
          if (content) {
            const latestContent = this.callbacks.getAnnotationContent(unitId);
            if (latestContent) {
              this.recreatePreview(content, card, { id: unitId } as ContentUnit, latestContent);
            }
            
            const indicator = card.querySelector('.card-indicator') as HTMLElement;
            if (indicator && !indicator.classList.contains('has-annotation')) {
              indicator.classList.add('has-annotation');
            }
          }
        } else {
          const indicator = card.querySelector('.card-indicator') as HTMLElement;
          if (indicator && indicator.classList.contains('has-annotation')) {
            indicator.classList.remove('has-annotation');
          }
        }
      }
    }
  });
  
  // 阻止事件冒泡
  textarea.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  
  textarea.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}
  /**
   * 保存批注
   */
  // private async save(editorEl: HTMLElement, unitId: string, text: string): Promise<void> {
    
  //   const trimmedText = text.trim();
  //   const originalContent = this.callbacks.getAnnotationContent(unitId) || '';

  //   const hasChanged = trimmedText !== originalContent;
  
  //   if (hasChanged) {
  //     await this.callbacks.onSave(unitId, trimmedText);
      
  //   }
    
  //   const card = editorEl.closest('.compact-card, .grid-card') as HTMLElement;
  //   editorEl.remove();
  //   this.activeEditors.delete(unitId);
    

    
  //   if (trimmedText && card) {
  //     const content = card.querySelector('.card-content, .grid-card-content') as HTMLElement;
  //     if (content) {
  //       // 通过回调获取最新的批注内容
  //       const latestContent = this.callbacks.getAnnotationContent(unitId);
  //       if (latestContent) {
  //         // 需要传入完整的 ContentUnit，这里简化处理
  //         this.recreatePreview(content, card, { id: unitId } as ContentUnit, latestContent);
  //       }
        
  //       // 更新 indicator
  //       const indicator = card.querySelector('.card-indicator') as HTMLElement;
  //       if (indicator && !indicator.classList.contains('has-annotation')) {
  //         indicator.classList.add('has-annotation');
  //       }
  //     }
  //   } else if (!trimmedText && card) {
  //     const indicator = card.querySelector('.card-indicator') as HTMLElement;
  //     if (indicator && indicator.classList.contains('has-annotation')) {
  //       indicator.classList.remove('has-annotation');
  //     }
  //   }
  // }

  /**
   * 重新创建批注预览
   */
  private recreatePreview(
    contentEl: HTMLElement,
    cardEl: HTMLElement,
    unit: ContentUnit,
    annotationText: string
  ): void {
    const existingPreview = contentEl.querySelector('.annotation-preview, .grid-annotation');
    if (existingPreview) {
      existingPreview.remove();
    }
    
    const isGridCard = cardEl.classList.contains('grid-card');
    const annEl = document.createElement('div');
    annEl.className = isGridCard ? 'grid-annotation' : 'annotation-preview';
    
    if (isGridCard) {
      annEl.innerHTML = `💬 ${annotationText}`;
    } else {
      const displayText = annotationText.length > 60
        ? annotationText.substring(0, 60) + '...'
        : annotationText;
      annEl.textContent = `💬 ${displayText}`;
    }
    
    // 点击事件
    annEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle(cardEl, unit);
    });
    
    // Tab 键事件
    annEl.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        this.toggle(cardEl, unit);
      }
    });
    
    const noteText = contentEl.querySelector('.note-text, .grid-note-text') as HTMLElement;
    if (noteText) {
      noteText.insertAdjacentElement('afterend', annEl);
    } else {
      contentEl.appendChild(annEl);
    }
    
    annEl.setAttribute('tabindex', '0');
    annEl.focus();
  }

  /**
   * 关闭所有活动的编辑器
   */
  closeAll(): void {
    this.activeEditors.forEach((editor) => {
      editor.remove();
    });
    this.activeEditors.clear();
  }
}