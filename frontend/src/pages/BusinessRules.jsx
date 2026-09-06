import React, { useEffect, useState } from 'react'
import { getRules, evaluateRules } from '../services/api'
import toast from 'react-hot-toast'
import { TerminalCard, AsciiDivider, ActionBadge, RiskBadge, sanitizeText } from '../components/TerminalUI'

const SAMPLE_PROFILES = [
  {
    name: 'PRIME BORROWER',
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
    name: 'SUBPRIME / HIGH DEBT',
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
    name: 'UNEMPLOYED APPLICANT',
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
      toast.success('Rules evaluation complete')
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
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Module Title */}
      <div className="border border-[#1c2a20] bg-[#0a0f0c] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs text-[#5f7a66] uppercase tracking-wider">
              POLICY &amp; GOVERNANCE // LAYER 5
            </div>
            <h1 className="text-lg font-bold text-[#d7ecd9] mt-0.5">
              EVIDENCE-DERIVED BUSINESS DECISION RULES ENGINE
            </h1>
          </div>
          <div className="text-xs text-[#5f7a66]">
            DATA-DRIVEN GUARDRAILS &amp; REGULATORY POLICY
          </div>
        </div>
      </div>

      {/* Simulator Box */}
      <TerminalCard title="POLICY SIMULATOR & TEST BENCH">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1c2a20] pb-3">
            <div className="text-xs text-[#5f7a66]">
              TEST PROFILE SELECTION:
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
              {SAMPLE_PROFILES.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => applyProfile(p)}
                  className="px-3 py-1 bg-[#050706] border border-[#1c2a20] text-[#d7ecd9] hover:border-[#39d98a] hover:text-[#39d98a] transition-colors"
                >
                  [ {p.name} ]
                </button>
              ))}
              <button
                onClick={() => handleEvaluate()}
                disabled={evaluating}
                className="px-3 py-1 bg-[#0a0f0c] border border-[#39d98a] text-[#39d98a] font-bold hover:bg-[#39d98a] hover:text-[#050706] transition-colors ml-auto disabled:opacity-50"
              >
                {evaluating ? '> EVALUATING...' : '> RUN POLICY CHECK'}
              </button>
            </div>
          </div>

          {/* Simulator Results */}
          {evalResult && (
            <div className="p-4 bg-[#050706] border border-[#1c2a20] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-[#1c2a20] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[#5f7a66]">POLICY ACTION:</span>
                  <ActionBadge action={evalResult.combined_action} />
                </div>
                <div className="text-[#5f7a66]">
                  FLAGS TRIGGERED: <span className="text-[#d7ecd9] font-bold">{evalResult.triggered_count ?? evalResult.triggered_rules?.length ?? 0}</span> / {rules.length || 6}
                </div>
              </div>

              {evalResult.triggered_rules && evalResult.triggered_rules.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[11px] text-[#e8b339] font-bold">
                    TRIGGERED GOVERNANCE FLAGS &amp; REMEDIATION:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {evalResult.triggered_rules.map((tr, i) => (
                      <div key={i} className="p-2.5 border border-[#e8b339]/30 bg-[#0a0f0c]">
                        <div className="flex items-center justify-between text-[#e8b339]">
                          <span className="font-bold">[{tr.rule_id || `RULE-${i+1}`}] {tr.rule_name || tr.rule_id}</span>
                          <span className="text-[10px]">[FLAG]</span>
                        </div>
                        <p className="text-[11px] text-[#d7ecd9] mt-1">
                          {sanitizeText(tr.reason || tr.recommendation || tr.message)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[#39d98a] py-1">
                  [PASS] All credit guardrails and underwriting governance rules cleared.
                </div>
              )}
            </div>
          )}
        </div>
      </TerminalCard>

      <AsciiDivider label="ACTIVE GOVERNANCE RULES CATALOG" />

      {/* Rules Catalog Monospace Cards */}
      {loading ? (
        <div className="p-8 text-xs text-[#5f7a66] font-mono">
          &gt; Loading underwriting governance rules...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule, idx) => (
            <div
              key={rule.rule_id || idx}
              className="bg-[#0a0f0c] border border-[#1c2a20] p-4 flex flex-col justify-between font-mono"
            >
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-[#1c2a20] pb-2 mb-2">
                  <div>
                    <span className="text-[#5f7a66] text-xs font-bold">
                      [{rule.rule_id || `RULE-${String(idx + 1).padStart(2, '0')}`}]
                    </span>
                    <h3 className="text-xs font-bold text-[#d7ecd9] mt-0.5">{rule.name}</h3>
                  </div>
                  <ActionBadge action={rule.action} />
                </div>

                <p className="text-xs text-[#d7ecd9] leading-relaxed">
                  {sanitizeText(rule.description)}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-[#1c2a20] space-y-1 text-[11px]">
                <div className="text-[#5f7a66]">
                  CONDITION: <span className="text-[#39d98a]">{sanitizeText(rule.condition_summary || rule.condition || 'Statistical threshold match')}</span>
                </div>
                <div className="text-[#5f7a66]">
                  EVIDENCE: <span className="text-[#5f7a66]">{sanitizeText(rule.evidence_source || rule.evidence || 'Derived from EDA default rate analysis and SHAP ranking')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
