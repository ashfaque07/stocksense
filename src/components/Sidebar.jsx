// Side navigation with a mobile hamburger drawer.

import { ICONS } from '../constants/ui.js'

const NAV_ITEMS = [
  { id: 'ipos', label: 'IPOs', icon: ICONS.ipos },
  { id: 'trending', label: 'Trending', icon: ICONS.trending },
  { id: 'results', label: 'Upcoming Results', icon: ICONS.results },
  { id: 'stocks', label: 'Stock Analysis', icon: ICONS.stocks }
]

export default function Sidebar({ view, onSelect, open = false, onClose }) {
  const select = (id) => {
    onSelect(id)
    onClose?.()
  }

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-head">
          <span className="sidebar-brand">
            <span className="logo">{ICONS.stocks}</span> StockSense
          </span>
          <button
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            {ICONS.close}
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              onClick={() => select(item.id)}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span className="nav-item-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  )
}
