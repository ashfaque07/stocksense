// AI model selector: lets the user switch which model powers the analyses.
// The choice is persisted in localStorage and read at request time by the
// analysis services, so no prop drilling is needed.

import { useEffect, useState } from 'react'
import { fetchModels, getSelectedModel, setSelectedModel } from '../services/modelApi.js'

export default function ModelSelector() {
  const [models, setModels] = useState([])
  const [selected, setSelected] = useState(getSelectedModel())

  useEffect(() => {
    let active = true
    fetchModels().then(({ models: list, default: def }) => {
      if (!active) return
      setModels(list)
      // Default to the stored choice if still valid, else the server default.
      const current = getSelectedModel()
      if (!current || !list.includes(current)) {
        setSelected(def || '')
        setSelectedModel(def || '')
      }
    })
    return () => {
      active = false
    }
  }, [])

  function onChange(e) {
    const value = e.target.value
    setSelected(value)
    setSelectedModel(value)
  }

  if (!models.length) return null

  return (
    <label className="model-selector" title="AI model used for analysis">
      <select value={selected} onChange={onChange} aria-label="AI model">
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </label>
  )
}
