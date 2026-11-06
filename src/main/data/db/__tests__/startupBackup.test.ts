import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { backupDatabaseOnStartup, STARTUP_BACKUP_DIR, STARTUP_BACKUP_KEEP } from '../startupBackup'

describe('backupDatabaseOnStartup', () => {
  let dir: string
  let dbPath: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startup-backup-'))
    dbPath = path.join(dir, 'cherrystudio.sqlite')
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('copies the database together with its WAL so uncheckpointed rows survive', () => {
    fs.writeFileSync(dbPath, 'main')
    fs.writeFileSync(`${dbPath}-wal`, 'wal')
    const target = backupDatabaseOnStartup(dbPath, new Date('2026-11-06T10:00:00Z'))!
    expect(fs.readFileSync(path.join(target, 'cherrystudio.sqlite'), 'utf8')).toBe('main')
    expect(fs.readFileSync(path.join(target, 'cherrystudio.sqlite-wal'), 'utf8')).toBe('wal')
  })

  it('skips a missing or empty database', () => {
    expect(backupDatabaseOnStartup(dbPath)).toBeNull()
    fs.writeFileSync(dbPath, '')
    expect(backupDatabaseOnStartup(dbPath)).toBeNull()
  })

  it('keeps only the newest copies', () => {
    fs.writeFileSync(dbPath, 'main')
    for (let day = 1; day <= STARTUP_BACKUP_KEEP + 2; day++) {
      backupDatabaseOnStartup(dbPath, new Date(Date.UTC(2026, 10, day)))
    }
    const kept = fs.readdirSync(path.join(dir, STARTUP_BACKUP_DIR)).sort()
    expect(kept).toHaveLength(STARTUP_BACKUP_KEEP)
    expect(kept[0]).toContain('2026-11-03')
  })
})
