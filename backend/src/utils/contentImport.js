const fs = require('fs');
const path = require('path');

// Imports a content pack (subjects, topics, objectives, notes, MCQs and
// structured questions) into the normalized schema. Records are linked by the
// pack's string `key` fields, and the import is idempotent: anything whose key
// already exists is left exactly as it is, so re-running it never overwrites
// review progress or edits made in the admin Content Review screen.

function normalizeName(name) {
  return name.toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
}

function loadContentPack(dir) {
  const read = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  return {
    subjects: read('subjects.json'),
    topics: read('topics.json'),
    objectives: read('objectives.json'),
    notes: read('notes.json'),
    questions: read('questions.json'),
  };
}

function findDuplicates(items) {
  const seen = new Set();
  const dupes = new Set();
  for (const item of items) {
    if (seen.has(item.key)) dupes.add(item.key);
    seen.add(item.key);
  }
  return [...dupes];
}

// Checks the whole pack before anything is written, so a malformed pack can
// never leave the database half-imported.
function validatePack(pack) {
  const errors = [];
  const subjectKeys = new Set(pack.subjects.map((s) => s.key));
  const topicKeys = new Set(pack.topics.map((t) => t.key));
  const objectiveKeys = new Set(pack.objectives.map((o) => o.key));

  for (const [label, items] of [
    ['subject', pack.subjects],
    ['topic', pack.topics],
    ['objective', pack.objectives],
    ['note', pack.notes],
    ['question', pack.questions],
  ]) {
    const dupes = findDuplicates(items);
    if (dupes.length) errors.push(`Duplicate ${label} keys: ${dupes.join(', ')}`);
  }

  for (const t of pack.topics) {
    if (!subjectKeys.has(t.subjectKey)) errors.push(`Topic ${t.key} refers to unknown subject ${t.subjectKey}`);
  }
  for (const o of pack.objectives) {
    if (!topicKeys.has(o.topicKey)) errors.push(`Objective ${o.key} refers to unknown topic ${o.topicKey}`);
  }
  for (const item of [...pack.notes, ...pack.questions]) {
    if (!subjectKeys.has(item.subjectKey)) errors.push(`${item.key} refers to unknown subject ${item.subjectKey}`);
    if (!topicKeys.has(item.topicKey)) errors.push(`${item.key} refers to unknown topic ${item.topicKey}`);
    for (const k of item.objectiveKeys ?? []) {
      if (!objectiveKeys.has(k)) errors.push(`${item.key} refers to unknown objective ${k}`);
    }
  }
  for (const q of pack.questions) {
    if (q.type === 'mcq') {
      if (!q.stem?.trim()) errors.push(`${q.key}: question text is empty`);
      if (!q.options?.some((o) => o.key === q.correctOption)) errors.push(`${q.key}: correctOption is not one of its options`);
      if (q.options?.some((o) => !o.text?.trim())) errors.push(`${q.key}: an option has no text`);
    } else if (q.type === 'structured') {
      if (!q.stem?.trim()) errors.push(`${q.key}: question stem is empty`);
      if (!q.parts?.length) errors.push(`${q.key}: structured question has no parts`);
      for (const p of q.parts ?? []) {
        if (!p.prompt?.trim()) errors.push(`${q.key}: a part has no prompt`);
        if (!p.markScheme?.trim()) errors.push(`${q.key}: a part has no mark scheme`);
        if (!Number.isInteger(p.marks) || p.marks < 1) errors.push(`${q.key}: a part has invalid marks`);
      }
    } else {
      errors.push(`${q.key}: unknown question type "${q.type}"`);
    }
  }
  for (const n of pack.notes) {
    if (!n.heading?.trim() || !n.bodyMarkdown?.trim()) errors.push(`${n.key}: note needs a heading and text`);
  }
  for (const t of pack.topics) {
    if (!t.name?.trim()) errors.push(`${t.key}: topic has no name`);
  }
  return errors;
}

// Anything the pack marks "approved" stays approved; everything else (the
// pack's "draft") starts as not reviewed and is hidden from students.
function reviewStatusFor(item) {
  return item.status === 'approved' ? 'approved' : 'not_reviewed';
}

function connectObjectives(keys) {
  return { connect: (keys ?? []).map((key) => ({ key })) };
}

