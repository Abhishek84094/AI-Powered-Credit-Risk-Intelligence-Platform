import React, { useState, useRef, useEffect } from 'react'
import { sendChatMessage, getHealth } from '../services/api'
import toast from 'react-hot-toast'
import { TerminalCard, AsciiDivider, sanitizeText } from '../components/TerminalUI'

const SUGGESTED_QUERIES = [
  "What is the default rate by education level?",
  "What is the average credit amount for default=1 vs default=0?",
  "Show default rates across contract types",
  "What is the distribution of income types?",
  "Show top 5 highest credit amounts and their default status",
]

export default function TalkToData() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'CREDIT ANALYTICS TERMINAL INITIALIZED.\nEnter analytical questions regarding Home Credit default risk, applicant distributions, and credit history in plain English. Queries translate directly to read-only SQL execution against the analytical database.',
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
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

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
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const handleSend = async (textToSend = null) => {
    if (!dbReady) {
      toast.error('ERR: Analytical database not initialized. Mount CSVs in ./data')
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
        content: sanitizeText(res.answer || res.response || 'Analysis complete.'),
        sql: res.sql || res.generated_sql || null,
        data: res.results || res.data || null,
        mode: res.engine || res.mode || (res.fallback ? 'Deterministic Parser' : 'Groq Llama-3.3-70B'),
        executionTime: res.execution_time_ms ? `${res.execution_time_ms}ms` : null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      toast.error('Execution failure: ' + err.message)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'ERROR: Execution failed: ' + sanitizeText(err.message),
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const copySql = (sqlText, idx) => {
    navigator.clipboard.writeText(sqlText)
    setCopiedIndex(idx)
    toast.success('SQL copied')
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="h-full flex flex-col p-4 lg:p-8 max-w-6xl mx-auto font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="border border-[#1c2a20] bg-[#0a0f0c] p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="text-[#5f7a66] text-[11px] uppercase tracking-wider">
              NL-TO-SQL SHELL // LAYER 6
            </div>
            <h1 className="text-base font-bold text-[#d7ecd9] mt-0.5">
              TALK-TO-DATA RISK INTELLIGENCE CONSOLE
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              className="px-3 py-1 bg-[#050706] border border-[#1c2a20] text-[#d7ecd9] hover:border-[#39d98a] hover:text-[#39d98a] transition-colors"
            >
              [ {apiKey ? 'API KEY CONFIGURED' : 'CONFIG GROQ KEY'} ]
            </button>
          </div>
        </div>

        {/* Database Warning if not mounted */}
        {!dbReady && (
          <div className="mt-3 p-3 bg-[#050706] border border-[#ff5c5c]/40 text-[#ff5c5c] text-[11px]">
            [DATABASE OFFLINE] Analytical SQLite database not detected. Place Home Credit CSVs in ./data and run sql/init_db.py.
          </div>
        )}

        {/* API Key Drawer */}
        {showKeyConfig && (
          <div className="mt-3 pt-3 border-t border-[#1c2a20] space-y-2">
            <div className="text-[#5f7a66] text-[11px]">
              OPTIONAL: PROVIDE GROQ API KEY (gsk_...)
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Leave blank for server environment key or deterministic offline parser"
                className="flex-1 bg-[#050706] border border-[#1c2a20] text-[#d7ecd9] px-3 py-1 text-xs focus:border-[#39d98a] focus:outline-none"
              />
              {apiKey && (
                <button
                  onClick={() => setApiKey('')}
                  className="px-3 py-1 border border-[#1c2a20] text-[#ff5c5c] hover:border-[#ff5c5c]"
                >
                  [ CLEAR ]
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Terminal Scrollback Window */}
      <div className="flex-1 bg-[#0a0f0c] border border-[#1c2a20] p-4 overflow-y-auto space-y-4 min-h-[420px]">
        <div className="text-[#5f7a66] pb-2 border-b border-[#1c2a20] select-none text-[11px]">
          ┌─ TERMINAL SESSION SCROLLBACK ────────────────────────────────────────────────────────
        </div>

        {messages.map((msg, idx) => (
          <div key={idx} className="space-y-2 font-mono">
            {msg.role === 'user' ? (
              /* User Prompt Line */
              <div className="text-[#39d98a] font-bold">
                &gt; {msg.content}
              </div>
            ) : (
              /* Assistant Response Indented */
              <div className="pl-4 space-y-2 border-l border-[#1c2a20]">
                <div className="flex items-center gap-2 text-[10px] text-[#5f7a66] select-none">
                  <span>CREDPULSE_CORE</span>
                  <span>[{msg.timestamp}]</span>
                  {msg.mode && <span>[{msg.mode}]</span>}
                  {msg.executionTime && <span>[{msg.executionTime}]</span>}
                </div>

                <div className="text-[#d7ecd9] leading-relaxed whitespace-pre-line">
                  {sanitizeText(msg.content)}
                </div>

                {/* Executed SQL Box */}
                {msg.sql && (
                  <div className="my-2 border border-[#1c2a20] bg-[#050706]">
                    <div className="flex items-center justify-between px-3 py-1 border-b border-[#1c2a20] bg-[#080d09] text-[10px] text-[#5f7a66]">
                      <span>┌─ [ EXECUTED SQL QUERY ]</span>
                      <button
                        onClick={() => copySql(msg.sql, idx)}
                        className="text-[#39d98a] hover:underline"
                      >
                        {copiedIndex === idx ? '[ COPIED ]' : '[ COPY SQL ]'}
                      </button>
                    </div>
                    <pre className="p-3 text-[#39d98a] overflow-x-auto text-[11px]">
                      {msg.sql}
                    </pre>
                  </div>
                )}

                {/* Tabular Output */}
                {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                  <div className="my-2 border border-[#1c2a20] bg-[#050706] overflow-x-auto">
                    <div className="px-3 py-1 border-b border-[#1c2a20] bg-[#080d09] text-[10px] text-[#5f7a66]">
                      ┌─ [ RESULT ROWS: {msg.data.length} ]
                    </div>
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-[#1c2a20] text-[#5f7a66]">
                          {Object.keys(msg.data[0]).map((col) => (
                            <th key={col} className="p-2 border-r border-[#1c2a20] font-normal">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.data.slice(0, 5).map((row, rIdx) => (
                          <tr key={rIdx} className="border-b border-[#1c2a20]/60 hover:bg-[#1c2a20]/20">
                            {Object.values(row).map((val, cIdx) => (
                              <td key={cIdx} className="p-2 border-r border-[#1c2a20]/60 text-[#d7ecd9]">
                                {typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(4)) : String(val ?? 'NULL')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="pl-4 text-[#e8b339] flex items-center gap-2">
            <span>&gt; EXECUTING ANALYTICAL SQL PARSER...</span>
            <span className="terminal-cursor"></span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Queries */}
      <div className="py-2 flex items-center gap-2 overflow-x-auto select-none">
        <span className="text-[11px] text-[#5f7a66] whitespace-nowrap">PRESETS:</span>
        {SUGGESTED_QUERIES.map((sq, i) => (
          <button
            key={i}
            onClick={() => handleSend(sq)}
            disabled={loading || !dbReady}
            className="px-2.5 py-1 bg-[#0a0f0c] border border-[#1c2a20] text-[#5f7a66] hover:border-[#39d98a] hover:text-[#d7ecd9] whitespace-nowrap transition-colors disabled:opacity-30"
          >
            [ {sq} ]
          </button>
        ))}
      </div>

      {/* Terminal Prompt Input Bar */}
      <div className="pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex items-center border border-[#1c2a20] bg-[#0a0f0c] px-3 py-2.5 focus-within:border-[#39d98a]"
        >
          <span className="text-[#39d98a] font-bold text-sm mr-2 select-none">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ask a question_"
            disabled={loading || !dbReady}
            className="flex-1 bg-transparent text-[#d7ecd9] font-mono text-xs focus:outline-none placeholder-[#5f7a66]"
          />
          <span className="terminal-cursor ml-1"></span>
          <button
            type="submit"
            disabled={loading || !dbReady || !input.trim()}
            className="ml-3 px-3 py-1 border border-[#1c2a20] text-[#39d98a] hover:bg-[#39d98a] hover:text-[#050706] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#39d98a] transition-colors"
          >
            [ SEND ]
          </button>
        </form>

        <div className="mt-2 text-[10px] text-[#5f7a66] flex justify-between select-none">
          <span>SECURITY: STRICT READ-ONLY SQL WHITELIST ENFORCED</span>
          <span>SCHEMA: APPLICATION_TRAIN (307,511 ROWS)</span>
        </div>
      </div>
    </div>
  )
}
