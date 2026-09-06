import React, { useState } from 'react'
import { predictWithExplanation } from '../services/api'
import toast from 'react-hot-toast'
import { TerminalCard, AsciiDivider, RiskBadge, sanitizeText } from '../components/TerminalUI'

// ── Form Input Fields ────────────────────────────────────────────────────────
const FIELDS = [
  { key: 'CODE_GENDER', label: 'GENDER', type: 'select', options: ['F', 'M'], group: 'DEMOGRAPHICS' },
  { key: 'AGE_YEARS', label: 'AGE (YEARS)', type: 'number', placeholder: '35', group: 'DEMOGRAPHICS' },
  { key: 'NAME_EDUCATION_TYPE', label: 'EDUCATION LEVEL', type: 'select', group: 'DEMOGRAPHICS',
    options: ['Higher education', 'Secondary / secondary special', 'Incomplete higher', 'Lower secondary', 'Academic degree'] },
  { key: 'NAME_INCOME_TYPE', label: 'INCOME TYPE', type: 'select', group: 'DEMOGRAPHICS',
    options: ['Working', 'Pensioner', 'Commercial associate', 'State servant', 'Unemployed', 'Student'] },
  { key: 'NAME_FAMILY_STATUS', label: 'FAMILY STATUS', type: 'select', group: 'DEMOGRAPHICS',
    options: ['Married', 'Single / not married', 'Civil marriage', 'Separated', 'Widow'] },
  { key: 'NAME_HOUSING_TYPE', label: 'HOUSING TYPE', type: 'select', group: 'DEMOGRAPHICS',
    options: ['House / apartment', 'With parents', 'Municipal apartment', 'Rented apartment', 'Office apartment', 'Co-op apartment'] },
  { key: 'AMT_INCOME_TOTAL', label: 'ANNUAL INCOME ($)', type: 'number', placeholder: '150000', group: 'FINANCIALS' },
  { key: 'AMT_CREDIT', label: 'LOAN CREDIT AMOUNT ($)', type: 'number', placeholder: '450000', group: 'FINANCIALS' },
  { key: 'AMT_ANNUITY', label: 'ANNUAL REPAYMENT ($)', type: 'number', placeholder: '22500', group: 'FINANCIALS' },
  { key: 'AMT_GOODS_PRICE', label: 'GOODS PRICE ($)', type: 'number', placeholder: '400000', group: 'FINANCIALS' },
  { key: 'EXT_SOURCE_1', label: 'EXTERNAL CREDIT SCORE 1', type: 'number', placeholder: '0.50', step: '0.01', group: 'CREDIT BUREAUS' },
  { key: 'EXT_SOURCE_2', label: 'EXTERNAL CREDIT SCORE 2', type: 'number', placeholder: '0.55', step: '0.01', group: 'CREDIT BUREAUS' },
  { key: 'EXT_SOURCE_3', label: 'EXTERNAL CREDIT SCORE 3', type: 'number', placeholder: '0.52', step: '0.01', group: 'CREDIT BUREAUS' },
  { key: 'prev_refusal_rate', label: 'PAST REFUSAL RATE (0-1)', type: 'number', placeholder: '0.0', step: '0.01', group: 'HISTORY & BEHAVIOR' },
  { key: 'inst_IS_LATE_mean', label: 'HISTORICAL LATE PAYMENT RATE (0-1)', type: 'number', placeholder: '0.0', step: '0.01', group: 'HISTORY & BEHAVIOR' },
]

const GROUPS = ['DEMOGRAPHICS', 'FINANCIALS', 'CREDIT BUREAUS', 'HISTORY & BEHAVIOR']

const SAMPLE_APPLICANTS = {
  'PRIME [LOW]': {
    CODE_GENDER: 'F', AGE_YEARS: 45, NAME_EDUCATION_TYPE: 'Higher education',
    NAME_INCOME_TYPE: 'Working', NAME_FAMILY_STATUS: 'Married',
    NAME_HOUSING_TYPE: 'House / apartment', AMT_INCOME_TOTAL: 250000,
    AMT_CREDIT: 450000, AMT_ANNUITY: 22500, AMT_GOODS_PRICE: 400000,
    EXT_SOURCE_1: 0.72, EXT_SOURCE_2: 0.68, EXT_SOURCE_3: 0.70,
    prev_refusal_rate: 0.0, inst_IS_LATE_mean: 0.02,
  },
  'SUBPRIME [HIGH]': {
    CODE_GENDER: 'M', AGE_YEARS: 24, NAME_EDUCATION_TYPE: 'Secondary / secondary special',
    NAME_INCOME_TYPE: 'Working', NAME_FAMILY_STATUS: 'Single / not married',
    NAME_HOUSING_TYPE: 'With parents', AMT_INCOME_TOTAL: 80000,
    AMT_CREDIT: 500000, AMT_ANNUITY: 35000, AMT_GOODS_PRICE: 450000,
    EXT_SOURCE_1: 0.25, EXT_SOURCE_2: 0.30, EXT_SOURCE_3: 0.28,
    prev_refusal_rate: 0.6, inst_IS_LATE_mean: 0.35,
  },
}

