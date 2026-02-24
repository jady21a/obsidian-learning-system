// src/ui/modals/ManualFlashcardModal.ts

import { App, Modal, Setting, TextAreaComponent, ButtonComponent, Notice } from 'obsidian';
import type LearningSystemPlugin from '../../../main';
import { ContentUnit } from '../../../core/DataManager';
import { VIEW_TYPE_SIDEBAR_OVERVIEW, VIEW_TYPE_MAIN_OVERVIEW } from '../../view/SidebarOverviewView';
import { t } from '../../../i18n/translations';


export class ManualFlashcardModal extends Modal {
  unit: ContentUnit;
  type: 'qa' | 'cloze';
  plugin: LearningSystemPlugin;
  question: string = '';
  answer: string = '';
  
  constructor(app: App, plugin: LearningSystemPlugin, unit: ContentUnit, type: 'qa' | 'cloze') {
    super(app);
    this.plugin = plugin;
    this.unit = unit;
    this.type = type;
    
    // 根据类型设置默认值
    if (type === 'qa') {
      this.question = unit.type === 'QA' ? unit.content : unit.content;
      this.answer = unit.type === 'QA' && unit.answer ? unit.answer : '';
    } else {
      this.question = unit.fullContext || unit.content;
      this.answer = unit.content;
    }
  }
  
  onOpen() {
    const { contentEl } = this;
    const lang = this.plugin.settings.language;
    contentEl.empty();
    contentEl.addClass('manual-flashcard-modal');
    
    contentEl.createEl('h2', { 
      text: t(this.type === 'qa' ? 'manualCard.title.qa' : 'manualCard.title.cloze', lang)
    });
    
    contentEl.createEl('p', {
      text: t(this.type === 'qa' ? 'manualCard.description.qa' : 'manualCard.description.cloze', lang),
      cls: 'modal-description'
    });
    
    // 问题/完整文本
    new Setting(contentEl)
      .setName(t(this.type === 'qa' ? 'manualCard.front.qa' : 'manualCard.front.cloze', lang))
      .setDesc(t(this.type === 'qa' ? 'manualCard.front.desc.qa' : 'manualCard.front.desc.cloze', lang))
      .addTextArea((text: TextAreaComponent) => {
        text
          .setValue(this.question)
          .setPlaceholder(t(this.type === 'qa' ? 'manualCard.front.placeholder.qa' : 'manualCard.front.placeholder.cloze', lang))
          .onChange((value: string) => this.question = value);
        text.inputEl.rows = 4;
        text.inputEl.style.width = '100%';
      });
    
    // 答案/挖空内容
    new Setting(contentEl)
      .setName(t(this.type === 'qa' ? 'manualCard.back.qa' : 'manualCard.back.cloze', lang))
      .setDesc(t(this.type === 'qa' ? 'manualCard.back.desc.qa' : 'manualCard.back.desc.cloze', lang))
      .addTextArea((text: TextAreaComponent) => {
        text
          .setValue(this.answer)
          .setPlaceholder(t(this.type === 'qa' ? 'manualCard.back.placeholder.qa' : 'manualCard.back.placeholder.cloze', lang))
          .onChange((value: string) => this.answer = value);
        text.inputEl.rows = 3;
        text.inputEl.style.width = '100%';
      });
    
    // 按钮组
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    
    new Setting(buttonContainer)
      .addButton((btn: ButtonComponent) => btn
        .setButtonText(t('manualCard.cancel', lang))
        .onClick(() => this.close())
      )
      .addButton((btn: ButtonComponent) => btn
        .setButtonText(t('manualCard.create', lang))
        .setCta()
        .onClick(async () => await this.createFlashcard())
      );
  }
  async createFlashcard() {
    const lang = this.plugin.settings.language;
    
    // 验证输入
    if (!this.question.trim()) {
      new Notice(t('manualCard.error.emptyFront', lang));
      return;
    }
    if (!this.answer.trim()) {
      new Notice(t('manualCard.error.emptyBack', lang));
      return;
    }
    
    try {
      // 使用 FlashcardManager 的 createFlashcardFromUnit 方法
      await this.plugin.flashcardManager.createFlashcardFromUnit(
        this.unit,
        {
          customQuestion: this.question.trim(),
          customAnswer: this.answer.trim(),
          cardType: this.type
        }
      );
      
      new Notice(t(this.type === 'qa' ? 'manualCard.success.qa' : 'manualCard.success.cloze', lang));
      
      this.close();
      
      // 刷新视图
      this.refreshOverviewView();
      
    } catch (error) {
      new Notice(t('manualCard.createFailed', lang));
      console.error('Error creating flashcard:', error);
    }
  }
  
private refreshOverviewView() {
  const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_SIDEBAR_OVERVIEW)[0]?.view ||
               this.app.workspace.getLeavesOfType(VIEW_TYPE_MAIN_OVERVIEW)[0]?.view;
  if (view && 'refresh' in view && typeof (view as { refresh: unknown }).refresh === 'function') {
    (view as { refresh: () => void }).refresh();
  }
}
  
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}