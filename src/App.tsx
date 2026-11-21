import { useEffect, useState } from 'react'
import { useComposer } from './lib/store'
import { FORMATS, sceneToSvg } from './lib/scene'
import Canvas from './components/Canvas'
import AutoPanel from './components/AutoPanel'
import SettingsPanel from './components/SettingsPanel'
import LibraryPanel from './components/LibraryPanel'
import Inspector from './components/Inspector'
import { Button } from './components/ui'

export default function App() {
  const { state, dispatch, palettes, palette } = useComposer()
  const { scene, selected } = state
  const [copied, setCopied] = useState(false)

  const exportSvg = () => {
    const svg = sceneToSvg(scene, palette)
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `illustration-${FORMATS[scene.format].w}x${FORMATS[scene.format].h}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copySvg = async () => {
    await navigator.clipboard.writeText(sceneToSvg(scene, palette))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // горячие клавиши: отмена, дубль, удаление, сдвиг стрелками
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' })
        return
      }
      if (!selected) return
      const item = scene.items.find((i) => i.uid === selected)
      if (!item) return
      if (e.key === 'Delete' || e.key === 'Backspace') dispatch({ type: 'remove', uid: selected })
      else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        dispatch({ type: 'duplicate', uid: selected })
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const d = e.shiftKey ? 20 : 4
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0
        dispatch({ type: 'update', uid: selected, patch: { x: item.x + dx, y: item.y + dy } })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch, scene.items, selected])

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <div>
          <h1 className="font-semibold">Конструктор иллюстраций</h1>
          <p className="text-xs text-neutral-500">Сборка композиций из готовых векторных объектов · без генерации новых</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => dispatch({ type: 'undo' })} disabled={!state.past.length} title="Ctrl+Z">
            Отменить
          </Button>
          <Button onClick={() => dispatch({ type: 'redo' })} disabled={!state.future.length} title="Ctrl+Shift+Z">
            Вернуть
          </Button>
          <Button onClick={() => dispatch({ type: 'set', scene: { items: [] }, selected: null })} disabled={!scene.items.length}>
            Очистить
          </Button>
          <Button onClick={copySvg} disabled={!scene.items.length}>
            {copied ? 'Скопировано' : 'Копировать SVG'}
          </Button>
          <Button variant="primary" onClick={exportSvg} disabled={!scene.items.length}>
            Скачать SVG
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_1fr_280px]">
        <aside className="overflow-y-auto border-r border-neutral-200 bg-neutral-50 lg:order-1">
          <AutoPanel format={scene.format} size={scene.size} dispatch={dispatch} />
          <SettingsPanel scene={scene} palettes={palettes} dispatch={dispatch} />
          <LibraryPanel size={scene.size} palette={palette} dispatch={dispatch} />
        </aside>

        <main className="order-first flex min-h-[50vh] items-center justify-center p-4 lg:order-2 lg:p-8">
          <Canvas scene={scene} palette={palette} selected={selected} dispatch={dispatch} />
        </main>

        <aside className="overflow-y-auto border-l border-neutral-200 bg-neutral-50 lg:order-3">
          <Inspector scene={scene} selected={selected} dispatch={dispatch} />
          <p className="px-4 pb-4 text-xs leading-relaxed text-neutral-400">
            Перетаскивание — мышью, стрелки — сдвиг (Shift — крупнее), Delete — удалить, Ctrl+D — дублировать, Ctrl+Z — отменить.
          </p>
        </aside>
      </div>
    </div>
  )
}
