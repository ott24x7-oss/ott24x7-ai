import fs from 'node:fs'
import path from 'node:path'

import Database from 'better-sqlite3'

export const STARTUP_BACKUP_DIR = 'AutoBackups'
export const REPLACED_DATABASE_DIR = 'ReplacedDatabases'
export const STARTUP_BACKUP_KEEP = 5

const SIDE_FILES = ['', '-wal', '-shm'] as const

export interface DatabaseStats {
  ok: boolean
  /** Providers that hold at least one API key. */
  keyed: number
  messages: number
}

export type StartupGuardResult =
  | { action: 'none' }
  | { action: 'ok'; backup: string }
  | { action: 'recovered'; source: string; replaced: string }
  | { action: 'unrecoverable'; replaced: string }

const BROKEN: DatabaseStats = { ok: false, keyed: 0, messages: 0 }

function hasData(stats: DatabaseStats): boolean {
  return stats.ok && (stats.keyed > 0 || stats.messages > 0)
}

/** Live DB lost its keys (and no new chats) compared to the last good launch — the reset symptom. */
function lostData(live: DatabaseStats, previous: DatabaseStats): boolean {
  return live.keyed === 0 && previous.keyed > 0 && live.messages <= previous.messages
}

function count(db: Database.Database, sql: string): number {
  try {
    return Number((db.prepare(sql).get() as { n: number }).n) || 0
  } catch {
    return 0
  }
}

/** Opens a database copy (never the live file) and reports whether it is intact and holds user data. */
export function inspectDatabase(file: string): DatabaseStats {
  let db: Database.Database | undefined
  try {
    db = new Database(file, { fileMustExist: true })
    const ok = db.pragma('quick_check', { simple: true }) === 'ok'
    return {
      ok,
      keyed: count(
        db,
        "SELECT count(*) AS n FROM user_provider WHERE api_keys IS NOT NULL AND api_keys NOT IN ('', '[]')"
      ),
      messages: count(db, 'SELECT count(*) AS n FROM message')
    }
  } catch {
    return BROKEN
  } finally {
    try {
      db?.close()
    } catch {
      // a corrupt copy may fail to close; it is only a scratch copy
    }
  }
}

function copyDatabase(dbPath: string, targetDir: string, suffixes: readonly string[] = SIDE_FILES): string {
  fs.mkdirSync(targetDir, { recursive: true })
  for (const suffix of suffixes) {
    const source = dbPath + suffix
    if (fs.existsSync(source)) fs.copyFileSync(source, path.join(targetDir, path.basename(source)))
  }
  return path.join(targetDir, path.basename(dbPath))
}

function listBackups(root: string): string[] {
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse()
}

function prune(root: string): void {
  for (const name of listBackups(root).slice(STARTUP_BACKUP_KEEP)) {
    fs.rmSync(path.join(root, name), { recursive: true, force: true })
  }
}

/**
 * Runs before the connection opens. Keeps a rolling copy of every healthy launch, and when the
 * live database is corrupt, missing, or came up without the user's keys, moves it aside and puts
 * back the newest intact copy (the live main file without its WAL first, then the backups).
 */
export function guardDatabaseOnStartup(
  dbPath: string,
  now: Date = new Date(),
  inspect: (file: string) => DatabaseStats = inspectDatabase
): StartupGuardResult {
  const dataDir = path.dirname(dbPath)
  const root = path.join(dataDir, STARTUP_BACKUP_DIR)
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const liveExists = fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0
  const backups = listBackups(root)

  if (!liveExists && backups.length === 0) return { action: 'none' }

  const snapshotDir = path.join(root, stamp)
  const live = liveExists ? inspect(copyDatabase(dbPath, snapshotDir)) : BROKEN
  const previous = backups.map((name) => ({ name, stats: inspect(path.join(root, name, path.basename(dbPath))) }))
  const lastGood = previous.find((entry) => hasData(entry.stats))

  if (live.ok && !(lastGood && lostData(live, lastGood.stats))) {
    if (!hasData(live)) {
      // An empty launch must never rotate out a backup that holds real data.
      fs.rmSync(snapshotDir, { recursive: true, force: true })
      return { action: 'ok', backup: '' }
    }
    prune(root)
    return { action: 'ok', backup: snapshotDir }
  }

  // Keep the bad state for support, outside the rotation.
  const replaced = path.join(dataDir, REPLACED_DATABASE_DIR, stamp)
  if (fs.existsSync(snapshotDir)) {
    fs.mkdirSync(path.dirname(replaced), { recursive: true })
    fs.renameSync(snapshotDir, replaced)
  } else {
    copyDatabase(dbPath, replaced)
  }

  const candidates: string[] = []
  if (liveExists && fs.existsSync(`${dbPath}-wal`)) {
    candidates.push(copyDatabase(dbPath, path.join(replaced, 'main-only'), ['']))
  }
  for (const entry of previous) {
    if (hasData(entry.stats)) candidates.push(path.join(root, entry.name, path.basename(dbPath)))
  }

  for (const candidate of candidates) {
    const stats = inspect(candidate)
    if (!hasData(stats) || (lastGood && lostData(stats, lastGood.stats))) continue
    for (const suffix of SIDE_FILES) fs.rmSync(dbPath + suffix, { force: true })
    fs.copyFileSync(candidate, dbPath)
    // inspect() checkpointed the candidate into its main file; carry any leftover WAL with it.
    if (fs.existsSync(`${candidate}-wal`)) fs.copyFileSync(`${candidate}-wal`, `${dbPath}-wal`)
    return { action: 'recovered', source: candidate, replaced }
  }
  return { action: 'unrecoverable', replaced }
}
