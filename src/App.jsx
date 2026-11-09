import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  UserRound,
  Mail,
  RefreshCw,
  LogOut,
  Users,
  UserCheck,
  UserX,
  LoaderCircle,
  Search,
  X,
  Check,
  Flame
} from 'lucide-react'

import Workspace from './Workspace'
import { CountUp, FxContext, Logo, Wordmark } from './ui'
import {
  registerUser,
  verifyRegistration,
  loginUser,
  verifyLogin,
  getCurrentUser,
  logoutUser,
  getAdminUsers,
  getAdminUserDetails,
  updateAdminUserStatus
} from './api'

import './styles.css'

const ease = [0.22, 1, 0.36, 1]

/* =========================================
   SIX-BOX CODE INPUT
========================================= */

function OtpInput({ value, onChange, disabled }) {
  const refs = useRef([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '')

  const focusAt = index => {
    const node = refs.current[Math.max(0, Math.min(5, index))]
    if (node) node.focus()
  }

  const handleInput = (index, raw) => {
    const typed = raw.replace(/\D/g, '')
    if (!typed) return
    const next = (value.slice(0, index) + typed).slice(0, 6)
    onChange(next)
    focusAt(next.length >= 6 ? 5 : next.length)
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const target = digits[index] ? index : Math.max(0, index - 1)
      onChange(value.slice(0, target))
      focusAt(target)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusAt(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusAt(index + 1)
    }
  }

  const handlePaste = event => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    event.preventDefault()
    onChange(pasted)
    focusAt(pasted.length >= 6 ? 5 : pasted.length)
  }

  return (
    <div className="otp" onPaste={handlePaste} role="group" aria-label="Six-digit verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={node => (refs.current[index] = node)}
          className={`otp-box ${digit ? 'filled' : ''}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1}`}
          value={digit}
          disabled={disabled}
          autoFocus={index === 0}
          onFocus={event => event.target.select()}
          onChange={event => handleInput(index, event.target.value)}
          onKeyDown={event => handleKeyDown(index, event)}
        />
      ))}
    </div>
  )
}

/* =========================================
   AUTH SHOWCASE (decorative)
========================================= */

function Showcase() {
  const cells = useMemo(() => Array.from({ length: 35 }, (_, i) => i), [])

  return (
    <aside className="showcase" aria-hidden="true">
      <div className="showcase-brand">
        <Logo size={38} />
        <Wordmark />
      </div>

      <div className="showcase-body">
        <h2>
          Small things, done daily,
          <br />
          add up to a different you.
        </h2>

        <div className="streak-grid">
          {cells.map(i => (
            <i key={i} style={{ '--i': i, '--hue': i % 5 === 0 ? 'var(--warm)' : i % 3 === 0 ? 'var(--accent)' : 'var(--good)' }} />
          ))}
        </div>

        <div className="float-chip chip-a">
          <span className="chip-check"><Check size={13} strokeWidth={3} /></span>
          Morning workout
        </div>
        <div className="float-chip chip-b">
          <Flame size={15} />
          12 day streak
        </div>
      </div>

      <p className="showcase-foot">Your routine. Your progress.</p>
    </aside>
  )
}

/* =========================================
   APP
========================================= */