function quizTitleFor(topicName) {
  return `${topicName}: Practice Quiz`;
}

async function importContentPack(prisma, pack, { curriculumName = 'BGCSE' } = {}) {
  const errors = validatePack(pack);
  if (errors.length) {
    throw new Error(`Content pack is invalid:\n- ${errors.slice(0, 20).join('\n- ')}`);
  }

  const curriculum = await prisma.curriculum.findUnique({ where: { name: curriculumName } });
  if (!curriculum) {
    throw new Error(`Curriculum "${curriculumName}" not found - run the seed first`);
  }

  const created = (n = 0) => ({ created: n, skipped: 0 });
  const stats = {
    subjects: created(),
    topics: created(),
    objectives: created(),
    notes: created(),
    quizzes: created(),
    mcqs: created(),
    structuredQuestions: created(),
    structuredParts: { created: 0 },
  };

  // --- Subjects: attach to the existing subject (by code, then by name with
  // "&" and "and" treated alike); only create one if there is no match.
  const dbSubjects = await prisma.subject.findMany({ where: { curriculumId: curriculum.id } });
  const subjectIdByKey = new Map();
  for (const s of pack.subjects) {
    const meta = {
      syllabusYear: s.syllabusYear ?? null,
      assessment: s.assessment ?? null,
      assessmentObjectives: JSON.stringify(s.assessmentObjectives ?? []),
    };
    let match =
      dbSubjects.find((d) => d.subjectCode && d.subjectCode === s.code) ??
      dbSubjects.find((d) => normalizeName(d.name) === normalizeName(s.name));
    if (match) {
      await prisma.subject.update({
        where: { id: match.id },
        data: { ...meta, subjectCode: match.subjectCode ?? s.code ?? null },
      });
      stats.subjects.skipped += 1;
    } else {
      match = await prisma.subject.create({
        data: { curriculumId: curriculum.id, name: s.name, subjectCode: s.code ?? null, ...meta },
      });
      stats.subjects.created += 1;
    }
    subjectIdByKey.set(s.key, match.id);
  }

  // --- Topics
  const existingTopics = await prisma.topic.findMany({ where: { key: { not: null } }, select: { id: true, key: true } });
  const topicIdByKey = new Map(existingTopics.map((t) => [t.key, t.id]));
  const sequenceBySubject = new Map();
  for (const t of pack.topics) {
    const sequenceOrder = sequenceBySubject.get(t.subjectKey) ?? 0;
    sequenceBySubject.set(t.subjectKey, sequenceOrder + 1);
    if (topicIdByKey.has(t.key)) {
      stats.topics.skipped += 1;
      continue;
    }
    const topic = await prisma.topic.create({
      data: {
        subjectId: subjectIdByKey.get(t.subjectKey),
        title: t.name,
        sequenceOrder,
        key: t.key,
        code: t.code ?? null,
        unitCode: t.unitCode ?? null,
        unitName: t.unitName ?? null,
      },
    });
    topicIdByKey.set(t.key, topic.id);
    stats.topics.created += 1;
  }

  // --- Objectives (bulk insert; they have no relations other than their topic)
  const existingObjectives = await prisma.objective.findMany({ select: { key: true } });
  const existingObjectiveKeys = new Set(existingObjectives.map((o) => o.key));
  const newObjectives = pack.objectives.filter((o) => !existingObjectiveKeys.has(o.key));
  stats.objectives.skipped = pack.objectives.length - newObjectives.length;
  for (let i = 0; i < newObjectives.length; i += 500) {
    const chunk = newObjectives.slice(i, i + 500).map((o) => ({
      key: o.key,
      topicId: topicIdByKey.get(o.topicKey),
      syllabusCode: o.syllabusCode ?? null,
      text: o.text,
      order: o.order ?? 0,
    }));
    await prisma.objective.createMany({ data: chunk });
    stats.objectives.created += chunk.length;
  }

  // --- Notes
  const existingNotes = await prisma.topicNote.findMany({ select: { key: true } });
  const existingNoteKeys = new Set(existingNotes.map((n) => n.key));
  for (const n of pack.notes) {
    if (existingNoteKeys.has(n.key)) {
      stats.notes.skipped += 1;
      continue;
    }
    await prisma.topicNote.create({
      data: {
        key: n.key,
        subjectId: subjectIdByKey.get(n.subjectKey),
        topicId: topicIdByKey.get(n.topicKey),
        heading: n.heading,
        bodyMarkdown: n.bodyMarkdown,
        order: n.order ?? 0,
        reviewStatus: reviewStatusFor(n),
        objectives: connectObjectives(n.objectiveKeys),
      },
    });
    stats.notes.created += 1;
  }

  // --- MCQs become one practice quiz per topic
  const topicNameByKey = new Map(pack.topics.map((t) => [t.key, t.name]));
  const mcqsByTopic = new Map();
  for (const q of pack.questions.filter((x) => x.type === 'mcq')) {
    if (!mcqsByTopic.has(q.topicKey)) mcqsByTopic.set(q.topicKey, []);
    mcqsByTopic.get(q.topicKey).push(q);
  }
  const existingQuestions = await prisma.question.findMany({ where: { key: { not: null } }, select: { key: true } });
  const existingQuestionKeys = new Set(existingQuestions.map((q) => q.key));

  for (const [topicKey, mcqs] of mcqsByTopic) {
    const subjectId = subjectIdByKey.get(mcqs[0].subjectKey);
    const topicId = topicIdByKey.get(topicKey);
    const title = quizTitleFor(topicNameByKey.get(topicKey));

    let quiz = await prisma.quiz.findFirst({ where: { subjectId, topicId, title } });
    if (!quiz) {
      quiz = await prisma.quiz.create({ data: { subjectId, topicId, title, totalMarks: 0 } });
      stats.quizzes.created += 1;
    } else {
      stats.quizzes.skipped += 1;
    }

    for (const [index, q] of mcqs.entries()) {
      if (existingQuestionKeys.has(q.key)) {
        stats.mcqs.skipped += 1;
        continue;
      }
      await prisma.question.create({
        data: {
          quizId: quiz.id,
          key: q.key,
          questionText: q.stem,
          questionType: 'multiple_choice',
          explanation: q.explanation ?? null,
          marks: q.marks ?? 1,
          order: index,
          difficulty: q.difficulty ?? null,
          assessmentObjective: q.assessmentObjective ?? null,
          source: q.source ?? null,
          reviewStatus: reviewStatusFor(q),
          options: {
            create: q.options.map((o, i) => ({ optionText: o.text, isCorrect: o.key === q.correctOption, order: i })),
          },
          objectives: connectObjectives(q.objectiveKeys),
        },
      });
      stats.mcqs.created += 1;
    }

    const { _sum } = await prisma.question.aggregate({ where: { quizId: quiz.id }, _sum: { marks: true } });
    await prisma.quiz.update({ where: { id: quiz.id }, data: { totalMarks: _sum.marks ?? 0 } });
  }

  // --- Structured questions (parts carry the review status)
  const existingStructured = await prisma.structuredQuestion.findMany({ select: { key: true } });
  const existingStructuredKeys = new Set(existingStructured.map((q) => q.key));
  for (const q of pack.questions.filter((x) => x.type === 'structured')) {
    if (existingStructuredKeys.has(q.key)) {
      stats.structuredQuestions.skipped += 1;
      continue;
    }
    await prisma.structuredQuestion.create({
      data: {
        key: q.key,
        subjectId: subjectIdByKey.get(q.subjectKey),
        topicId: topicIdByKey.get(q.topicKey),
        paperStyle: q.paperStyle ?? null,
        assessmentObjective: q.assessmentObjective ?? null,
        totalMarks: q.totalMarks ?? q.parts.reduce((sum, p) => sum + p.marks, 0),
        stem: q.stem,
        source: q.source ?? null,
        parts: {
          create: q.parts.map((p, i) => ({
            label: p.label || null,
            prompt: p.prompt,
            marks: p.marks,
            markScheme: p.markScheme,
            order: i,
            reviewStatus: reviewStatusFor(q),
          })),
        },
        objectives: connectObjectives(q.objectiveKeys),
      },
    });
    stats.structuredQuestions.created += 1;
    stats.structuredParts.created += q.parts.length;
  }

  return stats;
}

module.exports = { loadContentPack, validatePack, importContentPack, normalizeName };
