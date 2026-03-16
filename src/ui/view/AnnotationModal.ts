// annotationModal.ts
import { App, Modal, Notice, Setting } from 'obsidian';
import type LearningSystemPlugin from '../../main';
import { Annotation } from '../../core/AnnotationManager';
import { ContentUnit } from '../../core/DataManager';
import { setCssProps } from '../utils/setCssProps';

export class AnnotationModal extends Modal {
  private contentUnit: ContentUnit;
  private existingAnnotation?: Annotation;
  private annotationText: string = '';
  private badgeText: string = '';
  private badgeColor: string = '#5B9BD5';
  private onSave: (annotation: Annotation | null) => void;

  constructor(
    app: App,
    private plugin: LearningSystemPlugin,
    contentUnit: ContentUnit,
    onSave: (annotation: Annotation | null) => void  
  ) {
    super(app);
    this.contentUnit = contentUnit;
    this.onSave = onSave;

    // 加载现有批注
    this.existingAnnotation = this.plugin.annotationManager.getContentAnnotation(
      contentUnit.id
    );

    if (this.existingAnnotation) {
      this.annotationText = this.existingAnnotation.content;
      if (this.existingAnnotation.badge) {
        this.badgeText = this.existingAnnotation.badge.text;
        this.badgeColor = this.existingAnnotation.badge.color;
      }
    }
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.addClass('annotation-modal');
    contentEl.createEl('h2', { 
      text: this.existingAnnotation ? 'Edit Annotation' : 'Add Annotation' 
    });

    // 显示原文内容
    const contentPreview = contentEl.createDiv({ cls: 'annotation-content-preview' });
    contentPreview.createEl('h3', { text: 'Content:' });
    contentPreview.createEl('blockquote', { text: this.contentUnit.content });

    // 批注文本区域
    new Setting(contentEl)
      .setName('Annotation')
      .setDesc('Add your notes or comments about this content')
      .addTextArea(text => {
        text
          .setPlaceholder('Enter your annotation here...')
          .setValue(this.annotationText)
          .onChange(value => {
            this.annotationText = value;
          });
        
        text.inputEl.rows = 6;
        setCssProps(text.inputEl, { width: '100%' });
      });

    // 角标设置
    contentEl.createEl('h3', { text: 'Badge (optional)' });

    new Setting(contentEl)
      .setName('Badge text')
      .setDesc('Short text to display as a badge (e.g., “Important”, “To review”).')
      .addText(text =>
        text
          .setPlaceholder('Badge text')
          .setValue(this.badgeText)
          .onChange(value => {
            this.badgeText = value;
            this.updateBadgePreview();
          })
      );

    new Setting(contentEl)
      .setName('Badge color')
      .setDesc('Choose a color for the badge')
      .addDropdown(dropdown => {
        dropdown
          .addOption('#5B9BD5', '🔵 blue')
          .addOption('#70AD47', '🟢 green')
          .addOption('#FFC000', '🟡 yellow')
          .addOption('#FF6B6B', '🔴 red')
          .addOption('#C78BFF', '🟣 purple')
          .addOption('#FF9F43', '🟠 orange')
          .setValue(this.badgeColor)
          .onChange(value => {
            this.badgeColor = value;
            this.updateBadgePreview();
          });
      });

    // 角标预览
    const badgePreview = contentEl.createDiv({ cls: 'badge-preview-container' });
    badgePreview.createEl('span', { text: 'Preview: ', cls: 'preview-label' });
    const badgeEl = badgePreview.createEl('span', { cls: 'badge-preview' });
    this.badgePreviewEl = badgeEl;
    this.updateBadgePreview();

    // 按钮
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    // 删除按钮（如果是编辑模式）
    if (this.existingAnnotation) {
      const deleteBtn = buttonContainer.createEl('button', { 
        text: 'Delete',
        cls: 'mod-warning'
      });
      deleteBtn.addEventListener('click', async () => {
        await this.deleteAnnotation();
      });
    }

    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    const saveBtn = buttonContainer.createEl('button', { 
      text: 'Save',
      cls: 'mod-cta'
    });
    saveBtn.addEventListener('click', async () => {
      await this.saveAnnotation();
    });

  }

  private badgePreviewEl: HTMLElement;

  private updateBadgePreview() {
    if (!this.badgePreviewEl) return;

    if (this.badgeText) {
      this.badgePreviewEl.textContent = this.badgeText;
      setCssProps(this.badgePreviewEl, {
        'background-color': this.badgeColor,
        display: 'inline-block',
        color: null
      });
    } else {
      this.badgePreviewEl.textContent = 'No badge';
      setCssProps(this.badgePreviewEl, {
        'background-color': 'transparent',
        display: null,
        color: 'var(--text-muted)'
      });
    }
  }

