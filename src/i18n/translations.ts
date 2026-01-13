// src/i18n/translations.ts
export type Language = 'en' | 'zh-CN';

// 定义翻译键类型
type TranslationKey = 
  | 'view.overview'
  | 'view.review'
  | 'view.stats'
  | 'toolbar.search'
  | 'toolbar.filter.all'
  | 'toolbar.filter.annotated'
  | 'toolbar.filter.flashcards'
  | 'toolbar.group.file'
  | 'toolbar.group.annotation'
  | 'toolbar.group.tag'
  | 'toolbar.group.date'
  | 'toolbar.checkReview'
  | 'batch.selectAll'
  | 'batch.create'
  | 'batch.delete'
  | 'batch.cancel'
  | 'entry.allNotes'
  | 'entry.cardList'
  | 'level.1'
  | 'level.2'
  | 'level.3'
  | 'level.4'
  | 'level.5'
  | 'level.current'
  | 'level.clickDetails'
  | 'review.today'
  | 'review.start'
  | 'review.justDue'
  | 'review.delayed'
  | 'review.urgentHours'
  | 'review.urgentDays'
  | 'review.streak'
  | 'notice.noSelection'
  | 'notice.noDueCards'
  | 'notice.deleted'
  | 'notice.saved'
  | 'command.scanFile'
  | 'command.scanVault'
  | 'command.openOverview'
  | 'command.openMainOverview'
  | 'command.addAnnotation'
  | 'command.startReview'
  | 'command.showStats'
  | 'ribbon.overview'
  | 'ribbon.review'
  | 'menu.jumpToSource'
  | 'menu.toggleAnnotation'
  | 'menu.editFlashcard'
  | 'menu.quickGenerate'
  | 'menu.createQA'
  | 'menu.createCloze'
  | 'menu.viewStats'
  | 'menu.delete'
  | 'status.due'
  | 'status.tooltip'
  | 'empty.noContent'
  | 'empty.noDocuments'
  | 'fileList.title'

  | 'notice.fileNotFound'
| 'notice.jumpedToSource'
| 'notice.jumpFailed'
| 'notice.flashcardNotFound'
| 'notice.alreadyHasFlashcards'
| 'notice.batchDeleted'
| 'confirm.deleteNote'
| 'confirm.deleteFlashcard'
| 'confirm.batchDeleteNotes'
| 'confirm.batchDeleteFlashcards'
  
| 'toolbar.checkReview.tooltip'

| 'batch.deselectAll'
| 'batch.deselectAll.tooltip'
| 'batch.selectAll.tooltip'
| 'batch.noItems'
| 'batch.selectAnnotationFirst'
| 'batch.create.tooltip'
| 'batch.delete.tooltip'
| 'batch.cancel.tooltip'
// review
| 'confirm.resetCardStats'
| 'confirm.resetDeckStats'
| 'notice.deckStatsReset'
| 'notice.flashcardDeleted'
| 'notice.deleteFlashcardFailed'
| 'notice.flashcardUpdated'
| 'notice.updateFlashcardFailed'
| 'notice.cardStatsReset'
| 'notice.resetStatsFailed'
// sidebar
| 'review.todayProgress'
| 'review.delayedHoursShort'
| 'group.uncategorized'
// component/modal/batch
| 'batchCreate.title'
| 'batchCreate.description'
| 'batchCreate.cardType'
| 'batchCreate.smartType'
| 'batchCreate.smartType.desc'
| 'batchCreate.qaType'
| 'batchCreate.qaType.desc'
| 'batchCreate.clozeType'
| 'batchCreate.clozeType.desc'
| 'batchCreate.cancel'
| 'batchCreate.createButton'
| 'batchCreate.successNotice'
// component/modal/EditFlashcardModal
| 'editCard.title'
| 'editCard.description.qa'
| 'editCard.description.cloze'
| 'editCard.info.file'
| 'editCard.info.deck'
| 'editCard.info.reviews'
| 'editCard.info.correct'
| 'editCard.front.qa'
| 'editCard.front.cloze'
| 'editCard.front.desc'
| 'editCard.back.qa'
| 'editCard.back.cloze'
| 'editCard.back.desc.qa'
| 'editCard.back.desc.cloze'
| 'editCard.cancel'
| 'editCard.save'
| 'editCard.error.emptyFront'
| 'editCard.error.emptyBack'
| 'editCard.success'
| 'editCard.saveFailed'
// component/modal/FlashcardEditModal
| 'flashcardEdit.title'
| 'flashcardEdit.question'
| 'flashcardEdit.answer'
| 'flashcardEdit.save'
// component/modal/ManualFlashcardModal.ts
| 'manualCard.title.qa'
| 'manualCard.title.cloze'
| 'manualCard.description.qa'
| 'manualCard.description.cloze'
| 'manualCard.front.qa'
| 'manualCard.front.cloze'
| 'manualCard.front.desc.qa'
| 'manualCard.front.desc.cloze'
| 'manualCard.front.placeholder.qa'
| 'manualCard.front.placeholder.cloze'
| 'manualCard.back.qa'
| 'manualCard.back.cloze'
| 'manualCard.back.desc.qa'
| 'manualCard.back.desc.cloze'
| 'manualCard.back.placeholder.qa'
| 'manualCard.back.placeholder.cloze'
| 'manualCard.cancel'
| 'manualCard.create'
| 'manualCard.error.emptyFront'
| 'manualCard.error.emptyBack'
| 'manualCard.success.qa'
| 'manualCard.success.cloze'
| 'manualCard.createFailed'
// src/ui/components/ContentList.ts 
| 'contentList.group.annotated'
| 'contentList.group.notAnnotated'
| 'contentList.empty.noFlashcards'
| 'contentList.empty.noNotes'
| 'contentList.empty.tryFilter'
| 'contentList.empty.startHighlight'
| 'contentList.empty.noContent'
// src/ui/components/ContextMenuBuilder.ts
| 'contextMenu.jumpToSource'
| 'contextMenu.editAnnotation'
| 'contextMenu.editFlashcard'
| 'contextMenu.generateFlashcard'
| 'contextMenu.createQA'
| 'contextMenu.createCloze'
| 'contextMenu.viewStats'
| 'contextMenu.deleteNote'
| 'contextMenu.editCard'
| 'contextMenu.deleteCard'
| 'stats.title'
| 'stats.file'
| 'stats.type'
| 'stats.type.qa'
| 'stats.type.cloze'
| 'stats.deck'
| 'stats.tags'
| 'stats.tags.none'
| 'stats.reviewCount'
| 'stats.correctCount'
| 'stats.accuracy'
| 'stats.averageTime'
| 'stats.difficulty'
| 'stats.createdAt'
| 'stats.lastReview'
| 'stats.lastReview.never'
| 'stats.nextReview'
| 'stats.interval'
| 'stats.ease'
| 'stats.separator'
| 'stats.times'
| 'stats.seconds'
| 'stats.days'
// src/ui/services/OverviewService.ts
| 'service.fileNotExist'
| 'service.annotationDeleted'
| 'service.flashcardGenerated'
| 'service.generateFailed'
| 'service.flashcardNotFound'
| 'service.sourceFileOpened'
| 'service.noteNotFound'
// 最近删除
| 'confirm.deleteWillRemove'
| 'confirm.note'
| 'confirm.notes'
| 'confirm.flashcards'
| 'confirm.annotation'
| 'confirm.cannotUndo'
| 'notice.fileDeleted'
| 'notice.autoCleanup'
| 'recentDelete.title'
| 'recentDelete.empty'
| 'recentDelete.restore'
| 'recentDelete.deletePermanently'

