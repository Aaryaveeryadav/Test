'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit'
import { num, optStr, str, bool } from '@/lib/form'
import { syncPyqChunk, removePyqChunk, indexDocumentPages } from '@/lib/rag-sync'
import type { ActionState } from '@/lib/types'

// ---------------------------------------------------------------------------
// Schools (master administrator only)
// ---------------------------------------------------------------------------

export async function upsertSchool(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('master_admin')
  const id = optStr(formData, 'school_id')
  const name = str(formData, 'name')
  const code = str(formData, 'code').toUpperCase()
  const boardId = optStr(formData, 'board_id')
  const address = optStr(formData, 'address')

  if (name.length < 3) return { error: 'School name is too short.' }
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
    return { error: 'School code must be 3–20 characters (letters, numbers, dashes).' }
  }

  const admin = createAdminClient()
  if (id) {
    const { error } = await admin.from('schools').update({ name, code, board_id: boardId, address }).eq('id', id)
    if (error) return { error: 'Could not update the school (code may be taken).' }
    await audit({ actorId: profile.id, schoolId: id, action: 'schools.updated', entity: 'schools', entityId: id })
    revalidatePath('/master/schools')
    return { success: 'School updated.' }
  }

  const { data, error } = await admin
    .from('schools')
    .insert({ name, code, board_id: boardId, address })
    .select('id')
    .single()
  if (error) return { error: 'Could not create the school (code may be taken).' }
  await audit({ actorId: profile.id, schoolId: data.id, action: 'schools.created', entity: 'schools', entityId: data.id, details: { code } })
  revalidatePath('/master/schools')
  return { success: `School created. Its signup code is ${code}.` }
}

/** Suspend or reactivate a school. Suspension revokes access, including live sessions. */
export async function setSchoolStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('master_admin')
  const schoolId = str(formData, 'school_id')
  const suspend = str(formData, 'status') === 'suspended'
  const admin = createAdminClient()

  const { data: school } = await admin.from('schools').select('id, name, status').eq('id', schoolId).maybeSingle()
  if (!school) return { error: 'School not found.' }
  const targetStatus = suspend ? 'suspended' : 'active'
  if (school.status === targetStatus) return { error: `School is already ${targetStatus}.` }

  // Ban/unban all members so their auth sessions stop working immediately.
  const { data: members } = await admin
    .from('profiles')
    .select('id')
    .eq('school_id', schoolId)
  let banned = 0
  for (const m of members ?? []) {
    try {
      await admin.auth.admin.updateUserById(m.id, { ban_duration: suspend ? '876000h' : 'none' })
      banned++
    } catch {
      /* profile.status check still applies on next request */
    }
  }

  await admin.from('schools').update({ status: targetStatus }).eq('id', schoolId)
  await audit({
    actorId: profile.id,
    schoolId,
    action: suspend ? 'schools.suspended' : 'schools.reactivated',
    entity: 'schools',
    entityId: schoolId,
    details: { sessions_revoked: banned }
  })
  revalidatePath('/master/schools')
  revalidatePath('/master')
  return {
    success: suspend
      ? `${school.name} suspended. ${banned} users lost access, including existing sessions.`
      : `${school.name} reactivated.`
  }
}

export async function updateSchoolSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('master_admin')
  const schoolId = str(formData, 'school_id')
  const rankingEnabled = bool(formData, 'ranking_enabled')
  const retentionDays = num(formData, 'retention_days') ?? 90
  const admin = createAdminClient()
  await admin
    .from('schools')
    .update({ settings: { ranking_enabled: rankingEnabled, retention_days: Math.min(Math.max(retentionDays, 7), 3650) } })
    .eq('id', schoolId)
  await audit({
    actorId: profile.id,
    schoolId,
    action: 'schools.settings_updated',
    entity: 'schools',
    entityId: schoolId,
    details: { ranking_enabled: rankingEnabled, retention_days: retentionDays }
  })
  revalidatePath('/master/schools')
  return { success: 'Settings saved. Ranking stays within the class and is only visible to authorized users.' }
}

