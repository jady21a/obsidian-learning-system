import type LearningSystemPlugin from '../main';
import { Flashcard, ReviewLog } from './FlashcardManager';

export interface DailyStats {
  date: string;
  reviewed: number;
  correctCount: number;
  correctRate: number;
  timeSpent: number;
  newCards: number;
}

export interface WeeklyStats {
  startDate: string;
  endDate: string;
  totalReviews: number;
  averageCorrectRate: number;
  totalTimeSpent: number;
  streak: number;
}

export interface DeckStats {
  deckName: string;
  totalCards: number;
  dueCards: number;
  newCards: number;
  correctRate: number;
  averageInterval: number;
}

export interface DifficultCard {
  card: Flashcard;
  errorCount: number;
  lastError: number;
  averageTime: number;
  pattern: 'concept' | 'memory' | 'calculation' | 'unknown';
}

export class AnalyticsEngine {
  constructor(private plugin: LearningSystemPlugin) {}

  /**
   * 获取每日统计
   */
  getDailyStats(days: number = 30): DailyStats[] {
    const logs = this.plugin.flashcardManager['reviewLogs'] || [];
    const stats: Map<string, DailyStats> = new Map();

    // 初始化最近N天的数据
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      
      stats.set(dateKey, {
        date: dateKey,
        reviewed: 0,
        correctCount: 0,
        correctRate: 0,
        timeSpent: 0,
        newCards: 0
      });
    }

