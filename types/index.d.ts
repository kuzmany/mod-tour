export type LastTurn = { seconds: number; tools: number }

export type Tour = {
  slide: number
  isPaused: boolean
  isOpen: boolean
  isBusy: boolean
  detail: string
  isSpinnerOn: boolean
  lastTurn: LastTurn | null
}

declare module 'claude-code' {
  interface PluginState {
    'mod-tour': { tour: Tour }
  }
}
