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
