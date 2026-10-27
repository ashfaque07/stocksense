// App header: title, source link and live badge.

import { ICONS } from '../constants/ui.js'
import ModelSelector from './ModelSelector.jsx'

const HEADINGS = {
  ipos: {
    title: 'IPO Analyzer',
    logo: ICONS.ipos,
    subtitle: (
      <>
        <span>Live IPO data (GMP, rating, dates &amp; more) from {' '}</span>
        <a href="https://www.investorgain.com/report/ipo-gmp-live/331/" target="_blank" rel="noreferrer">
          InvestorGain Live IPO GMP
        </a>
      </>
    )
  },
  stocks: {
    title: 'Stock Analysis',
    logo: ICONS.stocks,
    subtitle: 'AI-powered fundamental analysis for any listed stock.'
  },
  trending: {
    title: 'Trending Stocks',
    logo: ICONS.trending,
    subtitle: 'Live NSE top gainers & losers, auto refreshed through the trading day.'
  },
  results: {
    title: 'Upcoming Results',
    logo: ICONS.results,
    subtitle: 'Upcoming NSE board meetings to consider quarterly & annual financial results.'
  }
}

export default function Header({ view = 'ipos', source, count, theme, onToggleTheme, onOpenNav }) {
  const heading = HEADINGS[view] || HEADINGS.ipos

  return (
    <header>
      <div className="header-actions">
        <button
          className="nav-toggle"
          onClick={onOpenNav}
          aria-label="Open navigation"
        >
          {ICONS.menu}
        </button>
        <ModelSelector />
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? ICONS.light : ICONS.dark}
        </button>
      </div>
      <h1>
        <span className="logo">{heading.logo}</span>{' '}
        <span className="title-text">{heading.title}</span>
      </h1>
      <p className="subtitle">
        {heading.subtitle}
        {view === 'ipos' && source === 'live' && <span className="badge">Live · {count} IPOs</span>}
      </p>
    </header>
  )
}
