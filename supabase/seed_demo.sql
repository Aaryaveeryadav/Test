-- ============================================================================
-- DEMO CONTENT ONLY — Sahayak Study Platform
-- Safe to re-run (idempotent). Everything created here is clearly demo data:
-- demo boards/curriculum, one demo school, no real students.
-- Run in Supabase SQL editor, or via scripts/apply-demo-seed.mjs guidance.
-- ============================================================================

do $$
declare
  b_cbse uuid;
  c10 uuid;
  c12 uuid;
  s_sci uuid;
  s_mat uuid;
  s_phy uuid;
  ch_chem uuid;
  ch_light uuid;
  ch_life uuid;
  ch_poly uuid;
  ch_linear uuid;
  ch_rayoptics uuid;
  sch uuid;
  sc10 uuid;
  sc12 uuid;
  t uuid;
begin
  -- Boards -------------------------------------------------------------
  insert into boards (name, code) values ('Central Board of Secondary Education [DEMO]', 'CBSE')
    on conflict (code) do update set name = excluded.name
    returning id into b_cbse;

  -- Classes ------------------------------------------------------------
  insert into classes (board_id, grade, label) values (b_cbse, 10, 'Class 10 [DEMO]')
    on conflict (board_id, grade) do update set label = excluded.label
    returning id into c10;
  insert into classes (board_id, grade, label) values (b_cbse, 12, 'Class 12 [DEMO]')
    on conflict (board_id, grade) do update set label = excluded.label
    returning id into c12;

  -- Subjects -----------------------------------------------------------
  insert into subjects (class_id, name, code) values (c10, 'Science', 'SCI10')
    on conflict (class_id, code) do update set name = excluded.name
    returning id into s_sci;
  insert into subjects (class_id, name, code) values (c10, 'Mathematics', 'MAT10')
    on conflict (class_id, code) do update set name = excluded.name
    returning id into s_mat;
  insert into subjects (class_id, name, code) values (c12, 'Physics', 'PHY12')
    on conflict (class_id, code) do update set name = excluded.name
    returning id into s_phy;

  -- Chapters: Class 10 Science ------------------------------------------
  insert into chapters (subject_id, number, title) values (s_sci, 1, 'Chemical Reactions and Equations [DEMO]')
    on conflict (subject_id, number) do update set title = excluded.title
    returning id into ch_chem;
  insert into chapters (subject_id, number, title) values (s_sci, 10, 'Light – Reflection and Refraction [DEMO]')
    on conflict (subject_id, number) do update set title = excluded.title
    returning id into ch_light;
  insert into chapters (subject_id, number, title) values (s_sci, 6, 'Life Processes [DEMO]')
    on conflict (subject_id, number) do update set title = excluded.title
    returning id into ch_life;

  -- Chapters: Class 10 Mathematics --------------------------------------
  insert into chapters (subject_id, number, title) values (s_mat, 2, 'Polynomials [DEMO]')
    on conflict (subject_id, number) do update set title = excluded.title
    returning id into ch_poly;
  insert into chapters (subject_id, number, title) values (s_mat, 3, 'Pair of Linear Equations in Two Variables [DEMO]')
    on conflict (subject_id, number) do update set title = excluded.title
    returning id into ch_linear;

  -- Chapters: Class 12 Physics -----------------------------------------
  insert into chapters (subject_id, number, title) values (s_phy, 9, 'Ray Optics and Optical Instruments [DEMO]')
    on conflict (subject_id, number) do update set title = excluded.title
    returning id into ch_rayoptics;

  -- Topics ---------------------------------------------------------------
  for t in
    select x.ch, x.title, x.description from (values
      (ch_chem, 'Chemical equations [DEMO]', 'Writing and interpreting chemical equations'),
      (ch_chem, 'Balancing chemical equations [DEMO]', 'Conservation of mass in equations'),
      (ch_chem, 'Types of chemical reactions [DEMO]', 'Combination, decomposition, displacement, double displacement, redox'),
      (ch_chem, 'Corrosion and rancidity [DEMO]', 'Oxidation effects in daily life'),
      (ch_light, 'Reflection of light [DEMO]', 'Laws of reflection, plane mirrors'),
      (ch_light, 'Spherical mirrors [DEMO]', 'Concave and convex mirrors, image formation'),
      (ch_light, 'Mirror formula and magnification [DEMO]', '1/v + 1/u = 1/f, m = h''/h'),
      (ch_light, 'Refraction of light [DEMO]', 'Snell''s law, refractive index'),
      (ch_light, 'Lens formula and power of a lens [DEMO]', '1/v − 1/u = 1/f, P = 1/f'),
      (ch_life, 'Nutrition [DEMO]', 'Autotrophic and heterotrophic nutrition'),
      (ch_life, 'Respiration [DEMO]', 'Aerobic and anaerobic respiration'),
      (ch_life, 'Transportation [DEMO]', 'Xylem, phloem, blood and lymph'),
      (ch_life, 'Excretion [DEMO]', 'Kidneys, nephrons, excretory products'),
      (ch_poly, 'Zeroes of a polynomial [DEMO]', 'Relationship between zeroes and coefficients'),
      (ch_poly, 'Division algorithm for polynomials [DEMO]', 'p(x) = g(x)·q(x) + r(x)'),
      (ch_linear, 'Graphical method [DEMO]', 'Solving pairs of equations graphically'),
      (ch_linear, 'Substitution and elimination [DEMO]', 'Algebraic solution methods'),
      (ch_rayoptics, 'Reflection and spherical mirrors [DEMO]', 'Sign convention, mirror formula'),
      (ch_rayoptics, 'Refraction and Snell''s law [DEMO]', 'Total internal reflection, optical fibres'),
      (ch_rayoptics, 'Lenses and prisms [DEMO]', 'Lens maker''s formula, prism dispersion')
    ) as x(ch, title, description)
  loop
    insert into topics (chapter_id, title, description)
    select t.ch, t.title, t.description
    where not exists (select 1 from topics where chapter_id = t.ch and title = t.title);
  end loop;

  -- Formulas --------------------------------------------------------------
  insert into formulas (chapter_id, title, expression, description)
  select ch_light, x.title, x.expression, x.description from (values
    ('Mirror formula [DEMO]', '1/v + 1/u = 1/f', 'Relates object distance, image distance and focal length for spherical mirrors'),
    ('Magnification (mirrors) [DEMO]', 'm = h''/h = −v/u', 'Image height ratio; negative means inverted'),
    ('Lens formula [DEMO]', '1/v − 1/u = 1/f', 'Thin-lens relation for convex/concave lenses'),
    ('Power of a lens [DEMO]', 'P = 1/f (f in metres), unit: dioptre (D)', 'Strength of a lens')
  ) as x(title, expression, description)
  where not exists (select 1 from formulas where chapter_id = ch_light and title = x.title);

  insert into formulas (chapter_id, title, expression, description)
  select ch_poly, 'Division algorithm [DEMO]', 'p(x) = g(x)·q(x) + r(x), deg r < deg g', 'Polynomial long division relation'
  where not exists (select 1 from formulas where chapter_id = ch_poly and title = 'Division algorithm [DEMO]');

  -- Textbooks -----------------------------------------------------------
  insert into textbooks (subject_id, title, author, publisher, edition)
  select s_sci, 'Science — Textbook for Class X [DEMO]', 'NCERT', 'NCERT', 'Latest'
  where not exists (select 1 from textbooks where subject_id = s_sci and title like 'Science — Textbook%');
  insert into textbooks (subject_id, title, author, publisher, edition)
  select s_mat, 'Mathematics — Textbook for Class X [DEMO]', 'NCERT', 'NCERT', 'Latest'
  where not exists (select 1 from textbooks where subject_id = s_mat and title like 'Mathematics — Textbook%');
  insert into textbooks (subject_id, title, author, publisher, edition)
  select s_phy, 'Physics Part I & II — Class XII [DEMO]', 'NCERT', 'NCERT', 'Latest'
  where not exists (select 1 from textbooks where subject_id = s_phy and title like 'Physics Part%');

  -- Previous-year questions (demo entries) ---------------------------------
  insert into pyqs (subject_id, chapter_id, year, exam, question_no, question_text, marks, answer_text)
  select s_sci, ch_light, x.year, 'CBSE Board Exam', x.qno, x.q, x.marks, x.a from (values
    (2023, 'Q3', 'An object is placed 20 cm from a concave mirror of focal length 15 cm. Find the position and nature of the image. [DEMO]', 3,
     'Using 1/v + 1/u = 1/f with u = −20 cm, f = −15 cm: 1/v = 1/f − 1/u = −1/15 + 1/20 = −(4−3)/60 = −1/60, so v = −60 cm. The image is real, inverted, magnified (m = −v/u = −3), formed 60 cm in front of the mirror.'),
    (2022, 'Q5', 'The refractive index of water is 1.33 and of glass is 1.5. In which medium does light travel slower and why? [DEMO]', 2,
     'Light travels slower in glass: n = c/v, so higher refractive index means lower speed. v_glass = c/1.5 < v_water = c/1.33.'),
    (2020, 'Q2', 'A concave lens has focal length 15 cm. At what distance should an object be placed so that the image is 10 cm from the lens? [DEMO]', 3,
     'Using 1/v − 1/u = 1/f with f = −15 cm, v = −10 cm (image on same side): 1/u = 1/v − 1/f = −1/10 + 1/15 = −1/30, so u = −30 cm. The object must be 30 cm from the lens.'),
    (2019, 'Q4', 'Define power of a lens. A convex lens has power +2.5 D. Find its focal length. [DEMO]', 2,
     'Power is the degree of convergence/divergence: P = 1/f (metres). f = 1/P = 1/2.5 = 0.4 m = 40 cm (convex, converging).')
  ) as x(year, qno, q, marks, a)
  where not exists (select 1 from pyqs where subject_id = s_sci and year = x.year and question_no = x.qno and question_text = x.q);

  insert into pyqs (subject_id, chapter_id, year, exam, question_no, question_text, marks, answer_text)
  select s_sci, ch_chem, x.year, 'CBSE Board Exam', x.qno, x.q, x.marks, x.a from (values
    (2023, 'Q1', 'Balance the following chemical equation: Fe + H2O → Fe3O4 + H2. Name the type of reaction. [DEMO]', 2,
     '3Fe + 4H2O → Fe3O4 + 4H2. This is a redox (oxidation–reduction) reaction: iron is oxidised, water (hydrogen) is reduced.'),
    (2021, 'Q2', 'Why is respiration considered an exothermic reaction? [DEMO]', 2,
     'Because energy is released during respiration: glucose reacts with oxygen to give CO2, water and heat — heat is released, so it is exothermic.')
  ) as x(year, qno, q, marks, a)
  where not exists (select 1 from pyqs where subject_id = s_sci and year = x.year and question_no = x.qno and question_text = x.q);

  insert into pyqs (subject_id, chapter_id, year, exam, question_no, question_text, marks, answer_text)
  select s_mat, ch_poly, 2022, 'CBSE Board Exam', 'Q2', 'If two zeroes of the polynomial x4 − 6x3 − 26x2 + 138x − 35 are 2 ± √3, find the other two zeroes. [DEMO]', 4,
    'Sum of the two given zeroes = 4, product = (2+√3)(2−√3) = 1. Let the other zeroes be a, b. Sum of all zeroes = 6 → a + b = 2. Product of all zeroes = −35 → ab = −35. Solving t² − 2t − 35 = 0 → t = 7 or −5. The other zeroes are 7 and −5.'
  where not exists (select 1 from pyqs where subject_id = s_mat and year = 2022 and question_no = 'Q2');

  insert into pyqs (subject_id, chapter_id, year, exam, question_no, question_text, marks, answer_text)
  select s_phy, ch_rayoptics, 2023, 'CBSE Board Exam', 'Q9', 'Derive the lens formula for a thin convex lens using the sign convention. [DEMO]', 5,
    'For a thin lens, using similar triangles in the ray diagram with the Cartesian sign convention: 1/v − 1/u = 1/f. Full derivation with object AB, image A''B'' and magnification m = v/u is expected.'
  where not exists (select 1 from pyqs where subject_id = s_phy and year = 2023 and question_no = 'Q9');

  -- Demo school ------------------------------------------------------------
  insert into schools (name, code, board_id, address, settings)
  values ('Demo Public School [DEMO]', 'DEMO100', b_cbse, 'Demo Road, Bhopal, Madhya Pradesh',
          '{"ranking_enabled": false, "retention_days": 90}'::jsonb)
  on conflict (code) do update set name = excluded.name
  returning id into sch;

  -- Demo school classes ------------------------------------------------------
  insert into school_classes (school_id, class_id, section, academic_year)
  values (sch, c10, 'A', '2026')
  on conflict (school_id, class_id, section, academic_year) do nothing
  returning id into sc10;
  if sc10 is null then
    select id into sc10 from school_classes where school_id = sch and class_id = c10 and section = 'A' limit 1;
  end if;

  insert into school_classes (school_id, class_id, section, academic_year)
  values (sch, c12, 'A', '2026')
  on conflict (school_id, class_id, section, academic_year) do nothing
  returning id into sc12;
  if sc12 is null then
    select id into sc12 from school_classes where school_id = sch and class_id = c12 and section = 'A' limit 1;
  end if;

  -- Subjects offered ---------------------------------------------------------
  insert into class_subjects (school_id, school_class_id, subject_id)
  values (sch, sc10, s_sci) on conflict (school_class_id, subject_id) do nothing;
  insert into class_subjects (school_id, school_class_id, subject_id)
  values (sch, sc10, s_mat) on conflict (school_class_id, subject_id) do nothing;
  insert into class_subjects (school_id, school_class_id, subject_id)
  values (sch, sc12, s_phy) on conflict (school_class_id, subject_id) do nothing;
end $$;

-- ============================================================================
-- End of demo seed. All rows above are [DEMO]-marked demo content.
-- ============================================================================
