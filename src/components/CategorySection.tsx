import type { ReactNode } from 'react'

/** Sezione con titolo di categoria, usata nelle liste raggruppate. */
export default function CategorySection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </section>
  )
}
