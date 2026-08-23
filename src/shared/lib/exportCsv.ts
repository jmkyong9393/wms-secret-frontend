/**
 * Export data to UTF-8 BOM CSV Excel format
 */
export function exportToCSV<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  headers?: { key: keyof T; label: string }[]
) {
  if (!rows || !rows.length) return;

  const keys = headers ? headers.map(h => h.key) : (Object.keys(rows[0]) as (keyof T)[]);
  const headerRow = headers ? headers.map(h => `"${h.label}"`).join(',') : keys.map(k => `"${String(k)}"`).join(',');

  const csvRows = rows.map(row => {
    return keys
      .map(k => {
        let val: any = row[k];
        if (val === null || val === undefined) val = '';
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(',');
  });

  const csvString = '\uFEFF' + [headerRow, ...csvRows].join('\n'); // Add UTF-8 BOM
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
