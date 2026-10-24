import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Tour } from '../types'

const PANE = 'mod-tour'
const STEP_MS = 3_000
const START: Tour = { slide: 0, isPaused: true, isOpen: false, isBusy: false, detail: '', isSpinnerOn: false, lastTurn: null }
const tour = atom({ plugin: 'mod-tour', key: 'tour' } as const, START)

// `act` names what [Try it] runs; a slide without one only explains.
type Slide = { title: string; api: string; text: string; act?: string }

const SLIDES: Slide[] = [
  { title: 'Claude Mods tour', api: 'export const register = on => { … }', text: 'A mod is TypeScript that runs inside Claude Code. Step with ◀ ▶ (p / n), free examples run as you arrive, [Try it] (t) runs the rest, ▶ play (s) to autoplay.' },
  // Telling the person something
  { title: 'Line in the chat history', api: '$.ui.log(text)', text: 'A dim line in the transcript. Example: report git changes without a turn.', act: 'log' },
  { title: 'Toast', api: '$.ui.toast(text)', text: 'A short message (top right in fullscreen, else on the notification bar). Example: “Tests passed”.', act: 'toast' },
  { title: 'Status line', api: '$.ui.status(text)', text: 'Text in the status line until cleared. Example: how full the context window is.', act: 'status' },
  { title: 'System notification', api: '$.ui.notify(text, { title })', text: 'A native notification by your /config channel. Example: a long task finished.', act: 'notify' },
  // Drawing
  { title: 'Band above the prompt', api: "on('ui.render', { component: 'AbovePrompt' })", text: 'A live row above the prompt box, shown while this slide is open. Example: git branch.', act: 'band' },
  { title: 'Pane with a field', api: '$.ui.open + <Input onSubmit>', text: 'This window is a pane. Type in the field below and press Enter: the mod saves it with $.store.', act: 'input' },
  { title: 'Restyle Claude Code', api: "on('ui.render', { component: 'Spinner' })", text: 'Change what Claude Code draws itself: spinner, tool rows, messages. [Try it] tags the spinner with 🎬 for your next turns.', act: 'spinner' },
  // Reaching out
  { title: 'Run a host command', api: "$.process.run(['git', 'log', '-3', '--oneline'])", text: 'Runs a program by argv, no shell. Example: the last 3 commits.', act: 'process' },
  { title: 'Read files', api: '$.fs.list / read / write / stat', text: 'Files without a tool call. Example: what is in the working folder.', act: 'fs' },
  { title: 'Remember across sessions', api: '$.store.get / set', text: 'Values that survive restarts. Example: a counter of your tries.', act: 'store' },
  { title: 'Clipboard', api: '$.ui.copy({ text, surface })', text: 'Put text on the clipboard. Example: copy this slide’s API line.', act: 'copy' },
  // Models and tools
  { title: 'Ask a model', api: "$.model.complete({ model: 'haiku', prompt })", text: 'A side call to any model, no turn, no history.', act: 'model' },
  { title: 'Side question over this session', api: '$.model.fork({ prompt })', text: 'Asks about the session itself, served from the prompt cache. Example: what is still open?', act: 'fork' },
  { title: 'Call a tool', api: "$.tool.call({ tool: 'Bash', command: 'date' })", text: 'A mod can call any tool, and add its own with $.tool.register: this mod adds a clock tool that Claude can call (ask “what time is it?”). Example: run Bash from code.', act: 'tool' },
  { title: 'Run a slash command', api: "$.command.run({ command: 'tour-ping' })", text: 'Commands a mod adds answer at once, even mid-turn. Example: run this mod’s /tour-ping from here.', act: 'command' },
  // Stepping into Claude’s work
  { title: 'Hold a tool call and ask', api: "on('tool.call') + $.ui.ask(question, options)", text: 'A guard can pause a call and ask you. [Try it] opens the real question box; nothing runs.', act: 'ask' },
  { title: 'Rewrite a prompt', api: "on('prompt.submit', … next({ ...e, text }))", text: 'This mod turns ::tour into a full question. [Try it] puts ::tour in your prompt box: press Enter.', act: 'fill' },
  { title: 'Suggest the next prompt', api: '$.prompt.suggest({ text })', text: 'The dim hint in an empty prompt box, Tab to take it.', act: 'suggest' },
  { title: 'System prompt', api: "on('prompt.compose') → { sections }", text: 'Add, replace or drop sections of the system prompt. Here: the sections of this session.', act: 'compose' },
  { title: 'Follow a turn', api: "on('turn.complete') + on('tool.call')", text: 'Hooks share variables: one counts tool calls, one reads them when the turn ends.', act: 'turn' },
  { title: 'That is the tour', api: 'claude plugin validate · claude plugin test', text: 'Every feature here is a few lines of TypeScript. ◀ to go back, ✕ to close.' },
]

