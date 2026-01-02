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

  constructor(callbacks: AnnotationEditorCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * 切换内联批注编辑器
   */
  toggle(cardEl: HTMLElement, unit: ContentUnit): void {
    const existingEditor = cardEl.querySelector('.inline-annotation-editor') as HTMLElement;
    
    if (existingEditor) {
      this.close(cardEl, unit);
      return;
    }

    this.open(cardEl, unit);
  }

  /**
   * 打开编辑器
   */
  private open(cardEl: HTMLElement, unit: ContentUnit): void {
    const annotationContent = this.callbacks.getAnnotationContent(unit.id);
    const content = cardEl.querySelector('.card-content, .grid-card-content') as HTMLElement;
    const annotationPreview = content.querySelector('.annotation-preview, .grid-annotation') as HTMLElement;
    
    const editor = this.createEditor(unit.id, annotationContent || '');
    
    if (annotationPreview) {
      annotationPreview.replaceWith(editor);
    } else {
      const noteText = content.querySelector('.note-text, .grid-note-text') as HTMLElement;
      if (noteText) {
        noteText.after(editor);
      } else {
        content.appendChild(editor);
      }
    }

    const textarea = editor.querySelector('textarea') as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    this.activeEditors.set(unit.id, editor);
  }

  /**
   * 关闭编辑器
   */
  private close(cardEl: HTMLElement, unit: ContentUnit): void {
    const editor = cardEl.querySelector('.inline-annotation-editor') as HTMLElement;
    if (!editor) return;

    editor.remove();
    this.activeEditors.delete(unit.id);

    // 恢复批注预览
    const annotationContent = this.callbacks.getAnnotationContent(unit.id);
    if (annotationContent) {
      const content = cardEl.querySelector('.card-content, .grid-card-content') as HTMLElement;
      this.recreatePreview(content, cardEl, unit, annotationContent);
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

    // 绑定事件
    this.bindEditorEvents(textarea, unitId);

    return editor;
  }

  /**
   * 绑定编辑器事件
   */
  private bindEditorEvents(textarea: HTMLTextAreaElement, unitId: string): void {
    // 失焦保存
    textarea.addEventListener('blur', async (e) => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      const editor = textarea.closest('.inline-annotation-editor') as HTMLElement;
      
      if (!relatedTarget || !editor.contains(relatedTarget)) {
        setTimeout(async () => {
          if (editor.parentElement) {
            await this.save(editor, unitId, textarea.value);
          }
        }, 100);
      }
    });

    // Tab 键保存
    textarea.addEventListener('keydown', async (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const editor = textarea.closest('.inline-annotation-editor') as HTMLElement;
        await this.save(editor, unitId, textarea.value);
      }
    });
  }

  /**
   * 保存批注
   */
  private async save(editorEl: HTMLElement, unitId: string, text: string): Promise<void> {
    const trimmedText = text.trim();
    
    await this.callbacks.onSave(unitId, trimmedText);
    
    const card = editorEl.closest('.compact-card, .grid-card') as HTMLElement;
    editorEl.remove();
    this.activeEditors.delete(unitId);
    
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