    // 统计复习记录
    logs.forEach(log => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      const stat = stats.get(date);
      if (!stat) return;

      stat.reviewed++;
      stat.timeSpent += log.response.timeSpent;

      // 判断是否正确
      if (log.response.ease === 'good' || log.response.ease === 'easy') {
        stat.correctCount++;
      } else if (log.response.ease === 'hard') {
        stat.correctCount += 0.5;
      }

      // 检查是否是新卡片（第一次复习）
      const card = this.plugin.flashcardManager.getFlashcard(log.flashcardId);
      if (card && card.stats.totalReviews === 1) {
        stat.newCards++;
      }
    });

    // 计算正确率
    stats.forEach(stat => {
      if (stat.reviewed > 0) {
        stat.correctRate = stat.correctCount / stat.reviewed;
      }
    });

    return Array.from(stats.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    );
  }

  /**
   * 获取周统计
   */
  getWeeklyStats(): { thisWeek: WeeklyStats; lastWeek: WeeklyStats } {
    const now = new Date();
    
    // 本周
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    // 上周
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeek = this.calculateWeekStats(thisWeekStart);
    const lastWeek = this.calculateWeekStats(lastWeekStart);

    return { thisWeek, lastWeek };
  }

  private calculateWeekStats(startDate: Date): WeeklyStats {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const logs = (this.plugin.flashcardManager['reviewLogs'] || []).filter(
      log => log.timestamp >= startDate.getTime() && log.timestamp < endDate.getTime()
    );

    let totalCorrect = 0;
    let totalTimeSpent = 0;

    logs.forEach(log => {
      totalTimeSpent += log.response.timeSpent;
      if (log.response.ease === 'good' || log.response.ease === 'easy') {
        totalCorrect++;
      } else if (log.response.ease === 'hard') {
        totalCorrect += 0.5;
      }
    });

    const averageCorrectRate = logs.length > 0 ? totalCorrect / logs.length : 0;
    const streak = this.calculateStreak();

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalReviews: logs.length,
      averageCorrectRate,
      totalTimeSpent,
      streak
    };
  }

  /**
   * 计算连续学习天数
   */
  calculateStreak(): number {
    const logs = this.plugin.flashcardManager['reviewLogs'] || [];
    if (logs.length === 0) return 0;

    const dates = new Set<string>();
    logs.forEach(log => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      dates.add(date);
    });

    const sortedDates = Array.from(dates).sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < sortedDates.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      const expected = expectedDate.toISOString().split('T')[0];

      if (sortedDates[i] === expected) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * 获取卡组统计
   */
  getDeckStats(): DeckStats[] {
    const cards = this.plugin.flashcardManager.getAllFlashcards();
    const deckMap = new Map<string, Flashcard[]>();

    // 按卡组分组
    cards.forEach(card => {
      if (!deckMap.has(card.deck)) {
        deckMap.set(card.deck, []);
      }
      deckMap.get(card.deck)!.push(card);
    });

    // 计算每个卡组的统计
    const stats: DeckStats[] = [];
    const now = Date.now();

    deckMap.forEach((deckCards, deckName) => {
      const dueCards = deckCards.filter(c => c.scheduling.due <= now).length;
      const newCards = deckCards.filter(c => c.scheduling.state === 'new').length;
      
      const totalCorrect = deckCards.reduce(
        (sum, c) => sum + c.stats.correctCount, 0
      );
      const totalReviews = deckCards.reduce(
        (sum, c) => sum + c.stats.totalReviews, 0
      );
      const correctRate = totalReviews > 0 ? totalCorrect / totalReviews : 0;

      const totalInterval = deckCards.reduce(
        (sum, c) => sum + c.scheduling.interval, 0
      );
      const averageInterval = deckCards.length > 0 
        ? totalInterval / deckCards.length 
        : 0;

      stats.push({
        deckName,
        totalCards: deckCards.length,
        dueCards,
        newCards,
        correctRate,
        averageInterval
      });
    });

    return stats.sort((a, b) => b.totalCards - a.totalCards);
  }

  /**
   * 获取难点卡片
   */
  getDifficultCards(limit: number = 10): DifficultCard[] {
    const cards = this.plugin.flashcardManager.getAllFlashcards();
    const logs = this.plugin.flashcardManager['reviewLogs'] || [];

    const difficultCards: DifficultCard[] = [];

    cards.forEach(card => {
      const cardLogs = logs.filter(log => log.flashcardId === card.id);
      
      // 计算错误次数
      const errorCount = cardLogs.filter(
        log => log.response.ease === 'again'
      ).length;

      if (errorCount === 0 && card.stats.difficulty < 0.7) return;

      // 最后一次错误
      const errorLogs = cardLogs.filter(log => log.response.ease === 'again');
      const lastError = errorLogs.length > 0 
        ? errorLogs[errorLogs.length - 1].timestamp 
        : 0;

      // 判断错误模式
      const pattern = this.detectErrorPattern(card, cardLogs);

      difficultCards.push({
        card,
        errorCount,
        lastError,
        averageTime: card.stats.averageTime,
        pattern
      });
    });

    // 排序：错误次数 > 难度 > 最近错误
    return difficultCards
      .sort((a, b) => {
        if (a.errorCount !== b.errorCount) {
          return b.errorCount - a.errorCount;
        }
        if (a.card.stats.difficulty !== b.card.stats.difficulty) {
          return b.card.stats.difficulty - a.card.stats.difficulty;
        }
        return b.lastError - a.lastError;
      })
      .slice(0, limit);
  }

  private detectErrorPattern(
    card: Flashcard,
    logs: ReviewLog[]
  ): DifficultCard['pattern'] {
    if (logs.length < 3) return 'unknown';

    // 时间过长 -> 计算问题
    if (card.stats.averageTime > 60) {
      return 'calculation';
    }

    // 间隔很短仍然错误 -> 记忆问题
    if (card.scheduling.interval < 3 && card.scheduling.lapses > 2) {
      return 'memory';
    }

    // 持续失败 -> 概念理解问题
    const recentLogs = logs.slice(-5);
    const recentFailures = recentLogs.filter(
      log => log.response.ease === 'again'
    ).length;
    
    if (recentFailures >= 3) {
      return 'concept';
    }

    return 'unknown';
  }

  /**
   * 获取标签统计
   */
  getTagStats(): { tag: string; count: number; correctRate: number }[] {
    const cards = this.plugin.flashcardManager.getAllFlashcards();
    const tagMap = new Map<string, { total: number; correct: number; reviews: number }>();

    cards.forEach(card => {
      card.tags.forEach(tag => {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, { total: 0, correct: 0, reviews: 0 });
        }
        const stat = tagMap.get(tag)!;
        stat.total++;
        stat.correct += card.stats.correctCount;
        stat.reviews += card.stats.totalReviews;
      });
    });

    const stats = Array.from(tagMap.entries()).map(([tag, data]) => ({
      tag,
      count: data.total,
      correctRate: data.reviews > 0 ? data.correct / data.reviews : 0
    }));

    return stats.sort((a, b) => b.count - a.count);
  }

  /**
   * 生成学习报告
   */
  generateReport(days: number = 7): string {
    const dailyStats = this.getDailyStats(days);
    const { thisWeek, lastWeek } = this.getWeeklyStats();
    const difficultCards = this.getDifficultCards(5);
    const deckStats = this.getDeckStats();

    // 计算总览数据
    const totalReviewed = dailyStats.reduce((sum, s) => sum + s.reviewed, 0);
    const totalCorrect = dailyStats.reduce((sum, s) => sum + s.correctCount, 0);
    const averageCorrectRate = totalReviewed > 0 ? totalCorrect / totalReviewed : 0;
    const totalTime = dailyStats.reduce((sum, s) => sum + s.timeSpent, 0);

    // 趋势分析
    const recentDays = dailyStats.slice(-7);
    const olderDays = dailyStats.slice(-14, -7);
    const recentRate = this.calculateAverageRate(recentDays);
    const olderRate = this.calculateAverageRate(olderDays);
    const trend = recentRate > olderRate ? '📈 improving' : 
                  recentRate < olderRate ? '📉 declining' : '➡️ stable';

    let report = `# 📊 Learning Report\n\n`;
    report += `**Period:** Last ${days} days\n`;
    report += `**Generated:** ${new Date().toLocaleString()}\n\n`;

    report += `## 🎯 Overall Performance\n\n`;
    report += `- **Cards Reviewed:** ${totalReviewed}\n`;
    report += `- **Correct Rate:** ${(averageCorrectRate * 100).toFixed(1)}%\n`;
    report += `- **Study Time:** ${this.formatTime(totalTime)}\n`;
    report += `- **Current Streak:** ${thisWeek.streak} days 🔥\n`;
    report += `- **Trend:** ${trend}\n\n`;

    report += `## 📈 Week Comparison\n\n`;
    report += `### This Week\n`;
    report += `- Reviews: ${thisWeek.totalReviews}\n`;
    report += `- Correct Rate: ${(thisWeek.averageCorrectRate * 100).toFixed(1)}%\n`;
    report += `- Time: ${this.formatTime(thisWeek.totalTimeSpent)}\n\n`;

    report += `### Last Week\n`;
    report += `- Reviews: ${lastWeek.totalReviews}\n`;
    report += `- Correct Rate: ${(lastWeek.averageCorrectRate * 100).toFixed(1)}%\n`;
    report += `- Time: ${this.formatTime(lastWeek.totalTimeSpent)}\n\n`;

    const reviewChange = thisWeek.totalReviews - lastWeek.totalReviews;
    const rateChange = (thisWeek.averageCorrectRate - lastWeek.averageCorrectRate) * 100;
    
    if (reviewChange > 0) {
      report += `💪 You reviewed **${reviewChange} more cards** this week!\n`;
    }
    if (rateChange > 5) {
      report += `🎉 Your accuracy improved by **${rateChange.toFixed(1)}%**!\n`;
    }
    report += `\n`;

    if (difficultCards.length > 0) {
      report += `## ⚠️ Cards Needing Attention\n\n`;
      difficultCards.forEach((dc, i) => {
        const patternEmoji = {
          'concept': '🧠',
          'memory': '💭',
          'calculation': '🔢',
          'unknown': '❓'
        };
        report += `${i + 1}. **${dc.card.front.substring(0, 50)}${dc.card.front.length > 50 ? '...' : ''}**\n`;
        report += `   - Errors: ${dc.errorCount} | Pattern: ${patternEmoji[dc.pattern]} ${dc.pattern}\n`;
        report += `   - Avg Time: ${dc.averageTime.toFixed(1)}s | Difficulty: ${(dc.card.stats.difficulty * 100).toFixed(0)}%\n\n`;
      });
    }

    report += `## 📚 Deck Overview\n\n`;
    deckStats.forEach(deck => {
      report += `### ${deck.deckName}\n`;
      report += `- Total: ${deck.totalCards} | Due: ${deck.dueCards} | New: ${deck.newCards}\n`;
      report += `- Correct Rate: ${(deck.correctRate * 100).toFixed(1)}%\n`;
      report += `- Avg Interval: ${deck.averageInterval.toFixed(1)} days\n\n`;
    });

    report += `## 💡 Recommendations\n\n`;

    // 生成建议
    if (averageCorrectRate < 0.7) {
      report += `- ⚡ Your correct rate is below 70%. Consider reviewing difficult cards more frequently.\n`;
    }
    if (difficultCards.length > 5) {
      report += `- 📖 You have many difficult cards. Try breaking complex concepts into smaller flashcards.\n`;
    }
    if (thisWeek.streak > 7) {
      report += `- 🎉 Amazing streak! Keep up the consistency!\n`;
    }
    if (totalTime / totalReviewed > 30) {
      report += `- ⏱️ Average review time is high. Consider simplifying card content.\n`;
    }
    if (deckStats.some(d => d.dueCards > d.totalCards * 0.5)) {
      report += `- 📅 Some decks have many overdue cards. Focus on catching up with these.\n`;
    }

    return report;
  }

  private calculateAverageRate(stats: DailyStats[]): number {
    const total = stats.reduce((sum, s) => sum + s.reviewed, 0);
    const correct = stats.reduce((sum, s) => sum + s.correctCount, 0);
    return total > 0 ? correct / total : 0;
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * 获取热力图数据（用于日历视图）
   */
  getHeatmapData(days: number = 90): { date: string; count: number; intensity: number }[] {
    const dailyStats = this.getDailyStats(days);
    const maxReviews = Math.max(...dailyStats.map(s => s.reviewed));

    return dailyStats.map(stat => ({
      date: stat.date,
      count: stat.reviewed,
      intensity: maxReviews > 0 ? stat.reviewed / maxReviews : 0
    }));
  }
  /**
 * 清除所有统计数据
 */
async clearAllStats(): Promise<void> {
  // 清除所有复习日志
  this.plugin.flashcardManager['reviewLogs'] = [];
  
  // 重置所有卡片的统计信息
  const cards = this.plugin.flashcardManager.getAllFlashcards();
  for (const card of cards) {
    card.stats = {
      totalReviews: 0,
      correctCount: 0,
      averageTime: 0,
      lastReview: 0,
      difficulty: 0.3
    };
    card.scheduling = {
      interval: 0,
      ease: 2.5,  // 使用 ease 而不是 easeFactor
      due: Date.now(),
      lapses: 0,
      reps: 0,
      state: 'new'
    };
    await this.plugin.flashcardManager.updateCard(card);
  }
  
  // 使用 dataManager 保存
  await this.plugin.dataManager.save();
}

/**
 * 清除指定天数之前的统计数据
 */
async clearStatsBeforeDate(daysAgo: number): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
  const cutoffTimestamp = cutoffDate.getTime();
  
  // 只保留指定日期之后的复习日志
  const logs = this.plugin.flashcardManager['reviewLogs'] || [];
  this.plugin.flashcardManager['reviewLogs'] = logs.filter(
    log => log.timestamp >= cutoffTimestamp
  );
  
  await this.plugin.dataManager.save();
}

/**
 * 清除特定卡组的统计数据
 */
async clearDeckStats(deckName: string): Promise<void> {
  const cards = this.plugin.flashcardManager.getAllFlashcards()
    .filter(card => card.deck === deckName);
  
  for (const card of cards) {
    card.stats = {
      totalReviews: 0,
      correctCount: 0,
      averageTime: 0,
      lastReview: 0,
      difficulty: 0.3
    };
    card.scheduling = {
      interval: 0,
      ease: 2.5,  // 使用 ease
      due: Date.now(),
      lapses: 0,
      reps: 0,
      state: 'new'
    };
    await this.plugin.flashcardManager.updateCard(card);
  }
  
  // 清除该卡组的复习日志
  const cardIds = new Set(cards.map(c => c.id));
  const logs = this.plugin.flashcardManager['reviewLogs'] || [];
  this.plugin.flashcardManager['reviewLogs'] = logs.filter(
    log => !cardIds.has(log.flashcardId)
  );
  
  await this.plugin.dataManager.save();
}
}


