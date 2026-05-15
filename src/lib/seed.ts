import { supabase } from "@/integrations/supabase/client";
import { Priority, Status } from "./tickets";

interface SeedTicket {
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  assigned_technician: string;
}

export const DEMO_TICKETS: SeedTicket[] = [
  {
    title: "Caída de red en planta baja",
    description: "Los usuarios de la planta baja reportan pérdida total de conectividad LAN desde las 09:15. Switch principal sin respuesta a ping.",
    priority: "critica",
    status: "en_proceso",
    assigned_technician: "Carlos Méndez",
  },
  {
    title: "VPN corporativa no conecta desde Windows 11",
    description: "Tras la última actualización, el cliente FortiClient no establece túnel. Error -5029. Afecta a equipo comercial remoto.",
    priority: "alta",
    status: "pendiente",
    assigned_technician: "Lucía Fernández",
  },
  {
    title: "Impresora HP LaserJet de contabilidad fuera de línea",
    description: "La impresora del piso 3 muestra 'sin conexión'. Reinicio del spooler no resuelve. Posible fallo de tarjeta de red interna.",
    priority: "media",
    status: "pendiente",
    assigned_technician: "Andrés Torres",
  },
  {
    title: "Servidor de archivos con uso de disco al 95%",
    description: "El servidor SRV-FILES01 está cerca del límite de almacenamiento. Requiere ampliación o limpieza de respaldos antiguos.",
    priority: "alta",
    status: "en_proceso",
    assigned_technician: "Carlos Méndez",
  },
  {
    title: "Telefonía IP: cortes intermitentes en llamadas salientes",
    description: "Extensiones del área comercial pierden audio tras 30s. Posible problema de QoS en el router perimetral.",
    priority: "alta",
    status: "pendiente",
    assigned_technician: "Lucía Fernández",
  },
  {
    title: "Solicitud de alta de usuario en Active Directory",
    description: "Crear cuenta para nueva incorporación: María López, departamento de Marketing. Permisos estándar + acceso a unidad compartida 'M:'.",
    priority: "baja",
    status: "finalizado",
    assigned_technician: "Andrés Torres",
  },
  {
    title: "Wi-Fi guest sin acceso a internet",
    description: "Los visitantes pueden conectarse a la SSID 'NetExpert-Guest' pero no navegan. Captive portal responde, pero no entrega DHCP correctamente.",
    priority: "media",
    status: "en_proceso",
    assigned_technician: "Sofía Ramírez",
  },
  {
    title: "Servidor de correo: cola de mensajes detenida",
    description: "Postfix muestra 1.200 mensajes en cola hacia dominios externos. Posible bloqueo por reputación de IP saliente.",
    priority: "critica",
    status: "pendiente",
    assigned_technician: "Carlos Méndez",
  },
  {
    title: "Reemplazo de tóner impresora multifunción Xerox",
    description: "Solicitud rutinaria de cambio de tóner negro en equipo del área de RRHH.",
    priority: "baja",
    status: "finalizado",
    assigned_technician: "Andrés Torres",
  },
  {
    title: "Lentitud generalizada en sistema ERP",
    description: "Usuarios reportan tiempos de respuesta superiores a 8s en consultas habituales. Revisar índices de la base de datos y carga del servidor de aplicaciones.",
    priority: "alta",
    status: "en_proceso",
    assigned_technician: "Sofía Ramírez",
  },
  {
    title: "Cambio de configuración de firewall — apertura puerto 8443",
    description: "Habilitar acceso desde IPs de proveedor externo al puerto 8443 del servidor de monitoreo.",
    priority: "media",
    status: "finalizado",
    assigned_technician: "Lucía Fernández",
  },
  {
    title: "Equipo de oficina no enciende — recepción",
    description: "PC de recepción no muestra señal de video tras corte eléctrico. Posible fallo de fuente de poder.",
    priority: "media",
    status: "pendiente",
    assigned_technician: "Sofía Ramírez",
  },
];

export async function seedDemoTickets(userId: string) {
  const rows = DEMO_TICKETS.map((t) => ({ ...t, user_id: userId }));
  const { error } = await supabase.from("tickets").insert(rows);
  if (error) throw error;
}
