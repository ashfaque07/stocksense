// Generic skeleton placeholder table. Pass the column headers and row count to
// match the real table it stands in for while data loads.

export default function TableSkeleton({ columns = [], rows = 8, leftAlign = [] }) {
  const left = new Set(leftAlign)
  return (
    <div className="trending-table-wrap">
      <table className="trending-table">
        <thead>
          <tr>
            {columns.map((label, i) => (
              <th key={i} className={left.has(label) ? 'ta-left' : ''}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="skeleton-row">
              {columns.map((_col, c) => (
                <td key={c}>
                  <div className="skeleton skeleton-line" style={{ height: 24 }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
