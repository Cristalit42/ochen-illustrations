import type { Size } from '../library/catalog'
import { CATALOG } from '../library/catalog'
import { getAsset } from '../library/assets'
import type { Palette } from '../lib/palette'
import { recolor } from '../lib/palette'
import type { Dispatch } from '../lib/store'
import { Section } from './ui'

/** Библиотека объектов: клик добавляет главный вариант, кнопка «фон» — фоновый */
export default function LibraryPanel({ size, palette, dispatch }: { size: Size; palette: Palette; dispatch: Dispatch }) {
  return (
    <Section title="Библиотека · 10 объектов × 2 варианта">
      <div className="grid grid-cols-2 gap-2">
        {CATALOG.map((c) => {
          const a = getAsset(c.id, 'main', size)
          return (
            <div key={c.id} className="group relative rounded-lg bg-white p-2 ring-1 ring-neutral-200">
              <button onClick={() => dispatch({ type: 'add', id: c.id, variant: 'main' })} className="block w-full" title={`Добавить: ${c.name}`}>
                <svg viewBox={`0 0 ${a.width} ${a.height}`} className="mx-auto h-14 w-full" dangerouslySetInnerHTML={{ __html: recolor(a.body, palette) }} />
                <span className="mt-1 block text-xs text-neutral-600">{c.name}</span>
              </button>
              <button
                onClick={() => dispatch({ type: 'add', id: c.id, variant: 'bg' })}
                className="absolute top-1 right-1 rounded px-1.5 py-0.5 text-[10px] text-neutral-500 opacity-0 ring-1 ring-neutral-200 transition group-hover:opacity-100 hover:bg-neutral-100"
                title="Добавить фоновый вариант"
              >
                фон
              </button>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
