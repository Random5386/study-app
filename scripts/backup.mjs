// Saves a full SQL backup of the local database into backups/ (git-ignored).
// Usage: npm run db:backup   (Postgres must be running: docker compose up -d)
// Restore (Git Bash):  docker compose exec -T db psql -U studyapp studyapp < backups/<file>.sql
// Restore (PowerShell): Get-Content backups\<file>.sql | docker compose exec -T db psql -U studyapp studyapp
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('backups', { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = `backups/studyapp-${stamp}.sql`;

const dump = execFileSync(
  'docker',
  ['compose', 'exec', '-T', 'db', 'pg_dump', '-U', 'studyapp', 'studyapp'],
  {
    maxBuffer: 512 * 1024 * 1024,
  },
);
writeFileSync(file, dump);
console.log(`Backup written to ${file}`);
