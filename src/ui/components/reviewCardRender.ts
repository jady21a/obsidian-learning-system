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
          // ← 修改:渲染带实时预览的表格
          const tableEl = this.renderTableWithInputPreview(
            card.front, 
            card.cloze?.deletions || [],
            state
          );
          questionText.appendChild(tableEl);
          questionText.classList.add('table-question');
        } else {
          const tableEl = TableRenderer.renderTable(card.front, false);
          questionText.appendChild(tableEl);
          questionText.classList.add('table-question');
        }
      
        // 输入框(移到表格下方或保持在原位)
        if (card.cloze) {
          const actualBlankCount = (card.cloze.original.match(/==[^=]+==/g) || []).length;
          const blankCount = Math.max(actualBlankCount, card.cloze.deletions.length);
          
          if (state.userAnswers.length !== blankCount) {
            state.userAnswers = new Array(blankCount).fill('');
          }
      
          const inputArea = container.createDiv({ cls: 'cloze-input-area' });
          inputArea.createEl('h4', { text: `Fill in the blanks (${blankCount} total):` });
          
          const hint = inputArea.createEl('div', { cls: 'cloze-input-hint' });
          hint.innerHTML = '💡 <strong>Separate answers with:</strong> <code>|</code>, <code>,</code>, <code>,</code>, or 2+ spaces<br>';
          
          const singleInputGroup = inputArea.createDiv({ cls: 'single-input-group' });
          const initialValue = state.userAnswers.filter(a => a).join(' | ');
          
          const input = singleInputGroup.createEl('input', {
            type: 'text',
            placeholder: `Enter all ${blankCount} answers separated by |, comma, or spaces...`,
            cls: 'cloze-single-input',
            value: initialValue
          });
          
          // 实时更新函数
          const updatePreview = (inputValue: string) => {
            const parts = this.parseMultipleAnswers(inputValue, blankCount);
            state.userAnswers = parts;
            
            // ← 如果是表格,重新渲染表格
            if (isTable) {
              questionText.empty();
              const updatedTableEl = this.renderTableWithInputPreview(
                card.front,
                card.cloze?.deletions || [],
                state
              );
              questionText.appendChild(updatedTableEl);
            }
          };
          
          input.addEventListener('input', (e) => {
            const inputValue = (e.target as HTMLInputElement).value;
            updatePreview(inputValue);
          });
          
          updatePreview(initialValue);
          setTimeout(() => input.focus(), 50);
        }
      }
      
      // ← 添加新方法:渲染带输入预览的表格
      private renderTableWithInputPreview(
        markdown: string,
        deletions: Array<{ answer: string }>,
        state: ReviewState
      ): HTMLElement {
        const container = document.createElement('div');
        
        if (!markdown?.trim()) {
          container.textContent = '(empty table)';
          return container;
        }
      
        const lines = markdown.trim().split('\n');
        if (lines.length < 2) {
          container.textContent = markdown;
          return container;
        }
      
        const table = container.createEl('table', { 
          cls: 'learning-system-table flashcard-review-table preview-table' 
        });
      
        // 查找分隔符
        const separatorIndex = lines.findIndex(line => {
          const cleaned = line.replace(/[\s|]/g, '');
          return cleaned.length >= 3 && /^[-:]+$/.test(cleaned);
        });
        
        let deletionIndex = 0;
      
        // 渲染表头
        if (separatorIndex > 0) {
          const headerCells = this.parseCells(lines[separatorIndex - 1]);
          const thead = table.createEl('thead');
          const headerRow = thead.createEl('tr');
          
          headerCells.forEach(cell => {
            const th = headerRow.createEl('th');
            const rendered = this.renderCellWithPreview(cell, state.userAnswers, deletionIndex);
            th.innerHTML = rendered.html;
            if (rendered.hasBlank) deletionIndex++;
          });
        }
      
        // 渲染数据行
        const tbody = table.createEl('tbody');
        const startRow = separatorIndex > 0 ? separatorIndex + 1 : 0;
        
        for (let i = startRow; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          
          const cells = this.parseCells(line);
          if (cells.length === 0) continue;
          
          const row = tbody.createEl('tr');
          cells.forEach(cell => {
            const td = row.createEl('td');
            const rendered = this.renderCellWithPreview(cell, state.userAnswers, deletionIndex);
            td.innerHTML = rendered.html;
            if (rendered.hasBlank) deletionIndex++;
          });
        }
      
        return container;
      }
      
      // ← 添加辅助方法:解析单元格
      private parseCells(line: string): string[] {
        let trimmed = line.trim();
        if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
        if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
        
        return trimmed
          .split('|')
          .map(c => c.trim())
          .filter(c => c.length > 0);
      }
      
      // ← 添加辅助方法:渲染带预览的单元格
      private renderCellWithPreview(
        cell: string,
        userAnswers: string[],
        deletionIndex: number
      ): { html: string; hasBlank: boolean } {
        const match = cell.match(/==([^=]+)==/);
        
        if (!match) {
          return { html: cell, hasBlank: false };
        }
        
        // 有挖空标记
        const userAnswer = userAnswers[deletionIndex] || '';
        const displayText = userAnswer 
          ? `<span class="preview-answer">${userAnswer}</span>` 
          : '<span class="cloze-blank"></span>';
        
        const html = cell.replace(/==([^=]+)==/g, displayText);
        
        return { html, hasBlank: true };
      }
      
      // ← 添加新的辅助方法:解析多答案输入
      private parseMultipleAnswers(input: string, expectedCount: number): string[] {
        if (!input.trim()) {
          return new Array(expectedCount).fill('');
        }
        
        // 统一处理分隔符
        let normalized = input
          .replace(/,/g, '|')        // 英文逗号
          .replace(/,/g, '|')        // 中文逗号  
          .replace(/\s{2,}/g, '|');  // 多个空格
        
        const parts = normalized
          .split('|')
          .map(s => s.trim());
        
        // 确保数组长度匹配
        const result = new Array(expectedCount).fill('');
        for (let i = 0; i < Math.min(parts.length, expectedCount); i++) {
          result[i] = parts[i];
        }
        
        return result;
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
    
    // 左列:正确答案
    const correctColumn = columnsContainer.createDiv({ cls: 'qa-column' });
    correctColumn.createEl('h4', { text: 'Correct Answer:', cls: 'column-label' });
    const correctDiv = correctColumn.createDiv({ cls: 'comparison-item' });
    const tableEl = TableRenderer.renderTable(card.cloze!.original, true);
    correctDiv.appendChild(tableEl);
    correctDiv.classList.add('table-answer');
    
    // 右列:用户答案
    const userColumn = columnsContainer.createDiv({ cls: 'qa-column' });
    userColumn.createEl('h4', { text: 'Your Answer:', cls: 'column-label' });
    const userDiv = userColumn.createDiv({ cls: 'comparison-item' });
  
    // ← 修改:提取实际的答案来构建 deletions
    const actualAnswers = this.extractClozeAnswers(card.cloze!.original);
    const constructedDeletions = actualAnswers.map(answer => ({ answer }));
    
  
    // 确保 userAnswers 数组长度匹配
    const normalizedAnswers = new Array(actualAnswers.length).fill('');
    for (let i = 0; i < Math.min(state.userAnswers.length, normalizedAnswers.length); i++) {
      normalizedAnswers[i] = state.userAnswers[i] || '';
    }
  
    const userTableEl = TableRenderer.renderTableWithUserAnswers(
      card.cloze!.original,
      constructedDeletions,  // ← 使用构建的 deletions
      normalizedAnswers,
      scheduler
    );
    userDiv.appendChild(userTableEl);
    userDiv.classList.add('table-answer');
  
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
    
    // ← 这里已经会调用 renderDetailedComparison,它会使用新的逻辑
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
  
    // ← 关键修改:使用实际的挖空数量,而不是 deletions.length
    // 方法1: 从原始文本提取所有挖空答案
    const actualAnswers = this.extractClozeAnswers(card.cloze!.original);
    
  
    // 使用实际答案数量进行对比
    const maxCount = Math.max(actualAnswers.length, state.userAnswers.length);
    
    for (let index = 0; index < maxCount; index++) {
      const item = comparison.createDiv({ cls: 'comparison-item' });
      item.createSpan({ text: `${index + 1}. ` });
  
      const userAnswer = state.userAnswers[index] || '';
      const correctAnswer = actualAnswers[index] || '';
      
      if (!correctAnswer) {
        // 如果没有对应的正确答案(用户多输入了)
        item.createEl('span', {
          text: userAnswer || '(empty)',
          cls: 'user-answer  ${evaluation.correctness}'
        });
        item.createSpan({ text: ' → ' });
        item.createEl('span', {
          text: '(no blank here)',
          cls: 'correct-answer'
        });
        continue;
      }
  
      const evaluation = scheduler.evaluateAnswer(correctAnswer, userAnswer);
  
      item.createEl('span', {
        text: userAnswer || '(empty)',
        cls: `user-answer ${evaluation.correctness}`
      });
      
      item.createSpan({ text: ' → ' });
      
      item.createEl('span', {
        text: correctAnswer,
        cls: 'correct-answer'
      });
  
      if (evaluation.correctness === 'partial') {
        item.createEl('small', {
          text: ` (${Math.round(evaluation.similarity * 100)}% match)`,
          cls: 'similarity-info'
        });
      }
    }
  }
  
  // ← 添加新方法:从原始文本提取所有挖空答案
  private extractClozeAnswers(originalText: string): string[] {
    const matches = originalText.match(/==([^=]+)==/g);
    if (!matches) return [];
    
    return matches.map(match => {
      // 移除 == 标记,获取答案
      return match.replace(/==/g, '').trim();
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