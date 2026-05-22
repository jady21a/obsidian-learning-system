import { ItemView, WorkspaceLeaf, Notice, TFile, type ViewStateResult } from 'obsidian';
import MindElixir, { type MindElixirInstance, type MindElixirData } from 'mind-elixir';
import mindElixirCss from 'mind-elixir/style.css';
import type LearningSystemPlugin from '../../main';
import {
  buildTreeFromFlashcards,
  buildTreeFromMarkdown,
  serializeOutline,
  type OutlineNodeMeta,
} from '../../core/MindmapTreeBuilder';
import type { NodeObj } from 'mind-elixir';
import type { ContentUnit } from '../../core/DataManager';
import { ClozeBlankModal, type ClozeResult } from './ClozeBlankModal';

export const VIEW_TYPE_MINDMAP = 'learning-system-mindmap';

const STYLE_EL_ID = 'learning-system-mindmap-styles';

/** 需要写回原文的操作类型(改名 + 增/删/移动/复制)。 */
const WRITE_BACK_OPS = new Set<string>([
  'finishEdit',
  'addChild',
  'insertSibling',
  'insertParent',
  'removeNodes',
  'moveNodeIn',
  'moveNodeBefore',
  'moveNodeAfter',
  'moveUpNode',
  'moveDownNode',
  'copyNode',
  'copyNodes',
]);

interface MindmapViewState {
  /** 指定来源文件路径时,按该文档大纲渲染;为空则渲染全部闪卡。 */
  filePath?: string | null;
  /** 指定一段文本时,按该文本大纲渲染为「临时导图」(不回写任何文件)。 */
  inlineText?: string | null;
  /** 临时导图的来源文件(用于卡片回链),可为空。 */
  sourceFile?: string | null;
  /** 临时导图标题。 */
  title?: string | null;
}

