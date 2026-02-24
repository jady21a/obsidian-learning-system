// src/ui/components/ContextMenuBuilder.ts

import { Menu, Notice } from 'obsidian';
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';
import { t, Language } from '../../i18n/translations';

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
    language: Language = 'en'
  ): Menu {
    const menu = new Menu();
    
    // 跳转到原文
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.jumpToSource' ))
        .setIcon('arrow-up-right')
        .onClick(() => callbacks.onJumpToSource(unit))
    );
    
    // 编辑批注
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.editAnnotation' ))
        .setIcon('message-square')
        .onClick(() => callbacks.onToggleAnnotation(unit))
    );
    
    menu.addSeparator();
    
    // 编辑闪卡 (如果已有闪卡)
    if (unit.flashcardIds.length > 0) {
      menu.addItem((item) =>
        item
          .setTitle(t('contextMenu.editFlashcard' ))
          .setIcon('pencil')
          .onClick(() => callbacks.onEditFlashcard(unit))
      );
    }
    
    // 生成闪卡 (AI智能生成)
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.generateFlashcard' ))
        .setIcon('zap')
        .onClick(() => callbacks.onQuickGenerate(unit))
    );
    
    // 创建 QA 闪卡
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.createQA' ))
        .setIcon('plus')
        .onClick(() => callbacks.onCreateQA(unit))
    );
    
    // 创建填空闪卡
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.createCloze' ))
        .setIcon('plus')
        .onClick(() => callbacks.onCreateCloze(unit))
    );
    
    menu.addSeparator();
    
    // 查看统计
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.viewStats' ))
        .setIcon('bar-chart')
        .onClick(() => callbacks.onViewStats())
    );
    
    menu.addSeparator();
    
    // 删除笔记
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.deleteNote' ))
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
    language: Language = 'en'
  ): Menu {
    const menu = new Menu();
    
    // 跳转到原文
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.jumpToSource' ))
        .setIcon('arrow-up-right')
        .onClick(() => callbacks.onJumpToSource(card))
    );
    
    // 编辑卡片
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.editCard' ))
        .setIcon('pencil')
        .onClick(() => callbacks.onEdit(card))
    );
    
    menu.addSeparator();
    
    // 查看统计
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.viewStats' ))
        .setIcon('bar-chart')
        .onClick(() => callbacks.onViewStats(card))
    );
    
    menu.addSeparator();
    
    // 删除卡片
    menu.addItem((item) =>
      item
        .setTitle(t('contextMenu.deleteCard' ))
        .setIcon('trash')
        .onClick(() => callbacks.onDelete(card))
    );
    
    return menu;
  }

  /**
   * 格式化闪卡统计信息
   */
  static formatFlashcardStats(card: Flashcard, language: Language = 'en'): string {
    const locale = language === 'zh-CN' ? 'zh-CN' : 'en-US';
    const createdDate = new Date(card.metadata.createdAt).toLocaleString(locale);
    const lastReview = card.stats.lastReview 
      ? new Date(card.stats.lastReview).toLocaleString(locale)
      : t('stats.lastReview.never' );
    const nextReview = new Date(card.scheduling.due).toLocaleString(locale);
    const accuracy = card.stats.totalReviews > 0 
      ? ((card.stats.correctCount / card.stats.totalReviews) * 100).toFixed(1)
      : '0';
    
    const separator = t('stats.separator' );
    
    return (
      `${t('stats.title' )}\n` +
      `${separator}\n` +
      `${t('stats.file' )}: ${card.sourceFile.split('/').pop()}\n` +
      `${t('stats.type' )}: ${t(card.type === 'qa' ? 'stats.type.qa' : 'stats.type.cloze' )}\n` +
      `${t('stats.deck' )}: ${card.deck}\n` +
      `${t('stats.tags' )}: ${card.tags?.length > 0 ? card.tags.join(', ') : t('stats.tags.none' )}\n` +
      `${separator}\n` +
      `${t('stats.reviewCount' )}: ${card.stats.totalReviews} ${t('stats.times' )}\n` +
      `${t('stats.correctCount' )}: ${card.stats.correctCount} ${t('stats.times' )}\n` +
      `${t('stats.accuracy' )}: ${accuracy}%\n` +
      `${t('stats.averageTime' )}: ${card.stats.averageTime.toFixed(1)}${t('stats.seconds' )}\n` +
      `${t('stats.difficulty' )}: ${(card.stats.difficulty * 100).toFixed(0)}%\n` +
      `${separator}\n` +
      `${t('stats.createdAt' )}: ${createdDate}\n` +
      `${t('stats.lastReview' )}: ${lastReview}\n` +
      `${t('stats.nextReview' )}: ${nextReview}\n` +
      `${t('stats.interval' )}: ${card.scheduling.interval}${t('stats.days' )}\n` +
      `${t('stats.ease' )}: ${card.scheduling.ease.toFixed(2)}`
    );
  }
}