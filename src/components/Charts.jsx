import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts'
import { PALETTE } from '../lib/labels.js'
import { useT } from '../lib/i18n.jsx'

const axisStyle = { fontSize: 12, fill: 'var(--muted)' }
const gridStroke = 'var(--grid)'

function EmptyNote() {
  const { t } = useT()
  return <div className="chart-empty">{t('No data')}</div>
}

const tooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 13,
  color: 'var(--text)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
}

export function ChartCard({ title, subtitle, children, wide = false, height = 300 }) {
  const { t } = useT()
  return (
    <div className={`card chart-card ${wide ? 'span-2' : ''}`}>
      <div className="chart-head">
        <h3>{t(title)}</h3>
        {subtitle && <span className="chart-sub">{t(subtitle)}</span>}
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
    </div>
  )
}

export function AreaTrend({ data, color = '#c0102f' }) {
  if (!data || data.length === 0) return <EmptyNote />
  return (
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} minTickGap={28} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={38} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--muted)' }} />
        <Area
          type="monotone"
          dataKey="value"
          name="Count"
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${color})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function pick(d) {
  return d && d.payload ? d.payload : d
}

export function HBar({ data, color = '#3b82f6', onSelect }) {
  if (!data || data.length === 0) return <EmptyNote />
  return (
    <ResponsiveContainer>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
        <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          width={130}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--hover)' }} />
        <Bar
          dataKey="value"
          name="Count"
          radius={[0, 6, 6, 0]}
          isAnimationActive={false}
          onClick={onSelect ? (d) => onSelect(pick(d)) : undefined}
          className={onSelect ? 'clickable-chart' : undefined}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Donut({ data, onSelect }) {
  if (!data || data.length === 0) return <EmptyNote />
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          isAnimationActive={false}
          onClick={onSelect ? (d) => onSelect(pick(d)) : undefined}
          className={onSelect ? 'clickable-chart' : undefined}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// Colored variant used for the stage breakdown (green/blue/red have meaning).
export function StageBars({ data }) {
  if (!data || data.length === 0) return <EmptyNote />
  const colorFor = (name) => {
    if (name.includes('Won')) return '#16a34a'
    if (name.includes('Lost')) return '#dc2626'
    if (name.includes('Progress')) return '#3b82f6'
    return '#94a3b8'
  }
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--hover)' }} />
        <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorFor(d.name)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