| 'notice.movedToTrash'
| 'notice.batchMovedToTrash'
| 'notice.fileDeletedSimple'
| 'notice.noteRestored'
| 'notice.cardRestored'
| 'notice.cardsRestored'
| 'notice.restoreFailed'
| 'notice.permanentlyDeleted'
| 'notice.deleteFailed'
| 'notice.allDeleted'
| 'recentDelete.clearAll'
| 'recentDelete.emptyHint'
| 'confirm.clearAllDeleted'
| 'confirm.restoreAssociatedCards'
| 'deleteReason.user'
| 'deleteReason.note'
| 'deleteReason.file'
| 'time.justNow'
| 'time.minutesAgo'
| 'time.hoursAgo'
| 'time.daysAgo'
// delete confirm
| 'confirm.deleteItems'
| 'confirm.notesCount'
| 'confirm.cardsCount'
// quick flashcard  creator
| 'quickCard.created.qa'
| 'quickCard.created.cloze'
| 'quickCard.createFailed'
| 'quickCard.noKeywords'
| 'quickCard.noDeletions'
| 'quickCard.question.default.heading'
| 'quickCard.question.default.short'
| 'quickCard.question.default.medium'
| 'quickCard.question.default.long'
// UnlockSystem
| 'unlock.level.1'
| 'unlock.level.2'
| 'unlock.level.3'
| 'unlock.level.4'
| 'unlock.level.5'
| 'unlock.levelUp.1'
| 'unlock.levelUp.2'
| 'unlock.levelUp.3'
| 'unlock.levelUp.4'
| 'unlock.levelUp.5'
| 'unlock.progress.cardsExtracted'
| 'unlock.progress.annotationsCompleted'
| 'unlock.progress.cardsReviewed'
| 'unlock.progress.tablesScanned'
| 'unlock.progress.consecutiveDays'
| 'unlock.progress.totalDays'
| 'unlock.progress.statsPageVisited'
| 'unlock.nextSteps.level1'
| 'unlock.nextSteps.level2'
| 'unlock.nextSteps.level3'
| 'unlock.nextSteps.level4'
| 'unlock.nextSteps.level5'
| 'unlock.modal.title'
| 'unlock.modal.requireLevel'
| 'unlock.modal.currentProgress'
| 'unlock.levelInfo.title'
| 'unlock.levelInfo.cumulativeStats'
| 'unlock.levelInfo.milestones'
| 'unlock.stat.cardsExtracted'
| 'unlock.stat.annotationsCompleted'
| 'unlock.stat.cardsReviewed'
| 'unlock.stat.tablesScanned'
| 'unlock.stat.consecutiveDays'
| 'unlock.stat.totalDays'
| 'unlock.community.locked'
| 'unlock.community.link'


| 'filter.unannotated'
// unlock refactor
| 'unlock.stat.notesExtractedAsText'
| 'unlock.stat.notesExtractedAsQA'
| 'unlock.stat.notesExtractedAsCloze'
| 'unlock.stat.notesScanned'

// 定义翻译字典类型
type TranslationDict = Record<TranslationKey, string> & {
  [key: string]: string; // 添加索引签名以支持动态键
};

