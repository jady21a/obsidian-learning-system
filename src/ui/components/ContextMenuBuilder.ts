// src/ui/components/ContextMenuBuilder.ts

import { Menu, Notice } from 'obsidian';
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';
import { t } from '../../i18n/translations';

/**
 * 内容单元右键菜单回调接口
 */
export interface ContentUnitMenuCallbacks {
  onJumpToSource: (unit: ContentUnit) => void;
  onToggleAnnotation: (unit: ContentUnit) => void;
  onEditFlashcard: (unit: ContentUnit) => void;
  onQuickGenerate: (unit: ContentUnit) => void;
  onCreateQA: (unit: ContentUnit) => void;
  onCreateCloze: (unit: ContentUnit) => void;
  onViewStats: () => void;
  onDelete: (unit: ContentUnit) => void;
}

/**
 * 闪卡右键菜单回调接口
 */
export interface FlashcardMenuCallbacks {
  onJumpToSource: (card: Flashcard) => void;
  onEdit: (card: Flashcard) => void;
  onViewStats: (card: Flashcard) => void;
  onDelete: (card: Flashcard) => void;
}

/**
 * 右键菜单构建器
 */
export class ContextMenuBuilder {
  /**
   * 构建内容单元的右键菜单
   */
  static buildContentUnitMenu(
    unit: ContentUnit,
    callbacks: ContentUnitMenuCallbacks,
    language: string = 'en'
  ): Menu {
    const menu = new Menu();
    
    // 跳转到原文
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.jumpToSource', language as any))
        .setIcon('arrow-up-right')
        .onClick(() => callbacks.onJumpToSource(unit))
    );
    
    // 编辑批注
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.editAnnotation', language as any))
        .setIcon('message-square')
        .onClick(() => callbacks.onToggleAnnotation(unit))
    );
    
    menu.addSeparator();
    
    // 编辑闪卡 (如果已有闪卡)
    if (unit.flashcardIds.length > 0) {
      menu.addItem((item) =>
        item
          .setTitle(t('contextMenu.editFlashcard', language as any))
          .setIcon('pencil')
          .onClick(() => callbacks.onEditFlashcard(unit))
      );
    }
    
    // 生成闪卡 (AI智能生成)
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.generateFlashcard', language as any))
        .setIcon('zap')
        .onClick(() => callbacks.onQuickGenerate(unit))
    );
    
    // 创建 QA 闪卡
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.createQA', language as any))
        .setIcon('plus')
        .onClick(() => callbacks.onCreateQA(unit))
    );
    
    // 创建填空闪卡
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.createCloze', language as any))
        .setIcon('plus')
        .onClick(() => callbacks.onCreateCloze(unit))
    );
    
    menu.addSeparator();
    
    // 查看统计
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.viewStats', language as any))
        .setIcon('bar-chart')
        .onClick(() => callbacks.onViewStats())
    );
    
    menu.addSeparator();
    
    // 删除笔记
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.deleteNote', language as any))
        .setIcon('trash')
        .onClick(() => callbacks.onDelete(unit))
    );
    
    return menu;
  }

  /**
   * 构建闪卡的右键菜单
   */
  static buildFlashcardMenu(
    card: Flashcard,
    callbacks: FlashcardMenuCallbacks,
    language: string = 'en'
  ): Menu {
    const menu = new Menu();
    
    // 跳转到原文
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.jumpToSource', language as any))
        .setIcon('arrow-up-right')
        .onClick(() => callbacks.onJumpToSource(card))
    );
    
    // 编辑卡片
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.editCard', language as any))
        .setIcon('pencil')
        .onClick(() => callbacks.onEdit(card))
    );
    
    menu.addSeparator();
    
    // 查看统计
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.viewStats', language as any))
        .setIcon('bar-chart')
        .onClick(() => callbacks.onViewStats(card))
    );
    
    menu.addSeparator();
    
    // 删除卡片
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.deleteCard', language as any))
        .setIcon('trash')
        .onClick(() => callbacks.onDelete(card))
    );
    
    return menu;
  }

  /**
   * 格式化闪卡统计信息
   */
  static formatFlashcardStats(card: Flashcard, language: string = 'en'): string {
    const locale = language === 'zh-CN' ? 'zh-CN' : 'en-US';
    const createdDate = new Date(card.metadata.createdAt).toLocaleString(locale);
    const lastReview = card.stats.lastReview 
      ? new Date(card.stats.lastReview).toLocaleString(locale)
      : t('stats.lastReview.never', language as any);
    const nextReview = new Date(card.scheduling.due).toLocaleString(locale);
    const accuracy = card.stats.totalReviews > 0 
      ? ((card.stats.correctCount / card.stats.totalReviews) * 100).toFixed(1)
      : '0';
    
    const separator = t('stats.separator', language as any);
    
    return (
      `${t('stats.title', language as any)}\n` +
      `${separator}\n` +
      `${t('stats.file', language as any)}: ${card.sourceFile.split('/').pop()}\n` +
      `${t('stats.type', language as any)}: ${t(card.type === 'qa' ? 'stats.type.qa' : 'stats.type.cloze', language as any)}\n` +
      `${t('stats.deck', language as any)}: ${card.deck}\n` +
      `${t('stats.tags', language as any)}: ${card.tags?.length > 0 ? card.tags.join(', ') : t('stats.tags.none', language as any)}\n` +
      `${separator}\n` +
      `${t('stats.reviewCount', language as any)}: ${card.stats.totalReviews} ${t('stats.times', language as any)}\n` +
      `${t('stats.correctCount', language as any)}: ${card.stats.correctCount} ${t('stats.times', language as any)}\n` +
      `${t('stats.accuracy', language as any)}: ${accuracy}%\n` +
      `${t('stats.averageTime', language as any)}: ${card.stats.averageTime.toFixed(1)}${t('stats.seconds', language as any)}\n` +
      `${t('stats.difficulty', language as any)}: ${(card.stats.difficulty * 100).toFixed(0)}%\n` +
      `${separator}\n` +
      `${t('stats.createdAt', language as any)}: ${createdDate}\n` +
      `${t('stats.lastReview', language as any)}: ${lastReview}\n` +
      `${t('stats.nextReview', language as any)}: ${nextReview}\n` +
      `${t('stats.interval', language as any)}: ${card.scheduling.interval}${t('stats.days', language as any)}\n` +
      `${t('stats.ease', language as any)}: ${card.scheduling.ease.toFixed(2)}`
    );
  }
}