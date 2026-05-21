import type { MindElixirData, NodeObj } from 'mind-elixir';
import { Flashcard } from './FlashcardManager';

export interface CardNodeMeta {
  cardId: string;
  sourceFile: string;
}

const STATE_COLOR: Record<Flashcard['scheduling']['state'], string> = {
  new: '#9e9e9e',
  learning: '#ff9800',
  relearning: '#f44336',
  review: '#4caf50',
};

function truncate(text: string, max = 40): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

function fileLabel(path: string): string {
  const name = path.split('/').pop() || path;
  return name.replace(/\.md$/, '');
}

/**
 * 把现有闪卡按来源文件分组,构造 Mind Elixir 只读树。
 * 节点 id = 卡片 id;颜色映射调度状态;metadata 携带回链信息。
 */
export function buildTreeFromFlashcards(flashcards: Flashcard[]): MindElixirData {
  const byFile = new Map<string, Flashcard[]>();
  for (const card of flashcards) {
    const key = card.sourceFile || '(未分类)';
    if (!byFile.has(key)) byFile.set(key, []);
    byFile.get(key)!.push(card);
  }

  const fileNodes: NodeObj[] = [];
  for (const [file, cards] of byFile) {
    const children: NodeObj[] = cards.map((card) => ({
      topic: truncate(card.front),
      id: card.id,
      style: { background: STATE_COLOR[card.scheduling.state] ?? '#9e9e9e', color: '#fff' },
      tags: [card.scheduling.state],
      metadata: { cardId: card.id, sourceFile: card.sourceFile } as CardNodeMeta,
    }));
    fileNodes.push({
      topic: `${fileLabel(file)} (${cards.length})`,
      id: `file-${file}`,
      children,
    });
  }

  const nodeData: NodeObj = {
    topic: `Learning System (${flashcards.length})`,
    id: 'root',
    children: fileNodes,
  };

  return { nodeData };
}

/**
 * 大纲节点的无损元数据:既用于显示,也用于序列化回写。
 * 关键点是保留足够信息,让「未改动的节点」能逐字节还原原行。
 */
export interface OutlineNodeMeta {
  line: number; // 解析时的源行号(参考用;序列化不依赖它)
  kind: 'heading' | 'list' | 'important';
  level: number; // heading: 1-6;list/important: 未用
  marker: string; // list 标记,如 '-' '*' '1.';heading/important 为 ''
  checkbox: string; // 任务复选框前缀,如 '[ ] ' / '[x] ';无则 ''
  blockId: string; // 行尾 block id(含前导空格),如 ' ^abc';无则 ''
  text: string; // 原始文本(去掉前缀/复选框/blockId,未折叠空白、未截断)
  trailing: string[]; // 紧随其后、属于该节点的非大纲行(段落/空行/代码块),逐字保留
}

/** 大纲根节点的元数据。 */
export interface OutlineRootMeta {
  isOutlineRoot: true;
  leading: string[]; // 第一个大纲行之前的所有行(frontmatter/前言),逐字保留
  indentUnit: string; // 列表缩进单位,如 '  ' 或 '\t'
  eol: string; // 换行符 '\n' 或 '\r\n'
}