export const translations: Record<Language, TranslationDict> = {
  en: {
    // View titles
    'view.overview': 'Learning Overview',
    'view.review': 'Review',
    'view.stats': 'Statistics',
    
    // Toolbar
    'toolbar.search': 'Search...',
    'toolbar.filter.all': 'All',
    'toolbar.filter.annotated': 'Annotated',
    'toolbar.filter.flashcards': 'Flashcards',
    'toolbar.group.file': 'By File',
    'toolbar.group.annotation': 'By Annotation',
    'toolbar.group.tag': 'By Tag',
    'toolbar.group.date': 'By Date',
    'toolbar.checkReview': 'Check Review',
    
    // Batch actions
    'batch.selectAll': 'Select All',
    'batch.create': 'Create Flashcards',
    'batch.delete': 'Delete',
    'batch.cancel': 'Cancel',
    
    // Fixed entries
    'entry.allNotes': 'All Notes',
    'entry.cardList': 'Card List',
    
    // Level names
    'level.1': 'Collector',
    'level.2': 'Thinker',
    'level.3': 'Memorizer',
    'level.4': 'Trainer',
    'level.5': 'Analyst',
    'level.current': 'Current Level',
    'level.clickDetails': 'Click for details',
    
    // Review reminder
    'review.today': 'Today\'s Review',
    'review.start': 'Start Review',
    'review.justDue': '⏰ Just due, review while hot',
    'review.delayed': '⚠️ Review delayed {hours} hours',
    'review.urgentHours': '⚠️ Review delayed {hours} hours, recommend priority',
    'review.urgentDays': '🚨 Review delayed {days} days, clear ASAP!',
    'review.streak': '🔥 Day {days} streak!',
    
    // Notices
    'notice.noSelection': '⚠️ No items selected',
    'notice.noDueCards': 'No cards due for review!',
    'notice.deleted': '🗑️ Deleted',
    'notice.saved': '✅ Saved',
    
    // Commands
    'command.scanFile': 'Scan current file for content',
    'command.scanVault': 'Scan entire vault',
    'command.openOverview': 'Open Learning Overview(Sidebar)',
    'command.openMainOverview': 'Toggle Learning Overview (Main View)',
    'command.addAnnotation': 'Add file annotation',
    'command.startReview': 'Start flashcard review',
    'command.showStats': 'Show flashcard statistics',
    
    // Ribbons
    'ribbon.overview': 'Open Learning Overview(Sidebar)',
    'ribbon.review': 'Start Review',
    
    // Context menu
    'menu.jumpToSource': 'Jump to Source',
    'menu.toggleAnnotation': 'Toggle Annotation',
    'menu.editFlashcard': 'Edit Flashcard',
    'menu.quickGenerate': 'Quick Generate',
    'menu.createQA': 'Create Q&A',
    'menu.createCloze': 'Create Cloze',
    'menu.viewStats': 'View Stats',
    'menu.delete': 'Delete',
    
    // Status bar
    'status.due': '{count} due',
    'status.tooltip': '{due} cards due for review\n{new} new cards',
    
    // Misc
    'empty.noContent': 'No content yet',
    'empty.noDocuments': 'No documents',
    'fileList.title': '📁 Documents',

    'notice.fileNotFound': '❌ Source file not found',
'notice.jumpedToSource': '✅ Jumped to source',
'notice.jumpFailed': '❌ Jump failed',
'notice.flashcardNotFound': '⚠️ Flashcard not found',
'notice.alreadyHasFlashcards': '⚠️ Selected notes already have flashcards',
'notice.batchDeleted': '✅ Deleted {success} items',
'confirm.deleteNote': 'Delete this note?',
'confirm.deleteFlashcard': 'Delete this flashcard?',
'confirm.batchDeleteNotes': 'Delete {count} selected notes?',
'confirm.batchDeleteFlashcards': 'Delete {count} selected flashcards?',
 
'toolbar.checkReview.tooltip': 'Check if there are cards to review',

'batch.deselectAll': 'Deselect All',
'batch.deselectAll.tooltip': 'Deselect all items on current page',
'batch.selectAll.tooltip': 'Select all {count} items',
'batch.noItems': 'No items to select',
'batch.selectAnnotationFirst': 'Please select "Annotated" or "Not Annotated" first',
'batch.create.tooltip': 'Batch create flashcards',
'batch.delete.tooltip': 'Batch delete',
'batch.cancel.tooltip': 'Exit batch mode and clear all selections',

// review
'confirm.resetCardStats': 'Are you sure you want to reset this card\'s learning progress?',
'confirm.resetDeckStats': 'Are you sure you want to reset all learning progress for deck "{deck}"?',
'notice.deckStatsReset': '✅ Deck "{deck}" statistics reset',
'notice.flashcardDeleted': '🗑️ Flashcard deleted',
'notice.deleteFlashcardFailed': '❌ Failed to delete flashcard',
'notice.flashcardUpdated': '✅ Flashcard updated',
'notice.updateFlashcardFailed': '❌ Failed to update flashcard',
'notice.cardStatsReset': '✅ Card statistics reset',
'notice.resetStatsFailed': '❌ Failed to reset statistics',
// sidebar
'review.todayProgress': 'Today\'s Review: {reviewed} / {total}',
'review.delayedHoursShort': '⚠️ Review delayed {hours} hours, good time to handle',
'group.uncategorized': 'Uncategorized',


// component/modal/batch

'batchCreate.title': '⚡ Batch Create Flashcards',
  'batchCreate.description': 'Create flashcards for {count} notes without cards',
  'batchCreate.cardType': 'Card Type',
  'batchCreate.smartType': '⚡ Smart Recognition',
  'batchCreate.smartType.desc': 'Automatically choose the best type',
  'batchCreate.qaType': '📝 Q&A Card',
  'batchCreate.qaType.desc': 'Question and answer format',
  'batchCreate.clozeType': '✏️ Cloze Card',
  'batchCreate.clozeType.desc': 'Fill in the blank',
  'batchCreate.cancel': 'Cancel',
  'batchCreate.createButton': 'Create {count} cards',
  'batchCreate.successNotice': '✅ Created {success} flashcards!{failed, plural, =0 {} other { ({failed} failed)}}',
// component/modal/EditFlashcardModal
'editCard.title': '✏️ Edit Flashcard',
'editCard.description.qa': 'Edit Q&A card content',
'editCard.description.cloze': 'Edit Cloze card content',
'editCard.info.file': '📁 File',
'editCard.info.deck': '📚 Deck',
'editCard.info.reviews': '📊 Reviews',
'editCard.info.correct': 'Correct',
'editCard.front.qa': 'Question (Front)',
'editCard.front.cloze': 'Full Text',
'editCard.front.desc': 'Content shown on card front',
'editCard.back.qa': 'Answer (Back)',
'editCard.back.cloze': 'Cloze Answers',
'editCard.back.desc.qa': 'Answer shown on card back',
'editCard.back.desc.cloze': 'Separate multiple answers with commas',
'editCard.cancel': 'Cancel',
'editCard.save': 'Save',
'editCard.error.emptyFront': '⚠️ Question/Text cannot be empty',
'editCard.error.emptyBack': '⚠️ Answer cannot be empty',
'editCard.success': '✅ Flashcard updated',
'editCard.saveFailed': '❌ Save failed',
// component/modal/FlashcardEditModal
'flashcardEdit.title': 'Edit Flashcard',
'flashcardEdit.question': 'Question',
'flashcardEdit.answer': 'Answer',
'flashcardEdit.save': 'Save',
// component/modal/ManualFlashcardModal.ts
'manualCard.title.qa': '✏️ Create Q&A Flashcard',
'manualCard.title.cloze': '✏️ Create Cloze Flashcard',
'manualCard.description.qa': 'Create a Q&A card with custom question and answer',
'manualCard.description.cloze': 'Create a cloze card by marking content to be hidden in full text',
'manualCard.front.qa': 'Question (Front)',
'manualCard.front.cloze': 'Full Text',
'manualCard.front.desc.qa': 'Question displayed on card front',
'manualCard.front.desc.cloze': 'Complete sentence or paragraph containing the answer',
'manualCard.front.placeholder.qa': 'e.g., What is spaced repetition?',
'manualCard.front.placeholder.cloze': 'e.g., Spaced repetition is a learning technique',
'manualCard.back.qa': 'Answer (Back)',
'manualCard.back.cloze': 'Cloze Content',
'manualCard.back.desc.qa': 'Answer displayed on card back',
'manualCard.back.desc.cloze': 'Keyword or phrase to be hidden',
'manualCard.back.placeholder.qa': 'e.g., Spaced repetition is a learning technique...',
'manualCard.back.placeholder.cloze': 'e.g., spaced repetition',
'manualCard.cancel': 'Cancel',
'manualCard.create': 'Create Flashcard',
'manualCard.error.emptyFront': '⚠️ Question/Text cannot be empty',
'manualCard.error.emptyBack': '⚠️ Answer cannot be empty',
'manualCard.success.qa': '✅ Q&A flashcard created',
'manualCard.success.cloze': '✅ Cloze flashcard created',
'manualCard.createFailed': '❌ Failed to create flashcard',
// src/ui/components/ContentList.ts 
'contentList.group.annotated': 'Annotated',
'contentList.group.notAnnotated': 'Not Annotated',
'contentList.empty.noFlashcards': '📭 No flashcards in this group',
'contentList.empty.noNotes': 'No notes in current document',
'contentList.empty.tryFilter': 'Try switching filters to view',
'contentList.empty.startHighlight': 'Start highlighting text to create notes',
'contentList.empty.noContent': 'No content yet',
// src/ui/components/ContextMenuBuilder.ts
'contextMenu.jumpToSource': '📖 Jump to Source',
'contextMenu.editAnnotation': '💬 Edit Annotation',
'contextMenu.editFlashcard': '✏️ Edit Flashcard',
'contextMenu.generateFlashcard': '⚡ Generate Flashcard',
'contextMenu.createQA': '➕ Create Q&A Card',
'contextMenu.createCloze': '➕ Create Cloze Card',
'contextMenu.viewStats': '📊 View Stats',
'contextMenu.deleteNote': '🗑️ Delete Note',
'contextMenu.editCard': '✏️ Edit Card',
'contextMenu.deleteCard': '🗑️ Delete Card',
'stats.title': '📊 Flashcard Statistics',
'stats.file': '📁 File',
'stats.type': '🃏 Type',
'stats.type.qa': 'Q&A',
'stats.type.cloze': 'Cloze',
'stats.deck': '📚 Deck',
'stats.tags': '🏷️ Tags',
'stats.tags.none': 'None',
'stats.reviewCount': '📈 Review Count',
'stats.correctCount': '✅ Correct Count',
'stats.accuracy': '📊 Accuracy',
'stats.averageTime': '⏱️ Average Time',
'stats.difficulty': '🎯 Difficulty',
'stats.createdAt': '📅 Created',
'stats.lastReview': '🔄 Last Review',
'stats.lastReview.never': 'Never',
'stats.nextReview': '⏰ Next Review',
'stats.interval': '📏 Interval',
'stats.ease': '💪 Ease',
'stats.separator': '━━━━━━━━━━━━━━━',
'stats.times': 'times',
'stats.seconds': 's',
'stats.days': 'days',
// src/ui/services/OverviewService.ts
'service.fileNotExist': '⚠️ File does not exist',
'service.annotationDeleted': '🗑️ Annotation deleted',
'service.flashcardGenerated': '⚡ Flashcard generated',
'service.generateFailed': '❌ Failed to generate flashcard',
'service.flashcardNotFound': '⚠️ Flashcard not found',
'service.sourceFileOpened': '✅ Source file opened',
'service.noteNotFound': '⚠️ Original note not found',
// 最近删除
'confirm.deleteWillRemove': 'This will remove:',
'confirm.note': 'note',
'confirm.notes': 'notes',
'confirm.flashcards': 'flashcards',
'confirm.annotation': 'annotation',
'confirm.cannotUndo': '⚠️ This action cannot be undone!',
'notice.fileDeleted': '📄 File "{file}" has been deleted',
'notice.autoCleanup': 'Auto-cleaning associated content:',
'recentDelete.title': '🗑️ Recently Deleted (Last 7 Days)',
'recentDelete.empty': 'No recently deleted items',
'recentDelete.restore': 'Restore',
'recentDelete.deletePermanently': 'Delete Permanently',

'notice.movedToTrash': '🗑️ Moved to trash (recoverable within 7 days)',
'notice.batchMovedToTrash': '✅ Moved {success} items to trash{failed, plural, =0 {} other {, {failed} failed}}',
'notice.fileDeletedSimple': '📄 File deleted: {notes} notes and {cards} cards moved to trash',
'notice.noteRestored': '✅ Note restored',
'notice.cardRestored': '✅ Flashcard restored',
'notice.cardsRestored': '✅ Restored {count} flashcards',
'notice.restoreFailed': '❌ Restore failed',
'notice.permanentlyDeleted': '✅ Permanently deleted',
'notice.deleteFailed': '❌ Delete failed',
'notice.allDeleted': '✅ Cleared {notes} notes and {cards} flashcards from trash',
'recentDelete.clearAll': '🗑️ Clear All',
'recentDelete.emptyHint': 'Deleted items will be kept for 7 days',
'confirm.clearAllDeleted': 'Permanently delete all items in trash? This cannot be undone!',
'confirm.restoreAssociatedCards': 'Restore {count} associated flashcards?',
'deleteReason.user': 'Manual deletion',
'deleteReason.note': 'Note deleted',
'deleteReason.file': 'File deleted',
'time.justNow': 'Just now',
'time.minutesAgo': '{minutes}m ago',
'time.hoursAgo': '{hours}h ago',
'time.daysAgo': '{days}d ago',
// delete confirm
'confirm.deleteItems': 'Confirm deletion?',
'confirm.notesCount': '{count} notes',
'confirm.cardsCount': '{count} flashcards',
// quick flashcard  creator
'quickCard.created.qa': '✅ Flashcard created! (Q&A)',
'quickCard.created.cloze': '✅ Flashcard created! (Cloze with {count} blanks)',
'quickCard.createFailed': '❌ Failed to create flashcard',
'quickCard.noKeywords': '⚠️ No keywords found for cloze deletion',
'quickCard.noDeletions': '⚠️ Could not create cloze deletions',
'quickCard.question.default.heading': 'What is the key point about "{heading}"?',
'quickCard.question.default.short': 'What does "{content}" mean?',
'quickCard.question.default.medium': 'Explain: "{content}"',
'quickCard.question.default.long': 'What are the key points in this content?',
  // UnlockSystem - Level Names
  'unlock.level.1': 'Collector',
  'unlock.level.2': 'Thinker',
  'unlock.level.3': 'Memorizer',
  'unlock.level.4': 'Trainer',
  'unlock.level.5': 'Analyst',
  
  // Level Up Messages
  'unlock.levelUp.1': '🎉 level.1 Welcome, Collector!',
  'unlock.levelUp.2': '🎓 level.2 Upgraded to Thinker!\nUnlocked: Annotations, Batch Operations',
  'unlock.levelUp.3': '🧠 level.3 You are now a Memorizer!\nUnlocked: Scan Features, Review System',
  'unlock.levelUp.4': '💪 level.4 Promoted to Trainer!\nUnlocked: Statistics & Analysis',
  'unlock.levelUp.5': '🏆 level.5 Achieved Analyst!\nAll features unlocked',
  
// Next Steps
'unlock.nextSteps.level1': '📦 Extract Notes:\n  • As Text: {text}/3\n  • As Q&A: {qa}/3\n  • As Cloze: {cloze}/3',
'unlock.nextSteps.level2': '📝 Complete Annotations: {annotations}/3\n📋 Scan Notes: {scanned}/5',
'unlock.nextSteps.level3': '🔄 Review Cards: {reviewed}/30\n📋 Scan Tables: {tables}/2',
'unlock.nextSteps.level4': '🔄 Review Cards: {reviewed}/70\n📅 Total Days: {total}/21\n📊 Visit Stats Page: {visited}',
'unlock.nextSteps.level5': '🎉 Congratulations! All features unlocked!\n\n🔮 Community feature coming soon\nWill be enabled when conditions are met\n🔗 <a href="https://jz-quartz.pages.dev/6.about/%E6%99%BA%E5%9B%8A%E5%9B%A2" target="_blank">Learn More (Click to View)</a>',
 
// Modal
  'unlock.modal.title': '🔒 Feature Locked',
  'unlock.modal.requireLevel': '"{feature}" requires Lv{level} to unlock',
  'unlock.modal.currentProgress': 'Current Progress:',
  
  // Level Info Modal
  'unlock.levelInfo.title': '🏆 Lv{level} {name}',
  'unlock.levelInfo.cumulativeStats': 'Cumulative Statistics',
  'unlock.levelInfo.milestones': '🎯 Achievement Milestones',
  
  // Stats Labels
  'unlock.stat.cardsExtracted': 'Cards Extracted',
  'unlock.stat.annotationsCompleted': 'Annotations Added',
  'unlock.stat.cardsReviewed': 'Cards Reviewed',
  'unlock.stat.tablesScanned': 'Tables Scanned',
  'unlock.stat.consecutiveDays': 'Consecutive Days',
  'unlock.stat.totalDays': 'Total Days',
  
  // Progress Indicators
  'unlock.progress.cardsExtracted': '📦 Extract Cards',
  'unlock.progress.annotationsCompleted': '📝 Complete Annotations',
  'unlock.progress.cardsReviewed': '🔄 Review Cards',
  'unlock.progress.tablesScanned': '📋 Scan Tables',
  'unlock.progress.consecutiveDays': '🔥 Consecutive Days',
  'unlock.progress.totalDays': '📈 Total Days',
  'unlock.progress.statsPageVisited': '📊 Visit Stats Page',
  'unlock.community.locked': 'Community feature locked',
'unlock.community.link': 'Learn about Community',

'filter.unannotated': 'No Annotation',

// unlock refactor
'unlock.stat.notesExtractedAsText': 'Notes as Text',
'unlock.stat.notesExtractedAsQA': 'Notes as Q&A',
'unlock.stat.notesExtractedAsCloze': 'Notes as Cloze',
'unlock.stat.notesScanned': 'Notes Scanned',
},

  
  'zh-CN': {
    // View titles
    'view.overview': '学习概览',
    'view.review': '复习',
    'view.stats': '统计',
    
    // Toolbar
    'toolbar.search': '搜索...',
    'toolbar.filter.all': '全部',
    'toolbar.filter.annotated': '有批注',
    'toolbar.filter.flashcards': '有闪卡',
    'toolbar.group.file': '按文件',
    'toolbar.group.annotation': '按批注',
    'toolbar.group.tag': '按标签',
    'toolbar.group.date': '按日期',
    'toolbar.checkReview': '检查复习',
    
    // Batch actions
    'batch.selectAll': '全选',
    'batch.create': '创建闪卡',
    'batch.delete': '删除',
    'batch.cancel': '取消',
    
    // Fixed entries
    'entry.allNotes': '全部笔记',
    'entry.cardList': '闪卡列表',
    
    // Level names
    'level.1': '采集者',
    'level.2': '思考者',
    'level.3': '记忆师',
    'level.4': '训练者',
    'level.5': '分析师',
    'level.current': '当前等级',
    'level.clickDetails': '点击查看详情',
    
    // Review reminder
    'review.today': '今日复习',
    'review.start': '开始复习',
    'review.justDue': '⏰ 刚刚到期,趁热复习',
    'review.delayed': '⚠️ 复习已延后 {hours} 小时',
    'review.urgentHours': '⚠️ 复习已延后 {hours} 小时,建议优先完成',
    'review.urgentDays': '🚨 复习已延后 {days} 天,建议尽快清空!',
    'review.streak': '🔥 连续复习第 {days} 天!',
    
    // Notices
    'notice.noSelection': '⚠️ 请先选择项目',
    'notice.noDueCards': '暂无需要复习的卡片!',
    'notice.deleted': '🗑️ 已删除',
    'notice.saved': '✅ 已保存',
    
    // Commands
    'command.scanFile': '扫描当前文件',
    'command.scanVault': '扫描整个仓库',
    'command.openOverview': '打开学习概览(侧边栏)',
    'command.openMainOverview': '切换学习概览(主视图)',
    'command.addAnnotation': '添加文件批注',
    'command.startReview': '开始闪卡复习',
    'command.showStats': '显示闪卡统计',
    
    // Ribbons
    'ribbon.overview': '打开学习概览(侧边栏)',
    'ribbon.review': '开始复习',
    
    // Context menu
    'menu.jumpToSource': '跳转到源',
    'menu.toggleAnnotation': '切换批注',
    'menu.editFlashcard': '编辑闪卡',
    'menu.quickGenerate': '快速生成',
    'menu.createQA': '创建问答',
    'menu.createCloze': '创建填空',
    'menu.viewStats': '查看统计',
    'menu.delete': '删除',
    
    // Status bar
    'status.due': '{count} 张待复习',
    'status.tooltip': '{due} 张卡片待复习\n{new} 张新卡片',
    
    // Misc
    'empty.noContent': '暂无内容',
    'empty.noDocuments': '暂无文档',
    'fileList.title': '📁 文档列表',

    'notice.fileNotFound': '❌ 源文件不存在',
'notice.jumpedToSource': '✅ 已跳转到源文件',
'notice.jumpFailed': '❌ 跳转失败',
'notice.flashcardNotFound': '⚠️ 找不到对应的闪卡',
'notice.alreadyHasFlashcards': '⚠️ 选中的笔记都已创建过闪卡',
'notice.batchDeleted': '✅ 已删除 {success} 项{failed, plural, =0 {} other {，{failed} 项失败}}',
'confirm.deleteNote': '确定要删除这条笔记吗？',
'confirm.deleteFlashcard': '确定要删除这张闪卡吗？',
'confirm.batchDeleteNotes': '确定要删除选中的 {count} 条笔记吗？',
'confirm.batchDeleteFlashcards': '确定要删除选中的 {count} 张闪卡吗？',

'toolbar.checkReview.tooltip': '检查是否有需要复习的卡片',

'batch.deselectAll': '取消全选',
'batch.deselectAll.tooltip': '取消当前页面的全选',
'batch.selectAll.tooltip': '全选当前 {count} 项',
'batch.noItems': '没有可选项',
'batch.selectAnnotationFirst': '请先选择"有批注"或"无批注"',
'batch.create.tooltip': '批量制卡',
'batch.delete.tooltip': '批量删除',
'batch.cancel.tooltip': '退出批量模式并清空所有选择',

//review 
'confirm.resetCardStats': '确定要重置这张卡片的学习进度吗？',
'confirm.resetDeckStats': '确定要重置卡组"{deck}"的所有学习进度吗？',
'notice.deckStatsReset': '✅ 卡组"{deck}"的统计已重置',
'notice.flashcardDeleted': '🗑️ 闪卡已删除',
'notice.deleteFlashcardFailed': '❌ 删除闪卡失败',
'notice.flashcardUpdated': '✅ 闪卡已更新',
'notice.updateFlashcardFailed': '❌ 更新闪卡失败',
'notice.cardStatsReset': '✅ 卡片统计已重置',
'notice.resetStatsFailed': '❌ 重置统计失败',
// sidebar
'review.todayProgress': '今日复习: {reviewed} / {total}',
'review.delayedHoursShort': '⚠️ 复习已延后 {hours} 小时，现在处理刚好',
'group.uncategorized': '未分类',
// component/modal/batch
'batchCreate.title': '⚡ 批量创建闪卡',
  'batchCreate.description': '为 {count} 条未创建闪卡的笔记创建闪卡',
  'batchCreate.cardType': '卡片类型',
  'batchCreate.smartType': '⚡ 智能识别',
  'batchCreate.smartType.desc': '自动选择最合适的类型',
  'batchCreate.qaType': '📝 问答卡片',
  'batchCreate.qaType.desc': '问题和答案格式',
  'batchCreate.clozeType': '✏️ 填空卡片',
  'batchCreate.clozeType.desc': '挖空填空',
  'batchCreate.cancel': '取消',
  'batchCreate.createButton': '创建 {count} 张卡片',
  'batchCreate.successNotice': '✅ 已创建 {success} 张闪卡！{failed, plural, =0 {} other { ({failed} 项失败)}}',
// component/modal/EditFlashcardModal
'editCard.title': '✏️ 编辑闪卡',
'editCard.description.qa': '编辑 Q&A 卡片内容',
'editCard.description.cloze': '编辑填空卡片内容',
'editCard.info.file': '📁 文件',
'editCard.info.deck': '📚 卡组',
'editCard.info.reviews': '📊 复习',
'editCard.info.correct': '正确',
'editCard.front.qa': '问题 (Front)',
'editCard.front.cloze': '完整文本',
'editCard.front.desc': '卡片正面显示的内容',
'editCard.back.qa': '答案 (Back)',
'editCard.back.cloze': '挖空答案',
'editCard.back.desc.qa': '卡片背面显示的答案',
'editCard.back.desc.cloze': '多个答案用逗号分隔',
'editCard.cancel': '取消',
'editCard.save': '保存',
'editCard.error.emptyFront': '⚠️ 问题/文本不能为空',
'editCard.error.emptyBack': '⚠️ 答案不能为空',
'editCard.success': '✅ 闪卡已更新',
'editCard.saveFailed': '❌ 保存失败',

// component/modal/FlashcardEditModal
'flashcardEdit.title': '编辑闪卡',
'flashcardEdit.question': '问题',
'flashcardEdit.answer': '答案',
'flashcardEdit.save': '保存',
// component/modal/ManualFlashcardModal.ts
'manualCard.title.qa': '✏️ 创建 QA 闪卡',
'manualCard.title.cloze': '✏️ 创建填空闪卡',
'manualCard.description.qa': '创建一张问答卡片，可以自定义问题和答案',
'manualCard.description.cloze': '创建一张填空卡片，在完整文本中标记要挖空的内容',
'manualCard.front.qa': '问题 (Front)',
'manualCard.front.cloze': '完整文本',
'manualCard.front.desc.qa': '卡片正面显示的问题',
'manualCard.front.desc.cloze': '包含答案的完整句子或段落',
'manualCard.front.placeholder.qa': '例如: 什么是间隔重复?',
'manualCard.front.placeholder.cloze': '例如: 间隔重复是一种学习技术',
'manualCard.back.qa': '答案 (Back)',
'manualCard.back.cloze': '挖空内容',
'manualCard.back.desc.qa': '卡片背面显示的答案',
'manualCard.back.desc.cloze': '要被挖空的关键词或短语',
'manualCard.back.placeholder.qa': '例如: 间隔重复是一种学习技术...',
'manualCard.back.placeholder.cloze': '例如: 间隔重复',
'manualCard.cancel': '取消',
'manualCard.create': '创建闪卡',
'manualCard.error.emptyFront': '⚠️ 问题/文本不能为空',
'manualCard.error.emptyBack': '⚠️ 答案不能为空',
'manualCard.success.qa': '✅ QA 闪卡已创建',
'manualCard.success.cloze': '✅ 填空闪卡已创建',
'manualCard.createFailed': '❌ 创建闪卡失败',
// src/ui/components/ContentList.ts 
'contentList.group.annotated': '有批注',
'contentList.group.notAnnotated': '无批注',
'contentList.empty.noFlashcards': '📭 该分组下暂无闪卡',
'contentList.empty.noNotes': '当前文档暂无笔记',
'contentList.empty.tryFilter': '尝试切换其他过滤器查看',
'contentList.empty.startHighlight': '开始高亮文本来创建笔记',
'contentList.empty.noContent': '暂无内容',
// src/ui/components/ContextMenuBuilder.ts
'contextMenu.jumpToSource': '📖 跳转到原文',
'contextMenu.editAnnotation': '💬 编辑批注',
'contextMenu.editFlashcard': '✏️ 编辑闪卡',
'contextMenu.generateFlashcard': '⚡ 生成闪卡',
'contextMenu.createQA': '➕ 创建 QA 闪卡',
'contextMenu.createCloze': '➕ 创建填空闪卡',
'contextMenu.viewStats': '📊 查看统计',
'contextMenu.deleteNote': '🗑️ 删除笔记',
'contextMenu.editCard': '✏️ 编辑卡片',
'contextMenu.deleteCard': '🗑️ 删除卡片',
'stats.title': '📊 闪卡统计',
'stats.file': '📁 文件',
'stats.type': '🃏 类型',
'stats.type.qa': 'Q&A',
'stats.type.cloze': '填空',
'stats.deck': '📚 卡组',
'stats.tags': '🏷️ 标签',
'stats.tags.none': '无',
'stats.reviewCount': '📈 复习次数',
'stats.correctCount': '✅ 正确次数',
'stats.accuracy': '📊 正确率',
'stats.averageTime': '⏱️ 平均用时',
'stats.difficulty': '🎯 难度',
'stats.createdAt': '📅 创建时间',
'stats.lastReview': '🔄 上次复习',
'stats.lastReview.never': '未复习',
'stats.nextReview': '⏰ 下次复习',
'stats.interval': '📏 间隔',
'stats.ease': '💪 熟练度',
'stats.separator': '━━━━━━━━━━━━━━━',
'stats.times': '次',
'stats.seconds': '秒',
'stats.days': '天',
// src/ui/services/OverviewService.ts
'service.fileNotExist': '⚠️ 文件不存在',
'service.annotationDeleted': '🗑️ 批注已删除',
'service.flashcardGenerated': '⚡ 闪卡已生成',
'service.generateFailed': '❌ 生成闪卡失败',
'service.flashcardNotFound': '⚠️ 找不到闪卡',
'service.sourceFileOpened': '✅ 已打开源文件',
'service.noteNotFound': '⚠️ 找不到原始笔记',
// 最近删除
'confirm.deleteWillRemove': '此操作将删除：',
'confirm.note': '条笔记',
'confirm.notes': '条笔记',
'confirm.flashcards': '张闪卡',
'confirm.annotation': '条批注',
'confirm.cannotUndo': '⚠️ 此操作无法撤销！',
'notice.fileDeleted': '📄 文件 "{file}" 已被删除',
'notice.autoCleanup': '自动清理关联内容：',
'recentDelete.title': '🗑️ 最近删除 (最近7天)',
'recentDelete.empty': '暂无最近删除的项目',
'recentDelete.restore': '恢复',
'recentDelete.deletePermanently': '永久删除',

'notice.movedToTrash': '🗑️ 已移至回收站 (7天内可恢复)',
'notice.batchMovedToTrash': '✅ 已将 {success} 项移至回收站',
'notice.fileDeletedSimple': '📄 文件已删除：{notes} 条笔记和 {cards} 张闪卡已移至回收站',
'notice.noteRestored': '✅ 笔记已恢复',
'notice.cardRestored': '✅ 闪卡已恢复',
'notice.cardsRestored': '✅ 已恢复 {count} 张闪卡',
'notice.restoreFailed': '❌ 恢复失败',
'notice.permanentlyDeleted': '✅ 已永久删除',
'notice.deleteFailed': '❌ 删除失败',
'notice.allDeleted': '✅ 已清空 {notes} 条笔记和 {cards} 张闪卡',
'recentDelete.clearAll': '🗑️ 一键清空',
'recentDelete.emptyHint': '删除的内容将保留7天',
'confirm.clearAllDeleted': '确定要永久删除回收站中的所有项目吗？此操作无法撤销！',
'confirm.restoreAssociatedCards': '是否恢复 {count} 张关联的闪卡？',
'deleteReason.user': '手动删除',
'deleteReason.note': '笔记删除',
'deleteReason.file': '文件删除',
'time.justNow': '刚刚',
'time.minutesAgo': '{minutes}分钟前',
'time.hoursAgo': '{hours}小时前',
'time.daysAgo': '{days}天前',
// delete confirm
'confirm.deleteItems': '确认删除？',
'confirm.notesCount': '{count} 条笔记',
'confirm.cardsCount': '{count} 张闪卡',
// quick flashcard  creator
'quickCard.created.qa': '✅ 闪卡已创建！(问答卡)',
'quickCard.created.cloze': '✅ 闪卡已创建！(填空卡，{count} 个空)',
'quickCard.createFailed': '❌ 创建闪卡失败',
'quickCard.noKeywords': '⚠️ 未找到可用于挖空的关键词',
'quickCard.noDeletions': '⚠️ 无法创建挖空',
'quickCard.question.default.heading': '关于"{heading}"的要点是什么？',
'quickCard.question.default.short': '"{content}"是什么意思？',
'quickCard.question.default.medium': '解释："{content}"',
'quickCard.question.default.long': '这段内容的要点是什么？',

  // UnlockSystem - 等级名称
  'unlock.level.1': '采集者',
  'unlock.level.2': '思考者',
  'unlock.level.3': '记忆师',
  'unlock.level.4': '训练者',
  'unlock.level.5': '分析师',
  
  // 升级消息
  'unlock.levelUp.1': '🎉 level.1 欢迎成为采集者!',
  'unlock.levelUp.2': '🎓 level.2 升级为思考者!\n解锁: 批注功能、批量操作',
  'unlock.levelUp.3': '🧠 level.3 成为记忆师!\n解锁: 扫描功能、复习系统',
  'unlock.levelUp.4': '💪 level.4 晋升训练者!\n解锁: 统计分析',
  'unlock.levelUp.5': '🏆 level.5 达成分析师!\n所有功能已解锁',
  
// 下一步提示
'unlock.nextSteps.level1': '📦 右键提取笔记:\n  • 提取为文本: {text}/3\n  • 提取为问答: {qa}/3\n  • 提取为填空: {cloze}/3',
'unlock.nextSteps.level2': '📝 完成批注: {annotations}/3\n📋 扫描提取笔记: {scanned}/5',
'unlock.nextSteps.level3': '🔄 复习卡片: {reviewed}/30\n📋 扫描表格: {tables}/2',
'unlock.nextSteps.level4': '🔄 复习卡片: {reviewed}/70\n📅 总使用天数: {total}/21\n📊 访问统计页: {visited}',
'unlock.nextSteps.level5': '🎉 恭喜解锁所有功能!\n\n🔮 智囊团功能尚未开放\n达到人数与段位条件后开启\n🔗 <a href="https://jz-quartz.pages.dev/6.about/%E6%99%BA%E5%9B%8A%E5%9B%A2" target="_blank">了解智囊团(点击查看)</a>',
  // 弹窗
  'unlock.modal.title': '🔒 功能未解锁',
  'unlock.modal.requireLevel': '"{feature}" 需要 Lv{level} 解锁',
  'unlock.modal.currentProgress': '当前进度:',
  
  // 等级信息弹窗
  'unlock.levelInfo.title': '🏆 Lv{level} {name}',
  'unlock.levelInfo.cumulativeStats': '累计统计',
  'unlock.levelInfo.milestones': '🎯 成就里程碑',
  
  // 统计标签
  'unlock.stat.cardsExtracted': '提取卡片',
  'unlock.stat.annotationsCompleted': '完成批注',
  'unlock.stat.cardsReviewed': '复习卡片',
  'unlock.stat.tablesScanned': '扫描表格',
  'unlock.stat.consecutiveDays': '连续天数',
  'unlock.stat.totalDays': '总使用天数',
  
  // 进度指标
  'unlock.progress.cardsExtracted': '📦 提取卡片',
  'unlock.progress.annotationsCompleted': '📝 完成批注',
  'unlock.progress.cardsReviewed': '🔄 复习卡片',
  'unlock.progress.tablesScanned': '📋 扫描表格',
  'unlock.progress.consecutiveDays': '🔥 连续使用天数',
  'unlock.progress.totalDays': '📈 总使用天数',
  'unlock.progress.statsPageVisited': '📊 访问统计页',
'unlock.community.locked': '智囊团功能已锁定',
'unlock.community.link': '了解智囊团',

'filter.unannotated': '无批注',

// unlock refactor
'unlock.stat.notesExtractedAsText': '提取为文本',
'unlock.stat.notesExtractedAsQA': '提取为问答',
'unlock.stat.notesExtractedAsCloze': '提取为填空',
'unlock.stat.notesScanned': '扫描笔记',

  }
} as const;

export function t(key: string, language: Language = 'en', params?: Record<string, string | number>): string {
  let text = translations[language][key] || translations['en'][key] || key;
  
  // 替换参数
  if (params) {
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(`{${paramKey}}`, String(value));
    });
  }
  
  return text;
}