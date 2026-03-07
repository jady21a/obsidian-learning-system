// src/core/UnlockSystem.ts
import { App, Notice,Modal } from 'obsidian';
import type LearningSystemPlugin from '../main';
import { StyleLoader } from 'src/ui/style/sidebarStyle';
import { t ,Language} from '../i18n/translations';

export type UserLevel = 1 | 2 | 3 | 4 | 5;

export interface UnlockProgress {
  currentLevel: UserLevel;
  stats: {
    cardsExtracted: number;      // Lv1→2: 需要 ≥10
     notesExtractedAsText: number;    // 新增:提取为text
  notesExtractedAsQA: number;      // 新增:提取为QA
  notesExtractedAsCloze: number;   // 新增:提取为cloze
  annotationsCompleted: number;
  notesScanned: number; // Lv2→3: 需要 ≥5
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
  private get language() {
    return this.plugin.settings.language || 'en';
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
    this.progress.stats.cardsExtracted++;
    await this.checkLevelUp();
    await this.saveProgress();
  }
/**
 * 🎯 提取为text时调用
 */
async onNoteExtractedAsText() {
  this.progress.stats.notesExtractedAsText++;
  await this.checkLevelUp();
  await this.saveProgress();
}

/**
 * 🎯 提取为QA时调用
 */
async onNoteExtractedAsQA() {
  this.progress.stats.notesExtractedAsQA++;
  await this.checkLevelUp();
  await this.saveProgress();
}

/**
 * 🎯 提取为cloze时调用
 */
async onNoteExtractedAsCloze() {
  this.progress.stats.notesExtractedAsCloze++;
  await this.checkLevelUp();
  await this.saveProgress();
}

/**
 * 🎯 scan提取笔记时调用
 */
async onNoteScanned() {
  this.progress.stats.notesScanned++;
  await this.checkLevelUp();
  await this.saveProgress();
}
  /**
   * 🎯 批注完成时调用
   */
  async onAnnotationCompleted() {
    const before = this.progress.stats.annotationsCompleted;
    
    
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
      'scan-file': 2,
      
      // Lv3
      'scan-vault': 3,
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
    if (this.isFeatureUnlocked(feature)) {
      return true;
    }
  
    const requiredLevel = this.getFeatureRequiredLevel(feature);
    const nextSteps = this.getNextStepsForLevel(this.progress.currentLevel);
    
    // 传递语言参数
    new UnlockNoticeModal(
      this.app, 
      featureName, 
      requiredLevel, 
      nextSteps,
      this.language
    ).open();
    
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
    const { notesExtractedAsText, notesExtractedAsQA, notesExtractedAsCloze } = this.progress.stats;
  // 每种类型至少提取2个笔记
  return notesExtractedAsText >= 2 && 
         notesExtractedAsQA >= 2 && 
         notesExtractedAsCloze >= 2;

  }
  
  private canUpgradeToLevel3(): boolean {
    return this.progress.stats.annotationsCompleted >= 3 &&
           this.progress.stats.notesScanned >= 5;
  }
  
  private canUpgradeToLevel4(): boolean {
    return this.progress.stats.cardsReviewed >= 30 &&
           this.progress.stats.tablesScanned >= 2;
  }
  
  private canUpgradeToLevel5(): boolean {
    return this.progress.stats.cardsReviewed >= 70 &&
           this.progress.stats.totalDays >= 21 &&
           this.progress.stats.statsPageVisited;
  }

  private async levelUp(newLevel: UserLevel) {
    this.progress.currentLevel = newLevel;
    this.progress.levelUnlockedAt[newLevel] = Date.now();
  
    const message = t(`unlock.levelUp.${newLevel}`, this.language);
  
    const milestone = {
      level: newLevel,
      unlockedAt: Date.now(),
    };
  
    this.progress.milestones.push(milestone);
  
    // 显示升级通知
    new Notice(message, 10000);
    
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
    const lang = this.language;
    
    switch (level) {
      case 1:
        return t('unlock.nextSteps.level1', lang, { 
          text: stats.notesExtractedAsText,
          qa: stats.notesExtractedAsQA,
          cloze: stats.notesExtractedAsCloze
        });
      case 2:
        return t('unlock.nextSteps.level2', lang, { 
          annotations: stats.annotationsCompleted,
          scanned: stats.notesScanned
        });
      case 3:
        return t('unlock.nextSteps.level3', lang, { 
          reviewed: stats.cardsReviewed,
          tables: stats.tablesScanned
        });
      case 4:
        return t('unlock.nextSteps.level4', lang, {
          reviewed: stats.cardsReviewed,
          total: stats.totalDays,
          visited: stats.statsPageVisited ? '✓' : '✗'
        });
      case 5:
        return t('unlock.nextSteps.level5', lang);
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
        notesExtractedAsText: 0,
        notesExtractedAsQA: 0,
        notesExtractedAsCloze: 0,
        annotationsCompleted: 0,
        notesScanned: 0,
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
      }]
    };
  }
}

