import readAllSheets, {
  readSheet,
} from 'read-excel-file/node';

/**
 * Read an XLSX input and return its worksheet names.
 *
 * @param {Buffer | Uint8Array | ArrayBuffer} input
 * @returns {Promise<string[]>}
 */
export async function listXlsxSheetNames(input) {
  const sheets = await readAllSheets(input);
  return sheets.map(({ sheet }) => sheet);
}

/**
 * Read one worksheet as a rectangular array.
 *
 * Empty trailing cells are padded so fixed column indexes remain stable.
 *
 * @param {Buffer | Uint8Array | ArrayBuffer} input
 * @param {string | number} sheet
 * @returns {Promise<unknown[][]>}
 */
export async function readXlsxRows(input, sheet) {
  const rows = await readSheet(input, sheet);

  const width = rows.reduce(
    (maximum, row) => Math.max(maximum, row.length),
    0,
  );

  return rows.map((row) => {
    const normalized = [...row];

    while (normalized.length < width) {
      normalized.push(null);
    }

    return normalized;
  });
}

/**
 * Convert spreadsheet values to the text representation used by the
 * fuel-price parsers.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function xlsxCellToText(value) {
  if (value == null) return '';

  if (value instanceof Date) {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');

    return `${day}/${month}/${value.getUTCFullYear()}`;
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'richText' in value &&
    Array.isArray(value.richText)
  ) {
    return value.richText
      .map((part) => part?.text ?? '')
      .join('');
  }

  return String(value);
}
