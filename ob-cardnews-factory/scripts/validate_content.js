import fs from 'fs';

const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/validate_content.js <json-file>');

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const banned = ['머리 난다', '탈모 치료', '탈모 방지', '모발 재생', '100% 개선', '무조건 효과', '질환 치료'];

function fail(msg) {
  console.error(`VALIDATION_FAILED: ${msg}`);
  process.exit(1);
}

if (!data.post_id) fail('post_id is required');
if (!data.brand) fail('brand is required');
if (data.format !== '1080x1920') fail('format must be 1080x1920');
if (!data.compliance_check || data.compliance_check.passed !== true) fail('compliance_check.passed must be true');
if (!Array.isArray(data.cards) || data.cards.length < 6 || data.cards.length > 8) fail('cards must contain 6-8 items');

for (const card of data.cards) {
  if (!card.card_no || !card.headline || !card.body) fail(`card ${card.card_no || '?'} missing fields`);
}

const fullText = JSON.stringify(data, null, 2);
const found = banned.filter(term => fullText.includes(term));
if (found.length) fail(`banned terms found: ${found.join(', ')}`);

console.log(`VALIDATION_OK: ${data.post_id}, cards=${data.cards.length}`);
