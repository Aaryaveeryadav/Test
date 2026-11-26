import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { CURRICULUM_ENTITIES, CURRICULUM_ORDER, type EntityDef } from '@/lib/curriculum-config'
import { ActionForm } from '@/components/action-form'
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { archiveCurriculumEntity, upsertCurriculumEntity } from '@/actions/master-actions'

export const metadata = { title: 'Curriculum' }

export default async function CurriculumEntityPage({
  params,
  searchParams
}: {
  params: Promise<{ entity: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  await requireRole('master_admin')
  const { entity } = await params
  const { edit } = await searchParams
  const def: EntityDef | undefined = CURRICULUM_ENTITIES[entity]
  if (!def) notFound()

  const admin = createAdminClient()
  const [{ data: rows }, refDataRaw] = await Promise.all([
    admin.from(entity).select('*').order('created_at', { ascending: false }).limit(100),
    Promise.all([
      admin.from('boards').select('id, name, status').order('name'),
      admin.from('classes').select('id, grade, label, board_id, status').order('grade'),
      admin.from('subjects').select('id, name, code, class_id, status').order('name'),
      admin.from('chapters').select('id, number, title, subject_id, status').order('number'),
      admin.from('topics').select('id, title, chapter_id, status').order('title')
    ])
  ])
  const refResults = refDataRaw as unknown as { data: Record<string, string | number>[] | null }[]
  const [boards = [], classes = [], subjects = [], chapters = [], topics = []] = refResults.map((r) => r.data ?? [])

  const boardName = new Map(boards.map((b) => [String(b.id), String(b.name)]))
  const classLabel = new Map(classes.map((c) => [String(c.id), `${boardName.get(String(c.board_id)) ?? '?'} · ${c.label ? String(c.label) : `Class ${c.grade}`}`]))
  const subjectLabel = new Map(subjects.map((s) => [String(s.id), `${classLabel.get(String(s.class_id)) ?? '?'} · ${String(s.name)}`]))
  const chapterLabel = new Map(chapters.map((c) => [String(c.id), `${subjectLabel.get(String(c.subject_id)) ?? '?'} — Ch ${c.number}. ${String(c.title)}`]))
  const topicLabel = new Map(topics.map((t) => [String(t.id), `${chapterLabel.get(String(t.chapter_id)) ?? '?'} · ${String(t.title)}`]))
  const refMaps: Record<string, Map<string, string>> = {
    boards: boardName,
    classes: classLabel,
    subjects: subjectLabel,
    chapters: chapterLabel,
    topics: topicLabel
  }

  function optionsFor(field: { ref?: 'boards' | 'classes' | 'subjects' | 'chapters' | 'topics' }): { value: string; label: string }[] {
    if (!field.ref) return []
    return [...(refMaps[field.ref] ?? new Map()).entries()].map(([value, label]) => ({ value, label }))
  }

  const editing = edit ? (rows ?? []).find((r) => r.id === edit) : null

  return (
    <>
      <PageHeader title={def.label} subtitle="Master curriculum — visible to all schools, editable only here. Archiving hides items without deleting history.">
        <nav className="flex flex-wrap gap-1.5" aria-label="Curriculum sections">
          {CURRICULUM_ORDER.map((key) => (
            <Link
              key={key}
              href={`/master/curriculum/${key}`}
              className={key === entity ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-secondary px-3 py-1.5 text-xs'}
            >
              {CURRICULUM_ENTITIES[key].label}
            </Link>
          ))}
        </nav>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardTitle>{editing ? 'Edit item' : 'Add new'}</CardTitle>
          <ActionForm
            key={editing?.id ?? 'new'}
            action={upsertCurriculumEntity}
            submitLabel={editing ? 'Save changes' : 'Create'}
          >
            <input type="hidden" name="entity" value={entity} />
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <div className="space-y-3">
              {def.fields.map((f) => (
                <div key={f.name}>
                  <label className="label" htmlFor={`f_${f.name}`}>
                    {f.label}
                    {f.required ? <span className="text-rose-600"> *</span> : null}
                  </label>
                  {f.type === 'select' ? (
                    <select id={`f_${f.name}`} name={f.name} defaultValue={editing ? String(editing[f.name] ?? '') : ''} className="input" required={f.required}>
                      <option value="">—</option>
                      {optionsFor(f).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      id={`f_${f.name}`}
                      name={f.name}
                      rows={3}
                      required={f.required}
                      defaultValue={editing ? String(editing[f.name] ?? '') : ''}
                      className="input"
                    />
                  ) : (
                    <input
                      id={`f_${f.name}`}
                      name={f.name}
                      type={f.type === 'number' ? 'number' : 'text'}
                      required={f.required}
                      defaultValue={editing ? String(editing[f.name] ?? '') : ''}
                      className="input"
                    />
                  )}
                  {f.help ? <p className="mt-1 text-xs text-slate-400">{f.help}</p> : null}
                </div>
              ))}
            </div>
          </ActionForm>
          {editing ? (
            <p className="mt-2 text-xs">
              <Link href={`/master/curriculum/${entity}`} className="text-rose-600 hover:underline">
                Cancel editing
              </Link>
            </p>
          ) : null}
        </Card>

        <Card>
          <CardTitle right={<Badge tone="slate">{rows?.length ?? 0} shown</Badge>}>All items</CardTitle>
          {(rows ?? []).length === 0 ? (
            <EmptyState title={`No ${def.label.toLowerCase()} yet`} hint="Create the first one with the form." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    {def.listColumns.map((c) => (
                      <th key={c.name} className="th">
                        {c.label}
                      </th>
                    ))}
                    <th className="th">Status</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(rows ?? []).map((r) => (
                    <tr key={r.id} className={r.status === 'archived' ? 'opacity-60' : ''}>
                      {def.listColumns.map((c) => (
                        <td key={c.name} className="td max-w-[280px] truncate">
                          {c.ref ? refMaps[c.ref]?.get(String(r[c.name])) ?? '—' : String(r[c.name] ?? '—')}
                        </td>
                      ))}
                      <td className="td">
                        <Badge tone={r.status === 'active' ? 'green' : r.status === 'indexed' ? 'indigo' : 'amber'}>
                          {String(r.status ?? '—')}
                        </Badge>
                      </td>
                      <td className="td">
                        <div className="flex gap-2">
                          <Link
                            href={`/master/curriculum/${entity}?edit=${r.id}`}
                            className="text-xs font-semibold text-rose-600 hover:underline"
                          >
                            Edit
                          </Link>
                          <ActionForm action={archiveCurriculumEntity} submitLabel={r.status === 'archived' ? 'Restore' : 'Archive'} className="inline">
                            <input type="hidden" name="entity" value={entity} />
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="archived" value={r.status === 'archived' ? '0' : '1'} />
                          </ActionForm>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
