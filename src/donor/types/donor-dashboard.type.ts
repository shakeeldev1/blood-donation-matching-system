export interface DashboardStat {
  label: string;
  value: string | number;
  badge?: {
    text: string;
    type: 'warning' | 'error' | 'success' | 'info';
  };
  subtext?: string;
}

export interface DashboardProgress {
  label: string;
  value: number;
}

export interface DashboardActivityItem {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  status: 'Completed' | 'Upcoming';
}

export interface DashboardRequestItem {
  id: number;
  hospital: string;
  location: string;
  bloodGroup: string;
  urgency: string;
  distance: string;
}

export interface EligibilityChartPoint {
  label: string;
  readiness: number;
  target: number;
  checkpointDate?: string;
}

export interface ReadinessChartPoint {
  name: string;
  value: number;
  color: string;
}

export interface DonorDashboardResponse {
  donorProfile: unknown | null;
  welcomeName: string;
  stats: DashboardStat[];
  progress: DashboardProgress;
  recentActivity: DashboardActivityItem[];
  matchedRequests: DashboardRequestItem[];
  eligibilityChart: EligibilityChartPoint[];
  readinessChart: ReadinessChartPoint[];
}

export interface DonorAppointmentsResponse {
  stats: Array<{
    title: string;
    value: string;
    label: string;
    color: 'blue' | 'green' | 'purple';
  }>;
  upcomingAppointments: unknown[];
  pastAppointments: unknown[];
  locations: string[];
  times: string[];
}

export interface DonorHistoryResponse {
  stats: Array<{
    title: string;
    value: string;
    label: string;
    color: 'red' | 'blue' | 'yellow';
  }>;
  history: unknown[];
}

export interface DonorRequestsResponse {
  stats: DashboardStat[];
  requests: Array<{
    requestId: string;
    id: number;
    patientName: string;
    hospital: string;
    location: string;
    bloodGroup: string;
    units: number;
    urgency: string;
    postedTime: string;
    distance: string;
    contact: string;
    status: 'Pending' | 'Accepted' | 'Fulfilled' | 'Closed';
  }>;
  myRequests: Array<{
    requestId: string;
    id: number;
    patientName: string;
    hospital: string;
    location: string;
    bloodGroup: string;
    units: number;
    urgency: string;
    postedTime: string;
    distance: string;
    contact: string;
    status: 'Pending' | 'Accepted' | 'Fulfilled' | 'Closed';
  }>;
}

export interface DonorSettingsResponse {
  notifications: {
    email: boolean;
    sms: boolean;
    urgentAlerts: boolean;
    promotions: boolean;
  };
  profile: {
    name: string;
    email: string;
  };
}
