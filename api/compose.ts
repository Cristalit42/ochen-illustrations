/**
 * Vercel Serverless Function: подбор объектов под метафору через Claude.
 * Ключ хранится только на сервере (переменная окружения ANTHROPIC_API_KEY).
 * Если ключа нет — отвечаем 501, и клиент использует локальный подбор по смыслам.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

const OBJECTS = {
  book: 'открытая книга с закладкой',
  phone: 'смартфон, на экране пазл',
  puzzle: 'два соединённых кусочка пазла',
  coin: 'монета с замком',
  headphones: 'наушники',
  lamp: 'настольная лампа',
  flowers: 'тюльпаны в вазе',
  wallet: 'кошелёк',
  folder: 'папка с документами',
  pen: 'автоматическая ручка',
} as const

type Id = keyof typeof OBJECTS

const PROMPT = `Ты подбираешь объекты для иллюстрации к заголовку статьи или метафоре.
Есть только такие объекты (новые придумывать нельзя):
${Object.entries(OBJECTS)
  .map(([id, d]) => `- ${id}: ${d}`)
  .join('\n')}

Выбери 2–3 главных объекта, которые лучше всего передают смысл, и 0–2 фоновых, которые дополняют сцену.
Объект не может быть одновременно главным и фоновым.
Ответь только JSON без пояснений вокруг:
{"main": ["id", ...], "background": ["id", ...], "reason": "одно короткое предложение по-русски"}`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return res.status(501).json({ error: 'AI не настроен' })

  const text = String(req.body?.text ?? '').slice(0, 300).trim()
  if (!text) return res.status(400).json({ error: 'Пустой запрос' })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5',
        max_tokens: 300,
        system: PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    })
    if (!r.ok) return res.status(502).json({ error: `AI ответил ${r.status}` })

    const data = (await r.json()) as { content?: { type: string; text?: string }[] }
    const answer = data.content?.find((c) => c.type === 'text')?.text ?? ''
    const json = JSON.parse(answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1))

    // доверяем модели только в рамках каталога
    const valid = (list: unknown): Id[] =>
      Array.isArray(list) ? [...new Set(list.filter((id): id is Id => typeof id === 'string' && id in OBJECTS))] : []
    const main = valid(json.main).slice(0, 3)
    const background = valid(json.background).filter((id) => !main.includes(id)).slice(0, 2)
    if (!main.length) return res.status(502).json({ error: 'AI не выбрал объекты' })

    return res.status(200).json({ main, background, reason: String(json.reason ?? '') })
  } catch {
    return res.status(502).json({ error: 'Не удалось разобрать ответ AI' })
  }
}
