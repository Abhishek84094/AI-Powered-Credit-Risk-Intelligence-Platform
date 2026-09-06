import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { getHealth } from './services/api'

// Pages
import Dashboard from './pages/Dashboard'
import Prediction from './pages/Prediction'
import Explainability from './pages/Explainability'
import BusinessRules from './pages/BusinessRules'
import TalkToData from './pages/TalkToData'

const TABS = [
  { path: '/', label: 'DASHBOARD', title: 'EDA DASHBOARD', exact: true },
  { path: '/predict', label: 'RISK SCORING', title: 'APPLICANT RISK SCORING' },
  { path: '/explain', label: 'EXPLAINABILITY', title: 'SHAP EXPLAINABILITY & XAI' },
  { path: '/rules', label: 'BUSINESS RULES', title: 'GOVERNANCE & POLICY RULES' },
  { path: '/chat', label: 'TALK-TO-DATA', title: 'ANALYTICAL NL-TO-SQL' },
]

// ── Boot Sequence (Runs once per session) ──────────────────────────────────
function BootSequence({ onComplete }) {
  const [lines, setLines] = useState([])

  useEffect(() => {
    const sequence = [
      { text: '> INITIALIZING CREDPULSE RISK-DESK v2.4...', delay: 100 },
      { text: '> Loading credit risk models (LightGBM, XGBoost)... [OK]', delay: 400 },
      { text: '> Connecting to analytical database and feature store... [OK]', delay: 750 },
      { text: '> Calibrating TreeSHAP explainability engine... [OK]', delay: 1050 },
      { text: '> Risk desk kernel active. Session initialized.', delay: 1300 },
    ]

    const timers = sequence.map(item => {
      return setTimeout(() => {
        setLines(prev => [...prev, item.text])
      }, item.delay)
    })

    const finishTimer = setTimeout(() => {
      sessionStorage.setItem('credpulse_terminal_booted', 'true')
      onComplete()
    }, 1500)

    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(finishTimer)
    }
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 bg-[#050706] text-[#39d98a] font-mono p-8 flex flex-col justify-start">
      <div className="max-w-2xl space-y-2 select-none">
        <div className="text-xs text-[#5f7a66] pb-2 border-b border-[#1c2a20]">
          BOOT SEQUENCE // CREDPULSE TERMINAL INTERFACE
        </div>
        {lines.map((line, idx) => (
          <div key={idx} className="text-xs tracking-wider">
            {line}
          </div>
        ))}
        <div className="pt-2">
          <span className="terminal-cursor"></span>
        </div>
      </div>
    </div>
  )
}

// ── Terminal Header & Navigation ───────────────────────────────────────────
function TerminalHeader({ status }) {
  const location = useLocation()
  const activeTab = TABS.find(t => t.exact ? location.pathname === t.path : location.pathname.startsWith(t.path)) || TABS[0]

  return (
    <header className="sticky top-0 z-40 bg-[#080d09] border-b border-[#1c2a20] select-none">
      {/* Top Status Bar (Window Title Bar) */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#050706] border-b border-[#1c2a20] text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="text-[#39d98a] font-bold tracking-wider">
            CREDPULSE // RISK-DESK — SESSION ACTIVE
          </span>
          <span className="hidden sm:inline text-[#1c2a20]">|</span>
          <span className="hidden sm:inline text-[#5f7a66] text-[11px]">
            NODE: LOCALHOST:8000
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="text-[#5f7a66]">ML:</span>
            <span className={status.models_ready ? 'text-[#39d98a]' : 'text-[#e8b339]'}>
              [{status.models_ready ? 'ONLINE' : 'TRAIN_REQ'}]
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#5f7a66]">DB:</span>
            <span className={status.database_ready ? 'text-[#39d98a]' : 'text-[#e8b339]'}>
              [{status.database_ready ? 'ONLINE' : 'MOUNT_DATA'}]
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-[#5f7a66]">
            <span>PAGE:</span>
            <span className="text-[#d7ecd9] font-semibold">{activeTab.title}</span>
          </div>
        </div>
      </div>

      {/* Terminal Tabs Row */}
      <div className="flex items-center px-4 py-2 bg-[#0a0f0c] overflow-x-auto gap-4 text-xs font-mono">
        <span className="text-[#5f7a66] select-none text-[11px] hidden sm:inline">TABS:</span>
        <nav className="flex items-center gap-4 flex-nowrap">
          {TABS.map(({ path, label, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              className={({ isActive }) =>
                isActive
                  ? 'text-[#39d98a] font-bold tracking-wider whitespace-nowrap'
                  : 'text-[#5f7a66] hover:text-[#d7ecd9] transition-colors whitespace-nowrap'
              }
            >
              {({ isActive }) =>
                isActive ? `[ ${label} ]` : label
              }
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}

function MainLayout() {
  const [status, setStatus] = useState({ models_ready: false, database_ready: false })

  useEffect(() => {
    getHealth().then(setStatus).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-[#050706] text-[#d7ecd9] font-mono flex flex-col">
      <TerminalHeader status={status} />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/predict" element={<Prediction />} />
          <Route path="/explain" element={<Explainability />} />
          <Route path="/rules" element={<BusinessRules />} />
          <Route path="/chat" element={<TalkToData />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [booted, setBooted] = useState(() => {
    return sessionStorage.getItem('credpulse_terminal_booted') === 'true'
  })

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0a0f0c',
            color: '#d7ecd9',
            border: '1px solid #1c2a20',
            borderRadius: '0px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
          },
        }}
      />

      {!booted ? (
        <BootSequence onComplete={() => setBooted(true)} />
      ) : (
        <MainLayout />
      )}
    </Router>
  )
}
