// flashcardCreatModal.ts
import { App, Modal, Notice, Setting } from 'obsidian';
import type LearningSystemPlugin from '../main';
import { ContentUnit } from '../core/DataManager';

export class FlashcardCreateModal extends Modal {
  private contentUnit: ContentUnit;
  private cardType: 'qa' | 'cloze' = 'qa';
  
  // Q&A 字段
  private question: string = '';
  private answer: string = '';
  
  // Cloze 字段
  private clozeText: string = '';
  private selectedRanges: { start: number; end: number; text: string }[] = [];
  
  private onSave: () => void;

  constructor(
    app: App,
    private plugin: LearningSystemPlugin,
    contentUnit: ContentUnit,
    onSave: () => void
  ) {
    super(app);
    this.contentUnit = contentUnit;
    this.onSave = onSave;
    
    // 默认使用内容作为答案/完形填空文本
    this.answer = contentUnit.content;
    this.clozeText = contentUnit.content;
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.addClass('flashcard-create-modal');
    contentEl.createEl('h2', { text: 'Create Flashcard' });

    // 显示源内容
    const contentPreview = contentEl.createDiv({ cls: 'content-preview' });
    contentPreview.createEl('h3', { text: 'Source Content:' });
    contentPreview.createEl('blockquote', { text: this.contentUnit.content });

    // 卡片类型选择
    new Setting(contentEl)
      .setName('Card Type')
      .setDesc('Choose the type of flashcard')
      .addDropdown(dropdown => {
        dropdown
          .addOption('qa', '📝 Question & Answer')
          .addOption('cloze', '✏️ Cloze Deletion')
          .setValue(this.cardType)
          .onChange(value => {
            this.cardType = value as 'qa' | 'cloze';
            this.refreshCardInputs();
          });
      });

    // 卡片输入区域容器
    this.cardInputContainer = contentEl.createDiv({ cls: 'card-input-container' });
    this.refreshCardInputs();

    // 按钮
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = buttonContainer.createEl('button', { 
      text: 'Create Flashcard',
      cls: 'mod-cta'
    });
    saveBtn.addEventListener('click', () => this.saveFlashcard());

    this.addStyles();
  }

  private cardInputContainer: HTMLElement;

  private refreshCardInputs() {
    this.cardInputContainer.empty();

    if (this.cardType === 'qa') {
      this.renderQAInputs();
    } else {
      this.renderClozeInputs();
    }
  }

  private renderQAInputs() {
    // 问题输入
    new Setting(this.cardInputContainer)
      .setName('Question (Front)')
      .setDesc('What question should this card ask?')
      .addTextArea(text => {
        text
          .setPlaceholder('Enter your question...')
          .setValue(this.question)
          .onChange(value => {
            this.question = value;
          });
        text.inputEl.rows = 3;
        text.inputEl.style.width = '100%';
      });

    // 答案输入
    new Setting(this.cardInputContainer)
      .setName('Answer (Back)')
      .setDesc('What is the correct answer?')
      .addTextArea(text => {
        text
          .setPlaceholder('Enter the answer...')
          .setValue(this.answer)
          .onChange(value => {
            this.answer = value;
          });
        text.inputEl.rows = 3;
        text.inputEl.style.width = '100%';
      });

    // 提示：可以使用原内容
    const hint = this.cardInputContainer.createDiv({ cls: 'input-hint' });
    hint.createEl('small', { 
      text: '💡 Tip: You can use the source content as the answer, or write your own.'
    });
  }

  private renderClozeInputs() {
    const container = this.cardInputContainer;

    container.createEl('h3', { text: 'Cloze Deletion' });
    container.createEl('p', { 
      text: 'Select text to hide (cloze deletion). Click on words to toggle selection.',
      cls: 'cloze-instruction'
    });

    // 可选择的文本区域
    const textContainer = container.createDiv({ cls: 'cloze-text-container' });
    this.renderSelectableText(textContainer);

    // 选中的删除项列表
    if (this.selectedRanges.length > 0) {
      const selectedList = container.createDiv({ cls: 'selected-deletions' });
      selectedList.createEl('h4', { text: 'Selected Deletions:' });
      
      this.selectedRanges.forEach((range, index) => {
        const item = selectedList.createDiv({ cls: 'deletion-item' });
        item.createSpan({ text: `${index + 1}. ` });
        item.createSpan({ 
          text: range.text,
          cls: 'deletion-text'
        });
        
        const removeBtn = item.createEl('button', {
          text: '×',
          cls: 'remove-deletion-btn'
        });
        removeBtn.addEventListener('click', () => {
          this.selectedRanges.splice(index, 1);
          this.refreshCardInputs();
        });
      });
    }

    // 预览
    const preview = container.createDiv({ cls: 'cloze-preview' });
    preview.createEl('h4', { text: 'Preview:' });
    preview.createDiv({ 
      text: this.generateClozePreview(),
      cls: 'preview-text'
    });
  }

