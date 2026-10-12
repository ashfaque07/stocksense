// Skeleton placeholder table shown while trending stocks are loading.

const COLUMNS = [
  '#',
  'Symbol',
  'LTP (%)',
  'Open',
  'Prev',
  'Day Range',
  'Vol',
  'Turnover',
  'Reason (Trending)',
  'Created',
  'Modified'
]

export default function TrendingSkeleton({ rows = 10 }) {
  return (
    <div className="trending-table-wrap">
      <table className="trending-table">
        <thead>
          <tr>
            {COLUMNS.map((label) => (
              <th key={label} className={label === 'Symbol' || label === 'Reason (Trending)' ? 'ta-left' : ''}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="skeleton-row">
              {COLUMNS.map((_col, c) => (
                <td key={c}>
                  <div className="skeleton skeleton-line" style={{ height: 12 }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
