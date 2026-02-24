// card Scheduler.ts
import { Flashcard, ReviewLog } from './FlashcardManager';

export type ReviewEase = 'again' | 'hard' | 'good' | 'easy';

export class CardScheduler {
  /**
   * 计算下次复习时间（基于 SM-2 算法）
   */
  schedule(
    card: Flashcard,
    ease: ReviewEase,
    timeSpent: number,
    userAnswer?: string | string[]
  ): {
    updatedCard: Flashcard;
    reviewLog: Omit<ReviewLog, 'id'>;
  } {
    const oldScheduling = { ...card.scheduling };
    const newScheduling = { ...card.scheduling };
    const now = Date.now();

    // 更新统计
    card.stats.totalReviews++;
    card.stats.lastReview = now;

    // 计算平均时间
    const totalTime = card.stats.averageTime * (card.stats.totalReviews - 1) + timeSpent;
    card.stats.averageTime = totalTime / card.stats.totalReviews;

    // 根据难度评级更新调度
    switch (ease) {
      case 'again':
        this.scheduleAgain(newScheduling, card.stats);
        break;
      case 'hard':
        this.scheduleHard(newScheduling, card.stats);
        break;
      case 'good':
        this.scheduleGood(newScheduling, card.stats);
        break;
      case 'easy':
        this.scheduleEasy(newScheduling, card.stats);
        break;
    }

    card.scheduling = newScheduling;
    card.metadata.updatedAt = now;

    // 创建复习日志
    const reviewLog: Omit<ReviewLog, 'id'> = {
      flashcardId: card.id,
      timestamp: now,
      response: {
        userAnswer,
        timeSpent,
        ease
      },
      schedulingChange: {
        oldInterval: oldScheduling.interval,
        newInterval: newScheduling.interval,
        oldEase: oldScheduling.ease,
        newEase: newScheduling.ease
      }
    };

    return { updatedCard: card, reviewLog };
  }

  /**
   * Again - 完全忘记
   */
  private scheduleAgain(
    scheduling: Flashcard['scheduling'],
    stats: Flashcard['stats']
  ) {
    // 重置间隔
    scheduling.interval = 1; // 1 分钟
    scheduling.ease = Math.max(1.3, scheduling.ease - 0.2);
    scheduling.due = Date.now() + scheduling.interval * 60 * 1000;
    scheduling.lapses++;
    scheduling.reps++;
    
    // 状态转换
    if (scheduling.state === 'new') {
      scheduling.state = 'learning';
    } else {
      scheduling.state = 'relearning';
    }

    // 增加难度
    stats.difficulty = Math.min(1.0, stats.difficulty + 0.1);
  }

  /**
   * Hard - 困难
   */
  private scheduleHard(
    scheduling: Flashcard['scheduling'],
    stats: Flashcard['stats']
  ) {
    scheduling.reps++;

    if (scheduling.state === 'new' || scheduling.state === 'learning') {
      // 学习阶段：10 分钟
      scheduling.interval = 10;
      scheduling.due = Date.now() + 10 * 60 * 1000;
      scheduling.state = 'learning';
    } else {
      // 复习阶段：当前间隔 * 1.2
      scheduling.interval = Math.max(1, scheduling.interval * 1.2);
      scheduling.ease = Math.max(1.3, scheduling.ease - 0.15);
      scheduling.due = Date.now() + scheduling.interval * 24 * 60 * 60 * 1000;
      scheduling.state = 'review';
    }

    stats.difficulty = Math.min(1.0, stats.difficulty + 0.05);
    stats.correctCount += 0.5; // 部分正确
  }

  /**
   * Good - 正确
   */
  private scheduleGood(
    scheduling: Flashcard['scheduling'],
    stats: Flashcard['stats']
  ) {
    scheduling.reps++;
    stats.correctCount++;

    if (scheduling.state === 'new') {
      // 新卡片：1 天
      scheduling.interval = 1;
      scheduling.due = Date.now() + 1 * 24 * 60 * 60 * 1000;
      scheduling.state = 'learning';
    } else if (scheduling.state === 'learning') {
      // 学习中：进入复习，间隔根据记忆强度
      if (scheduling.interval < 1) {
        scheduling.interval = 1;
      } else {
        scheduling.interval = 3;
      }
      scheduling.due = Date.now() + scheduling.interval * 24 * 60 * 60 * 1000;
      scheduling.state = 'review';
    } else {
      // 复习阶段：间隔 * ease
      scheduling.interval = scheduling.interval * scheduling.ease;
      scheduling.due = Date.now() + scheduling.interval * 24 * 60 * 60 * 1000;
      scheduling.ease = scheduling.ease + 0.1;
      scheduling.state = 'review';
    }

    // 降低难度
    stats.difficulty = Math.max(0, stats.difficulty - 0.05);
  }

  /**
   * Easy - 非常简单
   */
  private scheduleEasy(
    scheduling: Flashcard['scheduling'],
    stats: Flashcard['stats']
  ) {
    scheduling.reps++;
    stats.correctCount++;

    if (scheduling.state === 'new') {
      // 新卡片：直接 4 天
      scheduling.interval = 4;
      scheduling.due = Date.now() + 4 * 24 * 60 * 60 * 1000;
      scheduling.state = 'review';
    } else if (scheduling.state === 'learning') {
      // 学习中：直接进入复习，7 天
      scheduling.interval = 7;
      scheduling.due = Date.now() + 7 * 24 * 60 * 60 * 1000;
      scheduling.state = 'review';
    } else {
      // 复习阶段：间隔 * (ease + 0.3)
      scheduling.interval = scheduling.interval * (scheduling.ease + 0.3);
      scheduling.due = Date.now() + scheduling.interval * 24 * 60 * 60 * 1000;
      scheduling.ease = scheduling.ease + 0.15;
      scheduling.state = 'review';
    }

    // 显著降低难度
    stats.difficulty = Math.max(0, stats.difficulty - 0.1);
  }

