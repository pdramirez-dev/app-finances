export type PipelineStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won";

export type Opportunity = {
  id: string;
  company: string;
  contact: string;
  title: string;
  value: number;
  stage: PipelineStage;
  probability: number;
  owner: string;
  ownerInitials: string;
  source: "Referido" | "Web" | "Evento" | "Prospección";
  nextAction: string;
  daysUntilAction: number;
  tags: string[];
};

export const pipelineStages: Array<{
  id: PipelineStage;
  label: string;
  shortLabel: string;
  accent: string;
  dot: string;
}> = [
  {
    id: "lead",
    label: "Nuevo lead",
    shortLabel: "Nuevo",
    accent: "border-t-sky-400",
    dot: "bg-sky-400",
  },
  {
    id: "qualified",
    label: "Cualificación",
    shortLabel: "Cualificación",
    accent: "border-t-blue-400",
    dot: "bg-blue-400",
  },
  {
    id: "proposal",
    label: "Propuesta",
    shortLabel: "Propuesta",
    accent: "border-t-amber-400",
    dot: "bg-amber-400",
  },
  {
    id: "negotiation",
    label: "Negociación",
    shortLabel: "Negociación",
    accent: "border-t-orange-400",
    dot: "bg-orange-400",
  },
  {
    id: "won",
    label: "Ganado",
    shortLabel: "Ganado",
    accent: "border-t-emerald-400",
    dot: "bg-emerald-400",
  },
];

export const initialOpportunities: Opportunity[] = [
  {
    id: "OP-1048",
    company: "MetroCare Facilities",
    contact: "James Wilson",
    title: "Facility coverage East Region",
    value: 18400,
    stage: "lead",
    probability: 20,
    owner: "María Santos",
    ownerInitials: "MS",
    source: "Web",
    nextAction: "Llamada de alcance",
    daysUntilAction: 0,
    tags: ["Facilities", "Inbound"],
  },
  {
    id: "OP-1047",
    company: "BrightSpan Construction",
    contact: "Emma Ross",
    title: "Cobertura de cuadrilla eléctrica",
    value: 24000,
    stage: "lead",
    probability: 20,
    owner: "Alex Rivera",
    ownerInitials: "AR",
    source: "Referido",
    nextAction: "Confirmar fechas de obra",
    daysUntilAction: 2,
    tags: ["Construcción"],
  },
  {
    id: "OP-1045",
    company: "Greenridge Properties",
    contact: "Laura Bennett",
    title: "Inspección solar Q3",
    value: 76000,
    stage: "qualified",
    probability: 40,
    owner: "Pablo Díaz",
    ownerInitials: "PD",
    source: "Evento",
    nextAction: "Validar alcance por ubicación",
    daysUntilAction: -1,
    tags: ["Solar", "Prioridad"],
  },
  {
    id: "OP-1043",
    company: "Orange Grove Retail",
    contact: "Nathan Cole",
    title: "Mantenimiento de 6 locales",
    value: 28600,
    stage: "qualified",
    probability: 40,
    owner: "María Santos",
    ownerInitials: "MS",
    source: "Prospección",
    nextAction: "Visita técnica",
    daysUntilAction: 1,
    tags: ["Retail"],
  },
  {
    id: "OP-1041",
    company: "Northline Logistics",
    contact: "Daniel Cooper",
    title: "Retrofit eléctrico Warehouse #4",
    value: 42800,
    stage: "proposal",
    probability: 65,
    owner: "Pablo Díaz",
    ownerInitials: "PD",
    source: "Web",
    nextAction: "Revisar propuesta técnica",
    daysUntilAction: 0,
    tags: ["Eléctrico", "Prioridad"],
  },
  {
    id: "OP-1039",
    company: "Lakeside Medical Group",
    contact: "Rachel Morgan",
    title: "Mantenimiento preventivo multi-sede",
    value: 39200,
    stage: "proposal",
    probability: 55,
    owner: "Alex Rivera",
    ownerInitials: "AR",
    source: "Referido",
    nextAction: "Presentación a Facilities",
    daysUntilAction: 3,
    tags: ["Salud", "Multi-sede"],
  },
  {
    id: "OP-1037",
    company: "Harborview Hospitality",
    contact: "Olivia Martin",
    title: "Mantenimiento HVAC anual",
    value: 31500,
    stage: "negotiation",
    probability: 80,
    owner: "María Santos",
    ownerInitials: "MS",
    source: "Evento",
    nextAction: "Cerrar términos del SLA",
    daysUntilAction: -2,
    tags: ["HVAC", "Prioridad"],
  },
  {
    id: "OP-1034",
    company: "Sunset Community Group",
    contact: "Julia Adams",
    title: "Plan anual de inspecciones",
    value: 24800,
    stage: "negotiation",
    probability: 75,
    owner: "Pablo Díaz",
    ownerInitials: "PD",
    source: "Prospección",
    nextAction: "Confirmar condiciones",
    daysUntilAction: 1,
    tags: ["Property"],
  },
  {
    id: "OP-1029",
    company: "Palm Coast Warehousing",
    contact: "Carlos Ortega",
    title: "Iluminación exterior del centro",
    value: 21600,
    stage: "won",
    probability: 100,
    owner: "Alex Rivera",
    ownerInitials: "AR",
    source: "Web",
    nextAction: "Programar cuadrilla",
    daysUntilAction: 4,
    tags: ["Iluminación"],
  },
  {
    id: "OP-1025",
    company: "Bayfront Hotel Group",
    contact: "Eva Price",
    title: "Renovación de equipos de cocina",
    value: 14300,
    stage: "won",
    probability: 100,
    owner: "María Santos",
    ownerInitials: "MS",
    source: "Referido",
    nextAction: "Entregar plan de ejecución",
    daysUntilAction: 2,
    tags: ["Hotelería"],
  },
];

