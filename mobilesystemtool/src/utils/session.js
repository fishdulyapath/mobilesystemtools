const AUTH_KEY = 'mobiletools_auth'
const POS_KEY = 'mobiletools_pos'
const ERP_KEY = 'mobiletools_erp_option'
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

export function saveSession(employee, loginTime, rememberMe) {
  localStorage.setItem(AUTH_KEY, JSON.stringify({ employee, loginTime, rememberMe }))
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isSessionValid(session) {
  if (!session || !session.loginTime) return false
  if (session.rememberMe === true) return true
  return (Date.now() - session.loginTime) < TWENTY_FOUR_HOURS
}

export function clearSession() {
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(POS_KEY)
  localStorage.removeItem(ERP_KEY)
}

export function savePos(posData) {
  localStorage.setItem(POS_KEY, JSON.stringify(posData))
}

export function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveErpOption(erpOption) {
  localStorage.setItem(ERP_KEY, JSON.stringify(erpOption))
}

export function loadErpOption() {
  try {
    const raw = localStorage.getItem(ERP_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
