import Header from './components/Header.jsx'
import Sidebar from './components/Sidebar.jsx'
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
    <div className="app-shell">
      <Sidebar view={view} onSelect={setView} />

      <div className="app">
      <Header source={source} count={ipos.length} theme={theme} onToggleTheme={toggle} view={view} />

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
    </div>
  )
}
