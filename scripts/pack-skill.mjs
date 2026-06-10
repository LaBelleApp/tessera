// pack-skill.mjs — bundle each skill under skills/<name>/ (any folder with a SKILL.md)
// into skills/<name>.skill, the zip Cowork installs via "Save skill".
// Run after editing a skill so the bundle never goes stale:  npm run pack-skill
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const skillsDir = path.join(ROOT, 'skills');

try { execSync('command -v zip', { stdio: 'ignore' }); }
catch { console.error('`zip` is not installed. Install it (macOS ships it; on Linux: apt-get install zip).'); process.exit(1); }

const dirs = fs.existsSync(skillsDir)
  ? fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')))
  : [];

if (!dirs.length) { console.log('No skills with a SKILL.md found under skills/.'); process.exit(0); }

for (const d of dirs) {
  const src = path.join(skillsDir, d.name);
  const out = path.join(skillsDir, `${d.name}.skill`);
  const tmp = path.join(os.tmpdir(), `${d.name}-${Date.now()}.skill`);
  // zip the folder CONTENTS (SKILL.md at archive root), excluding junk
  execSync(`cd ${JSON.stringify(src)} && zip -rq ${JSON.stringify(tmp)} . -x '.DS_Store' '*/.DS_Store' '*.skill'`);
  fs.copyFileSync(tmp, out);          // overwrite in place (avoids unlink-permission quirks)
  fs.rmSync(tmp, { force: true });
  console.log(`packed ${d.name} → skills/${d.name}.skill`);
}
