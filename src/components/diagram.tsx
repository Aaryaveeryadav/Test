import type { DiagramData } from '@/lib/ai/diagram-schema'

/**
 * Renders diagrams from validated structured data (DiagramSchema).
 * The model can only supply numbers, ids and labels — never markup — so this
 * output is safe by construction. Each figure carries an alt description.
 */

const W = 400
const H = 300

function Figure({ data, children }: { data: DiagramData; children: React.ReactNode }) {
  return (
    <figure className="my-3 rounded-xl border border-slate-200 bg-white p-3">
      <figcaption className="mb-1 text-sm font-semibold text-slate-700">{data.title}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full max-w-xl"
        role="img"
        aria-label={data.alt}
        preserveAspectRatio="xMidYMid meet"
      >
        {children}
      </svg>
      <figcaption className="mt-1 text-xs text-slate-500">{data.alt}</figcaption>
    </figure>
  )
}

function GeometryDiagram({ data }: { data: Extract<DiagramData, { type: 'geometry' }> }) {
  const xs = data.points.map((p) => p.x)
  const ys = data.points.map((p) => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const pad = 40
  const scale = (v: number, min: number, span: number, size: number) =>
    pad + ((v - min) / span) * (size - 2 * pad)
  const px = (x: number) => scale(x, minX, spanX, W)
  const py = (y: number) => H - pad - ((y - minY) / spanY) * (H - 2 * pad)
  const pointMap = new Map(data.points.map((p) => [p.id, { x: px(p.x), y: py(p.y), label: p.label }]))

  return (
    <Figure data={data}>
      {data.segments.map((s, i) => {
        const a = pointMap.get(s.from)
        const b = pointMap.get(s.to)
        if (!a || !b) return null
        return (
          <g key={i}>
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#4f46e5" strokeWidth={2} strokeDasharray={s.dashed ? '6 4' : undefined}
            />
            {s.label ? (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} textAnchor="middle" fontSize="11" fill="#475569">
                {s.label}
              </text>
            ) : null}
          </g>
        )
      })}
      {data.right_angles.map((ra, i) => {
        const p = pointMap.get(ra.at)
        if (!p) return null
        return <rect key={i} x={p.x} y={p.y - 10} width={10} height={10} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
      })}
      {data.points.map((p) => {
        const pos = pointMap.get(p.id)!
        return (
          <g key={p.id}>
            <circle cx={pos.x} cy={pos.y} r={4} fill="#312e81" />
            {p.label ? (
              <text x={pos.x + 7} y={pos.y - 7} fontSize="12" fontWeight="600" fill="#1e293b">
                {p.label}
              </text>
            ) : null}
          </g>
        )
      })}
    </Figure>
  )
}

function GraphDiagram({ data }: { data: Extract<DiagramData, { type: 'graph' }> }) {
  const pad = 40
  const spanX = Math.max(data.x_max - data.x_min, 1e-9)
  const spanY = Math.max(data.y_max - data.y_min, 1e-9)
  const gx = (v: number) => pad + ((v - data.x_min) / spanX) * (W - 2 * pad)
  const gy = (v: number) => H - pad - ((v - data.y_min) / spanY) * (H - 2 * pad)
  const colors = ['#4f46e5', '#e11d48', '#0d9488', '#d97706', '#7c3aed', '#0284c7']

  return (
    <Figure data={data}>
      {/* grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={`v${f}`} x1={gx(data.x_min + f * spanX)} y1={pad} x2={gx(data.x_min + f * spanX)} y2={H - pad} stroke="#e2e8f0" />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line key={`h${f}`} x1={pad} y1={gy(data.y_min + f * spanY)} x2={W - pad} y2={gy(data.y_min + f * spanY)} stroke="#e2e8f0" />
      ))}
      {/* axes */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#334155" strokeWidth={1.5} />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#334155" strokeWidth={1.5} />
      <text x={W - pad + 4} y={H - pad + 4} fontSize="11" fill="#475569">{data.x_label}</text>
      <text x={pad - 28} y={pad - 12} fontSize="11" fill="#475569">{data.y_label}</text>
      <text x={gx(data.x_min) - 14} y={H - pad + 14} fontSize="10" fill="#64748b">{data.x_min}</text>
      <text x={gx(data.x_max) - 10} y={H - pad + 14} fontSize="10" fill="#64748b">{data.x_max}</text>
      <text x={pad - 26} y={gy(data.y_min) + 4} fontSize="10" fill="#64748b">{data.y_min}</text>
      <text x={pad - 26} y={gy(data.y_max) + 4} fontSize="10" fill="#64748b">{data.y_max}</text>
      {/* series */}
      {data.series.map((s, i) => (
        <g key={i}>
          <polyline
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '6 4' : undefined}
            points={s.points.map((p) => `${gx(p.x)},${gy(p.y)}`).join(' ')}
          />
          {s.label ? (
            <text x={W - pad - 100} y={pad + 14 + i * 14} fontSize="11" fill={colors[i % colors.length]}>
              — {s.label}
            </text>
          ) : null}
        </g>
      ))}
    </Figure>
  )
}

