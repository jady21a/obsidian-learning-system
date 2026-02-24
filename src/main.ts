// main.ts
import { Plugin, TFile, WorkspaceLeaf, Notice, MarkdownView } from 'obsidian';
import { SettingsTab } from './ui/view/SettingsTab';
import { SidebarOverviewView, VIEW_TYPE_SIDEBAR_OVERVIEW, VIEW_TYPE_MAIN_OVERVIEW  } from './ui/view/SidebarOverviewView';
import { ReviewView, VIEW_TYPE_REVIEW } from './ui/view/ReviewView';
import { StatsView, VIEW_TYPE_STATS } from './ui/view/StatsView';
import { DataManager } from './core/DataManager';
import { ExtractionEngine } from './core/ExtractionEngine';
import { AnnotationManager } from './core/AnnotationManager';
import { FlashcardManager } from './core/FlashcardManager';
import { AnalyticsEngine,CycleInfo } from './core/AnalyticsEngine';
import { UnlockSystem } from './core/UnlockSystem';
import { ViewState } from './ui/stats/ViewState';
import { t } from './i18n/translations'
import { RecentlyDeletedModal } from './ui/view/RecentlyDeletedView';


interface LearningSystemSettings {
  extractionEnabled: boolean;
  autoScan: boolean;
  defaultDeck: string;
  cycleData?: CycleInfo;
  language?: 'en' | 'zh-CN'; 
}
interface ObsidianVaultWithConfig {
  getConfig(key: string): string | undefined;
}
const DEFAULT_SETTINGS: LearningSystemSettings = {
  extractionEnabled: true,
  autoScan: false,
  defaultDeck: 'Default',
  cycleData: undefined
    // language: 'en'
};

export default class LearningSystemPlugin extends Plugin {
  settings: LearningSystemSettings;
  dataManager: DataManager;
  extractionEngine: ExtractionEngine;
  annotationManager: AnnotationManager;
  flashcardManager: FlashcardManager;
  analyticsEngine: AnalyticsEngine;
  unlockSystem: UnlockSystem;


  async onload() {
    console.log('Loading Learning System Plugin');
  
    await this.loadSettings();
    this.detectAndSetLanguage();
  
    // 🔥 1. 最优先:初始化解锁系统
    this.unlockSystem = new UnlockSystem(this.app, this);
    await this.unlockSystem.initialize();
  
    // 2. 初始化核心模块
    this.dataManager = new DataManager(this.app, this);
    await this.dataManager.initialize();
  
    this.annotationManager = new AnnotationManager(this.app, this);
    await this.annotationManager.initialize();
  
    this.flashcardManager = new FlashcardManager(
      this.app,
      this.dataManager,
      this
    );
    await this.flashcardManager.initialize();
  
    this.extractionEngine = new ExtractionEngine(
      this.app,
      this.dataManager,
      this.flashcardManager,
      this
    );
  
    // 3. 注册视图
    this.registerView(
      VIEW_TYPE_SIDEBAR_OVERVIEW,
      (leaf) => new SidebarOverviewView(leaf, this, false)
    );
    
    this.registerView(
      VIEW_TYPE_MAIN_OVERVIEW,
      (leaf) => new SidebarOverviewView(leaf, this, true)
    );
  
    this.registerView(
      VIEW_TYPE_REVIEW,
      (leaf) => new ReviewView(leaf, this)
    );
  
    this.registerView(
      VIEW_TYPE_STATS,
      (leaf) => new StatsView(leaf, this)
    );


this.registerEvent(
  this.app.vault.on('delete', async (file) => {
    if (file instanceof TFile && file.extension === 'md') {
      const stats = ViewState.getFileDeleteStats(file.path, this);
      
      if (stats.notes > 0 || stats.cards > 0) {
        // ✅ 直接删除，不弹窗
        const units = this.dataManager.getAllContentUnits()
          .filter(u => u.source.file === file.path);
        
        for (const unit of units) {
          // 删除关联的闪卡
          for (const cardId of unit.flashcardIds) {
            await this.flashcardManager.deleteCard(cardId, 'file-deleted');
          }
          // 删除笔记
          await this.dataManager.deleteContentUnit(unit.id, 'file-deleted');
        }
        
        // 简短提示
        new Notice(t('notice.fileDeletedSimple', this.settings.language, {
          notes: stats.notes,
          cards: stats.cards
        }), 3000);

      }
    }
  })
);
  
    this.addSettingTab(new SettingsTab(this.app, this));
    
    // 🔥 4. 现在才注册命令(确保 unlockSystem 已就绪)
    this.addCommands();
  // 🆕 4.5 注册右键菜单
this.registerEvent(
  this.app.workspace.on('editor-menu', (menu, editor, view) => {
    if (view instanceof MarkdownView && view.file) {
      this.extractionEngine.registerContextMenu(menu, editor, view.file);
    }
  })
);
    // 5. Ribbon 图标(带权限检查)
    this.addRibbonIcon('layout-list', 'Open Learning Overview(Sidebar)', () => {
     void this.activateSidebarOverview();
    });
  
    this.addRibbonIcon('layers', 'Start Review', () => {
      if (!this.unlockSystem.tryUseFeature('review-page', 'Start Review')) {
        return;
      }
     void this.activateReview();
    });
  
    // 6. 状态栏
    this.setupStatusBar();
    
    this.analyticsEngine = new AnalyticsEngine(this);
  
    console.log('Learning System Plugin loaded');
  }

