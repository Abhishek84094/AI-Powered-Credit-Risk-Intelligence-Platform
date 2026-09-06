import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, AlertTriangle, CheckCircle, Info, Sliders, Play, RefreshCw, ChevronRight, FileText
} from 'lucide-react'
import { getRules, evaluateRules } from '../services/api'
import toast from 'react-hot-toast'

const SAMPLE_PROFILES = [
  {
    name: 'Prime Borrower',
    data: {
      AMT_INCOME_TOTAL: 250000,
      AMT_CREDIT: 450000,
      AMT_ANNUITY: 22000,
      EXT_SOURCE_1: 0.78,
      EXT_SOURCE_2: 0.82,
      EXT_SOURCE_3: 0.79,
      DAYS_BIRTH: -14500,
      DAYS_EMPLOYED: -3200,
      NAME_INCOME_TYPE: 'Commercial associate',
      NAME_EDUCATION_TYPE: 'Higher education',
    }
  },
  {
    name: 'Subprime / High Debt Borrower',
    data: {
      AMT_INCOME_TOTAL: 65000,
      AMT_CREDIT: 750000,
      AMT_ANNUITY: 45000,
      EXT_SOURCE_1: 0.12,
      EXT_SOURCE_2: 0.18,
      EXT_SOURCE_3: 0.15,
      DAYS_BIRTH: -8500,
      DAYS_EMPLOYED: -120,
      NAME_INCOME_TYPE: 'Working',
      NAME_EDUCATION_TYPE: 'Secondary / secondary special',
    }
  },
  {
    name: 'Young Unemployed Applicant',
    data: {
      AMT_INCOME_TOTAL: 40000,
      AMT_CREDIT: 200000,
      AMT_ANNUITY: 18000,
      EXT_SOURCE_1: 0.25,
      EXT_SOURCE_2: 0.31,
      EXT_SOURCE_3: 0.29,
      DAYS_BIRTH: -7600,
      DAYS_EMPLOYED: 365243,
      NAME_INCOME_TYPE: 'Unemployed',
      NAME_EDUCATION_TYPE: 'Secondary / secondary special',
    }
  }
]

export default function BusinessRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [testData, setTestData] = useState(SAMPLE_PROFILES[0].data)
  const [evaluating, setEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState(null)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    setLoading(true)
    try {
      const res = await getRules()
      if (res && res.rules) {
        setRules(res.rules)
      }
    } catch (err) {
      toast.error('Failed to load rules: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEvaluate = async (customData = null) => {
    setEvaluating(true)
    try {
      const payload = customData || testData
      const res = await evaluateRules(payload)
      setEvalResult(res)
      toast.success('Rules evaluated against profile')
    } catch (err) {
      toast.error('Evaluation failed: ' + err.message)
    } finally {
      setEvaluating(false)
    }
  }

  const applyProfile = (profile) => {
    setTestData(profile.data)
    handleEvaluate(profile.data)
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm tracking-wider uppercase mb-1">
          <ShieldCheck className="w-4 h-4" /> Layer 5 — Policy & Governance
        </div>
        <h1 className="text-3xl font-extrabold text-white" style={{ fontFamily: 'Space Grotesk' }}>
          Evidence-Based Business Rules Engine
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Data-derived decision guards combining statistical thresholds, regulatory safety nets, and underwriting governance
        </p>
      </div>

      {/* Simulator Section */}
      <div className="glass rounded-2xl p-6 border border-gray-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Interactive Rule Policy Simulator
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Select an applicant profile or tweak attributes to verify policy triggers
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">Sample Presets:</span>
            {SAMPLE_PROFILES.map((p, idx) => (
              <button
                key={idx}
                onClick={() => applyProfile(p)}
                className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-all hover:border-indigo-500"
              >
                {p.name}
              </button>
            ))}
            <button
              onClick={() => handleEvaluate()}
              disabled={evaluating}
              className="flex items-center gap-1.5 px-4 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/30 ml-auto"
            >
              <Play className="w-3.5 h-3.5" />
              {evaluating ? 'Evaluating...' : 'Run Evaluation'}
            </button>
          </div>
        </div>

        {/* Evaluation Output if available */}
        <AnimatePresence>
          {evalResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 rounded-xl border border-gray-700 bg-gray-900/90 space-y-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-gray-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase">Policy Decision:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    evalResult.combined_action === 'APPROVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : evalResult.combined_action === 'MANUAL_REVIEW'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}>
                    {evalResult.combined_action || 'EVALUATED'}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  Triggered: <span className="font-bold text-white">{evalResult.triggered_count ?? evalResult.triggered_rules?.length ?? 0}</span> of {rules.length || 6} rules
                </div>
              </div>

              {evalResult.triggered_rules && evalResult.triggered_rules.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Triggered Flags & Recommendations:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {evalResult.triggered_rules.map((tr, i) => (
                      <div key={i} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                        <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          {tr.rule_name || tr.rule_id}
                        </div>
                        <p className="text-gray-300">{tr.reason || tr.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  All policy and credit guardrails passed without restrictive triggers.
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rules Catalog */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          Configured Governance Rules ({rules.length || 6})
        </h2>

        {loading ? (
          <div className="h-40 flex items-center justify-center text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule, idx) => (
              <div
                key={rule.rule_id || idx}
                className="glass rounded-2xl p-5 border border-gray-800 hover:border-gray-700 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-xs font-mono font-semibold text-indigo-400">
                        RULE-{String(idx + 1).padStart(2, '0')}
                      </span>
                      <h3 className="text-base font-bold text-white">{rule.name}</h3>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      rule.action === 'APPROVE'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : rule.action === 'DECLINE'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {rule.action || 'REVIEW'}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                    {rule.description}
                  </p>
                </div>

                <div className="bg-gray-900/70 p-3 rounded-xl border border-gray-800/80 space-y-1.5 text-xs">
                  <div className="text-gray-400">
                    <strong className="text-gray-300">Condition:</strong> <span className="font-mono text-indigo-300">{rule.condition_summary || rule.condition || 'Statistical threshold match'}</span>
                  </div>
                  <div className="text-gray-400">
                    <strong className="text-gray-300">Evidence Base:</strong> <span className="text-gray-400">{rule.evidence_source || rule.evidence || 'Derived from EDA default rate analysis and SHAP ranking'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
