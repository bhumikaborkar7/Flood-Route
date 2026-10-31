import { useEffect, useRef, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export default function AlgorithmComparison({
  source,
  destination,
  scenario,
  auto = false,
  trigger = null,
}) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const latest = useRef(0)

  async function runComparison() {
    if (!source || !destination) return

    const id = ++latest.current
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/compare-algorithms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, destination, scenario }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || 'Comparison failed')
      }

      const data = await response.json()
      if (id === latest.current) setResult(data)
    } catch (err) {
      if (id === latest.current) {
        setResult(null)
        setError(err.message)
      }
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }

  // Re-run whenever new routes arrive, if auto-compare is on.
  useEffect(() => {
    if (auto && trigger) runComparison()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, trigger])

  // Only show a result that matches what is currently selected.
  const fresh =
    result &&
    result.source === source &&
    result.destination === destination &&
    result.scenario === scenario

  const d = fresh ? result.dijkstra : null
  const a = fresh ? result.astar : null
  const win = (mine, other) => (mine < other ? 'win' : '')

  return (
    <section className="card">
      <div className="card-head">
        <svg className="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M4 17a8 8 0 1 1 16 0M12 17l4-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <h2>Algorithm performance</h2>
        <span className="tag">Dijkstra vs A*</span>
      </div>

      {fresh ? (
        <>
          <table className="table algo">
            <thead>
              <tr>
                <th />
                <th>Dijkstra</th>
                <th>A*</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Route cost (min)</td>
                <td>{d.total_cost}</td>
                <td>{a.total_cost}</td>
              </tr>
              <tr>
                <td>Execution time</td>
                <td className={win(d.time_ms, a.time_ms)}>{d.time_ms} ms</td>
                <td className={win(a.time_ms, d.time_ms)}>{a.time_ms} ms</td>
              </tr>
              <tr>
                <td>Nodes explored</td>
                <td className={win(d.nodes_expanded, a.nodes_expanded)}>
                  {d.nodes_expanded.toLocaleString()}
                </td>
                <td className={win(a.nodes_expanded, d.nodes_expanded)}>
                  {a.nodes_expanded.toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>

          <p className="note">
            {result.same_cost ? 'Both find the same optimal cost.' : 'The costs differ.'}{' '}
            A* explored {result.nodes_saved_percent}% fewer nodes
            {result.speedup ? ` and ran ${result.speedup}× faster.` : '.'}
          </p>
        </>
      ) : (
        !loading &&
        !error && (
          <p className="hint">
            Run a comparison to see how many junctions each algorithm
            examines on this trip.
          </p>
        )
      )}

      {loading && <p className="hint">Comparing…</p>}
      {error && <p className="error">{error}</p>}

      <button
        type="button"
        className="outline"
        onClick={runComparison}
        disabled={loading || !source || !destination}
      >
        {fresh ? 'Run again' : 'Run comparison'}
      </button>
    </section>
  )
}