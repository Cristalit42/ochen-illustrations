import { useRef, useState } from 'react'
import type { FormatId, Scene } from '../lib/scene'
import { FORMATS } from '../lib/scene'
import type { Palette } from '../lib/palette'
import { BUILTIN_PALETTES, parsePalette } from '../lib/palette'
import type { Dispatch } from '../lib/store'
import { Button, Section, Segmented } from './ui'

interface Props {
  scene: Scene
  palettes: Palette[]
  dispatch: Dispatch
}

export default function SettingsPanel({ scene, palettes, dispatch }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<Palette | null>(null)

  // при смене формата сохраняем композицию: пересчитываем позиции и общий масштаб
  const changeFormat = (format: FormatId) => {
    const from = FORMATS[scene.format]
    const to = FORMATS[format]
    const k = Math.min(to.w / from.w, to.h / from.h)
    const items = scene.items.map((i) => ({ ...i, x: Math.round((i.x / from.w) * to.w), y: Math.round((i.y / from.h) * to.h) }))
    dispatch({ type: 'set', scene: { format, items, scale: Math.round(scene.scale * k * 1000) / 1000 } })
  }

  const upload = async (file: File) => {
    setError(null)
    try {
      dispatch({ type: 'addPalette', palette: parsePalette(JSON.parse(await file.text())) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось прочитать файл')
    }
  }

  const isCustom = (id: string) => !BUILTIN_PALETTES.some((p) => p.id === id)

  return (
    <Section title="Параметры">
      <Field label="Формат">
        <Segmented
          value={scene.format}
          onChange={changeFormat}
          options={Object.entries(FORMATS).map(([value, f]) => ({ value: value as FormatId, label: f.name }))}
        />
      </Field>

      <Field label="Размер объектов">
        <Segmented
          value={scene.size}
          onChange={(size) => dispatch({ type: 'set', scene: { size } })}
          options={[
            { value: 'L', label: 'L — детальные' },
            { value: 'S', label: 'S — упрощённые' },
          ]}
        />
      </Field>

      <Field label={`Масштаб всех объектов · ${Math.round(scene.scale * 100)}%`}>
        <input
          type="range"
          min={0.1}
          max={0.8}
          step={0.01}
          value={scene.scale}
          onChange={(e) => dispatch({ type: 'set', scene: { scale: Number(e.target.value) }, history: false })}
          onPointerDown={() => dispatch({ type: 'commit' })}
          className="w-full accent-neutral-900"
        />
      </Field>

      <Field label="Цветовая схема">
        <div className="space-y-1.5">
          {palettes.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <button
                onClick={() => dispatch({ type: 'set', scene: { paletteId: p.id } })}
                className={`flex flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ring-1 transition ${
                  p.id === scene.paletteId ? 'bg-white ring-neutral-900' : 'ring-neutral-200 hover:bg-white'
                }`}
              >
                <Swatches palette={p} />
                <span className="truncate">{p.name}</span>
              </button>
              {isCustom(p.id) && (
                <button onClick={() => dispatch({ type: 'removePalette', id: p.id })} className="text-neutral-400 hover:text-neutral-900" title="Удалить палитру">
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button className="flex-1" onClick={() => fileRef.current?.click()}>
            Загрузить JSON
          </Button>
          <Button className="flex-1" onClick={() => setEditor({ ...palettes.find((p) => p.id === scene.paletteId)!, id: '', name: 'Моя палитра' })}>
            Создать
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ''
          }}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {editor && (
          <PaletteEditor
            value={editor}
            onChange={setEditor}
            onCancel={() => setEditor(null)}
            onSave={() => {
              dispatch({ type: 'addPalette', palette: parsePalette(editor) })
              setEditor(null)
            }}
          />
        )}
      </Field>
    </Section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-neutral-500">{label}</div>
      {children}
    </div>
  )
}

function Swatches({ palette }: { palette: Palette }) {
  return (
    <span className="flex shrink-0 overflow-hidden rounded ring-1 ring-black/10">
      {[...palette.bg, ...palette.obj].map((c, i) => (
        <span key={i} className="h-4 w-3" style={{ background: c }} />
      ))}
    </span>
  )
}

function PaletteEditor({ value, onChange, onSave, onCancel }: { value: Palette; onChange: (p: Palette) => void; onSave: () => void; onCancel: () => void }) {
  const set = (group: 'bg' | 'obj', i: number, color: string) => {
    const next = [...value[group]] as Palette['bg']
    next[i] = color
    onChange({ ...value, [group]: next })
  }
  return (
    <div className="space-y-2 rounded-lg bg-white p-3 ring-1 ring-neutral-200">
      <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} className="w-full rounded border border-neutral-200 px-2 py-1 text-sm" />
      {(['bg', 'obj'] as const).map((group) => (
        <div key={group} className="flex items-center gap-2 text-xs">
          <span className="w-16 text-neutral-500">{group === 'bg' ? 'Фон' : 'Объекты'}</span>
          {value[group].map((c, i) => (
            <input key={i} type="color" value={c} onChange={(e) => set(group, i, e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-neutral-200" />
          ))}
        </div>
      ))}
      <p className="text-xs text-neutral-400">Цвета фона могут попадать в объекты, цвета объектов в фон — нет.</p>
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={onSave}>
          Сохранить
        </Button>
        <Button onClick={onCancel}>Отмена</Button>
      </div>
    </div>
  )
}
