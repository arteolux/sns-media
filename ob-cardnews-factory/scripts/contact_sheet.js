import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const jsonFile = process.argv[2];
if (!jsonFile) throw new Error('Usage: node scripts/contact_sheet.js <json-file>');
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
const files = data.cards.map(card => path.resolve('output/images', `${data.post_id}_card${String(card.card_no).padStart(2, '0')}.png`));
const thumbs = await Promise.all(files.map(file => sharp(file).resize({ width: 270, height: 480 }).png().toBuffer()));
const width = 270 * files.length;
const height = 480;
const composite = thumbs.map((input, i) => ({ input, left: i * 270, top: 0 }));
fs.mkdirSync('output/contact', { recursive: true });
await sharp({ create: { width, height, channels: 4, background: '#ffffff' } })
  .composite(composite)
  .png()
  .toFile(`output/contact/${data.post_id}_contact_sheet.png`);
console.log(`WROTE output/contact/${data.post_id}_contact_sheet.png`);