function collapseWs(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** 显示用文本:折叠空白 + 截断。 */
function displayText(text: string): string {
  return truncate(collapseWs(text), 60);
}

const BLOCK_ID_RE = /(\s+\^[\w-]+)\s*$/;
const CHECKBOX_RE = /^\[[ xX]\]\s+/;
/** 行首「重要句」标记:!! 后跟 0~5 个空格,再接非空字符。 */
const IMPORTANT_RE = /^!! {0,5}(\S.*)$/;

function clampLevel(level: number): number {
  return Math.min(6, Math.max(1, level || 1));
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
/** 标题级别 → 罗马数字(仅用于导图标签显示)。 */
function toRoman(level: number): string {
  return ROMAN[Math.min(10, Math.max(1, level))] || 'I';
}
/** 罗马数字 → 级别(0 表示不是合法罗马数字)。 */
function romanToLevel(s: string): number {
  const i = ROMAN.indexOf(s.toUpperCase());
  return i > 0 ? i : 0;
}

/**
 * 节点显示文本:把结构标识一并显示在标签里。
 * - 标题:用罗马数字 I/II/III…(文件里仍是 #,罗马数字只用于导图显示)
 * - 列表:显示原标记 - / * / 1.(含 [ ] 复选框)
 * - 重要句:显示 !!
 * 解析时用它给 node.topic 赋值;序列化时用它判断节点是否被改动过。
 */
function bakeTopic(meta: OutlineNodeMeta): string {
  const body = displayText(meta.text);
  if (meta.kind === 'heading') return toRoman(clampLevel(meta.level)) + ' ' + body;
  if (meta.kind === 'important') return '!! ' + body;
  return (meta.marker || '-') + ' ' + meta.checkbox + body;
}

/**
 * 把一篇 markdown 文档的大纲(标题 + 列表)解析为 Mind Elixir 树(无损)。
 * - 标题(#~######)按层级嵌套;列表项按缩进嵌套,挂到最近标题下;
 * - 非大纲行(段落、空行、代码块、frontmatter)逐字保留:
 *   挂到前一个大纲节点的 trailing,或(在首个大纲行之前)挂到根的 leading;
 * - 每个节点保留足够信息,未改动时可逐字还原原行(见 serializeOutline)。
 */
export function buildTreeFromMarkdown(fileName: string, markdown: string): MindElixirData {
  let idCounter = 0;
  const newId = () => `n${idCounter++}`;

  const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
  const rootMeta: OutlineRootMeta = {
    isOutlineRoot: true,
    leading: [],
    indentUnit: '  ',
    eol,
  };
  let indentUnitSet = false;
  const root: NodeObj = {
    topic: fileName.replace(/\.md$/, ''),
    id: 'root',
    children: [],
    metadata: rootMeta,
  };

  const headingStack: { level: number; node: NodeObj }[] = [{ level: 0, node: root }];
  let listStack: { indent: number; node: NodeObj }[] = [];
  let lastNode: NodeObj | null = null;

  const attach = (line: string) => {
    if (lastNode) (lastNode.metadata as OutlineNodeMeta).trailing.push(line);
    else rootMeta.leading.push(line);
  };

  const lines = markdown.split(/\r?\n/);
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 围栏代码块:开关行与块内内容都按非大纲行逐字保留
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      attach(line);
      continue;
    }
    if (inFence || trimmed.length === 0) {
      attach(line);
      continue;
    }

    // 标题
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const level = heading[1].length;
      let text = heading[2];
      const blockId = text.match(BLOCK_ID_RE)?.[1] ?? '';
      if (blockId) text = text.slice(0, text.length - blockId.length);

      while (headingStack.length > 1 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      const parent = headingStack[headingStack.length - 1].node;
      const meta: OutlineNodeMeta = {
        line: i,
        kind: 'heading',
        level,
        marker: '',
        checkbox: '',
        blockId,
        text,
        trailing: [],
      };
      const node: NodeObj = { topic: bakeTopic(meta), id: newId(), children: [], metadata: meta };
      parent.children!.push(node);
      headingStack.push({ level, node });
      listStack = [];
      lastNode = node;
      continue;
    }

    // 重要句:行首 !! (后跟 0~5 个空格)
    const important = line.match(IMPORTANT_RE);
    if (important) {
      let text = important[1];
      const blockId = text.match(BLOCK_ID_RE)?.[1] ?? '';
      if (blockId) text = text.slice(0, text.length - blockId.length);

      const parent = headingStack[headingStack.length - 1].node;
      const meta: OutlineNodeMeta = {
        line: i,
        kind: 'important',
        level: 0,
        marker: '',
        checkbox: '',
        blockId,
        text,
        trailing: [],
      };
      const node: NodeObj = { topic: bakeTopic(meta), id: newId(), children: [], metadata: meta };
      parent.children!.push(node);
      listStack = []; // 重要句在 section 层,打断当前列表上下文
      lastNode = node;
      continue;
    }

    // 列表项
    const list = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
    if (list) {
      const indentStr = list[1];
      if (!indentUnitSet && indentStr.length > 0) {
        rootMeta.indentUnit = indentStr;
        indentUnitSet = true;
      }
      const indent = indentStr.replace(/\t/g, '    ').length;

      let text = list[3];
      const blockId = text.match(BLOCK_ID_RE)?.[1] ?? '';
      if (blockId) text = text.slice(0, text.length - blockId.length);
      const checkbox = text.match(CHECKBOX_RE)?.[0] ?? '';
      if (checkbox) text = text.slice(checkbox.length);

      while (listStack.length > 0 && listStack[listStack.length - 1].indent >= indent) {
        listStack.pop();
      }
      const parent =
        listStack.length > 0
          ? listStack[listStack.length - 1].node
          : headingStack[headingStack.length - 1].node;
      const meta: OutlineNodeMeta = {
        line: i,
        kind: 'list',
        level: 0,
        marker: list[2],
        checkbox,
        blockId,
        text,
        trailing: [],
      };
      const node: NodeObj = { topic: bakeTopic(meta), id: newId(), children: [], metadata: meta };
      parent.children!.push(node);
      listStack.push({ indent, node });
      lastNode = node;
      continue;
    }

    // 其它(普通段落)
    attach(line);
  }

  return { nodeData: root };
}

