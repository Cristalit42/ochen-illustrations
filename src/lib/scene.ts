import type { ObjectId, Size, Variant } from '../library/catalog'
import { CATALOG_BY_ID } from '../library/catalog'
import { SIZE_FACTOR, getAsset } from '../library/assets'
import type { Palette } from './palette'
import { recolor } from './palette'

export interface Item {
  uid: string
  id: ObjectId
  variant: Variant
  /** Центр объекта в координатах холста */
  x: number
  y: number
  rotation: number
}

export type FormatId = 'cover' | 'square' | 'portrait'

export const FORMATS: Record<FormatId, { name: string; w: number; h: number }> = {
  cover: { name: '1200 × 630', w: 1200, h: 630 },
  square: { name: '1080 × 1080', w: 1080, h: 1080 },
  portrait: { name: '1080 × 1350', w: 1080, h: 1350 },
}

export interface Scene {
  format: FormatId
  size: Size
  paletteId: string
  /**
   * Общий масштаб всех объектов. Он один на всю сцену — так пропорции объектов
   * относительно друг друга никогда не меняются (требование брифа).
   */
  scale: number
  /** Порядок в массиве = порядок слоёв: первый — самый нижний */
  items: Item[]
}

export const uid = () => Math.random().toString(36).slice(2, 9)

/** Размер объекта на холсте с учётом общего масштаба */
export function itemSize(item: Pick<Item, 'id' | 'variant'>, size: Size, scale: number) {
  const a = getAsset(item.id, item.variant, size)
  const k = SIZE_FACTOR[size] * scale
  return { w: a.width * k, h: a.height * k }
}

export function itemTransform(item: Item, size: Size, scale: number) {
  const a = getAsset(item.id, item.variant, size)
  const k = SIZE_FACTOR[size] * scale
  const r = (n: number) => Math.round(n * 100) / 100
  return `translate(${r(item.x)} ${r(item.y)}) rotate(${r(item.rotation)}) scale(${r(k * 1000) / 1000}) translate(${r(-a.width / 2)} ${r(-a.height / 2)})`
}

export function itemBody(item: Item, size: Size, palette: Palette) {
  return recolor(getAsset(item.id, item.variant, size).body, palette)
}

/**
 * Итоговый SVG: фон + каждый объект отдельной группой <g> с понятным id.
 * Пути объектов вставляются без изменений — только перекраска заливок,
 * поэтому файл остаётся векторным и редактируется в Figma/Illustrator по объектам.
 */
export function sceneToSvg(scene: Scene, palette: Palette) {
  const { w, h } = FORMATS[scene.format]
  const counters: Record<string, number> = {}
  const groups = scene.items.map((item) => {
    const n = (counters[item.id] = (counters[item.id] ?? 0) + 1)
    const name = `${item.id}-${item.variant === 'main' ? 'main' : 'background'}-${n}`
    const title = `${CATALOG_BY_ID[item.id].name}${item.variant === 'bg' ? ' (фоновый)' : ''}`
    return `  <g id="${name}" data-object="${item.id}" data-variant="${item.variant}" transform="${itemTransform(item, scene.size, scene.scale)}">\n    <title>${title}</title>\n    ${itemBody(item, scene.size, palette)}\n  </g>`
  })
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `  <rect id="background" width="${w}" height="${h}" fill="${palette.bg[0]}"/>`,
    ...groups,
    `</svg>`,
    '',
  ].join('\n')
}
