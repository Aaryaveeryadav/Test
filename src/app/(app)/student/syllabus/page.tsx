import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { requireRole } from '@/lib/auth'
import { getStudentContext } from '@/lib/data'
import { Card, CardTitle, EmptyState, PageHeader } from '@/components/ui'

export const metadata = { title: 'Syllabus & chapters' }

export default async function SyllabusPage() {
  const profile = await requireRole('student')
  const ctx = await getStudentContext(profile)

  if (!ctx) {
    return (
      <>
        <PageHeader title="Syllabus & chapters" />
        <EmptyState
          title="Your class and subjects are not set up yet"
          hint="Your school administrator needs to enroll you in a class. Please check back after they confirm."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Syllabus & chapters"
        subtitle={`${ctx.boardName} · ${ctx.className} ${ctx.section} · ${ctx.academicYear}`}
      />

      <Card>
        <CardTitle>Your subjects ({ctx.subjects.length})</CardTitle>
        {ctx.subjects.length === 0 ? (
          <EmptyState title="No subjects enabled yet" hint="Your school will add subjects to your class soon." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {ctx.subjects.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/student/subject/${s.id}`}
                  className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-blush-50"
                >
                  <span className="min-w-0">
                    <span className="block font-serif text-lg font-bold text-stone-900">{s.name}</span>
                    <span className="block text-xs text-stone-400">Chapters, topics and your recorded progress</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-stone-300" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
