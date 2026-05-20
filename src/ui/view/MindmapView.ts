import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import MindElixir, { type MindElixirInstance } from 'mind-elixir';
import mindElixirCss from 'mind-elixir/style.css';
import type LearningSystemPlugin from '../../main';
import { buildTreeFromFlashcards } from '../../core/MindmapTreeBuilder';

export const VIEW_TYPE_MINDMAP = 'learning-system-mindmap';

const STYLE_EL_ID = 'learning-system-mindmap-styles';

export class MindmapView extends ItemView {
  plugin: LearningSystemPlugin;
  private mind: MindElixirInstance | null = null;
  private container: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LearningSystemPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_MINDMAP;
  }

  getDisplayText(): string {
    return 'Mindmap';
  }

  getIcon(): string {
    return 'git-fork';
  }

  async onOpen() {
    this.injectStyles();

    const root = this.contentEl;
    root.empty();

    const container = root.createDiv({ cls: 'learning-system-mindmap-container' });
    container.style.width = '100%';
    container.style.height = '100%';
    this.container = container;

    const cards = this.plugin.flashcardManager.getAllFlashcards();
    if (cards.length === 0) {
      container.setText('暂无闪卡,先去提取一些内容。');
      return;
    }

    // 骨架阶段:只读渲染,验证 Mind Elixir 在 Obsidian 中可用
    const mind = new MindElixir({
      el: container,
      direction: MindElixir.SIDE,
      editable: false,
      contextMenu: false,
    });
    mind.init(buildTreeFromFlashcards(cards));
    this.mind = mind;
  }

  async onClose() {
    if (this.mind) {
      this.mind.destroy?.();
      this.mind = null;
    }
    this.container = null;
  }

  private injectStyles() {
    if (document.getElementById(STYLE_EL_ID)) return;
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_EL_ID;
    styleEl.textContent = mindElixirCss;
    document.head.appendChild(styleEl);
    this.register(() => styleEl.remove());
  }
}
