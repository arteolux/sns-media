import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import Handlebars from 'handlebars';
import { execFileSync } from 'child_process';

const jsonFile = process.argv[2];
if (!jsonFile) throw new Error('Usage: node scripts/render_cards.js <json-file>');

execFileSync('node', ['scripts/validate_content.js', jsonFile], { stdio: 'inherit' });

const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
const templatePath = path.resolve('templates/fullup_info.html');
const template = Handlebars.compile(fs.readFileSync(templatePath, 'utf8'));
const css = fs.readFileSync(path.resolve('templates/shared/base.css'), 'utf8');
const outDir = path.resolve('output/images');
fs.mkdirSync(outDir, { recursive: true });

const labels = {
  cover: 'SKIN SCALP NOTE',
  problem: 'SYMPTOM',
  cause: 'WHY IT HAPPENS',
  checklist: 'CHECKLIST',
  solution: 'ROUTINE',
  product: 'FULL-UP CARE',
  cta: 'SAVE THIS'
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });

for (const card of data.cards) {
  const html = template({
    css,
    card_class: `type-${card.type || 'info'}`,
    topic: data.topic,
    type_label: labels[card.type] || card.type || 'INFO',
    headline: card.headline,
    body: card.body,
    card_no: String(card.card_no).padStart(2, '0'),
    card_count: data.cards.length
  });
  await page.setContent(html, { waitUntil: 'networkidle' });
  const out = path.join(outDir, `${data.post_id}_card${String(card.card_no).padStart(2, '0')}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`WROTE ${out}`);
}

await browser.close();