let startedAt = 0
let tools = 0

async function act($: EngineInterface, name: string, surface: string): Promise<string> {
  switch (name) {
    case 'log': {
      const run = await $.process.run(['git', 'status', '--porcelain'])
      const changed = run.exitCode === 0 ? run.stdout.split('\n').filter(Boolean).length : -1
      $.ui.log(changed < 0 ? 'this folder is not a git repository' : `${changed} file(s) changed in git`)
      return 'look at the chat history'
    }
    case 'toast':
      $.ui.toast('Tests passed ✓ (example from mod-tour)')
      return 'toast shown'
    case 'status': {
      const { context, cost } = await $.session.usage()
      const text = `ctx ${context.percent ?? '?'}% of ${Math.round(context.window / 1000)}k${cost ? ` · $${cost.usd.toFixed(2)}` : ''}`
      $.ui.status(text)
      return `${text}, look at the status line`
    }
    case 'notify': {
      const sent = await $.ui.notify('A long task finished (example)', { title: 'mod-tour' })
      return sent.isSent ? `sent by ${sent.channel}` : `not sent: ${sent.reason}`
    }
    case 'band': {
      const run = await $.process.run(['git', 'branch', '--show-current'])
      return run.exitCode === 0 ? `branch ${run.stdout.trim() || '(detached)'}` : 'no git here'
    }
    case 'spinner': {
      const t = await update($, tour, x => ({ ...x, isSpinnerOn: !x.isSpinnerOn }))
      return t.isSpinnerOn ? 'on: send any prompt and watch the spinner' : 'off'
    }
    case 'process': {
      const run = await $.process.run(['git', 'log', '-3', '--oneline'])
      return run.exitCode === 0 ? run.stdout.trim() : 'no git here'
    }
    case 'fs': {
      const entries = await $.fs.list(await $.session.cwd())
      return `${entries.length} entries: ${entries.slice(0, 6).map(x => x.name).join(', ')}${entries.length > 6 ? ', …' : ''}`
    }
    case 'store': {
      const tries = Number((await $.store.get('tries')) ?? 0) + 1
      await $.store.set('tries', tries)
      return `you pressed this ${tries}× (kept across sessions)`
    }
    case 'copy': {
      const text = SLIDES[11]!.api
      const copied = await $.ui.copy({ text, surface: surface as never })
      return copied.isCopied ? `copied: ${text}` : `not copied: ${copied.reason}`
    }
    case 'model': {
      const r = await $.model.complete({ model: 'haiku', prompt: 'In one line of max 15 words: what is a Claude Code mod good for?', timeoutMs: 20_000 })
      return r.isAnswered ? `Haiku: ${r.text.trim()}` : `no answer: ${r.reason}`
    }
    case 'fork': {
      const r = await $.model.fork({ prompt: 'In one line of max 20 words: what is still open in this session?' })
      return r.isAnswered ? r.text.trim() : `no answer: ${r.reason}`
    }
    case 'tool': {
      const ran = await $.tool.call({ tool: 'Bash', command: 'date' })
      return ran.deny !== undefined ? `denied: ${ran.deny}` : String(ran.text ?? JSON.stringify(ran.result)).slice(0, 200)
    }
    case 'command': {
      const { text } = await $.command.run({ command: 'tour-ping' })
      return text === undefined ? 'no output' : text.split('\n').slice(0, 4).join('\n')
    }
    case 'ask': {
      const answer = await $.ui.ask('Claude wants to run `rm -rf /tmp/demo`. Run it?', { header: 'mod-tour', options: ['Run it', 'Cancel'] })
      return `you chose “${answer}”. It is a demo, so nothing ran.`
    }
    case 'fill':
      await $.prompt.fill({ text: '::tour ', mode: 'replace' })
      return 'press Esc to leave the pane, then Enter'
    case 'suggest': {
      const r = await $.prompt.suggest({ text: 'run the tests you just wrote' })
      return r.isShown ? 'shown: Esc to the prompt box, Tab to take it' : 'not shown (the box holds text or a turn runs)'
    }
    case 'compose': {
      const { sections } = await $.prompt.compose()
      return `${sections.length} sections: ${sections.map(s => s.id).join(', ')}`
    }
    case 'turn': {
      const last = (await read($, tour)).lastTurn
      return last === null ? 'no turn finished since the mod loaded: send a prompt' : `last turn: ${last.seconds}s, ${last.tools} tool call(s)`
    }
    default:
      return ''
  }
}

