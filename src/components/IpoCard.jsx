// Single IPO card with key metrics and the analyze action.

import { ICONS } from '../constants/ui.js'

export default function IpoCard({ ipo, index, analyzing, onAnalyze }) {
  return (
    <div className={`card ${ipo.anchor ? 'anchored' : ''}`}>
      <div className="card-head">
        <div>
          <h3>
            {ipo.detailUrl ? (
              <a href={ipo.detailUrl} target="_blank" rel="noreferrer">{ipo.company}</a>
            ) : (
              ipo.company
            )}
          </h3>
          <div className="tags">
            {ipo.type && <span className={`tag type ${/SME/i.test(ipo.type) ? 'sme' : 'main'}`}>{ipo.type}</span>}
            {ipo.status && <span className={`status ${ipo.status.replace(/\s+/g, '-').toLowerCase()}`}>{ipo.status}</span>}
          </div>
        </div>
        {ipo.rating && ipo.rating !== '—' && <span className="rating" title="InvestorGain fire rating">{ipo.rating}</span>}
      </div>

      <div className="gmp-row">
        <span className="gmp-label">GMP</span>
        <span className={`gmp-value ${ipo.gmpPercent > 0 ? 'up' : ipo.gmpPercent < 0 ? 'down' : ''}`}>
          {ipo.gmp}
        </span>
      </div>

      <ul className="details">
        {ipo.priceBand !== '—' && <li><span>Price</span>{ipo.priceBand}</li>}
        {ipo.lotSize !== '—' && <li><span>Lot Size</span>{ipo.lotSize}</li>}
        {ipo.issueSize !== '—' && <li><span>Issue Size</span>{ipo.issueSize}</li>}
        {ipo.pe !== '—' && <li><span>P/E</span>{ipo.pe}</li>}
        {ipo.subscription !== '—' && <li><span>Subscription</span>{ipo.subscription}</li>}
        {ipo.openDate && <li><span>Open</span>{ipo.openDate}</li>}
        {ipo.closeDate && <li><span>Close</span>{ipo.closeDate}</li>}
        {ipo.boaDate && <li><span>Allotment</span>{ipo.boaDate}</li>}
        {ipo.listingDate && <li><span>Listing</span>{ipo.listingDate}</li>}
        <li><span>Anchor</span>{ipo.anchor ? `${ICONS.yes} Yes` : `${ICONS.no} No`}</li>
        {ipo.updatedOn && <li><span>Updated</span>{ipo.updatedOn}</li>}
      </ul>

      <button className="analyze" onClick={() => onAnalyze(ipo, index)} disabled={analyzing === index}>
        {analyzing === index ? 'Analyzing…' : `${ICONS.ai} AI Analysis`}
      </button>
    </div>
  )
}
