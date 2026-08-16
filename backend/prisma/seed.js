const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// --- Curricula, levels and subjects, grouped by category as published in the
// Study Dome curricula breakdown. `content: 'kind'` marks the subjects that
// get full topics/quizzes/past-papers seeded; the rest exist with no content
// yet (the UI shows "No quizzes/past papers available yet" for those).
const CURRICULA = [
  {
    name: 'JC',
    description: 'Junior Certificate',
    levels: ['Junior'],
    groups: [
      {
        category: 'Core',
        subjects: [
          { name: 'Mathematics', content: 'MATH' },
          { name: 'English Language', content: 'ENGLISH' },
          { name: 'Setswana' },
          { name: 'Integrated Science', content: 'SCIENCE' },
          { name: 'Social Studies' },
        ],
      },
      {
        category: 'Elective',
        subjects: [
          { name: 'Agriculture' },
          { name: 'Design & Technology' },
          { name: 'Home Economics' },
          { name: 'Business Studies' },
          { name: 'Religious & Moral Education' },
          { name: 'Art' },
          { name: 'Music' },
        ],
      },
    ],
  },
  {
    name: 'BGCSE',
    description: 'Botswana General Certificate of Secondary Education',
    levels: ['Senior High'],
    groups: [
      {
        category: 'Core',
        subjects: [
          { name: 'English Language', content: 'ENGLISH' },
          { name: 'Setswana' },
          { name: 'Mathematics', content: 'MATH' },
        ],
      },
      {
        category: 'Sciences',
        subjects: [
          { name: 'Single Science' },
          { name: 'Double Science (Coordinated Science)', content: 'SCIENCE' },
          { name: 'Chemistry' },
          { name: 'Physics' },
          { name: 'Biology' },
        ],
      },
      {
        category: 'Humanities & Social Sciences',
        subjects: [
          { name: 'History' },
          { name: 'Geography' },
          { name: 'Development Studies' },
          { name: 'Social Studies' },
          { name: 'Religious Education' },
        ],
      },
      {
        category: 'Commercial & Vocational',
        subjects: [
          { name: 'Commerce' },
          { name: 'Accounting' },
          { name: 'Business Studies' },
          { name: 'Computer Studies' },
          { name: 'Agriculture' },
          { name: 'Design & Technology' },
          { name: 'Home Economics' },
          { name: 'Art & Design' },
        ],
      },
    ],
  },
  {
    name: 'IGCSE',
    description: 'Cambridge IGCSE',
    levels: ['Core', 'Extended'],
    groups: [
      {
        category: 'Languages',
        subjects: [
          { name: 'English - First Language', code: '0500', content: 'ENGLISH' },
          { name: 'English - Second Language', code: '0510' },
          { name: 'French', code: '0520' },
          { name: 'Spanish', code: '0530' },
          { name: 'German', code: '0525' },
        ],
      },
      {
        category: 'STEM',
        subjects: [
          { name: 'Mathematics (Core & Extended)', code: '0580', content: 'MATH' },
          { name: 'Additional Mathematics', code: '0606' },
          { name: 'Physics', code: '0625' },
          { name: 'Chemistry', code: '0620' },
          { name: 'Biology', code: '0610', content: 'SCIENCE' },
          { name: 'Computer Science', code: '0478' },
          { name: 'Information & Communication Technology', code: '0417' },
        ],
      },
      {
        category: 'Humanities & Business',
        subjects: [
          { name: 'Economics', code: '0455' },
          { name: 'Business Studies', code: '0450' },
          { name: 'Accounting', code: '0452' },
          { name: 'Geography', code: '0460' },
          { name: 'History', code: '0470' },
          { name: 'Global Perspectives', code: '0457' },
        ],
      },
    ],
  },
  {
    name: 'A-Levels',
    description: 'AS & A-Levels',
    levels: ['AS-Level', 'A2-Level'],
    groups: [
      {
        category: 'Mathematics & Computer Science',
        subjects: [
          { name: 'Mathematics (Pure, Mechanics, Statistics)', content: 'MATH' },
          { name: 'Further Mathematics' },
          { name: 'Computer Science' },
        ],
      },
      {
        category: 'Sciences',
        subjects: [
          { name: 'Physics' },
          { name: 'Chemistry' },
          { name: 'Biology', content: 'SCIENCE' },
        ],
      },
      {
        category: 'Humanities & Business',
        subjects: [
          { name: 'Economics' },
          { name: 'Business Studies' },
          { name: 'Accounting' },
          { name: 'Geography' },
          { name: 'Psychology' },
          { name: 'Sociology' },
        ],
      },
    ],
  },
  {
    name: 'IB',
    description: 'International Baccalaureate',
    levels: ['HL', 'SL'],
    groups: [
      { category: 'Group 1: Language & Literature', subjects: [{ name: 'Language A: Literature', content: 'ENGLISH' }] },
      { category: 'Group 2: Language Acquisition', subjects: [{ name: 'Language B (Language Acquisition)' }] },
      {
        category: 'Group 3: Individuals & Societies',
        subjects: [{ name: 'Economics' }, { name: 'History' }, { name: 'Business Management' }],
      },
      {
        category: 'Group 4: Sciences',
        subjects: [{ name: 'Physics' }, { name: 'Chemistry' }, { name: 'Biology', content: 'SCIENCE' }],
      },
      {
        category: 'Group 5: Mathematics',
        subjects: [
          { name: 'Mathematics: Analysis & Approaches', content: 'MATH' },
          { name: 'Mathematics: Applications & Interpretation' },
        ],
      },
      { category: 'Group 6: Arts', subjects: [{ name: 'Visual Arts' }, { name: 'Music' }, { name: 'Theatre' }] },
    ],
  },
  {
    name: 'IEB',
    description: 'Independent Examinations Board (NSC-aligned)',
    levels: [],
    groups: [
      {
        category: 'NSC-Aligned',
        subjects: [
          { name: 'Mathematics', content: 'MATH' },
          { name: 'Mathematical Literacy' },
          { name: 'Physical Sciences', content: 'SCIENCE' },
          { name: 'Life Sciences' },
          { name: 'Accounting' },
          { name: 'Business Studies' },
          { name: 'English Home Language', content: 'ENGLISH' },
        ],
      },
    ],
  },
];

