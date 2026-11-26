import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionForm } from '@/components/action-form'
import { Badge, Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'
import { assignTeacher, enrollStudent, upsertClassSubject, upsertSchoolClass } from '@/actions/admin-actions'

export const metadata = { title: 'Classes & enrollments' }

export default async function AdminClassesPage() {
  const profile = await requireRole('school_admin')
  const admin = createAdminClient()

  const [{ data: school }, { data: sections }, { data: teachers }, { data: students }] = await Promise.all([
    admin.from('schools').select('board_id').eq('id', profile.school_id).maybeSingle(),
    admin
      .from('school_classes')
      .select(
        `id, section, academic_year, status,
         classes(id, grade, label),
         class_subjects(id, subjects(id, name, code)),
         enrollments(count),
         teacher_assignments(id, teacher_id, subject_id, profiles(full_name), subjects(name))`
      )
      .eq('school_id', profile.school_id)
      .order('created_at'),
    admin.from('profiles').select('id, full_name').eq('school_id', profile.school_id).eq('role', 'teacher').eq('status', 'active'),
    admin.from('profiles').select('id, full_name, roll_number').eq('school_id', profile.school_id).eq('role', 'student').eq('status', 'active')
  ])

  // Curriculum classes the school can offer (restricted to the school's board).
  let classOptions: { id: string; label: string }[] = []
  if (school?.board_id) {
    const { data: classes } = await admin
      .from('classes')
      .select('id, grade, label, status')
      .eq('board_id', school.board_id)
      .eq('status', 'active')
      .order('grade')
    classOptions = (classes ?? []).map((c) => ({ id: c.id, label: c.label ?? `Class ${c.grade}` }))
  }
  // Subjects per curriculum class (for subject offering + teacher assignment).
  const { data: subjRows } = await admin
    .from('subjects')
    .select('id, name, class_id, status')
    .eq('status', 'active')
    .order('name')
  const subjectsByClass = new Map<string, { id: string; name: string }[]>()
  for (const s of subjRows ?? []) {
    const list = subjectsByClass.get(s.class_id) ?? []
    list.push({ id: s.id, name: s.name })
    subjectsByClass.set(s.class_id, list)
  }

  return (
    <>
      <PageHeader title="Classes & enrollments" subtitle="Set up which classes and subjects your school offers, enroll students, and assign teachers.">
        {classOptions.length === 0 ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Your school has no board selected, or the master curriculum has no classes for it yet. Ask the platform
            administrator.
          </p>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Create class section</CardTitle>
          <ActionForm action={upsertSchoolClass} submitLabel="Create section">
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="class_id">
                  Class (from your board&apos;s curriculum)
                </label>
                <select id="class_id" name="class_id" className="input" required>
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="section">
                    Section
                  </label>
                  <input id="section" name="section" defaultValue="A" maxLength={8} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="academic_year">
                    Academic year
                  </label>
                  <input id="academic_year" name="academic_year" defaultValue={String(new Date().getFullYear())} className="input" />
                </div>
              </div>
            </div>
          </ActionForm>
        </Card>

        <Card>
          <CardTitle>Enroll a student</CardTitle>
          <ActionForm action={enrollStudent} submitLabel="Enroll">
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="student_id">
                  Student
                </label>
                <select id="student_id" name="student_id" className="input" required>
                  {(students ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.roll_number ? `(roll ${s.roll_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="enroll_class">
                  Class section
                </label>
                <select id="enroll_class" name="school_class_id" className="input" required>
                  {(sections ?? []).map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {(sc.classes as unknown as { grade: number; label: string | null } | null)?.label ?? 'Class'} · Section {sc.section} ({sc.academic_year})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ActionForm>
        </Card>

        <Card>
          <CardTitle>Assign a teacher</CardTitle>
          <ActionForm action={assignTeacher} submitLabel="Assign">
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="teacher_id">
                  Teacher
                </label>
                <select id="teacher_id" name="teacher_id" className="input" required>
                  {(teachers ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="assign_class">
                  Class section
                </label>
                <select id="assign_class" name="school_class_id" className="input" required>
                  {(sections ?? []).map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {(sc.classes as unknown as { grade: number; label: string | null } | null)?.label ?? 'Class'} · Section {sc.section}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="assign_subject">
                  Subject (must already be offered for that section)
                </label>
                <select id="assign_subject" name="subject_id" className="input" required>
                  {(subjRows ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ActionForm>
        </Card>
      </div>

      <Card className="mt-6">
        <CardTitle>Sections, subjects & enrollments</CardTitle>
        {(sections ?? []).length === 0 ? (
          <EmptyState title="No class sections yet" hint="Create your first section above." />
        ) : (
          <div className="space-y-4">
            {(sections ?? []).map((sc) => {
              const cls = sc.classes as unknown as { id: string; grade: number; label: string | null } | null
              const offered = (sc.class_subjects ?? []) as unknown as { id: string; subjects: { id: string; name: string; code: string } }[]
              const assigned = (sc.teacher_assignments ?? []) as unknown as {
                id: string
                teacher_id: string
                profiles: { full_name: string } | null
                subjects: { name: string } | null
              }[]
              return (
                <div key={sc.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-800">
                      {cls?.label ?? 'Class'} · Section {sc.section}
                    </span>
                    <Badge tone="slate">{sc.academic_year}</Badge>
                    <Badge tone="indigo">{(sc.enrollments as unknown as { count: number }[] | null)?.[0]?.count ?? 0} students</Badge>
                  </div>

                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Subjects offered</p>
                      {offered.length === 0 ? (
                        <p className="text-sm text-slate-500">None yet.</p>
                      ) : (
                        <ul className="mt-1 space-y-0.5">
                          {offered.map((cs) => (
                            <li key={cs.id} className="text-sm text-slate-600">
                              {cs.subjects.name} <span className="text-xs text-slate-400">({cs.subjects.code})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-2">
                        <ActionForm action={upsertClassSubject} submitLabel="Add subject" className="flex items-end gap-2">
                          <input type="hidden" name="school_class_id" value={sc.id} />
                          <div className="grow">
                            <label className="sr-only" htmlFor={`subj_${sc.id}`}>
                              Subject
                            </label>
                            <select id={`subj_${sc.id}`} name="subject_id" className="input">
                              {(subjectsByClass.get(classIdOf(sc)) ?? []).map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </ActionForm>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Teacher assignments</p>
                      {assigned.length === 0 ? (
                        <p className="mt-1 text-sm text-slate-500">None yet.</p>
                      ) : (
                        <ul className="mt-1 space-y-0.5">
                          {assigned.map((ta) => (
                            <li key={ta.id} className="text-sm text-slate-600">
                              {ta.profiles?.full_name ?? '—'} → {ta.subjects?.name ?? '—'}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </>
  )
}

function classIdOf(sc: { classes: unknown }): string {
  const c = sc.classes as unknown as { id?: string } | null
  return c?.id ?? ''
}