/** Invite a school administrator (secret link). */
export async function inviteSchoolAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('master_admin')
  const schoolId = str(formData, 'school_id')
  const email = str(formData, 'email').toLowerCase()
  if (!email.includes('@')) return { error: 'Please enter a valid email.' }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('invitations')
    .insert({ school_id: schoolId, role: 'school_admin', email, created_by: profile.id })
    .select('token')
    .single()
  if (error || !data) return { error: 'Could not create the invitation.' }
  await audit({
    actorId: profile.id,
    schoolId,
    action: 'invitations.created',
    entity: 'invitations',
    entityId: data.token,
    details: { role: 'school_admin' }
  })
  revalidatePath('/master/schools')
  return {
    success: 'School-admin invitation created. Share this secret link (expires in 7 days):',
    data: { invite_path: `/signup?invite=${data.token}` }
  }
}

// ---------------------------------------------------------------------------
// Master curriculum CRUD: boards, classes, subjects, chapters, topics,
// formulas, textbooks, PYQs. PYQ edits also refresh their search chunk.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(message: string): ActionState {
  return { error: message }
}

export async function upsertCurriculumEntity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('master_admin')
  const entity = str(formData, 'entity')
  const id = optStr(formData, 'id')
  const admin = createAdminClient()
  const uuid = (key: string, required: boolean) => {
    const v = optStr(formData, key)
    if (!v) {
      if (required) throw new Error(`Please choose the required field.`)
      return null
    }
    if (!UUID_RE.test(v)) throw new Error(`Invalid selection for ${key}.`)
    return v
  }
  const text = (key: string, required: boolean, max = 200) => {
    const v = str(formData, key)
    if (!v && required) throw new Error(`Please fill in "${key.replace(/_/g, ' ')}".`)
    if (v.length > max) throw new Error(`"${key.replace(/_/g, ' ')}" is too long.`)
    return v || null
  }
  const int = (key: string, required: boolean, min: number, max: number) => {
    const n = num(formData, key)
    if (n === null) {
      if (required) throw new Error(`Please fill in "${key.replace(/_/g, ' ')}".`)
      return null
    }
    if (n < min || n > max) throw new Error(`"${key.replace(/_/g, ' ')}" must be between ${min} and ${max}.`)
    return Math.round(n)
  }

  try {
    let row: Record<string, unknown> | null = null
    switch (entity) {
      case 'boards': {
        const payload = { name: text('name', true), code: text('code', true, 10)!.toUpperCase() }
        row = id ? await admin.from('boards').update(payload).eq('id', id).select().single().then((r) => r.data)
          : await admin.from('boards').insert(payload).select().single().then((r) => r.data)
        break
      }
      case 'classes': {
        const payload = { board_id: uuid('board_id', true), grade: int('grade', true, 1, 14), label: text('label', false) }
        row = id ? await admin.from('classes').update(payload).eq('id', id).select().single().then((r) => r.data)
          : await admin.from('classes').insert(payload).select().single().then((r) => r.data)
        break
      }
      case 'subjects': {
        const payload = { class_id: uuid('class_id', true), name: text('name', true), code: text('code', true, 20) }
        row = id ? await admin.from('subjects').update(payload).eq('id', id).select().single().then((r) => r.data)
          : await admin.from('subjects').insert(payload).select().single().then((r) => r.data)
        break
      }
      case 'chapters': {
        const payload = { subject_id: uuid('subject_id', true), number: int('number', true, 0, 100), title: text('title', true) }
        row = id ? await admin.from('chapters').update(payload).eq('id', id).select().single().then((r) => r.data)
          : await admin.from('chapters').insert(payload).select().single().then((r) => r.data)
        break
      }
      case 'topics': {
        const payload = { chapter_id: uuid('chapter_id', true), title: text('title', true), description: text('description', false, 500) }
        row = id ? await admin.from('topics').update(payload).eq('id', id).select().single().then((r) => r.data)
          : await admin.from('topics').insert(payload).select().single().then((r) => r.data)
        break
      }
      case 'formulas': {
        const payload = {
          chapter_id: uuid('chapter_id', true),
          topic_id: uuid('topic_id', false),
          title: text('title', true),
          expression: text('expression', true, 300),
          description: text('description', false, 500)
        }
        row = id ? await admin.from('formulas').update(payload).eq('id', id).select().single().then((r) => r.data)
          : await admin.from('formulas').insert(payload).select().single().then((r) => r.data)
        break
      }
      case 'textbooks': {
        const payload = {
          subject_id: uuid('subject_id', true),
          title: text('title', true),
          author: text('author', false),
          publisher: text('publisher', false),
          edition: text('edition', false)
        }
        row = id ? await admin.from('textbooks').update(payload).eq('id', id).select().single().then((r) => r.data)
          : await admin.from('textbooks').insert(payload).select().single().then((r) => r.data)
        break
      }
      case 'pyqs': {
        const payload = {
          subject_id: uuid('subject_id', true),
          chapter_id: uuid('chapter_id', false),
          year: int('year', true, 1990, 2030),
          exam: text('exam', false, 100) ?? 'Board Exam',
          question_no: text('question_no', false, 20),
          question_text: text('question_text', true, 3000),
          marks: int('marks', false, 1, 100),
          answer_text: text('answer_text', false, 5000)
        }
        row = id ? await admin.from('pyqs').update(payload).eq('id', id).select().single().then((r) => r.data)
          : await admin.from('pyqs').insert(payload).select().single().then((r) => r.data)
        if (row) {
          await syncPyqChunk(row as unknown as Parameters<typeof syncPyqChunk>[0])
        }
        break
      }
      default:
        return fail('Unknown curriculum item.')
    }

    if (!row) {
      const msg = 'Could not save. Check for duplicate codes/numbers and that parents exist.'
      return fail(msg)
    }

    await audit({
      actorId: profile.id,
      action: `curriculum.${entity}.upsert`,
      entity,
      entityId: String((row as { id?: string }).id ?? id ?? ''),
      details: {}
    })
    revalidatePath(`/master/curriculum/${entity}`)
    return { success: id ? 'Updated.' : 'Created.' }
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Could not save.')
  }
}

