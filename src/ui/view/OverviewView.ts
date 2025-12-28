// overview View.ts
import { ItemView, WorkspaceLeaf, TFile, Menu, Modal, App, Notice } from 'obsidian';
import type LearningSystemPlugin from '../../main';
import { ContentUnit } from '../../core/DataManager';
import { QuickFlashcardCreator } from '../../core/QuickFlashcardCreator';
import { overviewStyle } from '../style/overviewStyle';

export const VIEW_TYPE_OVERVIEW = 'learning-system-overview';

export class OverviewView extends ItemView {
  plugin: LearningSystemPlugin;
//   private contentEl: HTMLElement;
  private groupBy: 'file' | 'tag' | 'date' = 'file';
  private searchQuery: string = '';
  private quickCreator: QuickFlashcardCreator;
  private batchMode: boolean = false;
  private selectedUnitIds: Set<string> = new Set();

  constructor(leaf: WorkspaceLeaf, plugin: LearningSystemPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.quickCreator = new QuickFlashcardCreator(plugin);
  }

  getViewType(): string {
    return VIEW_TYPE_OVERVIEW;
  }

  getDisplayText(): string {
    return 'Learning Overview';
  }

  getIcon(): string {
    return 'layout-list';
  }

  async onOpen() {
    console.log('📖 OverviewView opened');
    const container = this.containerEl.children[1];
    container.empty();

    this.createToolbar(container);
    this.contentEl = container.createDiv({ cls: 'learning-system-content' });
    this.checkDailyReview();
    await this.refresh();
    overviewStyle.inject();
  }

  async onClose() {
    console.log('📕 OverviewView closed');

  }


