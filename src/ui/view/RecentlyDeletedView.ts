import { Modal, Notice, ButtonComponent, Menu } from 'obsidian';
import type LearningSystemPlugin from '../../main';
import { t } from '../../i18n/translations';
import { ContentUnit, DeletedContentUnit } from '../../core/DataManager';
import { DeletedItem } from '../../core/FlashcardManager';


export class RecentlyDeletedModal extends Modal {
  plugin: LearningSystemPlugin;

  constructor(plugin: LearningSystemPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('recently-deleted-modal');
    
    this.render();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private render() {
    const { contentEl } = this;
    contentEl.empty();

    // 标题
    const header = contentEl.createDiv({ cls: 'modal-title' });
    header.createEl('h2', { text: t('recentDelete.title', this.plugin.settings.language) });

    // 工具栏
    const toolbar = contentEl.createDiv({ cls: 'recently-deleted-toolbar' });
    
    const stats = this.getStats();
    const statsText = toolbar.createDiv({ cls: 'deleted-stats' });
    statsText.setText(
      `📝 ${stats.notes} ${t('confirm.notes', this.plugin.settings.language)} • ` +
      `🃏 ${stats.cards} ${t('confirm.flashcards', this.plugin.settings.language)}`
    );

    const actions = toolbar.createDiv({ cls: 'deleted-actions' });
    
    new ButtonComponent(actions)
      .setButtonText(t('recentDelete.clearAll', this.plugin.settings.language))
      .setWarning()
      .onClick(async () => {
        if (confirm(t('confirm.clearAllDeleted', this.plugin.settings.language))) {
          await this.clearAll();
        }
      });

    // 内容区域
    const content = contentEl.createDiv({ cls: 'recently-deleted-content' });

    const deletedNotes = this.plugin.dataManager.getRecentlyDeletedUnits();
    const deletedCards = this.plugin.flashcardManager.getRecentlyDeleted();

    if (deletedNotes.length === 0 && deletedCards.length === 0) {
      this.renderEmpty(content);
      return;
    }

    if (deletedNotes.length > 0) {
      this.renderDeletedNotes(content, deletedNotes);
    }

    if (deletedCards.length > 0) {
      this.renderDeletedCards(content, deletedCards);
    }
  }



  private renderEmpty(container: HTMLElement) {
    const empty = container.createDiv({ cls: 'empty-deleted' });
    const lang = this.plugin.settings.language;
    empty.createDiv({ cls: 'empty-icon', text: '🎉' });
    empty.createDiv({ cls: 'empty-text', text: t('recentDelete.empty', lang) });
    empty.createDiv({ cls: 'empty-hint', text: t('recentDelete.emptyHint', lang) });
  }

  private renderDeletedNotes(container: HTMLElement, items: DeletedContentUnit[]) {
    const section = container.createDiv({ cls: 'deleted-section' });
    
    const lang = this.plugin.settings.language;
    const header = section.createDiv({ cls: 'section-header' });
    header.createEl('h3', { text: `📝 ${t('confirm.notes', lang)} (${items.length})` });

    const list = section.createDiv({ cls: 'deleted-list' });

    items.forEach((item) => {
      const itemEl = list.createDiv({ cls: 'deleted-item' });

      // 左侧信息
      const info = itemEl.createDiv({ cls: 'deleted-item-info' });

      const content = info.createDiv({ cls: 'deleted-item-content' });
      content.setText(
        item.unit.content.substring(0, 150) +
        (item.unit.content.length > 150 ? '...' : '')
      );

      const meta = info.createDiv({ cls: 'deleted-item-meta' });
      meta.createSpan({ cls: 'deleted-time', text: this.formatTime(item.deletedAt) });
      meta.createSpan({ cls: 'deleted-source', text: `📄 ${item.unit.source.file}` });
      if (item.associatedCardIds.length > 0) {
        meta.createSpan({
          cls: 'deleted-cards',
          text: `🃏 ${item.associatedCardIds.length} ${t('confirm.flashcards', lang)}`,
        });
      }
      meta.createSpan({ cls: 'deleted-reason', text: this.getDeleteReason(item.deletedBy) });

      // 右侧操作
      const actions = itemEl.createDiv({ cls: 'deleted-item-actions' });
      
      // 恢复按钮
      new ButtonComponent(actions)
        .setButtonText(t('recentDelete.restore', this.plugin.settings.language))
        .setIcon('rotate-ccw')
        .onClick(async () => {
          await this.restoreNote(item);
        });
      
      // 更多操作按钮
      new ButtonComponent(actions)
        .setIcon('more-vertical')
        .onClick((e) => {
          this.showNoteMenu(e, item);
        });
    });
  }

  private renderDeletedCards(container: HTMLElement, items: DeletedItem[]) {
    const section = container.createDiv({ cls: 'deleted-section' });
    
    const lang = this.plugin.settings.language;
    const header = section.createDiv({ cls: 'section-header' });
    header.createEl('h3', { text: `🃏 ${t('confirm.flashcards', lang)} (${items.length})` });

    const list = section.createDiv({ cls: 'deleted-list' });

    items.forEach((item) => {
      const itemEl = list.createDiv({ cls: 'deleted-item' });

      // 左侧信息
      const info = itemEl.createDiv({ cls: 'deleted-item-info' });

      const content = info.createDiv({ cls: 'deleted-item-content' });
      const front = content.createDiv({ cls: 'card-front' });
      front.createEl('strong', { text: 'Q:' });
      front.appendText(` ${item.content.front.substring(0, 100)}`);
      const back = content.createDiv({ cls: 'card-back' });
      back.createEl('strong', { text: 'A:' });
      const backText = typeof item.content.back === 'string'
        ? item.content.back.substring(0, 100)
        : String(item.content.back);
      back.appendText(` ${backText}`);

      const meta = info.createDiv({ cls: 'deleted-item-meta' });
      meta.createSpan({ cls: 'deleted-time', text: this.formatTime(item.deletedAt) });
      meta.createSpan({ cls: 'deleted-source', text: `📄 ${item.content.sourceFile}` });
      meta.createSpan({
        cls: 'deleted-type',
        text: item.content.cardType === 'qa' ? 'Q&A' : t('stats.type.cloze', lang),
      });
      meta.createSpan({ cls: 'deleted-reason', text: this.getDeleteReason(item.deletedBy) });

      // 右侧操作
      const actions = itemEl.createDiv({ cls: 'deleted-item-actions' });
      
      // 恢复按钮
      new ButtonComponent(actions)
        .setButtonText(t('recentDelete.restore', this.plugin.settings.language))
        .setIcon('rotate-ccw')
        .onClick(async () => {
          await this.restoreCard(item);
        });
      
      // 更多操作按钮
      new ButtonComponent(actions)
        .setIcon('more-vertical')
        .onClick((e) => {
          this.showCardMenu(e, item);
        });
    });
  }

  private showNoteMenu(event: MouseEvent, item: DeletedContentUnit) {
    const menu = new Menu();

    menu.addItem((menuItem) =>
      menuItem
        .setTitle(t('recentDelete.restore', this.plugin.settings.language))
        .setIcon('rotate-ccw')
        .onClick(async () => {
          await this.restoreNote(item);
        })
    );

    menu.addItem((menuItem) =>
      menuItem
        .setTitle(t('recentDelete.deletePermanently', this.plugin.settings.language))
        .setIcon('trash')
        .setWarning(true)
        .onClick(async () => {
          await this.permanentlyDeleteNote(item);
        })
    );

    menu.showAtMouseEvent(event);
  }

  private showCardMenu(event: MouseEvent, item: DeletedItem) {
    const menu = new Menu();

    menu.addItem((menuItem) =>
      menuItem
        .setTitle(t('recentDelete.restore', this.plugin.settings.language))
        .setIcon('rotate-ccw')
        .onClick(async () => {
          await this.restoreCard(item);
        })
    );

    menu.addItem((menuItem) =>
      menuItem
        .setTitle(t('recentDelete.deletePermanently', this.plugin.settings.language))
        .setIcon('trash')
        .setWarning(true)
        .onClick(async () => {
          await this.permanentlyDeleteCard(item);
        })
    );

    menu.showAtMouseEvent(event);
  }

  private async restoreNote(item: DeletedContentUnit) {
    
    const success = await this.plugin.dataManager.restoreContentUnit(item);
    if (success) {
      // ✅ 自动恢复关联的闪卡
      if (item.associatedCardIds && item.associatedCardIds.length > 0) {
        const restored = await this.restoreAssociatedCards(item.associatedCardIds);
        if (restored > 0) {
          new Notice(t('notice.noteRestored', this.plugin.settings.language) + 
            ` (${restored} ${t('confirm.flashcards', this.plugin.settings.language)} ${t('notice.cardRestored', this.plugin.settings.language)})`);
        } else {
          new Notice(t('notice.noteRestored', this.plugin.settings.language));
        }
      } else {
        new Notice(t('notice.noteRestored', this.plugin.settings.language));
      }
      
      this.render();
      this.plugin.refreshOverview();
    } else {
      new Notice(t('notice.restoreFailed', this.plugin.settings.language));
    }
  }

  private async restoreCard(item: DeletedItem) {
    const success = await this.plugin.flashcardManager.restoreFlashcard(item);
    
    if (success) {
      new Notice(t('notice.cardRestored', this.plugin.settings.language));
      this.render();
      this.plugin.refreshOverview();
    } else {
      new Notice(t('notice.restoreFailed', this.plugin.settings.language));
    }
  }

  private async permanentlyDeleteNote(item: DeletedContentUnit) {
    const success = await this.plugin.dataManager.permanentlyDeleteContentUnit(item.id);
    
    if (success) {
      new Notice(t('notice.permanentlyDeleted', this.plugin.settings.language));
      this.render();
    } else {
      new Notice(t('notice.deleteFailed', this.plugin.settings.language));
    }
  }

  private async permanentlyDeleteCard(item: DeletedItem) {
    const success = await this.plugin.flashcardManager.permanentlyDeleteFlashcard(item.id);
    
    if (success) {
      new Notice(t('notice.permanentlyDeleted', this.plugin.settings.language));
      this.render();
    } else {
      new Notice(t('notice.deleteFailed', this.plugin.settings.language));
    }
  }

  private async restoreAssociatedCards(cardIds: string[]): Promise<number> {
    
    const deletedCards = this.plugin.flashcardManager.getRecentlyDeleted();
    
    let restored = 0;
    
    for (const cardId of cardIds) {
      const deletedCard = deletedCards.find(item => item.id === cardId);
      
      if (deletedCard) {
        const success = await this.plugin.flashcardManager.restoreFlashcard(deletedCard);
        if (success) restored++;
      } else {
      }
    }
    
    return restored;
  }

  private async clearAll() {
    const notesCount = await this.plugin.dataManager.clearDeleteHistory();
    const cardsCount = await this.plugin.flashcardManager.clearDeleteHistory();
    
    new Notice(t('notice.allDeleted', this.plugin.settings.language, {
      notes: notesCount,
      cards: cardsCount
    }));
    
    this.render();
  }

  private getStats() {
    const deletedNotes = this.plugin.dataManager.getRecentlyDeletedUnits();
    const deletedCards = this.plugin.flashcardManager.getRecentlyDeleted();
    
    return {
      notes: deletedNotes.length,
      cards: deletedCards.length
    };
  }

  private formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return t('time.justNow', this.plugin.settings.language);
    if (minutes < 60) return t('time.minutesAgo', this.plugin.settings.language, { minutes });
    if (hours < 24) return t('time.hoursAgo', this.plugin.settings.language, { hours });
    return t('time.daysAgo', this.plugin.settings.language, { days });
  }

  private getDeleteReason(reason: string): string {
    const reasons: Record<string, string> = {
      'user-deleted': t('deleteReason.user', this.plugin.settings.language),
      'note-deleted': t('deleteReason.note', this.plugin.settings.language),
      'file-deleted': t('deleteReason.file', this.plugin.settings.language)
    };
    return reasons[reason] || reason;
  }
}