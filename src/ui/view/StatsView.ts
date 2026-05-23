// stasView.ts
import { App, ItemView, Modal, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import type LearningSystemPlugin from '../../main';
import { AnalyticsEngine } from '../../core/AnalyticsEngine';
import { t ,Language} from '../../i18n/translations';
import { setCssProps } from '../utils/setCssProps';


interface DailyStat {
  date: string;
  reviewed: number;
  correctRate: number;
}

interface HeatmapDay {
  date: string;
  count: number;
  intensity: number;
}
export const VIEW_TYPE_STATS = 'learning-system-stats';

export class StatsView extends ItemView {
  plugin: LearningSystemPlugin;
  private language: Language;
  private analytics: AnalyticsEngine;
  private currentTab: 'overview' | 'trends' | 'decks' | 'difficult'| 'history' = 'overview';

  constructor(leaf: WorkspaceLeaf, plugin: LearningSystemPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.language = this.plugin.settings.language || 'en';
    this.analytics = new AnalyticsEngine(plugin);
    
  }

  getViewType(): string {
    return VIEW_TYPE_STATS;
  }

  getDisplayText(): string {
    return 'Learning statistics';
  }

  getIcon(): string {
    return 'bar-chart';
  }

  async onOpen() {
      // 🎯 解锁系统检查点
  await this.plugin.unlockSystem.onStatsPageVisited();
    this.render();
  }

  async onClose() {}

  private render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('stats-container');

    // 标题栏
    const header = container.createDiv({ cls: 'stats-header' });
    header.createEl('h2', { text: 'Learning statistics' });

    // 刷新按钮
    const refreshBtn = header.createEl('button', {
      text: '⟳',
      cls: 'refresh-btn'
    });
    refreshBtn.addEventListener('click', () => this.render());

    // 标签页
    this.renderTabs(container);

    // 内容区域
    const content = container.createDiv({ cls: 'stats-content' });

    switch (this.currentTab) {
      case 'overview':
        this.renderOverview(content);
        break;
      case 'trends':
        this.renderTrends(content);
        break;
      case 'decks':
        this.renderDecks(content);
        break;
      case 'difficult':
        this.renderDifficult(content);
        break;
        case 'history':
          this.renderCycleHistory(content);
          break;    
    }
  }

  private renderTabs(container: Element) {
    const tabs = container.createDiv({ cls: 'stats-tabs' });

    const tabConfigs = [
      { id: 'overview', label: '📊 Overview' },
      { id: 'trends', label: '📈 Trends' },
      { id: 'decks', label: '📚 Decks' },
      { id: 'difficult', label: '⚠️ Difficult' },
      { id: 'history', label: '📜 Cycle History' }
    ];

    tabConfigs.forEach(config => {
      const tab = tabs.createDiv({
        cls: `tab ${this.currentTab === config.id ? 'active' : ''}`
      });
      tab.textContent = config.label;
      tab.addEventListener('click', () => {
        this.currentTab = config.id as typeof this.currentTab;
        this.render();
      });
    });
  }

  private renderOverview(container: HTMLElement) {
    const stats = this.plugin.flashcardManager.getStats();
    const { thisWeek, lastWeek } = this.analytics.getWeeklyStats();
    const dailyStats = this.analytics.getDailyStats(7);

    this.renderCycleBanner(container);

    // 关键指标卡片
    const metricsGrid = container.createDiv({ cls: 'metrics-grid' });

    this.createMetricCard(metricsGrid, {
      title: 'Total Cards',
      value: stats.total.toString(),
      icon: '🃏'
    });

    this.createMetricCard(metricsGrid, {
      title: 'Due Today',
      value: stats.due.toString(),
      icon: '📅'
    });

    this.createMetricCard(metricsGrid, {
      title: 'Reviewed Today',
      value: stats.reviewedToday.toString(),
      icon: '✅'
    });

    const streak = this.analytics.calculateStreak();
    this.createMetricCard(metricsGrid, {
      title: 'Current Streak',
      value: `${streak} days`,
      icon: '🔥'
    });

    // 本周 vs 上周
    const weekComparison = container.createDiv({ cls: 'week-comparison' });
    weekComparison.createEl('h3', { text: 'This week vs last week' });

    const comparisonGrid = weekComparison.createDiv({ cls: 'comparison-grid' });

    const reviewChange = thisWeek.totalReviews - lastWeek.totalReviews;
    const reviewChangePercent = lastWeek.totalReviews > 0
      ? ((reviewChange / lastWeek.totalReviews) * 100).toFixed(1)
      : '0';

    this.createComparisonItem(comparisonGrid, {
      label: 'Reviews',
      thisWeek: thisWeek.totalReviews,
      lastWeek: lastWeek.totalReviews,
      change: reviewChange,
      changePercent: reviewChangePercent
    });

    const rateChange = (thisWeek.averageCorrectRate - lastWeek.averageCorrectRate) * 100;
    this.createComparisonItem(comparisonGrid, {
      label: 'Correct Rate',
      thisWeek: `${(thisWeek.averageCorrectRate * 100).toFixed(1)}%`,
      lastWeek: `${(lastWeek.averageCorrectRate * 100).toFixed(1)}%`,
      change: rateChange,
      changePercent: rateChange.toFixed(1)
    });

    // 最近7天活动
    const recentActivity = container.createDiv({ cls: 'recent-activity' });
    recentActivity.createEl('h3', { text: 'Last 7 days activity' });

    const activityChart = recentActivity.createDiv({ cls: 'activity-chart' });
    this.renderSimpleBarChart(activityChart, dailyStats);

    // 生成报告按钮
    const reportSection = container.createDiv({ cls: 'report-section' });
    const reportBtn = reportSection.createEl('button', {
      text: '📄 generate full report',
      cls: 'mod-cta'
    });
    reportBtn.addEventListener('click', () => this.generateAndShowReport());
  
  // 清除统计按钮
const clearBtn = reportSection.createEl('button', {
  text: '🗑️ clear statistics',
  cls: 'mod-warning'
});
setCssProps(clearBtn, { 'margin-left': '10px' });
clearBtn.addEventListener('click', () => this.showClearStatsModal());
  }

  private renderTrends(container: HTMLElement) {
    container.createEl('h3', { text: 'Performance trends' });

    const dailyStats = this.analytics.getDailyStats(30);

    // 正确率趋势
    const correctRateSection = container.createDiv({ cls: 'chart-section' });
    correctRateSection.createEl('h4', { text: 'Correct rate (last 30 days)' });
    const correctRateChart = correctRateSection.createDiv({ cls: 'line-chart' });
    this.renderLineChart(correctRateChart, dailyStats, 'correctRate');

    // 每日复习量
    const reviewsSection = container.createDiv({ cls: 'chart-section' });
    reviewsSection.createEl('h4', { text: 'Daily reviews' });
    const reviewsChart = reviewsSection.createDiv({ cls: 'bar-chart' });
    this.renderBarChart(reviewsChart, dailyStats);

    // 热力图
    const heatmapSection = container.createDiv({ cls: 'chart-section' });
    heatmapSection.createEl('h4', { text: 'Study activity calendar' });
    const heatmap = heatmapSection.createDiv({ cls: 'heatmap' });
    this.renderHeatmap(heatmap);
  }

  private renderDecks(container: HTMLElement) {
    container.createEl('h3', { text: 'Deck statistics' });

    const deckStats = this.analytics.getDeckStats();

    if (deckStats.length === 0) {
      container.createDiv({ 
        text: 'No decks yet. Create some flashcards to see deck statistics!',
        cls: 'empty-message'
      });
      return;
    }

    const decksGrid = container.createDiv({ cls: 'decks-grid' });

    deckStats.forEach(deck => {
      const deckCard = decksGrid.createDiv({ cls: 'deck-card' });

      const header = deckCard.createDiv({ cls: 'deck-card-header' });
      header.createEl('h4', { text: deck.deckName });
      
      header.createSpan({
        text: `${deck.totalCards} cards`,
        cls: 'deck-badge'
      });

      const stats = deckCard.createDiv({ cls: 'deck-card-stats' });

      this.createStatRow(stats, 'Due', deck.dueCards.toString(), '📅');
      this.createStatRow(stats, 'New', deck.newCards.toString(), '🆕');
      this.createStatRow(
        stats, 
        'Correct Rate', 
        `${(deck.correctRate * 100).toFixed(1)}%`,
        '✅'
      );
      this.createStatRow(
        stats,
        'Avg Interval',
        `${deck.averageInterval.toFixed(1)} days`,
        '📊'
      );

      // 进度条
      const progress = deckCard.createDiv({ cls: 'deck-progress' });
      const masteredCount = deck.totalCards - deck.dueCards - deck.newCards;
      const masteredPercent = (masteredCount / deck.totalCards) * 100;
      
      const progressBar = progress.createDiv({ cls: 'progress-bar-container' });
      const bar = progressBar.createDiv({ cls: 'progress-bar-fill' });
      setCssProps(bar, { width: `${masteredPercent}%` });
      
      progress.createDiv({
        text: `${masteredPercent.toFixed(0)}% mastered`,
        cls: 'progress-label'
      });
    });
  }

  private renderDifficult(container: HTMLElement) {
    container.createEl('h3', { text: 'Cards needing attention' });

    const difficultCards = this.analytics.getDifficultCards(10);

    if (difficultCards.length === 0) {
      container.createDiv({
        text: '🎉 No difficult cards! Great job!',
        cls: 'empty-message'
      });
      return;
    }

    const cardsList = container.createDiv({ cls: 'difficult-cards-list' });

    difficultCards.forEach((dc, index) => {
      const cardItem = cardsList.createDiv({ cls: 'difficult-card-item' });

      const rank = cardItem.createDiv({ cls: 'card-rank' });
      rank.textContent = `${index + 1}`;

      const content = cardItem.createDiv({ cls: 'card-content' });
      
      const question = content.createDiv({ cls: 'card-question' });
      question.textContent = dc.card.front.substring(0, 80) + 
        (dc.card.front.length > 80 ? '...' : '');

      const meta = content.createDiv({ cls: 'card-meta' });

      const patternEmoji: Record<string, string> = {
        'concept': '🧠',
        'memory': '💭',
        'calculation': '🔢',
        'unknown': '❓'
      };

      meta.createSpan({
        text: `${patternEmoji[dc.pattern]} ${dc.pattern}`,
        cls: 'pattern-badge'
      });

      meta.createSpan({
        text: `${dc.errorCount} errors`,
        cls: 'error-count'
      });

      meta.createSpan({
        text: `${dc.averageTime.toFixed(1)}s avg`,
        cls: 'avg-time'
      });

      // 难度条
      const difficultyBar = content.createDiv({ cls: 'difficulty-bar-container' });
      const diffBar = difficultyBar.createDiv({ cls: 'difficulty-bar' });
      setCssProps(diffBar, { width: `${dc.card.stats.difficulty * 100}%` });

      // 操作按钮
      const actions = cardItem.createDiv({ cls: 'card-actions' });
      
      const jumpBtn = actions.createEl('button', {
        text: '↗',
        cls: 'action-btn-small'
      });
      jumpBtn.addEventListener('click', () => this.jumpToCard(dc.card));

      const reviewBtn = actions.createEl('button', {
        text: '🔄',
        cls: 'action-btn-small'
      });
      reviewBtn.addEventListener('click', () => {
       void this.plugin.activateReview();
      });

      const deleteBtn = actions.createEl('button', {
        text: '🗑️',
        cls: 'action-btn-small delete-btn'
      });
      deleteBtn.addEventListener('click', async () => {
        if (confirm(t('notice.flashcardDeleted', this.language))) {
          await this.deleteFlashcard(dc.card.id);
        }
      });
    });
  }

  private createMetricCard(
    container: HTMLElement,
    config: { title: string; value: string; icon: string }
  ) {
    const card = container.createDiv({ cls: 'metric-card' });
    
    card.createDiv({ text: config.icon, cls: 'metric-icon' });
    
    const content = card.createDiv({ cls: 'metric-content' });
    content.createDiv({ text: config.title, cls: 'metric-title' });
    content.createDiv({ text: config.value, cls: 'metric-value' });
  }

  private createComparisonItem(
    container: HTMLElement,
    config: {
      label: string;
      thisWeek: number | string;
      lastWeek: number | string;
      change: number;
      changePercent: string;
    }
  ) {
    // ⭐ 用 stat-comparison-item 避免与 reviewCardRender 的 .comparison-item 冲突
    //    (后者要求紧凑,前者要求 flex 宽布局)
    const item = container.createDiv({ cls: 'stat-comparison-item' });

    item.createDiv({ text: config.label, cls: 'comparison-label' });

    const values = item.createDiv({ cls: 'comparison-values' });
    values.createSpan({ 
      text: `${config.thisWeek}`,
      cls: 'this-week'
    });
    values.createSpan({ text: ' vs ', cls: 'vs' });
    values.createSpan({
      text: `${config.lastWeek}`,
      cls: 'last-week'
    });

    const changeClass = config.change > 0 ? 'positive' : config.change < 0 ? 'negative' : 'neutral';
    const changeIcon = config.change > 0 ? '↗' : config.change < 0 ? '↘' : '→';
    
    item.createDiv({
      text: `${changeIcon} ${config.changePercent}%`,
      cls: `change ${changeClass}`
    });
  }

  private createStatRow(
    container: HTMLElement,
    label: string,
    value: string,
    icon: string
  ) {
    const row = container.createDiv({ cls: 'stat-row' });
    row.createSpan({ text: icon, cls: 'stat-icon' });
    row.createSpan({ text: label, cls: 'stat-label' });
    row.createSpan({ text: value, cls: 'stat-value' });
  }

  private renderSimpleBarChart(container: HTMLElement, data: DailyStat[]) {
    const maxValue = Math.max(...data.map(d => d.reviewed));

    data.forEach(stat => {
      const bar = container.createDiv({ cls: 'simple-bar' });
      
      const date = new Date(stat.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      bar.createDiv({ text: dayName, cls: 'bar-label' });
      
      const barContainer = bar.createDiv({ cls: 'bar-container' });
      const barFill = barContainer.createDiv({ cls: 'bar-fill' });
      const height = maxValue > 0 ? (stat.reviewed / maxValue) * 100 : 0;
      setCssProps(barFill, { height: `${height}%` });
      
      bar.createDiv({ text: stat.reviewed.toString(), cls: 'bar-value' });
    });
  }

  private renderBarChart(container: HTMLElement, data: DailyStat[]) {
    const chart = container.createDiv({ cls: 'chart-canvas' });
    const maxValue = Math.max(...data.map(d => d.reviewed));

    data.forEach(stat => {
      const barGroup = chart.createDiv({ cls: 'bar-group' });
      
      const barContainer = barGroup.createDiv({ cls: 'bar' });
      const height = maxValue > 0 ? (stat.reviewed / maxValue) * 100 : 0;
      setCssProps(barContainer, { height: `${height}%` });
      barContainer.title = `${stat.reviewed} reviews`;
      
      const barLabel = barGroup.createDiv({ cls: 'bar-label' });
      const date = new Date(stat.date);
      barLabel.textContent = date.getDate().toString();
    });
  }

  private renderLineChart(container: HTMLElement, data: DailyStat[], key: keyof Pick<DailyStat, 'reviewed' | 'correctRate'>) {
    const chart = container.createDiv({ cls: 'line-chart-canvas' });
    
    const points = data.map((stat, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - (stat[key] * 100);
      return { x, y, value: stat[key] };
    });

    // 创建SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    setCssProps(svg as unknown as HTMLElement, { width: '100%', height: '200px' });

    // 创建折线路径
    const pathData = points.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--interactive-accent)');
    path.setAttribute('stroke-width', '2');

    svg.appendChild(path);
    chart.appendChild(svg);

    // 添加值标签
    const labelsContainer = container.createDiv({ cls: 'chart-labels' });
    data.forEach((stat, i) => {
      if (i % Math.ceil(data.length / 7) === 0) {
        const chartLabel = labelsContainer.createDiv({ cls: 'chart-label' });
        const date = new Date(stat.date);
        chartLabel.textContent = `${date.getMonth() + 1}/${date.getDate()}`;
      }
    });
  }

  private renderHeatmap(container: HTMLElement) {
    const heatmapData = this.analytics.getHeatmapData(90);
    
    // 按周分组
    const weeks: HeatmapDay[][] = [];
    let currentWeek: HeatmapDay[] = [];
    
    heatmapData.forEach((day, i) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || i === heatmapData.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    weeks.forEach(week => {
      const weekRow = container.createDiv({ cls: 'heatmap-week' });
      
      week.forEach(day => {
        const cell = weekRow.createDiv({ cls: 'heatmap-cell' });
        
        // 强度等级 0-4
        const level = Math.ceil(day.intensity * 4);
        cell.addClass(`level-${level}`);
        
        cell.title = `${day.date}: ${day.count} reviews`;
      });
    });
  }



  private async jumpToCard(card: { id: string; sourceFile: string; sourceContentId: string }) {
    const file = this.app.vault.getAbstractFileByPath(card.sourceFile);
    if (!(file instanceof TFile)) return;

    const contentUnit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
    if (!contentUnit) return;

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);

    setTimeout(() => {
      const view = this.app.workspace.getActiveViewOfType(ItemView);
      if (view) {
      
        const editor = (view as unknown as { 
          editor?: { 
            setCursor: (pos: { line: number; ch: number }) => void; 
            scrollIntoView: (range: { from: { line: number; ch: number }; to: { line: number; ch: number } }, center: boolean) => void 
          } 
        }).editor;
        
        if (editor) {
          editor.setCursor({ line: contentUnit.source.position.line, ch: 0 });
          editor.scrollIntoView({
            from: { line: contentUnit.source.position.line, ch: 0 },
            to: { line: contentUnit.source.position.line, ch: 0 }
          }, true);
        }
      }
    }, 100);
  }

  private async deleteFlashcard(cardId: string) {
    try {
      await this.plugin.flashcardManager.deleteCard(cardId);
      new Notice(t('notice.flashcardDeleted', this.language));
      this.render(); // 重新渲染视图
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      new Notice(t('notice.deleteFlashcardFailed', this.language));
    }
  }
  private showClearStatsModal() {
    const modal = new ClearStatsModal(this.app, {
      onAll: async () => {
        if (confirm('⚠️ This will reset ALL statistics and card progress. Are you sure?')) {
          await this.analytics.clearAllStats();
          new Notice('✅ all statistics cleared.');
          modal.close();
          this.render();
        }
      },
      onOld: async () => {
        if (confirm('Clear statistics older than 30 days?')) {
          await this.analytics.clearStatsBeforeDate(30);
          new Notice('✅ old statistics cleared.');
          modal.close();
          this.render();
        }
      },
      onDeck: () => {
        modal.close();
        this.showDeckSelectionModal();
      },
    });
    modal.open();
  }
  
  private showDeckSelectionModal() {
    const deckStats = this.analytics.getDeckStats();

    if (deckStats.length === 0) {
      new Notice('No decks available');
      return;
    }

    const modal = new DeckSelectionModal(this.app, deckStats, async (deckName) => {
      if (confirm(`Clear statistics for deck "${deckName}"?`)) {
        await this.analytics.clearDeckStats(deckName);
        new Notice(`✅ Statistics cleared for ${deckName}`);
        modal.close();
        this.render();
      }
    });
    modal.open();
  }
  private async generateAndShowReport() {
    const report = this.analytics.generateReport(30);
    
    // 创建一个新的文件来保存报告
    const fileName = `Learning Report ${new Date().toISOString().split('T')[0]}.md`;
    
    try {
      // 检查文件是否已存在
      let file = this.app.vault.getAbstractFileByPath(fileName);
      
      if (file instanceof TFile) {
        // 文件存在，询问是否覆盖
        if (!confirm(`Report "${fileName}" already exists. Overwrite?`)) {
          return;
        }
        await this.app.vault.modify(file, report);
      } else {
        // 创建新文件
        file = await this.app.vault.create(fileName, report);
      }
      
      // 打开报告文件
      const leaf = this.app.workspace.getLeaf(false);
      if (file instanceof TFile) {
        await leaf.openFile(file);
      }
      
      new Notice('📊 report generated.');
    } catch (error) {
      console.error('Error generating report:', error);
      new Notice('❌ failed to generate report.');
    }

  }
  private renderCycleBanner(container: HTMLElement) {
    const cycleInfo = this.analytics.getCurrentCycleInfo();
    
    const banner = container.createDiv({ cls: 'cycle-info-banner' });
    
    const badge = banner.createDiv({ cls: 'cycle-badge' });
    badge.textContent = `Cycle ${cycleInfo.currentCycle}`;
    
    const stats = banner.createDiv({ cls: 'cycle-stats' });
    const daysSince = Math.floor(
      (Date.now() - new Date(cycleInfo.startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    stats.textContent = `Day ${daysSince} · ${cycleInfo.reviewsThisCycle} reviews`;
    
    const btn = banner.createEl('button', {
      text: 'Start new cycle',
      cls: 'start-new-cycle-btn'
    });
    
    btn.addEventListener('click', () => this.confirmStartNewCycle());
  }

  private confirmStartNewCycle() {
    const nextCycle = this.analytics.getCurrentCycleNumber() + 1;
    const modal = new ConfirmNewCycleModal(this.app, nextCycle, async () => {
      await this.analytics.startNewCycle();
      new Notice('✨ new learning cycle started!');
      modal.close();
      this.render();
    });
    modal.open();
  }

  private renderCycleHistory(container: HTMLElement) {
    container.createEl('h3', { text: '📜 learning cycle history' });
  
    const cycles = this.analytics.getArchivedCycles();
    
    if (cycles.length === 0) {
      container.createDiv({
        text: '📝 No archived cycles yet. Complete your first cycle to see history!',
        cls: 'empty-message'
      });
      return;
    }
  
    const cyclesList = container.createDiv({ cls: 'cycles-list' });
  
    cycles.forEach(cycle => {
      const cycleCard = cyclesList.createDiv({ cls: 'cycle-card' });
  
      // 卡片头部
      const header = cycleCard.createDiv({ cls: 'cycle-card-header' });
      header.createEl('h4', { text: `Cycle ${cycle.cycleNumber}` });
      
      const duration = this.formatDateRange(cycle.startDate, cycle.endDate);
      const badge = header.createSpan({ cls: 'cycle-duration' });
      badge.textContent = duration;
  
      // 关键指标
      const stats = cycleCard.createDiv({ cls: 'cycle-card-stats' });
      
      this.createStatRow(stats, 'Reviews', cycle.totalReviews.toString(), '📝');
      this.createStatRow(stats, 'Cards', cycle.totalCards.toString(), '🃏');
      this.createStatRow(
        stats, 
        'Correct Rate',
        `${(cycle.correctRate * 100).toFixed(1)}%`,
        '✅'
      );
  
      // 查看详情按钮
      const actions = cycleCard.createDiv({ cls: 'cycle-card-actions' });
      const detailBtn = actions.createEl('button', {
        text: '📊 view details',
        cls: 'mod-cta'
      });
      detailBtn.addEventListener('click', () => this.showCycleDetails(cycle.cycleNumber));
    });
  }
  
  private formatDateRange(start: string | undefined, end: string | undefined): string {
    if (!start || !end) return 'Unknown';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const formatOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('en-US', formatOpts)} - ${endDate.toLocaleDateString('en-US', formatOpts)} (${days}d)`;
  }
  
  private showCycleDetails(cycleNumber: number) {
    const details = this.analytics.getCycleDetails(cycleNumber);
    if (!details) {
      new Notice('Cycle data not found');
      return;
    }

    const { cycle, dailyStats, deckStats } = details;
    const avgCorrectRate = dailyStats.length > 0
      ? dailyStats.reduce((sum, d) => sum + d.correctRate, 0) / dailyStats.length
      : 0;

    new CycleDetailsModal(
      this.app,
      {
        cycleNumber,
        durationText: this.formatDateRange(cycle.startDate, cycle.endDate),
        totalReviews: cycle.totalReviews,
        avgCorrectRate,
        totalCards: cycle.totalCards,
        dailyStats: dailyStats.slice(-14),
        deckStats,
      },
      (chartEl, recentDays) => this.renderSimpleBarChart(chartEl, recentDays),
    ).open();
  }


}

// ==================== Modal 子类(取代自建 div + document.body.appendChild)====================

interface ClearStatsCallbacks {
  onAll: () => void | Promise<void>;
  onOld: () => void | Promise<void>;
  onDeck: () => void;
}

class ClearStatsModal extends Modal {
  constructor(app: App, private callbacks: ClearStatsCallbacks) {
    super(app);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Clear statistics' });
    contentEl.createEl('p', { text: 'Choose what statistics to clear:' });
    const opts = contentEl.createDiv({ cls: 'clear-options' });
    const all = opts.createEl('button', { cls: 'clear-option-btn' });
    all.appendText('🗑️ Clear all statistics');
    all.createSpan({ cls: 'option-desc', text: 'Reset all cards and review logs' });
    all.addEventListener('click', () => void this.callbacks.onAll());

    const old = opts.createEl('button', { cls: 'clear-option-btn' });
    old.appendText('📅 Clear old data (30+ days)');
    old.createSpan({ cls: 'option-desc', text: 'Keep recent 30 days only' });
    old.addEventListener('click', () => void this.callbacks.onOld());

    const deck = opts.createEl('button', { cls: 'clear-option-btn' });
    deck.appendText('📚 Clear specific deck');
    deck.createSpan({ cls: 'option-desc', text: 'Choose a deck to reset' });
    deck.addEventListener('click', () => this.callbacks.onDeck());

    const btns = contentEl.createDiv({ cls: 'modal-button-container' });
    const cancel = btns.createEl('button', { cls: 'mod-cta', text: 'Cancel' });
    cancel.addEventListener('click', () => this.close());
  }
  onClose() { this.contentEl.empty(); }
}

class DeckSelectionModal extends Modal {
  constructor(
    app: App,
    private decks: { deckName: string; totalCards: number }[],
    private onPick: (deckName: string) => void | Promise<void>,
  ) { super(app); }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Select deck to clear' });
    const opts = contentEl.createDiv({ cls: 'clear-options' });
    for (const deck of this.decks) {
      const btn = opts.createEl('button', { cls: 'clear-option-btn deck-option' });
      btn.appendText(`📚 ${deck.deckName}`);
      btn.createSpan({ cls: 'option-desc', text: `${deck.totalCards} cards` });
      btn.addEventListener('click', () => void this.onPick(deck.deckName));
    }
    const btns = contentEl.createDiv({ cls: 'modal-button-container' });
    const cancel = btns.createEl('button', { cls: 'mod-cta', text: 'Cancel' });
    cancel.addEventListener('click', () => this.close());
  }
  onClose() { this.contentEl.empty(); }
}

class ConfirmNewCycleModal extends Modal {
  constructor(app: App, private nextCycle: number, private onConfirm: () => void | Promise<void>) {
    super(app);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: '🔄 start new learning cycle' });
    contentEl.createEl('p', { text: 'This will:' });
    const ul = contentEl.createEl('ul');
    ul.createEl('li', { text: '✅ archive current cycle data (read-only)' });
    ul.createEl('li', { text: '✅ reset current stats to zero' });
    ul.createEl('li', { text: '✅ keep all flashcard progress' });
    ul.createEl('li', { text: '⚠️ cannot be undone' });
    contentEl.createEl('p', { text: `Start fresh with Cycle ${this.nextCycle}?` });

    const btns = contentEl.createDiv({ cls: 'modal-button-container' });
    const cancel = btns.createEl('button', { cls: 'mod-warning', text: 'Cancel' });
    cancel.addEventListener('click', () => this.close());
    const confirm = btns.createEl('button', { cls: 'mod-cta', text: 'Start new cycle' });
    confirm.addEventListener('click', () => void this.onConfirm());
  }
  onClose() { this.contentEl.empty(); }
}

interface CycleDetailsData {
  cycleNumber: number;
  durationText: string;
  totalReviews: number;
  avgCorrectRate: number;
  totalCards: number;
  dailyStats: DailyStat[];
  deckStats: { deckName: string; totalCards: number; correctRate: number }[];
}

class CycleDetailsModal extends Modal {
  constructor(
    app: App,
    private data: CycleDetailsData,
    private renderChart: (el: HTMLElement, days: DailyStat[]) => void,
  ) { super(app); }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('cycle-details-modal');
    contentEl.createEl('h2', { text: `📊 cycle ${this.data.cycleNumber} details` });

    const dur = contentEl.createDiv({ cls: 'cycle-detail-section' });
    dur.createEl('h4', { text: '📅 duration' });
    dur.createEl('p', { text: this.data.durationText });

    const metrics = contentEl.createDiv({ cls: 'cycle-detail-section' });
    metrics.createEl('h4', { text: '📈 key metrics' });
    const grid = metrics.createDiv({ cls: 'metrics-grid-small' });
    const add = (label: string, value: string) => {
      const m = grid.createDiv({ cls: 'metric-small' });
      m.createSpan({ cls: 'metric-label', text: label });
      m.createSpan({ cls: 'metric-value', text: value });
    };
    add('Total reviews', String(this.data.totalReviews));
    add('Avg correct rate', `${(this.data.avgCorrectRate * 100).toFixed(1)}%`);
    add('Total cards', String(this.data.totalCards));

    const activity = contentEl.createDiv({ cls: 'cycle-detail-section' });
    activity.createEl('h4', { text: '📊 daily activity' });
    const chartEl = activity.createDiv({ cls: 'cycle-daily-chart' });
    this.renderChart(chartEl, this.data.dailyStats);

    const decks = contentEl.createDiv({ cls: 'cycle-detail-section' });
    decks.createEl('h4', { text: '📚 deck breakdown' });
    const deckEl = decks.createDiv({ cls: 'cycle-deck-stats' });
    if (this.data.deckStats.length === 0) {
      deckEl.setText('No deck data available');
    } else {
      for (const d of this.data.deckStats) {
        const row = deckEl.createDiv({ cls: 'deck-stat-row' });
        row.createSpan({ text: d.deckName, cls: 'deck-name' });
        const info = row.createDiv({ cls: 'deck-info' });
        info.createSpan({ text: `${d.totalCards} cards`, cls: 'deck-detail' });
        info.createSpan({ text: `${(d.correctRate * 100).toFixed(1)}% correct`, cls: 'deck-detail' });
      }
    }

    const btns = contentEl.createDiv({ cls: 'modal-button-container' });
    const close = btns.createEl('button', { cls: 'mod-cta', text: 'Close' });
    close.addEventListener('click', () => this.close());
  }
  onClose() { this.contentEl.empty(); }
}
