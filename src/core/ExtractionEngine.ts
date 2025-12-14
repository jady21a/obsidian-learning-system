import { App, TFile, Notice, Editor, Menu } from 'obsidian';
import { DataManager, ContentUnit } from './DataManager';

export class ExtractionEngine {
  constructor(
    private app: App,
    private dataManager: DataManager
  ) {}

  /**
   * 注册右键菜单
   */
  registerContextMenu(menu: Menu, editor: Editor, file: TFile) {
    const selection = editor.getSelection();
    console.log('Context menu triggered, selection:', selection);
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

      await this.dataManager.saveContentUnits([unit]);
      
      const typeNames = {
        text: 'text',
        QA: 'QA card',
        cloze: 'cloze card'
      };
      
      new Notice(`✅ Extracted as ${typeNames[extractType]}`);
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
      offset += lines[i].length + 1; // +1 for newline
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
      const units = this.extractContent(file, content);
      
      if (units.length > 0) {
        await this.dataManager.saveContentUnits(units);
        const QACount = units.filter(u => u.type === 'QA').length;
        const clozeCount = units.filter(u => u.type === 'cloze').length;
        new Notice(`Extracted ${QACount} QA cards and ${clozeCount} cloze cards from ${file.name}`);
      } else {
        new Notice(`No cards found in ${file.name}`);
      }
      
      return units.length;
    } catch (error) {
      console.error('Error scanning file:', error);
      new Notice(`Error scanning file: ${error.message}`);
      return 0;
    }
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
   * 提取所有类型的内容（QA 和 Cloze）
   */
  private extractContent(file: TFile, content: string): ContentUnit[] {
    const units: ContentUnit[] = [];
    
    // 提取 QA 卡片
    units.push(...this.extractQACards(file, content));
    
    // 提取完形填空卡
    units.push(...this.extractClozeCards(file, content));
    
    return units;
  }

  /**
   * 提取 QA 卡片 (格式: Question :: Answer)
   */
  private extractQACards(file: TFile, content: string): ContentUnit[] {
    const units: ContentUnit[] = [];
    const QARegex = /^(.+?)\s*::\s*(.+?)$/gm;
    let match;

    while ((match = QARegex.exec(content)) !== null) {
      const question = match[1].trim();
      const answer = match[2].trim();
      const position = this.calculatePosition(content, match.index);

      const unit: ContentUnit = {
        id: this.generateId(),
        type: 'QA',
        content: question,
        answer: answer,
        fullContext: match[0],
        source: {
          file: file.path,
          position: {
            start: match.index,
            end: match.index + match[0].length,
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
   * 提取完形填空卡 (格式: ==highlight==)
   */
  private extractClozeCards(file: TFile, content: string): ContentUnit[] {
    const units: ContentUnit[] = [];
    const highlightRegex = /==(.+?)==/g;
    let match;

    while ((match = highlightRegex.exec(content)) !== null) {
      const extractedText = match[1];
      const position = this.calculatePosition(content, match.index);
      const fullSentence = this.extractFullSentence(content, match.index, match[0].length);

      const unit: ContentUnit = {
        id: this.generateId(),
        type: 'cloze',
        content: extractedText.trim(),
        fullContext: fullSentence,
        source: {
          file: file.path,
          position: {
            start: match.index,
            end: match.index + match[0].length,
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
    // 句子结束符
    const sentenceEnds = /[.!?。！？\n]/;
    
    // 向前找句子开头
    let start = highlightStart;
    while (start > 0) {
      const char = content[start - 1];
      if (sentenceEnds.test(char)) {
        break;
      }
      start--;
    }
    
    // 向后找句子结尾
    let end = highlightStart + highlightLength;
    while (end < content.length) {
      const char = content[end];
      if (sentenceEnds.test(char)) {
        end++; // 包含结束符
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
      // 匹配 tags: [tag1, tag2] 或 tags: tag1
      const tagsMatch = yamlContent.match(/^tags:\s*(.+)$/m);
      if (tagsMatch) {
        const tagContent = tagsMatch[1].trim();
        // 处理数组格式 [tag1, tag2]
        if (tagContent.startsWith('[')) {
          const arrayTags = tagContent.match(/[\w/-]+/g);
          arrayTags?.forEach(tag => tags.add(`#${tag}`));
        } else {
          // 处理单个 tag 或逗号分隔
          tagContent.split(',').forEach(tag => {
            const cleaned = tag.trim();
            if (cleaned) tags.add(`#${cleaned}`);
          });
        }
      }
    }
    
    // 2. 提取句子末尾的 inline tags
    // 找到当前高亮所在的行
    const lines = content.substring(0, position).split('\n');
    const currentLine = lines.length - 1;
    const lineContent = content.split('\n')[currentLine] || '';
    
    // 匹配支持多级路径的 tag: #tag 或 #tag/subtag/subsubtag
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