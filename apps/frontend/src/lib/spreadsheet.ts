/**
 * Spreadsheet download for the admin lists, opened directly by Excel.
 *
 * CSV with a UTF-8 BOM (so accents survive) and ";" as separator (what Excel
 * in Portuguese expects), so no spreadsheet library is needed.
 */

type Cell = string | number | null | undefined;

/** Byte order mark: tells Excel the file is UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/**
 * Quotes a cell when it holds the separator, quotes or line breaks.
 *
 * @param value Cell value.
 * @returns The CSV-safe text.
 */
function csvCell(value: Cell): string {
  const text = value == null ? '' : String(value);
  // A leading = + - @ would run as a formula in Excel: prefix it with a quote.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Builds the CSV text of a table.
 *
 * @param header Column titles.
 * @param rows Row values, in the same order as the header.
 * @returns The CSV text, BOM included.
 */
export function toExcelCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map(row => row.map(csvCell).join(';'));
  return BOM + lines.join(String.fromCharCode(13, 10));
}

/**
 * Downloads a table as a file Excel opens.
 *
 * @param fileName Name without extension.
 * @param header Column titles.
 * @param rows Row values.
 */
export function downloadSpreadsheet(fileName: string, header: string[], rows: Cell[][]): void {
  const blob = new Blob([toExcelCsv(header, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
