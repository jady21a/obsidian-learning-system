import { App, TFile, Notice, Editor, Menu } from 'obsidian';
import { DataManager, ContentUnit } from './DataManager';
import { FlashcardManager } from './FlashcardManager';

export class ExtractionEngine {
  constructor(
    private app: App,
    private dataManager: DataManager,
    private flashcardManager: FlashcardManager 
  ) {}

  /**
   * 注册右键菜单
   */
  registerContextMenu(menu: Menu, editor: Editor, file: TFile) {
    const selection = editor.getSelection();
    if (!selection) return;

    menu.addItem((item) => {
      item
        .setTitle('📝 Extract as text only')
        .setIcon('file-text')
        .onClick(async () => {
          await this.extractSelectedText(editor, file, 'text');
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('❓ Extract as QA card')
        .setIcon('help-circle')
        .onClick(async () => {
          await this.extractSelectedText(editor, file, 'QA');
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('✏️ Extract as Cloze card')
        .setIcon('highlighter')
        .onClick(async () => {
          await this.extractSelectedText(editor, file, 'cloze');
        });
    });
  }

  /**
   * 提取选中的文本
   */
  private async extractSelectedText(
    editor: Editor, 
    file: TFile, 
    extractType: 'text' | 'QA' | 'cloze'
  ): Promise<void> {
    const selection = editor.getSelection();
    if (!selection) {
      new Notice('No text selected');
      return;
    }

    const cursor = editor.getCursor('from');
    const content = await this.app.vault.read(file);
    const offset = this.getOffsetFromCursor(content, cursor.line, cursor.ch);

    try {
      let unit: ContentUnit;

      switch (extractType) {
        case 'text':
          unit = this.createTextUnit(file, selection, offset, content);
          break;
        case 'QA':
          unit = this.createQAUnit(file, selection, offset, content);
          break;
        case 'cloze':
          unit = this.createClozeUnit(file, selection, offset, content);
          break;
      }

      // 1. 先保存 ContentUnit
      await this.dataManager.saveContentUnits([unit]);
      
      // 2. 如果是 QA 或 cloze，创建闪卡
      if (extractType === 'QA' || extractType === 'cloze') {
        try {
          const cardType = extractType === 'QA' ? 'qa' : 'cloze';
          const flashcard = await this.flashcardManager.createFlashcardFromUnit(unit, {
            cardType: cardType
          });
          
          // 3. 再次保存 unit（更新 flashcardIds）
          await this.dataManager.saveContentUnits([unit]);
          
        } catch (error) {
          console.error('[extractSelectedText] 创建闪卡失败:', error);
        }
      }
      
      const typeNames = {
        text: 'text',
        QA: 'QA card',
        cloze: 'cloze card'
      };
      
      new Notice(`✅ Extracted as ${typeNames[extractType]}`);
      
      // 4. 刷新所有视图
      this.refreshAllViews();
      
    } catch (error) {
      console.error('Error extracting selection:', error);
      new Notice(`❌ Error: ${error.message}`);
    }
  }

  /**
   * 创建纯文本单元
   */
  private createTextUnit(
    file: TFile,
    selection: string,
    offset: number,
    fileContent: string
  ): ContentUnit {
    const position = this.calculatePosition(fileContent, offset);

    return {
      id: this.generateId(),
      type: 'text',
      content: selection.trim(),
      fullContext: selection.trim(),
      source: {
        file: file.path,
        position: {
          start: offset,
          end: offset + selection.length,
          line: position.line
        },
        heading: this.findHeading(fileContent, offset),
        anchorLink: `[[${file.basename}#^${this.generateBlockId()}]]`
      },
      extractRule: {
        ruleId: 'text-manual',
        ruleName: 'Manual Text Extract',
        extractedBy: 'manual'
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: this.extractTags(fileContent, offset)
      },
      flashcardIds: []
    };
  }

  /**
   * 创建 QA 卡片单元
   */
  private createQAUnit(
    file: TFile,
    selection: string,
    offset: number,
    fileContent: string
  ): ContentUnit {
    const position = this.calculatePosition(fileContent, offset);
    
    // 尝试分割成问题和答案
    let question: string, answer: string;
    
    if (selection.includes('::')) {
      // 如果包含 :: 分隔符
      const parts = selection.split('::');
      question = parts[0].trim();
      answer = parts.slice(1).join('::').trim();
    } else {
      // 否则整个选中文本作为问题，答案为空（需要用户补充）
      question = selection.trim();
      answer = '[Answer needed]';
    }

    return {
      id: this.generateId(),
      type: 'QA',
      content: question,
      answer: answer,
      fullContext: selection.trim(),
      source: {
        file: file.path,
        position: {
          start: offset,
          end: offset + selection.length,
          line: position.line
        },
        heading: this.findHeading(fileContent, offset),
        anchorLink: `[[${file.basename}#^${this.generateBlockId()}]]`
      },
      extractRule: {
        ruleId: 'QA-manual',
        ruleName: 'Manual QA Card',
        extractedBy: 'manual'
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: this.extractTags(fileContent, offset)
      },
      flashcardIds: []
    };
  }

  /**
   * 创建完形填空卡片单元
   */
  private createClozeUnit(
    file: TFile,
    selection: string,
    offset: number,
    fileContent: string
  ): ContentUnit {
    const position = this.calculatePosition(fileContent, offset);
    const fullSentence = this.extractFullSentence(fileContent, offset, selection.length);

    return {
      id: this.generateId(),
      type: 'cloze',
      content: selection.trim(),
      fullContext: fullSentence,
      source: {
        file: file.path,
        position: {
          start: offset,
          end: offset + selection.length,
          line: position.line
        },
        heading: this.findHeading(fileContent, offset),
        anchorLink: `[[${file.basename}#^${this.generateBlockId()}]]`
      },
      extractRule: {
        ruleId: 'cloze-manual',
        ruleName: 'Manual Cloze Card',
        extractedBy: 'manual'
      },
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: this.extractTags(fileContent, offset)
      },
      flashcardIds: []
    };
  }

  /**
   * 从光标位置计算文件偏移量
   */
  private getOffsetFromCursor(content: string, line: number, ch: number): number {
    const lines = content.split('\n');
    let offset = 0;
    
    for (let i = 0; i < line; i++) {
      offset += lines[i].length + 1;
    }
    
    offset += ch;
    return offset;
  }

  /**
   * 扫描单个文件
   */
  async scanFile(file: TFile): Promise<number> {
    try {
      const content = await this.app.vault.read(file);
      const units = await this.extractContent(file, content);
      
      if (units.length > 0) {
        await this.dataManager.saveContentUnits(units);
        
        const qaCount = units.filter(u => u.type === 'QA').length;
        const clozeCount = units.filter(u => u.type === 'cloze').length;
        new Notice(`Extracted ${qaCount} QA cards and ${clozeCount} cloze cards from ${file.name}`);
        
        setTimeout(() => {
          this.refreshAllViews();
        }, 100);
      }
      
      return units.length;
    } catch (error) {
      console.error('[scanFile] 错误:', error);
      new Notice(`Error scanning file: ${error.message}`);
      return 0;
    }
  }
  
  /**
   * 刷新所有相关视图
   */
  private refreshAllViews() {
    this.app.workspace.iterateAllLeaves(leaf => {
      const viewType = leaf.view.getViewType();
      if (viewType === 'learning-system-sidebar-overview' || 
          viewType === 'learning-system-main-overview') {
        (leaf.view as any).refresh();
      }
    });
  }

  /**
   * 扫描整个 Vault
   */
  async scanVault(): Promise<{ scanned: number; extracted: number }> {
    const files = this.app.vault.getMarkdownFiles();
    let scanned = 0;
    let extracted = 0;

    new Notice(`Scanning ${files.length} files...`);

    for (const file of files) {
      const count = await this.scanFile(file);
      scanned++;
      extracted += count;
    }

    new Notice(`Scan complete! Extracted ${extracted} items from ${scanned} files.`);

    return { scanned, extracted };
  }

  /**
   * 🔧 修改: 先保存 units，再创建闪卡
   */
  private async extractContent(file: TFile, content: string): Promise<ContentUnit[]> {
    const units: ContentUnit[] = [];
    
    // 1️⃣ 先提取所有 units（不创建闪卡）
    const qaUnits = this.extractQACards(file, content);
    units.push(...qaUnits);
    
    const clozeUnits = this.extractClozeCards(file, content);
    units.push(...clozeUnits);
    
    // 2️⃣ 先保存所有 units 到 DataManager
    if (units.length > 0) {
      await this.dataManager.saveContentUnits(units);
    }
    
    // 3️⃣ 再为每个 unit 创建闪卡
    for (const unit of units) {
      try {
        const cardType = unit.type === 'QA' ? 'qa' : 'cloze';
        const flashcard = await this.flashcardManager.createFlashcardFromUnit(unit, {
          cardType: cardType
        });
      } catch (error) {
        console.error('[extractContent] 创建闪卡失败:', error);
      }
    }
    
    return units;
  }

  /**
   * ✅ 检查是否为任务完成标记
   * 排除: [completion:: date], [due:: date] 等任务相关的 :: 格式
   */
  private isTaskCompletion(line: string): boolean {
    // 匹配任务标记: - [ ] 或 - [x] 开头的行,且包含 :: 
    const taskPattern = /^[\s]*-\s*\[[x\s]\].*::/i;
    return taskPattern.test(line);
  }

  /**
   * ✅ 检查是否为日期/时间字段
   * 排除: date1:: 2021-02-26T15:15, date2:: 2021-04-17 18:00 等格式
   */
  private isDateTimeField(question: string, answer: string): boolean {
    // 检查问题部分是否包含常见的日期/时间字段名
    const dateFieldPattern = /\b(date\d*|time\d*|created|updated|modified|scheduled|due|completion)\b/i;
    
    // 检查答案部分是否为日期/时间格式
    const dateTimePattern = /^\s*\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}|\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/;
    const dateOnlyPattern = /^\s*\d{4}-\d{2}-\d{2}\s*$/;
    
    return dateFieldPattern.test(question) && 
           (dateTimePattern.test(answer) || dateOnlyPattern.test(answer));
  }

  /**
   * ✅ 检查是否为 Excalidraw 高亮
   * 排除: ==switch to excalidraw view...== 这类特定高亮
   */
  private isExcalidrawHighlight(matchText: string, line: string): boolean {
    // 如果高亮内容包含 excalidraw 相关关键词
    const excalidrawKeywords = /excalidraw|drawing|sketch/i;
    return excalidrawKeywords.test(matchText) || excalidrawKeywords.test(line);
  }

  /**
   * ✅ 提取 QA 卡片 (格式: Question :: Answer)
   * 新增: 过滤任务完成标记和日期时间字段
   */
  private extractQACards(file: TFile, content: string): ContentUnit[] {
    const units: ContentUnit[] = [];
    const qaRegex = /^(.+?)\s*::\s*(.+?)$/gm;
    let match;

    while ((match = qaRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const question = match[1].trim();
      const answer = match[2].trim();
      
      // ✅ 跳过任务完成标记
      if (this.isTaskCompletion(fullMatch)) {
        console.log('[extractQACards] 跳过任务标记:', fullMatch);
        continue;
      }
      
      // ✅ 跳过日期时间字段
      if (this.isDateTimeField(question, answer)) {
        console.log('[extractQACards] 跳过日期时间字段:', fullMatch);
        continue;
      }
      
      const position = this.calculatePosition(content, match.index);

      const unit: ContentUnit = {
        id: this.generateId(),
        type: 'QA',
        content: question,
        answer: answer,
        fullContext: fullMatch,
        source: {
          file: file.path,
          position: {
            start: match.index,
            end: match.index + fullMatch.length,
            line: position.line
          },
          heading: this.findHeading(content, match.index),
          anchorLink: `[[${file.basename}#^${this.generateBlockId()}]]`
        },
        extractRule: {
          ruleId: 'QA',
          ruleName: 'QA Card',
          extractedBy: 'auto'
        },
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: this.extractTags(content, match.index)
        },
        flashcardIds: []
      };

      units.push(unit);
    }

    return units;
  }

  /**
   * ✅ 提取完形填空卡 (格式: ==highlight==)
   * 新增: 过滤 Excalidraw 高亮
   */
  private extractClozeCards(file: TFile, content: string): ContentUnit[] {
    const units: ContentUnit[] = [];
    const highlightRegex = /==(.+?)==/g;
    let match;

    while ((match = highlightRegex.exec(content)) !== null) {
      const extractedText = match[1];
      const fullMatch = match[0];
      const position = this.calculatePosition(content, match.index);
      
      // 获取当前行内容
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineEnd = content.indexOf('\n', match.index);
      const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
      
      // ✅ 跳过 Excalidraw 高亮
      if (this.isExcalidrawHighlight(extractedText, currentLine)) {
        console.log('[extractClozeCards] 跳过 Excalidraw 高亮:', extractedText);
        continue;
      }
      
      const fullSentence = this.extractFullSentence(content, match.index, fullMatch.length);

      const unit: ContentUnit = {
        id: this.generateId(),
        type: 'cloze',
        content: extractedText.trim(),
        fullContext: fullSentence,
        source: {
          file: file.path,
          position: {
            start: match.index,
            end: match.index + fullMatch.length,
            line: position.line
          },
          heading: this.findHeading(content, match.index),
          anchorLink: `[[${file.basename}#^${this.generateBlockId()}]]`
        },
        extractRule: {
          ruleId: 'cloze',
          ruleName: 'Cloze Deletion',
          extractedBy: 'auto'
        },
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          tags: this.extractTags(content, match.index)
        },
        flashcardIds: []
      };

      units.push(unit);
    }

    return units;
  }

  /**
   * 提取包含高亮的完整句子
   */
  private extractFullSentence(content: string, highlightStart: number, highlightLength: number): string {
    const sentenceEnds = /[.!?。！?\n]/;
    
    let start = highlightStart;
    while (start > 0) {
      const char = content[start - 1];
      if (sentenceEnds.test(char)) {
        break;
      }
      start--;
    }
    
    let end = highlightStart + highlightLength;
    while (end < content.length) {
      const char = content[end];
      if (sentenceEnds.test(char)) {
        end++;
        break;
      }
      end++;
    }
    
    return content.substring(start, end).trim();
  }

  /**
   * 计算文本位置
   */
  private calculatePosition(content: string, offset: number): { line: number; column: number } {
    const lines = content.substring(0, offset).split('\n');
    return {
      line: lines.length - 1,
      column: lines[lines.length - 1].length
    };
  }

  /**
   * 查找所在标题
   */
  private findHeading(content: string, position: number): string | undefined {
    const beforeContent = content.substring(0, position);
    const headings = beforeContent.match(/^#{1,6} .+$/gm);
    return headings ? headings[headings.length - 1] : undefined;
  }

  /**
   * 提取附近的标签
   */
  private extractTags(content: string, position: number): string[] {
    const tags = new Set<string>();
    
    // 1. 提取 YAML frontmatter 中的 tags
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (yamlMatch) {
      const yamlContent = yamlMatch[1];
      const tagsMatch = yamlContent.match(/^tags:\s*(.+)$/m);
      if (tagsMatch) {
        const tagContent = tagsMatch[1].trim();
        if (tagContent.startsWith('[')) {
          const arrayTags = tagContent.match(/[\w/-]+/g);
          arrayTags?.forEach(tag => tags.add(`#${tag}`));
        } else {
          tagContent.split(',').forEach(tag => {
            const cleaned = tag.trim();
            if (cleaned) tags.add(`#${cleaned}`);
          });
        }
      }
    }
    
    // 2. 提取句子末尾的 inline tags
    const lines = content.substring(0, position).split('\n');
    const currentLine = lines.length - 1;
    const lineContent = content.split('\n')[currentLine] || '';
    
    const inlineTagRegex = /#[\w/-]+/g;
    const inlineTags = lineContent.match(inlineTagRegex);
    inlineTags?.forEach(tag => tags.add(tag));
    
    return Array.from(tags);
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成 Block ID
   */
  private generateBlockId(): string {
    return `extract-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }
}