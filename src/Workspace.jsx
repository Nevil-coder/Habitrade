import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import {
  navItems,
  todayKey,
  dateKey,
  isScheduled,
  isDone,
  streakFor
} from './data'
import {
  getHabits,
  createHabit,
  updateHabit,
  deleteHabitRequest,
  toggleHabitCompletion
} from './api'
import { Confetti, CountUp, FxContext, Icon, Logo, Wordmark, spotlight, useFx } from './ui'

/* =========================================
   UTILITIES
========================================= */

const ease = [0.22, 1, 0.36, 1]

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const fmt = date =>
  date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const categories = ['Health', 'Learning', 'Fitness', 'Mindfulness', 'Personal', 'Work']
const swatches = ['#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#fb7185', '#22d3ee']
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

const blankForm = () => ({
  name: '',
  category: 'Health',
  target: '20 minutes',
  reminder: '08:00',
  schedule: ALL_DAYS,
  color: '#a78bfa'
})

function normalizeHabit(row) {
  let schedule = row.schedule
  if (!Array.isArray(schedule)) {
    try {
      schedule = JSON.parse(row.schedule_json || '[0,1,2,3,4,5,6]')
    } catch {
      schedule = ALL_DAYS
    }
  }

  let completions = row.completions || row.completion_dates || []
  if (!Array.isArray(completions) && typeof completions === 'string') {
    try {
      completions = JSON.parse(completions)
    } catch {
      completions = []
    }
  }

  return {
    ...row,
    id: row.id,
    name: row.name,
    category: row.category || 'Personal',
    target: row.target || row.description || '',
    reminder: row.reminder || '',
    color: row.color || '#a78bfa',
    schedule: Array.isArray(schedule) ? schedule : ALL_DAYS,
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    completions: Array.isArray(completions) ? completions : []
  }
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/* =========================================
   MAIN APP
========================================= */

function Workspace({ user, onLogout }) {
  const reduceMotion = useReducedMotion()
  const uid = user?.id || 'guest'

  const [page, setPage] = useState('dashboard')
  const [theme, setTheme] = useState(() => read(`habitrade-theme-${uid}`, 'dark'))
  const [habits, setHabits] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [name, setName] = useState(() => read(`habitrade-name-${uid}`, user?.name || 'there'))

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const [month, setMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(todayKey())

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [burst, setBurst] = useState(0)

  const [reminders, setReminders] = useState(() => read(`habitrade-reminders-${uid}`, true))
  const [motionLevel, setMotionLevel] = useState(() => read(`habitrade-motion-${uid}`, 'maximum'))
  const [profile, setProfile] = useState(() => read(`habitrade-profile-${uid}`, ''))
  const [form, setForm] = useState(blankForm)

  const reduced = !!reduceMotion || motionLevel === 'reduced'
  const fx = useMemo(
    () => ({ reduced, level: reduced ? 'reduced' : motionLevel }),
    [reduced, motionLevel]
  )

  /* Splash screen */

  const [loading, setLoading] = useState(!reduced)
  const [loadingProgress, setLoadingProgress] = useState(reduced ? 100 : 0)

  useEffect(() => {
    if (reduced) {
      setLoading(false)
      return
    }

    let progress = 0
    const progressTimer = window.setInterval(() => {
      progress = Math.min(100, progress + Math.floor(Math.random() * 9) + 5)
      setLoadingProgress(progress)
      if (progress >= 100) window.clearInterval(progressTimer)
    }, 90)

    const loadingTimer = window.setTimeout(() => {
      setLoadingProgress(100)
      setLoading(false)
    }, 1900)

    return () => {
      window.clearInterval(progressTimer)
      window.clearTimeout(loadingTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Derived values */

  const today = todayKey()
  const scheduled = habits.filter(h => isScheduled(h))
  const done = scheduled.filter(h => isDone(h)).length
  const pct = scheduled.length ? Math.round((done / scheduled.length) * 100) : 0
  const totalXP = habits.reduce((sum, h) => sum + (h.completions?.length || 0) * 10, 0)
  const level = Math.floor(totalXP / 100) + 1
  const pageTitle = navItems.find(n => n.id === page)?.label || 'Overview'

  const notify = (message, kind = 'ok') => {
    window.clearTimeout(toastTimer.current)
    setToast({ message, kind, id: Date.now() })
    toastTimer.current = window.setTimeout(() => setToast(null), 2800)
  }

  /* Load habits from the account */

  useEffect(() => {
    let alive = true
    setDataLoading(true)
    setDataError('')

    getHabits()
      .then(result => {
        if (!alive) return
        const rows = Array.isArray(result.habits) ? result.habits : []
        setHabits(rows.map(normalizeHabit))
      })
      .catch(error => alive && setDataError(error.message))
      .finally(() => alive && setDataLoading(false))

    return () => {
      alive = false
    }
  }, [user?.id])

  /* Persist preferences */

  useEffect(() => localStorage.setItem(`habitrade-theme-${uid}`, JSON.stringify(theme)), [theme, uid])
  useEffect(() => localStorage.setItem(`habitrade-name-${uid}`, JSON.stringify(name)), [name, uid])
  useEffect(() => localStorage.setItem(`habitrade-reminders-${uid}`, JSON.stringify(reminders)), [reminders, uid])
  useEffect(() => localStorage.setItem(`habitrade-motion-${uid}`, JSON.stringify(motionLevel)), [motionLevel, uid])
  useEffect(() => localStorage.setItem(`habitrade-profile-${uid}`, JSON.stringify(profile)), [profile, uid])

  /* Browser notifications */

  useEffect(() => {
    if (!reminders || !('Notification' in window) || Notification.permission !== 'granted') return

    const check = () => {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      habits
        .filter(h => h.reminder === hhmm && isScheduled(h, now) && !isDone(h))
        .forEach(h => {
          const key = `habitrade-notified-${today}-${h.id}-${hhmm}`
          if (!localStorage.getItem(key)) {
            new Notification('Habitrade reminder', { body: `Time for: ${h.name}` })
            localStorage.setItem(key, '1')
          }
        })
    }

    check()
    const timer = window.setInterval(check, 30000)
    return () => window.clearInterval(timer)
  }, [habits, reminders, today])

  /* Habit management */

  const toggleHabit = async id => {
    const habit = habits.find(x => x.id === id)
    if (!habit) return

    const wasDone = (habit.completions || []).includes(today)
    const previous = habits
    const nextDates = wasDone
      ? habit.completions.filter(x => x !== today)
      : [...(habit.completions || []), today]

    const completesDay =
      !wasDone &&
      isScheduled(habit) &&
      scheduled.length > 0 &&
      scheduled.every(h => h.id === id || isDone(h))

    setHabits(current => current.map(h => (h.id === id ? { ...h, completions: nextDates } : h)))
    if (completesDay) setBurst(b => b + 1)

    try {
      await toggleHabitCompletion(id, today)
      notify(
        wasDone
          ? 'Marked as not completed'
          : completesDay
            ? 'Every habit done today · +10 XP'
            : 'Habit completed · +10 XP'
      )
    } catch (error) {
      setHabits(previous)
      notify(`Could not save completion: ${error.message}`, 'error')
    }
  }

  const openCreate = habit => {
    setEditing(habit?.id || null)
    setForm(habit ? { ...habit, schedule: habit.schedule || ALL_DAYS } : blankForm())
    setModal(true)
  }

  const saveHabit = async event => {
    event.preventDefault()
    if (!form.name.trim() || !form.schedule.length) return

    try {
      if (editing) {
        const result = await updateHabit(editing, form)
        const updated = result.habit || { ...form, id: editing }
        setHabits(previous =>
          previous.map(h =>
            h.id === editing
              ? { ...h, ...updated, ...form, id: editing, completions: h.completions || [] }
              : h
          )
        )
      } else {
        const result = await createHabit(form)
        const created = result.habit || result
        setHabits(previous => [
          ...previous,
          normalizeHabit({
            ...form,
            ...created,
            id: created.id,
            schedule: form.schedule,
            completions: created.completions || []
          })
        ])
      }
      setModal(false)
      notify(editing ? 'Habit updated' : 'New habit created')
    } catch (error) {
      notify(`Could not save habit: ${error.message}`, 'error')
    }
  }

  const deleteHabit = async id => {
    try {
      await deleteHabitRequest(id)
      setHabits(previous => previous.filter(h => h.id !== id))
      notify('Habit deleted')
    } catch (error) {
      notify(`Could not delete habit: ${error.message}`, 'error')
    } finally {
      setConfirming(null)
    }
  }

  /* Backup and restore */

  const exportData = () => {
    const blob = new Blob(
      [JSON.stringify({ habits, theme, name, reminders, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'habitrade-backup.json'
    anchor.click()
    URL.revokeObjectURL(url)
    notify('Backup downloaded')
  }

  const importData = event => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = async () => {
      let data
      try {
        data = JSON.parse(reader.result)
        if (!Array.isArray(data.habits)) throw new Error('invalid')
      } catch {
        notify('That backup file is not valid', 'error')
        return
      }

      if (data.theme) setTheme(data.theme)
      if (data.name) setName(data.name)
      if (typeof data.reminders === 'boolean') setReminders(data.reminders)

      const known = new Set(habits.map(h => h.name.trim().toLowerCase()))
      const fresh = data.habits.filter(h => h?.name && !known.has(String(h.name).trim().toLowerCase()))

      if (!fresh.length) {
        notify('Backup restored. Your habits were already here')
        return
      }

      notify(`Restoring ${fresh.length} habit${fresh.length > 1 ? 's' : ''}…`)

      try {
        const restored = []
        for (const habit of fresh) {
          const result = await createHabit(habit)
          const created = result.habit || result
          const dates = Array.isArray(habit.completions) ? habit.completions : []
          const saved = []

          for (let i = 0; i < dates.length; i += 5) {
            const chunk = dates.slice(i, i + 5)
            const outcomes = await Promise.allSettled(chunk.map(d => toggleHabitCompletion(created.id, d)))
            outcomes.forEach((o, n) => o.status === 'fulfilled' && saved.push(chunk[n]))
          }

          restored.push(
            normalizeHabit({ ...habit, ...created, id: created.id, completions: saved })
          )
        }
        setHabits(previous => [...previous, ...restored])
        notify(`Backup restored · ${restored.length} habit${restored.length > 1 ? 's' : ''} added`)
      } catch (error) {
        notify(`Restore stopped: ${error.message}`, 'error')
      }
    }

    reader.readAsText(file)
    event.target.value = ''
  }

  /* Notification permission */

  const askNotifications = async () => {
    if (!('Notification' in window)) {
      notify('Notifications are not supported in this browser', 'error')
      return
    }
    const permission = await Notification.requestPermission()
    setReminders(permission === 'granted')
    notify(
      permission === 'granted' ? 'Notifications enabled' : 'Notification permission not granted',
      permission === 'granted' ? 'ok' : 'error'
    )
  }

  const navigate = nextPage => nextPage !== page && setPage(nextPage)

  const pageDuration = reduced ? 0.01 : motionLevel === 'maximum' ? 0.45 : 0.25

  /* Keyboard: Escape closes dialogs */

  useEffect(() => {
    const onKey = event => {
      if (event.key !== 'Escape') return
      setModal(false)
      setConfirming(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* =========================================
     RENDER
  ========================================= */

  return (
    <FxContext.Provider value={fx}>
      <div className={`app ${theme}`} data-motion={fx.level}>
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />

        {/* Splash */}
        <AnimatePresence>
          {loading && (
            <motion.div
              className="splash"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.06, filter: 'blur(12px)' }}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
            >
              <div className="splash-pulse" />
              <Logo size={84} draw />
              <motion.h1
                className="splash-brand"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6, ease }}
              >
                habit<span>rade</span>
              </motion.h1>
              <motion.p
                className="splash-tagline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                {loadingProgress >= 100 ? 'Welcome back' : 'Setting up your space'}
              </motion.p>
              <div className="splash-bar">
                <motion.i animate={{ width: `${loadingProgress}%` }} transition={{ duration: 0.2 }} />
              </div>
              <span className="splash-percent">{loadingProgress}%</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="brand">
            <Logo size={34} />
            <Wordmark />
          </div>

          <nav className="side-scroll" aria-label="Main">
            {['Workspace', 'Personal'].map(group => (
              <div className="nav-group" key={group}>
                <div className="nav-label">{group}</div>
                {navItems
                  .filter(n => n.group === group.toUpperCase())
                  .map(n => (
                    <button
                      key={n.id}
                      className={`nav-link ${page === n.id ? 'active' : ''}`}
                      onClick={() => navigate(n.id)}
                      aria-current={page === n.id ? 'page' : undefined}
                    >
                      {page === n.id && (
                        <motion.i
                          layoutId="nav-pill"
                          className="nav-pill"
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        />
                      )}
                      <Icon name={n.icon} />
                      <span>{n.label}</span>
                    </button>
                  ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <div className="level-card">
              <div className="level-icon">
                <Icon name="Zap" size={17} />
              </div>
              <div className="level-copy">
                <b>Level {level}</b>
                <span>{totalXP % 100} / 100 XP</span>
                <div className="mini-progress">
                  <motion.i
                    initial={false}
                    animate={{ width: `${totalXP % 100}%` }}
                    transition={{ duration: reduced ? 0 : 0.9, ease }}
                  />
                </div>
              </div>
            </div>

            <div className="profile-row">
              <button className="profile-main" onClick={() => navigate('settings')}>
                <span className="avatar">{(name || 'H').slice(0, 1).toUpperCase()}</span>
                <span className="profile-text">
                  <b>{name || 'Your profile'}</b>
                  <small>{user?.email || 'Personal space'}</small>
                </span>
              </button>
              {onLogout && (
                <button className="icon-button" onClick={onLogout} title="Log out" aria-label="Log out">
                  <Icon name="LogOut" size={17} />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="main-shell">
          <AnimatePresence>
            {dataLoading && (
              <motion.div
                className="sync-bar"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <span className="sync-dot" /> Syncing your habits…
              </motion.div>
            )}
            {dataError && (
              <motion.div
                className="sync-bar error"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
              >
                Could not load your habits: {dataError}
              </motion.div>
            )}
          </AnimatePresence>

          <header className="topbar">
            <div className="topbar-left">
              <span className="topbar-logo">
                <Logo size={28} />
              </span>
              <div className="crumb">
                <span>Workspace</span>
                <Icon name="ChevronRight" size={14} />
                <b>{pageTitle}</b>
              </div>
            </div>

            <div className="top-actions">
              <div className="date-chip">
                <Icon name="CalendarDays" size={15} />
                {fmt(new Date())}
              </div>

              <button
                className="icon-button"
                title="Toggle theme"
                aria-label="Toggle theme"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={theme}
                    className="icon-swap"
                    initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Icon name={theme === 'dark' ? 'Sun' : 'Moon'} size={18} />
                  </motion.span>
                </AnimatePresence>
              </button>

              <button
                className="icon-button notification-button"
                title="Reminders"
                aria-label="Reminders"
                onClick={() => navigate('reminders')}
              >
                <Icon name="Bell" size={18} />
                {reminders && <i />}
              </button>

              <button className="avatar top-avatar" aria-label="Settings" onClick={() => navigate('settings')}>
                {(name || 'H').slice(0, 1).toUpperCase()}
              </button>
            </div>
          </header>

          <section className="content-viewport">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={page}
                className="page-stage"
                initial={{ opacity: 0, y: reduced ? 0 : 16, filter: reduced || motionLevel !== 'maximum' ? 'none' : 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: reduced ? 0 : -8 }}
                transition={{ duration: pageDuration, ease }}
              >
                {page === 'dashboard' && (
                  <Dashboard
                    habits={habits}
                    scheduled={scheduled}
                    done={done}
                    pct={pct}
                    name={name}
                    totalXP={totalXP}
                    loading={dataLoading}
                    burst={burst}
                    onToggle={toggleHabit}
                    onAdd={() => openCreate()}
                    onNavigate={navigate}
                  />
                )}

                {page === 'habits' && (
                  <HabitsPage
                    habits={habits}
                    loading={dataLoading}
                    onToggle={toggleHabit}
                    onAdd={() => openCreate()}
                    onEdit={openCreate}
                    onDelete={id => setConfirming(habits.find(h => h.id === id) || null)}
                    query={query}
                    setQuery={setQuery}
                    filter={filter}
                    setFilter={setFilter}
                  />
                )}

                {page === 'calendar' && (
                  <CalendarPage
                    habits={habits}
                    month={month}
                    setMonth={setMonth}
                    selected={selectedDate}
                    setSelected={setSelectedDate}
                  />
                )}

                {page === 'analytics' && <AnalyticsPage habits={habits} />}

                {page === 'achievements' && <AchievementsPage habits={habits} xp={totalXP} level={level} />}

                {page === 'reminders' && (
                  <RemindersPage habits={habits} enabled={reminders} onEnable={askNotifications} />
                )}

                {page === 'settings' && (
                  <SettingsPage
                    user={user}
                    name={name}
                    setName={setName}
                    theme={theme}
                    setTheme={setTheme}
                    motionLevel={motionLevel}
                    setMotionLevel={setMotionLevel}
                    exportData={exportData}
                    importData={importData}
                    profile={profile}
                    setProfile={setProfile}
                    onLogout={onLogout}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </section>
        </main>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className={`toast ${toast.kind}`}
              role="status"
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            >
              <Icon name={toast.kind === 'error' ? 'CircleAlert' : 'CircleCheck'} size={18} />
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Habit modal */}
        <AnimatePresence>
          {modal && (
            <HabitModal
              form={form}
              setForm={setForm}
              editing={editing}
              onClose={() => setModal(false)}
              onSave={saveHabit}
            />
          )}
        </AnimatePresence>

        {/* Delete confirmation */}
        <AnimatePresence>
          {confirming && (
            <ConfirmDialog
              habit={confirming}
              onCancel={() => setConfirming(null)}
              onConfirm={() => deleteHabit(confirming.id)}
            />
          )}
        </AnimatePresence>

        {/* Mobile navigation */}
        <nav className="mobile-nav" aria-label="Main">
          {navItems.slice(0, 5).map(n => (
            <button
              key={n.id}
              className={page === n.id ? 'selected' : ''}
              onClick={() => navigate(n.id)}
              aria-current={page === n.id ? 'page' : undefined}
            >
              {page === n.id && (
                <motion.i
                  layoutId="mobile-pill"
                  className="mobile-pill"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <Icon name={n.icon} size={19} />
              <small>{n.label}</small>
            </button>
          ))}
        </nav>
      </div>
    </FxContext.Provider>
  )
}

/* =========================================
   SHARED PIECES
========================================= */

function PageHeading({ title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function Empty({ title, text, icon = 'Sparkles', action }) {
  return (
    <div className="empty-state">
      <div className="empty-art">
        <Icon name={icon} size={24} />
      </div>
      <b>{title}</b>
      <span>{text}</span>
      {action}
    </div>
  )
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-row" key={i} style={{ '--i': i }}>
          <i />
          <span />
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, numeric, suffix = '', sub, icon, tone, progress, index = 0 }) {
  const { level } = useFx()

  return (
    <motion.div
      className="stat-card"
      onPointerMove={level === 'maximum' ? spotlight : undefined}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: level === 'reduced' ? 0 : 0.08 * index, duration: 0.5, ease }}
      whileHover={level === 'maximum' ? { y: -4 } : undefined}
    >
      <div className={`stat-icon ${tone}`}>
        <Icon name={icon} size={19} />
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {numeric !== undefined ? <CountUp value={numeric} suffix={suffix} /> : value}
      </div>
      <div className="stat-sub">{sub}</div>

      {progress !== undefined && (
        <div className="stat-line">
          <motion.i
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease }}
          />
        </div>
      )}
    </motion.div>
  )
}

/* Dial: 60 ticks around a progress ring */

function Dial({ value }) {
  const lit = Math.round(value * 0.6)

  return (
    <div className="dial">
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <defs>
          <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b9adff" />
            <stop offset="1" stopColor="#7c5cf0" />
          </linearGradient>
        </defs>

        {Array.from({ length: 60 }, (_, i) => (
          <line
            key={i}
            className={`tick ${i < lit ? 'on' : ''} ${value === 100 ? 'perfect' : ''}`}
            x1="110"
            y1="6"
            x2="110"
            y2={i % 5 === 0 ? 20 : 15}
            transform={`rotate(${i * 6} 110 110)`}
            style={{ transitionDelay: `${i * 12}ms` }}
          />
        ))}

        <circle className="dial-track" cx="110" cy="110" r="76" />
        <motion.circle
          className={`dial-value ${value === 100 ? 'perfect' : ''}`}
          cx="110"
          cy="110"
          r="76"
          transform="rotate(-90 110 110)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: value / 100 }}
          transition={{ duration: 1.3, ease }}
        />
      </svg>

      <div className="dial-center">
        <strong>
          <CountUp value={value} suffix="%" duration={1.2} />
        </strong>
        <span>of today's plan</span>
      </div>
    </div>
  )
}

function HabitRow({ habit, onToggle, compact = false, index = 0 }) {
  const done = isDone(habit)
  const { level } = useFx()
  const streak = streakFor(habit)

  return (
    <motion.div
      layout={level !== 'reduced'}
      className={`habit-row ${done ? 'is-done' : ''}`}
      style={{ '--habit': habit.color || '#a78bfa' }}
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: level === 'reduced' ? 0 : Math.min(index, 8) * 0.05, ease }}
    >
      <button
        className={`habit-check ${done ? 'checked' : ''}`}
        onClick={() => onToggle(habit.id)}
        aria-label={done ? `Mark ${habit.name} as not completed` : `Mark ${habit.name} as completed`}
        aria-pressed={done}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <motion.path
            d="M6 12.5l4 4 8-9"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
            transition={{ duration: level === 'reduced' ? 0 : 0.32, ease: 'easeOut' }}
          />
        </svg>
        {done && level !== 'reduced' && <span className="check-ripple" key="ripple" />}
      </button>

      <div className="habit-info">
        <b>{habit.name}</b>
        <span>
          {habit.category}
          {habit.target ? ` · ${habit.target}` : ''}
        </span>
      </div>

      {!compact && streak > 0 && (
        <div className="habit-streak" title={`${streak} day streak`}>
          <Icon name="Flame" size={14} />
          {streak}
        </div>
      )}

      <span className={`habit-status ${done ? 'done' : ''}`}>{done ? 'Done' : 'To do'}</span>
    </motion.div>
  )
}

/* =========================================
   DASHBOARD
========================================= */

function Dashboard({ habits, scheduled, done, pct, name, totalXP, loading, burst, onToggle, onAdd, onNavigate }) {
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - 6 + i)
    const key = dateKey(date)
    return {
      day: days[date.getDay()],
      today: i === 6,
      done: habits.filter(h => (h.completions || []).includes(key)).length
    }
  })

  const max = Math.max(1, ...week.map(x => x.done))
  const remaining = Math.max(0, scheduled.length - done)
  const bestStreak = Math.max(0, ...habits.map(streakFor))

  const headline =
    scheduled.length === 0
      ? 'Nothing is scheduled for today.'
      : pct === 100
        ? 'Every habit done today. Well played.'
        : done === 0
          ? `${remaining} habit${remaining === 1 ? '' : 's'} waiting for you.`
          : `${remaining} to go. You're already ${pct}% there.`

  return (
    <div>
      <section className="hero">
        <Confetti burst={burst} />

        <div className="hero-copy">
          <h1>
            {greeting()}, {name || 'there'}
          </h1>
          <p className="hero-line">{headline}</p>
          <p className="hero-quote">Small steps, repeated daily, create remarkable change.</p>

          <div className="hero-actions">
            <button className="btn primary" onClick={onAdd}>
              <Icon name="Plus" size={17} />
              New habit
            </button>
            <button className="btn ghost" onClick={() => onNavigate('analytics')}>
              <Icon name="ChartNoAxesCombined" size={16} />
              See analytics
            </button>
          </div>
        </div>

        <Dial value={pct} />
      </section>

      <div className="stats-grid">
        <StatCard index={0} label="Active habits" numeric={habits.length} sub="Your growth toolkit" icon="Layers3" tone="violet" />
        <StatCard
          index={1}
          label="Completed today"
          value={`${done}/${scheduled.length}`}
          sub={`${pct}% of today's plan`}
          icon="CircleCheck"
          tone="green"
          progress={pct}
        />
        <StatCard
          index={2}
          label="Current streak"
          numeric={bestStreak}
          suffix={bestStreak === 1 ? ' day' : ' days'}
          sub="Keep the momentum going"
          icon="Flame"
          tone="orange"
        />
        <StatCard index={3} label="Total experience" numeric={totalXP} suffix=" XP" sub="Every action counts" icon="Zap" tone="blue" />
      </div>

      <div className="dashboard-grid">
        <div className="panel habits-panel">
          <div className="panel-head">
            <div>
              <h2>Today's habits</h2>
              <p>Tick them off as you go.</p>
            </div>
            <button className="text-button" onClick={() => onNavigate('habits')}>
              View all <Icon name="ArrowRight" size={14} />
            </button>
          </div>

          {loading ? (
            <Skeleton rows={4} />
          ) : scheduled.length ? (
            scheduled
              .slice(0, 6)
              .map((habit, i) => <HabitRow key={habit.id} habit={habit} index={i} onToggle={onToggle} />)
          ) : (
            <Empty
              title="No habits scheduled today"
              text="Add a habit or update its schedule to get started."
              action={
                <button className="btn primary small" onClick={onAdd}>
                  <Icon name="Plus" size={15} /> New habit
                </button>
              }
            />
          )}
        </div>

        <div className="panel weekly-panel">
          <div className="panel-head">
            <div>
              <h2>Last 7 days</h2>
              <p>Habits completed per day.</p>
            </div>
          </div>

          <div className="week-bars">
            {week.map((item, index) => (
              <div className={`week-col ${item.today ? 'is-today' : ''}`} key={index}>
                <span className="week-count">{item.done}</span>
                <div className="bar-track">
                  <motion.i
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(5, (item.done / max) * 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.2 + index * 0.06, ease }}
                  />
                </div>
                <span>{item.day}</span>
              </div>
            ))}
          </div>

          <div className="chart-foot">
            <span>This week</span>
            <b>{week.reduce((sum, item) => sum + item.done, 0)} completions</b>
          </div>
        </div>
      </div>
    </div>
  )
}

/* =========================================
   HABITS PAGE
========================================= */

function HabitsPage({ habits, loading, onToggle, onAdd, onEdit, onDelete, query, setQuery, filter, setFilter }) {
  const filtered = habits.filter(
    h =>
      (filter === 'All' || h.category === filter) &&
      h.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      <PageHeading
        title="My habits"
        description="Design a routine that makes your future self proud."
        action={
          <button className="btn primary" onClick={onAdd}>
            <Icon name="Plus" size={17} />
            Add habit
          </button>
        }
      />

      <div className="toolbar">
        <div className="search-box">
          <Icon name="Search" size={17} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your habits"
            aria-label="Search your habits"
          />
        </div>

        <div className="filter-chips" role="tablist" aria-label="Category">
          {['All', ...categories].map(category => (
            <button
              key={category}
              className={filter === category ? 'active' : ''}
              onClick={() => setFilter(category)}
            >
              {filter === category && (
                <motion.i layoutId="chip-pill" className="chip-pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
              )}
              <span>{category}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel habit-list-panel">
        {loading ? (
          <Skeleton rows={5} />
        ) : filtered.length ? (
          <AnimatePresence initial={false}>
            {filtered.map((habit, i) => (
              <motion.div
                className="managed-habit"
                key={habit.id}
                layout
                exit={{ opacity: 0, x: 30, height: 0 }}
                transition={{ duration: 0.3, ease }}
              >
                <HabitRow habit={habit} index={i} onToggle={onToggle} />
                <div className="manage-actions">
                  <button title="Edit" aria-label={`Edit ${habit.name}`} onClick={() => onEdit(habit)}>
                    <Icon name="Pencil" size={16} />
                  </button>
                  <button className="danger" title="Delete" aria-label={`Delete ${habit.name}`} onClick={() => onDelete(habit.id)}>
                    <Icon name="Trash2" size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : habits.length ? (
          <Empty icon="SearchX" title="No habits found" text="Try another search or category." />
        ) : (
          <Empty
            title="Create your first habit"
            text="Pick something small you can do every day."
            action={
              <button className="btn primary small" onClick={onAdd}>
                <Icon name="Plus" size={15} /> Add habit
              </button>
            }
          />
        )}
      </div>
    </div>
  )
}

/* =========================================
   CALENDAR PAGE
========================================= */

function CalendarPage({ habits, month, setMonth, selected, setSelected }) {
  const [direction, setDirection] = useState(1)
  const year = month.getFullYear()
  const m = month.getMonth()

  const first = new Date(year, m, 1).getDay()
  const count = new Date(year, m + 1, 0).getDate()

  const cells = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)]

  const selectedHabits = habits.filter(h => (h.completions || []).includes(selected))
  const selectedDateObj = new Date(`${selected}T12:00:00`)
  const selectedScheduled = habits.filter(h => isScheduled(h, selectedDateObj))

  const go = delta => {
    setDirection(delta)
    setMonth(new Date(year, m + delta, 1))
  }

  return (
    <div>
      <PageHeading title="Habit calendar" description="See the small wins that add up over time." />

      <div className="calendar-layout">
        <div className="panel calendar-panel">
          <div className="panel-head">
            <div>
              <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
            </div>

            <div className="month-actions">
              <button onClick={() => go(-1)} aria-label="Previous month">
                <Icon name="ChevronLeft" />
              </button>
              <button
                className="today-jump"
                onClick={() => {
                  setDirection(1)
                  setMonth(new Date())
                  setSelected(todayKey())
                }}
              >
                Today
              </button>
              <button onClick={() => go(1)} aria-label="Next month">
                <Icon name="ChevronRight" />
              </button>
            </div>
          </div>

          <div className="calendar-weekdays">
            {days.map(day => (
              <b className="weekday" key={day}>
                {day}
              </b>
            ))}
          </div>

          <div className="calendar-clip">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={`${year}-${m}`}
                className="calendar-grid"
                custom={direction}
                initial={{ opacity: 0, x: direction * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -28 }}
                transition={{ duration: 0.22, ease }}
              >
                {cells.map((day, index) => {
                  if (!day) return <span key={`blank${index}`} />

                  const date = new Date(year, m, day)
                  const key = dateKey(date)
                  const completed = habits.filter(h => (h.completions || []).includes(key)).length
                  const total = habits.filter(h => isScheduled(h, date)).length
                  const ratio = total ? Math.min(1, completed / total) : 0

                  return (
                    <button
                      key={day}
                      className={`calendar-day ${selected === key ? 'selected' : ''} ${key === todayKey() ? 'today' : ''} ${ratio === 1 ? 'full' : ''}`}
                      style={{ '--r': ratio }}
                      onClick={() => setSelected(key)}
                      aria-label={`${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}: ${completed} of ${total} done`}
                    >
                      <span>{day}</span>
                      {total > 0 && (
                        <small>
                          {completed}/{total}
                        </small>
                      )}
                    </button>
                  )
                })}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="calendar-legend">
            <span>Less</span>
            <i style={{ '--r': 0 }} />
            <i style={{ '--r': 0.35 }} />
            <i style={{ '--r': 0.7 }} />
            <i style={{ '--r': 1 }} />
            <span>All done</span>
          </div>
        </div>

        <div className="panel selected-day">
          <h2>{selectedDateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>

          <div className="selected-count">
            <CountUp value={selectedHabits.length} duration={0.5} />
            <span>of {selectedScheduled.length} scheduled completed</span>
          </div>

          <AnimatePresence mode="popLayout" initial={false}>
            {selectedHabits.length ? (
              selectedHabits.map(h => (
                <motion.div
                  className="mini-habit"
                  key={`${selected}-${h.id}`}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <i style={{ background: h.color }} />
                  {h.name}
                </motion.div>
              ))
            ) : (
              <motion.p className="muted-copy" key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                No completed habits recorded for this day.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/* =========================================
   ANALYTICS PAGE
========================================= */

function ChartTip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <b>{label || payload[0].payload.name}</b>
      <span>
        {payload[0].value} {unit}
      </span>
    </div>
  )
}

function AnalyticsPage({ habits }) {
  const { reduced } = useFx()

  const data = Array.from({ length: 14 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - 13 + i)
    const key = dateKey(date)
    return {
      day: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      completed: habits.filter(h => (h.completions || []).includes(key)).length
    }
  })

  const total = habits.reduce((sum, h) => sum + (h.completions?.length || 0), 0)
  const possible = habits.length * 14
  const recent = data.reduce((sum, d) => sum + d.completed, 0)
  const rate = possible ? Math.min(100, Math.round((recent / possible) * 100)) : 0
  const longest = Math.max(0, ...habits.map(streakFor))

  const perHabit = habits.map(h => ({
    name: h.name.length > 14 ? h.name.slice(0, 14) + '…' : h.name,
    days: h.completions?.length || 0,
    color: h.color || '#a78bfa'
  }))

  return (
    <div>
      <PageHeading title="Analytics" description="Turn consistency into something you can see and improve." />

      <div className="stats-grid">
        <StatCard index={0} label="Total completions" numeric={total} sub="All-time recorded wins" icon="CheckCheck" tone="green" />
        <StatCard index={1} label="14-day activity" numeric={rate} suffix="%" sub="Against your 14-day target" icon="ChartNoAxesCombined" tone="violet" />
        <StatCard index={2} label="Tracked habits" numeric={habits.length} sub="Active routines" icon="Target" tone="blue" />
        <StatCard index={3} label="Longest streak" numeric={longest} suffix={longest === 1 ? ' day' : ' days'} sub="Across all habits" icon="Flame" tone="orange" />
      </div>

      <div className="panel chart-panel">
        <div className="panel-head">
          <div>
            <h2>Last 14 days</h2>
            <p>Habits completed each day.</p>
          </div>
        </div>

        <div className="chart-box">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8f7bff" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#8f7bff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted)" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} stroke="var(--muted)" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <Tooltip content={<ChartTip unit="completed" />} cursor={{ stroke: 'var(--accent)', strokeOpacity: 0.3 }} />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#9b88ff"
                strokeWidth={3}
                fill="url(#areaFill)"
                isAnimationActive={!reduced}
                animationDuration={1300}
                activeDot={{ r: 5, strokeWidth: 0, fill: '#c4b8ff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel chart-panel">
        <div className="panel-head">
          <div>
            <h2>Completions by habit</h2>
            <p>All-time, using each habit's own color.</p>
          </div>
        </div>

        {perHabit.length ? (
          <div className="chart-box" style={{ height: Math.max(220, perHabit.length * 46 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perHabit} layout="vertical" margin={{ left: 4, right: 20 }}>
                <CartesianGrid stroke="var(--line)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} stroke="var(--muted)" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={118} stroke="var(--muted)" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip content={<ChartTip unit="completions" />} cursor={{ fill: 'var(--soft)' }} />
                <Bar dataKey="days" radius={[0, 8, 8, 0]} isAnimationActive={!reduced} animationDuration={1000} barSize={22}>
                  {perHabit.map((h, i) => (
                    <Cell key={i} fill={h.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty icon="ChartNoAxesColumn" title="Nothing to chart yet" text="Complete a habit and it will show up here." />
        )}
      </div>
    </div>
  )
}

/* =========================================
   ACHIEVEMENTS PAGE
========================================= */

function AchievementsPage({ habits, xp, level }) {
  const completed = habits.reduce((sum, h) => sum + (h.completions?.length || 0), 0)
  const longest = Math.max(0, ...habits.map(streakFor))

  const items = [
    ['First Spark', 'Complete your first habit', 'Sparkles', completed >= 1, completed / 1],
    ['Getting Started', 'Record 5 completions', 'Footprints', completed >= 5, completed / 5],
    ['Week Warrior', 'Reach a 7-day streak', 'Flame', longest >= 7, longest / 7],
    ['Habit Builder', 'Record 30 completions', 'Hammer', completed >= 30, completed / 30],
    ['Consistency Pro', 'Hold a 6-day streak on any habit', 'Crown', habits.some(h => streakFor(h) >= 6), longest / 6],
    ['Level 5', 'Reach level 5', 'Trophy', level >= 5, level / 5]
  ]

  const unlocked = items.filter(i => i[3]).length

  return (
    <div>
      <PageHeading title="Achievements" description="Every small action earns a place in your story." />

      <div className="level-banner">
        <div className="level-orb">
          <Icon name="Trophy" size={30} />
        </div>

        <div className="level-banner-copy">
          <h2>Level {level}</h2>
          <p>
            {xp % 100} / 100 XP to level {level + 1} · {unlocked} of {items.length} achievements unlocked
          </p>
          <div className="level-progress">
            <motion.i initial={{ width: 0 }} animate={{ width: `${xp % 100}%` }} transition={{ duration: 1.1, ease }} />
          </div>
        </div>

        <strong>
          <CountUp value={xp} /> <small>XP</small>
        </strong>
      </div>

      <div className="achievement-grid">
        {items.map(([title, description, icon, earned, progress], index) => (
          <motion.div
            className={`achievement-card ${earned ? 'earned' : ''}`}
            key={title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07, duration: 0.5, ease }}
            whileHover={{ y: -4 }}
          >
            <div className="achievement-icon">
              <Icon name={earned ? icon : 'Lock'} size={24} />
            </div>

            <h3>{title}</h3>
            <p>{description}</p>

            {earned ? (
              <div className="earned-line">
                <Icon name="CircleCheck" size={14} />
                Unlocked
              </div>
            ) : (
              <div className="achv-progress" aria-label={`${Math.round(Math.min(1, progress) * 100)}% complete`}>
                <motion.i
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(1, progress) * 100}%` }}
                  transition={{ duration: 0.9, delay: 0.3 + index * 0.07, ease }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* =========================================
   REMINDERS PAGE
========================================= */

function RemindersPage({ habits, enabled, onEnable }) {
  const withReminder = habits.filter(h => h.reminder).sort((a, b) => a.reminder.localeCompare(b.reminder))

  return (
    <div>
      <PageHeading
        title="Reminders"
        description="Give your intentions a gentle nudge at the right time."
        action={
          <button className="btn primary" onClick={onEnable}>
            <Icon name="BellRing" size={16} />
            {enabled ? 'Notifications enabled' : 'Enable notifications'}
          </button>
        }
      />

      <div className="panel reminder-intro">
        <div className="reminder-art">
          <Icon name="BellRing" size={34} />
          <i />
          <i />
        </div>

        <div>
          <h2>Make time for what matters</h2>
          <p>
            Habitrade can ask your browser for permission to show reminders while the app is open. Your browser and
            operating system settings control delivery.
          </p>
          <span className={`permission-pill ${enabled ? 'allowed' : ''}`}>
            <i />
            {enabled ? 'Notifications on' : 'Notifications off'}
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Reminder times</h2>
            <p>Set these when you create or edit a habit.</p>
          </div>
        </div>

        {withReminder.length ? (
          withReminder.map((h, i) => (
            <motion.div
              className="reminder-row"
              key={h.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, ease }}
            >
              <div className="reminder-icon" style={{ '--habit': h.color }}>
                <Icon name="Clock" />
              </div>
              <div className="habit-info">
                <b>{h.name}</b>
                <span>
                  {h.category} · {h.schedule.length === 7 ? 'Every day' : h.schedule.map(d => days[d]).join(', ')}
                </span>
              </div>
              <strong className="reminder-time">{h.reminder}</strong>
            </motion.div>
          ))
        ) : (
          <Empty icon="BellOff" title="No reminders set" text="Add a reminder time while creating or editing a habit." />
        )}
      </div>
    </div>
  )
}

/* =========================================
   SETTINGS PAGE
========================================= */

function SettingsPage({
  user,
  name,
  setName,
  theme,
  setTheme,
  motionLevel,
  setMotionLevel,
  exportData,
  importData,
  profile,
  setProfile,
  onLogout
}) {
  const motionCopy = {
    maximum: 'Splash screen, confetti and spring effects',
    balanced: 'Smooth transitions, no decorative effects',
    reduced: 'Almost no animation'
  }

  return (
    <div>
      <PageHeading title="Settings" description="Tune your Habitrade experience." />

      <div className="settings-grid">
        <div className="panel settings-panel">
          <h2>Your details</h2>

          <label className="field-label">
            Display name
            <input value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" />
          </label>

          <label className="field-label">
            A little about you
            <textarea
              rows="3"
              value={profile}
              onChange={e => setProfile(e.target.value)}
              placeholder="Your goals, focus or motivation…"
            />
          </label>
        </div>

        <div className="panel settings-panel">
          <h2>Appearance</h2>

          <div className="choice-row">
            <button className={`choice ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}>
              <Icon name="Moon" />
              Dark
            </button>
            <button className={`choice ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}>
              <Icon name="Sun" />
              Light
            </button>
          </div>

          <h3 className="settings-subhead">Motion</h3>

          <div className="choice-row three">
            {['maximum', 'balanced', 'reduced'].map(level => (
              <button
                key={level}
                className={`choice ${motionLevel === level ? 'active' : ''}`}
                onClick={() => setMotionLevel(level)}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
          <p className="muted-copy">{motionCopy[motionLevel]}</p>
        </div>

        <div className="panel settings-panel">
          <h2>Backup and restore</h2>
          <p className="muted-copy">
            Export your habits and preferences to a file. Restoring adds any habits that aren't already in your account.
          </p>

          <div className="backup-actions">
            <button className="btn ghost" onClick={exportData}>
              <Icon name="Download" size={16} />
              Export backup
            </button>

            <label className="btn ghost upload-button">
              <Icon name="Upload" size={16} />
              Import backup
              <input type="file" accept="application/json" onChange={importData} />
            </label>
          </div>
        </div>

        <div className="panel settings-panel">
          <h2>Account</h2>

          <div className="about-line">
            <span>Signed in as</span>
            <b>{user?.email || '—'}</b>
          </div>
          <div className="about-line">
            <span>Habits are stored</span>
            <b>In your account</b>
          </div>
          <div className="about-line">
            <span>Version</span>
            <b>1.0.0</b>
          </div>

          {onLogout && (
            <button className="btn danger-ghost" onClick={onLogout}>
              <Icon name="LogOut" size={16} />
              Log out
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* =========================================
   HABIT MODAL
========================================= */

function HabitModal({ form, setForm, editing, onClose, onSave }) {
  const toggleDay = day =>
    setForm(previous => ({
      ...previous,
      schedule: previous.schedule.includes(day)
        ? previous.schedule.filter(x => x !== day)
        : [...previous.schedule, day]
    }))

  const noDays = form.schedule.length === 0

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <motion.form
        className="habit-modal"
        onSubmit={onSave}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit habit' : 'Create a habit'}
        initial={{ opacity: 0, scale: 0.92, y: 28 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <div className="modal-head">
          <h2>{editing ? 'Edit habit' : 'Create a habit'}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="X" />
          </button>
        </div>

        <div className="preview-chip" style={{ '--habit': form.color }}>
          <i />
          <b>{form.name.trim() || 'Your new habit'}</b>
          <span>{form.target || form.category}</span>
        </div>

        <label className="field-label">
          Habit name
          <input
            autoFocus
            required
            maxLength="48"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Read 10 pages"
          />
        </label>

        <div className="form-two">
          <label className="field-label">
            Category
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {categories.map(category => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Daily target
            <input
              value={form.target}
              onChange={e => setForm({ ...form, target: e.target.value })}
              placeholder="20 minutes"
            />
          </label>
        </div>

        <label className="field-label">
          Reminder time
          <input type="time" value={form.reminder} onChange={e => setForm({ ...form, reminder: e.target.value })} />
        </label>

        <div className="field-label">
          Repeat on
          <div className="weekday-picks">
            {days.map((day, index) => (
              <button
                type="button"
                key={day}
                className={form.schedule.includes(index) ? 'picked' : ''}
                onClick={() => toggleDay(index)}
                aria-pressed={form.schedule.includes(index)}
                aria-label={day}
              >
                {day.slice(0, 2)}
              </button>
            ))}
          </div>
          {noDays && <small className="field-hint">Pick at least one day.</small>}
        </div>

        <div className="field-label">
          Color
          <div className="color-picks">
            {swatches.map(color => (
              <button
                type="button"
                key={color}
                className={form.color === color ? 'picked' : ''}
                style={{ '--swatch': color }}
                onClick={() => setForm({ ...form, color })}
                aria-label={`Color ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" type="submit" disabled={noDays || !form.name.trim()}>
            <Icon name="Check" size={16} />
            {editing ? 'Save changes' : 'Create habit'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  )
}

/* =========================================
   CONFIRM DIALOG
========================================= */

function ConfirmDialog({ habit, onCancel, onConfirm }) {
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={event => event.target === event.currentTarget && onCancel()}
    >
      <motion.div
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={`Delete ${habit.name}`}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        <div className="confirm-icon">
          <Icon name="Trash2" size={22} />
        </div>
        <h2>Delete "{habit.name}"?</h2>
        <p>This removes the habit and its full history. You can't undo this.</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel} autoFocus>
            Keep habit
          </button>
          <button className="btn danger" onClick={onConfirm}>
            Delete habit
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default Workspace
