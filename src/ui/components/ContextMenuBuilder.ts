// src/ui/components/ContextMenuBuilder.ts

import { Menu, Notice } from 'obsidian';
import { ContentUnit } from '../../core/DataManager';
import { Flashcard } from '../../core/FlashcardManager';

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
    callbacks: ContentUnitMenuCallbacks
  ): Menu {
    const menu = new Menu();
    
    // 跳转到原文
    menu.addItem((item) =>
      item
        .setTitle('📖 跳转到原文')
        .setIcon('arrow-up-right')
        .onClick(() => callbacks.onJumpToSource(unit))
    );
    
    // 编辑批注
    menu.addItem((item) =>
      item
        .setTitle('💬 编辑批注')
        .setIcon('message-square')
        .onClick(() => callbacks.onToggleAnnotation(unit))
    );
    
    menu.addSeparator();
    
    // 编辑闪卡 (如果已有闪卡)
    if (unit.flashcardIds.length > 0) {
      menu.addItem((item) =>
        item
          .setTitle('✏️ 编辑闪卡')
          .setIcon('pencil')
          .onClick(() => callbacks.onEditFlashcard(unit))
      );
    }
    
    // 生成闪卡 (AI智能生成)
    menu.addItem((item) =>
      item
        .setTitle('⚡ 生成闪卡')
        .setIcon('zap')
        .onClick(() => callbacks.onQuickGenerate(unit))
    );
    
    // 创建 QA 闪卡
    menu.addItem((item) =>
      item
        .setTitle('➕ 创建 QA 闪卡')
        .setIcon('plus')
        .onClick(() => callbacks.onCreateQA(unit))
    );
    
    // 创建填空闪卡
    menu.addItem((item) =>
      item
        .setTitle('➕ 创建填空闪卡')
        .setIcon('plus')
        .onClick(() => callbacks.onCreateCloze(unit))
    );
    
    menu.addSeparator();
    
    // 查看统计
    menu.addItem((item) =>
      item
        .setTitle('📊 查看统计')
        .setIcon('bar-chart')
        .onClick(() => callbacks.onViewStats())
    );
    
    menu.addSeparator();
    
    // 删除笔记
    menu.addItem((item) =>
      item
        .setTitle('🗑️ 删除笔记')
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
    callbacks: FlashcardMenuCallbacks
  ): Menu {
    const menu = new Menu();
    
    // 跳转到原文
    menu.addItem((item) =>
      item
        .setTitle('📖 跳转到原文')
        .setIcon('arrow-up-right')
        .onClick(() => callbacks.onJumpToSource(card))
    );
    
    // 编辑卡片
    menu.addItem((item) =>
      item
        .setTitle('✏️ 编辑卡片')
        .setIcon('pencil')
        .onClick(() => callbacks.onEdit(card))
    );
    
    menu.addSeparator();
    
    // 查看统计
    menu.addItem((item) =>
      item
        .setTitle('📊 查看统计')
        .setIcon('bar-chart')
        .onClick(() => callbacks.onViewStats(card))
    );
    
    menu.addSeparator();
    
    // 删除卡片
    menu.addItem((item) =>
      item
        .setTitle('🗑️ 删除卡片')
        .setIcon('trash')
        .onClick(() => callbacks.onDelete(card))
    );
    
    return menu;
  }

  /**
   * 格式化闪卡统计信息
   */
  static formatFlashcardStats(card: Flashcard): string {
    const createdDate = new Date(card.metadata.createdAt).toLocaleString('zh-CN');
    const lastReview = card.stats.lastReview 
      ? new Date(card.stats.lastReview).toLocaleString('zh-CN')
      : '未复习';
    const nextReview = new Date(card.scheduling.due).toLocaleString('zh-CN');
    const accuracy = card.stats.totalReviews > 0 
      ? ((card.stats.correctCount / card.stats.totalReviews) * 100).toFixed(1)
      : '0';
    
    return (
      `📊 闪卡统计\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📁 文件: ${card.sourceFile.split('/').pop()}\n` +
      `🃏 类型: ${card.type === 'qa' ? 'Q&A' : '填空'}\n` +
      `📚 卡组: ${card.deck}\n` +
      `🏷️ 标签: ${card.tags?.length > 0 ? card.tags.join(', ') : '无'}\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📈 复习次数: ${card.stats.totalReviews}\n` +
      `✅ 正确次数: ${card.stats.correctCount}\n` +
      `📊 正确率: ${accuracy}%\n` +
      `⏱️ 平均用时: ${card.stats.averageTime.toFixed(1)}秒\n` +
      `🎯 难度: ${(card.stats.difficulty * 100).toFixed(0)}%\n` +
      `━━━━━━━━━━━━━━━\n` +
      `📅 创建时间: ${createdDate}\n` +
      `🔄 上次复习: ${lastReview}\n` +
      `⏰ 下次复习: ${nextReview}\n` +
      `📏 间隔: ${card.scheduling.interval}天\n` +
      `💪 熟练度: ${card.scheduling.ease.toFixed(2)}`
    );
  }
}