// src/ui/components/AnnotationEditor.ts    批注编辑器
import { ContentUnit } from '../../core/DataManager';

export interface AnnotationEditorCallbacks {
  onSave: (unitId: string, content: string) => Promise<void>;
  onCancel: (unitId: string) => void;
  getAnnotationContent: (unitId: string) => string | undefined;
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
    console.log('🔒 [Toggle] Blocked - another editor is opening');
    return;
  }

  const now = Date.now();
  const lastToggle = this.toggleLock.get(unit.id) || 0;
  
  if (now - lastToggle < 200) {
    console.log('🔄 [Toggle] Debounced - too soon');
    return;
  }

  this.toggleLock.set(unit.id, now);
  
  console.log('🔄 [Toggle] Called for unit:', unit.id);

  // ⭐ 使用更严格的检查
  const existingEditor = cardEl.querySelector('.inline-annotation-editor');
  const isCurrentEditing = !!existingEditor;
  
  console.log('🔄 [Toggle] Editor exists:', isCurrentEditing);
  
  if (isCurrentEditing) {
    console.log('🔄 [Toggle] Closing current editor');
    this.close(cardEl, unit);
    return;
  }

  // ⭐ 即使没有编辑器，也要清理残留的预览元素
  const content = cardEl.querySelector('.card-content, .grid-card-content');
  const oldPreviews = content?.querySelectorAll('.annotation-preview, .grid-annotation');
  if (oldPreviews && oldPreviews.length > 0) {
    console.log('🧹 [Toggle] Cleaning up', oldPreviews.length, 'stale previews');
    oldPreviews.forEach(el => el.remove());
  }

  this.closeAllOthers(unit.id);
  
  console.log('🔄 [Toggle] Opening new editor');
  this.open(cardEl, unit);
}

/**
 * 关闭除指定 unitId 外的所有编辑器
 */
