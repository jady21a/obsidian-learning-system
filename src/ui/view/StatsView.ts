// stasView.ts
import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import type LearningSystemPlugin from '../../main';
import { AnalyticsEngine } from '../../core/AnalyticsEngine';

export const VIEW_TYPE_STATS = 'learning-system-stats';

export class StatsView extends ItemView {
  plugin: LearningSystemPlugin;
  private analytics: AnalyticsEngine;
  private currentTab: 'overview' | 'trends' | 'decks' | 'difficult' = 'overview';

  constructor(leaf: WorkspaceLeaf, plugin: LearningSystemPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.analytics = new AnalyticsEngine(plugin);
  }

  getViewType(): string {
    return VIEW_TYPE_STATS;
  }

  getDisplayText(): string {
    return 'Learning Statistics';
  }

  getIcon(): string {
    return 'bar-chart';
  }

  async onOpen() {
      // 🎯 解锁系统检查点
  await this.plugin.unlockSystem.onStatsPageVisited();
    this.render();
    this.addStyles();
  }

  async onClose() {}

  private render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('stats-container');

    // 标题栏
    const header = container.createDiv({ cls: 'stats-header' });
    header.createEl('h2', { text: '📊 Learning Statistics' });

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
    }
  }

  private renderTabs(container: Element) {
    const tabs = container.createDiv({ cls: 'stats-tabs' });

    const tabConfigs = [
      { id: 'overview', label: '📊 Overview' },
      { id: 'trends', label: '📈 Trends' },
      { id: 'decks', label: '📚 Decks' },
      { id: 'difficult', label: '⚠️ Difficult' }
    ];

    tabConfigs.forEach(config => {
      const tab = tabs.createDiv({
        cls: `tab ${this.currentTab === config.id ? 'active' : ''}`
      });
      tab.textContent = config.label;
      tab.addEventListener('click', () => {
        this.currentTab = config.id as any;
        this.render();
      });
    });
  }

  private renderOverview(container: HTMLElement) {
    const stats = this.plugin.flashcardManager.getStats();
    const { thisWeek, lastWeek } = this.analytics.getWeeklyStats();
    const dailyStats = this.analytics.getDailyStats(7);

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
    weekComparison.createEl('h3', { text: 'This Week vs Last Week' });

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
    recentActivity.createEl('h3', { text: 'Last 7 Days Activity' });

    const activityChart = recentActivity.createDiv({ cls: 'activity-chart' });
    this.renderSimpleBarChart(activityChart, dailyStats);

    // 生成报告按钮
    const reportSection = container.createDiv({ cls: 'report-section' });
    const reportBtn = reportSection.createEl('button', {
      text: '📄 Generate Full Report',
      cls: 'mod-cta'
    });
    reportBtn.addEventListener('click', () => this.generateAndShowReport());
  
  // 清除统计按钮
const clearBtn = reportSection.createEl('button', {
  text: '🗑️ Clear Statistics',
  cls: 'mod-warning'
});
clearBtn.style.marginLeft = '10px';
clearBtn.addEventListener('click', () => this.showClearStatsModal());
  }

  private renderTrends(container: HTMLElement) {
    container.createEl('h3', { text: 'Performance Trends' });

    const dailyStats = this.analytics.getDailyStats(30);

    // 正确率趋势
    const correctRateSection = container.createDiv({ cls: 'chart-section' });
    correctRateSection.createEl('h4', { text: 'Correct Rate (Last 30 Days)' });
    const correctRateChart = correctRateSection.createDiv({ cls: 'line-chart' });
    this.renderLineChart(correctRateChart, dailyStats, 'correctRate');

    // 每日复习量
    const reviewsSection = container.createDiv({ cls: 'chart-section' });
    reviewsSection.createEl('h4', { text: 'Daily Reviews' });
    const reviewsChart = reviewsSection.createDiv({ cls: 'bar-chart' });
    this.renderBarChart(reviewsChart, dailyStats);

    // 热力图
    const heatmapSection = container.createDiv({ cls: 'chart-section' });
    heatmapSection.createEl('h4', { text: 'Study Activity Calendar' });
    const heatmap = heatmapSection.createDiv({ cls: 'heatmap' });
    this.renderHeatmap(heatmap);
  }

  private renderDecks(container: HTMLElement) {
    container.createEl('h3', { text: 'Deck Statistics' });

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
      bar.style.width = `${masteredPercent}%`;
      
      progress.createDiv({
        text: `${masteredPercent.toFixed(0)}% mastered`,
        cls: 'progress-label'
      });
    });
  }

  private renderDifficult(container: HTMLElement) {
    container.createEl('h3', { text: 'Cards Needing Attention' });

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
      diffBar.style.width = `${dc.card.stats.difficulty * 100}%`;

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
        this.plugin.activateReview();
      });

      const deleteBtn = actions.createEl('button', {
        text: '🗑️',
        cls: 'action-btn-small delete-btn'
      });
      deleteBtn.addEventListener('click', async () => {
        if (confirm('确定要删除这张闪卡吗？')) {
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
    const item = container.createDiv({ cls: 'comparison-item' });
    
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

  private renderSimpleBarChart(container: HTMLElement, data: any[]) {
    const maxValue = Math.max(...data.map(d => d.reviewed));

    data.forEach(stat => {
      const bar = container.createDiv({ cls: 'simple-bar' });
      
      const date = new Date(stat.date);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      bar.createDiv({ text: dayName, cls: 'bar-label' });
      
      const barContainer = bar.createDiv({ cls: 'bar-container' });
      const barFill = barContainer.createDiv({ cls: 'bar-fill' });
      const height = maxValue > 0 ? (stat.reviewed / maxValue) * 100 : 0;
      barFill.style.height = `${height}%`;
      
      bar.createDiv({ text: stat.reviewed.toString(), cls: 'bar-value' });
    });
  }

  private renderBarChart(container: HTMLElement, data: any[]) {
    const chart = container.createDiv({ cls: 'chart-canvas' });
    const maxValue = Math.max(...data.map(d => d.reviewed));

    data.forEach(stat => {
      const barGroup = chart.createDiv({ cls: 'bar-group' });
      
      const barContainer = barGroup.createDiv({ cls: 'bar' });
      const height = maxValue > 0 ? (stat.reviewed / maxValue) * 100 : 0;
      barContainer.style.height = `${height}%`;
      barContainer.title = `${stat.reviewed} reviews`;
      
      const barLabel = barGroup.createDiv({ cls: 'bar-label' });
      const date = new Date(stat.date);
      barLabel.textContent = date.getDate().toString();
    });
  }

  private renderLineChart(container: HTMLElement, data: any[], key: string) {
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
    svg.style.width = '100%';
    svg.style.height = '200px';

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
    const weeks: any[][] = [];
    let currentWeek: any[] = [];
    
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



  private async jumpToCard(card: any) {
    const file = this.app.vault.getAbstractFileByPath(card.sourceFile);
    if (!(file instanceof TFile)) return;

    const contentUnit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
    if (!contentUnit) return;

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);

    setTimeout(() => {
      const view = this.app.workspace.getActiveViewOfType(ItemView);
      if (view) {
        const editor = (view as any).editor;
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
      new Notice('🗑️ 闪卡已删除');
      this.render(); // 重新渲染视图
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      new Notice('❌ 删除闪卡失败');
    }
  }
  private showClearStatsModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-container';
    modal.innerHTML = `
      <div class="modal-bg"></div>
      <div class="modal">
        <div class="modal-title">Clear Statistics</div>
        <div class="modal-content">
          <p>Choose what statistics to clear:</p>
          <div class="clear-options">
            <button class="clear-option-btn" data-action="all">
              🗑️ Clear All Statistics
              <span class="option-desc">Reset all cards and review logs</span>
            </button>
            <button class="clear-option-btn" data-action="old">
              📅 Clear Old Data (30+ days)
              <span class="option-desc">Keep recent 30 days only</span>
            </button>
            <button class="clear-option-btn" data-action="deck">
              📚 Clear Specific Deck
              <span class="option-desc">Choose a deck to reset</span>
            </button>
          </div>
        </div>
        <div class="modal-button-container">
          <button class="mod-cta cancel-btn">Cancel</button>
        </div>
      </div>
    `;
  
    document.body.appendChild(modal);
  
    // 取消按钮
    modal.querySelector('.cancel-btn')?.addEventListener('click', () => {
      modal.remove();
    });
  
    // 清除所有统计
    modal.querySelector('[data-action="all"]')?.addEventListener('click', async () => {
      if (confirm('⚠️ This will reset ALL statistics and card progress. Are you sure?')) {
        await this.analytics.clearAllStats();
        new Notice('✅ All statistics cleared');
        modal.remove();
        this.render();
      }
    });
  
    // 清除旧数据
    modal.querySelector('[data-action="old"]')?.addEventListener('click', async () => {
      if (confirm('Clear statistics older than 30 days?')) {
        await this.analytics.clearStatsBeforeDate(30);
        new Notice('✅ Old statistics cleared');
        modal.remove();
        this.render();
      }
    });
  
    // 清除特定卡组
    modal.querySelector('[data-action="deck"]')?.addEventListener('click', () => {
      modal.remove();
      this.showDeckSelectionModal();
    });
  
    // 点击背景关闭
    modal.querySelector('.modal-bg')?.addEventListener('click', () => {
      modal.remove();
    });
  }
  
  private showDeckSelectionModal() {
    const deckStats = this.analytics.getDeckStats();
    
    if (deckStats.length === 0) {
      new Notice('No decks available');
      return;
    }
  
    const modal = document.createElement('div');
    modal.className = 'modal-container';
    
    let optionsHtml = '';
    deckStats.forEach(deck => {
      optionsHtml += `
        <button class="clear-option-btn deck-option" data-deck="${deck.deckName}">
          📚 ${deck.deckName}
          <span class="option-desc">${deck.totalCards} cards</span>
        </button>
      `;
    });
  
    modal.innerHTML = `
      <div class="modal-bg"></div>
      <div class="modal">
        <div class="modal-title">Select Deck to Clear</div>
        <div class="modal-content">
          <div class="clear-options">
            ${optionsHtml}
          </div>
        </div>
        <div class="modal-button-container">
          <button class="mod-cta cancel-btn">Cancel</button>
        </div>
      </div>
    `;
  
    document.body.appendChild(modal);
  
    // 取消按钮
    modal.querySelector('.cancel-btn')?.addEventListener('click', () => {
      modal.remove();
    });
  
    // 卡组选项
    modal.querySelectorAll('.deck-option').forEach(btn => {
      btn.addEventListener('click', async () => {
        const deckName = (btn as HTMLElement).dataset.deck;
        if (deckName && confirm(`Clear statistics for deck "${deckName}"?`)) {
          await this.analytics.clearDeckStats(deckName);
          new Notice(`✅ Statistics cleared for ${deckName}`);
          modal.remove();
          this.render();
        }
      });
    });
  
    // 点击背景关闭
    modal.querySelector('.modal-bg')?.addEventListener('click', () => {
      modal.remove();
    });
    
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
      await leaf.openFile(file as TFile);
      
      new Notice('📊 Report generated!');
    } catch (error) {
      console.error('Error generating report:', error);
      new Notice('❌ Failed to generate report');
    }
  }
  private addStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .stats-container {
        padding: 20px;
        overflow-y: auto;
      }

      .stats-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }

      .stats-header h2 {
        margin: 0;
      }

      .stats-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 20px;
        border-bottom: 2px solid var(--background-modifier-border);
      }

      .tab {
        padding: 10px 20px;
        cursor: pointer;
        border-bottom: 3px solid transparent;
        transition: all 0.2s;
        user-select: none;
      }

      .tab:hover {
        background: var(--background-modifier-hover);
      }

      .tab.active {
        border-bottom-color: var(--interactive-accent);
        color: var(--interactive-accent);
        font-weight: 600;
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 30px;
      }

      .metric-card {
        padding: 20px;
        background: var(--background-secondary);
        border-radius: 8px;
        display: flex;
        gap: 15px;
        align-items: center;
      }

      .metric-icon {
        font-size: 32px;
      }

      .metric-content {
        flex: 1;
      }

      .metric-title {
        font-size: 0.9em;
        color: var(--text-muted);
        margin-bottom: 5px;
      }

      .metric-value {
        font-size: 1.8em;
        font-weight: 600;
      }

      .week-comparison {
        margin-bottom: 30px;
      }

      .comparison-grid {
        display: flex;
        flex-direction: column;
        gap: 15px;
        margin-top: 15px;
      }

      .comparison-item {
        padding: 15px;
        background: var(--background-secondary);
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .comparison-label {
        font-weight: 500;
      }

      .comparison-values {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .this-week {
        font-weight: 600;
        font-size: 1.1em;
      }

      .last-week {
        color: var(--text-muted);
      }

      .change {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.9em;
        font-weight: 500;
      }

      .change.positive {
        background: var(--background-modifier-success);
        color: var(--text-on-accent);
      }

      .change.negative {
        background: var(--background-modifier-error);
        color: white;
      }

      .chart-section {
        margin-bottom: 30px;
      }

      .recent-activity .activity-chart {
        display: flex;
        justify-content: space-around;
        align-items: flex-end;
        height: 150px;
        padding: 20px;
        background: var(--background-secondary);
        border-radius: 8px;
      }

      .simple-bar {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        flex: 1;
      }

      .simple-bar .bar-container {
        width: 100%;
        height: 100px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
      }

      .simple-bar .bar-fill {
        width: 60%;
        background: var(--interactive-accent);
        border-radius: 4px 4px 0 0;
        transition: height 0.3s;
      }

      .bar-label, .bar-value {
        font-size: 0.85em;
        color: var(--text-muted);
      }

      .heatmap {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 15px;
        background: var(--background-secondary);
        border-radius: 8px;
      }

      .heatmap-week {
        display: flex;
        gap: 4px;
      }

      .heatmap-cell {
        width: 12px;
        height: 12px;
        background: var(--background-primary);
        border-radius: 2px;
        cursor: pointer;
      }

      .heatmap-cell.level-1 { background: rgba(94, 156, 235, 0.3); }
      .heatmap-cell.level-2 { background: rgba(94, 156, 235, 0.5); }
      .heatmap-cell.level-3 { background: rgba(94, 156, 235, 0.7); }
      .heatmap-cell.level-4 { background: rgba(94, 156, 235, 1); }

      .decks-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 15px;
      }

      .deck-card {
        padding: 20px;
        background: var(--background-secondary);
        border-radius: 8px;
        border: 1px solid var(--background-modifier-border);
      }

      .deck-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--background-modifier-border);
      }

      .deck-card-header h4 {
        margin: 0;
      }

      .deck-badge {
        padding: 4px 10px;
        background: var(--interactive-accent);
        color: white;
        border-radius: 12px;
        font-size: 0.85em;
      }

      .deck-card-stats {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 15px;
      }

      .stat-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .stat-icon {
        width: 20px;
      }

      .stat-label {
        flex: 1;
        color: var(--text-muted);
      }

      .stat-value {
        font-weight: 500;
      }

      .deck-progress {
        margin-top: 15px;
      }

      .progress-bar-container {
        height: 8px;
        background: var(--background-primary);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 5px;
      }

      .progress-bar-fill {
        height: 100%;
        background: var(--interactive-accent);
        transition: width 0.3s;
      }

      .progress-label {
        font-size: 0.85em;
        color: var(--text-muted);
      }

      .difficult-cards-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .difficult-card-item {
        display: flex;
        gap: 15px;
        padding: 15px;
        background: var(--background-secondary);
        border-radius: 8px;
        border: 1px solid var(--background-modifier-border);
      }

      .card-rank {
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--interactive-accent);
        color: white;
        border-radius: 50%;
        font-weight: 600;
        flex-shrink: 0;
      }

      .card-content {
        flex: 1;
      }

      .card-question {
        font-weight: 500;
        margin-bottom: 8px;
      }

      .card-meta {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom:8px;
      } 

