// Stock Analyzer page: search a listed stock and get AI fundamental analysis.

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ICONS } from '../constants/ui.js'
import { MD_COMPONENTS } from '../constants/markdown.jsx'

export default function StockAnalyzer({ result, streaming, error, query, mode, analyze }) {
  const [input, setInput] = useState('')

  function onSubmit(e) {
    e.preventDefault()
    analyze(input, 'analysis')
  }

  return (
    <section className="stock-analyzer">
      <form className="stock-search" onSubmit={onSubmit}>
        <input
          type="text"
          className="stock-input"
          placeholder="Search a listed stock (e.g. Reliance, TCS, AAPL)…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Stock name or ticker"
        />
        <button type="submit" className="stock-btn" disabled={streaming || !input.trim()}>
          {streaming && mode === 'analysis' ? 'Analyzing…' : `${ICONS.search} Analyze`}
        </button>
        <button
          type="button"
          className="stock-btn"
          disabled={streaming || !input.trim()}
          onClick={() => analyze(input, 'forecast')}
        >
          {streaming && mode === 'forecast' ? 'Forecasting…' : `${ICONS.ai} Forecast`}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {!result && !error && (
        <p className="info stock-hint">
          Enter a company name or ticker symbol to get an AI fundamental analysis or a 1–4 week price forecast.
        </p>
      )}

      {result && (
        <div className="stock-result">
          <div className="modal-head">
            <h2>{mode === 'forecast' ? 'AI Forecast' : 'AI Analysis'} · {query}</h2>
          </div>
          {streaming && !result.summary && <p className="info">{ICONS.ai} Analyzing in real time…</p>}
          <div className="summary markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{result.summary}</ReactMarkdown>
            {streaming && <span className="cursor">{ICONS.cursor}</span>}
          </div>
        </div>
      )}
    </section>
  )
}
