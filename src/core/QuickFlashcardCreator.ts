import { Notice } from 'obsidian';
import type LearningSystemPlugin from '../main';
import { ContentUnit } from '../core/DataManager';
import { Annotation } from '../core/AnnotationManager';

/**
 * 一键创建闪卡工具类
 */
export class QuickFlashcardCreator {
  constructor(private plugin: LearningSystemPlugin) {}

  /**
   * 从提取内容一键创建问答卡
   * 如果有批注，使用批注作为答案
   */
  async createQuickQACard(contentUnit: ContentUnit): Promise<void> {
    try {
      const annotation = this.plugin.annotationManager.getContentAnnotation(contentUnit.id);
      
      let question: string;
      let answer: string;

      if (annotation && annotation.content) {
        // 如果有批注，使用批注内容作为答案
        // 检查批注是否是问题形式
        if (this.isQuestion(annotation.content)) {
          // 批注是问题，生成默认问题，批注内容作为答案
          question = this.generateDefaultQuestion(contentUnit);
          answer = annotation.content;
        } else {
          // 批注不是问题形式，生成默认问题，批注内容作为答案
          question = this.generateDefaultQuestion(contentUnit);
          answer = annotation.content;
        }
      } else {
        // 没有批注，使用默认模式
        question = this.generateDefaultQuestion(contentUnit);
        answer = contentUnit.content;
      }

      // 创建闪卡
      const card = await this.plugin.flashcardManager.createQACard(
        contentUnit.id,
        question,
        answer
      );

      new Notice(`✅ Flashcard created! (Q&A)`);
    } catch (error) {
      console.error('Error creating quick flashcard:', error);
      new Notice('❌ Failed to create flashcard');
    }
  }

  /**
   * 从提取内容一键创建完形填空卡
   * 自动识别关键词
   */
  async createQuickClozeCard(contentUnit: ContentUnit): Promise<void> {
    try {
      const keywords = this.extractKeywords(contentUnit.content);
      
      if (keywords.length === 0) {
        new Notice('⚠️ No keywords found for cloze deletion');
        return;
      }

      // 找到关键词在文本中的位置
      const deletions = keywords.map(keyword => {
        const index = contentUnit.content.indexOf(keyword.word);
        return {
          index,
          answer: keyword.word
        };
      }).filter(d => d.index !== -1);

      if (deletions.length === 0) {
        new Notice('⚠️ Could not create cloze deletions');
        return;
      }

      // 创建完形填空卡
      const card = await this.plugin.flashcardManager.createClozeCard(
        contentUnit.id,
        contentUnit.content,
        deletions
      );

      new Notice(`✅ Flashcard created! (Cloze with ${deletions.length} blanks)`);
    } catch (error) {
      console.error('Error creating quick cloze card:', error);
      new Notice('❌ Failed to create flashcard');
    }
  }

  /**
   * 智能创建闪卡（自动判断类型）
   */
  async createSmartCard(contentUnit: ContentUnit): Promise<void> {
    const annotation = this.plugin.annotationManager.getContentAnnotation(contentUnit.id);

    // 如果有问题形式的批注，创建问答卡
    if (annotation && this.isQuestion(annotation.content)) {
      await this.createQuickQACard(contentUnit);
      return;
    }

    // 如果内容较短且包含关键信息，创建问答卡
    if (contentUnit.content.length < 200) {
      await this.createQuickQACard(contentUnit);
      return;
    }

    // 如果内容较长，创建完形填空卡
    await this.createQuickClozeCard(contentUnit);
  }

  /**
   * 批量创建闪卡
   */
  async createBatchCards(
    contentUnits: ContentUnit[],
    type: 'qa' | 'cloze' | 'smart' = 'smart'
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const unit of contentUnits) {
      try {
        switch (type) {
          case 'qa':
            await this.createQuickQACard(unit);
            break;
          case 'cloze':
            await this.createQuickClozeCard(unit);
            break;
          case 'smart':
            await this.createSmartCard(unit);
            break;
        }
        success++;
      } catch (error) {
        console.error('Error creating card:', error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 判断文本是否是问题
   */
  private isQuestion(text: string): boolean {
    const questionWords = ['what', 'why', 'how', 'when', 'where', 'who', 'which'];
    const lowerText = text.toLowerCase().trim();
    
    // 以问号结尾
    if (lowerText.endsWith('?')) return true;
    
    // 以疑问词开头
    for (const word of questionWords) {
      if (lowerText.startsWith(word + ' ')) return true;
    }
    
    // 中文问句特征
    if (text.includes('什么') || text.includes('为什么') || 
        text.includes('怎么') || text.includes('如何') ||
        text.includes('吗？') || text.includes('呢？')) {
      return true;
    }
    
    return false;
  }

  /**
   * 生成默认问题
   */
  private generateDefaultQuestion(contentUnit: ContentUnit): string {
    // 如果有标题，使用标题生成问题
    if (contentUnit.source.heading) {
      const heading = contentUnit.source.heading.replace(/^#+\s*/, '');
      return `What is the key point about "${heading}"?`;
    }

    // 根据内容长度生成不同的问题
    if (contentUnit.content.length < 50) {
      return `What does "${contentUnit.content}" mean?`;
    } else if (contentUnit.content.length < 150) {
      const firstWords = contentUnit.content.substring(0, 30) + '...';
      return `Explain: "${firstWords}"`;
    } else {
      return `What are the key points in this content?`;
    }
  }

  /**
   * 提取关键词（用于完形填空）
   */
  private extractKeywords(text: string): Array<{ word: string; score: number }> {
    // 分词
    const words = text.match(/\b[A-Za-z]{3,}\b/g) || [];
    
    // 常见停用词
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
      'in', 'with', 'to', 'for', 'of', 'as', 'by', 'this', 'that',
      'from', 'they', 'we', 'say', 'her', 'she', 'he', 'will', 'my',
      'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out',
      'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make',
      'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people',
      'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other'
    ]);

    // 词频统计
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      const lower = word.toLowerCase();
      if (!stopWords.has(lower) && word.length > 3) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    });

    // 计算分数（考虑频率、长度、大写）
    const scored = Array.from(wordFreq.entries()).map(([word, freq]) => {
      let score = freq;
      
      // 长词加分
      if (word.length > 8) score += 2;
      else if (word.length > 6) score += 1;
      
      // 首字母大写加分（可能是专有名词）
      if (word[0] === word[0].toUpperCase()) score += 1;
      
      return { word, score };
    });

    // 排序并返回前3个关键词
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }
}