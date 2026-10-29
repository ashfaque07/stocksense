// Simple request router.

import { handleGetIpos } from '../controllers/ipoController.js'
import { handleAnalyze } from '../controllers/analysisController.js'
import { handleAnalyzeStock } from '../controllers/stockAnalysisController.js'
import { handleAnalyzeSectorRotation } from '../controllers/sectorRotationController.js'
import { handleAnalyzeTrending } from '../controllers/trendingAnalysisController.js'
import { handleGetTrending, handleRefreshTrending } from '../controllers/trendingController.js'
import { handleGetResults } from '../controllers/resultsController.js'
import { handleGetResultsDetail } from '../controllers/resultsDetailController.js'
import { handleAnalyzeResults } from '../controllers/resultsAnalysisController.js'
import { handleGetModels } from '../controllers/modelsController.js'

export async function router(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.url.startsWith('/api/models')) {
    await handleGetModels(req, res)
    return
  }

  if (req.url.startsWith('/api/ipos')) {
    await handleGetIpos(req, res)
    return
  }

  if (req.url.startsWith('/api/trending-refresh')) {
    await handleRefreshTrending(req, res)
    return
  }

  if (req.url.startsWith('/api/analyze-trending')) {
    await handleAnalyzeTrending(req, res)
    return
  }

  if (req.url.startsWith('/api/trending')) {
    await handleGetTrending(req, res)
    return
  }

  if (req.url.startsWith('/api/analyze-results')) {
    await handleAnalyzeResults(req, res)
    return
  }

  if (req.url.startsWith('/api/results-detail')) {
    await handleGetResultsDetail(req, res)
    return
  }

  if (req.url.startsWith('/api/results')) {
    await handleGetResults(req, res)
    return
  }

  if (req.url.startsWith('/api/analyze-stock')) {
    await handleAnalyzeStock(req, res)
    return
  }

  if (req.url.startsWith('/api/sector-rotation')) {
    await handleAnalyzeSectorRotation(req, res)
    return
  }

  if (req.url.startsWith('/api/analyze')) {
    await handleAnalyze(req, res)
    return
  }

  res.statusCode = 404
  res.end('Not found')
}
