import { App } from 'obsidian';
import { DataManager, ContentUnit } from './DataManager'; 
import type LearningSystemPlugin from '../main';

export interface Flashcard {
  id: string;
  type: 'qa' | 'cloze';
  sourceContentId: string;
  sourceFile: string;
  anchorLink: string;
  
  // 卡片内容
  front: string;
  back: string | string[];
  
  // 完形填空专用
  cloze?: {
    original: string;
    deletions: {
      index: number;
      answer: string;
      alternatives?: string[];
    }[];
  };
  
  // 分组
  deck: string;
  tags: string[];
  
  // 复习数据
  scheduling: {
    interval: number;
    ease: number;
    due: number;
    lapses: number;
    reps: number;
    state: 'new' | 'learning' | 'review' | 'relearning';
  };
  
  // 统计
  stats: {
    totalReviews: number;
    correctCount: number;
    averageTime: number;
    lastReview?: number;
    difficulty: number;
  };
  
  metadata: {
    createdAt: number;
    updatedAt: number;
  };
}

export interface ReviewLog {
  id: string;
  flashcardId: string;
  timestamp: number;
  response: {
    userAnswer?: string | string[];
    timeSpent: number;
    ease: 'again' | 'hard' | 'good' | 'easy';
  };
  grading?: {
    correctness: 'correct' | 'partial' | 'wrong';
    similarity?: number;
  };
  schedulingChange: {
    oldInterval: number;
    newInterval: number;
    oldEase: number;
    newEase: number;
  };
}

export class FlashcardManager {
  private flashcards: Map<string, Flashcard> = new Map();
  private reviewLogs: ReviewLog[] = [];
  private dataFolder: string;

  constructor(
    private app: App,
    private dataManager: DataManager,
    private plugin: LearningSystemPlugin
  ) {
    this.dataFolder = `${this.app.vault.configDir}/plugins/learning-system/data`;
  }

  async initialize() {
    await this.loadFlashcards();
    await this.loadReviewLogs();
  }

  // ==================== 统一创建入口 ====================
  
  /**
   * 🆕 统一入口: 从 ContentUnit 创建闪卡
   * 适配所有场景: 右键提取、Scan、批量创建、快速生成
   */
  async createFlashcardFromUnit(
    unit: ContentUnit,
    options?: {
      customQuestion?: string;
      customAnswer?: string;
      cardType?: 'qa' | 'cloze';
    }
  ): Promise<Flashcard> {
    
    const cardType = options?.cardType || (unit.type === 'QA' ? 'qa' : 'cloze');
  
    let flashcard: Flashcard;
  
    if (cardType === 'qa' || unit.type === 'QA') {
      const question = options?.customQuestion || unit.content;
      const answer = options?.customAnswer || unit.answer || unit.content;
      
      flashcard = await this.createQACard(unit.id, question, answer);
      
    } else {
      const text = unit.fullContext || unit.content;
      const answer = options?.customAnswer || unit.content;
      
      const deletions = [{
        index: text.indexOf(answer),
        answer: answer
      }];
      

      flashcard = await this.createClozeCard(unit.id, text, deletions);
    }
  
    
  
    return flashcard;
  }

  // ==================== 核心创建方法 ====================

