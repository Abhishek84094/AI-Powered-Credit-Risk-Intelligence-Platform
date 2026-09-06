import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import {
  Users, TrendingDown, AlertTriangle, CheckCircle,
  ArrowUpRight, Target, BookOpen, Database
} from 'lucide-react'
import { getEdaInsights, getEdaSummary } from '../services/api'

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']

function MetricCard({ title, value, subtitle, icon: Icon, color = '#6366f1', trend }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="metric-card glass rounded-2xl p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</p>
          <p className="text-3xl font-bold mt-2" style={{ color, fontFamily: 'Space Grotesk' }}>
            {value}
          </p>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-1.5 text-xs">
          <ArrowUpRight className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400">{trend}</span>
        </div>
      )}
    </motion.div>
  )
}

function InsightCard({ insight, index }) {
  const colors = {
    HIGH: '#ef4444', MEDIUM: '#f59e0b', LOW: '#10b981'
  }
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="glass-light rounded-xl p-5 border-l-4"
      style={{ borderLeftColor: COLORS[index % COLORS.length] }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${COLORS[index % COLORS.length]}20` }}>
          <span className="text-xs font-bold" style={{ color: COLORS[index % COLORS.length] }}>
            {insight.id}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-100 text-sm">{insight.title}</h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{insight.finding}</p>
          <p className="text-xs text-gray-600 mt-2 italic">⚠ {insight.limitation}</p>
        </div>
      </div>
    </motion.div>
  )
}

function AgeDefaultChart({ insights }) {
  const ageInsight = insights?.find(i => i.id === 'BI-01')
  if (!ageInsight) return null
  const data = ageInsight.evidence.map(e => ({
    age: e.age_group,
    rate: (e.default_rate * 100).toFixed(1),
    count: e.count,
  }))
  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-semibold text-gray-100 mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-indigo-400" />
        Default Rate by Age Group
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="age" tick={{ fill: '#6b7280', fontSize: 11 }} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => `${v}%`} />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
            formatter={(val) => [`${val}%`, 'Default Rate']}
          />
          <Bar dataKey="rate" fill="url(#ageGradient)" radius={[4, 4, 0, 0]} />
          <defs>
            <linearGradient id="ageGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ExtSourceChart({ insights }) {
  const extInsight = insights?.find(i => i.id === 'BI-02')
  if (!extInsight) return null
  const data = Object.entries(extInsight.evidence).map(([key, val]) => ({
    source: key,
    defaulter: val.defaulter_mean.toFixed(3),
    nonDefaulter: val.non_defaulter_mean.toFixed(3),
  }))
  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-semibold text-gray-100 mb-4 flex items-center gap-2">
        <TrendingDown className="w-5 h-5 text-cyan-400" />
        External Credit Scores: Defaulters vs Non-Defaulters
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="source" tick={{ fill: '#6b7280', fontSize: 11 }} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={[0.3, 0.6]} />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
          <Bar dataKey="nonDefaulter" name="Non-Defaulter" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="defaulter" name="Defaulter" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TargetDistributionChart({ target }) {
  if (!target) return null
  const data = [
    { name: 'Non-Default', value: target.non_defaulters, color: '#10b981' },
    { name: 'Default', value: target.defaulters, color: '#ef4444' },
  ]
  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="font-semibold text-gray-100 mb-4 flex items-center gap-2">
        <Database className="w-5 h-5 text-purple-400" />
        Target Distribution (Class Imbalance)
      </h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width="50%" height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
              paddingAngle={3} dataKey="value">
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
              formatter={v => v.toLocaleString()}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-4">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
              <div>
                <p className="text-sm font-medium text-gray-200">{d.name}</p>
                <p className="text-xs text-gray-500">{d.value.toLocaleString()}</p>
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-500">Imbalance Ratio</p>
            <p className="text-lg font-bold text-amber-400">
              {target.imbalance_ratio?.toFixed(1)}:1
            </p>
          </div>
        </div>
      </div>
    </div>
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

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 text-sm">Loading EDA data...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="p-8">
      <div className="glass rounded-2xl p-6 border border-red-500/20">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <div>
            <p className="font-semibold text-red-400">Failed to load EDA data</p>
            <p className="text-sm text-gray-400 mt-1">{error}</p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold gradient-text"
          style={{ fontFamily: 'Space Grotesk' }}
        >
          Exploratory Data Analysis
        </motion.h1>
        <p className="text-gray-400 mt-1 text-sm">
          Home Credit Default Risk — 307,511 applicants · 8 data tables
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Applicants"
          value={target ? (target.total_applicants / 1000).toFixed(0) + 'K' : '—'}
          subtitle="Labeled training records"
          icon={Users}
          color="#6366f1"
        />
        <MetricCard
          title="Default Rate"
          value={target ? `${target.default_rate_pct}%` : '—'}
          subtitle="Class 1 (positive)"
          icon={AlertTriangle}
          color="#ef4444"
        />
        <MetricCard
          title="Class Imbalance"
          value={target ? `${target.imbalance_ratio?.toFixed(1)}:1` : '—'}
          subtitle="Non-default to default"
          icon={TrendingDown}
          color="#f59e0b"
        />
        <MetricCard
          title="Data Tables"
          value="8"
          subtitle="Integrated data sources"
          icon={Database}
          color="#10b981"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AgeDefaultChart insights={insights} />
        </div>
        <TargetDistributionChart target={target} />
      </div>

      {/* External Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExtSourceChart insights={insights} />

        {/* Dataset overview */}
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold text-gray-100 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Dataset Overview
          </h3>
          <div className="space-y-3">
            {Object.entries(tables).slice(0, 5).map(([name, info]) => (
              <div key={name} className="flex items-center justify-between py-2 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span className="text-xs text-gray-300 font-mono">{name}</span>
                </div>
                <span className="text-xs text-gray-500">{info.rows?.toLocaleString()} rows</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Business Insights */}
      <div>
        <h2 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-emerald-400" />
          Evidence-Based Business Insights
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {insights.map((insight, i) => (
            <InsightCard key={insight.id} insight={insight} index={i} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
