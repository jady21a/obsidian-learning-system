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

    const mind = new MindElixir({
      el: container,
      direction: MindElixir.SIDE,
      editable: true,
      toolBar: true,
      allowUndo: true,
      contextMenu: {
        // Mind Elixir 的拖拽不支持把深层节点拖回一级(根的直接子节点),
        // 这里用 moveNodeIn API 补一个右键菜单项实现「提升为一级节点」。
        extend: [
          {
            name: 'Promote to top level',
            onclick: () => this.promoteToTopLevel(),
          },
        ],
      },
    });
    mind.init(buildTreeFromFlashcards(cards));

    // 编辑事件钩子。步骤3将在此把节点改动写回卡片/markdown;
    // 当前编辑仅存在于内存中,重新打开会从闪卡重新生成。
    mind.bus.addListener('operation', (operation) => {
      console.debug('[learning-system] mindmap operation', operation);
    });

    this.mind = mind;
    this.enableDragToRoot(container);
  }

  /**
   * 让深层节点可以被「拖拽」到根节点变成一级节点。
   *
   * Mind Elixir 的落点校验要求目标节点有 parent,而根节点没有 parent,
   * 因此根永远不是合法落点(拖不回一级)。这里在容器上加一个【捕获阶段】的
   * pointerup 监听(早于库内部冒泡监听执行,此时 mind.dragged 尚未被清空):
   * 若确实在拖拽(ghost 可见)且指针落在根节点包围盒内,就调用与右键相同的
   * moveNodeIn(被拖节点, 根节点)。内部冒泡监听随后只做清理,不会重复移动。
   */
  private enableDragToRoot(container: HTMLElement) {
    const handler = (ev: PointerEvent) => {
      const mind = this.mind;
      if (!mind) return;

      const dragged = mind.dragged;
      if (!dragged || dragged.length === 0) return;

      // ghost 可见才算真正拖拽(纯点击时 ghost 隐藏)
      const ghost = container.querySelector<HTMLElement>('.mind-elixir-ghost');
      if (!ghost || ghost.style.display === 'none') return;

      const root = mind.findEle('root');
      if (!root) return;

      // 用包围盒判断指针是否落在根节点上(避免 ghost 遮挡导致的 elementFromPoint 误判)
      const rect = root.getBoundingClientRect();
      const overRoot =
        ev.clientX >= rect.left &&
        ev.clientX <= rect.right &&
        ev.clientY >= rect.top &&
        ev.clientY <= rect.bottom;
      if (!overRoot) return;

      const movable = dragged.filter(
        (tpc) => tpc.nodeObj.id !== 'root' && tpc.nodeObj.parent?.id !== 'root'
      );
      if (movable.length === 0) return;

      try {
        mind.moveNodeIn(movable, root);
      } catch (e) {
        console.error('[learning-system] drag-to-root failed', e);
      }
    };

    container.addEventListener('pointerup', handler, true);
    this.register(() => container.removeEventListener('pointerup', handler, true));
  }

  /** 把当前选中的节点移动为根的直接子节点(一级节点)。 */
  private promoteToTopLevel() {
    const mind = this.mind;
    if (!mind) return;

    const selected = mind.currentNodes?.length
      ? mind.currentNodes
      : mind.currentNode
        ? [mind.currentNode]
        : [];
    if (selected.length === 0) {
      new Notice('请先选中要提升的节点');
      return;
    }

    const root = mind.findEle('root');
    if (!root) {
      new Notice('未找到根节点');
      return;
    }

    // 过滤掉根节点本身和已是一级的节点
    const movable = selected.filter(
      (tpc) => tpc.nodeObj.id !== 'root' && tpc.nodeObj.parent?.id !== 'root'
    );
    if (movable.length === 0) {
      new Notice('选中的节点已是一级节点');
      return;
    }

    try {
      mind.moveNodeIn(movable, root);
    } catch (e) {
      console.error('[learning-system] promoteToTopLevel failed', e);
      new Notice('提升失败,见控制台');
    }
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
