// Replays a recorded search on a Leaflet map.
// Dijkstra plays first, then A*, then each draws its final route.
// Returns a cancel() function that removes everything it drew.

const STYLES = {
 dijkstra: { color: '#9b6bff', label: 'Dijkstra' },
  astar: { color: '#1fd1b5', label: 'A*' },
}

export function playSearch(L, map, data, { frames = 360, onProgress, onDone } = {}) {
  const renderer = L.canvas({ padding: 0.5 })
  const layer = L.layerGroup().addTo(map)
  let cancelled = false
  let rafId = null

  function playOne(key, next) {
    const { explored, path } = data[key]
    const { color } = STYLES[key]
    const perFrame = Math.max(1, Math.ceil(explored.length / frames))
    let index = 0

    layer.clearLayers()

    function step() {
      if (cancelled) return

      const end = Math.min(index + perFrame, explored.length)

      for (; index < end; index++) {
        L.circleMarker(explored[index], {
          renderer,
          radius: 2,
          stroke: false,
          fillColor: color,
          fillOpacity: 0.7,
        }).addTo(layer)
      }

      onProgress?.({ algorithm: key, label: STYLES[key].label, done: index, total: explored.length })

      if (index < explored.length) {
        rafId = requestAnimationFrame(step)
      } else {
        if (path.length) {
          L.polyline(path, { color: '#ffffff', weight: 4, opacity: 0.95 }).addTo(layer)
        }
        setTimeout(() => !cancelled && next(), 1500)
      }
    }

    step()
  }

  playOne('dijkstra', () => playOne('astar', () => onDone?.()))

  return function cancel() {
    cancelled = true
    if (rafId) cancelAnimationFrame(rafId)
    layer.remove()
  }
}