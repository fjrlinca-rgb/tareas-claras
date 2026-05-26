import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReporteRowTicket {
  id: string;
  empresa: string;
  titulo: string;
  tecnico: string;
  prioridad: string;
  estado: string;
  creado: string;
  asignado: string;
  finalizado: string;
  tiempo_resolucion: string;
  tiempo_revision: string;
  tiempo_proceso: string;
  adjuntos: number;
  actualizado: string;
}

export interface ReporteRowOT {
  id: string;
  empresa: string;
  tipo: string;
  tecnico: string;
  prioridad: string;
  estado: string;
  creado: string;
  asignado: string;
  finalizado: string;
  tiempo_resolucion: string;
  adjuntos: number;
  actualizado: string;
}

export function exportarTicketsExcel(rows: ReporteRowTicket[], filename = "reporte-tickets.xlsx") {
  const wb = XLSX.utils.book_new();
  const data = rows.map((r) => ({
    ID: r.id,
    Empresa: r.empresa,
    Título: r.titulo,
    Técnico: r.tecnico,
    Prioridad: r.prioridad,
    Estado: r.estado,
    Creado: r.creado,
    Asignado: r.asignado,
    Finalizado: r.finalizado,
    "Tiempo resolución": r.tiempo_resolucion,
    "Tiempo en revisión": r.tiempo_revision,
    "Tiempo en proceso": r.tiempo_proceso,
    Adjuntos: r.adjuntos,
    "Última actualización": r.actualizado,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Tickets");
  XLSX.writeFile(wb, filename);
}

export function exportarTicketsPDF(rows: ReporteRowTicket[], filename = "reporte-tickets.pdf") {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Reporte operativo — Tickets", 14, 14);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString()} · ${rows.length} registros`, 14, 20);
  autoTable(doc, {
    startY: 24,
    head: [["ID", "Empresa", "Título", "Técnico", "Prio", "Estado", "Creado", "Asignado", "Finalizado", "T. resol.", "T. rev.", "T. proc.", "Adj"]],
    body: rows.map((r) => [
      r.id, r.empresa, r.titulo, r.tecnico, r.prioridad, r.estado,
      r.creado, r.asignado, r.finalizado, r.tiempo_resolucion, r.tiempo_revision, r.tiempo_proceso, r.adjuntos,
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 58, 138] },
  });
  doc.save(filename);
}

export function exportarOTExcel(rows: ReporteRowOT[], filename = "reporte-ordenes.xlsx") {
  const wb = XLSX.utils.book_new();
  const data = rows.map((r) => ({
    ID: r.id,
    Empresa: r.empresa,
    Tipo: r.tipo,
    Técnico: r.tecnico,
    Prioridad: r.prioridad,
    Estado: r.estado,
    Creado: r.creado,
    Asignado: r.asignado,
    Finalizado: r.finalizado,
    "Tiempo resolución": r.tiempo_resolucion,
    Adjuntos: r.adjuntos,
    "Última actualización": r.actualizado,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Orden de trabajo");
  XLSX.writeFile(wb, filename);
}

export function exportarOTPDF(rows: ReporteRowOT[], filename = "reporte-ordenes.pdf") {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Reporte operativo — Orden de trabajo", 14, 14);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString()} · ${rows.length} registros`, 14, 20);
  autoTable(doc, {
    startY: 24,
    head: [["ID", "Empresa", "Tipo", "Técnico", "Prio", "Estado", "Creado", "Asignado", "Finalizado", "T. resol.", "Adj"]],
    body: rows.map((r) => [
      r.id, r.empresa, r.tipo, r.tecnico, r.prioridad, r.estado,
      r.creado, r.asignado, r.finalizado, r.tiempo_resolucion, r.adjuntos,
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 58, 138] },
  });
  doc.save(filename);
}
