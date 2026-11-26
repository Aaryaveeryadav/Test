export const metadata = { title: 'Privacy notice' }

const SECTIONS = [
  {
    title: 'What we store and why',
    rows: [
      ['Account basics', 'Name, email, school, role, roll number (students). Needed to verify enrollment and manage access.'],
      ['Guardian details', 'Guardian name/contact and consent flag for student accounts — collected at signup, used only for school contact about the account.'],
      ['Study activity', 'Practice attempts, assignment submissions and chat questions — used to show progress and let teachers help where students struggle.'],
      ['Tutor chats', 'Question and answer text with citations. Kept only for the retention window your school sets (default 90 days) and can be deleted by you at any time.']
    ]
  },
  {
    title: 'What we never collect',
    rows: [
      ['No Aadhaar or government IDs', 'The platform never asks for Aadhaar or any government identity number.'],
      ['No phone number by default', 'Phone is optional and only collected if your school has an approved, documented need for it.'],
      ['No training on your data', 'Your chats and personal information are never used to train AI models. Any future fine-tuning would be a separate, reviewed process using approved material only — never student chats.']
    ]
  },
  {
    title: 'Who can see what',
    rows: [
      ['Students', 'Only their own study history, progress and chats.'],
      ['Teachers', 'Only the classes and subjects assigned to them: student lists, topic-level practice results, and flagged answers they must review.'],
      ['School administrators', 'Users and classes of their own school only.'],
      ['Platform administrators', 'Schools, curriculum and audit records. They do not read student chats in normal operation.']
    ]
  },
  {
    title: 'The AI tutor',
    rows: [
      ['Local model only', 'Questions and material are processed by a self-hosted AI model. Nothing is sent to Gemini, ChatGPT or any hosted AI service, and there is no cloud fallback.'],
      ['Grounded answers', 'Answers are retrieved from administrator-approved textbooks, syllabus material, teacher notes and previous-year questions, with citations.'],
      ['Not guaranteed correct', 'AI answers can be wrong. Students are always told to verify with textbooks and teachers, and can flag any answer for teacher review.']
    ]
  },
  {
    title: 'Deletion and retention',
    rows: [
      ['Your chats', 'Students can delete their own chats at any time.'],
      ['Automatic cleanup', 'Chat history is deleted after the school-configured retention window (default 90 days).'],
      ['School decisions', 'Schools set their retention policy; the platform administrator configures the cleanup schedule.']
    ]
  }
]

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight">Privacy notice</h1>
      <p className="mt-2 text-sm text-slate-600">
        Plain-language summary of what the Sahayak study platform stores, why, who can see it, and how it can be
        deleted. This is a product privacy summary — schools remain responsible for their own compliance review under
        applicable law (including India&apos;s DPDP Act) before going live with real students.
      </p>

      {SECTIONS.map((s) => (
        <section key={s.title} className="card mt-5">
          <h2 className="font-bold text-slate-800">{s.title}</h2>
          <dl className="mt-2 space-y-2">
            {s.rows.map(([k, v]) => (
              <div key={k} className="grid gap-1 sm:grid-cols-[220px_1fr]">
                <dt className="text-sm font-semibold text-slate-700">{k}</dt>
                <dd className="text-sm text-slate-600">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <p className="mt-6 text-center text-xs text-slate-400">
        Questions? Contact your school office or the platform administrator.
      </p>
    </main>
  )
}
