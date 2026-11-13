// Skeleton placeholder for the Report table. Mirrors the grouped columns of the
// real table (see TABLE_COLUMNS in Report.jsx): each cell shows as many lines
// as the real cell, so the layout does not jump when data arrives.

// key matches the `col-<key>` class used by the real table; `lines` are the
// placeholder line widths (px, or % for the flexible Verdict column).
const COLUMNS = [
  { key: 'stock', label: 'Stock', left: true, lines: [70, 110], pill: true },
  { key: 'price', label: 'Price', lines: [60, 70] },
  { key: 'verdict', label: 'Verdict', left: true, lines: ['85%', '70%', '90%', '60%'] },
  { key: 'range', label: 'Day Range', lines: [110, 110, 110, 110, 110] },
  { key: 'activity', label: 'Activity & Circuit', lines: [110, 110, 110, 110, 110] },
  { key: 'datetime', label: 'Date & Time', lines: [110, 110, 110] }
]

export default function ReportSkeleton({ rows = 4 }) {
  return (
    <div className="trending-table-wrap">
      <table className="trending-table report-table">
        <thead>
          <tr>
            <th>#</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className={`col-${c.key}${c.left ? ' ta-left' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="skeleton-row">
              <td>
                <div className="skeleton skeleton-line" style={{ width: 14, height: 12, marginBottom: 0 }} />
              </td>
              {COLUMNS.map((c) => (
                <td key={c.key} className={`col-${c.key}${c.left ? ' ta-left' : ''}`}>
                  {c.lines.map((w, i) => (
                    <div
                      key={i}
                      className={`skeleton skeleton-line${c.pill && i === c.lines.length - 1 ? ' skeleton-pill' : ''}`}
                      style={{ width: w, height: c.pill && i === c.lines.length - 1 ? 20 : 12, marginBottom: 8 }}
                    />
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
