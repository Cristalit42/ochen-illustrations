import { useRef } from 'react'
import type { Scene } from '../lib/scene'
import { FORMATS, itemBody, itemSize, itemTransform } from '../lib/scene'
import type { Palette } from '../lib/palette'
import type { Dispatch } from '../lib/store'

interface Props {
  scene: Scene
  palette: Palette
  selected: string | null
  dispatch: Dispatch
}

/**
 * Холст рисуется тем же кодом, что и экспорт (itemTransform + itemBody),
 * поэтому скачанный SVG выглядит ровно так же, как на экране.
 */
export default function Canvas({ scene, palette, selected, dispatch }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ uid: string; dx: number; dy: number; moved: boolean } | null>(null)
  const { w, h } = FORMATS[scene.format]

  const toCanvas = (e: React.PointerEvent) => {
    const svg = svgRef.current!
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: pt.x, y: pt.y }
  }

  const onDown = (e: React.PointerEvent, uid: string) => {
    e.stopPropagation()
    const item = scene.items.find((i) => i.uid === uid)!
    const p = toCanvas(e)
    drag.current = { uid, dx: p.x - item.x, dy: p.y - item.y, moved: false }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dispatch({ type: 'select', uid })
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (!d.moved) {
      dispatch({ type: 'commit' }) // одна запись в истории на всё перетаскивание
      d.moved = true
    }
    const p = toCanvas(e)
    dispatch({ type: 'update', uid: d.uid, patch: { x: Math.round(p.x - d.dx), y: Math.round(p.y - d.dy) }, history: false })
  }

  const onUp = () => {
    drag.current = null
  }

  const sel = scene.items.find((i) => i.uid === selected)
  const selSize = sel && itemSize(sel, scene.size, scene.scale)

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${w} ${h}`}
      className="block h-auto max-h-full w-full touch-none select-none rounded-xl shadow-sm"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerDown={() => dispatch({ type: 'select', uid: null })}
    >
      <rect width={w} height={h} fill={palette.bg[0]} />
      {scene.items.map((item) => (
        <g
          key={item.uid}
          transform={itemTransform(item, scene.size, scene.scale)}
          onPointerDown={(e) => onDown(e, item.uid)}
          className="cursor-grab active:cursor-grabbing"
          dangerouslySetInnerHTML={{ __html: itemBody(item, scene.size, palette) }}
        />
      ))}
      {sel && selSize && (
        <g transform={`translate(${sel.x} ${sel.y}) rotate(${sel.rotation})`} pointerEvents="none">
          <rect
            x={-selSize.w / 2 - 6}
            y={-selSize.h / 2 - 6}
            width={selSize.w + 12}
            height={selSize.h + 12}
            fill="none"
            stroke="#2563eb"
            strokeWidth={2}
            strokeDasharray="8 6"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </svg>
  )
}