  /**
   * 创建问答卡（唯一版本，合并了所有功能）
   */
  async createQACard(
    contentUnitId: string,
    question: string,
    answer: string,
    deck?: string
  ): Promise<Flashcard> {
    const contentUnit = this.dataManager.getContentUnit(contentUnitId);
    if (!contentUnit) throw new Error('Content unit not found');

    const card: Flashcard = {
      id: this.generateId(),
      type: 'qa',
      sourceContentId: contentUnitId,
      sourceFile: contentUnit.source.file,
      anchorLink: contentUnit.source.anchorLink,
      front: question,
      back: answer,
      deck: deck || this.inferDeck(contentUnit.source.file),
      tags: contentUnit.metadata.tags,
      scheduling: this.initializeScheduling(),
      stats: {
        totalReviews: 0,
        correctCount: 0,
        averageTime: 0,
        difficulty: 0.5
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };

    this.flashcards.set(card.id, card);
    
    // 更新 ContentUnit 关联
    contentUnit.flashcardIds.push(card.id);
    await this.dataManager.saveContentUnits([contentUnit]);
    
    await this.persistFlashcards();
    return card;
  }

  /**
   * 创建完形填空卡（唯一版本，合并了所有功能）
   */
  async createClozeCard(
    contentUnitId: string,
    original: string,
    deletions: { index: number; answer: string; alternatives?: string[] }[]
  ): Promise<Flashcard> {
    const contentUnit = this.dataManager.getContentUnit(contentUnitId);
    if (!contentUnit) throw new Error('Content unit not found');

    const front = this.generateClozeText(original, deletions);
    const back = deletions.map(d => d.answer);

    const card: Flashcard = {
      id: this.generateId(),
      type: 'cloze',
      sourceContentId: contentUnitId,
      sourceFile: contentUnit.source.file,
      anchorLink: contentUnit.source.anchorLink,
      front,
      back,
      cloze: {
        original,
        deletions
      },
      deck: this.inferDeck(contentUnit.source.file),
      tags: contentUnit.metadata.tags,
      scheduling: this.initializeScheduling(),
      stats: {
        totalReviews: 0,
        correctCount: 0,
        averageTime: 0,
        difficulty: 0.5
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };

    this.flashcards.set(card.id, card);
    
    contentUnit.flashcardIds.push(card.id);
    await this.dataManager.saveContentUnits([contentUnit]);
    
    await this.persistFlashcards();
    return card;
  }

  // ==================== 查询方法 ====================

  /**
   * 获取闪卡
   */
  getFlashcard(id: string): Flashcard | undefined {
    return this.flashcards.get(id);
  }

  /**
   * 获取所有闪卡
   */
  getAllFlashcards(): Flashcard[] {
    return Array.from(this.flashcards.values());
  }

  /**
   * 获取今日待复习的卡片
   */
  getDueCards(): Flashcard[] {
    const now = Date.now();
    return Array.from(this.flashcards.values())
      .filter(card => card.scheduling.due <= now)
      .sort((a, b) => {
        const aPriority = this.getCardPriority(a);
        const bPriority = this.getCardPriority(b);
        return bPriority - aPriority;
      });
  }

  /**
   * 获取新卡片
   */
  getNewCards(): Flashcard[] {
    return Array.from(this.flashcards.values())
      .filter(card => card.scheduling.state === 'new');
  }

  // ==================== 更新和删除 ====================

  /**
   * 更新卡片（复习后）
   */
  async updateCard(card: Flashcard) {
    this.flashcards.set(card.id, card);
    await this.persistFlashcards();
  }

/**
 * 删除卡片
 */
async deleteCard(id: string) {
  const card = this.flashcards.get(id);
  if (!card) return;

  // 🔧 解除 ContentUnit 关联
  const contentUnit = this.dataManager.getContentUnit(card.sourceContentId);
  if (contentUnit) {
    const index = contentUnit.flashcardIds.indexOf(id);
    if (index > -1) {
      contentUnit.flashcardIds.splice(index, 1);
      await this.dataManager.saveContentUnits([contentUnit]);
    }
  }

  // 删除闪卡
  this.flashcards.delete(id);
  await this.persistFlashcards();
}

  // ==================== 复习日志 ====================

  /**
   * 记录复习日志
   */
  async logReview(log: ReviewLog) {
    this.reviewLogs.push(log);
    
    if (this.reviewLogs.length > 1000) {
      this.reviewLogs = this.reviewLogs.slice(-1000);
    }
    
    await this.persistReviewLogs();
  }

  /**
   * 获取卡片的复习历史
   */
  getCardReviewHistory(cardId: string): ReviewLog[] {
    return this.reviewLogs.filter(log => log.flashcardId === cardId);
  }

  // ==================== 统计 ====================

  /**
   * 获取统计数据
   */
  getStats() {
    const all = this.getAllFlashcards();
    const due = this.getDueCards();
    const newCards = this.getNewCards();
    
    const today = new Date().setHours(0, 0, 0, 0);
    const reviewedToday = this.reviewLogs.filter(
      log => log.timestamp >= today
    ).length;

    return {
      total: all.length,
      new: newCards.length,
      due: due.length,
      reviewedToday,
      totalReviews: this.reviewLogs.length
    };
  }

  // ==================== 私有工具方法 ====================

  /**
   * 加载闪卡
   */
  private async loadFlashcards() {
    try {
      const path = `${this.dataFolder}/flashcards.json`;
      const adapter = this.app.vault.adapter;

      if (await adapter.exists(path)) {
        const data = await adapter.read(path);
        const flashcards: Flashcard[] = JSON.parse(data);
        
        for (const card of flashcards) {
          this.flashcards.set(card.id, card);
        }
      }
    } catch (error) {
      console.error('Error loading flashcards:', error);
    }
  }

  /**
   * 加载复习日志
   */
  private async loadReviewLogs() {
    try {
      const path = `${this.dataFolder}/review-logs.json`;
      const adapter = this.app.vault.adapter;

      if (await adapter.exists(path)) {
        const data = await adapter.read(path);
        this.reviewLogs = JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading review logs:', error);
    }
  }

  /**
   * 初始化调度参数
   */
  private initializeScheduling(): Flashcard['scheduling'] {
    return {
      interval: 0,
      ease: 2.5,
      due: Date.now(),
      lapses: 0,
      reps: 0,
      state: 'new'
    };
  }

  /**
   * 生成完形填空文本
   */
  private generateClozeText(
    original: string,
    deletions: { index: number; answer: string }[]
  ): string {
    let result = original;
    const sorted = [...deletions].sort((a, b) => b.index - a.index);
    
    for (const deletion of sorted) {
      const before = result.substring(0, deletion.index);
      const after = result.substring(deletion.index + deletion.answer.length);
      result = `${before}[...]${after}`;
    }
    
    return result;
  }

  /**
   * 推断卡组名称
   */
  private inferDeck(filePath: string): string {
    const parts = filePath.split('/');
    return parts.length > 1 ? parts[parts.length - 2] : 'Default';
  }

  /**
   * 获取卡片优先级
   */
  private getCardPriority(card: Flashcard): number {
    const now = Date.now();
    const overdue = Math.max(0, now - card.scheduling.due);
    const daysOverdue = overdue / (24 * 60 * 60 * 1000);
    
    if (card.scheduling.state === 'new') return 100 + daysOverdue;
    if (card.scheduling.state === 'relearning') return 200 + daysOverdue;
    return daysOverdue;
  }

  /**
   * 持久化闪卡
   */
  private async persistFlashcards() {
    try {
      const path = `${this.dataFolder}/flashcards.json`;
      const flashcards = Array.from(this.flashcards.values());
      const data = JSON.stringify(flashcards, null, 2);
      await this.app.vault.adapter.write(path, data);
    } catch (error) {
      console.error('Error persisting flashcards:', error);
    }
  }

  /**
   * 持久化复习日志
   */
  private async persistReviewLogs() {
    try {
      const path = `${this.dataFolder}/review-logs.json`;
      const data = JSON.stringify(this.reviewLogs, null, 2);
      await this.app.vault.adapter.write(path, data);
    } catch (error) {
      console.error('Error persisting review logs:', error);
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}