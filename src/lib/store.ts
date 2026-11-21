import { useEffect, useReducer } from 'react'
import type { ObjectId, Variant } from '../library/catalog'
import type { Item, Scene } from './scene'
import { FORMATS, uid } from './scene'
import type { Palette } from './palette'
import { BUILTIN_PALETTES } from './palette'

export interface State {
  scene: Scene
  past: Scene[]
  future: Scene[]
  selected: string | null
  customPalettes: Palette[]
}

export type Action =
  | { type: 'set'; scene: Partial<Scene>; selected?: string | null; history?: boolean }
  | { type: 'add'; id: ObjectId; variant: Variant }
  | { type: 'update'; uid: string; patch: Partial<Item>; history?: boolean }
  | { type: 'commit' }
  | { type: 'select'; uid: string | null }
  | { type: 'remove'; uid: string }
  | { type: 'duplicate'; uid: string }
  | { type: 'layer'; uid: string; to: 'up' | 'down' | 'top' | 'bottom' }
  | { type: 'addPalette'; palette: Palette }
  | { type: 'removePalette'; id: string }
  | { type: 'undo' }
  | { type: 'redo' }

const KEY = 'composer-state-v1'

const initialScene: Scene = { format: 'cover', size: 'L', paletteId: 'lavender', scale: 0.3, items: [] }

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Pick<State, 'scene' | 'customPalettes'>
      return { scene: saved.scene, customPalettes: saved.customPalettes ?? [], past: [], future: [], selected: null }
    }
  } catch {
    // localStorage недоступен — начинаем с пустой сцены
  }
  return { scene: initialScene, customPalettes: [], past: [], future: [], selected: null }
}

/** Новое состояние сцены с записью в историю (для отмены) */
function push(state: State, scene: Scene, selected = state.selected): State {
  return { ...state, scene, selected, past: [...state.past.slice(-49), state.scene], future: [] }
}

function reducer(state: State, a: Action): State {
  const { scene } = state
  const mapItem = (id: string, fn: (i: Item) => Item) => scene.items.map((i) => (i.uid === id ? fn(i) : i))

  switch (a.type) {
    case 'set': {
      const next = { ...scene, ...a.scene }
      const selected = a.selected === undefined ? state.selected : a.selected
      return a.history === false ? { ...state, scene: next, selected } : push(state, next, selected)
    }
    case 'add': {
      const { w, h } = FORMATS[scene.format]
      const offset = (scene.items.length % 5) * 24
      const item: Item = { uid: uid(), id: a.id, variant: a.variant, x: w / 2 + offset, y: h / 2 + offset, rotation: 0 }
      return push(state, { ...scene, items: [...scene.items, item] }, item.uid)
    }
    case 'update': {
      const next = { ...scene, items: mapItem(a.uid, (i) => ({ ...i, ...a.patch })) }
      // при перетаскивании историю пишем один раз — в момент начала (через commit)
      return a.history === false ? { ...state, scene: next } : push(state, next)
    }
    case 'commit':
      return { ...state, past: [...state.past.slice(-49), scene], future: [] }
    case 'select':
      return { ...state, selected: a.uid }
    case 'remove':
      return push(state, { ...scene, items: scene.items.filter((i) => i.uid !== a.uid) }, null)
    case 'duplicate': {
      const src = scene.items.find((i) => i.uid === a.uid)
      if (!src) return state
      const copy = { ...src, uid: uid(), x: src.x + 30, y: src.y + 30 }
      const idx = scene.items.indexOf(src)
      const items = [...scene.items.slice(0, idx + 1), copy, ...scene.items.slice(idx + 1)]
      return push(state, { ...scene, items }, copy.uid)
    }
    case 'layer': {
      const idx = scene.items.findIndex((i) => i.uid === a.uid)
      if (idx < 0) return state
      const items = [...scene.items]
      const [it] = items.splice(idx, 1)
      const to = { up: Math.min(items.length, idx + 1), down: Math.max(0, idx - 1), top: items.length, bottom: 0 }[a.to]
      items.splice(to, 0, it)
      return push(state, { ...scene, items })
    }
    case 'addPalette':
      return push({ ...state, customPalettes: [...state.customPalettes, a.palette] }, { ...scene, paletteId: a.palette.id })
    case 'removePalette':
      return {
        ...state,
        customPalettes: state.customPalettes.filter((p) => p.id !== a.id),
        scene: scene.paletteId === a.id ? { ...scene, paletteId: BUILTIN_PALETTES[0].id } : scene,
      }
    case 'undo': {
      const prev = state.past.at(-1)
      if (!prev) return state
      return { ...state, scene: prev, past: state.past.slice(0, -1), future: [scene, ...state.future] }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return { ...state, scene: next, past: [...state.past, scene], future: rest }
    }
  }
}

export function useComposer() {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ scene: state.scene, customPalettes: state.customPalettes }))
    } catch {
      // не сохранилось — не критично
    }
  }, [state.scene, state.customPalettes])

  const palettes = [...BUILTIN_PALETTES, ...state.customPalettes]
  const palette = palettes.find((p) => p.id === state.scene.paletteId) ?? BUILTIN_PALETTES[0]
  return { state, dispatch, palettes, palette }
}

export type Dispatch = (a: Action) => void
