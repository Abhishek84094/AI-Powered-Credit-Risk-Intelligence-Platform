import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Send, Sparkles, Database, Terminal, Shield, Check, Copy, AlertCircle, RefreshCw, Key, ChevronDown, ChevronUp
} from 'lucide-react'
import { sendChatMessage, getHealth } from '../services/api'
import toast from 'react-hot-toast'

const SUGGESTED_QUERIES = [
  "What is the default rate by education level?",
  "What is the average credit amount for applicants with default=1 vs default=0?",
  "Show default rates across contract types",
  "What is the distribution of income types?",
  "Show the top 5 highest credit amounts and their default status",
]

export default function TalkToData() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your AI Credit Risk Data Analyst. You can ask me analytical questions about the Home Credit dataset in plain English. I will translate your question to safe read-only SQL, query the database, and explain the findings.',
      sql: null,
      data: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKeyConfig, setShowKeyConfig] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState(null)
  const [dbReady, setDbReady] = useState(true)
  const [dbChecking, setDbChecking] = useState(true)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    getHealth()
      .then(res => {
        if (res && typeof res.database_ready === 'boolean') {
          setDbReady(res.database_ready)
        }
      })
      .catch(() => {})
      .finally(() => setDbChecking(false))
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const handleSend = async (textToSend = null) => {
    if (!dbReady) {
      toast.error('Talk-to-Data is disabled: Analytical database not initialized. Mount CSVs in ./data.')
      return
    }
    const queryText = (textToSend || input).trim()
    if (!queryText || loading) return

    const userMessage = {
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMessage])
    if (!textToSend) setInput('')
    setLoading(true)

    try {
      const res = await sendChatMessage(queryText, apiKey || null)
      const assistantMessage = {
        role: 'assistant',
        content: res.answer || res.response || 'Analysis complete.',
        sql: res.sql || res.generated_sql || null,
        data: res.results || res.data || null,
        mode: res.engine || res.mode || (res.fallback ? 'Offline Deterministic Fallback' : 'Groq Llama-3.3-70B'),
        executionTime: res.execution_time_ms ? `${res.execution_time_ms}ms` : null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      toast.error('Query failed: ' + err.message)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an issue executing your analytical query: ' + err.message,
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const copySql = (sqlText, idx) => {
    navigator.clipboard.writeText(sqlText)
    setCopiedIndex(idx)
    toast.success('SQL copied to clipboard')
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="h-full flex flex-col p-4 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-800">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs tracking-wider uppercase mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Layer 6 — Talk-to-Data Intelligence
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5" style={{ fontFamily: 'Space Grotesk' }}>
            Analytical NL-to-SQL Assistant
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-700 text-xs font-medium text-gray-300 hover:text-white hover:border-gray-600 transition-all"
          >
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            {apiKey ? 'Custom Key Set' : 'Groq API Key'}
            {showKeyConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Database Offline Banner if CSVs not mounted */}
      {!dbReady && (
        <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Talk-to-Data Engine Offline (Database Not Initialized)</p>
              <p className="text-xs text-amber-300/80 mt-0.5 leading-relaxed">
                The SQLite analytical database was not found because Home Credit CSV files were not detected in <code className="bg-gray-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">./data</code>.
                Place extracted CSVs in <code className="bg-gray-900 px-1.5 py-0.5 rounded text-emerald-400 font-mono">./data</code> before running <code className="bg-gray-900 px-1.5 py-0.5 rounded text-emerald-400 font-mono">docker-compose up</code> (or run <code className="bg-gray-900 px-1.5 py-0.5 rounded text-emerald-400 font-mono">py -3 sql/init_db.py</code>) to activate.
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Note: Risk Scoring, TreeSHAP Explainability, and Business Rules remain fully functional.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
            Database Offline
          </span>
        </div>
      )}

      {/* Groq Key Drawer */}
      <AnimatePresence>
        {showKeyConfig && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-800 bg-gray-900/60 p-4 rounded-xl mt-3"
          >
            <div className="max-w-xl space-y-2">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                Optional: Provide Groq API Key (gsk_...)
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Leave blank to use server environment key or offline fallback"
                  className="flex-1 px-3 py-2 text-xs bg-gray-950 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                {apiKey && (
                  <button
                    onClick={() => setApiKey('')}
                    className="px-3 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-500">
                If no key is configured, queries fall back safely to deterministic pattern translation.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto py-6 space-y-6 pr-2">
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-1 px-1 text-xs text-gray-500">
              <span>{msg.role === 'user' ? 'You' : 'AI Assistant'}</span>
              <span>•</span>
              <span>{msg.timestamp}</span>
              {msg.mode && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {msg.mode}
                </span>
              )}
            </div>

            <div
              className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : msg.isError
                  ? 'bg-rose-950/40 border border-rose-800 text-rose-200'
                  : 'glass border border-gray-800 text-gray-200 shadow-xl'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* SQL Code Block */}
              {msg.sql && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                    <span className="font-mono flex items-center gap-1 text-indigo-400">
                      <Terminal className="w-3.5 h-3.5" /> Executed SQL Query:
                    </span>
                    <button
                      onClick={() => copySql(msg.sql, idx)}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="text-[11px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3 bg-gray-950/80 rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto border border-gray-800/80">
                    {msg.sql}
                  </pre>
                </div>
              )}

              {/* Tabular Results Preview if available */}
              {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-800">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Result Sample ({msg.data.length} rows):
                  </span>
                  <div className="overflow-x-auto max-h-48 border border-gray-800 rounded-lg">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-gray-900/90 text-gray-400 uppercase text-[10px]">
                        <tr>
                          {Object.keys(msg.data[0]).map((col) => (
                            <th key={col} className="p-2 border-b border-gray-800 font-semibold">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {msg.data.slice(0, 5).map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-gray-800/40">
                            {Object.values(row).map((val, cIdx) => (
                              <td key={cIdx} className="p-2 font-mono text-[11px] text-gray-300">
                                {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(4)) : String(val ?? 'NULL')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3">
            <div className="glass border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-xs text-gray-400">Translating to SQL and querying dataset...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">Suggested:</span>
        {SUGGESTED_QUERIES.map((sq, i) => (
          <button
            key={i}
            onClick={() => handleSend(sq)}
            disabled={loading || !dbReady}
            className="px-3 py-1 rounded-full text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 hover:border-indigo-500 whitespace-nowrap transition-all disabled:opacity-40 disabled:hover:border-gray-800 disabled:cursor-not-allowed"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              dbReady
                ? "Ask a question about credit risk, defaults, loans, or applicants..."
                : "Talk-to-Data disabled: place Home Credit CSVs in ./data and run sql/init_db.py to enable"
            }
            disabled={loading || !dbReady}
            className="w-full pl-4 pr-12 py-3.5 bg-gray-900/90 border border-gray-700 rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={loading || !dbReady || !input.trim()}
            className="absolute right-2 p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all shadow-md disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[11px] text-gray-500 text-center mt-2 flex items-center justify-center gap-1.5">
          <Shield className="w-3 h-3 text-emerald-400" />
          Safety enforced: Strict read-only SQL validation prevents DROP, DELETE, ALTER, and schema mutation
        </p>
      </div>
    </div>
  )
}
