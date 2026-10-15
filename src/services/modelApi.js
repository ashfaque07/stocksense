// Model selection: fetches the available AI models from the proxy and persists
// the user's choice in localStorage so every analysis request can send it.

const STORAGE_KEY = 'aiModel'

export async function fetchModels() {
  try {
    const res = await fetch('/api/models')
    if (!res.ok) return { models: [], default: '' }
    return await res.json()
  } catch {
    return { models: [], default: '' }
  }
}

export function getSelectedModel() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function setSelectedModel(model) {
  try {
    if (model) localStorage.setItem(STORAGE_KEY, model)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore storage errors
  }
}
