import { useState } from 'react'
import { FILTER_FIELDS, countActive } from '../lib/filters.js'
import { useT } from '../lib/i18n.jsx'

// Primary filters shown by default; the rest live under "More filters".
const PRIMARY = ['stage', 'stage_id', 'country', 'agent', 'source']

export default function Filters({ options, value, onChange, onReset }) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const set = (patch) => onChange({ ...value, ...patch })
  const active = countActive(value)

  const shown = FILTER_FIELDS.filter((f) => (open ? true : PRIMARY.includes(f.key)))

  const activeChips = [
    value.from && { key: 'from', label: `${t('From')} ${value.from}` },
    value.to && { key: 'to', label: `${t('To')} ${value.to}` },
    value.search && { key: 'search', label: `“${value.search}”` },
    ...FILTER_FIELDS.filter((f) => value[f.key]).map((f) => {
      const opt = options[f.key]?.find((o) => o.value === value[f.key])
      return { key: f.key, label: `${t(f.label)}: ${opt ? opt.label : value[f.key]}` }
    }),
  ].filter(Boolean)

  return (
    <div className="filters card">
      <div className="filters-top">
        <input
          className="global-search"
          type="text"
          placeholder={t('Search students, country, program…')}
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
        />
        <div className="filter-field compact">
          <label>{t('From')}</label>
          <input type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} />
        </div>
        <div className="filter-field compact">
          <label>{t('To')}</label>
          <input type="date" value={value.to} onChange={(e) => set({ to: e.target.value })} />
        </div>
        <button className="btn-ghost sm" onClick={() => setOpen((o) => !o)}>
          {open ? t('Fewer filters') : t('More filters')}
        </button>
        {active > 0 && (
          <button className="btn-ghost sm" onClick={onReset}>
            {t('Reset')} ({active})
          </button>
        )}
      </div>

      <div className="filters-grid">
        {shown.map((f) => (
          <div className="filter-field" key={f.key}>
            <label>{t(f.label)}</label>
            <select value={value[f.key]} onChange={(e) => set({ [f.key]: e.target.value })}>
              <option value="">{t('All')}</option>
              {(options[f.key] || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {activeChips.length > 0 && (
        <div className="filter-chips">
          {activeChips.map((c) => (
            <button
              key={c.key}
              className="filter-chip"
              onClick={() => set({ [c.key]: '' })}
              title="Remove filter"
            >
              {c.label} <span className="x">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
