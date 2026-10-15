// Controller: exposes the list of configured AI models for the UI dropdown.

import { AI_MODEL_NAMES, DEFAULT_MODEL } from '../config/index.js'

export async function handleGetModels(req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ models: AI_MODEL_NAMES, default: DEFAULT_MODEL }))
}
