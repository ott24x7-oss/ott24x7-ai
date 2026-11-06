import fs from 'node:fs'
import path from 'node:path'

export const STARTUP_BACKUP_DIR = 'AutoBackups'
export const STARTUP_BACKUP_KEEP = 5

/**
 * Copies the SQLite file and its WAL/SHM side files before the connection opens,
 * keeping the newest {@link STARTUP_BACKUP_KEEP} copies next to the database.
 * Returns the backup folder, or null when there was nothing to back up.
 */
export function backupDatabaseOnStartup(dbPath: string, now: Date = new Date()): string | null {
  if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) return null

  const root = path.join(path.dirname(dbPath), STARTUP_BACKUP_DIR)
  const target = path.join(root, now.toISOString().replace(/[:.]/g, '-'))
  fs.mkdirSync(target, { recursive: true })
  for (const suffix of ['', '-wal', '-shm']) {
    const source = dbPath + suffix
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(target, path.basename(source)))
  }

  const stale = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse()
    .slice(STARTUP_BACKUP_KEEP)
  for (const name of stale) fs.rmSync(path.join(root, name), { recursive: true, force: true })
  return target
}
