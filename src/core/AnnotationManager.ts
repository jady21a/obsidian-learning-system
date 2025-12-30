// annotation Manager.ts
import { App } from 'obsidian';
import type LearningSystemPlugin from '../main';

export interface Annotation {
  id: string;
  targetType: 'content' | 'file';
  targetId: string;
  content: string;
  badge?: {
    text: string;
    color: string;
    icon?: string;
  };
  metadata: {
    createdAt: number;
    updatedAt: number;
    isPinned?: boolean;
  };
}

export class AnnotationManager {
  private annotations: Map<string, Annotation> = new Map();
  private dataFolder: string;

  constructor(
    private app: App,
    private plugin: LearningSystemPlugin
  ) {
    this.dataFolder = `${this.app.vault.configDir}/plugins/learning-system/data`;
  }

  async initialize() {
    await this.loadAnnotations();
  }

  /**
   * 加载所有批注
   */
  private async loadAnnotations() {
    try {
      const path = `${this.dataFolder}/annotations.json`;
      const adapter = this.app.vault.adapter;

      if (await adapter.exists(path)) {
        const data = await adapter.read(path);
        const annotations: Annotation[] = JSON.parse(data);
        
        for (const annotation of annotations) {
          this.annotations.set(annotation.id, annotation);
        }
      }
    } catch (error) {
      console.error('Error loading annotations:', error);
    }
  }

  /**
   * 添加内容批注
   */
  async addContentAnnotation(
    contentUnitId: string,
    content: string,
    badge?: Annotation['badge']
  ): Promise<Annotation> {
    const annotation: Annotation = {
      id: this.generateId(),
      targetType: 'content',
      targetId: contentUnitId,
      content,
      badge,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };

    this.annotations.set(annotation.id, annotation);
    await this.persist();
// 🎯 解锁系统检查点
await this.plugin.unlockSystem.onAnnotationCompleted();
    // 更新 ContentUnit 关联
    const contentUnit = this.plugin.dataManager.getContentUnit(contentUnitId);
    if (contentUnit) {
      contentUnit.annotationId = annotation.id;
      contentUnit.metadata.updatedAt = Date.now();
      await this.plugin.dataManager.saveContentUnit(contentUnit);
    }

    return annotation;
  }

  /**
   * 添加文件批注
   */
  async addFileAnnotation(
    filePath: string,
    content: string
  ): Promise<Annotation> {
    const annotation: Annotation = {
      id: this.generateId(),
      targetType: 'file',
      targetId: filePath,
      content,
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };

    this.annotations.set(annotation.id, annotation);
    await this.persist();


// 🎯 解锁系统检查点
await this.plugin.unlockSystem.onAnnotationCompleted();
    return annotation;
  }

  /**
   * 获取批注
   */
  getAnnotation(id: string): Annotation | undefined {
    return this.annotations.get(id);
  }

  /**
   * 获取内容的批注
   */
  getContentAnnotation(contentUnitId: string): Annotation | undefined {
    const contentUnit = this.plugin.dataManager.getContentUnit(contentUnitId);
    if (!contentUnit?.annotationId) return undefined;
    
    return this.annotations.get(contentUnit.annotationId);
  }

  /**
   * 获取文件的所有批注
   */
  getFileAnnotations(filePath: string): Annotation[] {
    return Array.from(this.annotations.values()).filter(
      ann => ann.targetType === 'file' && ann.targetId === filePath
    );
  }

  /**
   * 更新批注
   */
  async updateAnnotation(
    id: string,
    updates: Partial<Annotation>
  ): Promise<void> {
    const annotation = this.annotations.get(id);
    if (!annotation) return;

    Object.assign(annotation, updates, {
      metadata: {
        ...annotation.metadata,
        updatedAt: Date.now()
      }
    });

    await this.persist();
  }

  /**
   * 删除批注
   */
  async deleteAnnotation(id: string): Promise<void> {
    const annotation = this.annotations.get(id);
    if (!annotation) return;

    // 如果是内容批注，解除关联
    if (annotation.targetType === 'content') {
      const contentUnit = this.plugin.dataManager.getContentUnit(annotation.targetId);
      if (contentUnit) {
        contentUnit.annotationId = undefined;
        await this.plugin.dataManager.saveContentUnit(contentUnit);
      }
    }

    this.annotations.delete(id);
    await this.persist();
  }

  /**
   * 获取所有批注
   */
  getAllAnnotations(): Annotation[] {
    return Array.from(this.annotations.values());
  }

  /**
   * 持久化
   */
  private async persist() {
    try {
      const path = `${this.dataFolder}/annotations.json`;
      const annotations = Array.from(this.annotations.values());
      const data = JSON.stringify(annotations, null, 2);
      
      await this.app.vault.adapter.write(path, data);
    } catch (error) {
      console.error('Error persisting annotations:', error);
    }
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}