  // 添加到 OverviewView 类中
scrollToFile(filePath: string) {
    // this.selectedFile = filePath; // 如果你有这个属性
    
    // 滚动到对应的文件组
    setTimeout(() => {
      const fileGroups = this.contentEl.querySelectorAll('.file-group');
      fileGroups.forEach((group) => {
        const header = group.querySelector('.group-header');
        if (header?.textContent?.includes(filePath.split('/').pop()?.replace('.md', '') || '')) {
          group.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }, 100);

  }

  private createToolbar(container: Element) {
    const toolbar = container.createDiv({ cls: 'learning-system-toolbar' });

    const searchContainer = toolbar.createDiv({ cls: 'search-container' });
    const searchInput = searchContainer.createEl('input', {
      type: 'text',
      placeholder: 'Search content...',
      cls: 'search-input'
    });

    searchInput.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.refresh();
    });

    const groupContainer = toolbar.createDiv({ cls: 'group-container' });
    groupContainer.createSpan({ text: 'Group by: ', cls: 'group-label' });

    const groupSelect = groupContainer.createEl('select', { cls: 'group-select' });
    const options = [
      { value: 'file', label: 'File' },
      { value: 'tag', label: 'Tag' },
      { value: 'date', label: 'Date' }
    ];

    options.forEach(opt => {
      const option = groupSelect.createEl('option', {
        value: opt.value,
        text: opt.label
      });
      if (opt.value === this.groupBy) {
        option.selected = true;
      }
    });

    groupSelect.addEventListener('change', (e) => {
      this.groupBy = (e.target as HTMLSelectElement).value as any;
      this.refresh();
    });

    // 批量操作按钮（移到前面）
    const batchActions = toolbar.createDiv({ cls: 'batch-actions-overview' });
    
    const batchModeBtn = batchActions.createEl('button', {
      text: this.batchMode ? '✓ Done' : '☐ Batch Mode',
      cls: 'batch-mode-btn'
    });
    batchModeBtn.addEventListener('click', () => {
      this.batchMode = !this.batchMode;
      if (!this.batchMode) {
        this.selectedUnitIds.clear();
      }
      this.refresh();
    });

    if (this.batchMode) {
      // 全选/取消全选按钮
      const selectAllBtn = batchActions.createEl('button', {
        text: this.isAllSelected() ? '☑ Deselect All' : '☐ Select All',
        cls: 'select-all-btn'
      });
      selectAllBtn.addEventListener('click', () => {
        this.toggleSelectAll();
      });

      const batchDeleteBtn = batchActions.createEl('button', {
        text: `🗑️ Delete (${this.selectedUnitIds.size})`,
        cls: 'batch-delete-btn'
      });
      batchDeleteBtn.addEventListener('click', () => {
        this.batchDeleteNotes();
      });

      const batchCreateBtn = batchActions.createEl('button', {
        text: `⚡ Create Cards (${this.selectedUnitIds.size})`,
        cls: 'batch-create-cards-btn'
      });
      batchCreateBtn.addEventListener('click', () => {
        this.batchCreateFlashcards();
      });
    } else {
      const batchCreateAllBtn = batchActions.createEl('button', {
        text: '⚡ Batch Create Cards',
        cls: 'batch-create-btn'
      });
      batchCreateAllBtn.addEventListener('click', () => this.showBatchCreateModal());
    }

    const refreshBtn = toolbar.createEl('button', {
      text: '⟳',
      cls: 'refresh-btn'
    });
    refreshBtn.addEventListener('click', () => this.refresh());

    const stats = toolbar.createDiv({ cls: 'stats-container' });
    const totalCount = this.plugin.dataManager.getAllContentUnits().length;
    stats.createSpan({ text: `Total: ${totalCount}`, cls: 'stats-text' });
  }

  async refresh() {
    this.contentEl.empty();

    let units = this.plugin.dataManager.getAllContentUnits();

    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      units = units.filter(unit =>
        unit.content.toLowerCase().includes(query) ||
        unit.source.file.toLowerCase().includes(query) ||
        unit.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (units.length === 0) {
      this.contentEl.createDiv({
        text: this.searchQuery ? 'No results found' : 'No content extracted yet',
        cls: 'empty-state'
      });
      return;
    }

    switch (this.groupBy) {
      case 'file':
        this.renderByFile(units);
        break;
      case 'tag':
        this.renderByTag(units);
        break;
      case 'date':
        this.renderByDate(units);
        break;
    }
  }

  private renderByFile(units: ContentUnit[]) {
    const grouped = new Map<string, ContentUnit[]>();

    units.forEach(unit => {
      if (!grouped.has(unit.source.file)) {
        grouped.set(unit.source.file, []);
      }
      grouped.get(unit.source.file)!.push(unit);
    });

    const sortedFiles = Array.from(grouped.keys()).sort();
    sortedFiles.forEach(filePath => {
      const fileUnits = grouped.get(filePath)!;
      this.renderFileGroup(filePath, fileUnits);
    });
  }

  private renderFileGroup(filePath: string, units: ContentUnit[]) {
    const groupContainer = this.contentEl.createDiv({ cls: 'file-group' });

    const header = groupContainer.createDiv({ cls: 'group-header' });
    const fileName = filePath.split('/').pop()?.replace('.md', '') || filePath;
    const titleEl = header.createDiv({ cls: 'group-title' });
    titleEl.createSpan({ text: '📄 ', cls: 'group-icon' });
    titleEl.createSpan({ text: fileName, cls: 'group-name' });

    header.createSpan({ text: `${units.length}`, cls: 'count-badge' });

    const collapseBtn = header.createSpan({ text: '▼', cls: 'collapse-btn' });

    // 显示文件批注
    const fileAnnotations = this.plugin.annotationManager.getFileAnnotations(filePath);
    if (fileAnnotations.length > 0) {
      const fileAnnotationDisplay = groupContainer.createDiv({ 
        cls: 'file-annotation-display' 
      });
      fileAnnotations.forEach(ann => {
        const annEl = fileAnnotationDisplay.createDiv({ cls: 'file-annotation-item' });
        annEl.createEl('strong', { text: '📌 ' });
        annEl.createSpan({ text: ann.content });
      });
    }

    const contentContainer = groupContainer.createDiv({ cls: 'group-content' });
    units.forEach(unit => {
      this.renderContentUnit(contentContainer, unit);
    });

    let isCollapsed = false;
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isCollapsed = !isCollapsed;
      contentContainer.style.display = isCollapsed ? 'none' : 'block';
      collapseBtn.textContent = isCollapsed ? '▶' : '▼';
    });

    header.addEventListener('click', async () => {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        await this.app.workspace.getLeaf(false).openFile(file);
      }
    });
  }

  private renderContentUnit(container: HTMLElement, unit: ContentUnit) {
    const card = container.createDiv({ cls: 'content-card' });

    // 批量选择模式：添加checkbox
    if (this.batchMode) {
      const checkbox = card.createEl('input', {
        type: 'checkbox',
        cls: 'batch-checkbox'
      });
      checkbox.setAttribute('data-unit-id', unit.id);
      checkbox.checked = this.selectedUnitIds.has(unit.id);
      checkbox.addEventListener('change', (e) => {
        if ((e.target as HTMLInputElement).checked) {
          this.selectedUnitIds.add(unit.id);
        } else {
          this.selectedUnitIds.delete(unit.id);
        }
        this.updateBatchButtons();
      });
    }

    const contentArea = card.createDiv({ cls: 'card-content' });
    const typeIcon = this.getTypeIcon(unit.type);
    contentArea.createSpan({ text: typeIcon + ' ', cls: 'type-icon' });
    
    const contentText = contentArea.createSpan({ 
      text: unit.content, 
      cls: 'content-text clickable-content'
    });
    
    // 点击内容展开批注输入
    contentText.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showAnnotationInput(card, unit, this.plugin.annotationManager.getContentAnnotation(unit.id)?.content);
    });

    if (unit.annotationId) {
      contentArea.createSpan({
        text: '📝',
        cls: 'annotation-badge has-annotation',
        attr: { title: 'Has annotation' }
      });
    }

    if (unit.flashcardIds.length > 0) {
      contentArea.createSpan({
        text: '🃏',
        cls: 'flashcard-badge',
        attr: { title: `${unit.flashcardIds.length} flashcard(s)` }
      });
    }

    // 显示批注内容
    const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
    if (annotation) {
      const annotationDisplay = card.createDiv({ cls: 'annotation-display' });
      
      if (annotation.badge) {
        const badge = annotationDisplay.createSpan({
          text: annotation.badge.text,
          cls: 'annotation-badge-display'
        });
        badge.style.backgroundColor = annotation.badge.color;
      }
      
      const annotationContent = annotationDisplay.createDiv({ 
        cls: 'annotation-content-display'
      });
      annotationContent.createEl('strong', { text: '💬 ' });
      annotationContent.createSpan({ text: annotation.content });
      
      // 时间戳
      const timestamp = annotationDisplay.createDiv({ cls: 'annotation-timestamp' });
      const date = new Date(annotation.metadata.createdAt);
      timestamp.textContent = date.toLocaleString();
      
      // 点击批注也可以编辑
      annotationDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showAnnotationInput(card, unit, annotation.content);
      });
    }

    const metaArea = card.createDiv({ cls: 'card-meta' });

    if (unit.metadata.tags.length > 0) {
      const tagsContainer = metaArea.createSpan({ cls: 'tags-container' });
      unit.metadata.tags.forEach(tag => {
        tagsContainer.createSpan({ text: tag, cls: 'tag' });
      });
    }

    if (unit.source.heading) {
      metaArea.createSpan({
        text: `📍 ${unit.source.heading}`,
        cls: 'heading-info'
      });
    }

    const actionsArea = card.createDiv({ cls: 'card-actions' });

    const jumpBtn = actionsArea.createEl('button', {
      text: '↗',
      cls: 'action-btn jump-btn',
      attr: { title: 'Jump to source' }
    });
    jumpBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.jumpToSource(unit);
    });

    // 一键创建闪卡按钮组
    const flashcardGroup = actionsArea.createDiv({ cls: 'flashcard-btn-group' });

    // 智能创建（主按钮）
    const quickCardBtn = flashcardGroup.createEl('button', {
      text: '⚡',
      cls: 'action-btn quick-card-btn',
      attr: { title: 'Quick create flashcard (smart)' }
    });
    quickCardBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.quickCreator.createSmartCard(unit);
      await this.refresh();
    });

    // 下拉菜单按钮
    const moreCardBtn = flashcardGroup.createEl('button', {
      text: '▼',
      cls: 'action-btn more-card-btn',
      attr: { title: 'More flashcard options' }
    });
    moreCardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showFlashcardMenu(e, unit);
    });

    const deleteBtn = actionsArea.createEl('button', {
      text: '🗑',
      cls: 'action-btn delete-btn',
      attr: { title: 'Delete' }
    });
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.deleteContentUnit(unit);
    });

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, unit);
    });
  }

  private renderByTag(units: ContentUnit[]) {
    const grouped = new Map<string, ContentUnit[]>();

    units.forEach(unit => {
      if (unit.metadata.tags.length === 0) {
        if (!grouped.has('Untagged')) {
          grouped.set('Untagged', []);
        }
        grouped.get('Untagged')!.push(unit);
      } else {
        unit.metadata.tags.forEach(tag => {
          if (!grouped.has(tag)) {
            grouped.set(tag, []);
          }
          grouped.get(tag)!.push(unit);
        });
      }
    });

    const sortedTags = Array.from(grouped.keys()).sort();
    sortedTags.forEach(tag => {
      const tagUnits = grouped.get(tag)!;
      this.renderTagGroup(tag, tagUnits);
    });
  }

  private renderTagGroup(tag: string, units: ContentUnit[]) {
    const groupContainer = this.contentEl.createDiv({ cls: 'tag-group' });

    const header = groupContainer.createDiv({ cls: 'group-header' });
    const titleEl = header.createDiv({ cls: 'group-title' });
    titleEl.createSpan({ text: '🏷️ ', cls: 'group-icon' });
    titleEl.createSpan({ text: tag, cls: 'group-name' });

    header.createSpan({ text: `${units.length}`, cls: 'count-badge' });

    const collapseBtn = header.createSpan({ text: '▼', cls: 'collapse-btn' });

    const contentContainer = groupContainer.createDiv({ cls: 'group-content' });
    units.forEach(unit => {
      this.renderContentUnit(contentContainer, unit);
    });

    let isCollapsed = false;
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isCollapsed = !isCollapsed;
      contentContainer.style.display = isCollapsed ? 'none' : 'block';
      collapseBtn.textContent = isCollapsed ? '▶' : '▼';
    });
  }

  private renderByDate(units: ContentUnit[]) {
    const grouped = new Map<string, ContentUnit[]>();

    units.forEach(unit => {
      const date = new Date(unit.metadata.createdAt);
      const dateKey = date.toLocaleDateString();
      
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(unit);
    });

    const sortedDates = Array.from(grouped.keys()).sort((a, b) => {
      return new Date(b).getTime() - new Date(a).getTime();
    });

    sortedDates.forEach(date => {
      const dateUnits = grouped.get(date)!;
      this.renderDateGroup(date, dateUnits);
    });
  }

  private renderDateGroup(date: string, units: ContentUnit[]) {
    const groupContainer = this.contentEl.createDiv({ cls: 'date-group' });

    const header = groupContainer.createDiv({ cls: 'group-header' });
    const titleEl = header.createDiv({ cls: 'group-title' });
    titleEl.createSpan({ text: '📅 ', cls: 'group-icon' });
    titleEl.createSpan({ text: date, cls: 'group-name' });

    header.createSpan({ text: `${units.length}`, cls: 'count-badge' });

    const collapseBtn = header.createSpan({ text: '▼', cls: 'collapse-btn' });

    const contentContainer = groupContainer.createDiv({ cls: 'group-content' });
    units.forEach(unit => {
      this.renderContentUnit(contentContainer, unit);
    });

    let isCollapsed = false;
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isCollapsed = !isCollapsed;
      contentContainer.style.display = isCollapsed ? 'none' : 'block';
      collapseBtn.textContent = isCollapsed ? '▶' : '▼';
    });
  }

  private showAnnotationInput(card: HTMLElement, unit: ContentUnit, existingText?: string) {
    // 检查是否已经有输入框展开
    let inputContainer = card.querySelector('.annotation-input-container') as HTMLElement;
    
    if (inputContainer) {
      // 如果已展开，则折叠
      inputContainer.remove();
      return;
    }

    // 创建输入区域
    inputContainer = card.createDiv({ cls: 'annotation-input-container' });

    const textarea = inputContainer.createEl('textarea', {
      cls: 'annotation-textarea',
      placeholder: 'Add comment...'
    });
    textarea.value = existingText || '';
    textarea.rows = 3;

    // 按钮区域（简化版）
    const buttonArea = inputContainer.createDiv({ cls: 'annotation-buttons' });

    if (existingText) {
      const deleteBtn = buttonArea.createEl('button', {
        text: 'Delete',
        cls: 'annotation-delete-btn'
      });
      deleteBtn.addEventListener('click', async () => {
        const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
        if (annotation) {
          await this.plugin.annotationManager.deleteAnnotation(annotation.id);
          new Notice('Annotation deleted');
          await this.refresh();
        }
      });
    }

    const saveBtn = buttonArea.createEl('button', {
      text: 'Save',
      cls: 'annotation-save-btn'
    });
    
    // 保存函数
    const saveAnnotation = async () => {
      const text = textarea.value.trim();
      if (!text) {
        inputContainer.remove();
        return;
      }

      try {
        const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
        
        if (annotation) {
          // 更新现有批注
          await this.plugin.annotationManager.updateAnnotation(annotation.id, {
            content: text
          });
        } else {
          // 创建新批注
          await this.plugin.annotationManager.addContentAnnotation(
            unit.id,
            text
          );
        }

        await this.refresh();
      } catch (error) {
        console.error('Error saving annotation:', error);
        new Notice('Error saving annotation');
      }
    };

    saveBtn.addEventListener('click', saveAnnotation);

    // 支持 Ctrl+Enter 快捷键保存
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveAnnotation();
      }
      // Esc 键关闭
      if (e.key === 'Escape') {
        e.preventDefault();
        inputContainer.remove();
      }
    });

    // 自动聚焦
    textarea.focus();
  }

  private showFlashcardMenu(e: MouseEvent, unit: ContentUnit) {
    const menu = new Menu();

    menu.addItem((item) =>
      item
        .setTitle('⚡ Smart create')
        .setIcon('zap')
        .onClick(async () => {
          await this.quickCreator.createSmartCard(unit);
          await this.refresh();
        })
    );

    menu.addItem((item) =>
      item
        .setTitle('📝 Create Q&A card')
        .setIcon('message-square')
        .onClick(async () => {
          await this.quickCreator.createQuickQACard(unit);
          await this.refresh();
        })
    );

    menu.addItem((item) =>
      item
        .setTitle('✏️ Create Cloze card')
        .setIcon('edit')
        .onClick(async () => {
          await this.quickCreator.createQuickClozeCard(unit);
          await this.refresh();
        })
    );

    menu.addSeparator();

    menu.addItem((item) =>
      item
        .setTitle('🎨 Custom card...')
        .setIcon('settings')
        .onClick(async () => {
          const { FlashcardCreateModal } = await import('./FlashcardCreateModal');
          const modal = new FlashcardCreateModal(
            this.app,
            this.plugin,
            unit,
            async () => {
              await this.refresh();
            }
          );
          modal.open();
        })
    );

    menu.showAtMouseEvent(e);
  }

  private async showBatchCreateModal() {
    const units = this.plugin.dataManager.getAllContentUnits();
    
    // 过滤掉已经有闪卡的内容
    const unitsWithoutCards = units.filter(u => u.flashcardIds.length === 0);
    
    if (unitsWithoutCards.length === 0) {
      new Notice('All content already has flashcards!');
      return;
    }

    const modal = new BatchCreateModal(
      this.app,
      this.plugin,
      this.quickCreator,
      unitsWithoutCards,
      () => this.refresh()
    );
    modal.open();
  }

  private isAllSelected(): boolean {
    const units = this.plugin.dataManager.getAllContentUnits();
    // 应用搜索过滤
    let filteredUnits = units;
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filteredUnits = units.filter(unit =>
        unit.content.toLowerCase().includes(query) ||
        unit.source.file.toLowerCase().includes(query) ||
        unit.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    return filteredUnits.length > 0 && this.selectedUnitIds.size === filteredUnits.length;
  }

  private toggleSelectAll() {
    const units = this.plugin.dataManager.getAllContentUnits();
    // 应用搜索过滤
    let filteredUnits = units;
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filteredUnits = units.filter(unit =>
        unit.content.toLowerCase().includes(query) ||
        unit.source.file.toLowerCase().includes(query) ||
        unit.metadata.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (this.isAllSelected()) {
      // 取消全选
      this.selectedUnitIds.clear();
    } else {
      // 全选
      filteredUnits.forEach(unit => {
        this.selectedUnitIds.add(unit.id);
      });
    }
    this.updateBatchButtons();
    this.updateCheckboxes();
  }

  private updateCheckboxes() {
    const container = this.containerEl.children[1];
    const checkboxes = container.querySelectorAll('.batch-checkbox') as NodeListOf<HTMLInputElement>;
    
    checkboxes.forEach(checkbox => {
      const unitId = checkbox.getAttribute('data-unit-id');
      if (unitId) {
        checkbox.checked = this.selectedUnitIds.has(unitId);
      }
    });
  }

  private updateBatchButtons() {
    const toolbar = this.containerEl.querySelector('.learning-system-toolbar') as HTMLElement;
    if (toolbar) {
      const batchActions = toolbar.querySelector('.batch-actions-overview') as HTMLElement;
      if (batchActions) {
        const selectAllBtn = batchActions.querySelector('.select-all-btn') as HTMLElement;
        const deleteBtn = batchActions.querySelector('.batch-delete-btn') as HTMLElement;
        const createBtn = batchActions.querySelector('.batch-create-cards-btn') as HTMLElement;
        
        if (selectAllBtn) {
          selectAllBtn.textContent = this.isAllSelected() ? '☑ Deselect All' : '☐ Select All';
        }
        
        if (deleteBtn) {
          deleteBtn.textContent = `🗑️ Delete (${this.selectedUnitIds.size})`;
        }
        
        if (createBtn) {
          createBtn.textContent = `⚡ Create Cards (${this.selectedUnitIds.size})`;
        }
      }
    }
  }

  private async batchDeleteNotes() {
    if (this.selectedUnitIds.size === 0) {
      new Notice('⚠️ Please select notes to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${this.selectedUnitIds.size} selected notes?`)) {
      return;
    }

    let success = 0;
    let failed = 0;

    for (const unitId of this.selectedUnitIds) {
      try {
        await this.plugin.dataManager.deleteContentUnit(unitId);
        success++;
      } catch (error) {
        console.error('Error deleting note:', error);
        failed++;
      }
    }

    this.selectedUnitIds.clear();
    new Notice(`✅ Deleted ${success} notes${failed > 0 ? `, ${failed} failed` : ''}`);
    this.refresh();
  }

  private async batchCreateFlashcards() {
    if (this.selectedUnitIds.size === 0) {
      new Notice('⚠️ Please select notes to create flashcards');
      return;
    }

    const units = Array.from(this.selectedUnitIds)
      .map(id => this.plugin.dataManager.getContentUnit(id))
      .filter(u => u !== undefined && u.flashcardIds.length === 0) as ContentUnit[];

    if (units.length === 0) {
      new Notice('⚠️ Selected notes already have flashcards');
      return;
    }

    const modal = new BatchCreateModal(
      this.app,
      this.plugin,
      this.quickCreator,
      units,
      () => {
        this.selectedUnitIds.clear();
        this.refresh();
      }
    );
    modal.open();
  }

  private async jumpToSource(unit: ContentUnit) {
    const file = this.app.vault.getAbstractFileByPath(unit.source.file);
    if (!(file instanceof TFile)) return;

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);

    const view = this.app.workspace.getActiveViewOfType(ItemView);
    if (view) {
      const editor = (view as any).editor;
      if (editor) {
        editor.setCursor({ line: unit.source.position.line, ch: 0 });
        editor.scrollIntoView({
          from: { line: unit.source.position.line, ch: 0 },
          to: { line: unit.source.position.line, ch: 0 }
        }, true);
        
        setTimeout(() => {
          editor.setSelection(
            { line: unit.source.position.line, ch: 0 },
            { line: unit.source.position.line, ch: 999 }
          );
        }, 100);
      }
    }
  }

  private async deleteContentUnit(unit: ContentUnit) {
    const confirmed = await this.confirmDelete(unit);
    if (!confirmed) return;

    await this.plugin.dataManager.deleteContentUnit(unit.id);
    await this.refresh();
  }

  private async confirmDelete(unit: ContentUnit): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new ConfirmModal(
        this.app,
        'Delete content',
        `Are you sure you want to delete this content?\n\n"${unit.content.substring(0, 50)}..."`,
        () => resolve(true),
        () => resolve(false)
      );
      modal.open();
    });
  }

  private showContextMenu(e: MouseEvent, unit: ContentUnit) {
    const menu = new Menu();

    menu.addItem((item) =>
      item
        .setTitle('Jump to source')
        .setIcon('arrow-right')
        .onClick(() => this.jumpToSource(unit))
    );

    const annotation = this.plugin.annotationManager.getContentAnnotation(unit.id);
    
    menu.addItem((item) =>
      item
        .setTitle(annotation ? 'Edit annotation' : 'Add annotation')
        .setIcon('pencil')
        .onClick(() => {
          const card = (e.target as HTMLElement).closest('.content-card') as HTMLElement;
          if (card) {
            this.showAnnotationInput(card, unit, annotation?.content);
          }
        })
    );

    menu.addSeparator();

    menu.addItem((item) =>
      item
        .setTitle('⚡ Quick create flashcard')
        .setIcon('zap')
        .onClick(async () => {
          await this.quickCreator.createSmartCard(unit);
          await this.refresh();
        })
    );

    menu.addItem((item) =>
      item
        .setTitle('Create Q&A card')
        .setIcon('message-square')
        .onClick(async () => {
          await this.quickCreator.createQuickQACard(unit);
          await this.refresh();
        })
    );

    menu.addItem((item) =>
      item
        .setTitle('Create Cloze card')
        .setIcon('edit')
        .onClick(async () => {
          await this.quickCreator.createQuickClozeCard(unit);
          await this.refresh();
        })
    );

    menu.addItem((item) =>
      item
        .setTitle('Custom flashcard...')
        .setIcon('settings')
        .onClick(async () => {
          const { FlashcardCreateModal } = await import('./FlashcardCreateModal');
          const modal = new FlashcardCreateModal(
            this.app,
            this.plugin,
            unit,
            async () => {
              await this.refresh();
            }
          );
          modal.open();
        })
    );

    menu.addSeparator();

    menu.addItem((item) =>
      item
        .setTitle('View Statistics')
        .setIcon('bar-chart')
        .onClick(() => {
          this.plugin.activateStats();
        })
    );

    menu.addSeparator();

    menu.addItem((item) =>
      item
        .setTitle('Delete')
        .setIcon('trash')
        .onClick(() => this.deleteContentUnit(unit))
    );

    menu.showAtMouseEvent(e);
  }

  private getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      'highlight': '✨',
      'bold': '**',
      'tag': '🏷',
      'custom': '⭐'
    };
    return icons[type] || '•';
  }


