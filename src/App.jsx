import Header from './components/Header.jsx'
import Toolbar from './components/Toolbar.jsx'
import IpoGrid from './components/IpoGrid.jsx'
import IpoSkeleton from './components/IpoSkeleton.jsx'
import AnalysisModal from './components/AnalysisModal.jsx'
import StockAnalyzer from './components/StockAnalyzer.jsx'
import TrendingStocks from './components/TrendingStocks.jsx'
import { useIpos } from './hooks/useIpos.js'
import { useAnalysis } from './hooks/useAnalysis.js'
import { useStockAnalysis } from './hooks/useStockAnalysis.js'
import { useTheme } from './hooks/useTheme.js'
import { ICONS } from './constants/ui.js'
import { useState, useEffect } from 'react'

export default function App() {
  const { ipos, source, loading, error, filter, setFilter, search, setSearch, filtered, counts } = useIpos()
  const { analysis, analyzing, streaming, analyze, close } = useAnalysis()
  const stockAnalysis = useStockAnalysis()
  const { theme, toggle } = useTheme()
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('view') || 'ipos'
    } catch {
      return 'ipos'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('view', view)
    } catch {
      // ignore storage errors
    }
  }, [view])

  return (
    <div className="app">
      <Header source={source} count={ipos.length} theme={theme} onToggleTheme={toggle} view={view} />

      <nav className="view-nav">
        <button
          className={`view-tab ${view === 'ipos' ? 'active' : ''}`}
          onClick={() => setView('ipos')}
        >
          {ICONS.ipos} IPOs
        </button>
        <button
          className={`view-tab ${view === 'trending' ? 'active' : ''}`}
          onClick={() => setView('trending')}
        >
          {ICONS.trending} Trending
        </button>
        <button
          className={`view-tab ${view === 'stocks' ? 'active' : ''}`}
          onClick={() => setView('stocks')}
        >
          {ICONS.stocks} Stock Analysis
        </button>
      </nav>

      {view === 'stocks' ? (
        <StockAnalyzer {...stockAnalysis} />
      ) : view === 'trending' ? (
        <TrendingStocks />
      ) : (
        <>
          <Toolbar search={search} onSearch={setSearch} filter={filter} onFilter={setFilter} counts={counts} />

          {error && <p className="error">{error}</p>}
          {!loading && !error && !filtered.length && <p className="info">No IPOs match your filter.</p>}

          {loading ? (
            <IpoSkeleton />
          ) : (
            <IpoGrid ipos={filtered} analyzing={analyzing} onAnalyze={analyze} />
          )}

          <AnalysisModal analysis={analysis} streaming={streaming} onClose={close} />
        </>
      )}
    </div>
  )
}
