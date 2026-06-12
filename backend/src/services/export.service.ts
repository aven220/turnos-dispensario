import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { TicketStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { datePrefixToLabel, parseDatePrefix, todayPrefix } from '../utils/date.js';
import { ensureDailyOperations } from './daily-reset.service.js';
import { ticketService } from './ticket.service.js';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTs(date: Date | null | undefined): string {
  return date ? date.toLocaleString('es-CO') : '-';
}

export class ExportService {
  async generateExcel(dateFrom?: Date, dateTo?: Date): Promise<Buffer> {
    const prefix = !dateFrom && !dateTo ? todayPrefix() : undefined;
    const where = prefix
      ? { datePrefix: prefix }
      : {
          createdAt: {
            ...(dateFrom && { gte: dateFrom }),
            ...(dateTo && { lte: dateTo }),
          },
        };

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        priority: true,
        window: true,
        createdBy: { select: { fullName: true } },
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

    const summary = workbook.addWorksheet('Resumen del día');
    summary.addRow(['Informe diario de ventanillas']);
    summary.addRow(['Fecha', report.dateLabel]);
    summary.addRow(['Generados', report.summary.generated]);
    summary.addRow(['Atendidos', report.summary.attended]);
    summary.addRow(['Ausentes', report.summary.absent]);
    summary.addRow(['Cancelados', report.summary.cancelled]);
    summary.addRow(['Pendientes', report.summary.pending]);
    summary.addRow([]);
    summary.addRow(['Ventanilla', 'Número', 'Operador', 'Atendidos', 'Ausentes', 'Promedio atención']);

    for (const w of report.windowReports) {
      summary.addRow([
        w.windowName,
        w.windowNumber,
        w.operator,
        w.attended,
        w.absent,
        formatDuration(w.avgAttentionSeconds),
      ]);
    }

    for (const w of report.windowReports) {
      const sheet = workbook.addWorksheet(`V${w.windowNumber}`.slice(0, 31));
      sheet.addRow([w.windowName, `Operador: ${w.operator}`]);
      sheet.addRow(['Atendidos', w.attended, 'Ausentes', w.absent, 'Promedio', formatDuration(w.avgAttentionSeconds)]);
      sheet.addRow([]);
      sheet.columns = [
        { header: 'Turno', key: 'displayCode', width: 12 },
        { header: 'Prioridad', key: 'priority', width: 14 },
        { header: 'Estado', key: 'status', width: 14 },
        { header: 'Llamados', key: 'callCount', width: 10 },
        { header: 'Generado', key: 'createdAt', width: 20 },
        { header: 'Llamado', key: 'calledAt', width: 20 },
        { header: 'Inicio atención', key: 'attendingAt', width: 20 },
        { header: 'Finalizado', key: 'finishedAt', width: 20 },
        { header: 'Duración', key: 'duration', width: 12 },
      ];

      for (const t of w.tickets) {
        const duration =
          t.attendingAt && t.finishedAt
            ? formatDuration(Math.round((t.finishedAt.getTime() - t.attendingAt.getTime()) / 1000))
            : '-';
        sheet.addRow({
          displayCode: t.displayCode,
          priority: t.priority.name,
          status: t.status,
          callCount: t.callCount,
          createdAt: formatTs(t.createdAt),
          calledAt: formatTs(t.calledAt),
          attendingAt: formatTs(t.attendingAt),
          finishedAt: formatTs(t.finishedAt),
          duration,
        });
      }
    }

    if (report.unassigned.length > 0) {
      const pending = workbook.addWorksheet('Sin ventanilla');
      pending.columns = [
        { header: 'Turno', key: 'displayCode', width: 12 },
        { header: 'Prioridad', key: 'priority', width: 14 },
        { header: 'Estado', key: 'status', width: 14 },
        { header: 'Generado', key: 'createdAt', width: 20 },
      ];
      for (const t of report.unassigned) {
        pending.addRow({
          displayCode: t.displayCode,
          priority: t.priority.name,
          status: t.status,
          createdAt: formatTs(t.createdAt),
        });
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async generatePdf(dateFrom?: Date, dateTo?: Date): Promise<Buffer> {
    const stats = await ticketService.getStats(dateFrom, dateTo);
    const dateLabel = stats.datePrefix ? datePrefixToLabel(stats.datePrefix) : 'Período seleccionado';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text('Reporte Ejecutivo - Turnos', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Fecha: ${dateLabel}`);
      doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`);
      doc.moveDown();

      doc.fontSize(14).text('Indicadores generales');
      doc.fontSize(11);
      doc.text(`Turnos generados: ${stats.generated}`);
      doc.text(`Turnos atendidos: ${stats.attended}`);
      doc.text(`Turnos ausentes: ${stats.absent}`);
      doc.text(`Turnos cancelados: ${stats.cancelled}`);
      doc.moveDown();

      doc.fontSize(14).text('Ranking por ventanilla');
      doc.fontSize(11);
      stats.windowStats.forEach((w, i) => {
        doc.text(
          `${i + 1}. ${w.windowName}: ${w.totalAttended} atendidos | Promedio: ${formatDuration(w.avgAttentionSeconds)} | Operador: ${w.assignedUser ?? 'Sin asignar'}`
        );
      });

      doc.end();
    });
  }

  async generateDailyPdf(dateInput?: string): Promise<Buffer> {
    await ensureDailyOperations();
    const report = await ticketService.getDailyReport(dateInput);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Informe detallado por ventanilla', { align: 'center' });
      doc.fontSize(12).text(`Fecha: ${report.dateLabel}`, { align: 'center' });
      doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, { align: 'center' });
      doc.moveDown();

      doc.fontSize(13).text('Resumen del día');
      doc.fontSize(10);
      doc.text(`Generados: ${report.summary.generated}  |  Atendidos: ${report.summary.attended}  |  Ausentes: ${report.summary.absent}`);
      doc.text(`Cancelados: ${report.summary.cancelled}  |  Pendientes: ${report.summary.pending}`);
      doc.moveDown();

      for (const w of report.windowReports) {
        doc.fontSize(12).text(`${w.windowName} (Ventanilla ${w.windowNumber})`, { underline: true });
        doc.fontSize(10);
        doc.text(`Operador: ${w.operator}`);
        doc.text(`Atendidos: ${w.attended}  |  Ausentes: ${w.absent}  |  Promedio: ${formatDuration(w.avgAttentionSeconds)}`);
        doc.moveDown(0.5);

        if (w.tickets.length === 0) {
          doc.text('Sin turnos registrados.');
        } else {
          for (const t of w.tickets) {
            const line = `${t.displayCode} · ${t.priority.name} · ${t.status} · Llamados: ${t.callCount}`;
            doc.text(line);
            if (t.calledAt) doc.text(`   Llamado: ${formatTs(t.calledAt)}`, { indent: 10 });
            if (t.finishedAt) doc.text(`   Finalizado: ${formatTs(t.finishedAt)}`, { indent: 10 });
          }
        }
        doc.moveDown();
      }

      if (report.unassigned.length > 0) {
        doc.addPage();
        doc.fontSize(12).text('Turnos sin ventanilla asignada', { underline: true });
        doc.fontSize(10);
        for (const t of report.unassigned) {
          doc.text(`${t.displayCode} · ${t.priority.name} · ${t.status}`);
        }
      }

      doc.end();
    });
  }
}

export const exportService = new ExportService();
