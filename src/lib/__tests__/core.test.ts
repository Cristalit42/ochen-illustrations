import { describe, expect, it } from 'vitest'
import { BASE_PALETTE, BUILTIN_PALETTES, parsePalette, recolor } from '../palette'
import { parseObjectList, pickByMetaphor } from '../intent'
import { compose } from '../layout'
import { sceneToSvg } from '../scene'

const mint = BUILTIN_PALETTES.find((p) => p.id === 'mint')!
const peach = BUILTIN_PALETTES.find((p) => p.id === 'peach')!

describe('перекраска', () => {
  it('меняет цвета по ролям', () => {
    const svg = '<path fill="#d7cdf5"/><path fill="#f9a3aa"/><path fill="#181817"/>'
    expect(recolor(svg, mint)).toBe('<path fill="#beebeb"/><path fill="#6d7bfc"/><path fill="#181817"/>')
  })

  it('совпадающие цвета разных ролей не «перетекают» друг в друга', () => {
    // в персиковой палитре obj[1] совпадает с bg[1] другой палитры — замена идёт за один проход
    const svg = '<path fill="#aa9bf0"/><path fill="#f9a3aa"/>'
    expect(recolor(svg, peach)).toBe(`<path fill="${peach.bg[1]}"/><path fill="${peach.obj[1]}"/>`)
  })

  it('базовая палитра не меняет SVG', () => {
    const svg = '<path fill="#d7cdf5"/>'
    expect(recolor(svg, BASE_PALETTE)).toBe(svg)
  })

  it('проверяет загруженную палитру', () => {
    expect(() => parsePalette({ name: 'x', bg: ['#fff'] })).toThrow()
    const p = parsePalette({ name: 'Test', bg: ['#AABBCC', '#112233', '#445566'], obj: ['#000001', '#000002', '#000003'] })
    expect(p.bg[0]).toBe('#aabbcc')
    expect(p.dark).toBe(BASE_PALETTE.dark)
  })
})

describe('сценарий 2: список объектов', () => {
  it('находит объекты и фоновый вариант', () => {
    const { picks, unknown } = parseObjectList('книга, лампа, фоновые наушники, слон')
    expect(picks).toEqual([
      { id: 'book', variant: 'main' },
      { id: 'lamp', variant: 'main' },
      { id: 'headphones', variant: 'bg' },
    ])
    expect(unknown).toEqual(['слон'])
  })

  it('понимает падежи и количество', () => {
    const { picks } = parseObjectList('две книги и монеты')
    expect(picks.map((p) => p.id)).toEqual(['book', 'book', 'coin'])
  })
})

describe('сценарий 1: метафора без AI', () => {
  it('подбирает объекты по смыслу', () => {
    const ids = pickByMetaphor('Как начать копить деньги').picks.filter((p) => p.variant === 'main').map((p) => p.id)
    expect(ids).toContain('coin')
    expect(ids).toContain('wallet')
  })

  it('без совпадений собирает нейтральную сцену', () => {
    expect(pickByMetaphor('qwerty').picks.length).toBeGreaterThan(0)
  })
})

describe('автокомпозиция', () => {
  it('раскладывает объекты без сильных перекрытий главных и детерминированно по seed', () => {
    const picks = [
      { id: 'book', variant: 'main' },
      { id: 'lamp', variant: 'main' },
      { id: 'pen', variant: 'main' },
    ] as const
    const a = compose([...picks], 'cover', 'L', 'title', 7)
    const b = compose([...picks], 'cover', 'L', 'title', 7)
    expect(a.items.map(({ x, y }) => [x, y])).toEqual(b.items.map(({ x, y }) => [x, y]))
    expect(a.items).toHaveLength(3)
    // «Под заголовок»: центры объектов в правой части холста
    for (const it of a.items) expect(it.x).toBeGreaterThan(1200 * 0.44)
  })
})

describe('экспорт', () => {
  it('отдаёт векторный SVG с группой на каждый объект и без растра', () => {
    const { items, scale } = compose([{ id: 'coin', variant: 'main' }, { id: 'wallet', variant: 'bg' }], 'square', 'S', 'center', 1)
    const svg = sceneToSvg({ format: 'square', size: 'S', paletteId: 'mint', scale, items }, mint)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('id="coin-main-1"')
    expect(svg).toContain('id="wallet-background-1"')
    expect(svg).not.toMatch(/<image|data:image/)
    expect(svg).toContain(mint.bg[0])
  })
})
