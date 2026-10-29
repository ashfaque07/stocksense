// Sector Rotation page: AI analysis of where money is rotating across sectors.

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ICONS } from '../constants/ui.js'
import { MD_COMPONENTS } from '../constants/markdown.jsx'

export default function SectorRotation({ result, streaming, error, analyze }) {
  return (
    <section className="stock-analyzer">
      <div className="stock-search">
        <button type="button" className="stock-btn" onClick={analyze} disabled={streaming}>
          {streaming ? 'Analyzing…' : `${ICONS.sectors} Analyze Sector Rotation`}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {!result && !error && (
        <p className="info stock-hint">
          Run an AI analysis of which sectors money is rotating into and out of right now.
        </p>
      )}

      {result && (
        <div className="stock-result">
          <div className="modal-head">
            <h2>AI Sector Rotation</h2>
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
