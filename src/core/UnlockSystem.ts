// src/core/UnlockSystem.ts
import { App, Notice,Modal } from 'obsidian';
import type LearningSystemPlugin from '../main';

export type UserLevel = 1 | 2 | 3 | 4 | 5;

export interface UnlockProgress {
  currentLevel: UserLevel;
  stats: {
    cardsExtracted: number;      // Lv1→2: 需要 ≥10
    annotationsCompleted: number; // Lv2→3: 需要 ≥5
    cardsReviewed: number;        // Lv3→4: ≥30, Lv4→5: ≥70
    tablesScanned: number;        // Lv3→4: 需要 ≥2
    consecutiveDays: number;      // Lv4→5: 需要 ≥7
    totalDays: number;            // Lv4→5: 需要 ≥21
    statsPageVisited: boolean;    // Lv4→5: 需要至少1次
    lastActiveDate: string;       // YYYY-MM-DD 格式
  };
  unlockedFeatures: Set<string>;
  levelUnlockedAt: Record<number, number>; // timestamp
  milestones: {
    level: UserLevel;
    unlockedAt: number;
    message: string;
  }[];
}

export class UnlockSystem {
  private progress: UnlockProgress;
  private dataPath: string;

  constructor(
    private app: App,
    private plugin: LearningSystemPlugin
  ) {
    this.dataPath = `${this.app.vault.configDir}/plugins/learning-system/data/unlock-progress.json`;
  }

  async initialize() {
    await this.loadProgress();
    this.updateDailyStreak();
  }

  // ==================== 核心检查点 ====================

  /**
   * 🎯 卡片提取完成时调用
   */
  async onCardExtracted() {
    console.trace('[UnlockSystem] onCardExtracted 被调用');
    this.progress.stats.cardsExtracted++;
    await this.checkLevelUp();
    await this.saveProgress();
  }

  /**
   * 🎯 批注完成时调用
   */
  async onAnnotationCompleted() {
    this.progress.stats.annotationsCompleted++;
    await this.checkLevelUp();
    await this.saveProgress();
  }

  /**
   * 🎯 卡片复习完成时调用
   */
  async onCardReviewed() {
    this.progress.stats.cardsReviewed++;
    this.updateDailyStreak();
    await this.checkLevelUp();
    await this.saveProgress();
  }

  /**
   * 🎯 扫描表格时调用
   */
  async onTableScanned() {
    this.progress.stats.tablesScanned++;
    await this.checkLevelUp();
    await this.saveProgress();
  }

  /**
   * 🎯 访问统计页面时调用
   */
  async onStatsPageVisited() {
    if (!this.progress.stats.statsPageVisited) {
      this.progress.stats.statsPageVisited = true;
      await this.checkLevelUp();
      await this.saveProgress();
    }
  }

  // ==================== 功能权限检查 ====================

  /**
   * 检查功能是否解锁
   */
  isFeatureUnlocked(feature: string): boolean {
    const level = this.progress.currentLevel;
    
    const featureMap: Record<string, UserLevel> = {
      // Lv1
      'extract-single': 1,
      'sidebar-basic': 1,
      
      // Lv2
      'extract-batch': 2,
      'annotation': 2,
      'filter-by-type': 2,
      
      // Lv3
      'scan-vault': 3,
      'scan-file': 3,
      'review-page': 3,
      'review-reminder': 3,
      'extract-table': 3,
      
      // Lv4
      'stats-page': 4,
      
      // Lv5
      'advanced-analytics': 5,
      'community': 5
    };

    const requiredLevel = featureMap[feature] || 1;
    return level >= requiredLevel;
  }

