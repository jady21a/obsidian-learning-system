// src/ui/components/modals/BatchCreateModal.ts
import { Modal, App, Notice } from 'obsidian';
import type LearningSystemPlugin from '../../../main';
import { ContentUnit } from '../../../core/DataManager';
import { QuickFlashcardCreator } from '../../../core/QuickFlashcardCreator';
import { t } from '../../../i18n/translations';

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
    const lang = this.plugin.settings.language; 

  contentEl.createEl('h2', { text: t('batchCreate.title', lang) });
  
  contentEl.createEl('p', { 
    text: t('batchCreate.description', lang, { count: this.units.length })
  });

  const typeContainer = contentEl.createDiv({ cls: 'type-select-container' });
  typeContainer.createEl('h3', { text: t('batchCreate.cardType', lang) });

  let selectedType: 'smart' | 'qa' | 'cloze' = 'smart';

  const types = [
    { 
      value: 'smart', 
      label: t('batchCreate.smartType', lang), 
      desc: t('batchCreate.smartType.desc', lang) 
    },
    { 
      value: 'qa', 
      label: t('batchCreate.qaType', lang), 
      desc: t('batchCreate.qaType.desc', lang) 
    },
    { 
      value: 'cloze', 
      label: t('batchCreate.clozeType', lang), 
      desc: t('batchCreate.clozeType.desc', lang) 
    }
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

    const cancelBtn = buttonContainer.createEl('button', { 
      text: t('batchCreate.cancel', lang) 
    });
    cancelBtn.addEventListener('click', () => this.close());
  
    const createBtn = buttonContainer.createEl('button', { 
      text: t('batchCreate.createButton', lang, { count: this.units.length }),
      cls: 'mod-cta'
    });
    createBtn.addEventListener('click', async () => {
      await this.batchCreate(selectedType);
    });

    this.addStyles();
  }

  private async batchCreate(type: 'smart' | 'qa' | 'cloze') {
    const { success, failed } = await this.quickCreator.createBatchCards(this.units, type);
    
    const lang = this.plugin.settings.language;
  
    new Notice(t('batchCreate.successNotice', lang, { success, failed }));
    
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