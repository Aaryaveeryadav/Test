export type Role = 'master_admin' | 'school_admin' | 'teacher' | 'student'

export const ROLE_HOME: Record<Role, string> = {
  master_admin: '/master',
  school_admin: '/admin',
  teacher: '/teacher',
  student: '/student'
}

export const ROLE_LABEL: Record<Role, string> = {
  master_admin: 'Master Admin',
  school_admin: 'School Admin',
  teacher: 'Teacher',
  student: 'Student'
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  school_id: string | null
  status: 'active' | 'inactive'
  roll_number: string | null
  guardian_consent: boolean
  created_at?: string
}

export type TutorMode = 'concept' | 'steps' | 'board' | 'alternate'

export const TUTOR_MODES: { id: TutorMode; label: string; hint: string }[] = [
  { id: 'concept', label: 'Simple explanation', hint: 'Understand the idea clearly' },
  { id: 'steps', label: 'Step-by-step solution', hint: 'Solved one step at a time' },
  { id: 'board', label: 'Board-exam answer', hint: 'How to write it for full marks' },
  { id: 'alternate', label: 'Alternate method / analogy', hint: 'Another way to think about it' }
]

export type AnswerCase = 'covered' | 'application' | 'out_of_scope' | 'unclear'

export interface Citation {
  id: string // "S1", "S2", ...
  source_type: string
  source_title: string
  chapter: string | null
  page_number: number | null
  exam_year: number | null
  question_no: string | null
  board: string
  class_grade: number
  subject: string
  school_name: string | null
  approval: string
  similarity: number | null
}

export interface Diagram {
  type: 'geometry' | 'graph' | 'timeline' | 'concept_map' | 'circuit'
  title: string
  alt: string
  [key: string]: unknown
}

export interface TutorAnswer {
  answer_case: AnswerCase
  label: string
  answer_md: string
  citations: Citation[]
  concept: string | null
  diagram: Diagram | null
  needs_followup: string | null
}

export interface ChatListItem {
  id: string
  title: string
  subject_id: string
  chapter_id: string | null
  last_message_at: string
}

export interface ChatMessageRow {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  mode: string | null
  answer_case: string | null
  label: string | null
  concept: string | null
  citations: Citation[] | null
  diagram: Diagram | null
  needs_followup: string | null
  flag_status: 'none' | 'flagged' | 'resolved'
  created_at: string
  /** Client-only flag: this reply came from the answer store, not the GPU. */
  from_store?: boolean
}

export interface ActionState {
  error?: string
  success?: string
  data?: Record<string, unknown>
}
