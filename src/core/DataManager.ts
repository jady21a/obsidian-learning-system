import { App, TFile } from 'obsidian';
import type LearningSystemPlugin from '../main';

export interface ContentUnit {
  id: string;
  type: 'highlight' | 'bold' | 'tag' | 'custom';
  content: string;
  fullContext?: string;
  source: {
    file: string;
    position: {
      start: number;
      end: number;
      line: number;
    };
    blockId?: string;
    heading?: string;
    anchorLink: string;
  };
  extractRule: {
    ruleId: string;
    ruleName: string;
    extractedBy: 'auto' | 'manual';
  };
  metadata: {
    createdAt: number;
    updatedAt: number;
    tags: string[];
    color?: string;
  };
  annotationId?: string;
  flashcardIds: string[];
}

export class DataManager {
  private dataFolder: string;
  private contentUnits: Map<string, ContentUnit> = new Map();
  private fileIndex: Map<string, string[]> = new Map();

  constructor(
    private app: App,
    private plugin: LearningSystemPlugin
  ) {
    this.dataFolder = `${this.app.vault.configDir}/plugins/learning-system/data`;
  }

  async initialize() {
    // 确保数据文件夹存在
    await this.ensureDataFolder();
    
    // 加载现有数据
    await this.loadData();
  }

  private async ensureDataFolder() {
    const adapter = this.app.vault.adapter;
    
    // 创建主数据文件夹
    if (!(await adapter.exists(this.dataFolder))) {
      await adapter.mkdir(this.dataFolder);
    }

    // 创建子文件夹
    const subfolders = ['indexes', 'config', 'cache'];
    for (const folder of subfolders) {
      const path = `${this.dataFolder}/${folder}`;
      if (!(await adapter.exists(path))) {
        await adapter.mkdir(path);
      }
    }
  }

  private async loadData() {
    try {
      const contentPath = `${this.dataFolder}/content-units.json`;
      const adapter = this.app.vault.adapter;

      if (await adapter.exists(contentPath)) {
        const data = await adapter.read(contentPath);
        const units: ContentUnit[] = JSON.parse(data);
        
        for (const unit of units) {
          this.contentUnits.set(unit.id, unit);
          
          // 构建文件索引
          if (!this.fileIndex.has(unit.source.file)) {
            this.fileIndex.set(unit.source.file, []);
          }
          this.fileIndex.get(unit.source.file)!.push(unit.id);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async saveContentUnit(unit: ContentUnit) {
    this.contentUnits.set(unit.id, unit);
    
    // 更新文件索引
    if (!this.fileIndex.has(unit.source.file)) {
      this.fileIndex.set(unit.source.file, []);
    }
    if (!this.fileIndex.get(unit.source.file)!.includes(unit.id)) {
      this.fileIndex.get(unit.source.file)!.push(unit.id);
    }

    await this.persist();
  }

  async saveContentUnits(units: ContentUnit[]) {
    for (const unit of units) {
      this.contentUnits.set(unit.id, unit);
      
      if (!this.fileIndex.has(unit.source.file)) {
        this.fileIndex.set(unit.source.file, []);
      }
      if (!this.fileIndex.get(unit.source.file)!.includes(unit.id)) {
        this.fileIndex.get(unit.source.file)!.push(unit.id);
      }
    }

    await this.persist();
  }

  getContentUnit(id: string): ContentUnit | undefined {
    return this.contentUnits.get(id);
  }

  getContentUnitsByFile(filePath: string): ContentUnit[] {
    const ids = this.fileIndex.get(filePath) || [];
    return ids.map(id => this.contentUnits.get(id)).filter(Boolean) as ContentUnit[];
  }

  getAllContentUnits(): ContentUnit[] {
    return Array.from(this.contentUnits.values());
  }

  async deleteContentUnit(id: string) {
    const unit = this.contentUnits.get(id);
    if (unit) {
      this.contentUnits.delete(id);
      
      // 更新文件索引
      const fileUnits = this.fileIndex.get(unit.source.file);
      if (fileUnits) {
        const index = fileUnits.indexOf(id);
        if (index > -1) {
          fileUnits.splice(index, 1);
        }
      }

      await this.persist();
    }
  }

  private async persist() {
    try {
      const contentPath = `${this.dataFolder}/content-units.json`;
      const units = Array.from(this.contentUnits.values());
      const data = JSON.stringify(units, null, 2);
      
      await this.app.vault.adapter.write(contentPath, data);
      
      // 保存索引
      const indexPath = `${this.dataFolder}/indexes/file-index.json`;
      const indexData = JSON.stringify(
        Object.fromEntries(this.fileIndex),
        null,
        2
      );
      await this.app.vault.adapter.write(indexPath, indexData);
    } catch (error) {
      console.error('Error persisting data:', error);
    }
  }
}