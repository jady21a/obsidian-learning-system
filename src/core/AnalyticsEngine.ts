// analyticsEngine.ts
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
export interface CycleRecord {
  cycleNumber: number;
  startDate: string;
  endDate?: string;
  totalReviews: number;
  totalCards: number;
  correctRate: number;
  dailyStats?: DailyStats[];
  deckStats?: DeckStats[];
}
export interface CycleInfo {
  currentCycle: number;
  cycleStartDate: string; // ISO 格式
  cycles:  CycleRecord[];
}
export class AnalyticsEngine {
  constructor(private plugin: LearningSystemPlugin) {}
  /**
   * 获取或初始化周期信息
   */
  private getCycleData(): CycleInfo {
    const data = this.plugin.settings.cycleData;
    if (!data) {
      // 首次初始化
      const initData: CycleInfo = {
        currentCycle: 1,
        cycleStartDate: new Date().toISOString(),
        cycles: [{
          cycleNumber: 1,
          startDate: new Date().toISOString(),
          totalReviews: 0,
          totalCards: 0,
          correctRate: 0
        }]
      };
      this.plugin.settings.cycleData = initData;
      void this.plugin.saveSettings();
      return initData;
    }
    return data;
  }

  /**
   * 获取当前周期信息（供 UI 使用）
   */
  getCurrentCycleInfo(): {
    currentCycle: number;
    startDate: string;
    reviewsThisCycle: number;
  } {
    const data = this.getCycleData();
    const logs = this.plugin.flashcardManager['reviewLogs'] || [];
    
    // 统计当前周期的复习数
    const cycleReviews = logs.filter(
      log => (log.cycle || 1) === data.currentCycle
    ).length;

    return {
      currentCycle: data.currentCycle,
      startDate: data.cycleStartDate,
      reviewsThisCycle: cycleReviews
    };
  }

  /**
   * 获取当前周期号
   */
  getCurrentCycleNumber(): number {
    return this.getCycleData().currentCycle;
  }

