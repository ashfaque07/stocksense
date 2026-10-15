// Toolbar: company search box and status/type filter chips.

import { FILTERS } from '../constants/ui.js'

export default function Toolbar({ search, onSearch, filter, onFilter, counts = {} }) {
  return (
    <div className="toolbar">
      <input
        className="search"
        id="search"
        placeholder="Search company…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div className="filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`chip ${filter === f ? 'active' : ''}`}
            onClick={() => onFilter(f)}
          >
            {f}
            <span className="chip-count">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