  /**
   * 评估用户答案（用于输入答案模式）
   */
/**
 * 评估用户答案(用于输入答案模式)
 */
evaluateAnswer(
  correctAnswer: string | string[],
  userAnswer: string | string[]
): {
  correctness: 'correct' | 'partial' | 'wrong';
  similarity: number;
} {
  // 处理数组(完形填空)
  if (Array.isArray(correctAnswer) && Array.isArray(userAnswer)) {
    let correctCount = 0;
    const total = correctAnswer.length;

    for (let i = 0; i < total; i++) {
      // 🆕 对每个空格也应用 "/" 规则
      const evaluation = this.evaluateSingleAnswer(
        correctAnswer[i],
        userAnswer[i] || ''
      );
      
      if (evaluation.similarity >= 0.9) correctCount++;
      else if (evaluation.similarity >= 0.6) correctCount += 0.5;
    }

    const overallSimilarity = correctCount / total;

    if (overallSimilarity >= 0.9) {
      return { correctness: 'correct', similarity: overallSimilarity };
    } else if (overallSimilarity >= 0.6) {
      return { correctness: 'partial', similarity: overallSimilarity };
    } else {
      return { correctness: 'wrong', similarity: overallSimilarity };
    }
  }

  // 🆕 处理字符串 - 提取到独立方法
  return this.evaluateSingleAnswer(
    correctAnswer as string,
    userAnswer as string
  );
}

/**
 * 🆕 评估单个答案(支持 "/" 分隔的多个正确答案)
 */
private evaluateSingleAnswer(
  correctAnswer: string,
  userAnswer: string
): {
  correctness: 'correct' | 'partial' | 'wrong';
  similarity: number;
} {
  const correct = this.normalize(correctAnswer);
  const user = this.normalize(userAnswer);

  // 空答案
  if (user.length === 0) {
    return { correctness: 'wrong', similarity: 0 };
  }

  // 🆕 检查是否包含 "/" - 表示多个可接受答案
  if (correctAnswer.includes('/') || correctAnswer.includes('|')) {
    const alternatives = correctAnswer
      .split(/[/|]/)  // 支持 / 或 |
      .map(alt => this.normalize(alt.trim()))
      .filter(alt => alt.length > 0);

    // 对每个可能的答案计算相似度,取最高分
    let maxSimilarity = 0;
    for (const alternative of alternatives) {
      // 完全匹配任意一个就算对
      if (user === alternative) {
        return { correctness: 'correct', similarity: 1.0 };
      }
      
      const similarity = this.calculateSimilarity(alternative, user);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    // 使用最高相似度判断
    if (maxSimilarity >= 0.9) {
      return { correctness: 'correct', similarity: maxSimilarity };
    } else if (maxSimilarity >= 0.7) {
      return { correctness: 'partial', similarity: maxSimilarity };
    } else {
      return { correctness: 'wrong', similarity: maxSimilarity };
    }
  }

  // 🔽 原有逻辑 - 处理不含 "/" 的普通答案
  
  // 长度差异过大直接判错
  const lengthRatio = Math.min(user.length, correct.length) / 
                      Math.max(user.length, correct.length);
if (lengthRatio < 0.3 && user.length < 6) {
  return { correctness: 'wrong', similarity: 0 };
}



  const similarity = this.calculateSimilarity(correct, user);
  const coverage = this.calculateTokenCoverage(correct, user);
  
  // 原有规则
  if (similarity >= 0.9) {
    return { correctness: 'correct', similarity };
  }
  
  // 🆕 新增：关键词命中多，但句子结构差
  if (similarity < 0.7 && coverage >= 0.6) {
    return { correctness: 'partial', similarity };
  }
  
  // 原有部分正确
  if (similarity >= 0.7) {
    return { correctness: 'partial', similarity };
  }
  
  return { correctness: 'wrong', similarity };
  
}
  /**
   * 标准化文本
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')    // 合并多个空格为一个
      .replace(/\n+/g, ' ')    // 换行替换为空格
      .replace(/[，。！？、；：""''（）《》【】.,!?;:"'()[\]{}]/g, '');
  }

  /**
   * 计算相似度（Levenshtein 距离）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const matrix: number[][] = [];

    // 初始化矩阵
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // 填充矩阵
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 替换
            matrix[i][j - 1] + 1,     // 插入
            matrix[i - 1][j] + 1      // 删除
          );
        }
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    
    return 1 - distance / maxLength;
  }
/**
 * 计算关键词覆盖率
 * 用户答案中命中了多少标准答案的词
 */
private calculateTokenCoverage(
  correct: string,
  user: string
): number {
  const correctTokens = correct.split(' ').filter(t => t.length > 1);
  const userTokens = new Set(user.split(' '));

  if (correctTokens.length === 0) return 0;

  let hit = 0;
  for (const token of correctTokens) {
    if (userTokens.has(token)) hit++;
  }

  return hit / correctTokens.length; // 0 ~ 1
}


  /**
   * 根据相似度建议难度
   */
  suggestEase(similarity: number): ReviewEase {
    if (similarity >= 0.8) return 'easy';
    if (similarity >= 0.7) return 'good';
    if (similarity >= 0.5) return 'hard';
    return 'again';
  }
}