function App() {
  const reduceMotion = useReducedMotion()
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [screen, setScreen] = useState('login')
  const [authMode, setAuthMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [cooldown, setCooldown] = useState(0)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  useEffect(() => {
    let active = true

    async function restoreSession() {
      const token = localStorage.getItem('habitrade_token')

      if (!token) {
        if (active) setChecking(false)
        return
      }

      try {
        const result = await getCurrentUser()
        if (active) setUser(result.user)
      } catch {
        localStorage.removeItem('habitrade_token')
      } finally {
        if (active) setChecking(false)
      }
    }

    restoreSession()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  function resetMessages() {
    setError('')
    setMessage('')
  }

  async function sendCode() {
    if (authMode === 'register') {
      await registerUser(name.trim(), email.trim())
    } else {
      await loginUser(email.trim())
    }
  }

  async function handleSendCode(event) {
    event.preventDefault()
    resetMessages()
    setBusy(true)

    try {
      await sendCode()
      setScreen('otp')
      setCooldown(30)
      setMessage('We sent a six-digit code to your email.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0 || busy) return
    resetMessages()
    setBusy(true)

    try {
      await sendCode()
      setCooldown(30)
      setOtp('')
      setMessage('A new code is on its way.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(event) {
    event.preventDefault()
    resetMessages()

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the six-digit verification code.')
      return
    }

    setBusy(true)

    try {
      const result =
        authMode === 'register'
          ? await verifyRegistration(email.trim(), otp)
          : await verifyLogin(email.trim(), otp)

      setUser(result.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    try {
      await logoutUser()
    } catch {
      /* token is cleared in finally; continue signing out locally */
    }
    setUser(null)
    setScreen('login')
    setAuthMode('login')
    setName('')
    setEmail('')
    setOtp('')
    resetMessages()
  }

  const fx = { reduced: !!reduceMotion, level: reduceMotion ? 'reduced' : 'maximum' }

  if (checking) {
    return (
      <FxContext.Provider value={fx}>
        <div className="boot" role="status">
          <Logo size={56} draw />
          <span>Checking your session…</span>
        </div>
      </FxContext.Provider>
    )
  }

  if (user) {
    if (user.role === 'admin') {
      return (
        <FxContext.Provider value={fx}>
          <AdminDashboard user={user} onLogout={handleLogout} />
        </FxContext.Provider>
      )
    }

    return <Workspace user={user} onLogout={handleLogout} />
  }

  const headings = {
    otp: ['Check your inbox', `Enter the code we sent to ${email}.`],
    register: ['Create your account', 'Start building habits that last.'],
    login: ['Welcome back', 'Sign in to pick up where you left off.']
  }
  const [title, subtitle] = headings[screen === 'otp' ? 'otp' : authMode]

  return (
    <FxContext.Provider value={fx}>
      <main className="auth-page">
        <Showcase />

        <section className="auth-panel">
          <motion.div
            className="auth-card"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <div className="auth-brand-mobile">
              <Logo size={34} />
              <Wordmark />
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${screen}-${authMode}`}
                initial={{ opacity: 0, x: 22 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -22 }}
                transition={{ duration: 0.28, ease }}
              >
                <div className="auth-heading">
                  <h1>{title}</h1>
                  <p>{subtitle}</p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      key="e"
                      className="auth-alert error"
                      role="alert"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {error}
                    </motion.div>
                  )}
                  {message && !error && (
                    <motion.div
                      key="m"
                      className="auth-alert success"
                      role="status"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {message}
                    </motion.div>
                  )}
                </AnimatePresence>

                {screen === 'otp' ? (
                  <form className="auth-form" onSubmit={handleVerify}>
                    <OtpInput value={otp} onChange={setOtp} disabled={busy} />

                    <button className="auth-submit" disabled={busy || otp.length < 6}>
                      {busy ? 'Verifying…' : 'Verify and continue'}
                      {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
                    </button>

                    <div className="otp-actions">
                      <button
                        type="button"
                        className="auth-back"
                        onClick={() => {
                          setScreen('login')
                          setOtp('')
                          resetMessages()
                        }}
                      >
                        <ArrowLeft size={15} /> Change email
                      </button>

                      <button
                        type="button"
                        className="auth-back"
                        disabled={cooldown > 0 || busy}
                        onClick={handleResend}
                      >
                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form className="auth-form" onSubmit={handleSendCode}>
                    {authMode === 'register' && (
                      <label className="auth-label">
                        Full name
                        <div className="auth-input-wrap">
                          <UserRound size={18} />
                          <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Your name"
                            maxLength={80}
                            autoComplete="name"
                            required
                          />
                        </div>
                      </label>
                    )}

                    <label className="auth-label">
                      Email address
                      <div className="auth-input-wrap">
                        <Mail size={18} />
                        <input
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          required
                        />
                      </div>
                    </label>

                    <button className="auth-submit" disabled={busy}>
                      {busy ? 'Sending code…' : 'Continue with email'}
                      {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
                    </button>
                  </form>
                )}

                {screen !== 'otp' && (
                  <div className="auth-switch">
                    {authMode === 'login' ? "New to Habitrade?" : 'Already have an account?'}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode(authMode === 'login' ? 'register' : 'login')
                        resetMessages()
                      }}
                    >
                      {authMode === 'login' ? 'Create account' : 'Sign in'}
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="auth-footer">
              <ShieldCheck size={14} />
              Secure email verification. No password to remember.
            </div>
          </motion.div>

          <div className="auth-bottom">
            <span>Created by Neville P</span>
            <a className="footer-email" href="mailto:mytechgamer02@gmail.com">
              mytechgamer02@gmail.com
            </a>
          </div>
        </section>
      </main>
    </FxContext.Provider>
  )
}

/* =========================================
   ADMIN
========================================= */

function AdminDashboard({ user, onLogout }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [details, setDetails] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  async function loadUsers() {
    setLoading(true)
    setError('')
    try {
      const result = await getAdminUsers()
      setUsers(result.users || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function openUser(account) {
    setSelected(account)
    setDetails(null)
    setDetailError('')
    setDetailLoading(true)
    try {
      setDetails(await getAdminUserDetails(account.id))
    } catch (err) {
      setDetailError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  async function changeStatus(account) {
    const status = account.status === 'active' ? 'suspended' : 'active'
    setSavingStatus(true)
    try {
      await updateAdminUserStatus(account.id, status)
      setUsers(previous => previous.map(u => (u.id === account.id ? { ...u, status } : u)))
      if (selected?.id === account.id) setSelected({ ...account, status })
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingStatus(false)
    }
  }

  function closeDetail() {
    setSelected(null)
    setDetails(null)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    const onKey = event => event.key === 'Escape' && closeDetail()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const activeUsers = users.filter(u => u.status === 'active').length
  const suspendedUsers = users.filter(u => u.status && u.status !== 'active').length
  const admins = users.filter(u => u.role === 'admin').length

  const visible = users.filter(u => {
    const q = search.trim().toLowerCase()
    return !q || `${u.name} ${u.email}`.toLowerCase().includes(q)
  })

  const detailUser = details?.user || details?.account || selected
  const detailHabits = details?.habits || details?.data?.habits || []
  const detailLogs = details?.logs || details?.habit_logs || details?.data?.logs || []

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <div className="admin-brand">
          <Logo size={34} />
          <Wordmark />
          <span className="admin-tag">Admin</span>
        </div>

        <div className="admin-account">
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <button className="btn ghost" onClick={onLogout}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      </header>

      <section className="admin-content">
        <div className="admin-welcome">
          <h1>Admin dashboard</h1>
          <p>Manage accounts and review each person's habit tracking.</p>
        </div>

        <div className="admin-stats">
          <AdminStat icon={<Users size={20} />} label="Registered users" value={users.length} />
          <AdminStat icon={<UserCheck size={20} />} label="Active accounts" value={activeUsers} tone="good" />
          <AdminStat icon={<UserX size={20} />} label="Suspended" value={suspendedUsers} tone="bad" />
          <AdminStat icon={<ShieldCheck size={20} />} label="Administrators" value={admins} tone="accent" />
        </div>

        <section className="panel admin-panel">
          <div className="panel-head">
            <div>
              <h2>User management</h2>
              <p>Select a person to see their habits and history.</p>
            </div>

            <div className="admin-tools">
              <div className="search-box">
                <Search size={16} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name or email"
                  aria-label="Search users"
                />
              </div>
              <button className="btn ghost" onClick={loadUsers} disabled={loading}>
                <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="admin-empty">
              <LoaderCircle className="spin" size={20} /> Loading users…
            </div>
          ) : error ? (
            <div className="auth-alert error">{error}</div>
          ) : visible.length === 0 ? (
            <div className="admin-empty">{users.length ? 'No users match your search.' : 'No registered users yet.'}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Verified</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((account, i) => (
                    <tr key={account.id} className="row-in" style={{ '--i': Math.min(i, 12) }}>
                      <td>
                        <span className="user-cell">
                          <span className="mini-avatar">{account.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                          {account.name}
                        </span>
                      </td>
                      <td>{account.email}</td>
                      <td><span className={`pill role-${account.role}`}>{account.role}</span></td>
                      <td><span className={`pill status-${account.status}`}>{account.status}</span></td>
                      <td>{account.email_verified ? 'Yes' : 'No'}</td>
                      <td className="right">
                        <button className="btn ghost small" onClick={() => openUser(account)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              className="drawer-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDetail}
            />
            <motion.aside
              className="drawer"
              role="dialog"
              aria-label={`Tracking for ${selected.name}`}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            >
              <div className="drawer-head">
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.email}</p>
                </div>
                <button className="icon-button" onClick={closeDetail} aria-label="Close">
                  <X size={18} />
                </button>
              </div>

              {detailLoading ? (
                <div className="admin-empty">
                  <LoaderCircle className="spin" size={20} /> Loading tracking…
                </div>
              ) : detailError ? (
                <div className="auth-alert error">{detailError}</div>
              ) : (
                <>
                  <div className="drawer-stats">
                    <AdminStat icon={<Activity size={18} />} label="Tracked habits" value={detailHabits.length} />
                    <AdminStat
                      icon={<UserCheck size={18} />}
                      label="Completion records"
                      value={detailLogs.length || detailHabits.reduce((n, h) => n + (h.completions?.length || 0), 0)}
                    />
                    <AdminStat
                      icon={<ShieldCheck size={18} />}
                      label="Account status"
                      value={detailUser?.status || selected.status}
                      text
                    />
                  </div>

                  <button
                    className={`btn ${selected.status === 'active' ? 'danger' : 'primary'}`}
                    disabled={savingStatus}
                    onClick={() => changeStatus(selected)}
                  >
                    {savingStatus ? 'Updating…' : selected.status === 'active' ? 'Suspend account' : 'Activate account'}
                  </button>

                  <h3>Habits</h3>
                  {detailHabits.length ? (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Habit</th>
                            <th>Schedule</th>
                            <th>Done</th>
                            <th>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailHabits.map(h => (
                            <tr key={h.id}>
                              <td>{h.name}</td>
                              <td>{Array.isArray(h.schedule) ? h.schedule.join(', ') : h.schedule_json || '—'}</td>
                              <td>{h.completions?.length ?? h.completion_count ?? '—'}</td>
                              <td>{h.created_at ? new Date(h.created_at).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="admin-empty">This person hasn't created any habits yet.</div>
                  )}

                  {detailLogs.length > 0 && (
                    <>
                      <h3>Recent completions</h3>
                      <div className="table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Habit</th>
                              <th>Date</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailLogs.slice(0, 100).map((log, i) => (
                              <tr key={log.id || i}>
                                <td>{log.habit_name || log.name || log.habit_id}</td>
                                <td>{log.completion_date || log.date || '—'}</td>
                                <td>{log.completed === false ? 'Not completed' : 'Completed'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  )
}

function AdminStat({ icon, label, value, tone = '', text = false }) {
  return (
    <article className={`admin-stat ${tone}`}>
      <div className="admin-stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{text || typeof value !== 'number' ? value : <CountUp value={value} />}</strong>
    </article>
  )
}

export default App
