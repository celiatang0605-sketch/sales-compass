// Mock data for the Expo Leads (展会线索) module - Phase 1 UI prototype only.
// No persistence, no Supabase. Replace with real data source in Phase 2.

export type ExpoRating = "A" | "B" | "C" | "D" | "unrated";
export type ExpoStatus =
  | "new"
  | "to_organize"
  | "following"
  | "proposal"
  | "won"
  | "lost"
  | "on_hold";

export interface ExpoLead {
  id: string;
  company: string;
  contactName: string;
  contactTitle?: string;
  phone?: string;
  wechat?: string;
  email?: string;
  rating: ExpoRating;
  status: ExpoStatus;
  headline: string; // 一句话核心需求
  nextAction: string;
  nextActionDate: string; // YYYY-MM-DD
  lastContactedAt?: string; // YYYY-MM-DD
  rawNote: string; // 现场原始记录
  summary?: string; // 沟通摘要
  keyInfo?: string; // 关键信息
  coreProblem?: string; // 核心问题
  currentNeed?: string; // 当前需求
  decisionRole?: string; // 决策角色
  budgetSignal?: string; // 预算信号
  timeline?: string; // 时间节点
  currentVendor?: string; // 现有供应商
  priorityReason?: string; // 评分原因
  createdAt: string; // YYYY-MM-DD 现场记录日期
}

export const STATUS_LABEL: Record<ExpoStatus, string> = {
  new: "新线索",
  to_organize: "待整理",
  following: "跟进中",
  proposal: "方案沟通",
  won: "已成交",
  lost: "已流失",
  on_hold: "暂缓",
};

export const RATING_LABEL: Record<ExpoRating, string> = {
  A: "A 级",
  B: "B 级",
  C: "C 级",
  D: "D 级",
  unrated: "待判断",
};

export const RATING_STYLE: Record<ExpoRating, string> = {
  A: "bg-primary/10 text-primary border-primary/20",
  B: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  C: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  D: "bg-muted text-muted-foreground border-border",
  unrated: "bg-secondary text-secondary-foreground border-border",
};

function daysFromNow(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export const MOCK_LEADS: ExpoLead[] = [
  {
    id: "lead-01",
    company: "星海传媒集团",
    contactName: "李海涛",
    contactTitle: "市场总监",
    phone: "138****2201",
    wechat: "haitao_li",
    email: "litao@xinghai.com",
    rating: "A",
    status: "following",
    headline: "Q3 品牌焕新，需要一次覆盖 5 城的媒体投放方案",
    nextAction: "发送定制版方案 & 报价",
    nextActionDate: daysFromNow(1),
    lastContactedAt: daysFromNow(-1),
    rawNote:
      "对方主动来展位，看过我们上季度的白皮书。提到 9 月要做品牌焕新，预算大约 300-500 万，对北上广深+成都 5 城的组合方案感兴趣。现有供应商是蓝色光标,反馈响应慢。",
    summary: "对方对我们的行业案例很认可，主动询问定制方案。",
    keyInfo: "预算 300-500 万；5 城组合；Q3 启动",
    coreProblem: "现有供应商响应慢，缺乏跨城联动执行力",
    currentNeed: "定制媒体投放方案 + 快速响应保障",
    decisionRole: "市场总监(直接决策)，CMO 复核",
    budgetSignal: "300-500 万，已立项",
    timeline: "9 月启动，8 月中定案",
    currentVendor: "蓝色光标",
    priorityReason: "预算明确、时间紧迫、决策链清晰",
    createdAt: daysFromNow(-2),
  },
  {
    id: "lead-02",
    company: "云途科技",
    contactName: "陈曦",
    contactTitle: "品牌经理",
    phone: "139****8877",
    wechat: "chenxi_yt",
    rating: "B",
    status: "to_organize",
    headline: "计划下半年做一场行业发布会，找 PR 合作方",
    nextAction: "整理会后资料并发送初步 PR 建议",
    nextActionDate: daysFromNow(-1),
    lastContactedAt: daysFromNow(0),
    rawNote:
      "云途下半年有产品发布会，希望配 1 场行业媒体沟通会 + KOL 组合。预算未明确，需要先看方案再谈。对方比较年轻，风格偏活泼。",
    summary: "对 PR 组合有明确兴趣，但预算暂未透露。",
    keyInfo: "下半年产品发布会 + 媒体沟通会 + KOL",
    coreProblem: "内部没有 PR 团队，全靠外部",
    currentNeed: "PR 组合方案 + 案例",
    decisionRole: "品牌经理牵头，需向 VP 汇报",
    budgetSignal: "未明确",
    timeline: "下半年，Q3-Q4",
    priorityReason: "有明确项目意向但决策周期偏长",
    createdAt: daysFromNow(-2),
  },
  {
    id: "lead-03",
    company: "北岸新能源",
    contactName: "王敏",
    contactTitle: "公关负责人",
    phone: "136****4412",
    rating: "unrated",
    status: "to_organize",
    headline: "只是逛展，聊了一下现有舆情监测方案",
    nextAction: "确认对方是否有真实立项",
    nextActionDate: daysFromNow(2),
    rawNote: "对方随手拿了资料，简单介绍了自家舆情监测需求，未展开。",
    createdAt: daysFromNow(0),
  },
  {
    id: "lead-04",
    company: "锦华食品",
    contactName: "赵启明",
    contactTitle: "副总经理",
    phone: "135****9932",
    wechat: "zhao_jinhua",
    rating: "A",
    status: "proposal",
    headline: "危机公关预案 + 长期舆情托管，急",
    nextAction: "线下拜访，携合同版本",
    nextActionDate: daysFromNow(3),
    lastContactedAt: daysFromNow(-1),
    rawNote:
      "上周刚经历一次舆情事件，急需建立长期机制。副总亲自到展位，态度非常明确。希望本月内敲定。",
    summary: "有真实痛点，决策非常快",
    keyInfo: "危机预案 + 舆情托管；月度服务",
    coreProblem: "缺乏舆情应对机制，团队没有专职人员",
    currentNeed: "长期托管 + 应急响应",
    decisionRole: "副总直接拍板",
    budgetSignal: "月度 20-40 万可接受",
    timeline: "本月内定案",
    priorityReason: "真实痛点 + 决策快 + 预算落地",
    createdAt: daysFromNow(-3),
  },
  {
    id: "lead-05",
    company: "远景资本",
    contactName: "刘思远",
    contactTitle: "投后经理",
    rating: "C",
    status: "on_hold",
    headline: "帮被投公司找 PR 服务，暂无具体时间线",
    nextAction: "季度末回访",
    nextActionDate: daysFromNow(21),
    rawNote: "对方是投后角色，介绍性质拜访。有一批被投公司未来可能需要 PR。",
    keyInfo: "介绍性质，长期潜在渠道",
    priorityReason: "无短期项目，但可作为长期渠道维护",
    createdAt: daysFromNow(-4),
  },
];

export function findLead(id: string): ExpoLead | undefined {
  return MOCK_LEADS.find((l) => l.id === id);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isOverdue(dateStr: string, today = todayIso()): boolean {
  return dateStr < today;
}