export async function archiveCurriculumEntity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('master_admin')
  const entity = str(formData, 'entity')
  const id = str(formData, 'id')
  const archived = str(formData, 'archived') === '1'
  const allowed = ['boards', 'classes', 'subjects', 'chapters', 'topics', 'formulas', 'textbooks', 'pyqs']
  if (!allowed.includes(entity)) return fail('Unknown curriculum item.')
  const admin = createAdminClient()
  const { error } = await admin
    .from(entity)
    .update({ status: archived ? 'archived' : 'active' })
    .eq('id', id)
  if (error) return fail('Could not update the status.')
  if (entity === 'pyqs' && archived) {
    await removePyqChunk(id)
  }
  await audit({
    actorId: profile.id,
    action: `curriculum.${entity}.${archived ? 'archived' : 'restored'}`,
    entity,
    entityId: id
  })
  revalidatePath(`/master/curriculum/${entity}`)
  return { success: archived ? 'Archived (hidden from students, kept for records).' : 'Restored to active.' }
}

// ---------------------------------------------------------------------------
// Document ingestion: upload → extract → review → approve & index
// ---------------------------------------------------------------------------

export async function uploadDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireRole('master_admin')
  const title = str(formData, 'title')
  const subjectId = str(formData, 'subject_id')
  const chapterId = optStr(formData, 'chapter_id')
  const kind = str(formData, 'kind') || 'textbook'
  const file = formData.get('file')

  if (title.length < 3) return fail('Please give the document a title.')
  if (!subjectId) return fail('Please choose the subject.')
  if (!(file instanceof File) || file.size === 0) return fail('Please choose a PDF file.')
  const maxBytes = (Number(process.env.MAX_UPLOAD_MB || 25)) * 1024 * 1024
  if (file.size > maxBytes) return fail(`File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`)
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return fail('Only PDF files are supported.')
  }

  const admin = createAdminClient()
  const path = `${crypto.randomUUID()}.pdf`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from('documents')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: false })
  if (upErr) return fail(`Upload failed: ${upErr.message}`)

  const { data, error } = await admin
    .from('documents')
    .insert({
      owner_scope: 'master',
      subject_id: subjectId,
      chapter_id: chapterId,
      kind: ['textbook', 'syllabus', 'teacher_notes', 'pyq', 'other'].includes(kind) ? kind : 'other',
      title,
      storage_path: path,
      uploaded_by: profile.id,
      status: 'uploaded'
    })
    .select('id')
    .single()
  if (error || !data) return fail('Could not record the document.')

  await audit({
    actorId: profile.id,
    action: 'documents.uploaded',
    entity: 'documents',
    entityId: data.id,
    details: { title, kind }
  })
  revalidatePath('/master/documents')
  return { success: 'Uploaded. Next: run "Extract text", review each page, then "Approve & index".' }
}