  onunload() {
    console.log('Unloading Learning System Plugin');
    
    // 只在插件完全卸载时才清理所有视图
    // 注意：这里不要删除特定视图类型，让 Obsidian 自己管理
    // 只清理插件级别的资源
    
    const styleEl = document.getElementById('learning-overview-styles');
    if (styleEl) {
      styleEl.remove();
    }
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    const cycleFilePath = `${this.manifest.dir}/cycle-data.json`;
    try {
      const cycleContent = await this.app.vault.adapter.read(cycleFilePath);
      const cycleData = JSON.parse(cycleContent);
      if (cycleData?.cycleData) {
        this.settings.cycleData = cycleData.cycleData;
      }
    } catch (error) {
      // 文件不存在或读取失败，使用默认值
    }
    this.detectAndSetLanguage();
  }

  async saveSettings() {
  const { cycleData, ...settingsToSave } = this.settings;
  await this.saveData(settingsToSave);
}

async saveCycleData() {
  const cycleFilePath = `${this.manifest.dir}/cycle-data.json`;
  await this.app.vault.adapter.write(
    cycleFilePath, 
    JSON.stringify({ cycleData: this.settings.cycleData }, null, 2)
  );
}

  private addCommands() {
    this.addCommand({
      id: 'scan-current-file',
      name: 'Scan current file for content',
      callback: async () => {
            // 🎯 权限检查
    if (!this.unlockSystem.tryUseFeature('scan-file', 'Scan Current File')) {
      return;
    }
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;
        await this.extractionEngine.scanFile(activeFile);
        this.refreshOverview();
      }
    });

    this.addCommand({
      id: 'scan-vault',
      name: 'Scan entire vault',
      callback: async () => {
            // 🎯 权限检查
    if (!this.unlockSystem.tryUseFeature('scan-vault', 'Scan Entire Vault')) {
      return;
    }
        await this.extractionEngine.scanVault();
        this.refreshOverview();
      }
    });

    this.addCommand({
      id: 'open-overview',
      name: 'Open Learning Overview(Sidebar)',
      callback: () => {
       void this.activateSidebarOverview();
      }
    });

    this.addCommand({
      id: 'open-main-overview',
      name: 'Toggle Learning Overview (Main View)',
      callback: async () => {
                    // 🎯 权限检查
    if (!this.unlockSystem.tryUseFeature('open-main- overview', 'Toggle Learning Overview (Main View)')) {
      return;
    }
        await this.toggleMainView();
      }
    });

    this.addCommand({
      id: 'add-file-annotation',
      name: 'Add file annotation',
      callback: async () => {
           // 🎯 权限检查
    if (!this.unlockSystem.tryUseFeature('annotation', 'File Annotation')) {
      return;
    }
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) return;

        const { FileAnnotationModal } = await import('./ui/view/AnnotationModal');
        const modal = new FileAnnotationModal(
          this.app,
          this,
          activeFile.path,
          () => this.refreshOverview()
        );
        modal.open();
      }
    });

    this.addCommand({
      id: 'start-review',
      name: 'Start flashcard review',
      callback: () => {
            // 🎯 权限检查
    if (!this.unlockSystem.tryUseFeature('review-page', 'Flashcard Review')) {
      return;
    }
       void this.activateReview();
      }
    });

