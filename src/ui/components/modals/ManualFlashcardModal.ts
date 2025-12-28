// src/ui/modals/ManualFlashcardModal.ts

import { App, Modal, Setting, TextAreaComponent, ButtonComponent, Notice } from 'obsidian';
import type LearningSystemPlugin from '../../../main';
import { ContentUnit } from '../../../core/DataManager';
import { VIEW_TYPE_SIDEBAR_OVERVIEW, VIEW_TYPE_MAIN_OVERVIEW } from '../../view/SidebarOverviewView';

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
    contentEl.empty();
    contentEl.addClass('manual-flashcard-modal');
    
    contentEl.createEl('h2', { 
      text: this.type === 'qa' ? '✏️ 创建 QA 闪卡' : '✏️ 创建填空闪卡' 
    });
    
    contentEl.createEl('p', {
      text: this.type === 'qa' 
        ? '创建一张问答卡片，可以自定义问题和答案' 
        : '创建一张填空卡片，在完整文本中标记要挖空的内容',
      cls: 'modal-description'
    });
    
    // 问题/完整文本
    new Setting(contentEl)
      .setName(this.type === 'qa' ? '问题 (Front)' : '完整文本')
      .setDesc(this.type === 'qa' ? '卡片正面显示的问题' : '包含答案的完整句子或段落')
      .addTextArea((text: TextAreaComponent) => {
        text
          .setValue(this.question)
          .setPlaceholder(
            this.type === 'qa' 
              ? '例如: 什么是间隔重复?' 
              : '例如: 间隔重复是一种学习技术'
          )
          .onChange((value: string) => this.question = value);
        text.inputEl.rows = 4;
        text.inputEl.style.width = '100%';
      });
    
    // 答案/挖空内容
    new Setting(contentEl)
      .setName(this.type === 'qa' ? '答案 (Back)' : '挖空内容')
      .setDesc(this.type === 'qa' ? '卡片背面显示的答案' : '要被挖空的关键词或短语')
      .addTextArea((text: TextAreaComponent) => {
        text
          .setValue(this.answer)
          .setPlaceholder(
            this.type === 'qa' 
              ? '例如: 间隔重复是一种学习技术...' 
              : '例如: 间隔重复'
          )
          .onChange((value: string) => this.answer = value);
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
        .setButtonText('创建闪卡')
        .setCta()
        .onClick(async () => await this.createFlashcard())
      );
  }
  
  async createFlashcard() {
    // 验证输入
    if (!this.question.trim()) {
      new Notice('⚠️ 问题/文本不能为空');
      return;
    }
    if (!this.answer.trim()) {
      new Notice('⚠️ 答案不能为空');
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
      
      new Notice(
        this.type === 'qa' 
          ? '✅ QA 闪卡已创建' 
          : '✅ 填空闪卡已创建'
      );
      
      this.close();
      
      // 刷新视图
      this.refreshOverviewView();
      
    } catch (error) {
      new Notice('❌ 创建闪卡失败');
      console.error('Error creating flashcard:', error);
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