import type { ObjectId, Size, Variant } from '../library/catalog'
import { SIZE_FACTOR, getAsset } from '../library/assets'
import type { FormatId, Item } from './scene'
import { FORMATS, uid } from './scene'

export interface Pick {
  id: ObjectId
  variant: Variant
}

export type PresetId = 'title' | 'offset' | 'center'

/** Три композиции из примеров в брифе */
export const PRESETS: Record<PresetId, { name: string; hint: string }> = {
  title: { name: 'Под заголовок', hint: 'объекты справа, слева место для текста' },
  offset: { name: 'Со смещением', hint: 'композиция уходит за край' },
  center: { name: 'Собранно', hint: 'объекты по центру' },
}

interface Region {
  x0: number
  y0: number
  x1: number
  y1: number
  /** Какую долю площади области занимают объекты */
  fill: number
}

function region(preset: PresetId, w: number, h: number): Region {
  const landscape = w > h
  switch (preset) {
    case 'title':
      return landscape
        ? { x0: w * 0.44, y0: h * 0.1, x1: w * 0.95, y1: h * 0.9, fill: 0.5 }
        : { x0: w * 0.06, y0: h * 0.45, x1: w * 0.94, y1: h * 0.94, fill: 0.5 }
    case 'offset':
      return landscape
        ? { x0: w * 0.3, y0: h * 0.2, x1: w * 1.06, y1: h * 1.08, fill: 0.58 }
        : { x0: w * 0.12, y0: h * 0.3, x1: w * 1.08, y1: h * 1.06, fill: 0.58 }
    case 'center':
      return { x0: w * 0.05, y0: h * 0.07, x1: w * 0.95, y1: h * 0.93, fill: 0.55 }
  }
}

/** Детерминированный генератор случайных чисел: один и тот же seed — одна и та же раскладка */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 10000) / 10000
  }
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function overlap(a: Rect, b: Rect) {
  const ix = Math.max(0, Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2))
  const iy = Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2))
  return (ix * iy) / Math.min(a.w * a.h, b.w * b.h)
}

/**
 * Автокомпозиция: подбираем общий масштаб так, чтобы объекты заняли нужную долю области,
 * и раскладываем их жадно — от крупного к мелкому, каждый в ближайшую к центру свободную точку.
 * Главные объекты почти не перекрываются, фоновые могут уходить под главные.
 */
export function compose(picks: Pick[], format: FormatId, size: Size, preset: PresetId, seed = 1) {
  const { w, h } = FORMATS[format]
  const reg = region(preset, w, h)
  const rw = reg.x1 - reg.x0
  const rh = reg.y1 - reg.y0

  const natural = picks.map((p) => {
    const a = getAsset(p.id, p.variant, size)
    return { ...p, w: a.width * SIZE_FACTOR[size], h: a.height * SIZE_FACTOR[size] }
  })

  const area = natural.reduce((s, n) => s + n.w * n.h, 0) || 1
  let scale = Math.sqrt((reg.fill * rw * rh) / area)
  // самый крупный объект должен помещаться в область целиком
  for (const n of natural) scale = Math.min(scale, (rw * 0.75) / n.w, (rh * 0.85) / n.h)

  // если при таком масштабе объекты не помещаются без перекрытий — уменьшаем общий масштаб и пробуем снова
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = place(natural, reg, Math.round(scale * 1000) / 1000, rng(seed))
    if (res.ok || attempt === 9) return finish(res.items, Math.round(scale * 1000) / 1000)
    scale *= 0.9
  }
  throw new Error('unreachable')
}

type Natural = Pick & { w: number; h: number }

function place(natural: Natural[], reg: Region, scale: number, random: () => number) {
  const rw = reg.x1 - reg.x0
  const rh = reg.y1 - reg.y0
  // крупные главные — первыми, фоновые — после
  const order = natural
    .map((n, i) => ({ ...n, i, s: n.w * n.h * (n.variant === 'main' ? 4 : 1) }))
    .sort((a, b) => b.s - a.s)

  const cx = reg.x0 + rw / 2
  const cy = reg.y0 + rh / 2
  const placed: (Rect & { variant: Variant })[] = []
  const items: Item[] = new Array(natural.length)
  const step = Math.min(rw, rh) / 24
  let ok = true

  for (const o of order) {
    const ow = o.w * scale
    const oh = o.h * scale
    let best: { x: number; y: number; score: number } | null = null
    for (let y = reg.y0 + oh / 2; y <= reg.y1 - oh / 2 + 0.1; y += step) {
      for (let x = reg.x0 + ow / 2; x <= reg.x1 - ow / 2 + 0.1; x += step) {
        const rect = { x, y, w: ow, h: oh }
        let bad = false
        let penalty = 0
        for (const p of placed) {
          const ov = overlap(rect, p)
          const limit = o.variant === 'bg' || p.variant === 'bg' ? 0.3 : 0.08
          if (ov > limit) {
            bad = true
            break
          }
          penalty += ov
        }
        if (bad) continue
        // ближе к центру области + лёгкий разброс, чтобы «Другой вариант» давал новую раскладку
        const dx = (x - cx) / rw
        const dy = (y - cy) / rh
        const score = dx * dx + dy * dy * 1.4 + penalty + random() * 0.06
        if (!best || score < best.score) best = { x, y, score }
      }
    }
    if (!best) ok = false
    const pos = best ?? { x: cx, y: cy }
    placed.push({ x: pos.x, y: pos.y, w: ow, h: oh, variant: o.variant })
    items[o.i] = { uid: uid(), id: o.id, variant: o.variant, x: Math.round(pos.x), y: Math.round(pos.y), rotation: 0 }
  }
  return { ok, items }
}

function finish(result: Item[], scale: number) {
  // фоновые — под главными; внутри группы выше тот, кто ниже на холсте (как в изометрии)
  const items = [...result].sort((a, b) => {
    if (a.variant !== b.variant) return a.variant === 'bg' ? -1 : 1
    return a.y - b.y
  })
  return { items, scale }
}
