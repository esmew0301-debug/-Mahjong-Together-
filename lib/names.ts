/** Numeric usernames are allowed, but "99" alone reads like a score. Show it as "Player 99". */
export function displayName(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "A player";
  return /^[\d\s.,+-]+$/.test(n) ? `Player ${n}` : n;
}
