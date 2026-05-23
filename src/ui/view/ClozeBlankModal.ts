import { App, Modal, Notice, Setting } from 'obsidian';

export interface ClozeResult {
  original: string;
  deletions: { index: number; answer: string }[];
}

/**
 * 词级挖空选择:展示节点文本,用户用 == 包裹要挖空的词(可多处),
 * 提交后解析为 cloze deletions(索引基于去掉 == 后的纯文本)。
 */
export class ClozeBlankModal extends Modal {
  private value: string;
  private onSubmit: (result: ClozeResult) => void;

  constructor(app: App, text: string, onSubmit: (result: ClozeResult) => void) {
    super(app);
    this.value = text;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: '挖空选中词(cloze)' });
    contentEl.createEl('p', {
      // eslint-disable-next-line obsidianmd/ui/sentence-case
      text: '用 == 包裹要挖空的词,可多处。例如:水的化学式是 ==H2O==。',
      cls: 'setting-item-description',
    });

    let textarea: HTMLTextAreaElement;
    new Setting(contentEl).setName('节点文本').then((s) => {
      s.controlEl.addClass('ls-cloze-control');
      textarea = s.controlEl.createEl('textarea', { cls: 'ls-cloze-textarea' });
      textarea.value = this.value;
      textarea.rows = 4;
    });

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText('创建挖空卡')
        .setCta()
        .onClick(() => {
          const result = parseBlanks(textarea.value);
          if (result.deletions.length === 0) {
            new Notice('请先用 == 标记要挖空的词');
            return;
          }
          this.close();
          this.onSubmit(result);
        })
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** 解析 ==...== 标记为纯文本 + 挖空区间(索引基于纯文本)。 */
export function parseBlanks(marked: string): ClozeResult {
  const re = /==(.+?)==/g;
  let original = '';
  let last = 0;
  let m: RegExpExecArray | null;
  const deletions: { index: number; answer: string }[] = [];
  while ((m = re.exec(marked)) !== null) {
    original += marked.slice(last, m.index);
    const index = original.length;
    original += m[1];
    deletions.push({ index, answer: m[1] });
    last = re.lastIndex;
  }
  original += marked.slice(last);
  return { original, deletions };
}