// 每日提醒复习
private checkDailyReview() {
  if (this.isReminderDismissedToday()) {
    return;
  }
  
  const dueCards = this.getDueFlashcards();
  console.log('📚 检查复习提醒:', {
    总卡片数: this.plugin.flashcardManager.getAllFlashcards().length,
    待复习数: dueCards.length,
    是否已忽略: this.isReminderDismissedToday()
  });

  // if (dueCards.length > 0) {
  //   this.showReviewReminder(dueCards.length);
  // }
  if (this.isReminderDismissedToday()) {
    return;
  }
  
  if (dueCards.length > 0) {
    this.showReviewReminder(dueCards.length);
  } else {
    new Notice('✅ 今天暂无待复习卡片');
  }
}

private getDueFlashcards() {
  const allCards = this.plugin.flashcardManager.getAllFlashcards();
  const now = Date.now();
  
  return allCards.filter(card => card.scheduling.due <= now);
}

private showReviewReminder(count: number) {
  // 创建提醒横幅
  const banner = this.contentEl.createDiv({ cls: 'review-reminder-banner' });
  
  const icon = banner.createSpan({ text: '📚', cls: 'reminder-icon' });
  
  const content = banner.createDiv({ cls: 'reminder-content' });
  content.createEl('strong', { text: `今天有 ${count} 张卡片需要复习!` });
  content.createEl('p', { text: '保持每日复习习惯,巩固记忆效果最佳 💪' });
  
  const actions = banner.createDiv({ cls: 'reminder-actions' });
  
  const reviewBtn = actions.createEl('button', {
    text: '开始复习 →',
    cls: 'reminder-review-btn'
  });
  reviewBtn.addEventListener('click', () => {
    this.startReview();
  });
  
  const dismissBtn = actions.createEl('button', {
    text: '稍后提醒',
    cls: 'reminder-dismiss-btn'
  });
  dismissBtn.addEventListener('click', () => {
    banner.remove();
    // 可选: 保存"已忽略"状态到今天
    this.markReminderDismissed();
  });
  
  // 将横幅插入到内容区域顶部
  this.contentEl.insertBefore(banner, this.contentEl.firstChild);
}

