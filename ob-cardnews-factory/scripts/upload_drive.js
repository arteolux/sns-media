import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

const manifestFile = process.argv[2];
if (!manifestFile) throw new Error('Usage: node scripts/upload_drive.js <manifest-json>');

const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const driveKey = process.env.GDRIVE_SA_KEY;
const parentFolderId = process.env.GDRIVE_PARENT_FOLDER_ID || null;

if (!driveKey) {
  const updated = {
    ...manifest,
    status: 'rendered',
    drive_folder_url: null,
    file_list: buildLocalFileList(manifest),
    upload_note: 'GDRIVE_SA_KEY is not set; files are available in the GitHub Actions artifact.'
  };
  fs.writeFileSync(manifestFile, JSON.stringify(updated, null, 2));
  console.log('SKIP_DRIVE_UPLOAD: GDRIVE_SA_KEY is not set');
  process.exit(0);
}

const auth = new google.auth.GoogleAuth({
  credentials: parseServiceAccountKey(driveKey),
  scopes: ['https://www.googleapis.com/auth/drive.file']
});
const drive = google.drive({ version: 'v3', auth });

const folderName = `${manifest.post_id}_${new Date().toISOString().slice(0, 10)}`;
const folder = await drive.files.create({
  requestBody: {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    ...(parentFolderId ? { parents: [parentFolderId] } : {})
  },
  fields: 'id, webViewLink'
});

const folderId = folder.data.id;
const folderUrl = folder.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`;
const fileList = [];

for (const target of buildUploadTargets(manifest, manifestFile)) {
  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) continue;

  const uploaded = await drive.files.create({
    requestBody: {
      name: path.basename(filePath),
      parents: [folderId]
    },
    media: {
      body: fs.createReadStream(filePath)
    },
    fields: 'id, name, mimeType, webViewLink, webContentLink'
  });

  fileList.push({
    name: uploaded.data.name,
    id: uploaded.data.id,
    mime_type: uploaded.data.mimeType,
    web_view_url: uploaded.data.webViewLink || null,
    download_url: uploaded.data.webContentLink || null
  });
}

const updated = {
  ...manifest,
  status: 'rendered',
  drive_folder_url: folderUrl,
  drive_folder_id: folderId,
  file_list: fileList
};

fs.writeFileSync(manifestFile, JSON.stringify(updated, null, 2));
console.log(`DRIVE_UPLOAD_OK: ${folderUrl}, files=${fileList.length}`);

function parseServiceAccountKey(value) {
  const trimmed = value.trim();
  const json = trimmed.startsWith('{')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf8');
  return JSON.parse(json);
}

function buildUploadTargets(currentManifest, currentManifestFile) {
  return [
    ...(currentManifest.images || []),
    currentManifest.contact_sheet,
    currentManifest.video,
    currentManifestFile
  ].filter(Boolean);
}

function buildLocalFileList(currentManifest) {
  return buildUploadTargets(currentManifest, manifestFile).map(filePath => ({
    name: path.basename(filePath),
    path: filePath,
    web_view_url: null,
    download_url: null
  }));
}
