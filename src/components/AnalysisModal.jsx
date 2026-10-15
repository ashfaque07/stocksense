// Modal that displays the AI analysis result for one IPO.

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ICONS } from '../constants/ui.js'
import { MD_COMPONENTS } from '../constants/markdown.jsx'
import Modal from './Modal.jsx'

export default function AnalysisModal({ analysis, streaming, onClose }) {
  if (!analysis) return null

  const { ipo, result } = analysis
  const empty = !result.summary

  return (
    <Modal title={`AI Analysis · ${ipo.company}`} onClose={onClose}>
      {result.verdict && (
        <div className="verdict">
          <span className={`pill ${result.verdict.includes('Positive') ? 'good' : result.verdict.includes('Cautious') ? 'bad' : 'neutral'}`}>
            {result.verdict}
          </span>
          {result.score != null && <span className="score">Score: {result.score}/100</span>}
          <span className="provider">via {result.provider}</span>
        </div>
      )}
      {streaming && empty && <p className="info">{ICONS.ai} Analyzing in real time…</p>}
      <div className="summary markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{result.summary}</ReactMarkdown>
        {streaming && <span className="cursor">{ICONS.cursor}</span>}
      </div>
    </Modal>
  )
}