private startReview() {
  // 激活复习视图
  this.plugin.activateReview();
}

private markReminderDismissed() {
  // 保存今天已忽略的状态(可选功能)
  const today = new Date().toDateString();
  localStorage.setItem('learning-system-reminder-dismissed', today);
}

private isReminderDismissedToday(): boolean {
  const today = new Date().toDateString();
  const dismissed = localStorage.getItem('learning-system-reminder-dismissed');
  return dismissed === today;
}



}

// 批量创建模态框
export class BatchCreateModal extends Modal {
  constructor(
    app: App,
    private plugin: LearningSystemPlugin,
    private quickCreator: QuickFlashcardCreator,
    private units: ContentUnit[],
    private onComplete: () => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl('h2', { text: '⚡ Batch Create Flashcards' });
    
    contentEl.createEl('p', { 
      text: `Create flashcards for ${this.units.length} content items without cards.`
    });

    // 选择类型
    const typeContainer = contentEl.createDiv({ cls: 'type-select-container' });
    typeContainer.createEl('h3', { text: 'Card Type' });

    let selectedType: 'smart' | 'qa' | 'cloze' = 'smart';

    const types = [
      { value: 'smart', label: '⚡ Smart (Auto-detect)', desc: 'Automatically choose the best type' },
      { value: 'qa', label: '📝 Q&A Cards', desc: 'Question and answer format' },
      { value: 'cloze', label: '✏️ Cloze Cards', desc: 'Fill in the blanks' }
    ];

    types.forEach(type => {
      const option = typeContainer.createDiv({ cls: 'type-option' });
      
      const radio = option.createEl('input', {
        type: 'radio',
        value: type.value,
        attr: { name: 'card-type' }
      });
      if (type.value === 'smart') radio.checked = true;

      const label = option.createDiv({ cls: 'type-label' });
      label.createEl('strong', { text: type.label });
      label.createEl('div', { text: type.desc, cls: 'type-desc' });

      option.addEventListener('click', () => {
        radio.checked = true;
        selectedType = type.value as any;
      });
    });

    // 按钮
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const createBtn = buttonContainer.createEl('button', { 
      text: `Create ${this.units.length} Cards`,
      cls: 'mod-cta'
    });
    createBtn.addEventListener('click', async () => {
      await this.batchCreate(selectedType);
    });

    this.addStyles();
  }

