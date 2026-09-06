import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, AlertTriangle, ChevronRight, RotateCcw, CheckCircle, XCircle } from 'lucide-react'
import { predictWithExplanation } from '../services/api'
import toast from 'react-hot-toast'

// ── Risk Gauge SVG Component ────────────────────────────────────────────────
function RiskGauge({ probability }) {
  const pct = Math.min(Math.max(probability || 0, 0), 1)
  const r = 70
  const circumference = 2 * Math.PI * r
  // Half gauge: only 180°
  const arc = circumference * 0.5
  const offset = arc - (arc * pct)
  const band = pct < 0.05 ? 'LOW' : pct < 0.20 ? 'MEDIUM' : 'HIGH'
  const color = band === 'LOW' ? '#10b981' : band === 'MEDIUM' ? '#f59e0b' : '#ef4444'
  const label = band === 'LOW' ? 'Low Risk' : band === 'MEDIUM' ? 'Medium Risk' : 'High Risk'

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="115" viewBox="0 0 200 115">
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        {/* Track */}
        <path
          d="M 15,100 A 85,85 0 0,1 185,100"
          fill="none" stroke="#1f2937" strokeWidth="14" strokeLinecap="round"
        />
        {/* Progress */}
        <path
          d="M 15,100 A 85,85 0 0,1 185,100"
          fill="none" stroke="url(#gaugeGrad)" strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${arc}`}
          strokeDashoffset={`${offset}`}
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)' }}
        />
        {/* Center text */}
        <text x="100" y="90" textAnchor="middle" fill={color}
          style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 700 }}>
          {Math.round(pct * 100)}%
        </text>
        <text x="100" y="108" textAnchor="middle" fill="#6b7280" style={{ fontSize: 11 }}>
          Default Probability
        </text>
      </svg>
      <div className={`mt-2 px-6 py-2 rounded-full text-sm font-bold ${
        band === 'LOW' ? 'badge-low' : band === 'MEDIUM' ? 'badge-medium' : 'badge-high'
      }`}>
        {label}
      </div>
    </div>
  )
}

// ── Form Fields ─────────────────────────────────────────────────────────────
const FIELDS = [
  { key: 'CODE_GENDER', label: 'Gender', type: 'select', options: ['F', 'M'], group: 'Demographics' },
  { key: 'AGE_YEARS', label: 'Age (years)', type: 'number', placeholder: '35', group: 'Demographics' },
  { key: 'NAME_EDUCATION_TYPE', label: 'Education', type: 'select', group: 'Demographics',
    options: ['Higher education', 'Secondary / secondary special', 'Incomplete higher', 'Lower secondary', 'Academic degree'] },
  { key: 'NAME_INCOME_TYPE', label: 'Income Type', type: 'select', group: 'Demographics',
    options: ['Working', 'Pensioner', 'Commercial associate', 'State servant', 'Unemployed', 'Student'] },
  { key: 'NAME_FAMILY_STATUS', label: 'Family Status', type: 'select', group: 'Demographics',
    options: ['Married', 'Single / not married', 'Civil marriage', 'Separated', 'Widow'] },
  { key: 'NAME_HOUSING_TYPE', label: 'Housing', type: 'select', group: 'Demographics',
    options: ['House / apartment', 'With parents', 'Municipal apartment', 'Rented apartment', 'Office apartment', 'Co-op apartment'] },
  { key: 'AMT_INCOME_TOTAL', label: 'Annual Income', type: 'number', placeholder: '150000', group: 'Financials' },
  { key: 'AMT_CREDIT', label: 'Loan Amount', type: 'number', placeholder: '450000', group: 'Financials' },
  { key: 'AMT_ANNUITY', label: 'Annual Repayment', type: 'number', placeholder: '22500', group: 'Financials' },
  { key: 'AMT_GOODS_PRICE', label: 'Goods Price', type: 'number', placeholder: '400000', group: 'Financials' },
  { key: 'EXT_SOURCE_1', label: 'External Score 1', type: 'number', placeholder: '0.5', step: '0.01', group: 'Credit Scores' },
  { key: 'EXT_SOURCE_2', label: 'External Score 2', type: 'number', placeholder: '0.55', step: '0.01', group: 'Credit Scores' },
  { key: 'EXT_SOURCE_3', label: 'External Score 3', type: 'number', placeholder: '0.52', step: '0.01', group: 'Credit Scores' },
  { key: 'prev_refusal_rate', label: 'Previous Refusal Rate (0-1)', type: 'number', placeholder: '0.0', step: '0.01', group: 'History' },
  { key: 'inst_IS_LATE_mean', label: 'Late Payment Rate (0-1)', type: 'number', placeholder: '0.0', step: '0.01', group: 'History' },
]

const GROUPS = ['Demographics', 'Financials', 'Credit Scores', 'History']

const SAMPLE_APPLICANTS = {
  'Low Risk': {
    CODE_GENDER: 'F', AGE_YEARS: 45, NAME_EDUCATION_TYPE: 'Higher education',
    NAME_INCOME_TYPE: 'Working', NAME_FAMILY_STATUS: 'Married',
    NAME_HOUSING_TYPE: 'House / apartment', AMT_INCOME_TOTAL: 250000,
    AMT_CREDIT: 450000, AMT_ANNUITY: 22500, AMT_GOODS_PRICE: 400000,
    EXT_SOURCE_1: 0.72, EXT_SOURCE_2: 0.68, EXT_SOURCE_3: 0.70,
    prev_refusal_rate: 0.0, inst_IS_LATE_mean: 0.02,
  },
  'High Risk': {
    CODE_GENDER: 'M', AGE_YEARS: 24, NAME_EDUCATION_TYPE: 'Secondary / secondary special',
    NAME_INCOME_TYPE: 'Working', NAME_FAMILY_STATUS: 'Single / not married',
    NAME_HOUSING_TYPE: 'With parents', AMT_INCOME_TOTAL: 80000,
    AMT_CREDIT: 500000, AMT_ANNUITY: 35000, AMT_GOODS_PRICE: 450000,
    EXT_SOURCE_1: 0.25, EXT_SOURCE_2: 0.30, EXT_SOURCE_3: 0.28,
    prev_refusal_rate: 0.6, inst_IS_LATE_mean: 0.35,
  },
}

function FormGroup({ title, fields, values, onChange }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.key}>
            <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
            {f.type === 'select' ? (
              <select
                value={values[f.key] || ''}
                onChange={e => onChange(f.key, e.target.value)}
                className="form-input w-full rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type="number"
                value={values[f.key] || ''}
                onChange={e => onChange(f.key, e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder={f.placeholder}
                step={f.step || 'any'}
                className="form-input w-full rounded-lg px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Prediction() {
  const [formValues, setFormValues] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (key, val) => {
    setFormValues(prev => ({ ...prev, [key]: val }))
  }

  const handleSample = (name) => {
    setFormValues(SAMPLE_APPLICANTS[name])
    setResult(null)
    toast.success(`Loaded ${name} sample applicant`)
  }

  const handleReset = () => {
    setFormValues({})
    setResult(null)
    setError(null)
  }

  const handleSubmit = async () => {
    const nonEmpty = Object.fromEntries(
      Object.entries(formValues).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
    )
    if (Object.keys(nonEmpty).length < 3) {
      toast.error('Please fill in at least 3 fields')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await predictWithExplanation(nonEmpty)
      setResult(data)
      toast.success('Risk assessment complete!')
    } catch (e) {
      setError(e.message)
      toast.error('Prediction failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold gradient-text" style={{ fontFamily: 'Space Grotesk' }}>
          Applicant Risk Scoring
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Enter applicant details to compute default probability and risk band
        </p>
      </div>

      {/* Sample presets */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-gray-500 uppercase tracking-wider">Quick load:</span>
        {Object.keys(SAMPLE_APPLICANTS).map(name => (
          <button key={name} onClick={() => handleSample(name)}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border border-gray-700 text-gray-300 hover:border-indigo-500 hover:text-indigo-400 transition-colors">
            {name} Profile
          </button>
        ))}
        <button onClick={handleReset}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-500 transition-colors">
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          {GROUPS.map(group => {
            const groupFields = FIELDS.filter(f => f.group === group)
            return (
              <FormGroup key={group} title={group} fields={groupFields}
                values={formValues} onChange={handleChange} />
            )
          })}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all"
            style={{
              background: loading ? '#374151' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: loading ? 'none' : '0 0 20px rgba(99,102,241,0.35)',
            }}
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing...</>
            ) : (
              <><Brain className="w-5 h-5" /> Assess Risk</>
            )}
          </button>
        </div>

        {/* Results */}
        <div>
          <AnimatePresence mode="wait">
            {error && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="glass rounded-2xl p-6 border border-red-500/20">
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-5 h-5" />
                  <p className="font-medium">Error</p>
                </div>
                <p className="text-sm text-gray-400 mt-2">{error}</p>
              </motion.div>
            )}

            {result && !error && (
              <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }} className="space-y-4">
                {/* Gauge */}
                <div className="glass rounded-2xl p-6 flex flex-col items-center">
                  <RiskGauge probability={result.prediction?.default_probability} />
                  <div className="mt-4 grid grid-cols-2 gap-4 w-full">
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Inference Time</p>
                      <p className="text-sm font-semibold text-cyan-400">
                        {result.prediction?.inference_time_ms?.toFixed(1)}ms
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500">Risk Score</p>
                      <p className="text-sm font-semibold text-indigo-400">
                        {result.prediction?.risk_score_pct?.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Plain explanation */}
                {result.plain_explanation && (
                  <div className="glass-light rounded-xl p-5 border border-indigo-500/20">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">AI Explanation</p>
                    <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                      {result.plain_explanation}
                    </div>
                  </div>
                )}

                {/* Business rules */}
                {result.business_rules?.triggered_rules?.length > 0 && (
                  <div className="glass rounded-xl p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
                      Triggered Business Rules
                    </p>
                    <div className="space-y-2">
                      {result.business_rules.triggered_rules.map(r => (
                        <div key={r.rule_id} className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-gray-200">{r.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{r.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-600 mt-3 italic">{result.business_rules.disclaimer}</p>
                  </div>
                )}
              </motion.div>
            )}

            {!result && !error && !loading && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-4 min-h-64">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-float"
                  style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <Brain className="w-8 h-8 text-indigo-400" />
                </div>
                <p className="text-gray-400 text-sm">
                  Fill in the applicant form and click <strong className="text-gray-200">Assess Risk</strong> to see the prediction.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
