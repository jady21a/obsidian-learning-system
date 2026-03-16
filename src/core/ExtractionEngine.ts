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
        .setTitle('Extract as text only')
        .setIcon('file-text')
        .onClick(async () => {
          await this.extractSelectedText(editor, file, 'text');
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('Extract as Q&A card')
        .setIcon('help-circle')
        .onClick(async () => {
          await this.extractSelectedText(editor, file, 'QA');
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('Extract as cloze card')
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
        new Notice(`This content was already extracted`);
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
              // 🎯 添加解锁系统调用
    if (this.plugin?.unlockSystem) {
      if (extractType === 'QA') {
        await this.plugin.unlockSystem.onNoteExtractedAsQA();
      } else {
        await this.plugin.unlockSystem.onNoteExtractedAsCloze();
      }
    }

          // 3. 再次保存 unit（更新 flashcardIds）
          await this.dataManager.saveContentUnits([unit]);
          
        } catch (error) {
          console.error('[extractSelectedText] Failed to create flashcard:', error);
        }
      } else if (extractType === 'text') {
        // 🎯 纯文本提取也算作提取任务
        if (this.plugin?.unlockSystem) {
          await this.plugin.unlockSystem.onNoteExtractedAsText(); 
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
      content: selection.replace(/^\n+|\n+$/g, ''),
      fullContext: selection.replace(/^\n+|\n+$/g, ''),
      
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
      content: selection.replace(/^\n+|\n+$/g, ''),
      fullContext: selection.replace(/^\n+|\n+$/g, ''),
      
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
        // await this.dataManager.saveContentUnits(units);
        
        const qaCount = units.filter(u => u.type === 'QA').length;
        const clozeCount = units.filter(u => u.type === 'cloze').length;
        new Notice(`Extracted ${qaCount} QA cards and ${clozeCount} cloze cards from ${file.name}`);
        
        setTimeout(() => {
          this.refreshAllViews();
        }, 100);
      }
      
      return units.length;
    } catch (error) {
      console.error('[scanFile] Error:', error);
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
      new Notice(` ${file.name}: No new content to extract`);
      return [];
    }
    
    if (newUnits.length < allExtractedUnits.length) {
      const skipped = allExtractedUnits.length - newUnits.length;
      new Notice(` ${file.name}:Skipped ${skipped} duplicate items`);
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
        console.error('[extractContent]  Failed to create flashcard:', error);
      }
    }
    // 🎯 添加 - 统计扫描提取的笔记数
if (this.plugin?.unlockSystem && units.length > 0) {
  for (let i = 0; i < units.length; i++) {
    await this.plugin.unlockSystem.onNoteScanned();
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
    
    const tableClozeExisting = existingUnits.filter(
      u => u.extractRule?.ruleId === 'cloze-table' && u.source.file === newUnits[0]?.source.file
    );
    console.log('[dedup] existing cloze-table units:', 
      JSON.stringify(tableClozeExisting.map(u => ({ 
        id: u.id, 
        content: u.content, 
        allHighlights: u.metadata?.customData?.allHighlights 
      })))
    );
    console.log('[dedup] new cloze-table units:', 
      JSON.stringify(newUnits.filter(u => u.extractRule?.ruleId === 'cloze-table')
        .map(u => ({ content: u.content, allHighlights: u.metadata?.customData?.allHighlights })))
    );
    for (const newUnit of newUnits) {
      // 🆕 表格合并逻辑：同一表格时，合并而非新建
      if (newUnit.extractRule?.ruleId === 'cloze-table') {
        
        type RowData = { key: string; highlights: string[] };
        const rebuildContext = (originalContext: string, keepRows: RowData[]): string => {
          const lines = originalContext.split('\n');
          const header = lines[0] || '';
          const separator = lines[1] || '';
          const keepKeys = new Set(keepRows.map(r => r.key));
          const dataLines = lines.slice(2).filter(l =>
            keepKeys.has(l.replace(/==(.+?)==/g, '$1').trim())
          );
          return [header, separator, ...dataLines].join('\n');
        };
        const newTableKey = newUnit.metadata.customData?.tableKey as string | undefined;
        const existingTableUnits = existingUnits.filter(u => {
          if (u.type !== 'cloze' || u.extractRule?.ruleId !== 'cloze-table') return false;
          if (u.source.file !== newUnit.source.file) return false;
          const existingKey = u.metadata.customData?.tableKey as string | undefined;
          if (newTableKey && existingKey) return existingKey === newTableKey;
          return u.source.position.start === newUnit.source.position.start;
        });
      
        const newRows = (newUnit.metadata.customData?.rows as RowData[]) || [];
        const hasRowData = existingTableUnits.some(u => u.metadata.customData?.rows);
      
        let trulyNewRows: RowData[] = [];
      
        if (hasRowData) {
          // ✅ 新格式：按行去重，每行独立比较自己的高亮
          const existingRowHighlights = new Map<string, Set<string>>();
          for (const u of existingTableUnits) {
            for (const r of ((u.metadata.customData?.rows as RowData[]) || [])) {
              if (!existingRowHighlights.has(r.key)) {
                existingRowHighlights.set(r.key, new Set());
              }
              r.highlights.forEach(h => existingRowHighlights.get(r.key)!.add(h));
            }
          }
          for (const row of newRows) {
            const existingHl = existingRowHighlights.get(row.key) || new Set();
            const newHl = row.highlights.filter(h => !existingHl.has(h));
            if (newHl.length > 0) {
              trulyNewRows.push({ key: row.key, highlights: newHl });
            }
          }
        } else {
          // ⬇️ 旧数据兼容：全表文本去重
          const existingHighlightsSet = new Set<string>(
            existingTableUnits.flatMap(u =>
              (u.metadata.customData?.allHighlights as string[]) || []
            )
          );
          const allNewHighlights = newRows.flatMap(r => r.highlights);
          const trulyNew = allNewHighlights.filter(h => !existingHighlightsSet.has(h));
          if (trulyNew.length === 0) continue;
      
          const chunkUnit: ContentUnit = {
            ...newUnit,
            id: this.generateId(),
            content: trulyNew.join(', '),
            fullContext: newUnit.fullContext,
            metadata: {
              ...newUnit.metadata,
              customData: {
                ...newUnit.metadata.customData,
                allHighlights: trulyNew,
                highlightCount: trulyNew.length,
                chunkIndex: existingTableUnits.length
              }
            },
            flashcardIds: []
          };
          filtered.push(chunkUnit);
          existingUnits.push(chunkUnit);
          continue;
        }
      
      
        if (trulyNewRows.length === 0) continue;

        const rowChunkSize = 6;
        
        // 找最后一个已有 chunk，检查是否未满
        const sortedExisting = [...existingTableUnits]
        .sort((a, b) => (Number(a.metadata.customData?.chunkIndex) || 0) - (Number(b.metadata.customData?.chunkIndex) || 0));
      const lastExistingUnit: ContentUnit | undefined = sortedExisting[sortedExisting.length - 1];
      const lastExistingRows: RowData[] = (lastExistingUnit?.metadata.customData?.rows as RowData[]) ?? [];     const lastChunkRemainingSlots = lastExistingRows.length < rowChunkSize
          ? rowChunkSize - lastExistingRows.length
          : 0;
        
        let rowsToProcess = [...trulyNewRows];
        
        // 如果最后一个 chunk 未满，先填满它
        if (lastChunkRemainingSlots > 0 && lastExistingUnit) {
          const fillRows = rowsToProcess.splice(0, lastChunkRemainingSlots);
          const mergedRows = [...lastExistingRows, ...fillRows];
          const mergedHighlights = mergedRows.flatMap(r => r.highlights);
          lastExistingUnit.metadata.customData = {
            ...lastExistingUnit.metadata.customData,
            rows: mergedRows,
            allHighlights: mergedHighlights,
            highlightCount: mergedHighlights.length,
            rowCount: mergedRows.length,
          };
          lastExistingUnit.content = mergedHighlights.join(', ');
          lastExistingUnit.fullContext = rebuildContext(newUnit.fullContext || '', mergedRows);
          lastExistingUnit.metadata.updatedAt = Date.now();
          await this.dataManager.saveContentUnits([lastExistingUnit]);
        }
        
        // 剩余的按 6 行一组新建 chunk
        for (let i = 0; i < rowsToProcess.length; i += rowChunkSize) {
          const chunk = rowsToProcess.slice(i, i + rowChunkSize);
          const chunkHighlights = chunk.flatMap(r => r.highlights);
          const chunkUnit: ContentUnit = {
            ...newUnit,
            id: this.generateId(),
            content: chunkHighlights.join(', '),
            fullContext: rebuildContext(newUnit.fullContext || '', chunk),
            metadata: {
              ...newUnit.metadata,
              customData: {
                ...newUnit.metadata.customData,
                rows: chunk,
                allHighlights: chunkHighlights,
                highlightCount: chunkHighlights.length,
                rowCount: chunk.length,
                chunkIndex: existingTableUnits.length + Math.floor(i / rowChunkSize)
              }
            },
            flashcardIds: []
          };
          filtered.push(chunkUnit);
          existingUnits.push(chunkUnit); // 防止同次 scan 内自我重复
        }
        continue;
      }
  // 非表格 cloze：同一句子有新高亮时合并
  if (newUnit.type === 'cloze' && newUnit.extractRule?.ruleId === 'cloze') {
    const stripMarkers = (s: string) => s.replace(/==(.+?)==/g, '$1').trim();
    const newNormalized = stripMarkers(newUnit.fullContext || '');
  
    const sameSentenceUnit = existingUnits.find(existing =>
      existing.type === 'cloze' &&
      existing.extractRule?.ruleId === 'cloze' &&
      existing.source.file === newUnit.source.file &&
      existing.source.position.line === newUnit.source.position.line
    );

  if (sameSentenceUnit) {
    const existingHighlights = sameSentenceUnit.content.split(', ').map(s => s.trim()).filter(Boolean);
    const newHighlights = newUnit.content.split(', ').map(s => s.trim()).filter(Boolean);
    const merged = Array.from(new Set([...existingHighlights, ...newHighlights]));

    if (merged.length > existingHighlights.length) {
      sameSentenceUnit.content = merged.join(', ');
      sameSentenceUnit.fullContext = newUnit.fullContext; // 含最新 == 标记
      sameSentenceUnit.source.position.start = newUnit.source.position.start; // 同步偏移
      sameSentenceUnit.source.position.end = newUnit.source.position.end;
      sameSentenceUnit.metadata.updatedAt = Date.now();
      await this.dataManager.saveContentUnits([sameSentenceUnit]);
    }
    continue; // 无论是否有新增，都不新建 unit
  }
}

      const isDuplicate = existingUnits.some(existing => {
        // 方式1: 相同文件 + 相同位置 + 相同类型（排除表格 cloze）
        const sameLocation = 
          existing.source.file === newUnit.source.file &&
          existing.source.position.start === newUnit.source.position.start &&
          existing.source.position.end === newUnit.source.position.end &&
          existing.type === newUnit.type &&
          !(existing.extractRule?.ruleId === 'cloze-table' && newUnit.extractRule?.ruleId === 'cloze-table');
        
        // 方式2: 相同文件 + 相同内容 + 相同类型（排除表格 cloze）
        const stripMarkers = (s: string) => s.replace(/==(.+?)==/g, '$1').trim();

        const sameContent = 
          existing.source.file === newUnit.source.file &&
          existing.type === newUnit.type &&
          existing.extractRule?.ruleId !== 'cloze-table' &&
          (
            (this.isContentDuplicate(existing.content, newUnit.content) &&
             this.isContentDuplicate(existing.fullContext || '', newUnit.fullContext || '')) ||
            // 同行新增高亮后 fullContext 原文相同但标记不同的情况
            (existing.type === 'cloze' && 
             existing.source.position.line === newUnit.source.position.line)
            );
        // 方式3: 对于 QA 类型，额外检查答案是否相同
        const sameQA = existing.type === 'QA' && newUnit.type === 'QA' &&
          existing.source.file === newUnit.source.file &&
          this.isContentDuplicate(existing.content, newUnit.content) &&
          this.isContentDuplicate(existing.answer || '', newUnit.answer || '');
        
        // 方式4: 手动提取覆盖自动提取（排除表格 cloze）
        const coveredByManual =
          existing.source.file === newUnit.source.file &&
          existing.extractRule?.extractedBy === 'manual' &&
          newUnit.extractRule?.ruleId !== 'cloze-table' &&
          existing.source.position.start <= newUnit.source.position.start &&
          existing.source.position.end >= newUnit.source.position.end;
  
        // 方式5: 表格 cloze 按高亮内容去重
        const sameTableHighlights =
          existing.type === 'cloze' && newUnit.type === 'cloze' &&
          existing.source.file === newUnit.source.file &&
          existing.extractRule?.ruleId === 'cloze-table' &&
          newUnit.extractRule?.ruleId === 'cloze-table' &&
          JSON.stringify([...((existing.metadata.customData?.allHighlights as string[]) || [])].sort()) ===
          JSON.stringify([...((newUnit.metadata.customData?.allHighlights as string[]) || [])].sort());
  
          // 新增：表格 cloze 按 content 字符串去重（allHighlights 丢失时的最后防线）
const sameTableContent =
existing.type === 'cloze' && newUnit.type === 'cloze' &&
existing.extractRule?.ruleId === 'cloze-table' &&
newUnit.extractRule?.ruleId === 'cloze-table' &&
existing.source.file === newUnit.source.file &&
this.isContentDuplicate(existing.content, newUnit.content);

// 方式6: 自动提取的内容已包含在某条手动提取的 fullContext 里
const contentCoveredByManual =
  existing.source.file === newUnit.source.file &&
  existing.extractRule?.extractedBy === 'manual' &&
  newUnit.extractRule?.extractedBy === 'auto' &&
  !!(existing.fullContext?.toLowerCase().includes(
    (newUnit.fullContext || newUnit.content).toLowerCase().trim()
  ));
  
  return sameLocation || sameContent || sameQA || coveredByManual 
    || sameTableHighlights || sameTableContent || contentCoveredByManual;
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
      line: lines.length,
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
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 生成 Block ID
   */
  private generateBlockId(): string {
    return `extract-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  }


// 表格提取方法
/**
 * 🆕 检测高亮是否在表格中
 */
private isInTable(content: string, position: number): boolean {
  const lines = content.split('\n');
  const { line } = this.calculatePosition(content, position);
  const lineIndex = line - 1;

  // 检查当前行是否为表格行（包含 | 分隔符）
  if (!lines[lineIndex]?.includes('|')) {
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
  
  while (tableStart > 0 && lines[tableStart - 1]?.includes('|')) {
    tableStart--;
  }
  
  while (tableEnd < lines.length - 1 && lines[tableEnd + 1]?.includes('|')) {
    tableEnd++;
  }
  
  // 提取表格内容
  const tableLines = lines.slice(tableStart, tableEnd + 1);
  const tableContent = tableLines.join('\n');
  
  // 🔧 先找到分隔符行的位置
  const separatorIndex = tableLines.findIndex((line, idx) => {
    if (idx === 0) return false;
    const cells = line.split('|').map(c => c.trim()).filter(c => c);
    return cells.length > 0 && cells.every(cell => /^[-:\s]+$/.test(cell));
  });
  
  // 统计表格中所有高亮
  // const highlightRegex = /==(.+?)==/g;
  const highlightRows = new Set<number>();
  const highlightColumns = new Set<number>();
  let highlightCount = 0;
  
  tableLines.forEach((line, rowIndex) => {
    // 🔧 跳过分隔符行
    if (rowIndex === separatorIndex) {
      return;
    }
    
    const cells = line.split('|').map(c => c.trim()).filter(c => c);
    
    cells.forEach((cell, colIndex) => {
        if (/==(.+?)==/.test(cell)) {
        highlightRows.add(rowIndex);  // ✅ 现在 rowIndex 是正确的
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
  
  // 🔧 找到分隔符行
  const separatorIndex = tableLines.findIndex((line, idx) => {
    if (idx === 0) return false;
    const cells = line.split('|').map(c => c.trim()).filter(c => c);
    return cells.length > 0 && cells.every(cell => /^[-:\s]+$/.test(cell));
  });
  
  // 如果没找到,默认第二行
  const actualSeparatorIndex = separatorIndex !== -1 ? separatorIndex : 1;
  
  // 情况1: 整列高亮
  const firstDataRowIndex = actualSeparatorIndex + 1;
  if (firstDataRowIndex < tableLines.length) {
    const firstDataRow = tableLines[firstDataRowIndex];
    const columnCount = firstDataRow.split('|').filter(c => c.trim()).length;
    
    if (highlightColumns.size === columnCount || highlightCount >= totalRows - 2) {
      return tableLines.join('\n');
    }
  }
  
  // 情况2: 单行高亮
  if (highlightRows.size === 1) {
    const highlightRow = Array.from(highlightRows)[0];
    const result = [
      tableLines[0],
      tableLines[actualSeparatorIndex],
      tableLines[highlightRow]
    ];
    return result.join('\n');
  }
  
  // 情况3: 多行高亮
  const result = [tableLines[0], tableLines[actualSeparatorIndex]];
  highlightRows.forEach(rowIndex => {
    if (rowIndex !== 0 && rowIndex !== actualSeparatorIndex) {
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
    // 🆕 检查是否在表格中
    const inTable = this.isInTable(content, match.index);
    
    if (inTable) {
      const tableInfo = this.extractTableWithHighlights(content, match.index);
    }
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
        const { line: currentLineIndex } = this.calculatePosition(content, match.index);
        
        // 找到表格起始位置
        let tableStart = currentLineIndex;
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
        
// 先收集所有高亮（带所在行信息）
const allHighlightEntries: { text: string; rowIdx: number }[] = [];
const sortedRows = Array.from(tableInfo.highlightRows).sort((a, b) => a - b);
for (const rowIdx of sortedRows) {
  const rowContent = tableLines[rowIdx] || '';
  const hlRegex = /==(.+?)==/g;
  let hm;
  while ((hm = hlRegex.exec(rowContent)) !== null) {
    allHighlightEntries.push({ text: hm[1].trim(), rowIdx });
  }
}

// 按行分组，每 6 行为一块（每块新表不重复已提取的行）
const rowMap = new Map<number, string[]>();
for (const { text, rowIdx } of allHighlightEntries) {
  if (!rowMap.has(rowIdx)) rowMap.set(rowIdx, []);
  rowMap.get(rowIdx)!.push(text);
}
const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);

const rowChunkSize = 6;
for (let i = 0; i < sortedRowIndices.length; i += rowChunkSize) {
  const chunkRowIndices = sortedRowIndices.slice(i, i + rowChunkSize);
  const chunkRows = new Set<number>(chunkRowIndices);
  const chunkHighlights = chunkRowIndices.flatMap(rowIdx => rowMap.get(rowIdx)!);
  const chunkRowsData = chunkRowIndices.map(rowIdx => ({
    key: tableLines[rowIdx].replace(/==(.+?)==/g, '$1').trim(),
    highlights: rowMap.get(rowIdx)!
  }));
  
// 直接构建 chunk 表：表头 + 分隔符 + 本块的数据行
const sepIdx = tableLines.findIndex((ln, idx) => {
  if (idx === 0) return false;
  const cells = ln.split('|').map(c => c.trim()).filter(c => c);
  return cells.length > 0 && cells.every(cell => /^[-:\s]+$/.test(cell));
});
const actualSepIdx = sepIdx !== -1 ? sepIdx : 1;

const chunkTable = [
  tableLines[0],
  tableLines[actualSepIdx],
  ...chunkRowIndices.map(rowIdx => tableLines[rowIdx])
].join('\n');



          const unit: ContentUnit = {
            id: this.generateId(),
            type: 'cloze',
            content: chunkHighlights.join(', '),
            fullContext: chunkTable,
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
                tableKey,
                rows: chunkRowsData, 
                tableType: 'partial',
                chunkIndex: Math.floor(i / rowChunkSize),
                highlightCount: chunkRows.size,
                rowCount: chunkRows.size,
                columnCount: tableInfo.highlightColumns.size,
                allHighlights: chunkHighlights
              }
            },
            flashcardIds: []
          };

          units.push(unit);
        }

        if (this.plugin?.unlockSystem) {
          await this.plugin.unlockSystem.onTableScanned();
        }
        continue;
  
      }
    }
    
    // 原有的普通高亮处理逻辑...
    const { sentence: fullSentence, start: sentenceStart, end: sentenceEnd } =
    this.extractFullSentenceWithPosition(content, match.index, fullMatch.length);
  
  // 标记句子内所有高亮为已处理（保留原逻辑，改用新变量）
  const sentenceHighlightRegex = /==(.+?)==/g;
  let sentenceMatch;
  while ((sentenceMatch = sentenceHighlightRegex.exec(content)) !== null) {
    if (sentenceMatch.index >= sentenceStart && sentenceMatch.index < sentenceEnd) {
      processedHighlights.add(sentenceMatch.index);
    }
  }
    const unit: ContentUnit = {
      id: this.generateId(),
      type: 'cloze',
      content: this.extractAllHighlightsFromTable(fullSentence).join(', '),
      fullContext: fullSentence,
      source: {
        file: file.path,
        position: {
          start: sentenceStart,
          end:  sentenceEnd,       
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
private extractFullSentenceWithPosition(
  content: string,
  highlightStart: number,
  highlightLength: number
): { sentence: string; start: number; end: number } {
  const sentenceEnds = /[\n]/;
  let start = highlightStart;
  while (start > 0 && !sentenceEnds.test(content[start - 1])) start--;
  let end = highlightStart + highlightLength;
  while (end < content.length) {
    if (sentenceEnds.test(content[end])) { end++; break; }
    end++;
  }
  return { sentence: content.substring(start, end).trim(), start, end };
}


}