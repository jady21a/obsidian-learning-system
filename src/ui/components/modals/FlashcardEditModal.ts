import { App, Modal } from 'obsidian';
import type { Flashcard } from '../../../core/FlashcardManager';
import { t } from '../../../i18n/translations';
import type LearningSystemPlugin from '../../../main';

export class FlashcardEditModal extends Modal {
  constructor(
    app: App,
    private plugin: LearningSystemPlugin,
    private card: Flashcard,
    private onSubmit: (question: string, answer: string) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    const lang = this.plugin.settings.language;
    contentEl.empty();
    contentEl.createEl('h3', { text: t('flashcardEdit.title', lang) });

    // Question
    contentEl.createEl('label', { text: t('flashcardEdit.question', lang) });
    const questionInput = contentEl.createEl('textarea');
    questionInput.value = this.card.front;

    // Answer
    contentEl.createEl('label', { text: t('flashcardEdit.answer', lang) });
    const answerInput = contentEl.createEl('textarea');
    answerInput.value =
      this.card.type === 'cloze'
        ? this.card.back?.[0] ?? ''
        : (this.card.back as string);

    // Save
    const saveBtn = contentEl.createEl('button', { text: t('flashcardEdit.save', lang) });
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
