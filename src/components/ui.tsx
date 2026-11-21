import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-neutral-200 p-4 last:border-b-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Button({ variant = 'default', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' }) {
  const styles = {
    default: 'bg-white ring-1 ring-neutral-200 hover:bg-neutral-50',
    primary: 'bg-neutral-900 text-white hover:bg-neutral-700',
    ghost: 'hover:bg-neutral-100',
  }[variant]
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    />
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg bg-neutral-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-md px-2 py-1 text-sm transition ${o.value === value ? 'bg-white font-medium shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