/** 渲染单个大纲节点的行。 */
function renderOutlineLine(
  node: NodeObj,
  listDepth: number,
  indentUnit: string,
  seenBlockIds: Set<string>
): string {
  const meta = node.metadata as OutlineNodeMeta | undefined;

  // blockId 去重(防止复制节点产生重复 block id)
  const useBlockId = () => {
    let blockId = meta?.blockId ?? '';
    if (blockId) {
      const id = blockId.trim();
      if (seenBlockIds.has(id)) blockId = '';
      else seenBlockIds.add(id);
    }
    return blockId;
  };

  // 未改动:节点标签等于按 meta 烘焙出的标签 → 用原始 text 无损还原
  if (meta && node.topic === bakeTopic(meta)) {
    const blockId = useBlockId();
    if (meta.kind === 'heading') {
      return '#'.repeat(clampLevel(meta.level)) + ' ' + meta.text + blockId;
    }
    if (meta.kind === 'important') {
      return indentUnit.repeat(listDepth) + '!! ' + meta.text + blockId;
    }
    return indentUnit.repeat(listDepth) + (meta.marker || '-') + ' ' + meta.checkbox + meta.text + blockId;
  }

  // 改动过(或新建):解析标签里的符号决定类型(在标签里改 #/-/!! 即可改类型)
  const blockId = useBlockId();
  const topic = node.topic;

  // 显式 # 前缀:升/保持为标题(任何节点都可用 # 改成标题)
  const h = topic.match(/^(#{1,6})\s+(.*)$/);
  if (h) return '#'.repeat(h[1].length) + ' ' + h[2] + blockId;

  const imp = topic.match(IMPORTANT_RE);
  if (imp) return indentUnit.repeat(listDepth) + '!! ' + imp[1] + blockId;

  const l = topic.match(/^([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)$/);
  if (l) {
    return indentUnit.repeat(listDepth) + l[1] + ' ' + (l[2] ?? '') + l[3] + blockId;
  }

  // 标题节点显示为罗马数字:编辑后标签仍以罗马数字开头则按其级别还原(可改级别)
  if (meta?.kind === 'heading') {
    const r = topic.match(/^([IVXLCDMivxlcdm]+)\s+(.*)$/);
    const lvl = r ? romanToLevel(r[1]) : 0;
    if (lvl) return '#'.repeat(clampLevel(lvl)) + ' ' + r![2] + blockId;
    return '#'.repeat(clampLevel(meta.level)) + ' ' + topic + blockId;
  }

  // 其它:按原类型保留,只换文本(避免误改结构);新节点默认列表项
  if (meta?.kind === 'important') return indentUnit.repeat(listDepth) + '!! ' + topic + blockId;
  return indentUnit.repeat(listDepth) + (meta?.marker || '-') + ' ' + (meta?.checkbox ?? '') + topic + blockId;
}

/**
 * 把(可能已被编辑过的)大纲树序列化回 markdown 整文。
 * - 保留根的 leading 与每个节点的 trailing(非大纲内容逐字还原);
 * - 列表缩进按当前层级用 indentUnit 重算(移动节点时自动正确);
 * - 标题无论被移动到何处都按 # 形式输出(按既定规则)。
 */
export function serializeOutline(root: NodeObj): string {
  const rootMeta = root.metadata as OutlineRootMeta | undefined;
  const indentUnit = rootMeta?.indentUnit || '  ';
  const eol = rootMeta?.eol || '\n';
  const out: string[] = [];
  const seenBlockIds = new Set<string>();

  if (rootMeta?.leading) out.push(...rootMeta.leading);

  const emit = (node: NodeObj, listDepth: number) => {
    out.push(renderOutlineLine(node, listDepth, indentUnit, seenBlockIds));
    const meta = node.metadata as OutlineNodeMeta | undefined;
    if (meta?.trailing) out.push(...meta.trailing);
    const childDepth = meta?.kind === 'heading' ? 0 : listDepth + 1;
    for (const child of node.children ?? []) emit(child, childDepth);
  };

  for (const child of root.children ?? []) emit(child, 0);

  return out.join(eol);
}
