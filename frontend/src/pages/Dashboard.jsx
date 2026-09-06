import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { getEdaInsights, getEdaSummary } from '../services/api'
import { TerminalCard, AsciiDivider, RiskBadge, sanitizeText } from '../components/TerminalUI'

function MetricTile({ title, value, subtitle, tag, statusColor = '#39d98a' }) {
  return (
    <div className="bg-[#0a0f0c] border border-[#1c2a20] p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between text-xs text-[#5f7a66]">
        <span className="font-bold tracking-wider">{title}</span>
        {tag && <span className="font-mono text-[11px]" style={{ color: statusColor }}>[{tag}]</span>}
      </div>
      <div className="my-2">
        <div className="text-2xl font-bold font-mono tracking-tight" style={{ color: statusColor }}>
          {value}
        </div>
        {subtitle && <p className="text-[11px] text-[#5f7a66] mt-0.5">{subtitle}</p>}
      </div>
      <div className="text-[10px] text-[#1c2a20] font-mono select-none">
        ───────────────────────
      </div>
    </div>
  )
}

function AgeDefaultChart({ insights }) {
  const ageInsight = insights?.find(i => i.id === 'BI-01')
  if (!ageInsight) return null
  const data = ageInsight.evidence.map(e => ({
    age: e.age_group,
    rate: parseFloat((e.default_rate * 100).toFixed(1)),
    count: e.count,
  }))

  return (
    <TerminalCard title="DEFAULT RATE DISTRIBUTION BY AGE GROUP [BI-01]">
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#1c2a20" vertical={false} />
            <XAxis
              dataKey="age"
              stroke="#5f7a66"
              tick={{ fill: '#5f7a66', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            />
            <YAxis
              stroke="#5f7a66"
              tick={{ fill: '#5f7a66', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0a0f0c',
                border: '1px solid #1c2a20',
                borderRadius: '0px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: '#d7ecd9',
              }}
              formatter={(val) => [`${val}%`, 'Default Rate']}
            />
            <Bar dataKey="rate" fill="#39d98a" radius={[0, 0, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 pt-2 border-t border-[#1c2a20] text-[11px] text-[#5f7a66]">
        Observation: Youngest bracket (&lt;25) experiences default rate of 12.3%, declining monotonically with applicant age.
      </div>
    </TerminalCard>
  )
}

function ExtSourceChart({ insights }) {
  const extInsight = insights?.find(i => i.id === 'BI-02')
  if (!extInsight) return null
  const data = Object.entries(extInsight.evidence).map(([key, val]) => ({
    source: key,
    defaulter: parseFloat(val.defaulter_mean.toFixed(3)),
    nonDefaulter: parseFloat(val.non_defaulter_mean.toFixed(3)),
  }))

  return (
    <TerminalCard title="EXTERNAL CREDIT SCORES: NON-DEFAULTER VS DEFAULTER [BI-02]">
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#1c2a20" vertical={false} />
            <XAxis
              dataKey="source"
              stroke="#5f7a66"
              tick={{ fill: '#5f7a66', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            />
            <YAxis
              stroke="#5f7a66"
              tick={{ fill: '#5f7a66', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              domain={[0.2, 0.6]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0a0f0c',
                border: '1px solid #1c2a20',
                borderRadius: '0px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
                color: '#d7ecd9',
              }}
            />
            <Legend
              wrapperStyle={{
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
                paddingTop: '8px'
              }}
            />
            <Bar dataKey="nonDefaulter" name="Non-Defaulter" fill="#39d98a" radius={[0, 0, 0, 0]} />
            <Bar dataKey="defaulter" name="Defaulter" fill="#ff5c5c" radius={[0, 0, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 pt-2 border-t border-[#1c2a20] text-[11px] text-[#5f7a66]">
        Discriminant power: External bureaus provide key orthogonal signal (non-defaulters score ~30% higher).
      </div>
    </TerminalCard>
  )
}

function TargetDistributionChart({ target }) {
  if (!target) return null
  const data = [
    { name: 'Non-Default', value: target.non_defaulters, color: '#39d98a' },
    { name: 'Default', value: target.defaulters, color: '#ff5c5c' },
  ]

  return (
    <TerminalCard title="POPULATION TARGET DISTRIBUTION (CLASS IMBALANCE)">
      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 h-60">
        <div className="w-44 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={68}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0f0c',
                  border: '1px solid #1c2a20',
                  borderRadius: '0px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                  color: '#d7ecd9',
                }}
                formatter={v => v.toLocaleString()}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3 font-mono text-xs w-full sm:w-auto">
          {data.map((d) => (
            <div key={d.name} className="flex items-center justify-between sm:justify-start gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5" style={{ backgroundColor: d.color }}></span>
                <span className="text-[#d7ecd9]">{d.name}:</span>
              </div>
              <span className="text-[#5f7a66]">{d.value.toLocaleString()}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-[#1c2a20]">
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <span className="text-[#5f7a66]">RATIO:</span>
              <span className="text-[#e8b339] font-bold">
                {target.imbalance_ratio ? target.imbalance_ratio.toFixed(1) : '11.4'}:1
              </span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <span className="text-[#5f7a66]">DEFAULT RATE:</span>
              <span className="text-[#ff5c5c] font-bold">
                {target.default_rate_pct ? `${target.default_rate_pct}%` : '8.07%'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </TerminalCard>
  )
}

export default function Dashboard() {
  const [insights, setInsights] = useState([])
  const [target, setTarget] = useState(null)
  const [tables, setTables] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([getEdaInsights(), getEdaSummary()])
      .then(([ins, summary]) => {
        setInsights(ins.business_insights || [])
        setTarget(ins.target || summary.target)
        setTables(summary.tables || {})
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="p-8 font-mono text-xs text-[#5f7a66]">
        &gt; Fetching analytical EDA summaries and distribution vectors...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 font-mono text-xs text-[#ff5c5c] bg-[#0a0f0c] border border-[#ff5c5c]/40 m-6">
        [ERROR] Failed to load analytical EDA telemetry: {error}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="border border-[#1c2a20] bg-[#0a0f0c] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs text-[#5f7a66] uppercase tracking-wider">
              TELEMETRY MODULE // EDA ANALYTICS
            </div>
            <h1 className="text-lg font-bold text-[#d7ecd9] mt-0.5">
              EXPLORATORY DATA ANALYSIS &amp; POPULATION PROFILE
            </h1>
          </div>
          <div className="text-xs text-[#5f7a66]">
            HOME CREDIT DATASET: 307,511 APPLICANTS · 8 INTEGRATED TABLES
          </div>
        </div>
      </div>

      {/* Key Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          title="TOTAL APPLICANTS"
          value={target ? (target.total_applicants / 1000).toFixed(0) + 'K' : '308K'}
          subtitle="Labeled primary population"
          tag="N=307,511"
          statusColor="#39d98a"
        />
        <MetricTile
          title="DEFAULT RATE"
          value={target ? `${target.default_rate_pct}%` : '8.07%'}
          subtitle="Class 1 default event"
          tag="SIGNAL"
          statusColor="#ff5c5c"
        />
        <MetricTile
          title="CLASS IMBALANCE"
          value={target ? `${target.imbalance_ratio?.toFixed(1)}:1` : '11.4:1'}
          subtitle="Skew mitigation applied"
          tag="SCALE_POS"
          statusColor="#e8b339"
        />
        <MetricTile
          title="INTEGRATED TABLES"
          value="8"
          subtitle="Bureau, Pos, Installments"
          tag="RELATIONAL"
          statusColor="#39d98a"
        />
      </div>

      <AsciiDivider label="POPULATION & BEHAVIORAL DISTRIBUTIONS" />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgeDefaultChart insights={insights} />
        <TargetDistributionChart target={target} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ExtSourceChart insights={insights} />
        </div>

        {/* Database relational catalog */}
        <TerminalCard title="RELATIONAL DATASET INVENTORY">
          <div className="space-y-2 text-xs font-mono">
            {Object.entries(tables).slice(0, 7).map(([name, info]) => (
              <div key={name} className="flex items-center justify-between py-1 border-b border-[#1c2a20]">
                <span className="text-[#d7ecd9]">{name}</span>
                <span className="text-[#5f7a66]">{info.rows?.toLocaleString()} rows</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-[#1c2a20] text-[10px] text-[#5f7a66]">
            Features aggregated across temporal windows with mean, max, and sum aggregations.
          </div>
        </TerminalCard>
      </div>

      <AsciiDivider label="EVIDENCE-BASED BUSINESS INSIGHTS" />

      {/* Business Insights Monospace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="bg-[#0a0f0c] border border-[#1c2a20] p-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#1c2a20] pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[#39d98a] font-bold text-xs">[{insight.id}]</span>
                  <span className="text-xs font-bold text-[#d7ecd9]">{insight.title}</span>
                </div>
                <RiskBadge level={insight.id === 'BI-01' || insight.id === 'BI-02' ? 'HIGH' : 'MEDIUM'} />
              </div>
              <p className="text-xs text-[#d7ecd9] leading-relaxed">
                {sanitizeText(insight.finding)}
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#1c2a20] text-[11px] text-[#5f7a66]">
              LIMITATION / BOUNDARY: {sanitizeText(insight.limitation)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
