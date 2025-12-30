// extraction engine with deduplication
import { App, TFile, Notice, Editor, Menu } from 'obsidian';
import { DataManager, ContentUnit } from './DataManager';
import { FlashcardManager } from './FlashcardManager';
import { SidebarOverviewView } from '../ui/view/SidebarOverviewView';
import type LearningSystemPlugin from 'src/main';

export class ExtractionEngine {
  constructor(
    private app: App,
    private dataManager: DataManager,
    private flashcardManager: FlashcardManager ,
    private plugin?: LearningSystemPlugin 
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

      // 检查是否重复
      const existingUnit = await this.findDuplicateUnit(unit);
      if (existingUnit) {
        new Notice(`⚠️ This content was already extracted`);
        return;
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
      } else if (extractType === 'text') {
        // 🎯 纯文本提取也算作提取任务
        if (this.plugin?.unlockSystem) {
          await this.plugin.unlockSystem.onCardExtracted();
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
   * 🆕 查找重复的 ContentUnit
   * 根据文件路径和位置判断是否已存在
   */
  private async findDuplicateUnit(unit: ContentUnit): Promise<ContentUnit | null> {
    const allUnits = await this.dataManager.getAllContentUnits();
    
    // 检查是否存在相同位置的 unit
    const duplicate = allUnits.find(existing => 
      existing.source.file === unit.source.file &&
      existing.source.position.start === unit.source.position.start &&
      existing.source.position.end === unit.source.position.end &&
      existing.type === unit.type
    );
    
    return duplicate || null;
  }

  /**
   * 🆕 检查内容是否重复（基于内容相似度）
   */
  private isContentDuplicate(content1: string, content2: string): boolean {
    const normalized1 = content1.trim().toLowerCase();
    const normalized2 = content2.trim().toLowerCase();
    return normalized1 === normalized2;
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
            const view = leaf.view as SidebarOverviewView;
            if (view && typeof view.refresh === 'function') {
              view.refresh();
            }
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
   * 🔧 修改: 先保存 units，再创建闪卡，同时过滤重复项
   */
  private async extractContent(file: TFile, content: string): Promise<ContentUnit[]> {
    const units: ContentUnit[] = [];
    
    // 1️⃣ 先提取所有 units（不创建闪卡）
    const qaUnits = this.extractQACards(file, content);
    const clozeUnits = await this.extractClozeCards(file, content);

    const allExtractedUnits = [...qaUnits, ...clozeUnits];
    
    // 2️⃣ 🆕 过滤重复的 units
    const existingUnits = await this.dataManager.getAllContentUnits();
    const newUnits = await this.filterDuplicateUnits(allExtractedUnits, existingUnits);
    
    if (newUnits.length === 0) {
      new Notice(` ${file.name}: 没有新内容需要提取`);
      return [];
    }
    
    if (newUnits.length < allExtractedUnits.length) {
      const skipped = allExtractedUnits.length - newUnits.length;
      new Notice(` ${file.name}: 跳过 ${skipped} 个重复项`);
    }
    
    units.push(...newUnits);
    
    // 3️⃣ 先保存所有新 units 到 DataManager
    if (units.length > 0) {
      await this.dataManager.saveContentUnits(units);
    }
    
    // 4️⃣ 再为每个 unit 创建闪卡
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
   * 🆕 过滤重复的 units
   * 根据文件路径、位置和内容判断是否重复
   */
  private async filterDuplicateUnits(
    newUnits: ContentUnit[], 
    existingUnits: ContentUnit[]
  ): Promise<ContentUnit[]> {
    const filtered: ContentUnit[] = [];
    
    for (const newUnit of newUnits) {
      const isDuplicate = existingUnits.some(existing => {
        // 方式1: 相同文件 + 相同位置 + 相同类型
        const sameLocation = 
          existing.source.file === newUnit.source.file &&
          existing.source.position.start === newUnit.source.position.start &&
          existing.source.position.end === newUnit.source.position.end &&
          existing.type === newUnit.type;
        
        // 方式2: 相同文件 + 相同内容 + 相同类型（防止位置偏移）
        const sameContent = 
          existing.source.file === newUnit.source.file &&
          existing.type === newUnit.type &&
          this.isContentDuplicate(existing.content, newUnit.content) &&
          this.isContentDuplicate(existing.fullContext || '', newUnit.fullContext || '');
        
        // 方式3: 对于 QA 类型，额外检查答案是否相同
        const sameQA = existing.type === 'QA' && newUnit.type === 'QA' &&
          existing.source.file === newUnit.source.file &&
          this.isContentDuplicate(existing.content, newUnit.content) &&
          this.isContentDuplicate(existing.answer || '', newUnit.answer || '');
        
        return sameLocation || sameContent || sameQA;
      });
      
      if (!isDuplicate) {
        filtered.push(newUnit);
      }
    }
    
    return filtered;
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
        continue;
      }
      
      // ✅ 跳过日期时间字段
      if (this.isDateTimeField(question, answer)) {
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
  // private extractClozeCards(file: TFile, content: string): ContentUnit[] {
  //   const units: ContentUnit[] = [];
  //   const highlightRegex = /==(.+?)==/g;
  //   let match;

  //   while ((match = highlightRegex.exec(content)) !== null) {
  //     const extractedText = match[1];
  //     const fullMatch = match[0];
  //     const position = this.calculatePosition(content, match.index);
      
  //     // 获取当前行内容
  //     const lineStart = content.lastIndexOf('\n', match.index) + 1;
  //     const lineEnd = content.indexOf('\n', match.index);
  //     const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
      
  //     // ✅ 跳过 Excalidraw 高亮
  //     if (this.isExcalidrawHighlight(extractedText, currentLine)) {
  //       continue;
  //     }
      
  //     const fullSentence = this.extractFullSentence(content, match.index, fullMatch.length);

  //     const unit: ContentUnit = {
  //       id: this.generateId(),
  //       type: 'cloze',
  //       content: extractedText.trim(),
  //       fullContext: fullSentence,
  //       source: {
  //         file: file.path,
  //         position: {
  //           start: match.index,
  //           end: match.index + fullMatch.length,
  //           line: position.line
  //         },
  //         heading: this.findHeading(content, match.index),
  //         anchorLink: `[[${file.basename}#^${this.generateBlockId()}]]`
  //       },
  //       extractRule: {
  //         ruleId: 'cloze',
  //         ruleName: 'Cloze Deletion',
  //         extractedBy: 'auto'
  //       },
  //       metadata: {
  //         createdAt: Date.now(),
  //         updatedAt: Date.now(),
  //         tags: this.extractTags(content, match.index)
  //       },
  //       flashcardIds: []
  //     };

  //     units.push(unit);
  //   }

  //   return units;
  // }

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


// 表格提取方法
/**
 * 🆕 检测高亮是否在表格中
 */
private isInTable(content: string, position: number): boolean {
  const lines = content.split('\n');
  const { line } = this.calculatePosition(content, position);
  
  // 检查当前行是否为表格行（包含 | 分隔符）
  if (!lines[line]?.includes('|')) {
    return false;
  }
  
  // 检查前后行是否也是表格
  const hasPrevTableLine = line > 0 && lines[line - 1]?.includes('|');
  const hasNextTableLine = line < lines.length - 1 && lines[line + 1]?.includes('|');
  
  return hasPrevTableLine || hasNextTableLine;
}

/**
 * 🆕 提取表格及其高亮信息
 */
private extractTableWithHighlights(
  content: string, 
  highlightPosition: number
): { tableContent: string; highlightCount: number; highlightRows: Set<number>; highlightColumns: Set<number> } | null {
  const lines = content.split('\n');
  const { line: currentLine } = this.calculatePosition(content, highlightPosition);
  
  // 找到表格的起始和结束位置
  let tableStart = currentLine;
  let tableEnd = currentLine;
  
  // 向上查找表格开始
  while (tableStart > 0 && lines[tableStart - 1]?.includes('|')) {
    tableStart--;
  }
  
  // 向下查找表格结束
  while (tableEnd < lines.length - 1 && lines[tableEnd + 1]?.includes('|')) {
    tableEnd++;
  }
  
  // 提取表格内容
  const tableLines = lines.slice(tableStart, tableEnd + 1);
  const tableContent = tableLines.join('\n');
  
  // 统计表格中所有高亮
  const highlightRegex = /==(.+?)==/g;
  const highlightRows = new Set<number>();
  const highlightColumns = new Set<number>();
  let highlightCount = 0;
  
  tableLines.forEach((line, rowIndex) => {
    const cells = line.split('|').map(c => c.trim()).filter(c => c);
    
    // 🔧 改进分隔符行检测
    if (cells.length > 0 && cells.every(cell => /^[-:\s]+$/.test(cell))) {
      return; // 跳过分隔符行
    }
    
    cells.forEach((cell, colIndex) => {
      if (highlightRegex.test(cell)) {
        highlightRows.add(rowIndex);
        highlightColumns.add(colIndex);
        highlightCount++;
      }
    });
  });
  
  return {
    tableContent,
    highlightCount,
    highlightRows,
    highlightColumns
  };
}

/**
 * 🆕 根据高亮位置提取表格的特定部分
 */
private extractTablePortion(
  tableLines: string[], 
  highlightRows: Set<number>, 
  highlightColumns: Set<number>,
  highlightCount: number
): string {
  const totalRows = tableLines.length;
 // 🔧 改进分隔符行检测
 const separatorIndex = tableLines.findIndex((line, idx) => {
  if (idx === 0) return false; // 第一行不可能是分隔符
  const cells = line.split('|').map(c => c.trim()).filter(c => c);
  // 检查是否所有单元格都只包含 -、: 和空格
  return cells.length > 0 && cells.every(cell => /^[-:\s]+$/.test(cell));
});

// 如果没找到分隔符，假设第二行是分隔符
const actualSeparatorIndex = separatorIndex !== -1 ? separatorIndex : 1;
  
  // 情况1: 整列高亮 - 提取整个表格
  const firstDataRow = tableLines[separatorIndex + 1] || tableLines[1];
  const columnCount = firstDataRow.split('|').filter(c => c.trim()).length;
  
  if (highlightColumns.size === columnCount || highlightCount >= totalRows - 1) {
    return tableLines.join('\n');
  }
  
  // 情况2: 单行高亮 - 提取该行（包含表头和分隔符）
  if (highlightRows.size === 1) {
    const highlightRow = Array.from(highlightRows)[0];
    const result = [
      tableLines[0], // 表头
      tableLines[separatorIndex], // 分隔符
      tableLines[highlightRow] // 高亮行
    ];
    return result.join('\n');
  }
  
  // 情况3: 多行高亮 - 提取这些行
  const result = [tableLines[0], tableLines[separatorIndex]];
  highlightRows.forEach(rowIndex => {
    if (rowIndex !== 0 && rowIndex !== separatorIndex) {
      result.push(tableLines[rowIndex]);
    }
  });
  return result.join('\n');
}
private async extractClozeCards(file: TFile, content: string): Promise<ContentUnit[]> {
  const units: ContentUnit[] = [];
  const highlightRegex = /==(.+?)==/g;
  const processedTables = new Set<string>(); // 记录已处理的表格
  const processedHighlights = new Set<number>(); // 🆕 记录已处理的高亮位置
  let match;

  while ((match = highlightRegex.exec(content)) !== null) {
    const extractedText = match[1];
    const fullMatch = match[0];
    const position = this.calculatePosition(content, match.index);
    
    // 🆕 跳过已处理的高亮
    if (processedHighlights.has(match.index)) {
      continue;
    }
    
    // 获取当前行内容
    const lineStart = content.lastIndexOf('\n', match.index) + 1;
    const lineEnd = content.indexOf('\n', match.index);
    const currentLine = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
    
    // ✅ 跳过 Excalidraw 高亮
    if (this.isExcalidrawHighlight(extractedText, currentLine)) {
      continue;
    }
    
    // 🆕 检查是否在表格中
    if (this.isInTable(content, match.index)) {
      const tableInfo = this.extractTableWithHighlights(content, match.index);
      
      if (tableInfo) {
        const tableKey = `${file.path}-${tableInfo.tableContent.substring(0, 50)}`;
        
        // 避免重复处理同一个表格
        if (processedTables.has(tableKey)) {
          continue;
        }
        processedTables.add(tableKey);
        
        // 🆕 标记这个表格内的所有高亮为已处理
        const tableHighlights = this.findAllHighlightsInTable(content, tableInfo.tableContent, match.index);
        tableHighlights.forEach(pos => processedHighlights.add(pos));
        
        const lines = content.split('\n');
        const { line: currentLine } = this.calculatePosition(content, match.index);
        
        // 找到表格起始位置
        let tableStart = currentLine;
        while (tableStart > 0 && lines[tableStart - 1]?.includes('|')) {
          tableStart--;
        }
        
        const tableLines = tableInfo.tableContent.split('\n');
        const extractedTable = this.extractTablePortion(
          tableLines,
          tableInfo.highlightRows,
          tableInfo.highlightColumns,
          tableInfo.highlightCount
        );
        // 🔧 验证提取的表格是否包含分隔符行
const extractedLines = extractedTable.split('\n');
const hasSeparator = extractedLines.some(line => {
  const cells = line.split('|').map(c => c.trim()).filter(c => c);
  return cells.length > 0 && cells.every(cell => /^[-:\s]+$/.test(cell));
});

// 如果缺少分隔符行，自动添加
if (!hasSeparator && extractedLines.length >= 2) {
  const headerCells = extractedLines[0].split('|').map(c => c.trim()).filter(c => c);
  const separator = '| ' + headerCells.map(() => '---').join(' | ') + ' |';
  extractedLines.splice(1, 0, separator);
  const extractedTable = extractedLines.join('\n');
}
        // 计算表格在文档中的起始位置
        let tableStartOffset = 0;
        for (let i = 0; i < tableStart; i++) {
          tableStartOffset += lines[i].length + 1;
        }
        
        // 🆕 收集所有高亮内容
        const allHighlights = this.extractAllHighlightsFromTable(tableInfo.tableContent);
        
        const unit: ContentUnit = {
          id: this.generateId(),
          type: 'cloze',
          content: allHighlights.join(', '), // 🆕 包含所有高亮
          fullContext: extractedTable, // 显示提取的表格部分
          source: {
            file: file.path,
            position: {
              start: tableStartOffset,
              end: tableStartOffset + tableInfo.tableContent.length,
              line: tableStart
            },
            heading: this.findHeading(content, match.index),
            anchorLink: `[[${file.basename}#^${this.generateBlockId()}]]`
          },
          extractRule: {
            ruleId: 'cloze-table',
            ruleName: 'Table Cloze Deletion',
            extractedBy: 'auto'
          },
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            tags: [...this.extractTags(content, match.index), '#table'],
            customData: {
              tableType: 'partial',
              highlightCount: tableInfo.highlightCount,
              rowCount: tableInfo.highlightRows.size,
              columnCount: tableInfo.highlightColumns.size,
              allHighlights: allHighlights // 🆕 保存所有高亮
            }
          },
          flashcardIds: []
        };
        
        units.push(unit);

// 🎯 解锁系统检查点 - 扫描到表格
if (this.plugin?.unlockSystem) {
  await this.plugin.unlockSystem.onTableScanned();
}
        continue;
      }
    }
    
    // 原有的普通高亮处理逻辑...
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

// 🆕 添加辅助方法:找到表格内所有高亮的位置
private findAllHighlightsInTable(
  content: string, 
  tableContent: string, 
  currentHighlightPos: number
): number[] {
  const positions: number[] = [];
  const lines = content.split('\n');
  const { line: currentLine } = this.calculatePosition(content, currentHighlightPos);
  
  // 找到表格范围
  let tableStart = currentLine;
  let tableEnd = currentLine;
  
  while (tableStart > 0 && lines[tableStart - 1]?.includes('|')) {
    tableStart--;
  }
  while (tableEnd < lines.length - 1 && lines[tableEnd + 1]?.includes('|')) {
    tableEnd++;
  }
  
  // 计算表格起始偏移
  let offset = 0;
  for (let i = 0; i < tableStart; i++) {
    offset += lines[i].length + 1;
  }
  
  // 在表格范围内查找所有高亮
  const highlightRegex = /==(.+?)==/g;
  let match;
  const tableEndOffset = offset + tableContent.length;
  
  while ((match = highlightRegex.exec(content)) !== null) {
    if (match.index >= offset && match.index < tableEndOffset) {
      positions.push(match.index);
    }
  }
  
  return positions;
}

// 🆕 添加辅助方法:提取表格中所有高亮内容
private extractAllHighlightsFromTable(tableContent: string): string[] {
  const highlights: string[] = [];
  const highlightRegex = /==(.+?)==/g;
  let match;
  
  while ((match = highlightRegex.exec(tableContent)) !== null) {
    highlights.push(match[1].trim());
  }
  
  return highlights;
}

}