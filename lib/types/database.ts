/**
 * Hand-written types for the HomeKeeper schema.
 *
 * These mirror supabase/migrations/0001_schema.sql. If you change the
 * migration, change this file too. (Later we can generate this with the
 * Supabase CLI instead: `supabase gen types typescript`.)
 */

export type UserRole = 'admin' | 'tech' | 'member' | 'trade';

export type FindingStatus =
  | 'GOOD'
  | 'MONITOR'
  | 'PLAN'
  | 'ACTION'
  | 'IMPROVEMENT';

export type ServiceRequestStage =
  | 'NEW'
  | 'TRIAGE'
  | 'DISPATCHED'
  | 'ACCEPTED'
  | 'ESTIMATING'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'HOME_RECORD_UPDATED'
  | 'CLOSED';

export type VisitStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type VisitType = 'ONBOARDING' | 'SEASONAL' | 'ANNUAL' | 'SERVICE' | 'FOLLOW_UP';
export type ChecklistResult = 'PASS' | 'ATTENTION' | 'FAIL' | 'NOT_APPLICABLE' | 'NOT_CHECKED';
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'END_OF_LIFE' | 'UNKNOWN';
export type PlanItemStatus = 'PROPOSED' | 'APPROVED' | 'SCHEDULED' | 'DONE' | 'DECLINED' | 'DEFERRED';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type DocumentType =
  | 'MANUAL' | 'WARRANTY' | 'RECEIPT' | 'PERMIT' | 'INSPECTION'
  | 'INSURANCE' | 'CONTRACT' | 'ESTIMATE' | 'INVOICE' | 'REPORT' | 'OTHER';
export type PhotoKind = 'GENERAL' | 'DATA_PLATE' | 'DOCUMENT' | 'BEFORE' | 'AFTER';
export type ScanStatus = 'NOT_REQUESTED' | 'PENDING' | 'DONE' | 'FAILED';

export type ReportType = 'VISIT_SUMMARY' | 'ANNUAL_REVIEW' | 'HOME_RECORD' | 'HOME_PLAN';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  year_built: number | null;
  square_feet: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  lot_size_acres: number | null;
  plan_tier: string | null;
  member_since: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  property_id: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  relationship: string | null;
}

export interface Room {
  id: string;
  property_id: string;
  name: string;
  room_type: string | null;
  floor: string | null;
  notes: string | null;
  sort_order: number;
}

export interface Asset {
  id: string;
  property_id: string;
  room_id: string | null;
  category: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  finish: string | null;
  install_date: string | null;
  warranty_expires: string | null;
  expected_life_years: number | null;
  condition: AssetCondition;
  last_serviced_at: string | null;
  location_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Visit {
  id: string;
  property_id: string;
  tech_id: string | null;
  visit_type: VisitType;
  status: VisitStatus;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  title: string | null;
  summary: string | null;
  member_notes: string | null;
}

export interface ChecklistItem {
  id: string;
  visit_id: string;
  category: string;
  label: string;
  result: ChecklistResult;
  notes: string | null;
  sort_order: number;
}

export interface Finding {
  id: string;
  property_id: string;
  visit_id: string | null;
  room_id: string | null;
  asset_id: string | null;
  status: FindingStatus;
  title: string;
  description: string | null;
  recommendation: string | null;
  priority: PriorityLevel;
  estimated_cost_low: number | null;
  estimated_cost_high: number | null;
  created_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface PlanItem {
  id: string;
  property_id: string;
  finding_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  target_year: number | null;
  target_season: string | null;
  priority: PriorityLevel;
  status: PlanItemStatus;
  estimated_cost_low: number | null;
  estimated_cost_high: number | null;
  sort_order: number;
}

export interface ServiceRequest {
  id: string;
  property_id: string;
  member_id: string | null;
  created_by: string | null;
  trade_partner_id: string | null;
  assigned_tech_id: string | null;
  stage: ServiceRequestStage;
  title: string;
  description: string | null;
  priority: PriorityLevel;
  estimate_amount: number | null;
  approved_at: string | null;
  scheduled_for: string | null;
  completed_at: string | null;
  closed_at: string | null;
  created_at: string;
  // 0006 — what and where
  category: string | null;
  room_id: string | null;
  asset_id: string | null;
  // 0006 — what was done, written back to the linked asset on completion
  work_performed: string | null;
  parts_used: string | null;
  completion_model: string | null;
  completion_serial: string | null;
  completion_condition: AssetCondition | null;
  completed_by: string | null;
  record_updated_at: string | null;
}

export interface TradePartner {
  id: string;
  company_name: string;
  trade: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  license_number: string | null;
  profile_id: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface HkDocument {
  id: string;
  property_id: string;
  asset_id: string | null;
  title: string;
  doc_type: DocumentType;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  property_id: string;
  finding_id: string | null;
  asset_id: string | null;
  visit_id: string | null;
  room_id: string | null;
  storage_path: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  taken_at: string | null;
  uploaded_by: string | null;
  created_at: string;
  // 0005 — capture & scan
  kind: PhotoKind;
  note: string | null;
  scan_status: ScanStatus;
  scan_data: unknown | null;
  scan_error: string | null;
  scan_applied_at: string | null;
  scan_applied_by: string | null;
  // 0006 — request media
  service_request_id: string | null;
  mime_type: string | null;
}

export interface Report {
  id: string;
  property_id: string;
  visit_id: string | null;
  title: string;
  report_type: ReportType;
  period_start: string | null;
  period_end: string | null;
  storage_path: string | null;
  generated_by: string | null;
  generated_at: string;
}
