// src/ui/modals/EditFlashcardModal.ts

import { App, Modal, Setting, TextAreaComponent, ButtonComponent, Notice } from 'obsidian';
import type LearningSystemPlugin from '../../../main';
import { Flashcard } from '../../../core/FlashcardManager';
import { VIEW_TYPE_SIDEBAR_OVERVIEW, VIEW_TYPE_MAIN_OVERVIEW } from '../../view/SidebarOverviewView';

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
    contentEl.empty();
    contentEl.addClass('edit-flashcard-modal');
    
    contentEl.createEl('h2', { 
      text: '✏️ 编辑闪卡' 
    });
    
    contentEl.createEl('p', {
      text: `编辑 ${this.card.type === 'qa' ? 'Q&A' : '填空'}卡片内容`,
      cls: 'modal-description'
    });
    
    // 卡片信息
    const infoDiv = contentEl.createDiv({ cls: 'card-info' });
    infoDiv.innerHTML = `
      <div style="background: var(--background-secondary); padding: 10px; border-radius: 6px; margin-bottom: 15px;">
        <div style="font-size: 0.9em; color: var(--text-muted);">
          📁 ${this.card.sourceFile.split('/').pop()}<br>
          📚 卡组: ${this.card.deck}<br>
          📊 复习: ${this.card.stats.totalReviews}次 | 正确: ${this.card.stats.correctCount}次
        </div>
      </div>
    `;
    
    // 问题/前面
    new Setting(contentEl)
      .setName(this.card.type === 'qa' ? '问题 (Front)' : '完整文本')
      .setDesc('卡片正面显示的内容')
      .addTextArea((text: TextAreaComponent) => {
        text
          .setValue(this.front)
          .onChange((value: string) => this.front = value);
        text.inputEl.rows = 4;
        text.inputEl.style.width = '100%';
      });
    
    // 答案/后面
    new Setting(contentEl)
      .setName(this.card.type === 'qa' ? '答案 (Back)' : '挖空答案')
      .setDesc(this.card.type === 'qa' ? '卡片背面显示的答案' : '多个答案用逗号分隔')
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
        .setButtonText('取消')
        .onClick(() => this.close())
      )
      .addButton((btn: ButtonComponent) => btn
        .setButtonText('保存')
        .setCta()
        .onClick(async () => await this.saveFlashcard())
      );
  }
  
  async saveFlashcard() {
    // 验证输入
    if (!this.front.trim()) {
      new Notice('⚠️ 问题/文本不能为空');
      return;
    }
    if (!this.back.trim()) {
      new Notice('⚠️ 答案不能为空');
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
      
      new Notice('✅ 闪卡已更新');
      this.close();
      
      // 刷新视图
      this.refreshOverviewView();
      
    } catch (error) {
      new Notice('❌ 保存失败');
      console.error('Error updating flashcard:', error);
    }
  }
  
  private refreshOverviewView() {
    const view = this.app.workspace.getLeavesOfType(VIEW_TYPE_SIDEBAR_OVERVIEW)[0]?.view ||
                 this.app.workspace.getLeavesOfType(VIEW_TYPE_MAIN_OVERVIEW)[0]?.view;
    if (view && 'refresh' in view) {
      (view as any).refresh();
    }
  }
  
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}