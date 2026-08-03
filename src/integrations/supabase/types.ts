import type { LeadStage, LeadStatus } from "@/lib/salesup/leadTypes";

/**
 * 手工同步自外部 Supabase 的 public.leads / public.customers。
 * 目前仓库中的其他表仍由各 repository 的局部 Row 类型描述。
 */
export type Database = {
  public: {
    Tables: {
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: LeadUpdate;
        Relationships: [];
      };
      customers: {
        Row: CustomerRow;
        Insert: CustomerInsert;
        Update: CustomerUpdate;
        Relationships: [];
      };
      opportunities: {
        Row: OpportunityRow;
        Insert: OpportunityInsert;
        Update: OpportunityUpdate;
        Relationships: [];
      };
      contacts: {
        Row: ContactRow;
        Insert: ContactInsert;
        Update: ContactUpdate;
        Relationships: [];
      };
      opportunity_contacts: {
        Row: OpportunityContactRow;
        Insert: OpportunityContactInsert;
        Update: OpportunityContactUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      set_primary_contact: {
        Args: { p_contact_id: string; p_customer_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type LeadRow = {
  id: string;
  user_id: string;
  source: string;
  source_date: string | null;
  source_detail: string | null;
  event_name: string | null;
  event_date: string | null;
  hall: string | null;
  booth: string | null;
  company_name: string | null;
  industry: string | null;
  company_size: string | null;
  hq_city: string | null;
  website: string | null;
  company_background: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_department: string | null;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  raw_note: string | null;
  conversation_summary: string | null;
  key_info: string | null;
  pain_points: string | null;
  needs: string | null;
  decision_role: string | null;
  budget_signal: string | null;
  timing_signal: string | null;
  current_vendor: string | null;
  priority: string;
  signals: string[];
  score: number | null;
  score_reason: string | null;
  status: LeadStatus;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_at: string | null;
  ai_summary: string | null;
  missing_information: string | null;
  suggested_message: string | null;
  business_card_url: string | null;
  photo_urls: string[];
  researched_at: string | null;
  called_at: string | null;
  wechat_added_at: string | null;
  intro_sent_at: string | null;
  needs_captured_at: string | null;
  exit_reason: string | null;
  exit_at: string | null;
  resume_on: string | null;
  /** generated stored：仅数据库根据动作时间戳推导，客户端禁止写入。 */
  lead_stage: LeadStage;
  converted_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadInsert = Omit<LeadRow, "id" | "created_at" | "updated_at" | "lead_stage"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  lead_stage?: never;
};

export type LeadUpdate = Partial<Omit<LeadInsert, "user_id">> & {
  lead_stage?: never;
};

export type CustomerRow = {
  id: string;
  user_id: string;
  source: string;
  source_detail: string | null;
  source_date: string | null;
  claim_expires_at: string | null;
  lead_id: string | null;
  company_name: string;
  industry: string | null;
  company_size: string | null;
  overseas_markets: string[];
  hq_city: string | null;
  website: string | null;
  current_vendor: string | null;
  company_background: string | null;
  pain_points: string | null;
  needs: string | null;
  key_info: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_department: string | null;
  decision_role: string;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  contact_note: string | null;
  other_contacts: unknown[];
  product_lines: string[];
  stage: string;
  stage_changed_at: string;
  status: string;
  win_rate: number | null;
  win_rate_override_reason: string | null;
  amount: number | null;
  currency: string;
  expected_close_date: string | null;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_at: string | null;
  loss_reason: string | null;
  on_hold_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerInsert = Omit<CustomerRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type CustomerUpdate = Partial<Omit<CustomerInsert, "user_id">>;

export type OpportunityRow = {
  id: string;
  user_id: string;
  customer_id: string;
  name: string;
  product_lines: string[];
  stage: string;
  stage_changed_at: string;
  status: string;
  win_rate: number | null;
  win_rate_override_reason: string | null;
  amount: number | null;
  currency: string;
  expected_close_date: string | null;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_at: string | null;
  pain_points: string | null;
  needs: string | null;
  key_info: string | null;
  loss_reason: string | null;
  on_hold_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityInsert = Omit<OpportunityRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type OpportunityUpdate = Partial<Omit<OpportunityInsert, "user_id" | "customer_id">>;

export type ContactRow = {
  id: string;
  user_id: string;
  customer_id: string;
  name: string;
  title: string | null;
  department: string | null;
  decision_role: string;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  note: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type ContactInsert = Omit<ContactRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ContactUpdate = Partial<Omit<ContactInsert, "user_id" | "customer_id">>;

export type OpportunityContactRow = {
  opportunity_id: string;
  contact_id: string;
};

export type OpportunityContactInsert = OpportunityContactRow;
export type OpportunityContactUpdate = Partial<OpportunityContactRow>;
