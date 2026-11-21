import type { ObjectId } from '../library/catalog'
import { CATALOG } from '../library/catalog'
import { getAsset } from '../library/assets'
import type { Pick } from './layout'

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е')

const words = (s: string): string[] => norm(s).match(/[a-zа-я]+/g) ?? []

/**
 * Простое сравнение с учётом падежей: слова совпадают, если у них общее начало
 * длиной не меньше 4 букв и отличаются они только последними 1–2 буквами
 * («книги» = «книга», «деньгами» = «деньги»).
 */
function matches(word: string, term: string) {
  const t = norm(term)
  if (t.includes(' ')) return false
  if (word === t) return true
  let common = 0
  while (common < word.length && common < t.length && word[common] === t[common]) common++
  return common >= 4 && common >= Math.min(word.length, t.length) - 2
}

/**
 * Сценарий 2: человек перечисляет объекты.
 * «книга, лампа, фоновые наушники» → книга и лампа главными, наушники фоновыми.
 */
export function parseObjectList(text: string): { picks: Pick[]; unknown: string[] } {
  const picks: Pick[] = []
  const unknown: string[] = []
  for (const chunk of text.split(/[,;\n]+|\s+и\s+/)) {
    const ws = words(chunk)
    if (!ws.length) continue
    const isBg = ws.some((w) => w.startsWith('фон') || w === 'background' || w === 'bg')
    const entry = CATALOG.find((c) => c.synonyms.some((syn) => ws.some((w) => matches(w, syn))))
    if (!entry) {
      unknown.push(chunk.trim())
      continue
    }
    // «2 книги» или «две книги» — повторяем объект
    const count = Math.min(3, Number(ws.find((w) => /^\d+$/.test(w))) || (ws.some((w) => /^(две|два)$/.test(w)) ? 2 : ws.includes('три') ? 3 : 1))
    for (let i = 0; i < count; i++) picks.push({ id: entry.id, variant: isBg ? 'bg' : 'main' })
  }
  return { picks, unknown }
}

/**
 * Сценарий 1 без нейросети: ищем совпадения слов заголовка со смыслами объектов.
 * Используется как запасной вариант, если AI-подбор недоступен.
 */
export function pickByMetaphor(text: string): { picks: Pick[]; matched: Partial<Record<ObjectId, string[]>> } {
  const ws = words(text).filter((w) => w.length > 2)
  const scored = CATALOG.map((c) => {
    const hits = new Set<string>()
    for (const w of ws) {
      for (const term of c.synonyms) if (matches(w, term)) hits.add(w)
      for (const term of c.meanings) if (matches(w, term)) hits.add(w)
    }
    return { id: c.id, score: hits.size, hits: [...hits] }
  }).sort((a, b) => b.score - a.score)

  const hit = scored.filter((s) => s.score > 0)
  const matched = Object.fromEntries(hit.map((s) => [s.id, s.hits])) as Partial<Record<ObjectId, string[]>>

  // ничего не нашли — нейтральная сцена «рабочее место»
  const main: ObjectId[] = hit.length ? hit.slice(0, 3).map((s) => s.id) : ['book', 'lamp', 'pen']
  // фоновые не должны перетягивать внимание: берём только объекты не крупнее главных,
  // сначала те, что тоже подходят по смыслу, потом самые небольшие
  const area = (id: ObjectId) => {
    const a = getAsset(id, 'main', 'L')
    return a.width * a.height
  }
  const maxMain = Math.max(...main.map(area))
  const background = CATALOG.map((c) => c.id)
    .filter((id) => !main.includes(id) && area(id) <= maxMain)
    .sort((a, b) => (matched[b] ? 1 : 0) - (matched[a] ? 1 : 0) || area(a) - area(b))
    .slice(0, main.length >= 3 ? 1 : 2)

  return {
    picks: [...main.map((id) => ({ id, variant: 'main' as const })), ...background.map((id) => ({ id, variant: 'bg' as const }))],
    matched,
  }
}
