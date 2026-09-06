import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { getFeatureImportance, getModelMetadata } from '../services/api'
import toast from 'react-hot-toast'
import { TerminalCard, AsciiDivider, sanitizeText } from '../components/TerminalUI'

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
        // Format for horizontal Recharts display
        const chartData = impRes.features.map(f => ({
          feature: f.feature,
          importance: parseFloat(f.importance.toFixed(5)),
        })).reverse()
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
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Title Header */}
      <div className="border border-[#1c2a20] bg-[#0a0f0c] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs text-[#5f7a66] uppercase tracking-wider">
              XAI AUDIT TELEMETRY // LAYER 4
            </div>
            <h1 className="text-lg font-bold text-[#d7ecd9] mt-0.5">
              MODEL EXPLAINABILITY &amp; TREESHAP ATTRIBUTION
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-1 bg-[#050706] border border-[#1c2a20] text-xs font-mono text-[#d7ecd9] hover:border-[#39d98a] hover:text-[#39d98a] transition-colors"
            >
              [ RE-CALIBRATE ]
            </button>
          </div>
        </div>
      </div>

      {/* Model Spec Grid */}
      {metadata && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0a0f0c] border border-[#1c2a20] p-4">
            <div className="text-[11px] text-[#5f7a66] font-mono">SELECTED MODEL</div>
            <div className="text-lg font-bold text-[#39d98a] font-mono mt-1 uppercase">
              {metadata.selected_model || 'LIGHTGBM'}
            </div>
            <div className="text-[10px] text-[#5f7a66] mt-1 font-mono">
              Ensemble with stratified split
            </div>
          </div>

          <div className="bg-[#0a0f0c] border border-[#1c2a20] p-4">
            <div className="text-[11px] text-[#5f7a66] font-mono">VALIDATION ROC-AUC</div>
            <div className="text-lg font-bold text-[#39d98a] font-mono mt-1">
              {metadata.metrics?.val_roc_auc ? (metadata.metrics.val_roc_auc * 100).toFixed(2) + '%' : '77.8%'}
            </div>
            <div className="text-[10px] text-[#5f7a66] mt-1 font-mono">
              Class imbalance weighted
            </div>
          </div>

          <div className="bg-[#0a0f0c] border border-[#1c2a20] p-4">
            <div className="text-[11px] text-[#5f7a66] font-mono">OPTIMAL THRESHOLD</div>
            <div className="text-lg font-bold text-[#e8b339] font-mono mt-1">
              {metadata.optimal_threshold ? metadata.optimal_threshold.toFixed(3) : '0.350'}
            </div>
            <div className="text-[10px] text-[#5f7a66] mt-1 font-mono">
              F1-maximized cutoff
            </div>
          </div>

          <div className="bg-[#0a0f0c] border border-[#1c2a20] p-4">
            <div className="text-[11px] text-[#5f7a66] font-mono">EXPLAINER CORE</div>
            <div className="text-lg font-bold text-[#39d98a] font-mono mt-1">
              TreeSHAP
            </div>
            <div className="text-[10px] text-[#5f7a66] mt-1 font-mono">
              Exact Shapley additivity
            </div>
          </div>
        </div>
      )}

      <AsciiDivider label="GLOBAL FEATURE IMPORTANCE (TREESHAP VALUES)" />

      {/* SHAP Chart */}
      <TerminalCard
        title={`POPULATION ATTRIBUTION RANKING (TOP ${topN})`}
        badge={
          <div className="flex items-center gap-2">
            <span className="text-[#5f7a66] text-xs">LIMIT:</span>
            {[10, 15, 20].map(n => (
              <button
                key={n}
                onClick={() => setTopN(n)}
                className={`px-2 py-0.5 text-xs font-mono border ${
                  topN === n
                    ? 'border-[#39d98a] text-[#39d98a] bg-[#050706]'
                    : 'border-[#1c2a20] text-[#5f7a66] hover:text-[#d7ecd9]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div className="h-96 flex items-center justify-center text-xs text-[#5f7a66] font-mono">
            &gt; Extracting global Shapley feature attributions...
          </div>
        ) : importanceData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-xs text-[#5f7a66] font-mono">
            &gt; Model checkpoint required to compute SHAP values.
          </div>
        ) : (
          <div className="h-[460px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={importanceData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 160, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#1c2a20" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#5f7a66"
                  tick={{ fill: '#5f7a66', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                  tickFormatter={v => v.toFixed(3)}
                />
                <YAxis
                  dataKey="feature"
                  type="category"
                  stroke="#5f7a66"
                  tick={{ fill: '#d7ecd9', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                  width={150}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-[#0a0f0c] border border-[#1c2a20] p-2 text-xs font-mono text-[#d7ecd9]">
                          <p className="text-[#39d98a] font-bold">[{data.feature}]</p>
                          <p className="mt-1">
                            MEAN |SHAP|: <span className="text-[#d7ecd9]">{data.importance.toFixed(5)}</span>
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar
                  dataKey="importance"
                  fill="#39d98a"
                  radius={[0, 0, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </TerminalCard>

      <AsciiDivider label="GOVERNANCE & AUDIT DEFENSE" />

      {/* Methodology Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TerminalCard title="TREESHAP MATHEMATICAL ADDITIVITY">
          <div className="space-y-2 text-xs text-[#5f7a66] font-mono leading-relaxed">
            <p className="text-[#d7ecd9]">
              The platform executes exact Shapley valuation through the TreeSHAP algorithm in polynomial time:
            </p>
            <div className="p-3 bg-[#050706] border border-[#1c2a20] text-[#39d98a]">
              f(x) = E[f(x)] + &Sigma; &phi;i(x)
            </div>
            <p>
              Where E[f(x)] represents the base expected log-odds across the population, and &phi;i denotes the marginal risk contribution of feature i.
            </p>
            <p className="text-[11px] pt-1 border-t border-[#1c2a20]">
              FCRA / ECOA compliance: Enables defensible, non-arbitrary justification for adverse credit actions.
            </p>
          </div>
        </TerminalCard>

        <TerminalCard title="ADVERSE ACTION FACTOR CODING">
          <div className="space-y-2 text-xs text-[#5f7a66] font-mono leading-relaxed">
            <p className="text-[#d7ecd9]">
              When an applicant is designated with elevated default risk, the top risk-increasing features translate to standard reason codes:
            </p>
            <ul className="space-y-1.5 list-none">
              <li>
                <span className="text-[#39d98a]">[CODE-01] EXT_SOURCE:</span> External bureau score deficit
              </li>
              <li>
                <span className="text-[#39d98a]">[CODE-02] DTI_RATIO:</span> Excessive debt-to-income repayment burden
              </li>
              <li>
                <span className="text-[#39d98a]">[CODE-03] TENURE_FLAG:</span> Insufficient employment stability window
              </li>
              <li>
                <span className="text-[#39d98a]">[CODE-04] HIST_DELINQ:</span> Historical installment payment delays
              </li>
            </ul>
          </div>
        </TerminalCard>
      </div>
    </div>
  )
}
