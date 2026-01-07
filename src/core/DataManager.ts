// data manager.ts
import { App, TFile } from 'obsidian';
import type LearningSystemPlugin from '../main';

export interface ContentUnit {
  id: string;
  type: 'highlight' | 'bold' | 'tag' | 'custom' | 'QA' | 'cloze'|'text'; // 添加 qa 和 cloze 类型
  content: string;
  answer?: string; // 用于 QA 卡片的答案
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
    customData?: Record<string, any>;
  };
  annotationId?: string;
  flashcardIds: string[];
}

export class DataManager {
  private dataFolder: string;
  private contentUnits: Map<string, ContentUnit> = new Map();
  private fileIndex: Map<string, string[]> = new Map();
  private cache: Map<string, { data: ContentUnit; timestamp: number }>;
  private CACHE_TTL = 5 * 60 * 1000; // 5分钟

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
    await this.loadDeleteHistory();
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

  getContentUnitsByType(type: ContentUnit['type']): ContentUnit[] {
    return Array.from(this.contentUnits.values()).filter(unit => unit.type === type);
  }

  getAllContentUnits(page?: number, size?: number): ContentUnit[] {
    const all = Array.from(this.contentUnits.values());
    if (!page || !size) return all;
    return all.slice(page * size, (page + 1) * size);
  }


  
  // 最近删除
private deletedUnits: Array<{
  type: 'note';
  id: string;
  unit: ContentUnit;
  deletedAt: number;
  deletedBy: string;
  associatedCardIds: string[];
}> = [];

async deleteContentUnit(id: string, reason: 'user-deleted' | 'file-deleted' = 'user-deleted') {
  const unit = this.contentUnits.get(id);
  if (unit) {
    
    // ✅ 无论 flashcardIds 是否为空，都动态查找一次（防止数据不同步）
    const allCards = this.plugin.flashcardManager.getAllFlashcards();
    const associatedCardIds = allCards
      .filter(card => {
        const match = card.sourceContentId === id;
        if (match) {
        }
        return match;
      })
      .map(card => card.id);
    
    // 📝 保存到删除历史
    this.deletedUnits.push({
      type: 'note',
      id: unit.id,
      unit: { ...unit },
      deletedAt: Date.now(),
      deletedBy: reason,
      associatedCardIds: associatedCardIds
    });
    
    // 只保留7天内的记录
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    this.deletedUnits = this.deletedUnits.filter(d => d.deletedAt > sevenDaysAgo);
    
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
    await this.persistDeleteHistory();
  }
}

// 新增：获取最近删除的笔记
getRecentlyDeletedUnits(days: number = 7): Array<{
  type: 'note';
  id: string;
  unit: ContentUnit;
  deletedAt: number;
  deletedBy: string;
  associatedCardIds: string[];
}> {
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  return this.deletedUnits.filter(d => d.deletedAt > cutoff)
    .sort((a, b) => b.deletedAt - a.deletedAt); // 按时间倒序
}

// 新增：恢复笔记
async restoreContentUnit(deletedItem: typeof this.deletedUnits[0]): Promise<boolean> {
  try {
    // 检查是否已存在
    if (this.contentUnits.has(deletedItem.unit.id)) {
      return false;
    }
    
    // 恢复笔记
    this.contentUnits.set(deletedItem.unit.id, deletedItem.unit);
    
    // 恢复文件索引
    if (!this.fileIndex.has(deletedItem.unit.source.file)) {
      this.fileIndex.set(deletedItem.unit.source.file, []);
    }
    this.fileIndex.get(deletedItem.unit.source.file)!.push(deletedItem.unit.id);
    
    await this.persist();
    
    // 从删除历史中移除
    this.deletedUnits = this.deletedUnits.filter(item => item.id !== deletedItem.id);
    await this.persistDeleteHistory();
    
    return true;
  } catch (error) {
    console.error('Error restoring content unit:', error);
    return false;
  }
}

// 新增：永久删除笔记（从历史中移除）
async permanentlyDeleteContentUnit(deletedItemId: string): Promise<boolean> {
  try {
    this.deletedUnits = this.deletedUnits.filter(item => item.id !== deletedItemId);
    await this.persistDeleteHistory();
    return true;
  } catch (error) {
    console.error('Error permanently deleting content unit:', error);
    return false;
  }
}

// 新增：一键清空笔记删除历史
async clearDeleteHistory(): Promise<number> {
  const count = this.deletedUnits.length;
  this.deletedUnits = [];
  await this.persistDeleteHistory();
  return count;
}

private async persistDeleteHistory() {
  try {
    const path = `${this.dataFolder}/deleted-units.json`;
    const data = JSON.stringify(this.deletedUnits, null, 2);
    await this.app.vault.adapter.write(path, data);
  } catch (error) {
    console.error('Error persisting delete history:', error);
  }
}

private async loadDeleteHistory() {
  try {
    const path = `${this.dataFolder}/deleted-units.json`;
    const adapter = this.app.vault.adapter;

    if (await adapter.exists(path)) {
      const data = await adapter.read(path);
      this.deletedUnits = JSON.parse(data);
      
      // 清理超过7天的记录
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      this.deletedUnits = this.deletedUnits.filter(d => d.deletedAt > sevenDaysAgo);
      await this.persistDeleteHistory();
    }
  } catch (error) {
    console.error('Error loading delete history:', error);
  }
}


  



  /** 对外统一保存入口 */
  async save(): Promise<void> {
    await this.persist();
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
    // 🔧 优化 : 批量操作使用事务
    async transaction(operations: () => Promise<void>) {
      try {
        await operations();
        await this.persist();
      } catch (error) {
        // 回滚逻辑
        await this.loadData();
        throw error;
      }
    }

 
}