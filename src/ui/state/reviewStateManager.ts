// ReviewStateManager.ts
import { Flashcard } from '../../core/FlashcardManager';

export interface ReviewState {
  showAnswer: boolean;
  startTime: number;
  userAnswers: string[];
  userAnswer: string;
}

export class ReviewStateManager {
  private state: ReviewState;

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

  updateForNewCard(card: Flashcard, isSameCard: boolean) {
    if (!isSameCard) {
      this.reset();
    }
    
    if (!this.state.showAnswer && this.state.startTime === 0) {
      this.state.startTime = Date.now();
    }
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