// Free, quiet examples run as soon as you step to them; the rest wait for [Try it].
const AUTO = new Set(['log', 'toast', 'status', 'band', 'process', 'fs', 'store', 'turn', 'compose', 'tool', 'command'])
const WHY: Record<string, string> = {
  model: 'costs a Haiku call', fork: 'costs a model call',
  ask: 'opens a dialog', copy: 'overwrites clipboard', notify: 'sends a notification',
  fill: 'changes your prompt', suggest: 'changes your prompt', spinner: 'toggle',
}

async function show($: EngineInterface, slide: number, surface?: string) {
  const index = (slide + SLIDES.length) % SLIDES.length
  await update($, tour, t => ({ ...t, slide: index, detail: '', isBusy: false }))
  $.ui.invalidate('ui.render')
  const name = SLIDES[index]?.act
  if (surface !== undefined && name !== undefined && AUTO.has(name)) await tryIt($, surface)
}

async function tryIt($: EngineInterface, surface: string) {
  const t = await read($, tour)
  const name = SLIDES[t.slide]?.act
  if (name === undefined || t.isBusy) return
  await update($, tour, x => ({ ...x, isBusy: true, detail: '…' }))
  let detail: string
  try {
    detail = await act($, name, surface)
  } catch (err) {
    detail = `failed: ${String(err)}`
  }
  await update($, tour, x => (x.slide === t.slide ? { ...x, isBusy: false, detail } : { ...x, isBusy: false }))
}

function tryLabel(name: string | undefined): string {
  if (name !== undefined && AUTO.has(name)) return '↻ Run again'
  return name !== undefined && WHY[name] !== undefined ? `Try it (${WHY[name]})` : 'Try it'
}