class UnlockNoticeModal extends Modal {
  constructor(
    app: App,
    private featureName: string,
    private requiredLevel: number,
    private nextSteps: string,
    private language: Language = 'en'
  ) {
    super(app);
  }
  
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
  
    contentEl.createEl('h2', { text: t('unlock.modal.title', this.language) });
    contentEl.createEl('p', {
      text: t('unlock.modal.requireLevel', this.language, {
        feature: this.featureName,
        level: this.requiredLevel,
      }),
    });
    contentEl.createEl('h3', { text: t('unlock.modal.currentProgress', this.language) });
  
    const container = contentEl.createDiv({ cls: 'unlock-modal-steps' });
    container.innerHTML = this.nextSteps.replace(/\n/g, '<br>');
  
    contentEl.createDiv({ cls: 'unlock-modal-divider' });
  }
  
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
export class LevelInfoModal extends Modal {
  constructor(
    app: App,
    private progress: UnlockProgress,
    private unlockSystem: UnlockSystem,
    private language: Language = 'en' 
  ) {
    super(app);
  }
  
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('level-info-modal');
    
    const level = this.progress.currentLevel;
    const levelName = t(`unlock.level.${level}`, this.language);
    
    contentEl.createEl('h2', { 
      text: t('unlock.levelInfo.title', this.language, {
        level: level,
        name: levelName
      })
    });
    
    // 进度信息
    const progressSection = contentEl.createDiv({ cls: 'progress-section' });
    
    const progressBox = progressSection.createDiv({ cls: 'progress-box' });
    const progressText = this.unlockSystem.getNextStepsForLevel(this.progress.currentLevel);
    progressBox.innerHTML = progressText.replace(/\n/g, '<br>');
    
    // 统计信息
    const statsSection = contentEl.createDiv({ cls: 'stats-section' });
    statsSection.createEl('h4', { text: t('unlock.levelInfo.cumulativeStats', this.language) });
    
    const statsGrid = statsSection.createDiv({ cls: 'stats-grid' });
    
    const stats = [
      { 
        icon: '📦', 
        label: t('unlock.stat.cardsExtracted', this.language), 
        value: this.progress.stats.cardsExtracted 
      },
      { 
        icon: '📝', 
        label: t('unlock.stat.annotationsCompleted', this.language), 
        value: this.progress.stats.annotationsCompleted 
      },
      { 
        icon: '🔄', 
        label: t('unlock.stat.cardsReviewed', this.language), 
        value: this.progress.stats.cardsReviewed 
      },
      { 
        icon: '📋', 
        label: t('unlock.stat.tablesScanned', this.language), 
        value: this.progress.stats.tablesScanned 
      },
      { 
        icon: '🔥', 
        label: t('unlock.stat.consecutiveDays', this.language), 
        value: this.progress.stats.consecutiveDays 
      },
      { 
        icon: '📅', 
        label: t('unlock.stat.totalDays', this.language), 
        value: this.progress.stats.totalDays 
      }
    ];
    
    stats.forEach(stat => {
      const item = statsGrid.createDiv({ cls: 'stat-item' });
      item.innerHTML = `
        <span class="stat-icon">${stat.icon}</span>
        <span class="stat-label">${stat.label}</span>
        <span class="stat-value">${stat.value}</span>
      `;
    });
    
    // 里程碑
    if (this.progress.milestones.length > 0) {
      const milestonesSection = contentEl.createDiv({ cls: 'milestones-section' });
      milestonesSection.createEl('h4', { 
        text: t('unlock.levelInfo.milestones', this.language)
      });
      
      const milestonesList = milestonesSection.createDiv({ cls: 'milestones-list' });
      
      this.progress.milestones
        .slice()
        .reverse()
        .forEach((milestone) => {
          const item = milestonesList.createDiv({ cls: 'milestone-item' });
          const date = new Date(milestone.unlockedAt).toLocaleDateString(
            this.language === 'zh-CN' ? 'zh-CN' : 'en-US'
          );
          const message = t(`unlock.levelUp.${milestone.level}`, this.language);
      
          item.innerHTML = `
            <div class="milestone-message">${date} ${message}</div>
          `;
        });
    }
  }
  
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}