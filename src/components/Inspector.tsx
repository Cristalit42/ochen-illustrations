import type { Scene } from '../lib/scene'
import { CATALOG_BY_ID } from '../library/catalog'
import type { Dispatch } from '../lib/store'
import { Button, Section, Segmented } from './ui'

/** Свойства выбранного объекта и список слоёв */
export default function Inspector({ scene, selected, dispatch }: { scene: Scene; selected: string | null; dispatch: Dispatch }) {
  const item = scene.items.find((i) => i.uid === selected)
  const layers = [...scene.items].reverse() // сверху — верхний слой

  return (
    <>
      <Section title="Объект">
        {item ? (
          <div className="space-y-3">
            <div className="text-sm font-medium">{CATALOG_BY_ID[item.id].name}</div>
            <Segmented
              value={item.variant}
              onChange={(variant) => dispatch({ type: 'update', uid: item.uid, patch: { variant } })}
              options={[
                { value: 'main', label: 'Главный' },
                { value: 'bg', label: 'Фоновый' },
              ]}
            />
            <div className="space-y-1">
              <div className="text-xs text-neutral-500">Поворот · {item.rotation}°</div>
              <div className="flex items-center gap-2">
                <Button onClick={() => dispatch({ type: 'update', uid: item.uid, patch: { rotation: item.rotation - 15 } })}>−15°</Button>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={item.rotation}
                  onPointerDown={() => dispatch({ type: 'commit' })}
                  onChange={(e) => dispatch({ type: 'update', uid: item.uid, patch: { rotation: Number(e.target.value) }, history: false })}
                  className="min-w-0 flex-1 accent-neutral-900"
                />
                <Button onClick={() => dispatch({ type: 'update', uid: item.uid, patch: { rotation: item.rotation + 15 } })}>+15°</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => dispatch({ type: 'layer', uid: item.uid, to: 'top' })}>На передний план</Button>
              <Button onClick={() => dispatch({ type: 'layer', uid: item.uid, to: 'bottom' })}>На задний план</Button>
              <Button onClick={() => dispatch({ type: 'layer', uid: item.uid, to: 'up' })}>Выше</Button>
              <Button onClick={() => dispatch({ type: 'layer', uid: item.uid, to: 'down' })}>Ниже</Button>
              <Button onClick={() => dispatch({ type: 'duplicate', uid: item.uid })}>Дублировать</Button>
              <Button onClick={() => dispatch({ type: 'remove', uid: item.uid })} className="text-red-600">
                Удалить
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">Выберите объект на холсте</p>
        )}
      </Section>

      <Section title={`Слои · ${scene.items.length}`}>
        {layers.length ? (
          <ul className="space-y-1">
            {layers.map((l) => (
              <li key={l.uid}>
                <button
                  onClick={() => dispatch({ type: 'select', uid: l.uid })}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm ${l.uid === selected ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'}`}
                >
                  <span>{CATALOG_BY_ID[l.id].name}</span>
                  <span className="text-xs opacity-60">{l.variant === 'main' ? 'главный' : 'фоновый'}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-400">Пусто — соберите сцену автоматически или добавьте объекты из библиотеки</p>
        )}
      </Section>
    </>
  )
}
