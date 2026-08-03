import type { CustomerSource, CustomerStage, CustomerStatus, DecisionRole } from "./customerTypes";

/** 两层模型中的商机状态，与 customers.status 使用同一组枚举。 */
export type OpportunityStatus = CustomerStatus;

export interface Opportunity {
  id: string;
  userId: string;
  customerId: string;
  name: string;
  productLines: string[];
  stage: CustomerStage;
  stageChangedAt: string;
  status: OpportunityStatus;
  /** null 表示没有人工覆盖，展示和汇总时应使用 getEffectiveWinRate。 */
  winRate: number | null;
  winRateOverrideReason: string | null;
  amount: number | null;
  currency: string;
  expectedCloseDate: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  lastContactAt: string | null;
  painPoints: string | null;
  needs: string | null;
  keyInfo: string | null;
  lossReason: string | null;
  onHoldUntil: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  userId: string;
  customerId: string;
  name: string;
  title: string | null;
  department: string | null;
  decisionRole: DecisionRole;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  note: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityCustomer {
  id: string;
  companyName: string;
  industry: string | null;
  hqCity: string | null;
  source: CustomerSource;
}

export interface OpportunityWithDetails extends Opportunity {
  customer: OpportunityCustomer;
  contacts: Contact[];
}

export interface OpportunityStageSummary {
  count: number;
  amount: number;
  weightedAmount: number;
}

export type OpportunityStageSummaries = Record<CustomerStage, OpportunityStageSummary>;
