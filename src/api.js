
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
    throw new Error(data.error || 'Request failed')
  }

  return data
}

export async function registerUser(name, email) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email })
  })
}

export async function verifyRegistration(email, otp) {
  const result = await request('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp })
  })

  localStorage.setItem('habitrade_token', result.token)
  return result
}

export async function loginUser(email) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email })
  })
}

export async function verifyLogin(email, otp) {
  const result = await request('/api/auth/verify-login', {
    method: 'POST',
    body: JSON.stringify({ email, otp })
  })

  localStorage.setItem('habitrade_token', result.token)
  return result
}

export async function getCurrentUser() {
  return request('/api/auth/me')
}

export async function logoutUser() {
  try {
    await request('/api/auth/logout', { method: 'POST' })
  } finally {
    localStorage.removeItem('habitrade_token')
  }
}

export async function getAdminUsers() {
  return request('/api/admin/users')
}
