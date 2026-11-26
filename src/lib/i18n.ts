/**
 * Bilingual foundation (stage 1 of the Upay-style en/हिंदी support).
 * Language is stored in a cookie so server components can render it without
 * flashing. Extend DICT page by page — untranslated keys fall back to English.
 */

export type Lang = 'en' | 'hi'
export const LANG_COOKIE = 'sahayak-lang'

export function resolveLang(raw: string | undefined | null): Lang {
  return raw === 'hi' ? 'hi' : 'en'
}

type Entry = { en: string; hi: string }

export const DICT = {
  // Brand + tagline
  tagline: { en: 'Every way to solve', hi: 'हर तरीका हल का' },
  show_ways: { en: 'Show me the ways', hi: 'हर तरीका दिखाओ' },
  sign_out: { en: 'Sign out', hi: 'साइन आउट' },

  // Nav groups
  group_learn: { en: 'Learn', hi: 'सीखें' },
  group_library: { en: 'Library', hi: 'पुस्तकालय' },
  group_teach: { en: 'Teach', hi: 'अध्यापन' },
  group_manage: { en: 'Manage', hi: 'प्रबंधन' },
  group_platform: { en: 'Platform', hi: 'प्लेटफ़ॉर्म' },

  // Student nav items (keyed by href)
  '/student': { en: 'Home', hi: 'होम' },
  '/student/tutor': { en: 'Ask a question', hi: 'प्रश्न पूछें' },
  '/student/practice': { en: 'Practice', hi: 'अभ्यास' },
  '/student/assignments': { en: 'Assignments', hi: 'गृहकार्य' },
  '/student/progress': { en: 'My progress', hi: 'मेरी प्रगति' },
  '/student/syllabus': { en: 'Syllabus & chapters', hi: 'पाठ्यक्रम व अध्याय' },

  // Teacher nav
  '/teacher': { en: 'My classes', hi: 'मेरी कक्षाएँ' },
  '/teacher/topics': { en: 'Topic planning', hi: 'विषय योजना' },
  '/teacher/notes': { en: 'Notes & practice', hi: 'नोट्स व अभ्यास' },
  '/teacher/review': { en: 'Review flags', hi: 'समीक्षा' },

  // Admin nav
  '/admin': { en: 'Overview', hi: 'अवलोकन' },
  '/admin/approvals': { en: 'Approvals & invites', hi: 'स्वीकृतियाँ' },
  '/admin/classes': { en: 'Classes & enrollments', hi: 'कक्षाएँ व नामांकन' },
  '/admin/users': { en: 'Users', hi: 'उपयोगकर्ता' },
  '/admin/audit': { en: 'Audit log', hi: 'लॉग' },

  // Master nav
  '/master': { en: 'Overview', hi: 'अवलोकन' },
  '/master/schools': { en: 'Schools', hi: 'विद्यालय' },
  '/master/curriculum/boards': { en: 'Curriculum', hi: 'पाठ्यक्रम' },
  '/master/documents': { en: 'Books & documents', hi: 'पुस्तकें व दस्तावेज़' },

  // Landing
  landing_pill: { en: 'CLASS 10–12 · NCERT · BOARD-WISE', hi: 'कक्षा 10–12 · एनसीईआरटी · बोर्ड-वार' },
  landing_h1_a: { en: 'One question.', hi: 'एक प्रश्न।' },
  landing_h1_b: { en: 'Every way', hi: 'हर तरीका' },
  landing_h1_c: { en: 'to solve it.', hi: 'से समाधान।' },
  landing_sub: {
    en: 'Ask any question from your syllabus. Sahayak shows the same answer worked out different ways — so you learn the reasoning, not just the result. Every answer cites your school’s approved books and past-year questions.',
    hi: 'अपने पाठ्यक्रम का कोई भी प्रश्न पूछें। सहायक एक ही उत्तर अलग-अलग तरीकों से दिखाता है — ताकि आप केवल परिणाम नहीं, तर्क-प्रक्रिया सीखें। हर उत्तर में विद्यालय की स्वीकृत पुस्तकों और पिछले वर्षों के प्रश्नों का संदर्भ होता है।'
  },
  landing_cta: { en: 'Request access with school code', hi: 'विद्यालय कोड से पहुँच का अनुरोध करें' },
  landing_signin: { en: 'Sign in', hi: 'साइन इन' },
  landing_note: {
    en: 'One login for everyone — your role (student, teacher, school admin, master admin) is decided by your account, not a form.',
    hi: 'सबके लिए एक ही लॉगिन — आपकी भूमिका (छात्र, शिक्षक, प्रशासक) आपके खाते से तय होती है, किसी फ़ॉर्म से नहीं।'
  },
  landing_sample: { en: 'Sample question', hi: 'नमूना प्रश्न' },
  landing_sample_note: {
    en: 'Shown as: simple explanation · step-by-step · board-exam answer',
    hi: 'रूप: सरल व्याख्या · चरण-दर-चरण · बोर्ड-परीक्षा उत्तर'
  },
  landing_schools_t: { en: 'For schools', hi: 'विद्यालयों के लिए' },
  landing_schools_b: {
    en: 'Schools join with a code from the platform administrator. Students request access with their school code and roll number; teachers are invited or approved by the school. Guardian consent is collected for student accounts. AI answers are tools for learning — they are never guaranteed correct, and students can flag any answer for teacher review.',
    hi: 'विद्यालय प्लेटफ़ॉर्म प्रशासक के कोड से जुड़ते हैं। छात्र विद्यालय कोड व रोल नंबर से पहुँच का अनुरोध करते हैं; शिक्षकों को विद्यालय आमंत्रित/स्वीकृत करता है। छात्र खातों हेतु अभिभावक की सहमति ली जाती है। AI उत्तर सीखने का साधन हैं — ये कभी भी ‘सत्यापित सही’ नहीं कहलाते, और छात्र किसी भी उत्तर को शिक्षक-समीक्षा हेतु चिह्नित कर सकते हैं।'
  },

  // Student dashboard
  dash_daily_pending: { en: 'Daily task pending', hi: 'आज का कार्य बाकी' },
  dash_daily_done: { en: 'Daily practice', hi: 'आज का अभ्यास' },
  dash_done_today: { en: 'done today', hi: 'आज हुए' },
  dash_start: { en: 'Start', hi: 'शुरू करें' },
  dash_plan_t: { en: 'Your next study plan', hi: 'आपकी अगली अध्ययन योजना' },
  dash_plan_note: {
    en: 'Based on your recorded practice results — never on your tutor chats.',
    hi: 'आपके दर्ज अभ्यास परिणामों पर आधारित — कभी भी ट्यूटर-चैट पर नहीं।'
  },
  dash_continue: { en: 'Continue studying', hi: 'पढ़ाई जारी रखें' },
  dash_practise: { en: 'Practise · today’s focus', hi: 'अभ्यास · आज का केंद्र' },
  dash_goal: { en: 'Daily goal (planning only)', hi: 'दैनिक लक्ष्य (केवल योजना हेतु)' },
  dash_goal_questions: { en: 'questions', hi: 'प्रश्न' },
  dash_goal_note: {
    en: 'Choose your own pace. This goal is not a score or a promise of available questions — it stays on this device only.',
    hi: 'अपनी गति स्वयं चुनें। यह लक्ष्य अंक नहीं या प्रश्नों की गारंटी नहीं — यह केवल इसी उपकरण पर रहता है।'
  },
  dash_my_subjects: { en: 'My subjects', hi: 'मेरे विषय' },
  dash_recent_q: { en: 'Recent questions', hi: 'हाल के प्रश्न' },
  dash_assignments_due: { en: 'Assignments due', hi: 'बाकी गृहकार्य' },
  dash_ask_tutor: { en: 'Ask the tutor →', hi: 'ट्यूटर से पूछें →' },
  dash_progress_calc: { en: 'How your progress is calculated', hi: 'आपकी प्रगति कैसे गिनी जाती है' }
} as const satisfies Record<string, Entry>

export type DictKey = keyof typeof DICT

export function t(lang: Lang, key: DictKey): string {
  return DICT[key][lang] ?? DICT[key].en
}

/** Hindi label for a nav href, falling back to the English label. */
export function navLabel(lang: Lang, href: string, english: string): string {
  if (lang === 'en') return english
  const entry = (DICT as Record<string, Entry | undefined>)[href]
  return entry ? entry.hi : english
}
