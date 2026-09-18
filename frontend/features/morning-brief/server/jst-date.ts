export function todayJst(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(now);
}

export function weekdayForJstDate(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay().toString();
}

export function previousJstDates(beforeDate: string, count: number) {
  const cursor = new Date(`${beforeDate}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const value = new Date(cursor);
    value.setUTCDate(cursor.getUTCDate() - index - 1);
    return value.toISOString().slice(0, 10);
  });
}
