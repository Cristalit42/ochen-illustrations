import { useState } from 'react'
import type { FormatId } from '../lib/scene'
import type { Size } from '../library/catalog'
import type { Pick, PresetId } from '../lib/layout'
import { PRESETS, compose } from '../lib/layout'
import { parseObjectList } from '../lib/intent'
import { pickForMetaphor } from '../lib/ai'
import type { Dispatch } from '../lib/store'
import { Button, Section, Segmented } from './ui'

interface Props {
  format: FormatId
  size: Size
  dispatch: Dispatch
}

type Mode = 'metaphor' | 'list'

const EXAMPLES: Record<Mode, string[]> = {
  metaphor: ['Как начать копить деньги', 'Учёба по вечерам', 'Командная работа над проектом'],
  list: ['книга, лампа, ручка', 'телефон, пазл, фоновый кошелёк', 'наушники, цветы, фоновая книга'],
}

/** Автоматическая сборка: сценарий 1 (метафора) и сценарий 2 (список объектов) */
export default function AutoPanel({ format, size, dispatch }: Props) {
  const [mode, setMode] = useState<Mode>('metaphor')
  const [text, setText] = useState('')
  const [preset, setPreset] = useState<PresetId>('title')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [last, setLast] = useState<{ picks: Pick[]; seed: number } | null>(null)

  const apply = (picks: Pick[], seed: number, p = preset) => {
    const { items, scale } = compose(picks, format, size, p, seed)
    dispatch({ type: 'set', scene: { items, scale }, selected: null })
    setLast({ picks, seed })
  }

  const run = async () => {
    if (!text.trim()) return
    setBusy(true)
    setNote(null)
    try {
      if (mode === 'list') {
        const { picks, unknown } = parseObjectList(text)
        if (!picks.length) {
          setNote('Не нашёл объектов. Доступны: книга, телефон, пазл, монета, наушники, лампа, цветы, кошелёк, папка, ручка')
          return
        }
        apply(picks, 1)
        setNote(unknown.length ? `Не распознал: ${unknown.join(', ')}` : null)
      } else {
        const res = await pickForMetaphor(text)
        apply(res.picks, 1)
        setNote(`${res.engine === 'ai' ? 'AI' : 'Локальный подбор'}: ${res.note}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section title="Автосборка">
      <Segmented
        value={mode}
        onChange={(m) => {
          setMode(m)
          setNote(null)
        }}
        options={[
          { value: 'metaphor', label: 'Метафора' },
          { value: 'list', label: 'Список объектов' },
        ]}
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && run()}
        rows={2}
        placeholder={mode === 'metaphor' ? 'Заголовок или метафора' : 'Например: книга, лампа, фоновая ручка'}
        className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
      />
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES[mode].map((ex) => (
          <button key={ex} onClick={() => setText(ex)} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600 hover:bg-neutral-200">
            {ex}
          </button>
        ))}
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-neutral-500">Композиция</span>
        <select
          value={preset}
          onChange={(e) => {
            const p = e.target.value as PresetId
            setPreset(p)
            if (last) apply(last.picks, last.seed, p)
          }}
          className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm"
        >
          {Object.entries(PRESETS).map(([id, p]) => (
            <option key={id} value={id}>
              {p.name} — {p.hint}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={run} disabled={busy || !text.trim()}>
          {busy ? 'Подбираю…' : 'Собрать'}
        </Button>
        <Button onClick={() => last && apply(last.picks, last.seed + 1)} disabled={!last} title="Те же объекты, другая раскладка">
          Другой вариант
        </Button>
      </div>
      {note && <p className="text-xs text-neutral-500">{note}</p>}
    </Section>
  )
}
