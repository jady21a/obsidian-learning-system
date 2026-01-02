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
    'review.urgentDays': '🚨 Review delayed {days} days, clear ASAP',
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
'notice.batchDeleted': '✅ Deleted {success} items{failed, plural, =0 {} other {, {failed} failed}}',
'confirm.deleteNote': 'Delete this note?',
'confirm.deleteFlashcard': 'Delete this flashcard?',
'confirm.batchDeleteNotes': 'Delete {count} selected notes?',
'confirm.batchDeleteFlashcards': 'Delete {count} selected flashcards?',
 
'toolbar.checkReview.tooltip': '检查是否有需要复习的卡片',

'batch.deselectAll': 'Deselect All',
'batch.deselectAll.tooltip': 'Deselect all items on current page',
'batch.selectAll.tooltip': 'Select all {count} items',
'batch.noItems': 'No items to select',
'batch.selectAnnotationFirst': 'Please select "Annotated" or "Not Annotated" first',
'batch.create.tooltip': 'Batch create flashcards',
'batch.delete.tooltip': 'Batch delete',
'batch.cancel.tooltip': 'Exit batch mode and clear all selections',



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
    'review.urgentDays': '🚨 复习已延后 {days} 天,建议尽快清空',
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