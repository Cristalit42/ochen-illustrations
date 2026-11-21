/**
 * Палитра = набор цветов по ролям. У всех палитр одинаковая структура,
 * поэтому перекраска — это замена цвета на цвет той же роли в другой палитре.
 *
 * Правило из брифа «цвета фона можно использовать в объектах, цвета объектов в фоне — нельзя»
 * выполняется автоматически: фон холста всегда берётся из bg-ролей, а объекты меняют цвета
 * только по своим ролям.
 */
export interface Palette {
  id: string
  name: string
  /** Цвета фона: светлый, средний, тёмный */
  bg: [string, string, string]
  /** Цвета объектов */
  obj: [string, string, string]
  dark: string
  light: string
}

export const BASE_PALETTE: Palette = {
  id: 'lavender',
  name: 'Лаванда',
  bg: ['#d7cdf5', '#aa9bf0', '#7864d7'],
  obj: ['#f9ecb0', '#f9a3aa', '#ffe3e1'],
  dark: '#181817',
  light: '#ffffff',
}

export const BUILTIN_PALETTES: Palette[] = [
  BASE_PALETTE,
  {
    id: 'peach',
    name: 'Персик',
    bg: ['#fdd7b9', '#fac896', '#d27532'],
    obj: ['#f9ecb0', '#80dada', '#beebeb'],
    dark: '#181817',
    light: '#ffffff',
  },
  {
    id: 'mint',
    name: 'Мята',
    bg: ['#beebeb', '#80dada', '#5abebe'],
    obj: ['#ffd4f2', '#6d7bfc', '#b6c6fe'],
    dark: '#181817',
    light: '#ffffff',
  },
]

const ROLES = ['bg.0', 'bg.1', 'bg.2', 'obj.0', 'obj.1', 'obj.2', 'dark', 'light'] as const

function colorOf(p: Palette, role: (typeof ROLES)[number]) {
  if (role === 'dark') return p.dark
  if (role === 'light') return p.light
  const [group, i] = role.split('.') as ['bg' | 'obj', string]
  return p[group][Number(i)]
}

/** Карта «цвет базовой палитры → цвет целевой палитры» */
export function colorMap(target: Palette): Map<string, string> {
  const map = new Map<string, string>()
  for (const role of ROLES) map.set(colorOf(BASE_PALETTE, role), colorOf(target, role))
  return map
}

/**
 * Перекрашивает SVG за один проход: каждая заливка заменяется независимо от остальных,
 * поэтому совпадающие цвета разных ролей не «перетекают» друг в друга.
 */
export function recolor(svgBody: string, target: Palette): string {
  if (target.id === BASE_PALETTE.id) return svgBody
  const map = colorMap(target)
  return svgBody.replace(/fill="(#[0-9a-f]{6})"/gi, (m, hex: string) => {
    const next = map.get(hex.toLowerCase())
    return next ? `fill="${next}"` : m
  })
}

const HEX = /^#[0-9a-f]{6}$/i

/** Проверяет загруженную палитру (JSON) и приводит её к нужному виду */
export function parsePalette(raw: unknown): Palette {
  const p = raw as Partial<Palette>
  const ok =
    p &&
    typeof p.name === 'string' &&
    Array.isArray(p.bg) && p.bg.length === 3 && p.bg.every((c) => HEX.test(c)) &&
    Array.isArray(p.obj) && p.obj.length === 3 && p.obj.every((c) => HEX.test(c))
  if (!ok) {
    throw new Error('Нужен JSON вида { "name": "...", "bg": ["#...", "#...", "#..."], "obj": ["#...", "#...", "#..."] }')
  }
  const lower = (c: string) => c.toLowerCase()
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: p.name!,
    bg: p.bg!.map(lower) as Palette['bg'],
    obj: p.obj!.map(lower) as Palette['obj'],
    dark: p.dark && HEX.test(p.dark) ? lower(p.dark) : BASE_PALETTE.dark,
    light: p.light && HEX.test(p.light) ? lower(p.light) : BASE_PALETTE.light,
  }
}
