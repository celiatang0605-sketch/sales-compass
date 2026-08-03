import { supabase } from "@/integrations/supabase/client";
import type { ContactRow } from "@/integrations/supabase/types";
import type { DecisionRole } from "./customerTypes";
import type { Contact } from "./opportunityTypes";

type Row = ContactRow;

export function rowToContact(row: Row): Contact {
  return {
    id: row.id,
    userId: row.user_id,
    customerId: row.customer_id,
    name: row.name,
    title: row.title,
    department: row.department,
    decisionRole: (row.decision_role as DecisionRole) ?? "unknown",
    phone: row.phone,
    wechat: row.wechat,
    email: row.email,
    note: row.note,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("请先登录后再操作联系人数据。");
  return data.user.id;
}

function nullableText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value.trim() || null;
}

export interface CreateContactInput extends UpdateContactInput {
  customerId: string;
  name: string;
}

export interface UpdateContactInput {
  name?: string;
  title?: string;
  department?: string;
  decisionRole?: DecisionRole;
  phone?: string;
  wechat?: string;
  email?: string;
  note?: string;
  isPrimary?: boolean;
}

export async function listContacts(customerId: string): Promise<Contact[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(rowToContact);
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  const userId = await requireUserId();
  const name = input.name.trim();
  if (!name) throw new Error("联系人姓名不能为空。");

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", userId)
    .eq("id", input.customerId)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer) throw new Error("未找到可操作的客户。");

  // 先以 false 创建，再通过 RPC 原子切换，避免部分唯一索引发生竞争。
  const row = {
    user_id: userId,
    customer_id: input.customerId,
    name,
    title: nullableText(input.title) ?? null,
    department: nullableText(input.department) ?? null,
    decision_role: input.decisionRole ?? "unknown",
    phone: nullableText(input.phone) ?? null,
    wechat: nullableText(input.wechat) ?? null,
    email: nullableText(input.email) ?? null,
    note: nullableText(input.note) ?? null,
    is_primary: false,
  };
  const { data, error } = await supabase.from("contacts").insert(row).select("*").single();
  if (error) throw error;

  const contact = rowToContact(data as Row);
  if (!input.isPrimary) return contact;
  return setPrimaryContact(input.customerId, contact.id);
}

export async function updateContact(id: string, patch: UpdateContactInput): Promise<Contact> {
  const userId = await requireUserId();
  const update: Record<string, unknown> = {};
  const textFields: Array<
    ["name" | "title" | "department" | "phone" | "wechat" | "email" | "note", string]
  > = [
    ["name", "name"],
    ["title", "title"],
    ["department", "department"],
    ["phone", "phone"],
    ["wechat", "wechat"],
    ["email", "email"],
    ["note", "note"],
  ];
  for (const [key, column] of textFields) {
    const value = patch[key];
    if (value !== undefined) update[column] = nullableText(value);
  }
  if (patch.name !== undefined && !patch.name.trim()) throw new Error("联系人姓名不能为空。");
  if (patch.decisionRole !== undefined) update.decision_role = patch.decisionRole;
  if (patch.isPrimary === false) update.is_primary = false;

  if (Object.keys(update).length === 0) {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .single();
    if (error) throw error;
    const contact = rowToContact(data as Row);
    return patch.isPrimary === true ? setPrimaryContact(contact.customerId, contact.id) : contact;
  }

  const { data, error } = await supabase
    .from("contacts")
    .update(update)
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  const contact = rowToContact(data as Row);
  if (patch.isPrimary === true) return setPrimaryContact(contact.customerId, contact.id);
  return contact;
}

export async function deleteContact(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("contacts").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

/**
 * `uq_contacts_primary` 是部分唯一索引；清旧主联系人和设新主联系人必须由数据库在同一
 * 事务中完成。迁移提供的 `set_primary_contact` RPC 负责这两个写入，前端绝不拆成两次
 * 独立 update，以免并发操作下出现唯一冲突或可见中间态。
 */
export async function setPrimaryContact(customerId: string, contactId: string): Promise<Contact> {
  const userId = await requireUserId();
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, customer_id")
    .eq("user_id", userId)
    .eq("id", contactId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (contactError) throw contactError;
  if (!contact) throw new Error("未找到可设为主联系人的联系人。");

  const { error } = await supabase.rpc("set_primary_contact", {
    p_customer_id: customerId,
    p_contact_id: contactId,
  });
  if (error) throw error;

  const { data, error: readError } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", contactId)
    .single();
  if (readError) throw readError;
  return rowToContact(data as Row);
}

async function assertOwnedRelation(
  opportunityId: string,
  contactId: string,
  userId: string,
): Promise<void> {
  const [opportunityResult, contactResult] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, customer_id")
      .eq("user_id", userId)
      .eq("id", opportunityId)
      .maybeSingle(),
    supabase
      .from("contacts")
      .select("id, customer_id")
      .eq("user_id", userId)
      .eq("id", contactId)
      .maybeSingle(),
  ]);
  if (opportunityResult.error) throw opportunityResult.error;
  if (contactResult.error) throw contactResult.error;
  if (!opportunityResult.data || !contactResult.data) {
    throw new Error("未找到可关联的商机或联系人。");
  }
  if (opportunityResult.data.customer_id !== contactResult.data.customer_id) {
    throw new Error("联系人只能关联到所属客户的商机。");
  }
}

export async function linkContactToOpportunity(
  opportunityId: string,
  contactId: string,
): Promise<void> {
  const userId = await requireUserId();
  await assertOwnedRelation(opportunityId, contactId, userId);
  const { error } = await supabase
    .from("opportunity_contacts")
    .upsert(
      { opportunity_id: opportunityId, contact_id: contactId },
      { onConflict: "opportunity_id,contact_id" },
    );
  if (error) throw error;
}

export async function unlinkContactFromOpportunity(
  opportunityId: string,
  contactId: string,
): Promise<void> {
  const userId = await requireUserId();
  await assertOwnedRelation(opportunityId, contactId, userId);
  const { error } = await supabase
    .from("opportunity_contacts")
    .delete()
    .eq("opportunity_id", opportunityId)
    .eq("contact_id", contactId);
  if (error) throw error;
}
