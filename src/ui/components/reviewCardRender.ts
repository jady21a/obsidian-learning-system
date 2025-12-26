// CardRenderers.ts
import { Flashcard } from '../../core/FlashcardManager';
import { CardScheduler } from '../../core/CardScheduler';
import { TableRenderer } from './TableRenderer';
import type { ReviewState } from '../state/reviewStateManager';

// ============================================================================
// 卡片渲染策略接口
// ============================================================================
export interface CardRenderStrategy {
  renderQuestion(container: HTMLElement, card: Flashcard, state: ReviewState): void;
  renderAnswer(
    container: HTMLElement, 
    card: Flashcard, 
    state: ReviewState, 
    scheduler: CardScheduler
  ): void;
}

// ============================================================================
// 完形填空卡片渲染器
// ============================================================================
export class ClozeCardRenderer implements CardRenderStrategy {
  renderQuestion(container: HTMLElement, card: Flashcard, state: ReviewState): void {
    // 问题文本
    const questionText = container.createDiv({ cls: 'question-text' });
    const isTable = TableRenderer.isTableFormat(card.front);
    
    if (isTable) {
      const tableEl = TableRenderer.renderTable(card.front, false);
      questionText.appendChild(tableEl);
      questionText.classList.add('table-question');
    } else {
      questionText.textContent = card.front;
    }

    // 输入框
    if (card.cloze) {
      const inputArea = container.createDiv({ cls: 'cloze-input-area' });
      inputArea.createEl('h4', { text: 'Fill in the blanks:' });

      // 确保数组长度
      if (state.userAnswers.length < card.cloze.deletions.length) {
        state.userAnswers = new Array(card.cloze.deletions.length).fill('');
      }

      card.cloze.deletions.forEach((deletion, index) => {
        const inputGroup = inputArea.createDiv({ cls: 'input-group' });
        inputGroup.createSpan({ text: `${index + 1}. ` });
        
        const input = inputGroup.createEl('input', {
          type: 'text',
          placeholder: 'Your answer...',
          cls: 'cloze-input',
          value: state.userAnswers[index] || ''
        });
        
        input.addEventListener('input', (e) => {
          state.userAnswers[index] = (e.target as HTMLInputElement).value;
        });

        if (index === 0) {
          setTimeout(() => input.focus(), 50);
        }
      });
    }
  }

  renderAnswer(
    container: HTMLElement,
    card: Flashcard,
    state: ReviewState,
    scheduler: CardScheduler
  ): void {
    if (!card.cloze) return;

    const answerArea = container.createDiv({ cls: 'answer-area' });
    const isOriginalTable = TableRenderer.isTableFormat(card.cloze.original);

    if (isOriginalTable) {
      this.renderTableAnswer(answerArea, card, state, scheduler);
    } else {
      this.renderTextAnswer(answerArea, card, state, scheduler);
    }
  }

  private renderTableAnswer(
    answerArea: HTMLElement,
    card: Flashcard,
    state: ReviewState,
    scheduler: CardScheduler
  ) {
    const columnsContainer = answerArea.createDiv({ cls: 'cloze-table-columns' });
    
    // 左列：正确答案
    const correctColumn = columnsContainer.createDiv({ cls: 'qa-column' });
    correctColumn.createEl('h4', { text: 'Correct Answer:', cls: 'column-label' });
    const correctDiv = correctColumn.createDiv({ cls: 'comparison-item' });
    const tableEl = TableRenderer.renderTable(card.cloze!.original, true);
    correctDiv.appendChild(tableEl);
    correctDiv.classList.add('table-answer');
    
    // 右列：用户答案
    const userColumn = columnsContainer.createDiv({ cls: 'qa-column' });
    userColumn.createEl('h4', { text: 'Your Answer:', cls: 'column-label' });
    const userDiv = userColumn.createDiv({ cls: 'comparison-item' });
    
    if (state.userAnswers.length > 0 && state.userAnswers.some(a => a.trim())) {
      const userTableEl = TableRenderer.renderTableWithUserAnswers(
        card.cloze!.original,
        card.cloze!.deletions,
        state.userAnswers,
        scheduler
      );
      userDiv.appendChild(userTableEl);
      userDiv.classList.add('table-answer');
    } else {
      const emptyTableEl = TableRenderer.renderTable(card.front, false);
      userDiv.appendChild(emptyTableEl);
      userDiv.classList.add('table-answer', 'no-answer');
    }

    // 详细对比
    this.renderDetailedComparison(answerArea, card, state, scheduler);
  }

  private renderTextAnswer(
    answerArea: HTMLElement,
    card: Flashcard,
    state: ReviewState,
    scheduler: CardScheduler
  ) {
    const fullText = answerArea.createDiv({ cls: 'full-text' });
    fullText.textContent = card.cloze!.original;
    
    this.renderDetailedComparison(answerArea, card, state, scheduler);
  }

  private renderDetailedComparison(
    answerArea: HTMLElement,
    card: Flashcard,
    state: ReviewState,
    scheduler: CardScheduler
  ) {
    if (state.userAnswers.length === 0) return;

    const comparison = answerArea.createDiv({ cls: 'answer-comparison' });
    comparison.createEl('h4', { text: 'Answer Details:' });

    card.cloze!.deletions.forEach((deletion, index) => {
      const item = comparison.createDiv({ cls: 'comparison-item' });
      item.createSpan({ text: `${index + 1}. ` });

      const userAnswer = state.userAnswers[index] || '';
      const evaluation = scheduler.evaluateAnswer(deletion.answer, userAnswer);

      item.createEl('span', {
        text: userAnswer || '(empty)',
        cls: `user-answer ${evaluation.correctness}`
      });
      
      item.createSpan({ text: ' → ' });
      
      item.createEl('span', {
        text: deletion.answer,
        cls: 'correct-answer'
      });

      if (evaluation.correctness === 'partial') {
        item.createEl('small', {
          text: ` (${Math.round(evaluation.similarity * 100)}% match)`,
          cls: 'similarity-info'
        });
      }
    });
  }
}