  private async saveAnnotation() {
    if (!this.annotationText.trim()) {
      new Notice('Please enter annotation text');
      return;
    }

    try {
      let annotation: Annotation;

      if (this.existingAnnotation) {
        // 更新现有批注
        await this.plugin.annotationManager.updateAnnotation(
          this.existingAnnotation.id,
          {
            content: this.annotationText,
            badge: this.badgeText ? {
              text: this.badgeText,
              color: this.badgeColor
            } : undefined
          }
        );
        annotation = this.plugin.annotationManager.getAnnotation(
          this.existingAnnotation.id
        )!;
        new Notice('Annotation updated');
      } else {
        // 创建新批注
        annotation = await this.plugin.annotationManager.addContentAnnotation(
          this.contentUnit.id,
          this.annotationText,
          this.badgeText ? {
            text: this.badgeText,
            color: this.badgeColor
          } : undefined
        );
        new Notice('Annotation added');
      }

      this.onSave(annotation);
      this.close();
    } catch (error) {
      console.error('Error saving annotation:', error);
      new Notice('Error saving annotation');
    }
  }

  private async deleteAnnotation() {
    if (!this.existingAnnotation) return;

    try {
      await this.plugin.annotationManager.deleteAnnotation(
        this.existingAnnotation.id
      );
      new Notice('Annotation deleted');
      this.close();
      this.onSave(null); // 通知删除
    } catch (error) {
      console.error('Error deleting annotation:', error);
      new Notice('Error deleting annotation');
    }
  }



  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * 文件批注模态框
 */
export class FileAnnotationModal extends Modal {
  private filePath: string;
  private existingAnnotations: Annotation[] = [];
  private annotationText: string = '';
  private onSave: () => void;

  constructor(
    app: App,
    private plugin: LearningSystemPlugin,
    filePath: string,
    onSave: () => void
  ) {
    super(app);
    this.filePath = filePath;
    this.onSave = onSave;

    // 加载现有批注
    this.existingAnnotations = this.plugin.annotationManager.getFileAnnotations(filePath);
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl('h2', { text: 'File annotations' });

    const fileName = this.filePath.split('/').pop()?.replace('.md', '') || this.filePath;
    contentEl.createEl('p', { 
      text: `File: ${fileName}`,
      cls: 'file-name'
    });

    // 显示现有批注
    if (this.existingAnnotations.length > 0) {
      const existingSection = contentEl.createDiv({ cls: 'existing-annotations' });
      existingSection.createEl('h3', { text: 'Existing annotations' });

      this.existingAnnotations.forEach(annotation => {
        const annotationCard = existingSection.createDiv({ cls: 'annotation-card' });
        annotationCard.createEl('p', { text: annotation.content });
        
        const date = new Date(annotation.metadata.createdAt).toLocaleDateString();
        annotationCard.createEl('small', { 
          text: `Created: ${date}`,
          cls: 'annotation-date'
        });

        const deleteBtn = annotationCard.createEl('button', {
          text: '🗑 Delete',
          cls: 'delete-annotation-btn'
        });
        deleteBtn.addEventListener('click', async () => {
          await this.deleteAnnotation(annotation.id);
          this.close();
          this.onSave();
        });
      });
    }

    // 新批注输入
    contentEl.createEl('h3', { text: 'Add new annotation' });

    new Setting(contentEl)
      .setName('Annotation')
      .setDesc('Add notes about this file')
      .addTextArea(text => {
        text
          .setPlaceholder('Enter file annotation...')
          .setValue(this.annotationText)
          .onChange(value => {
            this.annotationText = value;
          });
        
        text.inputEl.rows = 4;
        setCssProps(text.inputEl, { width: '100%' });
      });

    // 按钮
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    const saveBtn = buttonContainer.createEl('button', { 
      text: 'Save',
      cls: 'mod-cta'
    });
    saveBtn.addEventListener('click', async () => {
      await this.saveAnnotation();
    });
  }

  private async saveAnnotation() {
    if (!this.annotationText.trim()) {
      new Notice('Please enter annotation text');
      return;
    }

    try {
      await this.plugin.annotationManager.addFileAnnotation(
        this.filePath,
        this.annotationText
      );
      new Notice('File annotation added');
      this.close();
      this.onSave();
    } catch (error) {
      console.error('Error saving file annotation:', error);
      new Notice('Error saving file annotation');
    }
  }

  private async deleteAnnotation(id: string) {
    try {
      await this.plugin.annotationManager.deleteAnnotation(id);
      new Notice('Annotation deleted');
    } catch (error) {
      console.error('Error deleting annotation:', error);
      new Notice('Error deleting annotation');
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}