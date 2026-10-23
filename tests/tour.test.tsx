import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'mod-tour',
  component: 'Pane',
  requestId: 'mod-tour',
  props: { title: 'Mod tour', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const RUN = { args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as const

function engine(on: On) {
  // Nothing sits beneath the plugin: these hooks stand for the engine.
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', () => ({ value: { tool: 'mcp__mod-tour__clock' } }))
  on('clock.now', () => ({ value: Date.UTC(2026, 9, 23, 12) }))
  on('clock.every', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
}

test('/mod-tour opens paused on the first slide', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const { text } = await $.command.run({ ...RUN, command: 'mod-tour' })
  expect(text).toContain('p/n to step')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Claude Mods tour/ }))?.text).toContain('Claude Mods tour')
  await ui.unmount()
})

test('/tour-ping answers at once', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const { text } = await $.command.run({ ...RUN, command: 'tour-ping' })
  expect(text).toContain('pong from mod-tour')
})

test('::tour is rewritten before the model reads it', async ($, on) => {
  engine(on)
  on('prompt.submit', (_, e) => ({ text: e.text }))
  const out = await $.prompt.submit({ text: '::tour', wait: false, origin: { kind: 'composer' } })
  expect(out.text).toContain('prompt.submit hook')
})
