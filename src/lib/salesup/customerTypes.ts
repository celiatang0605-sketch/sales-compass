// 客户看板 —— 类型定义与派生指标工具。
// 与 db/customers.sql 的 customers 表一一对应（camelCase，映射在 customerRepository 里做）。

import { todayKey, toDateKey } from "./date";

export type CustomerStage =
  | "opportunity_confirmed"
  | "need_confirmed"
  | "solution_confirmed"
  | "quote_confirmed"
  | "negotiation"
  | "signing"
  | "signed";

export const STAGE_ORDER: CustomerStage[] = [
  "opportunity_confirmed",
  "need_confirmed",
  "solution_confirmed",
  "quote_confirmed",
  "negotiation",
  "signing",
  "signed",
];

export const STAGE_LABEL: Record<CustomerStage, string> = {
  opportunity_confirmed: "机会确认",
  need_confirmed: "需求确认",
  solution_confirmed: "方案确认",
  quote_confirmed: "报价确认",
  negotiation: "商务谈判",
  signing: "签约过程",
  signed: "已签合同",
};

/** 阶段对应的设计 token；看板展示从这里读取，不在组件中分散定义颜色。 */
export const STAGE_COLOR_TOKEN: Record<CustomerStage, string> = {
  opportunity_confirmed: "--color-stage-opportunity",
  need_confirmed: "--color-stage-demand",
  solution_confirmed: "--color-stage-solution",
  quote_confirmed: "--color-stage-quote",
  negotiation: "--color-stage-negotiation",
  signing: "--color-stage-signing",
  signed: "--color-won",
};

export const STAGE_DEFAULT_WIN_RATE: Record<CustomerStage, number> = {
  opportunity_confirmed: 10,
  need_confirmed: 20,
  solution_confirmed: 40,
  quote_confirmed: 50,
  negotiation: 60,
  signing: 80,
  signed: 100,
};

/** 默认停滞阈值（天）。null = 不判断停滞。 */
export type StageStaleDays = Record<CustomerStage, number | null>;

export const STAGE_STALE_DAYS: StageStaleDays = {
  opportunity_confirmed: 7,
  need_confirmed: 10,
  solution_confirmed: 10,
  quote_confirmed: 14,
  negotiation: 14,
  signing: 7,
  signed: null,
};

export type CustomerStatus = "active" | "won" | "lost" | "on_hold";

export const STATUS_LABEL: Record<CustomerStatus, string> = {
  active: "进行中",
  won: "已赢",
  lost: "已丢",
  on_hold: "暂缓培育",
};

export type CustomerSource =
  | "expo"
  | "marketing_assigned"
  | "list_claimed"
  | "existing_upsell"
  | "referral"
  | "self_developed"
  | "other";

export const SOURCE_ORDER: CustomerSource[] = [
  "expo",
  "marketing_assigned",
  "list_claimed",
  "existing_upsell",
  "referral",
  "self_developed",
  "other",
];

export const SOURCE_LABEL: Record<CustomerSource, string> = {
  expo: "展会建联",
  marketing_assigned: "市场部分配",
  list_claimed: "客户名单认领",
  existing_upsell: "老客转化",
  referral: "老客推荐",
  self_developed: "自主开发",
  other: "其他",
};

export type DecisionRole =
  | "decision_maker"
  | "influencer"
  | "user"
  | "gatekeeper"
  | "champion"
  | "unknown";

export const ROLE_LABEL: Record<DecisionRole, string> = {
  decision_maker: "决策者",
  influencer: "影响者",
  user: "使用者",
  gatekeeper: "采购门槛",
  champion: "内线",
  unknown: "待判断",
};

export interface OtherContact {
  name?: string;
  title?: string;
  decisionRole?: DecisionRole;
  contact?: string;
  note?: string;
}

export interface Customer {
  id: string;
  userId: string;

  // 来源层
  source: CustomerSource;
  sourceDetail: string | null;
  sourceDate: string | null; // YYYY-MM-DD
  claimExpiresAt: string | null;
  leadId: string | null;

  // 公司层
  companyName: string;
  industry: string | null;
  companySize: string | null;
  overseasMarkets: string[];
  hqCity: string | null;
  website: string | null;
  currentVendor: string | null;
  companyBackground: string | null;
  painPoints: string | null;
  needs: string | null;
  keyInfo: string | null;

  // 人员层
  contactName: string | null;
  contactTitle: string | null;
  contactDepartment: string | null;
  decisionRole: DecisionRole;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  contactNote: string | null;
  otherContacts: OtherContact[];

  // 商机层
  productLines: string[];
  stage: CustomerStage;
  stageChangedAt: string; // ISO
  status: CustomerStatus;
  winRate: number | null;
  winRateOverrideReason: string | null;
  amount: number | null;
  currency: string;
  expectedCloseDate: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  lastContactAt: string | null; // ISO
  lossReason: string | null;
  onHoldUntil: string | null;

  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 手动覆盖的赢率优先，否则用该阶段的默认赢率。 */
export interface StageWinRateEntity {
  stage: CustomerStage;
  winRate: number | null | undefined;
}

export function getEffectiveWinRate(entity: StageWinRateEntity): number {
  if (entity.winRate !== null && entity.winRate !== undefined) {
    return entity.winRate;
  }
  return STAGE_DEFAULT_WIN_RATE[entity.stage] ?? 0;
}

/** 今天减去 stage_changed_at 的天数（按本地日期计算，>= 0）。 */
export function staleDays(customer: Customer): number {
  if (!customer.stageChangedAt) return 0;
  const changed = new Date(customer.stageChangedAt);
  if (Number.isNaN(changed.getTime())) return 0;
  const a = new Date(toDateKey(changed) + "T00:00:00");
  const b = new Date(todayKey() + "T00:00:00");
  const diff = Math.floor((b.getTime() - a.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

/** 停滞天数是否超过该阶段阈值。 */
export function isStale(customer: Customer, thresholds: StageStaleDays): boolean {
  const threshold = thresholds[customer.stage];
  if (threshold === null || threshold === undefined) return false;
  return staleDays(customer) > threshold;
}