// ============================================================================
// 问答卡片渲染器
// ============================================================================
export class QACardRenderer implements CardRenderStrategy {
  renderQuestion(container: HTMLElement, card: Flashcard, state: ReviewState): void {
    // 问题文本
    const questionText = container.createDiv({ cls: 'question-text' });
    const isTable = TableRenderer.isTableFormat(card.front);
    
    if (isTable) {
      const tableEl = TableRenderer.renderTable(card.front, false);
      questionText.appendChild(tableEl);
      questionText.classList.add('table-question');
    } else {
      questionText.textContent = card.front;
    }

    // 输入框
    const inputArea = container.createDiv({ cls: 'qa-input-area' });
    inputArea.createEl('h4', { text: 'Your Answer:' });
    
    const textarea = inputArea.createEl('textarea', {
      placeholder: 'Type your answer here...',
      cls: 'qa-input',
      value: state.userAnswer
    });
    
    textarea.addEventListener('input', (e) => {
      state.userAnswer = (e.target as HTMLTextAreaElement).value;
    });
    
    setTimeout(() => textarea.focus(), 50);
  }

  renderAnswer(
    container: HTMLElement,
    card: Flashcard,
    state: ReviewState,
    scheduler: CardScheduler
  ): void {
    const answerArea = container.createDiv({ cls: 'answer-area' });
    
    // 获取正确答案
    const correctAnswer = Array.isArray(card.back) 
      ? (card.back[0] || card.back.join('\n'))
      : card.back as string;
    
    const isTable = TableRenderer.isTableFormat(correctAnswer);
    const evaluation = state.userAnswer.trim() 
      ? scheduler.evaluateAnswer(correctAnswer, state.userAnswer)
      : null;

    const comparison = answerArea.createDiv({ 
      cls: 'answer-comparison qa-comparison' 
    });
    const columnsContainer = comparison.createDiv({ cls: 'qa-columns-container' });
    
    // 左列：正确答案
    this.renderCorrectAnswerColumn(columnsContainer, correctAnswer, isTable);
    
    // 右列：用户答案
    this.renderUserAnswerColumn(
      columnsContainer, 
      state.userAnswer, 
      isTable, 
      evaluation
    );

    // 相似度信息
    if (evaluation?.correctness === 'partial') {
      const similarityInfo = comparison.createEl('div', {
        cls: 'similarity-info qa-similarity'
      });
      similarityInfo.textContent = `Similarity: ${Math.round(evaluation.similarity * 100)}%`;
    }
  }

  private renderCorrectAnswerColumn(
    container: HTMLElement,
    correctAnswer: string,
    isTable: boolean
  ) {
    const correctColumn = container.createDiv({ cls: 'qa-column' });
    correctColumn.createEl('h4', { text: 'Correct Answer:', cls: 'column-label' });
    const correctAnswerDiv = correctColumn.createDiv({ cls: 'comparison-item' });
    
    if (isTable) {
      const tableEl = TableRenderer.renderTable(correctAnswer, true);
      correctAnswerDiv.appendChild(tableEl);
      correctAnswerDiv.classList.add('table-answer');
    } else {
      correctAnswerDiv.createEl('div', {
        text: correctAnswer,
        cls: 'correct-answer qa-correct-answer'
      });
    }
  }

  private renderUserAnswerColumn(
    container: HTMLElement,
    userAnswer: string,
    isTable: boolean,
    evaluation: any
  ) {
    const userColumn = container.createDiv({ cls: 'qa-column' });
    userColumn.createEl('h4', { text: 'Your Answer:', cls: 'column-label' });
    const userAnswerDiv = userColumn.createDiv({ cls: 'comparison-item' });

    const isUserAnswerTable = TableRenderer.isTableFormat(userAnswer.trim());
    const shouldRenderAsTable = isUserAnswerTable || (isTable && userAnswer.trim());

    if (shouldRenderAsTable && userAnswer.trim()) {
      try {
        const userTableEl = TableRenderer.renderTable(userAnswer, true);
        userAnswerDiv.appendChild(userTableEl);
        userAnswerDiv.classList.add('table-answer');
        
        if (evaluation) {
          userAnswerDiv.classList.add('user-answer', evaluation.correctness);
        }
      } catch (error) {
        this.renderTextUserAnswer(userAnswerDiv, userAnswer, evaluation);
      }
    } else {
      this.renderTextUserAnswer(userAnswerDiv, userAnswer, evaluation);
    }
  }

  private renderTextUserAnswer(
    container: HTMLElement,
    userAnswer: string,
    evaluation: any
  ) {
    const userAnswerElement = container.createEl('div', {
      text: userAnswer.trim() || '(no answer provided)',
      cls: 'qa-user-answer'
    });
    
    if (evaluation) {
      userAnswerElement.classList.add('user-answer', evaluation.correctness);
    } else {
      userAnswerElement.classList.add('no-answer');
    }
  }
}

// ============================================================================
// 卡片渲染器工厂
// ============================================================================
export class CardRendererFactory {
  private static renderers = new Map<string, CardRenderStrategy>([
    ['cloze', new ClozeCardRenderer()],
    ['qa', new QACardRenderer()]
  ]);

  static getRenderer(cardType: string): CardRenderStrategy {
    const renderer = this.renderers.get(cardType);
    if (!renderer) {
      throw new Error(`Unknown card type: ${cardType}`);
    }
    return renderer;
  }
}