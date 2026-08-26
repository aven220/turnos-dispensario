import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { logAudit } from './audit.service.js';

export function normalizeDocument(doc: string): string {
  return doc.trim().replace(/\s+/g, '').toUpperCase();
}

export async function searchClientByDocument(documentNumber: string) {
  const doc = normalizeDocument(documentNumber);
  if (!doc) return null;
  return prisma.client.findUnique({ where: { documentNumber: doc } });
}

export async function createClient(params: {
  documentNumber: string;
  fullName: string;
  userId?: string;
  ipAddress?: string;
}) {
  const documentNumber = normalizeDocument(params.documentNumber);
  const fullName = params.fullName.trim();
  if (!documentNumber || documentNumber.length < 3) {
    const err = new Error('Documento inválido') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  if (!fullName || fullName.length < 2) {
    const err = new Error('Nombre inválido') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  try {
    const client = await prisma.client.create({
      data: { documentNumber, fullName },
    });
    if (params.userId) {
      await logAudit({
        userId: params.userId,
        action: 'CLIENTE_CREADO',
        details: `${fullName} (${documentNumber})`,
        ipAddress: params.ipAddress,
      });
    }
    return client;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const err = new Error('Ya existe un cliente con ese documento') as Error & { statusCode?: number };
      err.statusCode = 409;
      throw err;
    }
    throw e;
  }
}

export async function listClients(params: { q?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const q = params.q?.trim();

  const where: Prisma.ClientWhereInput = q
    ? {
        OR: [
          { documentNumber: { contains: normalizeDocument(q), mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {};

  const [total, items] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      orderBy: { fullName: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, page, pageSize, items };
}

export type ImportRow = { row: number; documentNumber: string; fullName: string };
export type ImportError = { row: number; documentNumber?: string; error: string };

function parseRowValue(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

/** Detecta columnas documento/nombre en encabezados flexibles. */
function mapHeaders(headers: string[]): { docIdx: number; nameIdx: number } {
  const normalized = headers.map((h) => h.toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''));
  const docIdx = normalized.findIndex((h) =>
    ['documento', 'document', 'cedula', 'identificacion', 'id', 'doc'].some((k) => h.includes(k))
  );
  const nameIdx = normalized.findIndex((h) =>
    ['nombre', 'name', 'cliente', 'full_name', 'fullname'].some((k) => h.includes(k))
  );
  return {
    docIdx: docIdx >= 0 ? docIdx : 0,
    nameIdx: nameIdx >= 0 ? nameIdx : 1,
  };
}

export async function parseClientImportBuffer(buffer: Buffer, filename: string): Promise<{
  rows: ImportRow[];
  parseErrors: ImportError[];
}> {
  const rows: ImportRow[] = [];
  const parseErrors: ImportError[] = [];
  const lower = filename.toLowerCase();

  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return { rows, parseErrors };

    const split = (line: string) => {
      const parts: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if ((ch === ',' || ch === ';') && !inQuotes) {
          parts.push(cur);
          cur = '';
          continue;
        }
        cur += ch;
      }
      parts.push(cur);
      return parts.map((p) => p.trim());
    };

    const header = split(lines[0]);
    const { docIdx, nameIdx } = mapHeaders(header);
    const start = header.some((h) => /documento|nombre|cedula|name/i.test(h)) ? 1 : 0;

    for (let i = start; i < lines.length; i++) {
      const cols = split(lines[i]);
      const documentNumber = parseRowValue(cols[docIdx]);
      const fullName = parseRowValue(cols[nameIdx]);
      const rowNum = i + 1;
      if (!documentNumber && !fullName) continue;
      if (!documentNumber || documentNumber.length < 3) {
        parseErrors.push({ row: rowNum, documentNumber, error: 'Documento inválido' });
        continue;
      }
      if (!fullName || fullName.length < 2) {
        parseErrors.push({ row: rowNum, documentNumber, error: 'Nombre inválido' });
        continue;
      }
      rows.push({ row: rowNum, documentNumber: normalizeDocument(documentNumber), fullName });
    }
    return { rows, parseErrors };
  }

  // Excel
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows, parseErrors };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = parseRowValue(cell.value);
  });
  const { docIdx, nameIdx } = mapHeaders(headers);
  const hasHeader = headers.some((h) => /documento|nombre|cedula|name/i.test(h));

  sheet.eachRow((row, rowNumber) => {
    if (hasHeader && rowNumber === 1) return;
    const documentNumber = parseRowValue(row.getCell(docIdx + 1).value);
    const fullName = parseRowValue(row.getCell(nameIdx + 1).value);
    if (!documentNumber && !fullName) return;
    if (!documentNumber || documentNumber.length < 3) {
      parseErrors.push({ row: rowNumber, documentNumber, error: 'Documento inválido' });
      return;
    }
    if (!fullName || fullName.length < 2) {
      parseErrors.push({ row: rowNumber, documentNumber, error: 'Nombre inválido' });
      return;
    }
    rows.push({ row: rowNumber, documentNumber: normalizeDocument(documentNumber), fullName });
  });

  return { rows, parseErrors };
}

export async function previewClientImport(rows: ImportRow[], parseErrors: ImportError[]) {
  // Deduplicar dentro del archivo (último gana para preview de "nuevos")
  const byDoc = new Map<string, ImportRow>();
  for (const r of rows) byDoc.set(r.documentNumber, r);
  const uniqueRows = [...byDoc.values()];

  const docs = uniqueRows.map((r) => r.documentNumber);
  const existing = docs.length
    ? await prisma.client.findMany({
        where: { documentNumber: { in: docs } },
        select: { documentNumber: true },
      })
    : [];
  const existingSet = new Set(existing.map((e) => e.documentNumber));

  const nuevos = uniqueRows.filter((r) => !existingSet.has(r.documentNumber)).length;
  const yaExistentes = uniqueRows.filter((r) => existingSet.has(r.documentNumber)).length;

  return {
    totalFound: rows.length + parseErrors.length,
    uniqueInFile: uniqueRows.length,
    nuevos,
    yaExistentes,
    conErrores: parseErrors.length,
    errors: parseErrors.slice(0, 200),
    rows: uniqueRows,
  };
}

export async function confirmClientImport(
  rows: ImportRow[],
  userId: string,
  ipAddress?: string
) {
  let created = 0;
  let skipped = 0;
  const errors: ImportError[] = [];

  // Insertar por lotes pequeños
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    for (const r of chunk) {
      try {
        await prisma.client.create({
          data: { documentNumber: r.documentNumber, fullName: r.fullName },
        });
        created += 1;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          skipped += 1;
        } else {
          errors.push({
            row: r.row,
            documentNumber: r.documentNumber,
            error: e instanceof Error ? e.message : 'Error al insertar',
          });
        }
      }
    }
  }

  await logAudit({
    userId,
    action: 'CLIENTES_IMPORTADOS',
    details: `creados=${created} omitidos=${skipped} errores=${errors.length}`,
    ipAddress,
  });

  return { created, skipped, errors };
}
