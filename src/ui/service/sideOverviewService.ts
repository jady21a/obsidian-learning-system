// src/ui/services/OverviewService.ts

import { App, ItemView, TFile, Notice, MarkdownView } from 'obsidian';
import type LearningSystemPlugin from '../../main';
import { ContentUnit } from '../../core/DataManager';
import { QuickFlashcardCreator } from '../../core/QuickFlashcardCreator';
import { ViewState } from '../stats/ViewState';
import { t } from '../../i18n/translations';

export class sideOverviewService {
  constructor(
    private plugin: LearningSystemPlugin,
    private state: ViewState
  ) {}

  /**
   * 跳转到笔记的源文件位置
   */
  async jumpToSource(unit: ContentUnit, app: App): Promise<void> {
    const lang = this.plugin.settings.language;
    const file = app.vault.getAbstractFileByPath(unit.source.file);
    if (!(file instanceof TFile)) {
      new Notice(t('service.fileNotExist', lang));
      return;
    }
    
    this.state.shouldRestoreScroll = true;
    
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file);
    
    setTimeout(() => {
      const view = app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        const editor = view.editor;
        if (editor) {
          const line = unit.source.position.line;
          const lineCount = editor.lineCount();
          const validLine = Math.min(line, lineCount - 1);
          
          editor.setCursor({ line: validLine, ch: 0 });
          editor.scrollIntoView(
            { from: { line: validLine, ch: 0 }, to: { line: validLine, ch: 0 } },
            true
          );
          
          setTimeout(() => {
            try {
              const lineLength = editor.getLine(validLine)?.length || 0;
              editor.setSelection(
                { line: validLine, ch: 0 },
                { line: validLine, ch: lineLength }
              );
            } catch (e) {
              console.error('Selection error:', e);
            }
          }, 100);
        }
      }
    }, 200);
  }

  /**
   * 保存或删除批注
   */
  async saveAnnotation(unitId: string, content: string): Promise<void> {
    const lang = this.plugin.settings.language;
    const trimmedText = content.trim();
    const annotation = this.plugin.annotationManager.getContentAnnotation(unitId);
    
    if (trimmedText) {
      if (annotation) {
        await this.plugin.annotationManager.updateAnnotation(annotation.id, {
          content: trimmedText
        });
      } else {
        await this.plugin.annotationManager.addContentAnnotation(unitId, trimmedText);
      }
    } else if (annotation) {
      await this.plugin.annotationManager.deleteAnnotation(annotation.id);
      new Notice(t('service.annotationDeleted', lang));
    }
  }

  /**
   * AI 快速生成闪卡
   */
  async quickGenerateFlashcard(unit: ContentUnit): Promise<void> {
    const lang = this.plugin.settings.language;
    try {
      const creator = new QuickFlashcardCreator(this.plugin);
      
      // 等待闪卡创建完成
      await creator.createSmartCard(unit);
  
      // 给一个短暂延迟确保数据已写入
      await new Promise(resolve => setTimeout(resolve, 150));
      
      new Notice(t('service.flashcardGenerated', lang));
      
    } catch (error) {
      new Notice(t('service.generateFailed', lang));
      console.error(error);
    }
  }

  /**
   * 批量删除笔记
   */
  async batchDeleteNotes(unitIds: Set<string>): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    for (const unitId of unitIds) {
      try {
        const unit = this.plugin.dataManager.getContentUnit(unitId);
        
        if (unit) {
          // 先删除关联的闪卡
          if (unit.flashcardIds.length > 0) {
            for (const cardId of unit.flashcardIds) {
              await this.plugin.flashcardManager.deleteCard(cardId);
            }
          }
        }
        
        await this.plugin.dataManager.deleteContentUnit(unitId);
        success++;
      } catch (error) {
        console.error('Error deleting note:', error);
        failed++;
      }
    }
    
    return { success, failed };
  }

  /**
   * 批量删除闪卡
   */
  async batchDeleteFlashcards(cardIds: Set<string>): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    for (const cardId of cardIds) {
      try {
        await this.plugin.flashcardManager.deleteCard(cardId);
        success++;
      } catch (error) {
        console.error('Error deleting flashcard:', error);
        failed++;
      }
    }
    
    return { success, failed };
  }

  /**
   * 获取批注内容
   */
  getAnnotationContent(unitId: string): string | undefined {
    const ann = this.plugin.annotationManager.getContentAnnotation(unitId);
    return ann?.content;
  }

  /**
   * 跳转到闪卡的源文件
   */
  async jumpToFlashcardSource(cardId: string, app: App): Promise<void> {
    const lang = this.plugin.settings.language;
    const card = this.plugin.flashcardManager.getFlashcard(cardId);
    if (!card) {
      new Notice(t('service.flashcardNotFound', lang));
      return;
    }
  
    const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
    if (unit) {
      await this.jumpToSource(unit, app);
    } else {
      // 如果没有关联的笔记单元，只打开文件
      const file = app.vault.getAbstractFileByPath(card.sourceFile);
      if (file instanceof TFile) {
        await app.workspace.getLeaf(false).openFile(file);
        new Notice(t('service.sourceFileOpened', lang));
      } else {
        new Notice(t('service.noteNotFound', lang));
      }
    }
  }

  /**
   * 激活统计视图
   */
  activateStatsView(): void {
   void this.plugin.activateStats();
  }
}