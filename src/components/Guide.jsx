// Guide: explains the report fields, verdict statements, categories and colours.

import { CATEGORIES, CATEGORY_COLOURS, FIELDS, ROUTINE, STATEMENTS, TONES, VIEWS } from '../constants/guide.js'

export default function Guide() {
  return (
    <section className="guide">
      <div className="guide-card">
        <h2>Report views</h2>
        <div className="trending-table-wrap">
          <table className="trending-table">
            <tbody>
              {VIEWS.map((v) => (
                <tr key={v.name}>
                  <td><strong>{v.name}</strong></td>
                  <td className="guide-wrap">{v.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="guide-card">
        <h2>Colour legend</h2>
        <ul className="verdict-list guide-legend">
          {TONES.map((t) => (
            <li key={t.tone} className={`verdict-${t.tone}`}>
              <strong>{t.label}</strong> — {t.meaning}
            </li>
          ))}
        </ul>
      </div>

      <div className="guide-card">
        <h2>Categories</h2>
        <div className="trending-table-wrap">
          <table className="trending-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>When it applies</th>
                <th>How to read it</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((c) => (
                <tr key={c.name}>
                  <td><span className="verdict-category" data-tone={c.tone}>{c.name}</span></td>
                  <td className="guide-wrap">{c.when}</td>
                  <td className="guide-wrap">{c.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="guide-note">
          Only one category applies. A circuit hit is checked first, then low-cap momentum, large-cap leader,
          high activity and thin liquidity.
        </p>
        <ul className="guide-colours">
          {CATEGORY_COLOURS.map((c) => (
            <li key={c.tone}>
              <span className="verdict-category" data-tone={c.tone}>{c.label}</span> {c.meaning}
            </li>
          ))}
        </ul>
      </div>

      <div className="guide-card">
        <h2>Verdict statements</h2>
        <div className="trending-table-wrap">
          <table className="trending-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Statement</th>
                <th>Rule</th>
              </tr>
            </thead>
            <tbody>
              {STATEMENTS.map((s) => (
                <tr key={s.text}>
                  <td className="muted">{s.group}</td>
                  <td className="guide-wrap">
                    <span className={`verdict-${s.tone}`}>{s.text}</span>
                  </td>
                  <td className="guide-wrap">{s.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="guide-card">
        <h2>Report fields</h2>
        <div className="trending-table-wrap">
          <table className="trending-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Shown in</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((f) => (
                <tr key={f.name}>
                  <td><strong>{f.name}</strong></td>
                  <td className="muted">{f.column}</td>
                  <td className="guide-wrap">{f.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="guide-card">
        <h2>Suggested routine</h2>
        <ol className="guide-steps">
          {ROUTINE.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="guide-note">
          Verdicts describe what already happened today. They are a shortlist aid, not financial advice.
        </p>
      </div>
    </section>
  )
}