export async function extractDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('master_admin')
  const docId = str(formData, 'document_id')
  const admin = createAdminClient()
  const { data: doc } = await admin
    .from('documents')
    .select('id, storage_path, status')
    .eq('id', docId)
    .maybeSingle()
  if (!doc) return fail('Document not found.')

  const { data: blob, error: dlErr } = await admin.storage.from('documents').download(doc.storage_path)
  if (dlErr || !blob) return fail('Could not download the file from storage.')

  // Extract per-page text (pdf.js pagerender) so page numbers are preserved.
  const pages: string[] = []
  const renderPage = async (pageData: {
    getTextContent: (opts?: Record<string, unknown>) => Promise<{ items: { str?: string; hasEOL?: boolean }[] }>
  }) => {
    const content = await pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false })
    let text = ''
    for (const item of content.items) {
      text += item.str ?? ''
      if (item.hasEOL) text += '\n'
    }
    pages.push(text)
    return text
  }

  let result
  try {
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    result = await pdfParse(Buffer.from(await blob.arrayBuffer()), { pagerender: renderPage, max: 0 })
  } catch (err) {
    console.error('pdf_parse_failed', (err as Error).message)
    return fail('Text extraction failed. The PDF may be encrypted or malformed. (Scanned-image OCR is a known gap — see README.)')
  }

  const pageCount = result.numpages || pages.length
  if (pageCount === 0) return fail('No pages could be read from this PDF.')

  await admin.from('document_pages').delete().eq('document_id', doc.id)
  const rows = []
  for (let i = 0; i < pages.length; i++) {
    const content = pages[i].replace(/\u0000/g, '').trim()
    rows.push({
      document_id: doc.id,
      page_number: i + 1,
      content,
      status: content.length === 0 ? 'needs_ocr' : 'pending'
    })
  }
  await admin.from('document_pages').insert(rows)
  await admin.from('documents').update({ status: 'extracted', page_count: pageCount }).eq('id', doc.id)

  await audit({
    action: 'documents.extracted',
    entity: 'documents',
    entityId: doc.id,
    details: { pages: pageCount, needs_ocr: rows.filter((r) => r.status === 'needs_ocr').length }
  })
  revalidatePath(`/master/documents/${doc.id}`)
  revalidatePath('/master/documents')
  return {
    success: `Extracted ${pageCount} pages. Pages with no text layer were marked "needs OCR" — review and edit them or type the content before approving.`
  }
}

export async function savePageContent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('master_admin')
  const pageId = str(formData, 'page_id')
  const content = str(formData, 'content')
  const admin = createAdminClient()
  await admin
    .from('document_pages')
    .update({ content, status: content.trim().length > 0 ? 'edited' : 'pending' })
    .eq('id', pageId)
  revalidatePath('/master/documents')
  return { success: 'Page saved.' }
}

export async function approveDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('master_admin')
  const docId = str(formData, 'document_id')
  const admin = createAdminClient()
  const { data: doc } = await admin
    .from('documents')
    .select('id, subject_id, chapter_id, kind, title, school_id')
    .eq('id', docId)
    .maybeSingle()
  if (!doc) return fail('Document not found.')

  const { data: pages } = await admin
    .from('document_pages')
    .select('page_number, content, status')
    .eq('document_id', docId)
    .order('page_number')
  const usable = (pages ?? []).filter((p) => p.status !== 'needs_ocr' && p.content.trim().length > 0)
  if (usable.length === 0) {
    return fail('No approved pages with content. Review/extract pages first (pages marked "needs OCR" are skipped).')
  }

  const { chunks } = await indexDocumentPages(
    {
      id: doc.id,
      school_id: doc.school_id,
      subject_id: doc.subject_id,
      chapter_id: doc.chapter_id,
      kind: doc.kind,
      title: doc.title
    },
    usable.map((p) => ({ page_number: p.page_number, content: p.content }))
  )

  await admin.from('documents').update({ status: 'indexed' }).eq('id', docId)
  await audit({
    action: 'documents.indexed',
    entity: 'documents',
    entityId: docId,
    details: { chunks }
  })
  revalidatePath(`/master/documents/${docId}`)
  revalidatePath('/master/documents')
  return {
    success: `Indexed ${chunks} chunks from ${usable.length} pages. The tutor can now cite this material (page numbers preserved).`
  }
}

export async function rejectDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole('master_admin')
  const docId = str(formData, 'document_id')
  const admin = createAdminClient()
  await admin.from('documents').update({ status: 'rejected' }).eq('id', docId)
  await admin.from('chunks').delete().eq('document_id', docId)
  await audit({ action: 'documents.rejected', entity: 'documents', entityId: docId })
  revalidatePath('/master/documents')
  return { success: 'Document rejected and removed from the search index.' }
}
