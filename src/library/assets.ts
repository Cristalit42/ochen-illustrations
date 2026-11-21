import type { ObjectId, Size, Variant } from './catalog'

/**
 * Исходные векторные объекты. Каждый файл — отдельный объект в одном из 4 вариантов
 * (размер L/S × главный/фоновый), нарисованный в базовой палитре.
 * Файлы подключаются как текст при сборке: так SVG вставляется в итоговую композицию
 * как есть, без растеризации и без изменения путей.
 */
const files = import.meta.glob('./svg/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

export interface Asset {
  key: string
  width: number
  height: number
  /** Внутреннее содержимое <svg> — только <path> с атрибутом fill */
  body: string
}

const ASSETS: Record<string, Asset> = {}

for (const [path, raw] of Object.entries(files)) {
  const key = path.replace('./svg/', '').replace('.svg', '')
  const viewBox = raw.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  const body = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  if (!viewBox) throw new Error(`Нет viewBox у ${key}`)
  ASSETS[key] = { key, width: Number(viewBox[1]), height: Number(viewBox[2]), body }
}

export function assetKey(id: ObjectId, variant: Variant, size: Size) {
  return `${id}-${variant}-${size}`
}

export function getAsset(id: ObjectId, variant: Variant, size: Size): Asset {
  const asset = ASSETS[assetKey(id, variant, size)]
  if (!asset) throw new Error(`Нет объекта ${assetKey(id, variant, size)}`)
  return asset
}

/** S нарисован в 2 раза меньше L — приводим к одному масштабу, чтобы смена размера не «прыгала» */
export const SIZE_FACTOR: Record<Size, number> = { L: 1, S: 2 }