  /**
   * 尝试使用功能(如果未解锁则提示)
   */
  tryUseFeature(feature: string, featureName: string): boolean {
    console.log(`[UnlockSystem] 检查功能: ${feature}, 当前等级: ${this.progress.currentLevel}`);
    
    if (this.isFeatureUnlocked(feature)) {
      console.log(`[UnlockSystem] ✅ ${feature} 已解锁`);
      return true;
    }
  
    const requiredLevel = this.getFeatureRequiredLevel(feature);
    const nextSteps = this.getNextStepsForLevel(this.progress.currentLevel);
    
    console.log(`[UnlockSystem] ❌ ${feature} 需要 Lv${requiredLevel}, 当前 Lv${this.progress.currentLevel}`);
    
    // 使用 Modal 替代 Notice
    new UnlockNoticeModal(this.app, featureName, requiredLevel, nextSteps).open();
    
    return false;
  }

  // ==================== 等级检查和升级 ====================

  private async checkLevelUp() {
    const oldLevel = this.progress.currentLevel;
    let newLevel = oldLevel;

    // 检查升级条件
    if (oldLevel === 1 && this.canUpgradeToLevel2()) {
      newLevel = 2;
    } else if (oldLevel === 2 && this.canUpgradeToLevel3()) {
      newLevel = 3;
    } else if (oldLevel === 3 && this.canUpgradeToLevel4()) {
      newLevel = 4;
    } else if (oldLevel === 4 && this.canUpgradeToLevel5()) {
      newLevel = 5;
    }

    if (newLevel > oldLevel) {
      await this.levelUp(newLevel);
    }
  }

  private canUpgradeToLevel2(): boolean {
    return this.progress.stats.cardsExtracted >= 10;
  }

  private canUpgradeToLevel3(): boolean {
    return this.progress.stats.annotationsCompleted >= 5;
  }

  private canUpgradeToLevel4(): boolean {
    return (
      this.progress.stats.cardsReviewed >= 10 &&
      this.progress.stats.tablesScanned >= 2
    );
  }

  private canUpgradeToLevel5(): boolean {
    return (
      this.progress.stats.cardsReviewed >= 70 &&
      this.progress.stats.consecutiveDays >= 7 &&
      this.progress.stats.totalDays >= 21 &&
      this.progress.stats.statsPageVisited
    );
  }

  private async levelUp(newLevel: UserLevel) {
    this.progress.currentLevel = newLevel;
    this.progress.levelUnlockedAt[newLevel] = Date.now();

    const messages: Record<UserLevel, string> = {
      1: '🎉 欢迎成为采集者!',
      2: '🎓 升级为思考者!\n解锁: 批注功能、批量操作',
      3: '🧠 成为记忆师!\n解锁: 扫描功能、复习系统',
      4: '💪 晋升训练者!\n解锁: 统计分析',
      5: '🏆 达成分析师!\n所有功能已解锁'
    };

    const milestone = {
      level: newLevel,
      unlockedAt: Date.now(),
      message: messages[newLevel]
    };

    this.progress.milestones.push(milestone);

    // 显示升级通知
    new Notice(messages[newLevel], 10000);
    
    await this.saveProgress();
  }

  // ==================== 日常连续天数 ====================

