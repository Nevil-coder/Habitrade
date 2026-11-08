export const starterHabits = [
  { id: 'h1', name: 'Morning workout', category: 'Health', icon: 'Dumbbell', color: '#a78bfa', schedule: [1,2,3,4,5,6,0], reminder: '07:30', target: '30 minutes', createdAt: new Date().toISOString(), completions: [] },
  { id: 'h2', name: 'Read 10 pages', category: 'Learning', icon: 'BookOpen', color: '#60a5fa', schedule: [1,2,3,4,5,6,0], reminder: '20:30', target: '10 pages', createdAt: new Date().toISOString(), completions: [] },
  { id: 'h3', name: 'Drink 2L water', category: 'Health', icon: 'Droplets', color: '#34d399', schedule: [1,2,3,4,5,6,0], reminder: '10:00', target: '2 litres', createdAt: new Date().toISOString(), completions: [] },
  { id: 'h4', name: 'Practice coding', category: 'Learning', icon: 'Code2', color: '#fbbf24', schedule: [1,2,3,4,5], reminder: '19:00', target: '30 minutes', createdAt: new Date().toISOString(), completions: [] },
]
export const navItems = [
  { id: 'dashboard', label: 'Overview', icon: 'LayoutDashboard', group: 'WORKSPACE' },
  { id: 'habits', label: 'My habits', icon: 'ListChecks', group: 'WORKSPACE' },
  { id: 'calendar', label: 'Calendar', icon: 'CalendarDays', group: 'WORKSPACE' },
  { id: 'analytics', label: 'Analytics', icon: 'ChartNoAxesCombined', group: 'WORKSPACE' },
  { id: 'achievements', label: 'Achievements', icon: 'Trophy', group: 'WORKSPACE' },
  { id: 'reminders', label: 'Reminders', icon: 'Bell', group: 'PERSONAL' },
  { id: 'settings', label: 'Settings', icon: 'Settings2', group: 'PERSONAL' },
]
export const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
export const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
export const isScheduled = (habit, date = new Date()) => (habit.schedule || []).includes(date.getDay())
export const isDone = (habit, key = todayKey()) => (habit.completions || []).includes(key)
export const streakFor = habit => {
  let count = 0, cursor = new Date()
  if (!isDone(habit, todayKey())) cursor.setDate(cursor.getDate()-1)
  while (true) {
    const key = dateKey(cursor)
    if (!isScheduled(habit, cursor)) { cursor.setDate(cursor.getDate()-1); continue }
    if (!(habit.completions || []).includes(key)) break
    count++; cursor.setDate(cursor.getDate()-1)
    if (count > 3660) break
  }
  return count
}
