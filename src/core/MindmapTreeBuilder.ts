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

export interface OutlineNodeMeta {
  /** 该节点对应源文件中的行号(0-based),供步骤3双向同步使用。 */
  line: number;
}

/** 清理大纲文本:去掉行尾 block id、折叠空白、截断。 */
function cleanOutlineText(text: string): string {
  let t = text.trim();
  t = t.replace(/\s+\^[\w-]+$/, ''); // 行尾 ^blockid
  t = t.replace(/^\[[ xX]\]\s+/, ''); // 任务复选框 [ ] / [x]
  return truncate(t, 60);
}

/**
 * 把一篇 markdown 文档的大纲(标题 + 列表)解析为 Mind Elixir 树。
 * - 标题(#~######)按层级嵌套;
 * - 列表项按缩进嵌套,挂到最近的标题下(无标题则挂根);
 * - 跳过围栏代码块内的内容;普通段落忽略。
 * 每个节点的 metadata.line 记录源行号,供后续写回。
 */
export function buildTreeFromMarkdown(fileName: string, markdown: string): MindElixirData {
  let idCounter = 0;
  const newId = () => `n${idCounter++}`;

  const root: NodeObj = { topic: fileName.replace(/\.md$/, ''), id: 'root', children: [] };

  // 标题栈:level 0 为根
  const headingStack: { level: number; node: NodeObj }[] = [{ level: 0, node: root }];
  // 列表栈:按缩进
  let listStack: { indent: number; node: NodeObj }[] = [];

  const lines = markdown.split(/\r?\n/);
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 围栏代码块开关(``` 或 ~~~)
    if (/^(```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || trimmed.length === 0) continue;

    // 标题
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const level = heading[1].length;
      while (headingStack.length > 1 && headingStack[headingStack.length - 1].level >= level) {
        headingStack.pop();
      }
      const parent = headingStack[headingStack.length - 1].node;
      const node: NodeObj = {
        topic: cleanOutlineText(heading[2]),
        id: newId(),
        children: [],
        metadata: { line: i } as OutlineNodeMeta,
      };
      parent.children!.push(node);
      headingStack.push({ level, node });
      listStack = []; // 新标题下列表重新开始
      continue;
    }

    // 列表项
    const list = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
    if (list) {
      const indent = list[1].replace(/\t/g, '    ').length;
      while (listStack.length > 0 && listStack[listStack.length - 1].indent >= indent) {
        listStack.pop();
      }
      const parent =
        listStack.length > 0
          ? listStack[listStack.length - 1].node
          : headingStack[headingStack.length - 1].node;
      const node: NodeObj = {
        topic: cleanOutlineText(list[3]),
        id: newId(),
        children: [],
        metadata: { line: i } as OutlineNodeMeta,
      };
      parent.children!.push(node);
      listStack.push({ indent, node });
      continue;
    }
  }

  return { nodeData: root };
}