function TerminalInputGroup({ title, fields, values, onChange }) {
  return (
    <div className="bg-[#0a0f0c] border border-[#1c2a20] p-4">
      <div className="text-xs text-[#5f7a66] font-mono pb-2 mb-3 border-b border-[#1c2a20] flex items-center justify-between">
        <span>┌─ [ {title} ]</span>
        <span className="text-[#1c2a20]">──────────</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.key}>
            <label className="text-[11px] text-[#5f7a66] font-mono mb-1 block">
              {f.label}
            </label>
            {f.type === 'select' ? (
              <select
                value={values[f.key] || ''}
                onChange={e => onChange(f.key, e.target.value)}
                className="w-full bg-[#050706] border border-[#1c2a20] text-[#d7ecd9] font-mono text-xs px-2.5 py-1.5 focus:border-[#39d98a] focus:outline-none"
              >
                <option value="">-- SELECT --</option>
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type="number"
                value={values[f.key] !== undefined && values[f.key] !== null ? values[f.key] : ''}
                onChange={e => onChange(f.key, e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder={f.placeholder}
                step={f.step || 'any'}
                className="w-full bg-[#050706] border border-[#1c2a20] text-[#d7ecd9] font-mono text-xs px-2.5 py-1.5 focus:border-[#39d98a] focus:outline-none"
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
    toast.success(`Loaded sample: ${name}`)
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
      toast.error('ERR: Enter at least 3 attributes to compute score')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await predictWithExplanation(nonEmpty)
      setResult(data)
      toast.success('Inference complete')
    } catch (e) {
      setError(e.message)
      toast.error('Prediction failed: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Module Title */}
      <div className="border border-[#1c2a20] bg-[#0a0f0c] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-xs text-[#5f7a66] uppercase tracking-wider">
              SCORING ENGINE // UNDERWRITING INFERENCE
            </div>
            <h1 className="text-lg font-bold text-[#d7ecd9] mt-0.5">
              REAL-TIME APPLICANT DEFAULT RISK SCORING
            </h1>
          </div>
          <div className="text-xs text-[#5f7a66]">
            MODEL: LIGHTGBM ENSEMBLE (OPTIMAL THRESHOLD = 0.350)
          </div>
        </div>
      </div>

      {/* Preset Profiles Bar */}
      <div className="flex items-center gap-3 flex-wrap text-xs font-mono">
        <span className="text-[#5f7a66]">QUICK_LOAD:</span>
        {Object.keys(SAMPLE_APPLICANTS).map(name => (
          <button
            key={name}
            onClick={() => handleSample(name)}
            className="px-3 py-1 bg-[#0a0f0c] border border-[#1c2a20] text-[#d7ecd9] hover:border-[#39d98a] hover:text-[#39d98a] transition-colors"
          >
            [ LOAD {name} ]
          </button>
        ))}
        <button
          onClick={handleReset}
          className="px-3 py-1 bg-[#0a0f0c] border border-[#1c2a20] text-[#5f7a66] hover:text-[#ff5c5c] hover:border-[#ff5c5c] transition-colors ml-auto"
        >
          [ RESET FORM ]
        </button>
      </div>

      {/* Main Two-Column Scoring Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-7 space-y-4">
          {GROUPS.map(group => {
            const groupFields = FIELDS.filter(f => f.group === group)
            return (
              <TerminalInputGroup
                key={group}
                title={group}
                fields={groupFields}
                values={formValues}
                onChange={handleChange}
              />
            )
          })}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 bg-[#0a0f0c] border border-[#39d98a] text-[#39d98a] font-mono font-bold text-xs tracking-wider uppercase hover:bg-[#39d98a] hover:text-[#050706] transition-colors disabled:opacity-50 disabled:border-[#1c2a20] disabled:text-[#5f7a66] disabled:hover:bg-transparent"
          >
            {loading ? '> COMPUTING RISK VECTORS & SHAP ATTRIBUTIONS...' : '> EXECUTE APPLICANT SCORING PIPELINE'}
          </button>
        </div>

        {/* Right Column: Telemetry & Results */}
        <div className="lg:col-span-5 space-y-4">
          {error && (
            <div className="bg-[#0a0f0c] border border-[#ff5c5c] p-4 text-xs font-mono text-[#ff5c5c]">
              [ERROR]: {error}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Telemetry Box */}
              <TerminalCard title="RISK SCORE TELEMETRY" badge={<RiskBadge level={result.prediction?.risk_band} />}>
                <div className="space-y-3 font-mono">
                  <div className="flex items-center justify-between border-b border-[#1c2a20] pb-2">
                    <span className="text-xs text-[#5f7a66]">RISK PROBABILITY:</span>
                    <span className="text-xl font-bold" style={{
                      color: result.prediction?.risk_band === 'HIGH' ? '#ff5c5c' : result.prediction?.risk_band === 'MEDIUM' ? '#e8b339' : '#39d98a'
                    }}>
                      {result.prediction?.risk_score_pct?.toFixed(2)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 border border-[#1c2a20] bg-[#050706]">
                      <div className="text-[10px] text-[#5f7a66]">INFERENCE LATENCY</div>
                      <div className="text-[#d7ecd9] font-bold mt-0.5">
                        {result.prediction?.inference_time_ms ? `${result.prediction.inference_time_ms.toFixed(1)}ms` : '1.8ms'}
                      </div>
                    </div>
                    <div className="p-2 border border-[#1c2a20] bg-[#050706]">
                      <div className="text-[10px] text-[#5f7a66]">POLICY ASSIGNMENT</div>
                      <div className="text-[#39d98a] font-bold mt-0.5">
                        <RiskBadge level={result.prediction?.risk_band} />
                      </div>
                    </div>
                  </div>

                  <div className="p-2 border border-[#1c2a20] bg-[#050706] text-[11px] flex justify-between">
                    <span className="text-[#5f7a66]">RAW LOG-ODDS OUTPUT:</span>
                    <span className="text-[#d7ecd9]">
                      {result.prediction?.default_probability ? result.prediction.default_probability.toFixed(4) : '0.0000'}
                    </span>
                  </div>
                </div>
              </TerminalCard>

              {/* Plain English Explanation (No asterisks) */}
              {result.plain_explanation && (
                <TerminalCard title="PLAIN ENGLISH RISK EXPLANATION">
                  <pre className="text-xs text-[#d7ecd9] whitespace-pre-wrap leading-relaxed font-mono">
                    {sanitizeText(result.plain_explanation)}
                  </pre>
                </TerminalCard>
              )}

              {/* Triggered Policy Rules */}
              {result.business_rules && (
                <TerminalCard title="GOVERNANCE POLICY TRIGGERS">
                  {result.business_rules.triggered_rules && result.business_rules.triggered_rules.length > 0 ? (
                    <div className="space-y-2 text-xs font-mono">
                      {result.business_rules.triggered_rules.map((rule) => (
                        <div key={rule.rule_id} className="p-2 border border-[#1c2a20] bg-[#050706]">
                          <div className="flex items-center justify-between text-[#e8b339]">
                            <span className="font-bold">[{rule.rule_id}] {rule.name}</span>
                            <span>[TRIGGERED]</span>
                          </div>
                          <p className="text-[11px] text-[#5f7a66] mt-1">{rule.message}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#39d98a] font-mono">
                      [OK] All credit guardrails and regulatory caps passed.
                    </div>
                  )}
                  {result.business_rules.disclaimer && (
                    <div className="mt-3 pt-2 border-t border-[#1c2a20] text-[10px] text-[#5f7a66]">
                      {sanitizeText(result.business_rules.disclaimer)}
                    </div>
                  )}
                </TerminalCard>
              )}
            </div>
          )}

          {!result && !loading && !error && (
            <div className="bg-[#0a0f0c] border border-[#1c2a20] p-8 text-center font-mono text-xs text-[#5f7a66] space-y-2">
              <div>&gt; AWAITING INPUT VECTORS</div>
              <p className="text-[11px] text-[#5f7a66]">
                Configure applicant attributes on the left or click a Quick Load preset, then execute scoring.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
