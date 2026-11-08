
import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  UserRound,
  Mail,
  LockKeyhole,
  RefreshCw,
  LogOut,
  Users,
  UserCheck,
  UserX,
  LoaderCircle,
  Sparkles
} from 'lucide-react'

import Workspace from './Workspace'
import {
  registerUser,
  verifyRegistration,
  loginUser,
  verifyLogin,
  getCurrentUser,
  logoutUser,
  getAdminUsers
} from './api'

import './styles.css'

function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [screen, setScreen] = useState('login')
  const [authMode, setAuthMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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

  function resetMessages() {
    setError('')
    setMessage('')
  }

  async function handleSendCode(event) {
    event.preventDefault()
    resetMessages()
    setBusy(true)

    try {
      if (authMode === 'register') {
        await registerUser(name.trim(), email.trim())
      } else {
        await loginUser(email.trim())
      }

      setScreen('otp')
      setMessage('A six-digit verification code has been sent to your email.')
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
      const result = authMode === 'register'
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
    await logoutUser()
    setUser(null)
    setScreen('login')
    setAuthMode('login')
    setName('')
    setEmail('')
    setOtp('')
    resetMessages()
  }

  if (checking) {
    return (
      <div className="auth-loading">
        <LoaderCircle className="auth-spinner" size={34} />
        <span>Checking your Habitrade session...</span>
      </div>
    )
  }

  if (user) {
    if (user.role === 'admin') {
      return <AdminDashboard user={user} onLogout={handleLogout} />
    }

    return (
      <div className="authenticated-app">
        <div className="user-session-bar">
          <div className="session-user">
            <span className="session-avatar">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
          </div>

          <button className="session-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>

        <Workspace />
      </div>
    )
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="auth-brand">
          <div className="auth-logo">
            <Activity size={25} />
          </div>
          <span>habit<span>rade</span></span>
        </div>

        <div className="auth-heading">
          <div className="auth-eyebrow">
            <Sparkles size={13} />
            BUILD BETTER. BECOME BETTER.
          </div>

          <h1>
            {screen === 'otp'
              ? 'Check your inbox'
              : authMode === 'register'
                ? 'Create your account'
                : 'Welcome back'}
          </h1>

          <p>
            {screen === 'otp'
              ? `Enter the verification code sent to ${email}`
              : authMode === 'register'
                ? 'Start building better habits with Habitrade.'
                : 'Sign in to continue your personal growth journey.'}
          </p>
        </div>

        {error && <div className="auth-alert error">{error}</div>}
        {message && <div className="auth-alert success">{message}</div>}

        {screen === 'otp' ? (
          <form className="auth-form" onSubmit={handleVerify}>
            <label className="auth-label">
              Verification code
              <div className="auth-input-wrap">
                <LockKeyhole size={18} />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={e =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  required
                />
              </div>
            </label>

            <button className="auth-submit" disabled={busy}>
              {busy ? 'Verifying...' : 'Verify and continue'}
              {busy ? <LoaderCircle className="auth-spinner" /> : <ArrowRight />}
            </button>

            <button
              type="button"
              className="auth-back"
              onClick={() => {
                setScreen('login')
                setOtp('')
                resetMessages()
              }}
            >
              <ArrowLeft size={15} /> Change email or go back
            </button>
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
                    placeholder="Enter your name"
                    maxLength={80}
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
              {busy ? 'Please wait...' : 'Continue with email'}
              {busy ? <LoaderCircle className="auth-spinner" /> : <ArrowRight />}
            </button>
          </form>
        )}

        {screen !== 'otp' && (
          <div className="auth-switch">
            {authMode === 'login'
              ? "Don't have an account?"
              : 'Already have an account?'}

            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login')
                resetMessages()
              }}
            >
              {authMode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </div>
        )}

        <div className="auth-footer">
          <ShieldCheck size={14} />
          Secure email verification
        </div>
      </motion.section>

      <div className="auth-bottom">
        HABITRADE · YOUR ROUTINE. YOUR PROGRESS.
      </div>
    </main>
  )
}

function AdminDashboard({ user, onLogout }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  useEffect(() => {
    loadUsers()
  }, [])

  const activeUsers = users.filter(u => u.status === 'active').length
  const admins = users.filter(u => u.role === 'admin').length

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <div className="auth-brand">
          <div className="auth-logo"><Activity size={24} /></div>
          <span>habit<span>rade</span></span>
          <span className="admin-tag">ADMIN</span>
        </div>

        <div className="admin-account">
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <button className="session-logout" onClick={onLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <section className="admin-content">
        <div className="admin-welcome">
          <div className="auth-eyebrow"><ShieldCheck size={14} /> ADMINISTRATION</div>
          <h1>Admin dashboard</h1>
          <p>Manage Habitrade accounts and monitor platform access.</p>
        </div>

        <div className="admin-stats">
          <AdminStat icon={<Users />} label="Registered users" value={users.length} />
          <AdminStat icon={<UserCheck />} label="Active accounts" value={activeUsers} />
          <AdminStat icon={<ShieldCheck />} label="Administrators" value={admins} />
        </div>

        <section className="admin-users-panel">
          <div className="admin-panel-heading">
            <div>
              <h2>User management</h2>
              <p>Accounts registered in Habitrade</p>
            </div>

            <button className="admin-refresh" onClick={loadUsers}>
              <RefreshCw size={15} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="admin-empty">
              <LoaderCircle className="auth-spinner" />
              Loading users...
            </div>
          ) : error ? (
            <div className="auth-alert error">{error}</div>
          ) : users.length === 0 ? (
            <div className="admin-empty">No registered users found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(account => (
                    <tr key={account.id}>
                      <td>{account.name}</td>
                      <td>{account.email}</td>
                      <td>
                        <span className={`role-pill ${account.role}`}>
                          {account.role}
                        </span>
                      </td>
                      <td>{account.status}</td>
                      <td>{account.email_verified ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

function AdminStat({ icon, label, value }) {
  return (
    <article className="admin-stat">
      <div className="admin-stat-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

export default App
