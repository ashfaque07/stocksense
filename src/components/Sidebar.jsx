// Side navigation with a mobile hamburger drawer.

import { useEffect } from 'react'
import { ICONS } from '../constants/ui.js'

const NAV_ITEMS = [
  { id: 'trending', label: 'Trending', icon: ICONS.trending },
  { id: 'stocks', label: 'Stock Analysis', icon: ICONS.stocks },
  { id: 'results', label: 'Upcoming Results', icon: ICONS.results },
  { id: 'ipos', label: 'IPOs', icon: ICONS.ipos },
  { id: 'sectors', label: 'Sector Rotation', icon: ICONS.sectors },
  { id: 'report', label: 'Report', icon: ICONS.report },
  { id: 'guide', label: 'Guide', icon: ICONS.guide },
]

export default function Sidebar({ view, onSelect, open = false, onClose }) {
  // Lock page scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.classList.toggle('no-scroll', open)
    return () => document.body.classList.remove('no-scroll')
  }, [open])

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
            <img className="logo logo-img" src={ICONS.favicon} alt="" /> StockSense
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
