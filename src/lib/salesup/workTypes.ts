// Work type definitions for Sales Up.
// Colors are CSS variables defined in src/styles.css.
// Categories used for stats aggregation in stats.ts.

export type WorkTypeId =
  | "meeting_customer"
  | "visit_customer"
  | "followup_customer"
  | "proposal"
  | "research"
  | "internal_meeting"
  | "learning"
  | "admin"
  | "review"
  | "buffer";

export type StatCategory =
  | "customer_progress" // 客户推进
  | "internal_cost" // 内部消耗
  | "proposal" // 方案准备
  | "learning_review" // 学习复盘
  | "other";

export interface WorkType {
  id: WorkTypeId;
  label: string;
  description: string;
  colorVar: string; // CSS var name without var()
  categories: StatCategory[];
}

export const WORK_TYPES: WorkType[] = [
  {
    id: "meeting_customer",
    label: "客户会议",
    description: "线上客户会、需求沟通、方案讲解、复盘会",
    colorVar: "--wt-meeting-customer",
    categories: ["customer_progress"],
  },
  {
    id: "visit_customer",
    label: "客户拜访",
    description: "线下面访、客户现场交流、商务拜访",
    colorVar: "--wt-visit-customer",
    categories: ["customer_progress"],
  },
  {
    id: "followup_customer",
    label: "客户跟进",
    description: "微信、邮件、电话、会后推进、约下次会议",
    colorVar: "--wt-followup-customer",
    categories: ["customer_progress"],
  },
  {
    id: "proposal",
    label: "方案准备",
    description: "写方案、做报价、整理案例、准备材料",
    colorVar: "--wt-proposal",
    categories: ["customer_progress", "proposal"],
  },
  {
    id: "research",
    label: "客户研究",
    description: "查客户背景、行业信息、竞品动态、舆情线索",
    colorVar: "--wt-research",
    categories: ["customer_progress"],
  },
  {
    id: "internal_meeting",
    label: "内部会议",
    description: "团队会、项目会、领导同步、跨部门沟通",
    colorVar: "--wt-internal-meeting",
    categories: ["internal_cost"],
  },
  {
    id: "learning",
    label: "产品学习",
    description: "学习产品功能、案例、行业知识、销售话术",
    colorVar: "--wt-learning",
    categories: ["learning_review"],
  },
  {
    id: "admin",
    label: "行政流程",
    description: "报销、系统录入、合同流程、资料整理",
    colorVar: "--wt-admin",
    categories: ["internal_cost"],
  },
  {
    id: "review",
    label: "复盘规划",
    description: "日复盘、周复盘、下周计划、目标检查",
    colorVar: "--wt-review",
    categories: ["learning_review"],
  },
  {
    id: "buffer",
    label: "缓冲休息",
    description: "通勤、吃饭、短休、状态恢复",
    colorVar: "--wt-buffer",
    categories: ["other"],
  },
];

export const WORK_TYPE_MAP: Record<WorkTypeId, WorkType> = Object.fromEntries(
  WORK_TYPES.map((wt) => [wt.id, wt]),
) as Record<WorkTypeId, WorkType>;

export function getWorkType(id: WorkTypeId | string | null | undefined): WorkType | undefined {
  if (!id) return undefined;
  return WORK_TYPE_MAP[id as WorkTypeId];
}
