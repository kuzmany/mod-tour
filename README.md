# mod-tour

**See what a Claude Code mod can do. Live, inside Claude Code, in 2 minutes.**

Docs tell you a mod can draw a pane, guard a tool call or rewrite your prompt. `/mod-tour` shows you. It opens a pane with 22 slides. Each slide runs a real example in your session, next to the few lines of API that make it work.

## Install

At the Claude Code prompt:

```
/plugin marketplace add kuzmany/mod-tour
/plugin install mod-tour@mod-tour
```

Then type `/mod-tour`.

## Use

| Key | Does |
|---|---|
| `p` / `n` | previous / next slide; free examples run on arrival |
| `t` | Try it: run (or re-run) the slide's example |
| `s` | play / pause autoplay (one slide every 3 s) |
| `/mod-tour auto` | open with autoplay on |

Slides that cost tokens or interrupt you (model calls, dialogs, clipboard, notifications) wait for `t`, and the button says why.

## What you see

- **Tell you something:** transcript line, toast, status line, system notification
- **Draw:** a band above the prompt, a pane with an input field, a restyled spinner
- **Reach out:** run `git`, read files, remember values across sessions, copy to clipboard
- **Models and tools:** a Haiku side call, a fork that asks about this session, a tool Claude can call, a slash command, any tool called from code
- **Step into Claude's work:** pause a tool call and ask you, rewrite a prompt (`::tour`), suggest the next prompt, edit the system prompt, follow a turn

Everything lives in one file: `hooks/register.tsx`. Read it and copy the parts you need.

## Requirements

Claude Code 2.1.308 or newer (mods are on by default). Tested on 2.1.309. Mods are early access, so the API may change.

## License

MIT, see LICENSE.

## Develop

```
claude plugin validate .
claude plugin test .
```
