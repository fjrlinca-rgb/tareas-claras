import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReporteDiario } from "@/hooks/useReportesDiarios";

export function exportarExcel(rows: ReporteDiario[], filename = "reportes.xlsx") {
  const wb = XLSX.utils.book_new();

  const resumen = rows.map((r) => ({
    Fecha: r.fecha,
    "Total tickets": r.total_tickets,
    Pendientes: r.pendientes,
    "En proceso": r.en_proceso,
    "En revisión": r.en_revision,
    Finalizados: r.finalizados,
    Críticos: r.criticos,
    "Creados (día)": r.tickets_creados,
    "Finalizados (día)": r.tickets_finalizados,
    "Tiempo prom. resol. (h)": Number(r.tiempo_promedio_resolucion_horas).toFixed(2),
    "SLA %": Number(r.sla_cumplido_pct).toFixed(1),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen diario");

  const tecnicos: Array<Record<string, unknown>> = [];
  rows.forEach((r) =>
    (r.tickets_por_tecnico ?? []).forEach((t) =>
      tecnicos.push({ Fecha: r.fecha, Técnico: t.nombre, Email: t.email, Total: t.total, Finalizados: t.finalizados, Activos: t.activos })
    )
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tecnicos), "Por técnico");

  const empresas: Array<Record<string, unknown>> = [];
  rows.forEach((r) =>
    (r.tickets_por_empresa ?? []).forEach((e) =>
      empresas.push({ Fecha: r.fecha, Empresa: e.nombre, Total: e.total })
    )
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empresas), "Por empresa");

  XLSX.writeFile(wb, filename);
}

export function exportarPDF(rows: ReporteDiario[], filename = "reportes.pdf") {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Reportes de actividad — Histórico diario", 14, 16);
  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [["Fecha", "Total", "Pend.", "Proc.", "Rev.", "Fin.", "Críticos", "Creados", "Finaliz.", "T. prom. (h)", "SLA %"]],
    body: rows.map((r) => [
      r.fecha, r.total_tickets, r.pendientes, r.en_proceso, r.en_revision,
      r.finalizados, r.criticos, r.tickets_creados, r.tickets_finalizados,
      Number(r.tiempo_promedio_resolucion_horas).toFixed(1),
      Number(r.sla_cumplido_pct).toFixed(1),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 138] },
  });

  const ultimo = rows[rows.length - 1];
  if (ultimo) {
    autoTable(doc, {
      startY: (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8,
      head: [["Técnico", "Email", "Total", "Finalizados", "Activos"]],
      body: (ultimo.tickets_por_tecnico ?? []).map((t) => [t.nombre, t.email, t.total, t.finalizados, t.activos]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] },
    });
  }

  doc.save(filename);
}
