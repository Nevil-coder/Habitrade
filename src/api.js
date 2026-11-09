
const API_BASE_URL = 'https://habitrade-api.mytechgamer02.workers.dev'

async function request(path, options = {}) {
  const token = localStorage.getItem('habitrade_token')

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.error || data.message || `Request failed (${response.status})`
    )
  }

  return data
}

const json = value => JSON.stringify(value)

// Authentication API

export async function registerUser(name, email) {
  return request('/api/auth/register', {
    method: 'POST',
    body: json({ name, email })
  })
}

export async function verifyRegistration(email, otp) {
  const result = await request('/api/auth/verify-otp', {
    method: 'POST',
    body: json({ email, otp })
  })

  localStorage.setItem('habitrade_token', result.token)
  return result
}

export async function loginUser(email) {
  return request('/api/auth/login', {
    method: 'POST',
    body: json({ email })
  })
}

export async function verifyLogin(email, otp) {
  const result = await request('/api/auth/verify-login', {
    method: 'POST',
    body: json({ email, otp })
  })

  localStorage.setItem('habitrade_token', result.token)
  return result
}

export async function getCurrentUser() {
  return request('/api/auth/me')
}

export async function logoutUser() {
  try {
    await request('/api/auth/logout', {
      method: 'POST'
    })
  } finally {
    localStorage.removeItem('habitrade_token')
  }
}

// Habit API
// User identity is verified by the backend session token.

export async function getHabits() {
  return request('/api/habits')
}

export async function createHabit(habit) {
  return request('/api/habits', {
    method: 'POST',
    body: json({
      name: habit.name,
      description: habit.target || habit.description || '',
      color: habit.color || '#a78bfa',
      icon: habit.icon || habit.category || 'Target',
      schedule: habit.schedule || [0, 1, 2, 3, 4, 5, 6],
      category: habit.category || 'Personal',
      target: habit.target || '',
      reminder: habit.reminder || ''
    })
  })
}

export async function updateHabit(id, habit) {
  return request(`/api/habits/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: json({
      name: habit.name,
      description: habit.target || habit.description || '',
      color: habit.color || '#a78bfa',
      icon: habit.icon || habit.category || 'Target',
      schedule: habit.schedule || [0, 1, 2, 3, 4, 5, 6],
      category: habit.category || 'Personal',
      target: habit.target || '',
      reminder: habit.reminder || ''
    })
  })
}

export async function deleteHabitRequest(id) {
  return request(`/api/habits/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
}

export async function toggleHabitCompletion(id, date) {
  return request(
    `/api/habits/${encodeURIComponent(id)}/completions`,
    {
      method: 'POST',
      body: json({
        date,
        completion_date: date
      })
    }
  )
}

// Admin API
// Admin authorization is enforced by the backend.

export async function getAdminUsers() {
  return request('/api/admin/users')
}

export async function getAdminDashboard() {
  return request('/api/admin/dashboard')
}

export async function getAdminUserDetails(id) {
  return request(`/api/admin/users/${encodeURIComponent(id)}`)
}

export async function updateAdminUserStatus(id, status) {
  return request(
    `/api/admin/users/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: json({ status })
    }
  )
}
