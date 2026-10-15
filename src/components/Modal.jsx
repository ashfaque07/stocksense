// Shared modal shell: common overlay, sizing, layout, scroll-lock, and close
// behavior (backdrop click, close button, Escape key). Every modal in the app
// should render its content inside this component so they stay consistent.

import { useEffect } from 'react'
import { ICONS } from '../constants/ui.js'

export default function Modal({ open = true, title, onClose, children }) {
  // Lock background scroll while open and close on Escape.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="close" onClick={onClose}>{ICONS.close}</button>
        </div>
        {children}
      </div>
    </div>
  )
}
