// src/ui/components/modals/BatchCreateModal.ts
import { Modal, App, Notice } from 'obsidian';
import type LearningSystemPlugin from '../../../main';
import { ContentUnit } from '../../../core/DataManager';
import { QuickFlashcardCreator } from '../../../core/QuickFlashcardCreator';

export class BatchCreateModal extends Modal {
  constructor(
    app: App,
    private plugin: LearningSystemPlugin,
    private quickCreator: QuickFlashcardCreator,
    private units: ContentUnit[],
    private onComplete: () => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl('h2', { text: '⚡ 批量创建闪卡' });
    
    contentEl.createEl('p', { 
      text: `为 ${this.units.length} 条未创建闪卡的笔记创建闪卡`
    });

    // 选择类型
    const typeContainer = contentEl.createDiv({ cls: 'type-select-container' });
    typeContainer.createEl('h3', { text: '卡片类型' });

    let selectedType: 'smart' | 'qa' | 'cloze' = 'smart';

    const types = [
      { value: 'smart', label: '⚡ 智能识别', desc: '自动选择最合适的类型' },
      { value: 'qa', label: '📝 问答卡片', desc: '问题和答案格式' },
      { value: 'cloze', label: '✏️ 填空卡片', desc: '挖空填空' }
    ];

    types.forEach(type => {
      const option = typeContainer.createDiv({ cls: 'type-option' });
      
      const radio = option.createEl('input', {
        type: 'radio',
        value: type.value,
        attr: { name: 'card-type' }
      });
      if (type.value === 'smart') radio.checked = true;

      const label = option.createDiv({ cls: 'type-label' });
      label.createEl('strong', { text: type.label });
      label.createEl('div', { text: type.desc, cls: 'type-desc' });

      option.addEventListener('click', () => {
        radio.checked = true;
        selectedType = type.value as any;
      });
    });

    // 按钮
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
    cancelBtn.addEventListener('click', () => this.close());

    const createBtn = buttonContainer.createEl('button', { 
      text: `创建 ${this.units.length} 张卡片`,
      cls: 'mod-cta'
    });
    createBtn.addEventListener('click', async () => {
      await this.batchCreate(selectedType);
    });

    this.addStyles();
  }

  private async batchCreate(type: 'smart' | 'qa' | 'cloze') {
    const { success, failed } = await this.quickCreator.createBatchCards(this.units, type);
    
    new Notice(`✅ 已创建 ${success} 张闪卡！${failed > 0 ? `（${failed} 张失败）` : ''}`);
    
    this.close();
    this.onComplete();
  }

  private addStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .type-select-container {
        margin: 20px 0;
      }

      .type-option {
        padding: 15px;
        margin: 10px 0;
        background: var(--background-secondary);
        border: 2px solid var(--background-modifier-border);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .type-option:hover {
        border-color: var(--interactive-accent);
        background: var(--background-modifier-hover);
      }

      .type-option input[type="radio"] {
        margin-right: 10px;
      }

      .type-label {
        display: inline-block;
        vertical-align: top;
      }

      .type-desc {
        font-size: 0.9em;
        color: var(--text-muted);
        margin-top: 4px;
      }
    `;

    document.head.appendChild(styleEl);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}