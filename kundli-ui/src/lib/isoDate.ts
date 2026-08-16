/** First YYYY-MM-DD in a dasha/sky timestamp, including PyJHora "YYYY-MM-DD HH:MM:SS AM" strings. */
export function isoDateKey(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.trim().match(/(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? value.trim().slice(0, 10);
}
