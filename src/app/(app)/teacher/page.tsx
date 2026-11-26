import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { getTeacherAssignments } from '@/lib/data'
import { Card, EmptyState, PageHeader } from '@/components/ui'

export const metadata = { title: 'My classes' }

export default async function TeacherHome() {
  const profile = await requireRole('teacher')
  const assignments = await getTeacherAssignments(profile)

  return (
    <>
      <PageHeader
        title="My classes"
        subtitle="Pick the class and subject you want to work with — everything else is scoped to that choice."
      />
      {assignments.length === 0 ? (
        <EmptyState
          title="No class assignments yet"
          hint="Your school administrator assigns teachers to class-subject pairs. Once assigned, your classes appear here."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <Link key={a.id} href={`/teacher/class/${a.id}`} className="card transition hover:border-indigo-300">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                Class {a.grade} {a.className} · Section {a.section}
              </p>
              <p className="mt-1 text-lg font-bold text-slate-800">{a.subjectName}</p>
              <p className="mt-1 text-xs text-slate-400">Academic year {a.academicYear}</p>
              <p className="mt-3 text-sm font-semibold text-rose-600">Open class dashboard →</p>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
