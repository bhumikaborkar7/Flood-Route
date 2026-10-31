import { useState } from 'react'

const API_URL = 'http://127.0.0.1:8000'

export default function AlgorithmComparison({ source, destination, scenario }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function runComparison() {
    setLoading(true)
    setError('')
    setResult(null)

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

      setResult(await response.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const d = result?.dijkstra
  const a = result?.astar
  const win = (mine, other) => (mine < other ? 'win' : '')

  return (
    <section className="algo-compare">
      <div className="network-head">
        <h2>Algorithm comparison</h2>
        <span className="algorithm-tag">Dijkstra vs A*</span>
      </div>

      <button
        className="primary"
        onClick={runComparison}
        disabled={loading || !source || !destination}
      >
        {loading ? 'Comparing…' : 'Compare Dijkstra vs A*'}
      </button>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <table className="algo-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Dijkstra</th>
                <th>A*</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total cost (min)</td>
                <td>{d.total_cost}</td>
                <td>{a.total_cost}</td>
              </tr>
              <tr>
                <td>Nodes expanded</td>
                <td className={win(d.nodes_expanded, a.nodes_expanded)}>
                  {d.nodes_expanded}
                </td>
                <td className={win(a.nodes_expanded, d.nodes_expanded)}>
                  {a.nodes_expanded}
                </td>
              </tr>
              <tr>
                <td>Time (ms)</td>
                <td className={win(d.time_ms, a.time_ms)}>{d.time_ms}</td>
                <td className={win(a.time_ms, d.time_ms)}>{a.time_ms}</td>
              </tr>
            </tbody>
          </table>

          <div className="algo-stats">
            <div className={`algo-stat ${result.same_cost ? 'ok' : 'bad'}`}>
              <span>Same cost</span>
              <strong>{result.same_cost ? 'Yes' : 'No'}</strong>
            </div>
            <div className="algo-stat">
              <span>Nodes saved</span>
              <strong>{result.nodes_saved_percent}%</strong>
            </div>
            <div className="algo-stat">
              <span>Speedup</span>
              <strong>{result.speedup}×</strong>
            </div>
          </div>

          <p className="network-note">
            A* uses a straight-line distance estimate to skip nodes that are
            moving away from the destination. Both algorithms return the same
            optimal cost.
          </p>
        </>
      )}
    </section>
  )
}