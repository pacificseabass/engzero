export function formatDateStamp(date: Date): string {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export function formatMonthPath(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
