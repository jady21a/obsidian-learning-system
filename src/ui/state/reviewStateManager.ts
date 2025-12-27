// ReviewStateManager.ts
import { Flashcard } from '../../core/FlashcardManager';

export interface ReviewState {
  showAnswer: boolean;
  startTime: number;
  userAnswers: string[];
  userAnswer: string;
}

// ✅ 添加答案缓存接口
interface CardAnswerCache {
  userAnswer: string;
  userAnswers: string[];
}

export class ReviewStateManager {
  private state: ReviewState;
  private answerCache: Map<string, CardAnswerCache> = new Map(); // ✅ 新增缓存

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): ReviewState {
    return {
      showAnswer: false,
      startTime: 0,
      userAnswers: [],
      userAnswer: ''
    };
  }

  getState(): ReviewState {
    return this.state;
  }

  reset() {
    this.state = this.createInitialState();
  }

  // ✅ 保存当前卡片的答案到缓存
  saveAnswerToCache(cardId: string) {
    this.answerCache.set(cardId, {
      userAnswer: this.state.userAnswer,
      userAnswers: [...this.state.userAnswers]
    });
  }

  // ✅ 从缓存恢复答案
  private restoreAnswerFromCache(cardId: string) {
    const cached = this.answerCache.get(cardId);
    if (cached) {
      this.state.userAnswer = cached.userAnswer;
      this.state.userAnswers = [...cached.userAnswers];

    } else {
    }
  }

  // ✅ 清除指定卡片的缓存
  clearCache(cardId: string) {
    this.answerCache.delete(cardId);
  }

  updateForNewCard(
    newCard: Flashcard,
    isSameCard: boolean,
    direction?: 'next' | 'prev'
  ) {
    if (!isSameCard) {
      if (direction === 'prev') {
        // ✅ prev: 先恢复缓存,再设置其他状态
        this.restoreAnswerFromCache(newCard.id);

      } else {
        // next: 清空状态,准备新卡片
        this.state.showAnswer = false;
        this.state.userAnswer = '';
  
        if (newCard.type === 'cloze' && newCard.cloze) {
          this.state.userAnswers = new Array(
            newCard.cloze.deletions.length
          ).fill('');
        } else {
          this.state.userAnswers = [];
        }
      }
    }
    
    this.state.startTime = Date.now();
  }

  setShowAnswer(show: boolean) {
    this.state.showAnswer = show;
  }

  setUserAnswer(answer: string) {
    this.state.userAnswer = answer;
  }

  setUserAnswers(answers: string[]) {
    this.state.userAnswers = answers;
  }

  updateUserAnswerAtIndex(index: number, value: string) {
    this.state.userAnswers[index] = value;
  }

  ensureUserAnswersLength(length: number) {
    if (this.state.userAnswers.length < length) {
      this.state.userAnswers = new Array(length).fill('');
    }
  }

  getTimeSpent(): number {
    return (Date.now() - this.state.startTime) / 1000;
  }
}