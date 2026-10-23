// Side navigation with a mobile hamburger drawer.

import { useState } from 'react'
import { ICONS } from '../constants/ui.js'

const NAV_ITEMS = [
  { id: 'ipos', label: 'IPOs', icon: ICONS.ipos },
  { id: 'trending', label: 'Trending', icon: ICONS.trending },
  { id: 'stocks', label: 'Stock Analysis', icon: ICONS.stocks }
]

export default function Sidebar({ view, onSelect }) {
  const [open, setOpen] = useState(false)

  const select = (id) => {
    onSelect(id)
    setOpen(false)
  }

  return (
    <>
      <button
        className={`nav-toggle ${open ? 'hidden' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
      >
        {ICONS.menu}
      </button>

      {open && <div className="sidebar-overlay" onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-head">
          <span className="sidebar-brand">
            <span className="logo">{ICONS.stocks}</span> StockSense
          </span>
          <button
            className="sidebar-close"
            onClick={() => setOpen(false)}
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
