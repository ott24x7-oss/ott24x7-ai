import { describe, expect, it } from 'vitest'

import { buildCompareCliArgs, createCliParserState, extractCliText } from '../cliAdapter'

describe('Compare CLI adapters', () => {
  it('builds safe single-prompt arguments for every installed-login CLI', () => {
    const prompt = 'hello; process.exit(1) && "quoted"'
    const claude = buildCompareCliArgs('claude', prompt, 'C:\\temp\\compare')
    const agy = buildCompareCliArgs('agy', prompt, 'C:\\temp\\compare')
    const codex = buildCompareCliArgs('codex', prompt, 'C:\\temp\\compare')

    expect(claude).toContain(prompt)
    expect(claude).toContain('') // `--tools ""` disables Claude Code tools.
    expect(agy).toContain(prompt)
    expect(agy).toContain('--mode')
    expect(agy).toContain('plan')
    expect(agy).toContain('--sandbox')
    expect(codex).toContain(prompt)
    expect(codex).toContain('read-only')
    expect(codex).toContain('--ephemeral')
    expect(codex).toContain('shell_tool')
    expect(codex).toContain('include_apply_patch_tool=false')
    for (const args of [claude, agy, codex]) {
      expect(args.filter((arg) => arg === prompt)).toHaveLength(1)
      expect(args[args.indexOf(prompt)]).toBe(prompt)
    }
  })

  it.each([
    [
      'claude',
      {
        type: 'stream_event',
        event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Claude reply' } }
      }
    ],
    ['agy', { type: 'assistant.delta', delta: { text: 'Antigravity reply' } }],
    ['codex', { type: 'item.delta', item_id: 'msg_1', delta: 'Codex reply' }]
  ] as const)('parses streaming NDJSON from %s', (cliId, sample) => {
    const state = createCliParserState()
    expect(extractCliText(cliId, JSON.stringify(sample), state)).toEqual([
      cliId === 'claude' ? 'Claude reply' : cliId === 'agy' ? 'Antigravity reply' : 'Codex reply'
    ])
  })

  it.each([
    ['claude', { type: 'result', result: 'Claude final' }],
    ['agy', { type: 'turn.completed', last_assistant_message: 'Antigravity final' }],
    ['codex', { type: 'turn.completed', last_assistant_message: 'Codex final' }]
  ] as const)('parses a final response from %s when no deltas were emitted', (cliId, sample) => {
    expect(extractCliText(cliId, JSON.stringify(sample), createCliParserState())).toEqual([
      cliId === 'claude' ? 'Claude final' : cliId === 'agy' ? 'Antigravity final' : 'Codex final'
    ])
  })
})