.pattern-badge, .error-count, .avg-time {
    padding: 3px 10px;
    background: var(--background-primary);
    border-radius: 12px;
    font-size: 0.85em;
  }

  .difficulty-bar-container {
    height: 6px;
    background: var(--background-primary);
    border-radius: 3px;
    overflow: hidden;
  }

  .difficulty-bar {
    height: 100%;
    background: linear-gradient(to right, var(--color-green), var(--color-yellow), var(--color-red));
    transition: width 0.3s;
  }

  .card-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn-small {
    padding: 6px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn-small:hover {
    background: var(--interactive-accent);
    color: white;
    border-color: var(--interactive-accent);
  }

  .action-btn-small.delete-btn:hover {
    background: var(--color-red);
    border-color: var(--color-red);
    color: white;
  }

  .empty-message {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
    font-size: 1.1em;
  }

  .report-section {
    text-align: center;
    margin-top: 30px;
    padding: 20px;
  }

  .chart-canvas {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 200px;
    padding: 20px;
    background: var(--background-secondary);
    border-radius: 8px;
    margin-bottom: 10px;
  }

  .bar-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    height: 100%;
  }

  .bar-group .bar {
    width: 80%;
    background: var(--interactive-accent);
    border-radius: 4px 4px 0 0;
    transition: height 0.3s;
    margin-top: auto;
  }

  .line-chart-canvas {
    background: var(--background-secondary);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 10px;
  }

  .chart-labels {
    display: flex;
    justify-content: space-around;
    padding: 10px 20px;
    background: var(--background-secondary);
    border-radius: 8px;
  }

  .chart-label {
    font-size: 0.85em;
    color: var(--text-muted);
  }
    .modal-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal {
  position: relative;
  background: var(--background-primary);
  border-radius: 8px;
  padding: 20px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-title {
  font-size: 1.5em;
  font-weight: 600;
  margin-bottom: 15px;
}

.modal-content {
  margin-bottom: 20px;
}

.clear-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 15px;
}

.clear-option-btn {
  padding: 15px;
  background: var(--background-secondary);
  border: 2px solid var(--background-modifier-border);
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.clear-option-btn:hover {
  border-color: var(--interactive-accent);
  background: var(--background-modifier-hover);
}

.option-desc {
  font-size: 0.85em;
  color: var(--text-muted);
}

.modal-button-container {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
`;

document.head.appendChild(styleEl);
  }}