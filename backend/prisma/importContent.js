// Usage: npm run import:content [-- <directory> [curriculum]]
// Imports a content pack (default: prisma/content/bgcse into BGCSE). Safe to
// re-run: existing items are skipped, so review progress is never overwritten.
require('dotenv').config();
const path = require('path');
const prisma = require('../src/db');
const { loadContentPack, importContentPack } = require('../src/utils/contentImport');

async function main() {
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'content', 'bgcse');
  const curriculumName = process.argv[3] ?? 'BGCSE';

  console.log(`Importing content from ${dir} into ${curriculumName}...`);
  const stats = await importContentPack(prisma, loadContentPack(dir), { curriculumName });

  for (const [label, s] of Object.entries(stats)) {
    const skipped = s.skipped === undefined ? '' : `, ${s.skipped} already present`;
    console.log(`  ${label.padEnd(20)} ${s.created} created${skipped}`);
  }
  console.log('Done. Imported items start as "not reviewed" and stay hidden from students until approved.');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