  private updateDailyStreak() {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = this.progress.stats.lastActiveDate;

    if (lastActive !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastActive === yesterdayStr) {
        // 连续
        this.progress.stats.consecutiveDays++;
      } else if (!lastActive) {
        // 首次
        this.progress.stats.consecutiveDays = 1;
      } else {
        // 中断
        this.progress.stats.consecutiveDays = 1;
      }

      this.progress.stats.totalDays++;
      this.progress.stats.lastActiveDate = today;
    }
  }

  // ==================== 辅助方法 ====================

  getCurrentLevel(): UserLevel {
    return this.progress.currentLevel;
  }

  getProgress(): UnlockProgress {
    return this.progress;
  }

  getNextStepsForLevel(level: UserLevel): string {
    const stats = this.progress.stats;
  
    switch (level) {
      case 1:
        return `📦 提取卡片: ${stats.cardsExtracted}/10`;
      case 2:
        return `📝 完成批注: ${stats.annotationsCompleted}/5`;
      case 3:
        return `🔄 复习卡片: ${stats.cardsReviewed}/30\n🔥 连续使用天数: ${stats.consecutiveDays}/7`;
      case 4:
        return `📋 扫描添加表格: ${stats.tablesScanned}/2\n📊 访问统计页: ${stats.statsPageVisited ? '✓' : '✗'}\n 📈 总使用天数: ${stats.totalDays}/21`;
        case 5:
            return `🎉 成功解锁所有功能!\n\n智囊团尚未开放\n达到人数与段位条件后开启\n🔗 <a href="https://jz-quartz.pages.dev/6.about/%E6%99%BA%E5%9B%8A%E5%9B%A2">了解智囊团（点击查看）</a>`;
          default:
        return '';
    }
  }

  private getFeatureRequiredLevel(feature: string): UserLevel {
    if (['extract-single', 'sidebar-basic'].includes(feature)) return 1;
    if (['extract-batch', 'annotation', 'filter-by-type'].includes(feature)) return 2;
    if (['scan-vault', 'scan-file', 'review-page', 'review-reminder', 'extract-table'].includes(feature)) return 3;
    if (feature === 'stats-page') return 4;
    return 5;
  }

  // ==================== 数据持久化 ====================

  private async loadProgress() {
    try {
      const adapter = this.app.vault.adapter;
      
      if (await adapter.exists(this.dataPath)) {
        const data = await adapter.read(this.dataPath);
        const saved = JSON.parse(data);
        
        // 恢复 Set
        saved.unlockedFeatures = new Set(saved.unlockedFeatures || []);
        
        this.progress = saved;
      } else {
        this.progress = this.createDefaultProgress();
      }
    } catch (error) {
      console.error('Error loading unlock progress:', error);
      this.progress = this.createDefaultProgress();
    }
  }

  private async saveProgress() {
    try {
      const adapter = this.app.vault.adapter;
      
      // 转换 Set 为数组
      const toSave = {
        ...this.progress,
        unlockedFeatures: Array.from(this.progress.unlockedFeatures)
      };
      
      const data = JSON.stringify(toSave, null, 2);
      await adapter.write(this.dataPath, data);
    } catch (error) {
      console.error('Error saving unlock progress:', error);
    }
  }

  private createDefaultProgress(): UnlockProgress {
    return {
      currentLevel: 1,
      stats: {
        cardsExtracted: 0,
        annotationsCompleted: 0,
        cardsReviewed: 0,
        tablesScanned: 0,
        consecutiveDays: 0,
        totalDays: 0,
        statsPageVisited: false,
        lastActiveDate: ''
      },
      unlockedFeatures: new Set(['extract-single', 'sidebar-basic']),
      levelUnlockedAt: { 1: Date.now() },
      milestones: [{
        level: 1,
        unlockedAt: Date.now(),
        message: '🎉 欢迎成为采集者!'
      }]
    };
  }
}

class UnlockNoticeModal extends Modal {
    constructor(
      app: App,
      private featureName: string,
      private requiredLevel: number,
      private nextSteps: string
    ) {
      super(app);
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '🔒 功能未解锁' });
        contentEl.createEl('p', { 
          text: `"${this.featureName}" 需要 Lv${this.requiredLevel} 解锁` 
        });
        
        contentEl.createEl('h3', { text: '当前进度:' });
        
        // 创建容器并设置样式
        const container = contentEl.createDiv();
        container.style.padding = '10px';
        container.style.backgroundColor = 'var(--background-secondary)';
        container.style.borderRadius = '5px';
        container.style.lineHeight = '1.8';
        
    // 使用 innerHTML 直接插入带 <br> 的 HTML
    container.innerHTML = this.nextSteps.replace(/\n/g, '<br>');

    // 添加分隔线 - 直接在 container 后面
    const divider = contentEl.createEl('div');
    divider.style.width = '100%';
    divider.style.height = '2px';
    divider.style.backgroundColor = '#666';
    divider.style.margin = '20px 0';
      
    }
    onClose() {
      const { contentEl } = this;
      contentEl.empty();
    }
  }