function TimelineDiagram({ data }: { data: Extract<DiagramData, { type: 'timeline' }> }) {
  const pad = 30
  const y = H / 2
  const n = data.events.length
  return (
    <Figure data={data}>
      <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="#334155" strokeWidth={2} />
      <polygon points={`${W - pad},${y} ${W - pad - 10},${y - 5} ${W - pad - 10},${y + 5}`} fill="#334155" />
      {data.events.map((e, i) => {
        const x = pad + ((i + 1) / (n + 1)) * (W - 2 * pad)
        const above = i % 2 === 0
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={5} fill="#4f46e5" />
            <line x1={x} y1={above ? y - 8 : y + 8} x2={x} y2={above ? y - 30 : y + 30} stroke="#cbd5e1" />
            <text x={x} y={above ? y - 36 : y + 44} textAnchor="middle" fontSize="11" fontWeight="600" fill="#1e293b">
              {e.when}
            </text>
            <text x={x} y={above ? y - 22 : y + 58} textAnchor="middle" fontSize="10" fill="#475569">
              {e.label.length > 28 ? e.label.slice(0, 27) + '…' : e.label}
            </text>
          </g>
        )
      })}
    </Figure>
  )
}

function NetworkDiagram({
  data,
  variant
}: {
  data: Extract<DiagramData, { type: 'concept_map' }> | Extract<DiagramData, { type: 'circuit' }>
  variant: 'concept' | 'circuit'
}) {
  const cx = W / 2
  const cy = H / 2
  const r = Math.min(W, H) / 2 - 55
  const pos = new Map(
    data.nodes.map((nd, i) => {
      const angle = (i / data.nodes.length) * Math.PI * 2 - Math.PI / 2
      return [nd.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }]
    })
  )
  return (
    <Figure data={data}>
      {data.edges.map((e, i) => {
        const a = pos.get(e.from)
        const b = pos.get(e.to)
        if (!a || !b) return null
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const component = 'component' in e ? e.component : 'wire'
        return (
          <g key={i}>
            {variant === 'concept' ? (
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#94a3b8" strokeWidth={1.5} />
            ) : (
              <CircuitEdge x1={a.x} y1={a.y} x2={b.x} y2={b.y} component={component} />
            )}
            {e.label ? (
              <text x={mx} y={my - 4} textAnchor="middle" fontSize="10" fill="#64748b">
                {e.label}
              </text>
            ) : null}
          </g>
        )
      })}
      {data.nodes.map((nd) => {
        const p = pos.get(nd.id)!
        const label = nd.label ?? ''
        return (
          <g key={nd.id}>
            {variant === 'concept' ? (
              <>
                <ellipse cx={p.x} cy={p.y} rx={Math.max(label.length * 3.6 + 10, 30)} ry={16} fill="#eef2ff" stroke="#4f46e5" />
                <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fill="#312e81">
                  {label}
                </text>
              </>
            ) : (
              <>
                <circle cx={p.x} cy={p.y} r={4} fill="#334155" />
                {label ? (
                  <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="11" fill="#1e293b">
                    {label}
                  </text>
                ) : null}
              </>
            )}
          </g>
        )
      })}
    </Figure>
  )
}

function CircuitEdge({
  x1, y1, x2, y2, component
}: {
  x1: number; y1: number; x2: number; y2: number
  component: 'wire' | 'battery' | 'resistor' | 'bulb' | 'switch'
}) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  const glyph = () => {
    switch (component) {
      case 'battery':
        return (
          <g transform={`translate(${mx} ${my}) rotate(${angle})`}>
            <line x1={-3} y1={-8} x2={-3} y2={8} stroke="#334155" strokeWidth={2} />
            <line x1={3} y1={-4} x2={3} y2={4} stroke="#334155" strokeWidth={2} />
          </g>
        )
      case 'resistor':
        return (
          <g transform={`translate(${mx} ${my}) rotate(${angle})`}>
            <polyline points="-12,0 -8,-5 -4,5 0,-5 4,5 8,-5 12,0" fill="none" stroke="#334155" strokeWidth={1.6} />
          </g>
        )
      case 'bulb':
        return (
          <g transform={`translate(${mx} ${my})`}>
            <circle r={8} fill="#fff7ed" stroke="#c2410c" strokeWidth={1.6} />
            <line x1={-5.6} y1={-5.6} x2={5.6} y2={5.6} stroke="#c2410c" strokeWidth={1.4} />
            <line x1={-5.6} y1={5.6} x2={5.6} y2={-5.6} stroke="#c2410c" strokeWidth={1.4} />
          </g>
        )
      case 'switch':
        return (
          <g transform={`translate(${mx} ${my}) rotate(${angle})`}>
            <circle cx={-8} cy={0} r={2} fill="#334155" />
            <circle cx={8} cy={0} r={2} fill="#334155" />
            <line x1={-8} y1={0} x2={5} y2={-6} stroke="#334155" strokeWidth={1.6} />
          </g>
        )
      default:
        return null
    }
  }
  return (
    <g>
      {component === 'wire' ? (
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth={1.8} />
      ) : (
        <>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth={1.8} strokeDasharray="1 0" opacity={0.25} />
          {glyph()}
        </>
      )}
    </g>
  )
}

export function Diagram({ data }: { data: DiagramData }) {
  switch (data.type) {
    case 'geometry':
      return <GeometryDiagram data={data} />
    case 'graph':
      return <GraphDiagram data={data} />
    case 'timeline':
      return <TimelineDiagram data={data} />
    case 'concept_map':
      return <NetworkDiagram data={data} variant="concept" />
    case 'circuit':
      return <NetworkDiagram data={data} variant="circuit" />
    default:
      return null
  }
}
