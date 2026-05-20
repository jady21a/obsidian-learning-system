import { ItemView, WorkspaceLeaf, Notice, TFile, type ViewStateResult } from 'obsidian';
import MindElixir, { type MindElixirInstance, type MindElixirData } from 'mind-elixir';
import mindElixirCss from 'mind-elixir/style.css';
import type LearningSystemPlugin from '../../main';
import {
  buildTreeFromFlashcards,
  buildTreeFromMarkdown,
  rebuildOutlineLine,
  type OutlineNodeMeta,
} from '../../core/MindmapTreeBuilder';
import type { NodeObj } from 'mind-elixir';

export const VIEW_TYPE_MINDMAP = 'learning-system-mindmap';

const STYLE_EL_ID = 'learning-system-mindmap-styles';

interface MindmapViewState {
  /** 指定来源文件路径时,按该文档大纲渲染;为空则渲染全部闪卡。 */
  filePath?: string | null;
}

export class MindmapView extends ItemView {
  plugin: LearningSystemPlugin;
  private mind: MindElixirInstance | null = null;
  private container: HTMLElement | null = null;
  private filePath: string | null = null;
  private modifyWatcherRegistered = false;
  private refreshTimer: number | null = null;
  /** 记录我们自己写回的内容,用于在 modify 事件中识别并跳过自写入,避免回环。 */
  private lastWrittenContent: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: LearningSystemPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_MINDMAP;
  }

  getDisplayText(): string {
    if (this.filePath) {
      const name = this.filePath.split('/').pop()?.replace(/\.md$/, '');
      return `Mindmap: ${name}`;
    }
    return 'Mindmap';
  }

  getIcon(): string {
    return 'git-fork';
  }

  getState(): Record<string, unknown> {
    const state = super.getState() as Record<string, unknown>;
    state.filePath = this.filePath;
    return state;
  }

  async setState(state: MindmapViewState, result: ViewStateResult): Promise<void> {
    this.filePath = state?.filePath ?? null;
    await super.setState(state, result);
    await this.renderMindmap();
  }

  async onOpen() {
    this.injectStyles();
    this.registerModifyWatcher();
    await this.renderMindmap();
  }

  /** 笔记 → 地图:监听文件变更,去抖后刷新地图(仅文件模式)。 */
  private registerModifyWatcher() {
    if (this.modifyWatcherRegistered) return;
    this.modifyWatcherRegistered = true;
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && this.filePath && file.path === this.filePath) {
          this.scheduleRefresh();
        }
      })
    );
  }

  private scheduleRefresh() {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshFromFile();
    }, 250);
  }

  private async refreshFromFile() {
    if (!this.filePath || !this.mind) return;
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;

    const text = await this.app.vault.cachedRead(file);
    // 跳过我们自己写回触发的变更,避免覆盖用户在图上的其它(内存)编辑
    if (this.lastWrittenContent !== null && text === this.lastWrittenContent) {
      this.lastWrittenContent = null;
      return;
    }
    this.mind.refresh(buildTreeFromMarkdown(file.name, text));
  }

  /** 地图 → 笔记:节点改名后,按 metadata.line 改写原文对应行(保留前缀/缩进)。 */
  private async writeBackRename(node: NodeObj) {
    if (!this.filePath) return;
    const meta = node.metadata as OutlineNodeMeta | undefined;
    if (!meta || typeof meta.line !== 'number') return; // 内存中新增的节点没有源行,跳过

    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;

    const text = await this.app.vault.cachedRead(file);
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    if (meta.line < 0 || meta.line >= lines.length) return;

    const rebuilt = rebuildOutlineLine(lines[meta.line], node.topic);
    if (rebuilt === null || rebuilt === lines[meta.line]) return;

    lines[meta.line] = rebuilt;
    const newText = lines.join(eol);
    this.lastWrittenContent = newText;
    await this.app.vault.modify(file, newText);
  }

  /** 根据 this.filePath 渲染:有则按文档大纲,无则全部闪卡。 */
  private async renderMindmap() {
    this.injectStyles();

    // 清理旧实例
    if (this.mind) {
      this.mind.destroy?.();
      this.mind = null;
    }

    const root = this.contentEl;
    root.empty();

    const container = root.createDiv({ cls: 'learning-system-mindmap-container' });
    container.style.width = '100%';
    container.style.height = '100%';
    this.container = container;

    let data: MindElixirData;
    if (this.filePath) {
      const file = this.app.vault.getAbstractFileByPath(this.filePath);
      if (!(file instanceof TFile)) {
        container.setText(`找不到文件:${this.filePath}`);
        return;
      }
      const text = await this.app.vault.cachedRead(file);
      data = buildTreeFromMarkdown(file.name, text);
    } else {
      const cards = this.plugin.flashcardManager.getAllFlashcards();
      if (cards.length === 0) {
        container.setText('暂无闪卡,先去提取一些内容。');
        return;
      }
      data = buildTreeFromFlashcards(cards);
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
    mind.init(data);

    // 编辑事件钩子。
    // 文件模式下:节点改名(finishEdit)写回原文对应行。
    // 增/删/移动暂不写回(仅内存),与用户约定的同步范围一致。
    mind.bus.addListener('operation', (operation) => {
      console.debug('[learning-system] mindmap operation', operation);
      if (this.filePath && operation.name === 'finishEdit') {
        void this.writeBackRename(operation.obj);
      }
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
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
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
