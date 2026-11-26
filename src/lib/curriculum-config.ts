/**
 * Configuration for the generic master-curriculum CRUD pages.
 * All writes go through upsertCurriculumEntity which re-validates everything
 * server-side (this config drives the UI only).
 */
export interface FieldDef {
  name: string
  label: string
  type: 'text' | 'number' | 'textarea' | 'select'
  required?: boolean
  ref?: 'boards' | 'classes' | 'subjects' | 'chapters' | 'topics'
  help?: string
}

export interface EntityDef {
  key: string
  label: string
  fields: FieldDef[]
  listColumns: { name: string; label: string; ref?: 'boards' | 'classes' | 'subjects' | 'chapters' | 'topics' }[]
}

export const CURRICULUM_ENTITIES: Record<string, EntityDef> = {
  boards: {
    key: 'boards',
    label: 'Boards',
    fields: [
      { name: 'name', label: 'Board name', type: 'text', required: true },
      { name: 'code', label: 'Code (short, unique)', type: 'text', required: true, help: 'e.g. CBSE, MPBSE' }
    ],
    listColumns: [
      { name: 'name', label: 'Name' },
      { name: 'code', label: 'Code' }
    ]
  },
  classes: {
    key: 'classes',
    label: 'Classes',
    fields: [
      { name: 'board_id', label: 'Board', type: 'select', required: true, ref: 'boards' },
      { name: 'grade', label: 'Class number (1–14)', type: 'number', required: true },
      { name: 'label', label: 'Label (optional)', type: 'text' }
    ],
    listColumns: [
      { name: 'board_id', label: 'Board', ref: 'boards' },
      { name: 'grade', label: 'Class' },
      { name: 'label', label: 'Label' }
    ]
  },
  subjects: {
    key: 'subjects',
    label: 'Subjects',
    fields: [
      { name: 'class_id', label: 'Class', type: 'select', required: true, ref: 'classes' },
      { name: 'name', label: 'Subject name', type: 'text', required: true },
      { name: 'code', label: 'Code', type: 'text', required: true }
    ],
    listColumns: [
      { name: 'class_id', label: 'Class', ref: 'classes' },
      { name: 'name', label: 'Name' },
      { name: 'code', label: 'Code' }
    ]
  },
  chapters: {
    key: 'chapters',
    label: 'Chapters',
    fields: [
      { name: 'subject_id', label: 'Subject', type: 'select', required: true, ref: 'subjects' },
      { name: 'number', label: 'Chapter number', type: 'number', required: true },
      { name: 'title', label: 'Title', type: 'text', required: true }
    ],
    listColumns: [
      { name: 'subject_id', label: 'Subject', ref: 'subjects' },
      { name: 'number', label: 'No.' },
      { name: 'title', label: 'Title' }
    ]
  },
  topics: {
    key: 'topics',
    label: 'Topics',
    fields: [
      { name: 'chapter_id', label: 'Chapter', type: 'select', required: true, ref: 'chapters' },
      { name: 'title', label: 'Topic title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' }
    ],
    listColumns: [
      { name: 'chapter_id', label: 'Chapter', ref: 'chapters' },
      { name: 'title', label: 'Title' }
    ]
  },
  formulas: {
    key: 'formulas',
    label: 'Formulas',
    fields: [
      { name: 'chapter_id', label: 'Chapter', type: 'select', required: true, ref: 'chapters' },
      { name: 'topic_id', label: 'Topic (optional)', type: 'select', ref: 'topics' },
      { name: 'title', label: 'Formula name', type: 'text', required: true },
      { name: 'expression', label: 'Expression', type: 'text', required: true, help: 'e.g. 1/v + 1/u = 1/f' },
      { name: 'description', label: 'Description', type: 'textarea' }
    ],
    listColumns: [
      { name: 'chapter_id', label: 'Chapter', ref: 'chapters' },
      { name: 'title', label: 'Name' },
      { name: 'expression', label: 'Expression' }
    ]
  },
  textbooks: {
    key: 'textbooks',
    label: 'Textbooks',
    fields: [
      { name: 'subject_id', label: 'Subject', type: 'select', required: true, ref: 'subjects' },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'author', label: 'Author', type: 'text' },
      { name: 'publisher', label: 'Publisher', type: 'text' },
      { name: 'edition', label: 'Edition', type: 'text' }
    ],
    listColumns: [
      { name: 'subject_id', label: 'Subject', ref: 'subjects' },
      { name: 'title', label: 'Title' },
      { name: 'publisher', label: 'Publisher' }
    ]
  },
  pyqs: {
    key: 'pyqs',
    label: 'Previous-year questions',
    fields: [
      { name: 'subject_id', label: 'Subject', type: 'select', required: true, ref: 'subjects' },
      { name: 'chapter_id', label: 'Chapter (optional)', type: 'select', ref: 'chapters' },
      { name: 'year', label: 'Exam year', type: 'number', required: true },
      { name: 'exam', label: 'Exam name', type: 'text', help: 'e.g. CBSE Board Exam' },
      { name: 'question_no', label: 'Question number', type: 'text' },
      { name: 'question_text', label: 'Question', type: 'textarea', required: true },
      { name: 'marks', label: 'Marks', type: 'number' },
      { name: 'answer_text', label: 'Model answer (optional)', type: 'textarea' }
    ],
    listColumns: [
      { name: 'subject_id', label: 'Subject', ref: 'subjects' },
      { name: 'year', label: 'Year' },
      { name: 'question_no', label: 'Q#' },
      { name: 'question_text', label: 'Question' }
    ]
  }
}

export const CURRICULUM_ORDER = [
  'boards',
  'classes',
  'subjects',
  'chapters',
  'topics',
  'formulas',
  'textbooks',
  'pyqs'
] as const
