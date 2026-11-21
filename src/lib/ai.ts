import type { ObjectId } from '../library/catalog'
import type { Pick } from './layout'
import { pickByMetaphor } from './intent'

export interface MetaphorResult {
  picks: Pick[]
  engine: 'ai' | 'local'
  note: string
}

/** Сначала пробуем AI на сервере, при любой ошибке — локальный подбор по смыслам */
export async function pickForMetaphor(text: string): Promise<MetaphorResult> {
  try {
    const r = await fetch('/api/compose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(12000),
    })
    if (r.ok) {
      const data = (await r.json()) as { main: ObjectId[]; background: ObjectId[]; reason: string }
      return {
        picks: [...data.main.map((id) => ({ id, variant: 'main' as const })), ...data.background.map((id) => ({ id, variant: 'bg' as const }))],
        engine: 'ai',
        note: data.reason,
      }
    }
  } catch {
    // нет сети или функции — переходим к локальному подбору
  }

  const local = pickByMetaphor(text)
  const found = Object.entries(local.matched)
    .map(([, words]) => words?.join(', '))
    .filter(Boolean)
  return {
    picks: local.picks,
    engine: 'local',
    note: found.length ? `Совпадения по смыслу: ${found.join('; ')}` : 'Явных совпадений нет — собрал нейтральную сцену',
  }
}
