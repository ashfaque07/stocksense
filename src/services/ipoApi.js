// API client for the StockSense proxy server.

export async function fetchIpos() {
  const res = await fetch('/api/ipos')
  return res.json()
}
