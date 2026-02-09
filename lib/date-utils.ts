/** Format date as DD-MM-YYYY for display across the app. */
export function formatDisplayDate(date: Date | string): string {
  const d =
    typeof date === "string"
      ? new Date(date.includes("T") ? date : date + "T12:00:00")
      : date;
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