  private async batchCreate(type: 'smart' | 'qa' | 'cloze') {
    const { success, failed } = await this.quickCreator.createBatchCards(this.units, type);
    
    new Notice(`✅ Created ${success} flashcards! ${failed > 0 ? `(${failed} failed)` : ''}`);
    
    this.close();
    this.onComplete();
  }

  private addStyles() {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .type-select-container {
        margin: 20px 0;
      }

      .type-option {
        padding: 15px;
        margin: 10px 0;
        background: var(--background-secondary);
        border: 2px solid var(--background-modifier-border);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .type-option:hover {
        border-color: var(--interactive-accent);
        background: var(--background-modifier-hover);
      }

      .type-option input[type="radio"] {
        margin-right: 10px;
      }

      .type-label {
        display: inline-block;
        vertical-align: top;
      }

      .type-desc {
        font-size: 0.9em;
        color: var(--text-muted);
        margin-top: 4px;
      }
    `;

    document.head.appendChild(styleEl);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class ConfirmModal extends Modal {
  constructor(
    app: App,
    private title: string,
    private message: string,
    private onConfirm: () => void,
    private onCancel: () => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl('h2', { text: this.title });
    contentEl.createEl('p', { text: this.message });

    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    
    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => {
      this.close();
      this.onCancel();
    });

    const confirmBtn = buttonContainer.createEl('button', { 
      text: 'Delete',
      cls: 'mod-warning'
    });
    confirmBtn.addEventListener('click', () => {
      this.close();
      this.onConfirm();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}