private closeAllOthers(currentUnitId: string): void {
  const allEditingCards = document.querySelectorAll('[data-editing="true"]');
  
  if (allEditingCards.length > 0) {
    console.log('🔄 [CloseOthers] Closing editors:', allEditingCards.length);
    
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
  
  console.log('📝 [Editor] Opening editor for unit:', unit.id);
  
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
  
  // ⭐ 多次检查 DOM 状态
  console.log('🔍 [Editor] Immediately after insert:', {
    editorInDOM: document.body.contains(editor),
    editorParent: editor.parentElement?.className,
    cardEditing: cardEl.getAttribute('data-editing')
  });
  
  const textarea = editor.querySelector('textarea') as HTMLTextAreaElement;
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  this.activeEditors.set(unit.id, editor);
  
  // ⭐ 50ms 后检查
  setTimeout(() => {
    console.log('🔍 [Editor] After 50ms:', {
      editorInDOM: document.body.contains(editor),
      editorParent: editor.parentElement?.className,
      cardEditing: cardEl.getAttribute('data-editing')
    });
  }, 50);
  
  // ⭐ 100ms 后检查
  setTimeout(() => {
    console.log('🔍 [Editor] After 100ms:', {
      editorInDOM: document.body.contains(editor),
      editorParent: editor.parentElement?.className,
      cardEditing: cardEl.getAttribute('data-editing')
    });
  }, 100);
  
  // ⭐ 250ms 后检查（在全局锁释放后）
  setTimeout(() => {
    console.log('🔍 [Editor] After 250ms (post-lock):', {
      editorInDOM: document.body.contains(editor),
      editorParent: editor.parentElement?.className,
      cardEditing: cardEl.getAttribute('data-editing'),
      hasPreview: !!cardEl.querySelector('.annotation-preview')
    });
    
    if (!document.body.contains(editor)) {
      console.error('🚨 [Editor] EDITOR WAS REMOVED!');
    }
    if (cardEl.querySelector('.annotation-preview')) {
      console.error('🚨 [Editor] PREVIEW WAS RECREATED!');
    }
  }, 250);
  
  setTimeout(() => {
    this.isOpening = false;
    console.log('🔓 [Editor] Global lock released');
  }, 200);
  
  console.log('📝 [Editor] Editor opened successfully');
}
  /**
   * 关闭编辑器
   */

  private close(cardEl: HTMLElement, unit: ContentUnit): void {
    console.log('❌ [Editor] Close called', { unitId: unit.id });
    
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
        console.log('✅ [Editor] Preview recreated immediately');
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
  console.log('🔗 [Editor] Binding events for unit:', unitId);
  
  let hasFocused = false; // ⭐ 标记是否真正获得过焦点
  
  // ⭐ 监听首次获得焦点
  const onFirstFocus = () => {
    console.log('✅ [Editor] First focus confirmed for unit:', unitId);
    hasFocused = true;
    textarea.removeEventListener('focus', onFirstFocus);
  };
  textarea.addEventListener('focus', onFirstFocus);
  
  // ⭐ 延迟绑定 blur 事件
// ⭐ 延迟绑定 blur 事件
setTimeout(() => {
  textarea.addEventListener('blur', async (e) => {
    // ⭐ 只有真正获得过焦点后才处理 blur
    if (!hasFocused) {
      console.log('⏭️ [Editor] Ignoring blur - never focused');
      return;
    }
    
    console.log('👁️ [Editor] Blur event for unit:', unitId);
    const relatedTarget = e.relatedTarget as HTMLElement;
    const editor = textarea.closest('.inline-annotation-editor') as HTMLElement;
    const card = editor?.closest('.compact-card, .grid-card') as HTMLElement;
    
    // ⭐ 检查焦点是否移到了编辑器外部
    if (!relatedTarget || !editor.contains(relatedTarget)) {
      setTimeout(async () => {
        // ⭐ 再次检查编辑器是否还在 DOM 中
        if (editor.parentElement && card) {
          console.log('💾 [Editor] Saving and closing on blur for unit:', unitId);
          
          // 保存内容
          await this.callbacks.onSave(unitId, textarea.value.trim());
          
          // 关闭编辑器
          const unit = { id: unitId } as ContentUnit;
          this.close(card, unit);
        }
      }, 100);
    }
  });
}, 300);

  // Tab 键保存
  textarea.addEventListener('keydown', async (e) => {
    if (e.key === 'Tab') {
      console.log('⌨️ [Editor] Tab key pressed for unit:', unitId);
      e.preventDefault();
      const editor = textarea.closest('.inline-annotation-editor') as HTMLElement;
      await this.save(editor, unitId, textarea.value);
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
  private async save(editorEl: HTMLElement, unitId: string, text: string): Promise<void> {
    console.log('💾 [Save] Saving annotation for unit:', unitId);
    console.log('💾 [Save] Editor element:', editorEl);
    console.log('💾 [Save] Editor parent before save:', editorEl.parentElement);
    
    const trimmedText = text.trim();
    
    await this.callbacks.onSave(unitId, trimmedText);
    
    console.log('💾 [Save] After callback - Editor parent:', editorEl.parentElement);
    
    const card = editorEl.closest('.compact-card, .grid-card') as HTMLElement;
    editorEl.remove();
    this.activeEditors.delete(unitId);
    
    console.log('💾 [Save] Editor removed');

    
    if (trimmedText && card) {
      const content = card.querySelector('.card-content, .grid-card-content') as HTMLElement;
      if (content) {
        // 通过回调获取最新的批注内容
        const latestContent = this.callbacks.getAnnotationContent(unitId);
        if (latestContent) {
          // 需要传入完整的 ContentUnit，这里简化处理
          this.recreatePreview(content, card, { id: unitId } as ContentUnit, latestContent);
        }
        
        // 更新 indicator
        const indicator = card.querySelector('.card-indicator') as HTMLElement;
        if (indicator && !indicator.classList.contains('has-annotation')) {
          indicator.classList.add('has-annotation');
        }
      }
    } else if (!trimmedText && card) {
      const indicator = card.querySelector('.card-indicator') as HTMLElement;
      if (indicator && indicator.classList.contains('has-annotation')) {
        indicator.classList.remove('has-annotation');
      }
    }
  }

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