// src/core/UnlockSystem.ts
import { App, Notice,Modal } from 'obsidian';
import type LearningSystemPlugin from '../main';
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
  levelUnlockedAt: Record<number, number>; // timestamp
  milestones: {
    level: UserLevel;
    unlockedAt: number;
  }[];
  /** 已弹过祝贺通知的成就 id,避免重复祝贺。 */
  celebratedAchievements: string[];
}

/** 一条成就(里程碑)的定义。current/target 用于显示进度与达成判定。 */
export interface Achievement {
  id: string;
  icon: string;
  title: string;
  current: number;
  target: number;
  done: boolean;
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

  // ==================== 里程碑(成就)系统 ====================

  /** 把插件的各项功能/目标列成里程碑;current/target 由累计统计推导。 */
  getAchievements(): Achievement[] {
    const s = this.progress.stats;
    const zh = this.language === 'zh-CN';
    const lbl = (en: string, cn: string) => (zh ? cn : en);

    const defs: { id: string; icon: string; title: string; current: number; target: number }[] = [
      // 入门:做一次即达成,给即时正反馈
      { id: 'first-extract', icon: '🌱', title: lbl('First Extraction', '首次提取内容'), current: s.cardsExtracted, target: 1 },
      { id: 'visit-stats', icon: '📊', title: lbl('Visit Statistics Page', '访问统计页面'), current: s.statsPageVisited ? 1 : 0, target: 1 },
      // 进阶:三种提取方式各练几次(提取是高频低成本操作,数量略高)
      { id: 'extract-text', icon: '📄', title: lbl('Extract as Text ×5', '提取为文本 ×5'), current: s.notesExtractedAsText, target: 5 },
      { id: 'extract-qa', icon: '❓', title: lbl('Extract as Q&A ×5', '提取为问答 ×5'), current: s.notesExtractedAsQA, target: 5 },
      { id: 'extract-cloze', icon: '⬛', title: lbl('Extract as Cloze ×5', '提取为挖空 ×5'), current: s.notesExtractedAsCloze, target: 5 },
      { id: 'scan-notes-10', icon: '🔍', title: lbl('Scan 10 Notes', '扫描 10 篇笔记'), current: s.notesScanned, target: 10 },
      // 熟练:成体量的积累(批注成本较高,数量适中)
      { id: 'collector-30', icon: '📦', title: lbl('Extract 30 Cards', '累计提取 30 张卡'), current: s.cardsExtracted, target: 30 },
      { id: 'annotate-10', icon: '📝', title: lbl('Add 10 Annotations', '完成 10 条批注'), current: s.annotationsCompleted, target: 10 },
      { id: 'scan-tables-5', icon: '📋', title: lbl('Scan 5 Tables', '扫描 5 个表格'), current: s.tablesScanned, target: 5 },
      { id: 'streak-7', icon: '🔥', title: lbl('7-Day Streak', '连续学习 7 天'), current: s.consecutiveDays, target: 7 },
      // 精通:长期复习与坚持
      { id: 'review-50', icon: '🔄', title: lbl('Review 50 Cards', '复习 50 张卡'), current: s.cardsReviewed, target: 50 },
      { id: 'days-21', icon: '📅', title: lbl('21 Active Days', '累计学习 21 天'), current: s.totalDays, target: 21 },
      // 大师
      { id: 'review-150', icon: '🎯', title: lbl('Review 150 Cards', '复习 150 张卡'), current: s.cardsReviewed, target: 150 },
    ];

    return defs.map((d) => ({
      ...d,
      current: Math.min(d.current, d.target),
      done: d.current >= d.target,
    }));
  }

  /** 检测「本次新达成」的里程碑并弹祝贺通知(每个只祝贺一次)。 */
  private async checkAchievements() {
    const zh = this.language === 'zh-CN';
    let changed = false;
    for (const a of this.getAchievements()) {
      if (a.done && !this.progress.celebratedAchievements.includes(a.id)) {
        this.progress.celebratedAchievements.push(a.id);
        changed = true;
        const msg = zh
          ? `🎉 里程碑达成:${a.icon} ${a.title}`
          : `🎉 Milestone reached: ${a.icon} ${a.title}`;
        new Notice(msg, 8000);
      }
    }
    if (changed) await this.saveProgress();
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

    // 等级之外,逐项里程碑也独立祝贺
    await this.checkAchievements();
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

  // ==================== 数据持久化 ====================

  private async loadProgress() {
    try {
      const adapter = this.app.vault.adapter;
      
      if (await adapter.exists(this.dataPath)) {
        const data = await adapter.read(this.dataPath);
        const saved = JSON.parse(data);

        // 兼容旧存档:旧字段 unlockedFeatures 已废弃,丢弃即可
        delete saved.unlockedFeatures;
        saved.celebratedAchievements = saved.celebratedAchievements || [];

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
      const data = JSON.stringify(this.progress, null, 2);
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
      levelUnlockedAt: { 1: Date.now() },
      milestones: [{
        level: 1,
        unlockedAt: Date.now(),
      }],
      celebratedAchievements: []
    };
  }
}

/**
 * 里程碑(成就)面板:把插件的各项功能/目标列成清单,
 * 已达成的打勾祝贺,未达成的显示进度。点侧边栏等级徽章打开。
 */
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

    const zh = this.language === 'zh-CN';
    const achievements = this.unlockSystem.getAchievements();
    const doneCount = achievements.filter((a) => a.done).length;

    // 标题
    contentEl.createEl('h2', {
      text: zh ? '🏆 里程碑' : '🏆 Milestones',
    });
    contentEl.createEl('p', {
      cls: 'milestone-summary',
      text: zh
        ? `已达成 ${doneCount} / ${achievements.length} 项`
        : `${doneCount} / ${achievements.length} reached`,
    });

    // 成就清单
    const list = contentEl.createDiv({ cls: 'achievements-list' });
    for (const a of achievements) {
      const item = list.createDiv({ cls: 'achievement-item' });
      if (a.done) item.addClass('achievement-done');

      item.createSpan({ cls: 'achievement-icon', text: a.icon });

      const body = item.createDiv({ cls: 'achievement-body' });
      body.createDiv({ cls: 'achievement-title', text: a.title });
      body.createDiv({
        cls: 'achievement-progress',
        text: a.done
          ? (zh ? '已达成' : 'Completed')
          : `${a.current} / ${a.target}`,
      });

      item.createSpan({
        cls: 'achievement-mark',
        text: a.done ? '✓' : '',
      });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}