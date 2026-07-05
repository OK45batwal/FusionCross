const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_RELEASES = 'https://github.com/anomalyco/fusionwine/releases';
const DOWNLOAD_VERSION = '1.0.0';

app.use(express.static(path.join(__dirname, 'public')));

// Analytics
const DB_PATH = path.join(__dirname, 'data', 'visits.json');
function getVisits() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return { count: 0 }; }
}
function saveVisits(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data));
}

app.post('/api/visit', (req, res) => {
  const data = getVisits();
  data.count += 1;
  saveVisits(data);
  res.json({ count: data.count });
});

app.get('/api/visits', (req, res) => {
  res.json(getVisits());
});

// Download counters
const DL_PATH = path.join(__dirname, 'data', 'downloads.json');
function getDownloads() {
  try { return JSON.parse(fs.readFileSync(DL_PATH, 'utf8')); }
  catch { return { arm64: 0, x64: 0 }; }
}
function saveDownloads(data) {
  fs.writeFileSync(DL_PATH, JSON.stringify(data));
}

app.get('/api/downloads', (req, res) => {
  res.json(getDownloads());
});

// Redirect to actual GitHub release download
app.get('/download/:arch', (req, res) => {
  const arch = req.params.arch;
  if (arch !== 'arm64' && arch !== 'x64') return res.redirect(GITHUB_RELEASES);

  const data = getDownloads();
  if (arch === 'arm64') data.arm64 += 1;
  else data.x64 += 1;
  saveDownloads(data);

  const filename = `FusionCross-${DOWNLOAD_VERSION}-${arch}.dmg`;
  res.redirect(`${GITHUB_RELEASES}/download/v${DOWNLOAD_VERSION}/${filename}`);
});

// Release notes API
app.get('/api/releases', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'changelog.json'), 'utf8'));
    res.json(data);
  } catch { res.json([]); }
});

app.get('/releases', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'releases.html'));
});

app.listen(PORT, () => {
  console.log(`FusionCross website running at http://localhost:${PORT}`);
});
