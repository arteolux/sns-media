import { execFileSync } from 'child_process';

const jsonFile = process.argv[2] || process.env.CONTENT_JSON || 'data/sample_fullup.json';

for (const script of ['validate_content.js', 'render_cards.js', 'contact_sheet.js', 'make_video.js']) {
  execFileSync('node', [`scripts/${script}`, jsonFile], { stdio: 'inherit' });
}