  /**
   * 开启新周期
   */
  async startNewCycle(): Promise<void> {
    const data = this.getCycleData();
    const logs = this.plugin.flashcardManager['reviewLogs'] || [];
    const cards = this.plugin.flashcardManager.getAllFlashcards();

    // 1. 计算当前周期的最终统计
    const cycleReviews = logs.filter(
      log => (log.cycle || 1) === data.currentCycle
    );
    
    const totalCorrect = cycleReviews.filter(
      log => log.response.ease === 'good' || log.response.ease === 'easy'
    ).length;
    
    const correctRate = cycleReviews.length > 0 
      ? totalCorrect / cycleReviews.length 
      : 0;

    // 2. 结束当前周期（记录到历史）
    const currentCycleIndex = data.cycles.findIndex(
      c => c.cycleNumber === data.currentCycle
    );
    
    if (currentCycleIndex !== -1) {
      data.cycles[currentCycleIndex].endDate = new Date().toISOString();
      data.cycles[currentCycleIndex].totalReviews = cycleReviews.length;
      data.cycles[currentCycleIndex].totalCards = cards.length;
      data.cycles[currentCycleIndex].correctRate = correctRate;
    }

    // 3. 创建新周期
    const newCycleNumber = data.currentCycle + 1;
    const newStartDate = new Date().toISOString();

    data.cycles.push({
      cycleNumber: newCycleNumber,
      startDate: newStartDate,
      totalReviews: 0,
      totalCards: cards.length,
      correctRate: 0
    });

    data.currentCycle = newCycleNumber;
    data.cycleStartDate = newStartDate;

    // 4. 更新所有新日志的周期标记（通过拦截器实现）
    // 这里不需要修改旧日志，新日志会自动标记为新周期

    // 5. 保存设置
    await this.plugin.saveSettings();
  }


/**
 * 获取所有历史周期(用于UI显示)
 */
getArchivedCycles(): CycleRecord[] {
  const data = this.getCycleData();
  return data.cycles
    .filter((c): c is typeof c & { endDate: string } => !!c.endDate) 
    .sort((a, b) => b.cycleNumber - a.cycleNumber);
}

/**
 * 获取指定周期的详细统计
 */
getCycleDetails(cycleNumber: number): {
  cycle: CycleRecord;
  dailyStats: DailyStats[];
  deckStats: DeckStats[];
  weeklyStats: { thisWeek: WeeklyStats; lastWeek: WeeklyStats };
} | null {
  const data = this.getCycleData();
  const cycle = data.cycles.find(c => c.cycleNumber === cycleNumber);
  
  if (!cycle) return null;

  // 计算该周期的统计数据
  const logs = this.plugin.flashcardManager['reviewLogs'] || [];
  const cycleLogs = logs.filter(log => (log.cycle || 1) === cycleNumber);
  
  // 构建该周期的每日统计
  const dailyStats = this.buildCycleDailyStats(cycleNumber, cycle.startDate, cycle.endDate);
  const deckStats = this.buildCycleDeckStats(cycleNumber);
  
  return {
    cycle,
    dailyStats,
    deckStats,
    weeklyStats: this.getWeeklyStats(true) // 这里可以改进,获取指定周期的周统计
  };
}

/**
 * 构建指定周期的每日统计
 */
private buildCycleDailyStats(
  cycleNumber: number, 
  startDate: string, 
  endDate?: string
): DailyStats[] {
  const logs = (this.plugin.flashcardManager['reviewLogs'] || [])
    .filter(log => (log.cycle || 1) === cycleNumber);

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  const stats: Map<string, DailyStats> = new Map();

  // 初始化所有日期
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
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

  // 填充数据
  logs.forEach(log => {
    const date = new Date(log.timestamp).toISOString().split('T')[0];
    const stat = stats.get(date);
    if (!stat) return;

    stat.reviewed++;
    stat.timeSpent += log.response.timeSpent;

    if (log.response.ease === 'good' || log.response.ease === 'easy') {
      stat.correctCount++;
    } else if (log.response.ease === 'hard') {
      stat.correctCount += 0.5;
    }

    const card = this.plugin.flashcardManager.getFlashcard(log.flashcardId);
    if (card && card.stats.totalReviews === 1) {
      stat.newCards++;
    }
  });

  stats.forEach(stat => {
    if (stat.reviewed > 0) {
      stat.correctRate = stat.correctCount / stat.reviewed;
    }
  });

  return Array.from(stats.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 构建指定周期的卡组统计
 */
private buildCycleDeckStats(cycleNumber: number): DeckStats[] {
  const logs = (this.plugin.flashcardManager['reviewLogs'] || [])
    .filter(log => (log.cycle || 1) === cycleNumber);
  
  const cards = this.plugin.flashcardManager.getAllFlashcards();
  const deckMap = new Map<string, {
    cards: Flashcard[];
    logs: ReviewLog[];
  }>();

  // 按卡组分组
  cards.forEach(card => {
    if (!deckMap.has(card.deck)) {
      deckMap.set(card.deck, { cards: [], logs: [] });
    }
    deckMap.get(card.deck)!.cards.push(card);
  });

  logs.forEach(log => {
    const card = cards.find(c => c.id === log.flashcardId);
    if (card && deckMap.has(card.deck)) {
      deckMap.get(card.deck)!.logs.push(log);
    }
  });

  // 计算统计
  const stats: DeckStats[] = [];
  deckMap.forEach((data, deckName) => {
    const deckLogs = data.logs;
    const correctLogs = deckLogs.filter(
      log => log.response.ease === 'good' || log.response.ease === 'easy'
    );

    stats.push({
      deckName,
      totalCards: data.cards.length,
      dueCards: data.cards.filter(c => c.scheduling.due <= Date.now()).length,
      newCards: data.cards.filter(c => c.scheduling.state === 'new').length,
      correctRate: deckLogs.length > 0 ? correctLogs.length / deckLogs.length : 0,
      averageInterval: data.cards.reduce((sum, c) => sum + c.scheduling.interval, 0) / 
        (data.cards.length || 1)
    });
  });

  return stats.sort((a, b) => b.totalCards - a.totalCards);
}

/**
 * 清除统计但保留卡片进度
 */
private async clearStatsOnly(): Promise<void> {
  // 只清空 reviewLogs,不修改卡片的 FSRS 数据
  this.plugin.flashcardManager['reviewLogs'] = [];
  
  // 重置卡片的统计字段(但保留 scheduling 中的学习进度)
  const cards = this.plugin.flashcardManager.getAllFlashcards();
  for (const card of cards) {
    card.stats = {
      totalReviews: 0,
      correctCount: 0,
      averageTime: 0,
      lastReview: 0,
      difficulty: card.stats.difficulty // 保留难度
    };
    // 注意:不修改 card.scheduling
    await this.plugin.flashcardManager.updateCard(card);
  }
  
  await this.plugin.dataManager.save();
}
/**
 * 获取每日统计
 */
getDailyStats(days: number = 30, currentCycleOnly: boolean = false): DailyStats[] {
  const logs = this.plugin.flashcardManager['reviewLogs'] || [];
  const stats: Map<string, DailyStats> = new Map();

  // 获取当前周期（如果需要过滤）
  const currentCycle = currentCycleOnly ? this.getCurrentCycleNumber() : null;

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

  // 统计复习记录（支持周期过滤）
  logs.forEach(log => {
    const logCycle = log.cycle || 1;
    // 如果需要只统计当前周期
    if (currentCycle !== null && logCycle !== currentCycle) {
      return;
    }

    const date = new Date(log.timestamp).toISOString().split('T')[0];
    const stat = stats.get(date);
    if (!stat) return;

    stat.reviewed++;
    stat.timeSpent += log.response.timeSpent;

    if (log.response.ease === 'good' || log.response.ease === 'easy') {
      stat.correctCount++;
    } else if (log.response.ease === 'hard') {
      stat.correctCount += 0.5;
    }

    const card = this.plugin.flashcardManager.getFlashcard(log.flashcardId);
    if (card && card.stats.totalReviews === 1) {
      stat.newCards++;
    }
  });

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
getWeeklyStats(currentCycleOnly: boolean = false): { thisWeek: WeeklyStats; lastWeek: WeeklyStats } {
  const now = new Date();
  const currentCycle = currentCycleOnly ? this.getCurrentCycleNumber() : null;
  
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - now.getDay());
  thisWeekStart.setHours(0, 0, 0, 0);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisWeek = this.calculateWeekStats(thisWeekStart, currentCycle);
  const lastWeek = this.calculateWeekStats(lastWeekStart, currentCycle);

  return { thisWeek, lastWeek };
}

private calculateWeekStats(startDate: Date, cycleFilter: number | null = null): WeeklyStats {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7);

  let logs = (this.plugin.flashcardManager['reviewLogs'] || []).filter(
    log => log.timestamp >= startDate.getTime() && log.timestamp < endDate.getTime()
  );

  // 应用周期过滤
  if (cycleFilter !== null) {
    logs = logs.filter(log => (log.cycle || 1) === cycleFilter);
  }

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


