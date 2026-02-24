// src/ui/modals/EditFlashcardModal.ts

import { App, Modal, Setting, TextAreaComponent, ButtonComponent, Notice } from 'obsidian';
import type LearningSystemPlugin from '../../../main';
import { Flashcard } from '../../../core/FlashcardManager';
import { VIEW_TYPE_SIDEBAR_OVERVIEW, VIEW_TYPE_MAIN_OVERVIEW } from '../../view/SidebarOverviewView';
import { t } from '../../../i18n/translations';

export class EditFlashcardModal extends Modal {
  card: Flashcard;
  plugin: LearningSystemPlugin;
  front: string;
  back: string;
  
  constructor(app: App, plugin: LearningSystemPlugin, card: Flashcard) {
    super(app);
    this.plugin = plugin;
    this.card = card;
    this.front = card.front;
    this.back = Array.isArray(card.back) ? card.back.join(', ') : card.back;
  }
  
  onOpen() {
    const { contentEl } = this;
    const lang = this.plugin.settings.language;
    contentEl.empty();
    contentEl.addClass('edit-flashcard-modal');
    
    contentEl.createEl('h2', { 
      text: t('editCard.title', lang)
    });
    
    contentEl.createEl('p', {
      text: t(this.card.type === 'qa' ? 'editCard.description.qa' : 'editCard.description.cloze', lang),
      cls: 'modal-description'
    });
    
    // 卡片信息
    const infoDiv = contentEl.createDiv({ cls: 'card-info' });
    infoDiv.innerHTML = `
      <div style="background: var(--background-secondary); padding: 10px; border-radius: 6px; margin-bottom: 15px;">
        <div style="font-size: 0.9em; color: var(--text-muted);">
          ${t('editCard.info.file', lang)}: ${this.card.sourceFile.split('/').pop()}<br>
          ${t('editCard.info.deck', lang)}: ${this.card.deck}<br>
          ${t('editCard.info.reviews', lang)}: ${this.card.stats.totalReviews}${t('editCard.info.correct', lang)}: ${this.card.stats.correctCount}次
        </div>
      </div>
    `;
    // 问题/前面
    new Setting(contentEl)
    .setName(t(this.card.type === 'qa' ? 'editCard.front.qa' : 'editCard.front.cloze', lang))
    .setDesc(t('editCard.front.desc', lang))
    .addTextArea((text: TextAreaComponent) => {
        text
          .setValue(this.front)
          .onChange((value: string) => this.front = value);
        text.inputEl.rows = 4;
        text.inputEl.style.width = '100%';
      });
    
    // 答案/后面
    new Setting(contentEl)
    .setName(t(this.card.type === 'qa' ? 'editCard.back.qa' : 'editCard.back.cloze', lang))
    .setDesc(t(this.card.type === 'qa' ? 'editCard.back.desc.qa' : 'editCard.back.desc.cloze', lang))
    .addTextArea((text: TextAreaComponent) => {
        text
          .setValue(this.back)
          .onChange((value: string) => this.back = value);
        text.inputEl.rows = 3;
        text.inputEl.style.width = '100%';
      });
    
// 按钮组
const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
  
new Setting(buttonContainer)
  .addButton((btn: ButtonComponent) => btn
    .setButtonText(t('editCard.cancel', lang))
    .onClick(() => this.close())
  )
  .addButton((btn: ButtonComponent) => btn
    .setButtonText(t('editCard.save', lang))
    .setCta()
    .onClick(async () => await this.saveFlashcard())
  );

  }
  
  async saveFlashcard() {
    const lang = this.plugin.settings.language;
    // 验证输入
    if (!this.front.trim()) {
      new Notice(t('editCard.error.emptyFront', lang));
      return;
    }
    if (!this.back.trim()) {
      new Notice(t('editCard.error.emptyBack', lang));
      return;
    }
    
    try {
      // 更新卡片
      this.card.front = this.front.trim();
      
      if (this.card.type === 'cloze') {
        // 填空卡：将逗号分隔的答案转换为数组
        this.card.back = this.back.split(',').map(s => s.trim()).filter(s => s);
      } else {
        // 问答卡：保持字符串
        this.card.back = this.back.trim();
      }
      
      this.card.metadata.updatedAt = Date.now();
      
      await this.plugin.flashcardManager.updateCard(this.card);
      
      new Notice(t('editCard.success', lang));
      this.close();
      
      // 刷新视图
      this.refreshOverviewView();
      
    } catch (error) {
      new Notice(t('editCard.saveFailed', lang));
      console.error('Error updating flashcard:', error);
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