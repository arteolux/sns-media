import fs from 'fs';

const callbackUrl = process.env.MAKE_CALLBACK_URL;
if (!callbackUrl) {
  console.log('SKIP_CALLBACK: MAKE_CALLBACK_URL is not set');
  process.exit(0);
}

const manifestFile = process.argv[2];
if (!manifestFile) throw new Error('Usage: node scripts/callback_make.js <manifest-json>');

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const runUrl = process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null;

const payload = {
  post_id: manifest.post_id,
  status: manifest.status || 'rendered',
  drive_folder_url: manifest.drive_folder_url || null,
  drive_folder_id: manifest.drive_folder_id || null,
  file_list: manifest.file_list || [],
  manifest,
  github: {
    repository: process.env.GITHUB_REPOSITORY || null,
    run_id: process.env.GITHUB_RUN_ID || null,
    run_url: runUrl,
    artifact_note: manifest.drive_folder_url ? null : 'Drive upload was skipped or unavailable; use the GitHub Actions artifact.'
  }
};

const response = await fetch(callbackUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`MAKE_CALLBACK_FAILED: ${response.status} ${body}`);
}

console.log(`MAKE_CALLBACK_OK: ${response.status}`);
