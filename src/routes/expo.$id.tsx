import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, Phone, Mail, MessageCircle, Paperclip, Image as ImageIcon, CreditCard } from "lucide-react";
import { AppShell } from "@/components/salesup/AppShell";
import {
  findLead,
  RATING_LABEL,
  RATING_STYLE,
  STATUS_LABEL,
  type ExpoLead,
} from "@/lib/salesup/expoMock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/expo/$id")({
  head: ({ params }) => ({ meta: [{ title: `线索详情 · ${params.id}` }] }),
  loader: ({ params }) => {
    const lead = findLead(params.id);
    if (!lead) throw notFound();
    return { lead };
  },
  notFoundComponent: LeadNotFound,
  component: ExpoDetailPage,
});

function LeadNotFound() {
  return (
    <AppShell>
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground mb-4">找不到这条线索</p>
        <Link to="/expo" className="text-sm text-primary hover:underline">
          返回列表
        </Link>
      </div>
    </AppShell>
  );
}

function ExpoDetailPage() {
  const { lead } = Route.useLoaderData() as { lead: ExpoLead };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto pb-8">
        <div className="flex items-center gap-2 mb-4">
          <Link
            to="/expo"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            返回列表
          </Link>
        </div>

        {/* Header */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-5 mb-3">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-semibold tracking-tight truncate">
                {lead.company}
              </h1>
              <div className="text-sm text-muted-foreground mt-0.5">
                {lead.contactName}
                {lead.contactTitle ? ` · ${lead.contactTitle}` : ""}
              </div>
            </div>
            <div className="flex gap-1.5">
              <span
                className={cn(
                  "px-2 h-6 inline-flex items-center rounded border text-xs",
                  RATING_STYLE[lead.rating],
                )}
              >
                {RATING_LABEL[lead.rating]}
              </span>
              <span className="px-2 h-6 inline-flex items-center rounded bg-secondary text-secondary-foreground text-xs">
                {STATUS_LABEL[lead.status]}
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 md:gap-4 text-sm">
            <InfoRow label="下一步动作" value={lead.nextAction} />
            <div className="hidden md:block w-px bg-border" />
            <InfoRow label="下一步日期" value={lead.nextActionDate} />
          </div>
        </div>

        {/* Sections */}
        <Section title="原始记录">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
            {lead.rawNote || <span className="text-muted-foreground">现场未记录</span>}
          </p>
        </Section>

        <Section title="联系人">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
            <InfoRow label="姓名" value={lead.contactName} />
            <InfoRow label="职位" value={lead.contactTitle} />
            <InfoRow label="手机" value={lead.phone} icon={Phone} />
            <InfoRow label="微信" value={lead.wechat} icon={MessageCircle} />
            <InfoRow label="邮箱" value={lead.email} icon={Mail} />
          </div>
        </Section>

        <Section title="现场沟通">
          <div className="space-y-2">
            <InfoRow label="沟通摘要" value={lead.summary} multiline />
            <InfoRow label="关键信息" value={lead.keyInfo} multiline />
            <InfoRow label="核心问题" value={lead.coreProblem} multiline />
            <InfoRow label="当前需求" value={lead.currentNeed} multiline />
          </div>
        </Section>

        <Section title="销售判断">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
            <InfoRow label="决策角色" value={lead.decisionRole} />
            <InfoRow label="预算信号" value={lead.budgetSignal} />
            <InfoRow label="时间节点" value={lead.timeline} />
            <InfoRow label="现有供应商" value={lead.currentVendor} />
            <InfoRow label="优先级" value={RATING_LABEL[lead.rating]} />
            <InfoRow label="评分原因" value={lead.priorityReason} multiline />
          </div>
        </Section>

        <Section title="跟进">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
            <InfoRow label="当前状态" value={STATUS_LABEL[lead.status]} />
            <InfoRow label="下一步动作" value={lead.nextAction} />
            <InfoRow label="下一步日期" value={lead.nextActionDate} />
            <InfoRow label="最近一次联系" value={lead.lastContactedAt ?? "尚未联系"} />
          </div>
        </Section>

        <Section title="附件" hint="下一阶段接入">
          <div className="grid grid-cols-2 gap-2">
            <AttachmentSlot icon={CreditCard} label="名片" />
            <AttachmentSlot icon={ImageIcon} label="现场照片" />
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5 mb-3">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground/90">{title}</h2>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
  multiline,
}: {
  label: string;
  value?: string | null;
  icon?: typeof Phone;
  multiline?: boolean;
}) {
  const empty = !value;
  return (
    <div className={cn("min-w-0", multiline ? "" : "flex items-baseline gap-3")}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0 w-20 md:w-24">
        {label}
      </div>
      <div
        className={cn(
          "text-sm min-w-0 break-words",
          empty ? "text-muted-foreground/60" : "text-foreground/90",
          multiline && "mt-0.5 whitespace-pre-wrap leading-relaxed",
        )}
      >
        {Icon && !empty && <Icon className="w-3.5 h-3.5 inline mr-1 text-muted-foreground" />}
        {value || "—"}
      </div>
    </div>
  );
}

function AttachmentSlot({ icon: Icon, label }: { icon: typeof Paperclip; label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-4 grid place-items-center text-center text-xs text-muted-foreground bg-background/40">
      <Icon className="w-5 h-5 mb-1.5 opacity-60" />
      <div>{label}</div>
      <div className="text-[10px] mt-0.5 text-muted-foreground/70">下一阶段接入</div>
    </div>
  );
}
