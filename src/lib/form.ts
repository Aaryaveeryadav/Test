/** FormData helpers shared by server actions (not exported as actions). */
export function str(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key)
  return v.length > 0 ? v : null
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key)
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function bool(fd: FormData, key: string): boolean {
  const v = str(fd, key)
  return v === 'on' || v === 'true'
}

export function genTempPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `Sk${out}1!`
}
