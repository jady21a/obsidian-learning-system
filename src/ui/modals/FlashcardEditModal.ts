import { App, Modal } from 'obsidian';
import type { Flashcard } from '../../core/FlashcardManager';

export class FlashcardEditModal extends Modal {
  constructor(
    app: App,
    private card: Flashcard,
    private onSubmit: (question: string, answer: string) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h3', { text: '编辑闪卡' });

    // Question
    contentEl.createEl('label', { text: '问题' });
    const questionInput = contentEl.createEl('textarea');
    questionInput.value = this.card.front;

    // Answer
    contentEl.createEl('label', { text: '答案' });
    const answerInput = contentEl.createEl('textarea');
    answerInput.value =
      this.card.type === 'cloze'
        ? this.card.back?.[0] ?? ''
        : (this.card.back as string);

    // Save
    const saveBtn = contentEl.createEl('button', { text: '保存' });
    saveBtn.onclick = () => {
      this.onSubmit(
        questionInput.value.trim(),
        answerInput.value.trim()
      );
      this.close();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}