  private renderSelectableText(container: HTMLElement) {
    const words = this.clozeText.split(/(\s+)/); // 保留空格
    let currentIndex = 0;

    words.forEach(word => {
      const wordStart = currentIndex;
      const wordEnd = currentIndex + word.length;

      if (word.trim()) {
        // 检查是否已选中
        const isSelected = this.selectedRanges.some(
          range => range.start === wordStart && range.end === wordEnd
        );

        const span = container.createEl('span', {
          text: word,
          cls: isSelected ? 'cloze-word selected' : 'cloze-word'
        });

        span.addEventListener('click', () => {
          this.toggleWordSelection(wordStart, wordEnd, word);
        });
      } else {
        container.createEl('span', { text: word });
      }

      currentIndex = wordEnd;
    });
  }

  private toggleWordSelection(start: number, end: number, text: string) {
    const index = this.selectedRanges.findIndex(
      range => range.start === start && range.end === end
    );

    if (index > -1) {
      // 取消选择
      this.selectedRanges.splice(index, 1);
    } else {
      // 添加选择
      this.selectedRanges.push({ start, end, text });
      // 按位置排序
      this.selectedRanges.sort((a, b) => a.start - b.start);
    }

    this.refreshCardInputs();
  }

  private generateClozePreview(): string {
    let preview = this.clozeText;
    const sorted = [...this.selectedRanges].sort((a, b) => b.start - a.start);

    for (const range of sorted) {
      const before = preview.substring(0, range.start);
      const after = preview.substring(range.end);
      preview = `${before}[...]${after}`;
    }

    return preview;
  }

  private async saveFlashcard() {
    try {
      if (this.cardType === 'qa') {
        // 验证输入
        if (!this.question.trim()) {
          new Notice('Please enter a question');
          return;
        }
        if (!this.answer.trim()) {
          new Notice('Please enter an answer');
          return;
        }

        // 创建问答卡
        await this.plugin.flashcardManager.createQACard(
          this.contentUnit.id,
          this.question,
          this.answer
        );

        new Notice('Q&A flashcard created!');

      } else {
        // 验证输入
        if (this.selectedRanges.length === 0) {
          new Notice('Please select at least one word to hide');
          return;
        }

        // 创建完形填空卡
        const deletions = this.selectedRanges.map(range => ({
          index: range.start,
          answer: range.text
        }));

        await this.plugin.flashcardManager.createClozeCard(
          this.contentUnit.id,
          this.clozeText,
          deletions
        );

        new Notice('Cloze flashcard created!');
      }

      this.close();
      this.onSave();

    } catch (error) {
      console.error('Error creating flashcard:', error);
      new Notice('Error creating flashcard');
    }
  }

  private addStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .flashcard-create-modal {
        padding: 20px;
        max-width: 600px;
      }

      .content-preview {
        margin: 20px 0;
        padding: 15px;
        background: var(--background-secondary);
        border-radius: 6px;
      }

      .content-preview h3 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 0.9em;
        color: var(--text-muted);
      }

      .content-preview blockquote {
        margin: 0;
        padding: 10px;
        border-left: 3px solid var(--interactive-accent);
        background: var(--background-primary);
        border-radius: 4px;
      }

      .card-input-container {
        margin: 20px 0;
      }

      .input-hint {
        margin-top: 10px;
        padding: 10px;
        background: var(--background-secondary);
        border-radius: 4px;
        color: var(--text-muted);
      }

      /* Cloze 样式 */
      .cloze-instruction {
        color: var(--text-muted);
        font-size: 0.9em;
        margin-bottom: 15px;
      }

      .cloze-text-container {
        padding: 15px;
        background: var(--background-primary);
        border: 2px solid var(--background-modifier-border);
        border-radius: 6px;
        line-height: 1.8;
        margin-bottom: 15px;
        cursor: default;
      }

      .cloze-word {
        padding: 2px 4px;
        margin: 0 1px;
        border-radius: 3px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .cloze-word:hover {
        background: var(--background-modifier-hover);
      }

      .cloze-word.selected {
        background: var(--interactive-accent);
        color: white;
        font-weight: 500;
      }

      .selected-deletions {
        margin: 15px 0;
        padding: 15px;
        background: var(--background-secondary);
        border-radius: 6px;
      }

      .selected-deletions h4 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 0.9em;
        color: var(--text-muted);
      }

      .deletion-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: var(--background-primary);
        border-radius: 4px;
        margin-bottom: 6px;
      }

      .deletion-text {
        flex: 1;
        font-weight: 500;
        color: var(--interactive-accent);
      }

      .remove-deletion-btn {
        padding: 2px 8px;
        background: var(--background-modifier-error);
        color: white;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
      }

      .remove-deletion-btn:hover {
        background: var(--color-red);
      }

      .cloze-preview {
        margin: 15px 0;
        padding: 15px;
        background: var(--background-secondary);
        border-radius: 6px;
      }

      .cloze-preview h4 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 0.9em;
        color: var(--text-muted);
      }

      .preview-text {
        padding: 10px;
        background: var(--background-primary);
        border-radius: 4px;
        line-height: 1.6;
      }

      .modal-button-container {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
      }

      .modal-button-container button {
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      }
    `;

    document.head.appendChild(styleEl);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}