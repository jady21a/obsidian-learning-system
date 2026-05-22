import { App, TFile } from 'obsidian';
import MindElixir from 'mind-elixir';
import type { NodeObj } from 'mind-elixir';
import mindElixirCss from 'mind-elixir/style.css';
import { buildTreeFromMarkdown, type OutlineNodeMeta } from '../../core/MindmapTreeBuilder';

const STYLE_EL_ID = 'learning-system-mindmap-styles';

/** 存在卡片来源 customData.mindmap 上的复习定位信息。 */
export interface MindmapCardMeta {
  sourceFile: string | null;
  /** 锚点:节点源行的 block id(优先用它定位,移动/改名后仍有效)。 */
  blockId?: string | null;
  path: string[];
  mode: 'whole' | 'words';
  deletions: { index: number; answer: string }[];
}

export interface GroupQuestionTarget {
  cardId: string;
  blockId?: string | null;
  path: string[];
  nodeText: string;
  /** 相对 nodeText 的挖空区间(整节点模式为整段)。 */
  deletions: { index: number; answer: string }[];
}

export interface GroupAnswerTarget {
  blockId?: string | null;
  path: string[];
  nodeText: string;
  deletions: { index: number; answer: string }[];
  /** 与 deletions 同序:每个空的用户答案与是否正确。 */
  blanks: { user: string; correct: boolean }[];
}

function injectStyles() {
  if (document.getElementById(STYLE_EL_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_EL_ID;
  styleEl.textContent = mindElixirCss;
  document.head.appendChild(styleEl);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanText(node: NodeObj): string {
  const meta = node.metadata as OutlineNodeMeta | undefined;
  if (meta?.text) return meta.text;
  return node.topic
    .replace(/^(#{1,6}|[IVXLCDMivxlcdm]+|[-*+]|\d+[.)]|!!)\s+/, '')
    .replace(/^\[[ xX]\]\s+/, '')
    .trim();
}

/** 按纯文本路径在树里定位节点。 */
function findByPath(root: NodeObj, path: string[]): NodeObj | null {
  let children = root.children ?? [];
  let found: NodeObj | null = null;
  for (const seg of path) {
    const next = children.find((n) => cleanText(n) === seg);
    if (!next) return null;
    found = next;
    children = next.children ?? [];
  }
  return found;
}

/** 从 meta.blockId(形如 ' ^abc')提取裸 id。 */
function blockIdToken(s?: string | null): string | null {
  if (!s) return null;
  const m = s.match(/\^([\w-]+)/);
  return m ? m[1] : null;
}

/** 按 block id 在树里定位节点(深度优先)。 */
function findByBlockId(root: NodeObj, id: string): NodeObj | null {
  const stack: NodeObj[] = [...(root.children ?? [])];
  while (stack.length) {
    const n = stack.shift()!;
    const meta = n.metadata as OutlineNodeMeta | undefined;
    if (blockIdToken(meta?.blockId) === id) return n;
    if (n.children) stack.push(...n.children);
  }
  return null;
}

/** 优先用 block id 定位,回退到纯文本路径。 */
function locate(root: NodeObj, target: { blockId?: string | null; path: string[] }): NodeObj | null {
  if (target.blockId) {
    const byId = findByBlockId(root, target.blockId);
    if (byId) return byId;
  }
  return findByPath(root, target.path);
}

/** 问题面:节点文本里每个空替换为一段带编号的等长横线(编号对应下方输入框)。 */
function buildBlankHtml(
  nodeText: string,
  deletions: { index: number; answer: string }[],
  startNo: number
): { html: string; used: number } {
  const sorted = [...deletions].sort((a, b) => a.index - b.index);
  let html = '';
  let last = 0;
  let no = startNo;
  for (const d of sorted) {
    html += escapeHtml(nodeText.slice(last, d.index));
    const w = Math.max(2, d.answer.length);
    html += `<sup class="mm-blank-idx">${no}</sup><span class="mm-cloze-blank" style="width:${w}ch"></span>`;
    last = d.index + d.answer.length;
    no++;
  }
  html += escapeHtml(nodeText.slice(last));
  return { html, used: no - startNo };
}

/** 答案面:每个空显示带编号的正确答案,正确绿色、错误红色。 */
function buildAnswerHtml(t: GroupAnswerTarget, startNo: number): { html: string; used: number } {
  const sorted = t.deletions
    .map((d, i) => ({ ...d, i }))
    .sort((a, b) => a.index - b.index);
  let html = '';
  let last = 0;
  let no = startNo;
  for (const d of sorted) {
    html += escapeHtml(t.nodeText.slice(last, d.index));
    const blank = t.blanks[d.i] ?? { user: '', correct: false };
    const cls = blank.correct ? 'mm-cloze-correct' : 'mm-cloze-wrong';
    html += `<sup class="mm-blank-idx">${no}</sup><span class="${cls}">${escapeHtml(d.answer)}</span>`;
    last = d.index + d.answer.length;
    no++;
  }
  html += escapeHtml(t.nodeText.slice(last));
  return { html, used: no - startNo };
}

function newReadonlyMap(container: HTMLElement, nodeData: NodeObj) {
  injectStyles();
  container.empty();
  container.style.width = '100%';
  container.style.height = '320px';
  const mind = new MindElixir({
    el: container,
    direction: MindElixir.RIGHT,
    editable: false,
    contextMenu: false,
    toolBar: false,
    allowUndo: false,
    keypress: false,
  });
  mind.init({ nodeData });
  return mind;
}

/**
 * 分组问题面:从源 .md 重建整棵导图,把每个到期挖空节点显示为带编号的横线。
 * 编号与下方输入框列表一一对应。任一节点定位失败返回 false(调用方回退)。
 */
export async function renderMindmapGroupQuestion(
  app: App,
  container: HTMLElement,
  sourceFile: string,
  targets: GroupQuestionTarget[]
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(sourceFile);
  if (!(file instanceof TFile)) return false;
  const text = await app.vault.cachedRead(file);
  const { nodeData } = buildTreeFromMarkdown(file.name, text);

  let no = 1;
  for (const t of targets) {
    const node = locate(nodeData, t);
    if (!node) return false;
    const r = buildBlankHtml(t.nodeText, t.deletions, no);
    node.dangerouslySetInnerHTML = r.html;
    no += r.used;
    node.style = { background: '#fff3cd', color: '#000', border: '2px dashed #e0a800' };
  }

  newReadonlyMap(container, nodeData);
  return true;
}

/** 分组答案面:每个挖空节点显示带编号的正确答案并按对错着色。 */
export async function renderMindmapGroupAnswer(
  app: App,
  container: HTMLElement,
  sourceFile: string,
  targets: GroupAnswerTarget[]
): Promise<boolean> {
  const file = app.vault.getAbstractFileByPath(sourceFile);
  if (!(file instanceof TFile)) return false;
  const text = await app.vault.cachedRead(file);
  const { nodeData } = buildTreeFromMarkdown(file.name, text);

  let no = 1;
  for (const t of targets) {
    const node = locate(nodeData, t);
    if (!node) return false;
    const r = buildAnswerHtml(t, no);
    node.dangerouslySetInnerHTML = r.html;
    no += r.used;
    const allCorrect = t.blanks.every((b) => b.correct);
    node.style = allCorrect
      ? { background: '#4caf50', color: '#fff' }
      : { background: '#f44336', color: '#fff' };
  }

  newReadonlyMap(container, nodeData);
  return true;
}
