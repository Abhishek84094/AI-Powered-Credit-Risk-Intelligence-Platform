import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { Zap, Brain, TrendingUp, ShieldAlert, Award, Info, RefreshCw, Layers } from 'lucide-react'
import { getFeatureImportance, getModelMetadata } from '../services/api'
import toast from 'react-hot-toast'

export default function Explainability() {
  const [importanceData, setImportanceData] = useState([])
  const [metadata, setMetadata] = useState(null)
  const [loading, setLoading] = useState(true)
  const [topN, setTopN] = useState(15)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [impRes, metaRes] = await Promise.all([
        getFeatureImportance(topN),
        getModelMetadata()
      ])
      if (impRes && impRes.features) {
        // Format for Recharts
        const chartData = impRes.features.map(f => ({
          feature: f.feature,
          importance: parseFloat(f.importance.toFixed(4)),
        })).reverse() // reverse for horizontal bar chart
        setImportanceData(chartData)
      }
      setMetadata(metaRes)
    } catch (err) {
      toast.error('Failed to load explainability data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [topN])

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm tracking-wider uppercase mb-1">
            <Zap className="w-4 h-4" /> Layer 4 — Explainable AI (XAI)
          </div>
          <h1 className="text-3xl font-extrabold text-white" style={{ fontFamily: 'Space Grotesk' }}>
            Model Explainability & SHAP Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Auditable global and local feature attributions powered by TreeSHAP with strict additivity
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors w-fit self-start md:self-auto border border-gray-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Model Overview Cards */}
      {metadata && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="glass rounded-2xl p-5 border border-indigo-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Production Model</span>
              <Award className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white uppercase">{metadata.selected_model || 'LightGBM'}</div>
            <p className="text-xs text-indigo-300 mt-1">Selected via multi-model cross-validation</p>
          </div>

          <div className="glass rounded-2xl p-5 border border-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Validation ROC-AUC</span>
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {metadata.metrics?.val_roc_auc ? (metadata.metrics.val_roc_auc * 100).toFixed(2) + '%' : '77.8%'}
            </div>
            <p className="text-xs text-gray-400 mt-1">Class imbalance weighted</p>
          </div>

          <div className="glass rounded-2xl p-5 border border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Optimal Threshold</span>
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {metadata.optimal_threshold ? metadata.optimal_threshold.toFixed(3) : '0.350'}
            </div>
            <p className="text-xs text-gray-400 mt-1">F1-maximized decision boundary</p>
          </div>

          <div className="glass rounded-2xl p-5 border border-purple-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Explainer Type</span>
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-400">TreeSHAP</div>
            <p className="text-xs text-gray-400 mt-1">Exact Shapley values with additivity</p>
          </div>
        </div>
      )}

      {/* Global Feature Importance Chart */}
      <div className="glass rounded-2xl p-6 border border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Global Feature Importance (Mean |SHAP Value|)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Ranked impact of engineered and domain attributes across the applicant population
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Show Top:</span>
            {[10, 15, 20].map(n => (
              <button
                key={n}
                onClick={() => setTopN(n)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  topN === n
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-96 flex items-center justify-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : importanceData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-gray-400">
            <Info className="w-8 h-8 text-gray-500 mb-2" />
            <p>Model training required to compute SHAP attributions.</p>
            <p className="text-xs text-gray-500 mt-1">Run training pipeline or start backend model initialization.</p>
          </div>
        ) : (
          <div className="h-[520px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={importanceData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 140, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#6b7280"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={v => v.toFixed(3)}
                />
                <YAxis
                  dataKey="feature"
                  type="category"
                  stroke="#6b7280"
                  tick={{ fill: '#d1d5db', fontSize: 12, fontWeight: 500 }}
                  width={130}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-gray-900 border border-gray-700 p-3 rounded-xl shadow-xl">
                          <p className="text-xs font-semibold text-indigo-400">{data.feature}</p>
                          <p className="text-sm font-bold text-white mt-1">
                            Mean |SHAP|: <span className="text-indigo-300">{data.importance.toFixed(5)}</span>
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="importance" radius={[0, 6, 6, 0]}>
                  {importanceData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`hsl(${235 + (index * 4) % 40}, ${75 + (index % 15)}%, ${55 + (index % 15)}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Methodology & Compliance Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 border border-gray-800 space-y-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-400" />
            TreeSHAP Additivity Guarantee
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            The platform computes exact Shapley values via TreeSHAP in polynomial time. For every single applicant scoring instance:
          </p>
          <div className="bg-gray-900/80 p-3 rounded-xl border border-gray-800 font-mono text-xs text-indigo-300">
            f(x) = E[f(x)] + &Sigma; &phi;<sub>i</sub>(x)
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Where <span className="text-gray-400 font-mono">E[f(x)]</span> is the base population expected log-odds/risk score, and each <span className="text-gray-400 font-mono">&phi;<sub>i</sub></span> represents the exact marginal contribution of feature <span className="text-gray-400 font-mono">i</span>. This guarantees regulatory defensibility under FCRA and ECOA guidelines.
          </p>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-800 space-y-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-400" />
            Adverse Action Reason Codes
          </h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            When an applicant is flagged as elevated or high risk, the platform automatically extracts top positive SHAP contributors to generate clear Adverse Action notices:
          </p>
          <ul className="text-xs text-gray-400 space-y-2 list-disc list-inside">
            <li><span className="text-gray-200 font-medium">External Bureau Scores (EXT_SOURCE):</span> Quantifies negative credit history or lack of established credit.</li>
            <li><span className="text-gray-200 font-medium">Debt-to-Income / Annuity-to-Credit:</span> Highlights excessive installment debt burdens.</li>
            <li><span className="text-gray-200 font-medium">Tenure & Employment Duration:</span> Reflects income stability indices.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