async function saveNote($: EngineInterface, text: string) {
  await $.store.set('note', text)
  await update($, tour, x => ({ ...x, detail: `saved “${text}” with $.store` }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'mod-tour', description: 'Tour of what a Claude mod can do (p/n step, t try, s play)', argumentHint: '[auto]' })
    await $.command.register({ name: 'tour-ping', description: 'mod-tour demo: answers at once, even mid-turn' })
    await $.tool.register({
      name: 'clock',
      description: 'Current date and time in UTC and in the local zone. Added by the mod-tour demo.',
      inputSchema: { type: 'object', properties: {} },
      isDeferred: false,
    })
    $.clock.every(STEP_MS, async () => {
      const t = await read($, tour)
      if (t.isOpen && !t.isPaused) await show($, t.slide + 1)
    })
    return next(e)
  })

  on('command.run', { command: 'mod-tour' }, async ($, e) => {
    const isAuto = e.args.trim() === 'auto'
    await update($, tour, x => ({ ...START, isSpinnerOn: x.isSpinnerOn, lastTurn: x.lastTurn, isOpen: true, isPaused: !isAuto }))
    await $.ui.open({ id: PANE, title: 'Mod tour', focus: true })
    return { text: isAuto ? 'Tour playing: a slide every 3 s.' : 'Tour opened: p/n to step, t to try, s to play.' }
  })

  on('command.run', { command: 'tour-ping' }, async ($, e) => ({ text: `pong from mod-tour at ${new Date(await $.clock.now()).toLocaleTimeString()} ${e.args}`.trim() }))

  on('ui.close', { id: PANE }, async ($, e, next) => {
    await update($, tour, t => ({ ...t, isOpen: false }))
    $.ui.status(undefined)
    return next(e)
  })

  // Feeds the "Follow a turn" slide.
  on('prompt.submit', async ($, e, next) => {
    startedAt = await $.clock.now()
    tools = 0
    if (e.command === undefined && !e.isMeta && e.text.trim() === '::tour') {
      return next({ ...e, text: 'The mod-tour mod rewrote my "::tour" prompt into this one. In one sentence, explain what a prompt.submit hook can do.' })
    }
    return next(e)
  })

  // Also answers the clock tool when Claude calls it (its name is not in the tool types until the mod has loaded once).
  on('tool.call', async ($, e, next) => {
    tools += 1
    if ((e.tool as string) === 'mcp__mod-tour__clock') {
      const now = new Date(await $.clock.now())
      return { result: `utc:   ${now.toISOString()}\nlocal: ${now.toString()}` }
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (startedAt > 0) {
      const seconds = Math.round(((await $.clock.now()) - startedAt) / 1000)
      await update($, tour, t => ({ ...t, lastTurn: { seconds, tools } }))
    }
    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const t = await read($, tour)
    return t.isSpinnerOn ? next({ ...e, props: { ...e.props, message: `🎬 ${e.props.message ?? e.props.word} (restyled by mod-tour)` } }) : next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const t = await read($, tour)
    if (!t.isOpen || SLIDES[t.slide]?.act !== 'band' || e.props.hasSurvey) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text color="magenta">★ mod-tour band{t.detail !== '' && t.detail !== '…' ? ` · ${t.detail}` : ' · reading git…'}</Text>
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const t = await read($, tour)
    const slide = SLIDES[t.slide] ?? SLIDES[0]!
    const dots = SLIDES.map((_, i) => (i === t.slide ? '●' : '·')).join('')

    let field = null
    if (slide.act === 'input' && e.surface !== 'mobile') {
      const { Input } = $.ui.resolve(e)
      field = <Input key="note" placeholder="Type a note, Enter to save" submitLabel="save" onSubmit={(text: string) => saveNote($, text)} />
    }

    return (
      <Box flexDirection="column">
        <Text dimColor>
          {dots}  {t.slide + 1}/{SLIDES.length}
          {t.isPaused ? '' : '  ▶ playing'}
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text bold>{slide.title}</Text>
          <Text color="cyan">{slide.api}</Text>
          <Text>{slide.text}</Text>
        </Box>
        {field}
        {t.detail !== '' && (
          <Box marginTop={1}>
            <Text color="green">→ {t.detail}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Button key="prev" hotkey="p" label="◀" onPress={press => show($, t.slide - 1, press.surface)} />
          <Button key="next" hotkey="n" label="▶" onPress={press => show($, t.slide + 1, press.surface)} />
          {slide.act !== undefined && slide.act !== 'input' && (
            <Button key="try" hotkey="t" variant="primary" label={t.isBusy ? 'running…' : tryLabel(SLIDES[t.slide]?.act)} onPress={press => tryIt($, press.surface)} />
          )}
          <Button key="play" hotkey="s" label={t.isPaused ? '▶ play' : '⏸ pause'} onPress={() => update($, tour, x => ({ ...x, isPaused: !x.isPaused }))} />
          <Button key="close" label="✕" role="dismiss" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}
