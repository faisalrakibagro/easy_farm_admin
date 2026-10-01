export type CollarAlertType = 'heat' | 'low_rumination' | 'low_activity' | 'fever';
export type CollarAlertStatus = 'pending' | 'confirmed' | 'dismissed';

export interface CollarSettings {
  enabled: boolean;
  baseline_days: number;
  min_baseline_days: number;
  heat_activity_rise_pct: number;
  activity_drop_pct: number;
  rumination_drop_pct: number;
  fever_temp: number;
  offline_hours: number;
  raw_retention_days: number;
  notify_whatsapp: boolean;
  has_gateway_key: boolean;
  gateway_key_hint: string | null;
}

export interface CollarOverview {
  settings: CollarSettings;
  counts: { devices: number; assigned: number; online: number; offline: number; low_battery: number; pending_alerts: number };
  ingest_url: string;
}

export interface CollarDevice {
  id: number;
  serial: string;
  label: string | null;
  vendor: string;
  is_active: boolean;
  cattle: { id: number; tag_number: string; name: string | null } | null;
  has_token: boolean;
  token_hint: string | null;
  battery_level: number | null;
  last_seen_at: string | null;
  last_reading_at: string | null;
  offline: boolean;
  notes: string | null;
}

export interface CollarAlert {
  id: number;
  type: CollarAlertType;
  status: CollarAlertStatus;
  cattle: { id: number; tag_number: string; name: string | null; gender: string } | null;
  detected_on: string;
  detected_at: string;
  value: number | null;
  baseline: number | null;
  change_pct: number | null;
  summary: string;
  linked_type: string | null;
  linked_id: number | null;
  notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
}

export interface CollarCattleData {
  device: CollarDevice | null;
  daily: { date: string; activity: number | null; rumination: number | null; eating: number | null; temp_avg: number | null; temp_max: number | null; readings: number }[];
  last_reading: { recorded_at: string; temperature: number | null; latitude: number | null; longitude: number | null } | null;
  alerts: CollarAlert[];
}

export const VENDORS = ['generic', 'allflex', 'afimilk', 'nedap', 'cowmanager', 'smaxtec', 'diy', 'other'] as const;