export class MindmapView extends ItemView {
  plugin: LearningSystemPlugin;
  private mind: MindElixirInstance | null = null;
  private container: HTMLElement | null = null;
  private filePath: string | null = null;
  private inlineText: string | null = null;
  private sourceFile: string | null = null;
  private title: string | null = null;
  private modifyWatcherRegistered = false;
  private refreshTimer: number | null = null;
  /** 主标题是否已定位到左侧(每次重新渲染重置)。 */
  private rootAligned = false;
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
    if (this.inlineText != null) return `Mindmap: ${this.title || '选区'}`;
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
    state.inlineText = this.inlineText;
    state.sourceFile = this.sourceFile;
    state.title = this.title;
    return state;
  }

  async setState(state: MindmapViewState, result: ViewStateResult): Promise<void> {
    this.filePath = state?.filePath ?? null;
    this.inlineText = state?.inlineText ?? null;
    this.sourceFile = state?.sourceFile ?? null;
    this.title = state?.title ?? null;
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

  /**
   * 地图 → 笔记:把当前整棵大纲树序列化后写回原文。
   * 统一处理增/删/移动/改名 —— 避免逐操作改行带来的行号漂移问题。
   * 非大纲内容(frontmatter/段落/代码块)由序列化器逐字保留。
   */
  private async writeBackStructure() {
    if (!this.filePath || !this.mind) return;
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return;

    const newText = serializeOutline(this.mind.nodeData);
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
    if (this.inlineText != null) {
      // 临时导图:从选区文本解析,不回写任何文件
      data = buildTreeFromMarkdown(this.title || '选区', this.inlineText);
      this.markClozedNodes(data.nodeData, this.sourceFile);
    } else if (this.filePath) {
      const file = this.app.vault.getAbstractFileByPath(this.filePath);
      if (!(file instanceof TFile)) {
        container.setText(`找不到文件:${this.filePath}`);
        return;
      }
      const text = await this.app.vault.cachedRead(file);
      data = buildTreeFromMarkdown(file.name, text);
      this.markClozedNodes(data.nodeData, this.filePath);
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
      direction: MindElixir.RIGHT, // 单侧向右展开,呈树形图
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
          {
            name: '挖空整个节点(cloze)',
            onclick: () => this.clozeWholeNode(),
          },
          {
            name: '挖空选中词(cloze)',
            onclick: () => this.clozeWords(),
          },
        ],
      },
    });
    mind.init(data);

    // 编辑事件钩子。文件模式下:任何结构/文本变更都整树序列化写回原文。
    mind.bus.addListener('operation', (operation) => {
      console.debug('[learning-system] mindmap operation', operation);
      if (this.filePath && WRITE_BACK_OPS.has(operation.name)) {
        void this.writeBackStructure();
      }
    });

    this.mind = mind;
    this.enableDragToRoot(container);
    this.patchUndoRedo(mind);
    this.patchToCenterLeft(mind);

    // 布局完成后把主标题定位到左侧(默认 toCenter 会居中)
    this.rootAligned = false;
    window.requestAnimationFrame(() => this.alignRootLeft());
  }

  /**
   * 覆盖 toCenter:让右下角「定位」按钮(及 F1、切换方向)都把主标题定位到左侧,
   * 而不是居中。先执行原居中,再把根平移到左侧。
   */
  private patchToCenterLeft(mind: MindElixirInstance) {
    const orig = mind.toCenter.bind(mind);
    mind.toCenter = () => {
      orig();
      this.rootAligned = false;
      this.alignRootLeft();
    };
  }

  /** 把主标题(根节点)平移到容器左侧;只成功定位一次,不干扰后续手动平移。 */
  private alignRootLeft() {
    if (this.rootAligned || !this.mind || !this.container) return;
    const root = this.mind.findEle('root');
    if (!root) return;
    const r = root.getBoundingClientRect();
    const c = this.container.getBoundingClientRect();
    if (r.width === 0 || c.width === 0) return; // 尚未布局,等下次(onResize)

    const margin = 100;
    const dx = c.left + margin - r.left;
    if (Math.abs(dx) > 1) this.mind.move(dx, 0);
    this.rootAligned = true;
  }

  onResize() {
    // 视图首次可见/尺寸确定后兜底定位
    this.alignRootLeft();
  }

  /**
   * 让撤销/重做(Ctrl+Z / Ctrl+Y)也写回原文。
   * Mind Elixir 的 undo/redo 只 refresh 快照、不发 operation 事件,
   * 所以包装这两个实例方法,执行后整树序列化写回。
   * 快照经 getData 保留了我们的 metadata,因此恢复后内容可完整还原。
   */
  private patchUndoRedo(mind: MindElixirInstance) {
    const origUndo = mind.undo?.bind(mind);
    const origRedo = mind.redo?.bind(mind);
    if (origUndo) {
      mind.undo = () => {
        origUndo();
        if (this.filePath) void this.writeBackStructure();
      };
    }
    if (origRedo) {
      mind.redo = () => {
        origRedo();
        if (this.filePath) void this.writeBackStructure();
      };
    }
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

  // ==================== 节点挖空(cloze)====================

  /** 当前选中的节点(Topic 元素)。 */
  private currentTopic() {
    return this.mind?.currentNode ?? null;
  }

  /** 节点的纯文本(优先用解析时保留的原始 text,否则从标签剥掉显示符号)。 */
  private nodeCleanText(obj: NodeObj): string {
    const meta = obj.metadata as OutlineNodeMeta | undefined;
    if (meta?.text) return meta.text;
    let t = obj.topic;
    t = t.replace(/^(#{1,6}|[IVXLCDMivxlcdm]+|[-*+]|\d+[.)]|!!)\s+/, '');
    t = t.replace(/^\[[ xX]\]\s+/, '');
    return t.trim();
  }

  /** 按纯文本路径在树里定位节点。 */
  private findNodeByPath(root: NodeObj, path: string[]): NodeObj | null {
    let children = root.children ?? [];
    let found: NodeObj | null = null;
    for (const seg of path) {
      const next = children.find((n) => this.nodeCleanText(n) === seg);
      if (!next) return null;
      found = next;
      children = next.children ?? [];
    }
    return found;
  }

  /** 从 meta.blockId(形如 ' ^abc')提取裸 id。 */
  private blockIdToken(s?: string | null): string | null {
    if (!s) return null;
    const m = s.match(/\^([\w-]+)/);
    return m ? m[1] : null;
  }

  /** 按 block id 在树里定位节点(深度优先)。 */
  private findNodeByBlockId(root: NodeObj, id: string): NodeObj | null {
    const stack: NodeObj[] = [...(root.children ?? [])];
    while (stack.length) {
      const n = stack.shift()!;
      const meta = n.metadata as OutlineNodeMeta | undefined;
      if (this.blockIdToken(meta?.blockId) === id) return n;
      if (n.children) stack.push(...n.children);
    }
    return null;
  }

  /**
   * 确保节点源行有 ^id 锚点(仅文件模式)。已有则复用,没有则生成并写回源文件。
   * 返回裸 id;临时导图(无文件)返回 null。
   */
  private async ensureBlockId(obj: NodeObj): Promise<string | null> {
    if (!this.filePath) return null;
    const meta = obj.metadata as OutlineNodeMeta | undefined;
    if (!meta) return null;
    let id = this.blockIdToken(meta.blockId);
    if (!id) {
      id = `mm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      meta.blockId = ' ^' + id;
      await this.writeBackStructure(); // 把 ^id 写回源文件
    }
    return id;
  }

  /** 给已有挖空卡(同源文件)的节点打上「cloze」标记(优先按 blockId 定位)。 */
  private markClozedNodes(root: NodeObj, sourceFile: string | null) {
    if (!sourceFile) return;
    for (const card of this.plugin.flashcardManager.getAllFlashcards()) {
      const unit = this.plugin.dataManager.getContentUnit(card.sourceContentId);
      if (!unit || unit.extractRule?.ruleId !== 'mindmap-cloze') continue;
      const mm = unit.metadata?.customData?.mindmap as
        | { sourceFile?: string; blockId?: string | null; path?: string[] }
        | undefined;
      if (!mm || mm.sourceFile !== sourceFile) continue;
      let node = mm.blockId ? this.findNodeByBlockId(root, mm.blockId) : null;
      if (!node && mm.path) node = this.findNodeByPath(root, mm.path);
      if (!node) continue;
      const tags = Array.isArray(node.tags) ? node.tags.map((t) => String(t)) : [];
      if (!tags.includes('cloze')) tags.push('cloze');
      node.tags = tags;
    }
  }

  /** 从根到父节点(不含根、不含自身)的纯文本数组。 */
  private parentPathArray(obj: NodeObj): string[] {
    const parts: string[] = [];
    let p = obj.parent;
    while (p && p.id !== 'root') {
      parts.unshift(this.nodeCleanText(p));
      p = p.parent;
    }
    return parts;
  }

  /** 从父节点到根(不含根)的纯文本路径,作为挖空线索。 */
  private parentPath(obj: NodeObj): string {
    return this.parentPathArray(obj).join(' / ');
  }

  /** 挖空整个节点:节点文本作为答案,父路径作为线索。 */
  private clozeWholeNode() {
    const topic = this.currentTopic();
    if (!topic) {
      new Notice('请先选中一个节点');
      return;
    }
    const text = this.nodeCleanText(topic.nodeObj);
    if (!text) {
      new Notice('该节点没有可挖空的文本');
      return;
    }
    const path = this.parentPath(topic.nodeObj);
    const original = path ? `${path} → ${text}` : text;
    const deletions = [{ index: original.length - text.length, answer: text }];
    void this.createClozeFromNode({ original, deletions, topic, mode: 'whole', nodeText: text });
  }

  /** 挖空选中词:弹窗让用户用 == 标记要挖空的词。 */
  private clozeWords() {
    const topic = this.currentTopic();
    if (!topic) {
      new Notice('请先选中一个节点');
      return;
    }
    const text = this.nodeCleanText(topic.nodeObj);
    new ClozeBlankModal(this.app, text, (result: ClozeResult) => {
      void this.createClozeFromNode({
        original: result.original,
        deletions: result.deletions,
        topic,
        mode: 'words',
        nodeText: text,
      });
    }).open();
  }

  /** 创建 cloze 卡(先建 ContentUnit 再建卡),并给节点加视觉标记。 */
  private async createClozeFromNode(opts: {
    original: string;
    deletions: { index: number; answer: string }[];
    topic: { nodeObj: NodeObj };
    mode: 'whole' | 'words';
    nodeText: string;
  }) {
    const { original, deletions, topic, mode, nodeText } = opts;
    try {
      const now = Date.now();
      const id = `mm-cloze-${now}-${Math.random().toString(36).slice(2, 7)}`;
      // 来源文件:临时导图用 sourceFile,文档导图用 filePath
      const srcFile = this.sourceFile ?? this.filePath ?? null;
      const base = srcFile ? srcFile.split('/').pop()!.replace(/\.md$/, '') : '';
      // 锚点:文件模式下确保该节点源行有 ^id(没有就生成并写回),移动/改名后仍可定位
      const blockId = await this.ensureBlockId(topic.nodeObj);
      // 复习/标记定位信息:源文件 + blockId(优先)+ 纯文本路径(兜底)+ 模式
      const path = [...this.parentPathArray(topic.nodeObj), nodeText];
      const unit: ContentUnit = {
        id,
        type: 'cloze',
        content: original,
        fullContext: original,
        source: {
          file: srcFile || '(mindmap)',
          position: { start: 0, end: 0, line: 0 },
          anchorLink: srcFile ? `[[${base}]]` : '',
        },
        extractRule: { ruleId: 'mindmap-cloze', ruleName: 'Mindmap Cloze', extractedBy: 'manual' },
        metadata: {
          createdAt: now,
          updatedAt: now,
          tags: [],
          customData: {
            mindmap: {
              sourceFile: srcFile,
              blockId,
              path,
              mode,
              deletions: mode === 'words' ? deletions : [],
            },
          },
        },
        flashcardIds: [],
      };
      await this.plugin.dataManager.saveContentUnit(unit);
      await this.plugin.flashcardManager.createClozeCard(id, original, deletions);
      this.markNodeCloze(topic);
      new Notice('已加入间隔记忆(cloze)');
    } catch (e) {
      console.error('[learning-system] create cloze failed', e);
      new Notice('创建挖空卡失败,见控制台');
    }
  }

  /** 给节点加 cloze 标签作为视觉标记。 */
  private markNodeCloze(topic: { nodeObj: NodeObj }) {
    if (!this.mind) return;
    const obj = topic.nodeObj;
    const tags = Array.isArray(obj.tags) ? obj.tags.map((t) => String(t)) : [];
    if (!tags.includes('cloze')) tags.push('cloze');
    this.mind.reshapeNode(topic as never, { tags });
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
