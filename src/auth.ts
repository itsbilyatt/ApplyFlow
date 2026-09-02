export type AuthUser = {
  id: string
  name: string
  email: string
  password: string
  createdAt: string
}

export type AuthSession = {
  id: string
  name: string
  email: string
  loggedInAt: string
}

const USERS_KEY = 'applyflow-users'
const SESSION_KEY = 'applyflow-session'

const defaultUser: AuthUser = {
  id: 'user-demo-001',
  name: 'Demo User',
  email: 'demo@applyflow.com',
  password: 'demo123',
  createdAt: new Date().toISOString(),
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(value))
}

export function getUsers(): AuthUser[] {
  const users = readStorage<AuthUser[]>(USERS_KEY, [])
  if (users.length === 0) {
    writeStorage(USERS_KEY, [defaultUser])
    return [defaultUser]
  }

  const hasDemo = users.some((user) => user.email === defaultUser.email)
  if (!hasDemo) {
    const merged = [defaultUser, ...users]
    writeStorage(USERS_KEY, merged)
    return merged
  }

  return users
}

export function getCurrentUser(): AuthSession | null {
  const session = readStorage<AuthSession | null>(SESSION_KEY, null)
  return session
}

export function setCurrentUser(user: AuthUser) {
  writeStorage(SESSION_KEY, {
    id: user.id,
    name: user.name,
    email: user.email,
    loggedInAt: new Date().toISOString(),
  })
}

export function logoutUser() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(SESSION_KEY)
  }
}

export function signupUser(input: { name: string; email: string; password: string }): { success: boolean; message: string; user?: AuthUser } {
  const name = input.name.trim()
  const email = input.email.trim().toLowerCase()
  const password = input.password.trim()

  if (!name || !email || !password) {
    return { success: false, message: 'Name, email, and password are required.' }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: 'Please enter a valid email address.' }
  }

  if (password.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters long.' }
  }

  const users = getUsers()
  if (users.some((user) => user.email === email)) {
    return { success: false, message: 'An account with this email already exists.' }
  }

  const user: AuthUser = {
    id: `user-${Date.now()}`,
    name,
    email,
    password,
    createdAt: new Date().toISOString(),
  }

  const nextUsers = [...users, user]
  writeStorage(USERS_KEY, nextUsers)
  setCurrentUser(user)

  return {
    success: true,
    message: 'Account created successfully.',
    user,
  }
}

export function loginUser(input: { email: string; password: string }): { success: boolean; message: string; user?: AuthSession } {
  const email = input.email.trim().toLowerCase()
  const password = input.password.trim()

  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' }
  }

  const users = getUsers()
  const user = users.find((entry) => entry.email === email && entry.password === password)

  if (!user) {
    return {
      success: false,
      message: 'Invalid email or password. Please sign up first or use a valid account.',
    }
  }

  const session: AuthSession = {
    id: user.id,
    name: user.name,
    email: user.email,
    loggedInAt: new Date().toISOString(),
  }

  writeStorage(SESSION_KEY, session)

  return {
    success: true,
    message: 'Login successful.',
    user: session,
  }
}