    this.addCommand({
      id: 'show-stats',
      name: 'Show flashcard statistics',
      callback: () => {
            // 🎯 权限检查
    if (!this.unlockSystem.tryUseFeature('stats-page', 'Statistics')) {
      return;
    }

       void this.activateStats();
      }
    });
    this.addCommand({
      id: 'show-recently-deleted',
      name: 'Show recently deleted items',
      callback: async () => { 
       void this.openRecentlyDeletedModal();  
      }
    
    });
    
  }
  async openRecentlyDeletedModal() {
    const modal = new RecentlyDeletedModal(this);
    modal.open();
  }

  async activateMainView() {
    const { workspace } = this.app;

    // 检查是否已经有主界面视图打开
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_MAIN_OVERVIEW)[0];
    
    if (!leaf) {
      // 创建新的标签页
      leaf = workspace.getLeaf('tab');
      await leaf.setViewState({
        type: VIEW_TYPE_MAIN_OVERVIEW,
        active: true,
      });
    }

    void workspace.revealLeaf(leaf);
  }

  async toggleMainView() {
    const { workspace } = this.app;
    const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_MAIN_OVERVIEW);
    
    // 检查当前激活的页面是否是主界面模式
    const activeLeaf = workspace.activeLeaf;
    const isMainOverviewActive = activeLeaf && 
      activeLeaf.view.getViewType() === VIEW_TYPE_MAIN_OVERVIEW;
    
    if (existingLeaves.length > 0 && isMainOverviewActive) {
      // 如果主界面模式正在显示且是当前激活页面，则关闭它
      existingLeaves.forEach(leaf => {
        leaf.detach();
      });
    } else if (existingLeaves.length > 0 && !isMainOverviewActive) {
      // 如果主界面模式存在但不是当前激活页面，则激活它
      void workspace.revealLeaf(existingLeaves[0]);
    } else {
      // 如果主界面模式不存在，则创建并显示
      const leaf = workspace.getLeaf('tab');
      await leaf.setViewState({
        type: VIEW_TYPE_MAIN_OVERVIEW,
        active: true,
      });
     void workspace.revealLeaf(leaf);
    }
  }

  async activateSidebarOverview() {
    const { workspace } = this.app;
    
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_SIDEBAR_OVERVIEW);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      // 在右侧边栏创建新的视图
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({
        type: VIEW_TYPE_SIDEBAR_OVERVIEW,
        active: true
      });
    }

    if (leaf) {
     void workspace.revealLeaf(leaf);
    }
  }

  async activateReview() {
    const stats = this.flashcardManager.getStats();
    
    if (stats.due === 0) {
      new Notice('No cards due for review!');
      return;
    }

    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_REVIEW);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getLeaf(true);
      await leaf?.setViewState({
        type: VIEW_TYPE_REVIEW,
        active: true
      });
    }

    if (leaf) {
     void workspace.revealLeaf(leaf);
    }
  }

  async activateStats() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_STATS);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getLeaf('tab');
      await leaf?.setViewState({
        type: VIEW_TYPE_STATS,
        active: true
      });
    }

    if (leaf) {
     void workspace.revealLeaf(leaf);
    }
  }

  refreshOverview() {
    // 刷新侧边栏视图
    const sidebarLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SIDEBAR_OVERVIEW);
    sidebarLeaves.forEach(leaf => {
      const view = leaf.view as SidebarOverviewView;
      if (view && typeof view.refresh === 'function') {
        view.refresh();
      }
    });
  
    // 刷新主界面视图
    const mainLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MAIN_OVERVIEW);
    mainLeaves.forEach(leaf => {
      const view = leaf.view as SidebarOverviewView;
      if (view && typeof view.refresh === 'function') {
        view.refresh();
      }
    });
  }

  private setupStatusBar() {
    const statusBarItem = this.addStatusBarItem();
    statusBarItem.addClass('learning-system-status');
    
    const updateStatus = () => {
      const stats = this.flashcardManager.getStats();
      statusBarItem.setText(`🃏 ${stats.due} due`);
      statusBarItem.title = `${stats.due} cards due for review\n${stats.new} new cards`;
    };

    // 初始更新
    updateStatus();

    // 每分钟更新一次
    this.registerInterval(
      window.setInterval(updateStatus, 60000)
    );

    // 点击打开复习
    statusBarItem.addEventListener('click', () => {
     void this.activateReview();
    });
  }

  // 辅助方法：检查视图是否激活
  public isSidebarOverviewActive(): boolean {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE_SIDEBAR_OVERVIEW).length > 0;
  }

  public isMainOverviewActive(): boolean {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE_MAIN_OVERVIEW).length > 0;
  }
  private detectAndSetLanguage() {
    // 如果已经有语言设置,先检查是否需要更新
    const obsidianLang = (this.app.vault as unknown as ObsidianVaultWithConfig).getConfig('language')
    ?? localStorage.getItem('language')
    ?? 'en';
    
    // 映射到支持的语言
    const detectedLang: 'en' | 'zh-CN' = obsidianLang.startsWith('zh') ? 'zh-CN' : 'en';
    
    // 设置语言(如果未设置或需要更新)
    if (!this.settings.language || this.settings.language !== detectedLang) {
      this.settings.language = detectedLang;
      void this.saveSettings();
    }
  }
}