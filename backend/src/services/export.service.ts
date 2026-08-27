import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../config/prisma.js';
import { APP_TIMEZONE, datePrefixRange, datePrefixToLabel, parseDatePrefix, todayPrefix } from '../utils/date.js';
import { ensureDailyOperations } from './daily-reset.service.js';
import { ticketService } from './ticket.service.js';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTs(date: Date | null | undefined): string {
  if (!date) return '-';
  return date.toLocaleString('es-CO', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function ticketWhere(fromPrefix?: string, toPrefix?: string) {
  if (!fromPrefix && !toPrefix) return { datePrefix: todayPrefix() };
  const prefixes = datePrefixRange(fromPrefix, toPrefix ?? fromPrefix);
  return { datePrefix: { in: prefixes } };
}

export class ExportService {
  async generateExcel(fromPrefix?: string, toPrefix?: string): Promise<Buffer> {
    const where = ticketWhere(fromPrefix, toPrefix);

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        priority: true,
        window: true,
        createdBy: { select: { fullName: true } },
        client: { select: { fullName: true, documentNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Atención');

    sheet.columns = [
      { header: 'Código único', key: 'uniqueCode', width: 22 },
      { header: 'Código visual', key: 'displayCode', width: 14 },
      { header: 'Prioridad', key: 'priority', width: 16 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Ventanilla', key: 'window', width: 14 },
      { header: 'Fórmulas', key: 'formulas', width: 10 },
      { header: 'Cliente', key: 'client', width: 22 },
      { header: 'Documento', key: 'document', width: 16 },
      { header: 'Llamados', key: 'callCount', width: 10 },
      { header: 'Generado por', key: 'createdBy', width: 20 },
      { header: 'Creado', key: 'createdAt', width: 22 },
      { header: 'Llamado', key: 'calledAt', width: 22 },
      { header: 'Atención inicio', key: 'attendingAt', width: 22 },
      { header: 'Finalizado', key: 'finishedAt', width: 22 },
    ];

    for (const t of tickets) {
      sheet.addRow({
        uniqueCode: t.uniqueCode,
        displayCode: t.displayCode,
        priority: t.priority.name,
        status: t.status,
        window: t.window?.name ?? '-',
        formulas: t.formulaCount ?? 1,
        client: t.client?.fullName ?? '-',
        document: t.client?.documentNumber ?? '-',
        callCount: t.callCount,
        createdBy: t.createdBy.fullName,
        createdAt: formatTs(t.createdAt),
        calledAt: formatTs(t.calledAt),
        attendingAt: formatTs(t.attendingAt),
        finishedAt: formatTs(t.finishedAt),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generateDailyExcel(dateInput?: string): Promise<Buffer> {
    await ensureDailyOperations();
    const report = await ticketService.getDailyReport(dateInput);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ventanillas');
    sheet.columns = [
      { header: 'Ventanilla', key: 'window', width: 18 },
      { header: 'Operador', key: 'operator', width: 22 },
      { header: 'Atendidos', key: 'attended', width: 12 },
      { header: 'Ausentes', key: 'absent', width: 12 },
      { header: 'Promedio atención', key: 'avg', width: 16 },
    ];
    for (const row of report.windowReports) {
      sheet.addRow({
        window: row.windowName,
        operator: row.operator,
        attended: row.attended,
        absent: row.absent,
        avg: formatDuration(row.avgAttentionSeconds),
      });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generatePdf(fromPrefix?: string, toPrefix?: string): Promise<Buffer> {
    const where = ticketWhere(fromPrefix, toPrefix);
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        priority: true,
        window: true,
        client: { select: { fullName: true, documentNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const label =
      !fromPrefix && !toPrefix
        ? datePrefixToLabel(todayPrefix())
        : `${datePrefixToLabel(parseDatePrefix(fromPrefix))} – ${datePrefixToLabel(parseDatePrefix(toPrefix ?? fromPrefix))}`;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text('Reporte de turnos', { align: 'center' });
      doc.fontSize(10).text(`Rango: ${label}`, { align: 'center' });
      doc.moveDown();

      for (const t of tickets) {
        const client = t.client ? ` · ${t.client.fullName} (${t.client.documentNumber})` : '';
        doc
          .fontSize(9)
          .text(
            `${t.displayCode} | ${t.status} | ${t.priority.code} | fórm:${t.formulaCount ?? 1} | ${t.window?.name ?? '-'} | ${formatTs(t.createdAt)}${client}`
          );
      }

      doc.end();
    });
  }

  async generateDailyPdf(dateInput?: string): Promise<Buffer> {
    await ensureDailyOperations();
    const report = await ticketService.getDailyReport(dateInput);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(16).text('Informe diario por ventanilla', { align: 'center' });
      doc.fontSize(10).text(datePrefixToLabel(report.datePrefix), { align: 'center' });
      doc.moveDown();

      for (const row of report.windowReports) {
        doc
          .fontSize(10)
          .text(
            `${row.windowName} · ${row.operator} · Atendidos: ${row.attended} · Ausentes: ${row.absent} · Prom: ${formatDuration(row.avgAttentionSeconds)}`
          );
      }

      doc.end();
    });
  }
}

export const exportService = new ExportService();
