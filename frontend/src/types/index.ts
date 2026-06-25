export type UserRole = 'ADMIN' | 'FILTER' | 'WINDOW';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  status?: string;
  windowAssignments?: { window: { id: string; name: string; number: number } }[];
}

export interface Priority {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  isActive?: boolean;
  _count?: { tickets: number };
}

export interface Window {
  id: string;
  name: string;
  number: number;
  isActive: boolean;
  operators?: { user: { id: string; fullName: string } }[];
  priorities?: { sortOrder: number; priority: Priority }[];
  sessions?: { user: { fullName: string } }[];
  currentTicket?: Ticket | null;
  todayServed?: number;
  activeSession?: { user: { fullName: string }; startedAt: string; availableForService?: boolean } | null;
}

export type TicketStatus = 'GENERADO' | 'LLAMADO' | 'ATENDIENDO' | 'FINALIZADO' | 'AUSENTE' | 'CANCELADO';

export interface Ticket {
  id: string;
  uniqueCode: string;
  displayCode: string;
  status: TicketStatus;
  callCount: number;
  priority: Priority;
  window?: Window | null;
  createdAt: string;
  calledAt?: string | null;
  attendingAt?: string | null;
  finishedAt?: string | null;
  createdBy?: { fullName: string };
}

export interface TicketMonitorSummary {
  total: number;
  generated: number;
  called: number;
  attending: number;
  finished: number;
  absent: number;
  cancelled: number;
}

export interface TicketMonitorData {
  summary: TicketMonitorSummary;
  active: Ticket[];
  tickets: Ticket[];
  datePrefix: string;
}

export interface TvMedia {
  id: string;
  title: string;
  url: string;
  type: 'VIDEO' | 'IMAGE';
  sortOrder: number;
  isActive: boolean;
}

export interface TickerMessage {
  id: string;
  message: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TvSettings {
  id: string;
  upcomingCount: number;
  windowQueueCount: number;
  welcomeMessage: string;
  welcomeFontScale: number;
  tickerFontScale: number;
  speechRate: number;
  speechVoice: string;
  speechLang: string;
}

export interface TicketPrintSettings {
  id: string;
  headerTitle: string;
  showHeader: boolean;
  showPriority: boolean;
  showDisplayCode: boolean;
  showUniqueCode: boolean;
  showDateTime: boolean;
  showFooter: boolean;
  footerMessage: string;
  messageFontScale: number;
}

export interface TvDisplay {
  pendingCalls: Ticket[];
  attending: Ticket[];
  media: TvMedia[];
  ticker: TickerMessage[];
  upcoming: Ticket[];
  settings: TvSettings;
}

export interface Stats {
  generated: number;
  attended: number;
  absent: number;
  cancelled: number;
  datePrefix?: string;
  windowStats: {
    windowId: string;
    windowName: string;
    windowNumber: number;
    totalAttended: number;
    totalAbsent?: number;
    avgAttentionSeconds: number;
    assignedUser: string | null;
    attentionStatus: 'ACTIVE' | 'PAUSED' | 'OFFLINE';
  }[];
}
