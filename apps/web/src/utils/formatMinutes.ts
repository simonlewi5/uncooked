export function formatMinutes(n: number): string {
  if (n === 0) return '—'
  if (n < 60) return `${n}m`
  return `${Math.floor(n / 60)}h ${n % 60}m`
}
