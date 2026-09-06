import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, Brain, ShieldCheck, MessageSquare, BookOpen,
  Activity, Zap, AlertTriangle, TrendingUp, Menu, X
} from 'lucide-react'
import { getHealth } from './services/api'

// Pages
import Dashboard from './pages/Dashboard'
import Prediction from './pages/Prediction'
import Explainability from './pages/Explainability'
import BusinessRules from './pages/BusinessRules'
import TalkToData from './pages/TalkToData'

const NAV_ITEMS = [
  { path: '/', icon: BarChart3, label: 'EDA Dashboard', exact: true },
  { path: '/predict', icon: Brain, label: 'Risk Scoring' },
  { path: '/explain', icon: Zap, label: 'Explainability' },
  { path: '/rules', icon: ShieldCheck, label: 'Business Rules' },
  { path: '/chat', icon: MessageSquare, label: 'Talk-to-Data' },
]

function StatusDot({ ready }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ready ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
  )
}

function Sidebar({ open, onClose }) {
  const [status, setStatus] = useState({ models_ready: false, database_ready: false })

  useEffect(() => {
    getHealth().then(setStatus).catch(() => {})
  }, [])

  return (
    <>
      {/* Overlay for mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: open ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed left-0 top-0 h-full w-64 z-30 lg:translate-x-0 lg:static lg:z-auto"
        style={{ background: 'linear-gradient(180deg, #0d1117 0%, #080b14 100%)', borderRight: '1px solid #1f2937' }}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-float"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg gradient-text" style={{ fontFamily: 'Space Grotesk' }}>
                CredPulse
              </h1>
              <p className="text-xs text-gray-500">Credit Intelligence</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {NAV_ITEMS.map(({ path, icon: Icon, label, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'nav-item-active'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* System Status */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <div className="glass-light rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">System Status</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">ML Model</span>
              <div className="flex items-center gap-1.5">
                <StatusDot ready={status.models_ready} />
                <span className={status.models_ready ? 'text-emerald-400' : 'text-amber-400'}>
                  {status.models_ready ? 'Ready' : 'Not Trained'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Database</span>
              <div className="flex items-center gap-1.5">
                <StatusDot ready={status.database_ready} />
                <span className={status.database_ready ? 'text-emerald-400' : 'text-amber-400'}>
                  {status.database_ready ? 'Ready' : 'Not Initialized'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  )
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111827',
            color: '#f9fafb',
            border: '1px solid #1f2937',
          },
        }}
      />

      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--dark-bg)' }}>
        {/* Desktop sidebar always visible */}
        <div className="hidden lg:flex">
          <div style={{ width: 256, flexShrink: 0 }}>
            <Sidebar open={true} onClose={() => {}} />
          </div>
        </div>

        {/* Mobile sidebar */}
        <div className="lg:hidden">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile topbar */}
          <div className="lg:hidden flex items-center gap-3 p-4 border-b border-gray-800"
            style={{ background: '#0d1117' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-400" />
            </button>
            <h1 className="font-bold text-lg gradient-text" style={{ fontFamily: 'Space Grotesk' }}>
              CredPulse
            </h1>
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/predict" element={<Prediction />} />
                <Route path="/explain" element={<Explainability />} />
                <Route path="/rules" element={<BusinessRules />} />
                <Route path="/chat" element={<TalkToData />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </Router>
  )
}
