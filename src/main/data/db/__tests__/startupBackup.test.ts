import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  guardDatabaseOnStartup,
  inspectDatabase,
  REPLACED_DATABASE_DIR,
  STARTUP_BACKUP_DIR,
  STARTUP_BACKUP_KEEP
} from '../startupBackup'

function writeDb(file: string, keys: number, messages: number): void {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true })
  const db = new Database(file)
  db.exec('CREATE TABLE user_provider (provider_id TEXT, api_keys TEXT); CREATE TABLE message (id TEXT)')
  for (let i = 0; i < keys; i++) db.prepare('INSERT INTO user_provider VALUES (?, ?)').run(`p${i}`, '[{"key":"x"}]')
  db.prepare('INSERT INTO user_provider VALUES (?, ?)').run('empty', '[]')
  for (let i = 0; i < messages; i++) db.prepare('INSERT INTO message VALUES (?)').run(`m${i}`)
  db.close()
}

const day = (n: number) => new Date(Date.UTC(2026, 10, n))

describe('guardDatabaseOnStartup', () => {
  let dir: string
  let dbPath: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'startup-guard-'))
    dbPath = path.join(dir, 'cherrystudio.sqlite')
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('counts keyed providers and messages', () => {
    writeDb(dbPath, 2, 5)
    expect(inspectDatabase(dbPath)).toEqual({ ok: true, keyed: 2, messages: 5 })
  })

  it('does nothing on a fresh install', () => {
    expect(guardDatabaseOnStartup(dbPath)).toEqual({ action: 'none' })
  })

  it('backs up a healthy database and keeps only the newest copies', () => {
    writeDb(dbPath, 1, 1)
    for (let n = 1; n <= STARTUP_BACKUP_KEEP + 2; n++) {
      expect(guardDatabaseOnStartup(dbPath, day(n)).action).toBe('ok')
    }
    const kept = fs.readdirSync(path.join(dir, STARTUP_BACKUP_DIR)).sort()
    expect(kept).toHaveLength(STARTUP_BACKUP_KEEP)
    expect(kept[0]).toContain('2026-11-03')
  })

  it('restores the last good copy when the database comes up without the user keys', () => {
    writeDb(dbPath, 3, 10)
    guardDatabaseOnStartup(dbPath, day(1))
    writeDb(dbPath, 0, 0)

    const result = guardDatabaseOnStartup(dbPath, day(2))

    expect(result.action).toBe('recovered')
    expect(inspectDatabase(dbPath)).toEqual({ ok: true, keyed: 3, messages: 10 })
    expect(fs.readdirSync(path.join(dir, REPLACED_DATABASE_DIR))).toHaveLength(1)
  })

  it('never lets empty launches rotate out the good backup', () => {
    writeDb(dbPath, 2, 4)
    guardDatabaseOnStartup(dbPath, day(1))
    fs.rmSync(dbPath)
    for (let n = 2; n <= STARTUP_BACKUP_KEEP + 3; n++) {
      fs.writeFileSync(dbPath, '')
      guardDatabaseOnStartup(dbPath, day(n))
    }
    expect(inspectDatabase(dbPath)).toEqual({ ok: true, keyed: 2, messages: 4 })
  })

  it('recovers a corrupt database from backup', () => {
    writeDb(dbPath, 1, 2)
    guardDatabaseOnStartup(dbPath, day(1))
    fs.writeFileSync(dbPath, Buffer.alloc(8192, 7))

    expect(guardDatabaseOnStartup(dbPath, day(2)).action).toBe('recovered')
    expect(inspectDatabase(dbPath)).toEqual({ ok: true, keyed: 1, messages: 2 })
  })

  it('prefers the live main file when only its WAL is broken', () => {
    writeDb(dbPath, 1, 1)
    guardDatabaseOnStartup(dbPath, day(1))
    writeDb(dbPath, 2, 7)
    fs.writeFileSync(`${dbPath}-wal`, Buffer.alloc(4096, 9))
    // SQLite ignores a garbage WAL, so report the live snapshot (main + WAL) as malformed.
    const inspect = (file: string) =>
      file === path.join(dir, STARTUP_BACKUP_DIR, day(2).toISOString().replace(/[:.]/g, '-'), 'cherrystudio.sqlite')
        ? { ok: false, keyed: 0, messages: 0 }
        : inspectDatabase(file)

    const result = guardDatabaseOnStartup(dbPath, day(2), inspect)

    expect(result.action).toBe('recovered')
    expect(result.action === 'recovered' && result.source).toContain('main-only')
    expect(fs.existsSync(`${dbPath}-wal`)).toBe(false)
    expect(inspectDatabase(dbPath)).toEqual({ ok: true, keyed: 2, messages: 7 })
  })

  it('keeps a database where the user still has keys', () => {
    writeDb(dbPath, 3, 10)
    guardDatabaseOnStartup(dbPath, day(1))
    writeDb(dbPath, 1, 2)
    expect(guardDatabaseOnStartup(dbPath, day(2)).action).toBe('ok')
    expect(inspectDatabase(dbPath)).toEqual({ ok: true, keyed: 1, messages: 2 })
  })
})