export type TaskPriority = "Alta" | "Media" | "Baja";
export type TaskKind = "Llamada" | "Correo" | "Reunión" | "Seguimiento";

export type CrmTask = {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  priority: TaskPriority;
  kind: TaskKind;
  owner: string;
  ownerInitials: string;
  relatedTo: string;
  completed: boolean;
};

export const demoToday = "2026-07-12";

export const initialTasks: CrmTask[] = [
  {
    id: "TSK-301",
    title: "Revisar propuesta con Northline",
    description: "Ajustar alcance del retrofit y enviar la versión final.",
    dueDate: "2026-07-12",
    dueTime: "10:30",
    priority: "Alta",
    kind: "Seguimiento",
    owner: "Pablo Díaz",
    ownerInitials: "PD",
    relatedTo: "Northline Logistics · OP-1041",
    completed: false,
  },
  {
    id: "TSK-302",
    title: "Llamar a James Wilson",
    description: "Confirmar sedes, cobertura y calendario de decisión.",
    dueDate: "2026-07-12",
    dueTime: "12:00",
    priority: "Alta",
    kind: "Llamada",
    owner: "María Santos",
    ownerInitials: "MS",
    relatedTo: "MetroCare Facilities · OP-1048",
    completed: false,
  },
  {
    id: "TSK-303",
    title: "Enviar alcance de inspección solar",
    dueDate: "2026-07-12",
    dueTime: "16:00",
    priority: "Media",
    kind: "Correo",
    owner: "Pablo Díaz",
    ownerInitials: "PD",
    relatedTo: "Greenridge Properties · OP-1045",
    completed: false,
  },
  {
    id: "TSK-304",
    title: "Validar términos del SLA",
    description: "Confirmar tiempos de respuesta antes de la firma.",
    dueDate: "2026-07-10",
    dueTime: "09:00",
    priority: "Alta",
    kind: "Seguimiento",
    owner: "María Santos",
    ownerInitials: "MS",
    relatedTo: "Harborview Hospitality · OP-1037",
    completed: false,
  },
  {
    id: "TSK-305",
    title: "Preparar visita multi-sede",
    dueDate: "2026-07-13",
    dueTime: "11:00",
    priority: "Media",
    kind: "Reunión",
    owner: "Alex Rivera",
    ownerInitials: "AR",
    relatedTo: "Lakeside Medical Group · OP-1039",
    completed: false,
  },
  {
    id: "TSK-306",
    title: "Confirmar condiciones comerciales",
    dueDate: "2026-07-14",
    dueTime: "15:30",
    priority: "Media",
    kind: "Llamada",
    owner: "Pablo Díaz",
    ownerInitials: "PD",
    relatedTo: "Sunset Community Group · OP-1034",
    completed: false,
  },
  {
    id: "TSK-307",
    title: "Agendar reunión con operaciones",
    dueDate: "2026-07-16",
    priority: "Baja",
    kind: "Correo",
    owner: "María Santos",
    ownerInitials: "MS",
    relatedTo: "Orange Grove Retail · OP-1043",
    completed: false,
  },
  {
    id: "TSK-298",
    title: "Compartir resumen de discovery",
    dueDate: "2026-07-11",
    priority: "Media",
    kind: "Correo",
    owner: "Alex Rivera",
    ownerInitials: "AR",
    relatedTo: "BrightSpan Construction · OP-1047",
    completed: true,
  },
  {
    id: "TSK-294",
    title: "Dar la bienvenida al nuevo cliente",
    dueDate: "2026-07-09",
    priority: "Baja",
    kind: "Llamada",
    owner: "Alex Rivera",
    ownerInitials: "AR",
    relatedTo: "Palm Coast Warehousing · OP-1029",
    completed: true,
  },
];
