/**
 * 线索池的数据库状态与由数据库生成的下一步动作。
 *
 * `lead_stage` 是 public.leads 上的 generated stored 列，只能读取；推进阶段时
 * 必须写入相应的动作时间戳，绝不能写入该列。
 */
export const LEAD_STAGES = [
  "research",
  "call",
  "add_wechat",
  "send_intro",
  "need_discovery",
  "ready_to_convert",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];
export type LeadStageAction = Exclude<LeadStage, "ready_to_convert">;

export const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  research: "待背调",
  call: "待致电",
  add_wechat: "待加微",
  send_intro: "待发介绍",
  need_discovery: "待挖需求",
  ready_to_convert: "可转客户",
};

export const LEAD_STATUSES = [
  "to_organize",
  "to_follow_up",
  "paused",
  "invalid",
  "converted",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  to_organize: "待整理",
  to_follow_up: "活跃",
  paused: "暂不跟进",
  invalid: "无法推进",
  converted: "已转客户",
};

export type LeadStageCounts = Record<LeadStage, number>;

export function emptyLeadStageCounts(): LeadStageCounts {
  return {
    research: 0,
    call: 0,
    add_wechat: 0,
    send_intro: 0,
    need_discovery: 0,
    ready_to_convert: 0,
  };
}
