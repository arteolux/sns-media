import fs from 'fs';
import path from 'path';
import os from 'os';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { spawnSync } from 'child_process';

const jsonFile = process.argv[2];
if (!jsonFile) throw new Error('Usage: node scripts/make_video.js <json-file>');
const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
fs.mkdirSync('output/videos', { recursive: true });
fs.mkdirSync('output/manifests', { recursive: true });
const listPath = `output/videos/${data.post_id}_inputs.txt`;
const per = data.video?.per_card_seconds || 3;
const ctaHold = data.video?.cta_hold_seconds || 2;
let list = '';
for (const card of data.cards) {
  const f = `../images/${data.post_id}_card${String(card.card_no).padStart(2, '0')}.png`;
  list += `file '${f}'\n`;
  list += `duration ${card.card_no === data.cards.length ? per + ctaHold : per}\n`;
}
list += `file '../images/${data.post_id}_card${String(data.cards.length).padStart(2, '0')}.png'\n`;
fs.writeFileSync(listPath, list);
const out = `output/videos/${data.post_id}_shorts.mp4`;
const args = ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p', '-r', '30', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', out];
const ffmpeg = findFfmpeg();
const result = spawnSync(ffmpeg, args, { stdio: 'inherit' });
if (result.status !== 0) {
  console.error('FFmpeg failed. Install ffmpeg or run in GitHub Actions image with ffmpeg available.');
  process.exit(result.status || 1);
}
const manifest = {
  post_id: data.post_id,
  brand: data.brand,
  topic: data.topic,
  images: data.cards.map(c => `output/images/${data.post_id}_card${String(c.card_no).padStart(2, '0')}.png`),
  contact_sheet: `output/contact/${data.post_id}_contact_sheet.png`,
  video: out,
  captions: data.captions,
  hashtags: data.hashtags,
  generated_at: new Date().toISOString()
};
fs.writeFileSync(`output/manifests/${data.post_id}_manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`WROTE ${out}`);

function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  const candidates = [
    ffmpegInstaller.path,
    'ffmpeg',
    path.join(os.homedir(), 'AppData/Local/ms-playwright/ffmpeg-1011/ffmpeg-win64.exe')
  ];

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-version'], { stdio: 'ignore' });
    if (probe.status === 0) return candidate;
  }

  return 'ffmpeg';
}
