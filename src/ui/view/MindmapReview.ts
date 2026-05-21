import { App, TFile } from 'obsidian';
import MindElixir from 'mind-elixir';
import type { NodeObj } from 'mind-elixir';
import mindElixirCss from 'mind-elixir/style.css';
import { buildTreeFromMarkdown, type OutlineNodeMeta } from '../../core/MindmapTreeBuilder';

const STYLE_EL_ID = 'learning-system-mindmap-styles';

/** 存在卡片来源 customData.mindmap 上的复习定位信息。 */
export interface MindmapCardMeta {
  sourceFile: string | null;
  path: string[];
  mode: 'whole' | 'words';
  deletions: { index: number; answer: string }[];
}

export interface GroupQuestionTarget {
  cardId: string;
  path: string[];
  nodeText: string;
  /** 相对 nodeText 的挖空区间(整节点模式为整段)。 */
  deletions: { index: number; answer: string }[];
}

export interface GroupAnswerTarget {
  path: string[];
  nodeText: string;
  deletions: { index: number; answer: string }[];
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

/** 问题面:节点文本里每个空替换为一段等长横线(不是输入框,也不是 [...])。 */
function buildBlankHtml(nodeText: string, deletions: { index: number; answer: string }[]): string {
  const sorted = [...deletions].sort((a, b) => a.index - b.index);
  let html = '';
  let last = 0;
  for (const d of sorted) {
    html += escapeHtml(nodeText.slice(last, d.index));
    const w = Math.max(2, d.answer.length);
    html += `<span class="mm-cloze-blank" style="width:${w}ch"></span>`;
    last = d.index + d.answer.length;
  }
  html += escapeHtml(nodeText.slice(last));
  return html;
}

/** 答案面:把被挖空的部分高亮显示出来。 */
function buildAnswerHtml(t: GroupAnswerTarget): string {
  const sorted = [...t.deletions].sort((a, b) => a.index - b.index);
  let html = '';
  let last = 0;
  for (const d of sorted) {
    html += escapeHtml(t.nodeText.slice(last, d.index));
    html += `<span class="mm-cloze-answer">${escapeHtml(d.answer)}</span>`;
    last = d.index + d.answer.length;
  }
  html += escapeHtml(t.nodeText.slice(last));
  return html;
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
 * 分组问题面:从源 .md 重建整棵导图,把每个到期挖空节点显示为等长横线。
 * 任一节点定位失败返回 false(调用方回退)。
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

  for (const t of targets) {
    const node = findByPath(nodeData, t.path);
    if (!node) return false;
    node.dangerouslySetInnerHTML = buildBlankHtml(t.nodeText, t.deletions);
    node.style = { background: '#fff3cd', color: '#000', border: '2px dashed #e0a800' };
  }

  newReadonlyMap(container, nodeData);
  return true;
}

/** 分组答案面:每个挖空节点显示正确答案并按对错着色。 */
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

  for (const t of targets) {
    const node = findByPath(nodeData, t.path);
    if (!node) return false;
    node.dangerouslySetInnerHTML = buildAnswerHtml(t);
    node.style = { background: '#4caf50', color: '#fff' };
  }

  newReadonlyMap(container, nodeData);
  return true;
}
