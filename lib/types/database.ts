/**
 * Hand-written types for the HomeKeeper schema.
 *
 * These mirror supabase/migrations/0001_schema.sql. If you change the
 * migration, change this file too. (Later we can generate this with the
 * Supabase CLI instead: `supabase gen types typescript`.)
 */

// heating_fuel lives in lib/emergency.ts because there it is not a fact
// about the house — it decides what a frightened member is told to do.
import type { HeatingFuel } from '@/lib/emergency';
export type { HeatingFuel };

/**
 * Who someone is.
 *
 * 'ops' is the office (0021): members, scheduling, the request board,
 * reports, trade partners. Deliberately NOT pricing, membership terms,
 * user accounts or the checklist standard — those stay with 'admin'.
 */
export type UserRole = 'admin' | 'ops' | 'tech' | 'member' | 'trade';

// 0013 — the facts about the house that change what we check and what we
// tell them in an emergency.
export type WaterSource = 'PUBLIC' | 'WELL' | 'SHARED_WELL' | 'OTHER';
export type SewerType = 'PUBLIC' | 'SEPTIC' | 'MOUND' | 'OTHER';

// 0018 — seasonal checklists.
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

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
export type ChecklistResult =
  // The six the program actually uses. PASS is labelled "Good" — it is
  // kept rather than replaced so old visits do not have to be rewritten.
  | 'PASS'
  | 'MAINTENANCE_DUE'
  | 'MONITOR'
  | 'REPAIR_RECOMMENDED'
  | 'SAFETY_URGENT'
  | 'SPECIALIST_REVIEW'
  // Housekeeping, not verdicts.
  | 'NOT_APPLICABLE'
  | 'NOT_CHECKED'
  // 0019 — retired. Still readable so pre-2026 visits render, never
  // offered as a choice. ATTENTION became MONITOR; FAIL split into the
  // three results that say what to do about it.
  | 'ATTENTION'
  | 'FAIL';
export type AssetCondition = 'NEW' | 'GOOD' | 'FAIR' | 'POOR' | 'END_OF_LIFE' | 'UNKNOWN';
export type PlanItemStatus = 'PROPOSED' | 'APPROVED' | 'SCHEDULED' | 'DONE' | 'DECLINED' | 'DEFERRED';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type DocumentType =
  | 'MANUAL' | 'WARRANTY' | 'RECEIPT' | 'PERMIT' | 'INSPECTION'
  | 'INSURANCE' | 'CONTRACT' | 'ESTIMATE' | 'INVOICE' | 'REPORT' | 'OTHER';
export type PhotoKind = 'GENERAL' | 'DATA_PLATE' | 'DOCUMENT' | 'BEFORE' | 'AFTER';
export type ScanStatus = 'NOT_REQUESTED' | 'PENDING' | 'DONE' | 'FAILED';

export type ReportType =
  | 'VISIT_SUMMARY' | 'ANNUAL_REVIEW' | 'HOME_RECORD' | 'HOME_PLAN'
  // 0016 — the first document a new member ever gets.
  | 'BASELINE';

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
  // 0010 — membership
  tier: 'CORE' | 'RESPONSE';
  billing_cycle: 'MONTHLY' | 'ANNUAL_PREPAID';
  commitment_start: string | null;
  commitment_months: number;
  member_discount_used_ytd: number;
  member_discount_year_start: string | null;
  member_since: string | null;
  // 0013 — the facts about the house itself. Optional because most of the
  // app only ever selects a handful of columns, and a partial row is still
  // a Property.
  construction_type?: string | null;
  exterior_material?: string | null;
  roof_material?: string | null;
  roof_installed_year?: number | null;
  water_source?: WaterSource | null;
  sewer_type?: SewerType | null;
  /** Changes what the emergency screen tells them. See lib/emergency.ts. */
  heating_fuel?: HeatingFuel | null;
  electrical_service_amps?: number | null;
  stories?: number | null;
  basement_type?: string | null;
  /** 0023 — a sales-demo home. Never counted as a member or as revenue. */
  is_demo?: boolean;
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
  /** 0018 — copied from the template. Field app only, never the member. */
  help_note?: string | null;
  /**
   * 0020 — an item that asks for a reading instead of a tick.
   *
   * The band is copied alongside the value so a report written in 2030
   * knows what counted as healthy in 2026.
   */
  measurement_label?: string | null;
  measurement_unit?: string | null;
  measurement_low?: number | null;
  measurement_high?: number | null;
  measurement_value?: number | null;
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
  /** Set when the job came off the Home Plan. */
  finding_id: string | null;
  plan_item_id: string | null;
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
  /** 0009 — set when the file belongs with a particular report. */
  report_id: string | null;
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
