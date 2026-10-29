// Real-time AI sector rotation analysis for Indian equities. Reuses the shared
// AI streaming/caching helper and yields markdown text tokens as they arrive.

import { streamCompletion } from './analysisService.js'
import { getNewsForQuery } from './newsService.js'
import { SECTOR_ROTATION_SYSTEM_PROMPT, sectorRotationUserPrompt } from './prompts.js'

function buildMessages(news) {
  return [
    {
      role: 'system',
      content: SECTOR_ROTATION_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: sectorRotationUserPrompt(news)
    }
  ]
}

// Async generator that yields markdown chunks for the current sector rotation view.
export async function* streamSectorRotation(model) {
  // Best-effort: pull recent headlines so the model reasons over fresh news.
  const news = await getNewsForQuery('Nifty sector rotation India')
  yield* streamCompletion(buildMessages(news), 'sector-rotation', model)
}