// --- Question banks, keyed by subject "kind". Each fully-seeded subject gets
// one mixed-type practice quiz drawing from all three question types, showing
// off the per-question `questionType` the normalized schema now supports.
const BANKS = {
  MATH: {
    topics: ['Algebra', 'Geometry & Measurement'],
    mcq: [
      { text: 'What is 7 x 8?', options: ['54', '56', '58', '64'], correct: '56', explanation: '7 x 8 = 56 (7 x 7 = 49, plus one more 7 is 56).' },
      { text: 'Solve for x: 2x + 4 = 12', options: ['2', '4', '6', '8'], correct: '4', explanation: 'Subtract 4 from both sides: 2x = 8, then divide by 2: x = 4.' },
      { text: 'What is the value of pi rounded to 2 decimal places?', options: ['3.12', '3.14', '3.16', '3.18'], correct: '3.14', explanation: 'Pi is approximately 3.14159..., which rounds to 3.14.' },
      { text: 'What is the square root of 144?', options: ['10', '11', '12', '13'], correct: '12', explanation: '12 x 12 = 144, so the square root of 144 is 12.' },
    ],
    short: [
      { text: 'What is the sum of the interior angles of a triangle (in degrees)?', correct: '180', explanation: 'The interior angles of any triangle always add up to 180 degrees.' },
      { text: 'Simplify: 3/6', correct: '1/2', explanation: 'Divide numerator and denominator by their greatest common factor, 3: 3/6 = 1/2.' },
      { text: 'What is 15% of 200?', correct: '30', explanation: '15% of 200 = 0.15 x 200 = 30.' },
    ],
    tf: [
      { text: 'A prime number has exactly two factors: 1 and itself.', correct: true, explanation: 'That is the definition of a prime number.' },
      { text: 'The sum of angles in a quadrilateral is 180 degrees.', correct: false, explanation: 'A quadrilateral’s angles sum to 360 degrees, not 180 (that’s a triangle).' },
    ],
  },
  SCIENCE: {
    topics: ['Cells & Life Processes', 'Forces & Energy'],
    mcq: [
      { text: 'What is the chemical symbol for water?', options: ['O2', 'H2O', 'CO2', 'NaCl'], correct: 'H2O', explanation: 'Water is two hydrogen atoms bonded to one oxygen atom: H2O.' },
      { text: 'Which organ pumps blood around the body?', options: ['Lungs', 'Liver', 'Heart', 'Kidney'], correct: 'Heart', explanation: 'The heart is a muscular pump that circulates blood through the body.' },
      { text: 'What force pulls objects toward the Earth?', options: ['Magnetism', 'Gravity', 'Friction', 'Tension'], correct: 'Gravity', explanation: 'Gravity is the attractive force between masses, pulling objects toward Earth’s center.' },
      { text: 'What gas do plants absorb from the atmosphere for photosynthesis?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correct: 'Carbon dioxide', explanation: 'Plants take in carbon dioxide and, using sunlight, convert it into glucose and oxygen.' },
    ],
    short: [
      { text: 'What is the powerhouse of the cell called?', correct: 'Mitochondria', explanation: 'Mitochondria produce most of the cell’s ATP (energy) through respiration.' },
      { text: 'What planet is known as the Red Planet?', correct: 'Mars', explanation: 'Mars appears red due to iron oxide (rust) covering its surface.' },
      { text: 'What is the boiling point of water in Celsius?', correct: '100', explanation: 'At standard atmospheric pressure, water boils at 100°C.' },
    ],
    tf: [
      { text: 'Humans have four lungs.', correct: false, explanation: 'Humans have two lungs, a left and a right.' },
      { text: 'Sound travels faster in air than in water.', correct: false, explanation: 'Sound actually travels faster in water than in air, since water is denser.' },
    ],
  },
  ENGLISH: {
    topics: ['Grammar & Vocabulary', 'Reading Comprehension'],
    mcq: [
      { text: 'Which word is a synonym for "happy"?', options: ['Sad', 'Joyful', 'Angry', 'Tired'], correct: 'Joyful', explanation: '"Joyful" shares the same positive meaning as "happy".' },
      { text: 'Identify the noun in: "The dog ran quickly."', options: ['The', 'Dog', 'Ran', 'Quickly'], correct: 'Dog', explanation: '"Dog" names a thing (an animal), which makes it the noun in the sentence.' },
      { text: 'Which of these is a past-tense verb?', options: ['Run', 'Running', 'Ran', 'Runs'], correct: 'Ran', explanation: '"Ran" is the simple past tense of "run".' },
    ],
    short: [
      { text: 'Name the literary device where human traits are given to animals or objects.', correct: 'Personification', explanation: 'Personification gives human qualities to non-human things, e.g. "the wind whispered".' },
      { text: 'What punctuation mark ends a question?', correct: '?', explanation: 'A question mark (?) is used at the end of a direct question.' },
    ],
    tf: [
      { text: 'A metaphor uses "like" or "as" to compare two things.', correct: false, explanation: 'That describes a simile. A metaphor states one thing IS another, without "like" or "as".' },
      { text: 'A noun is a word that names a person, place or thing.', correct: true, explanation: 'That is the standard definition of a noun.' },
    ],
  },
};

async function seedFullSubject(subject, kind) {
  const bank = BANKS[kind];

  const topics = [];
  for (const [i, title] of bank.topics.entries()) {
    topics.push(
      await prisma.topic.create({
        data: { subjectId: subject.id, title, sequenceOrder: i },
      })
    );
  }

  let order = 0;
  const questionsData = [];

  for (const q of bank.mcq) {
    questionsData.push({
      questionText: q.text,
      questionType: 'multiple_choice',
      explanation: q.explanation ?? null,
      marks: 1,
      order: order++,
      options: { create: q.options.map((opt) => ({ optionText: opt, isCorrect: opt === q.correct })) },
    });
  }
  for (const q of bank.short) {
    questionsData.push({
      questionText: q.text,
      questionType: 'short_answer',
      explanation: q.explanation ?? null,
      marks: 2,
      order: order++,
      options: { create: [{ optionText: q.correct, isCorrect: true }] },
    });
  }
  for (const q of bank.tf) {
    questionsData.push({
      questionText: q.text,
      questionType: 'true_false',
      explanation: q.explanation ?? null,
      marks: 1,
      order: order++,
      options: {
        create: [
          { optionText: 'True', isCorrect: q.correct === true },
          { optionText: 'False', isCorrect: q.correct === false },
        ],
      },
    });
  }

  const totalMarks = questionsData.reduce((sum, q) => sum + q.marks, 0);

  await prisma.quiz.create({
    data: {
      subjectId: subject.id,
      topicId: topics[0]?.id,
      title: `${subject.name} Practice Quiz`,
      totalMarks,
      timeLimitMinutes: 20,
      questions: { create: questionsData },
    },
  });

  await prisma.pastPaper.create({
    data: {
      subjectId: subject.id,
      year: 2024,
      season: 'Oct/Nov',
      paperNumber: 1,
      variant: 1,
      title: `${subject.name} 2024 Paper 1`,
      fileUrl: 'https://example.com/past-papers/placeholder-exam.pdf',
      markingSchemeUrl: 'https://example.com/past-papers/placeholder-marking-scheme.pdf',
    },
  });
  await prisma.pastPaper.create({
    data: {
      subjectId: subject.id,
      year: 2023,
      season: 'May/June',
      paperNumber: 1,
      variant: 2,
      title: `${subject.name} 2023 Paper 1`,
      fileUrl: 'https://example.com/past-papers/placeholder-exam.pdf',
      markingSchemeUrl: null,
    },
  });
}

async function main() {
  console.log('Seeding curricula, levels, subjects, topics, quizzes and past papers...');

  for (const c of CURRICULA) {
    const curriculum = await prisma.curriculum.upsert({
      where: { name: c.name },
      update: { description: c.description },
      create: { name: c.name, description: c.description },
    });

    for (const levelName of c.levels) {
      await prisma.level.upsert({
        where: { curriculumId_name: { curriculumId: curriculum.id, name: levelName } },
        update: {},
        create: { curriculumId: curriculum.id, name: levelName },
      });
    }

    for (const group of c.groups) {
      for (const s of group.subjects) {
        const subject = await prisma.subject.upsert({
          where: { curriculumId_name: { curriculumId: curriculum.id, name: s.name } },
          update: { category: group.category, subjectCode: s.code ?? null },
          create: {
            curriculumId: curriculum.id,
            name: s.name,
            category: group.category,
            subjectCode: s.code ?? null,
          },
        });

        if (s.content) {
          await seedFullSubject(subject, s.content);
        }
      }
    }
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
