import { App, TFile, Notice } from 'obsidian';
import { DataManager, ContentUnit } from './DataManager';

export class ExtractionEngine {
  constructor(
    private app: App,
    private dataManager: DataManager
  ) {}

  /**
   * 扫描单个文件
   */
  async scanFile(file: TFile): Promise<number> {
    try {
      const content = await this.app.vault.read(file);
      const units = this.extractHighlights(file, content);
      
      if (units.length > 0) {
        await this.dataManager.saveContentUnits(units);
        new Notice(`Extracted ${units.length} highlights from ${file.name}`);
      } else {
        new Notice(`No highlights found in ${file.name}`);
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
   * 提取高亮内容
   */
  private extractHighlights(file: TFile, content: string): ContentUnit[] {
    const units: ContentUnit[] = [];
    const highlightRegex = /==(.+?)==/g;
    let match;

    while ((match = highlightRegex.exec(content)) !== null) {
      const extractedText = match[1];
      const position = this.calculatePosition(content, match.index);
      const fullSentence = this.extractFullSentence(content, match.index, match[0].length);

      const unit: ContentUnit = {
        id: this.generateId(),
        type: 'highlight',
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
          ruleId: 'highlight',
          ruleName: 'Highlight',
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