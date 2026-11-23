// Squarified treemap (Bruls, Huizing, van Wijk): keeps tiles close to square so photos stay readable.
// nodes: [{ value > 0, ... }] → [{ node, x, y, w, h }] in the units of the given rectangle.
export function squarify (nodes, x, y, w, h) {
  const total = nodes.reduce((sum, n) => sum + n.value, 0)
  if (!total || w <= 0 || h <= 0) return []
  const scale = (w * h) / total
  const queue = nodes.map(node => ({ node, area: node.value * scale })).sort((a, b) => b.area - a.area)
  const out = []
  let rect = { x, y, w, h }

  const worst = (row, side) => {
    const sum = row.reduce((s, r) => s + r.area, 0)
    const max = Math.max(...row.map(r => r.area))
    const min = Math.min(...row.map(r => r.area))
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min))
  }

  const place = row => {
    const sum = row.reduce((s, r) => s + r.area, 0)
    if (rect.w >= rect.h) {
      const colW = sum / rect.h
      let cy = rect.y
      for (const r of row) {
        const rh = r.area / colW
        out.push({ node: r.node, x: rect.x, y: cy, w: colW, h: rh })
        cy += rh
      }
      rect = { x: rect.x + colW, y: rect.y, w: rect.w - colW, h: rect.h }
    } else {
      const rowH = sum / rect.w
      let cx = rect.x
      for (const r of row) {
        const rw = r.area / rowH
        out.push({ node: r.node, x: cx, y: rect.y, w: rw, h: rowH })
        cx += rw
      }
      rect = { x: rect.x, y: rect.y + rowH, w: rect.w, h: rect.h - rowH }
    }
  }

  let row = []
  for (const item of queue) {
    const side = Math.min(rect.w, rect.h)
    if (!row.length || worst([...row, item], side) <= worst(row, side)) {
      row.push(item)
    } else {
      place(row)
      row = [item]
    }
  }
  if (row.length) place(row)
  return out
}
