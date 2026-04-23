import type {
  AuditLog,
  ComplianceControl,
  CreateDocumentTemplate,
  CreateSmsCampaign,
  DocumentTemplate,
  GuestCheckIn,
  InsertVisitor,
  SignedDocument,
  SmsCampaign,
  Visitor,
} from "../shared/schema";
import { getSupabase } from "./supabase";

type VisitorRow = {
  id: number;
  full_name: string;
  company: string;
  email: string;
  phone: string;
  host_name: string;
  purpose: string;
  expected_arrival: string;
  status: Visitor["status"];
  badge_number: string | null;
  notes: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
};

type ControlRow = {
  id: number;
  control_id: string;
  category: string;
  title: string;
  description: string;
  status: ComplianceControl["status"];
  evidence: string;
  owner: string;
  updated_at: string;
};

type AuditRow = {
  id: number;
  actor: string;
  action: string;
  target: string;
  detail: string;
  created_at: string;
};

type CampaignRow = {
  id: number;
  name: string;
  audience: string;
  message: string;
  status: SmsCampaign["status"];
  recipient_count: number;
  delivered_count: number;
  blocked_count: number;
  created_at: string;
};

type TemplateRow = {
  id: number;
  name: string;
  kind: DocumentTemplate["kind"];
  body: string;
  requires_signature: boolean;
  active: boolean;
  created_at: string;
};

type SignedRow = {
  id: number;
  visitor_id: number;
  template_id: number;
  document_name: string;
  document_kind: DocumentTemplate["kind"];
  signer_name: string;
  signer_email: string;
  signature: string;
  acknowledged: boolean;
  signed_at: string;
  pdf_content: string;
};

function mapVisitor(row: VisitorRow): Visitor {
  return {
    id: row.id,
    fullName: row.full_name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    hostName: row.host_name,
    purpose: row.purpose,
    expectedArrival: row.expected_arrival,
    status: row.status,
    badgeNumber: row.badge_number,
    notes: row.notes,
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at,
  };
}

function mapControl(row: ControlRow): ComplianceControl {
  return {
    id: row.id,
    controlId: row.control_id,
    category: row.category,
    title: row.title,
    description: row.description,
    status: row.status,
    evidence: row.evidence,
    owner: row.owner,
    updatedAt: row.updated_at,
  };
}

function mapAudit(row: AuditRow): AuditLog {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    target: row.target,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

function mapCampaign(row: CampaignRow): SmsCampaign {
  return {
    id: row.id,
    name: row.name,
    audience: row.audience,
    message: row.message,
    status: row.status,
    recipientCount: row.recipient_count,
    deliveredCount: row.delivered_count,
    blockedCount: row.blocked_count,
    createdAt: row.created_at,
  };
}

function mapTemplate(row: TemplateRow): DocumentTemplate {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    body: row.body,
    requiresSignature: row.requires_signature,
    active: row.active,
    createdAt: row.created_at,
  };
}

function mapSigned(row: SignedRow): SignedDocument {
  return {
    id: row.id,
    visitorId: row.visitor_id,
    templateId: row.template_id,
    documentName: row.document_name,
    documentKind: row.document_kind,
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    signature: row.signature,
    acknowledged: row.acknowledged,
    signedAt: row.signed_at,
    pdfContent: row.pdf_content,
  };
}

export interface IStorage {
  listVisitors(): Promise<Visitor[]>;
  createVisitor(visitor: InsertVisitor): Promise<Visitor>;
  checkInVisitor(id: number, badgeNumber?: string | null): Promise<Visitor | undefined>;
  checkOutVisitor(id: number): Promise<Visitor | undefined>;
  listControls(): Promise<ComplianceControl[]>;
  listAuditLogs(): Promise<AuditLog[]>;
  listSmsCampaigns(): Promise<SmsCampaign[]>;
  createSmsCampaign(campaign: CreateSmsCampaign): Promise<SmsCampaign>;
  logExport(recordCount: number): Promise<AuditLog>;
  listDocumentTemplates(): Promise<DocumentTemplate[]>;
  listActiveDocumentTemplates(): Promise<DocumentTemplate[]>;
  createDocumentTemplate(template: CreateDocumentTemplate): Promise<DocumentTemplate>;
  listSignedDocuments(visitorId?: number): Promise<SignedDocument[]>;
  getSignedDocument(id: number): Promise<SignedDocument | undefined>;
  guestCheckIn(checkIn: GuestCheckIn): Promise<{ visitor: Visitor; signedDocuments: SignedDocument[] }>;
}

export class SupabaseStorage implements IStorage {
  private get client() {
    return getSupabase();
  }

  async listVisitors(): Promise<Visitor[]> {
    const { data, error } = await this.client
      .from("visitors")
      .select("*")
      .order("expected_arrival", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapVisitor);
  }

  async createVisitor(insertVisitor: InsertVisitor): Promise<Visitor> {
    const payload = {
      full_name: insertVisitor.fullName,
      company: insertVisitor.company,
      email: insertVisitor.email,
      phone: insertVisitor.phone,
      host_name: insertVisitor.hostName,
      purpose: insertVisitor.purpose,
      expected_arrival: insertVisitor.expectedArrival,
      status: insertVisitor.status ?? "scheduled",
      badge_number: insertVisitor.badgeNumber ?? null,
      notes: insertVisitor.notes ?? null,
      checked_in_at: null,
      checked_out_at: null,
    };

    const { data, error } = await this.client
      .from("visitors")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    const visitor = mapVisitor(data as VisitorRow);
    await this.log(
      "front_desk",
      "create_visitor",
      `visitor:${visitor.id}`,
      `Registered ${visitor.fullName}`,
    );
    return visitor;
  }

  async checkInVisitor(id: number, badgeNumber?: string | null): Promise<Visitor | undefined> {
    const { data, error } = await this.client
      .from("visitors")
      .update({
        status: "checked_in",
        badge_number: badgeNumber || null,
        checked_in_at: new Date().toISOString(),
        checked_out_at: null,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const visitor = mapVisitor(data as VisitorRow);
    await this.log(
      "front_desk",
      "check_in_visitor",
      `visitor:${visitor.id}`,
      `Checked in ${visitor.fullName}`,
    );
    return visitor;
  }

  async checkOutVisitor(id: number): Promise<Visitor | undefined> {
    const { data, error } = await this.client
      .from("visitors")
      .update({
        status: "checked_out",
        checked_out_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    const visitor = mapVisitor(data as VisitorRow);
    await this.log(
      "front_desk",
      "check_out_visitor",
      `visitor:${visitor.id}`,
      `Checked out ${visitor.fullName}`,
    );
    return visitor;
  }

  async listControls(): Promise<ComplianceControl[]> {
    const { data, error } = await this.client
      .from("compliance_controls")
      .select("*")
      .order("control_id", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapControl);
  }

  async listAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await this.client
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    return (data ?? []).map(mapAudit);
  }

  async listSmsCampaigns(): Promise<SmsCampaign[]> {
    const { data, error } = await this.client
      .from("sms_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapCampaign);
  }

  async createSmsCampaign(campaign: CreateSmsCampaign): Promise<SmsCampaign> {
    const audienceVisitors = await this.getAudienceVisitors(campaign.audience);
    const deliverableVisitors = audienceVisitors.filter((visitor) =>
      this.canTextVisitor(visitor),
    );
    const blockedCount = audienceVisitors.length - deliverableVisitors.length;

    const { data, error } = await this.client
      .from("sms_campaigns")
      .insert({
        name: campaign.name,
        audience: campaign.audience,
        message: campaign.message,
        status: "simulated",
        recipient_count: audienceVisitors.length,
        delivered_count: deliverableVisitors.length,
        blocked_count: blockedCount,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    const smsCampaign = mapCampaign(data as CampaignRow);

    await this.log(
      "front_desk",
      "simulate_sms_campaign",
      `sms_campaign:${smsCampaign.id}`,
      `Simulated "${smsCampaign.name}" to ${smsCampaign.deliveredCount} recipients; ${smsCampaign.blockedCount} blocked by consent/phone safeguards.`,
    );

    return smsCampaign;
  }

  async logExport(recordCount: number): Promise<AuditLog> {
    const { data, error } = await this.client
      .from("audit_logs")
      .insert({
        actor: "front_desk",
        action: "export_visitors_csv",
        target: "visitor_records",
        detail: `Exported ${recordCount} visitor records to CSV.`,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapAudit(data as AuditRow);
  }

  async listDocumentTemplates(): Promise<DocumentTemplate[]> {
    const { data, error } = await this.client
      .from("document_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapTemplate);
  }

  async listActiveDocumentTemplates(): Promise<DocumentTemplate[]> {
    const { data, error } = await this.client
      .from("document_templates")
      .select("*")
      .eq("active", true);
    if (error) throw error;
    return (data ?? []).map(mapTemplate);
  }

  async createDocumentTemplate(template: CreateDocumentTemplate): Promise<DocumentTemplate> {
    const { data, error } = await this.client
      .from("document_templates")
      .insert({
        name: template.name,
        kind: template.kind,
        body: template.body,
        requires_signature: template.requiresSignature ?? true,
        active: template.active ?? true,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    const document = mapTemplate(data as TemplateRow);
    await this.log(
      "admin",
      "create_document_template",
      `document_template:${document.id}`,
      `Created ${document.name}`,
    );
    return document;
  }

  async listSignedDocuments(visitorId?: number): Promise<SignedDocument[]> {
    let query = this.client
      .from("signed_documents")
      .select("*")
      .order("signed_at", { ascending: false });
    if (visitorId) {
      query = query.eq("visitor_id", visitorId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapSigned);
  }

  async getSignedDocument(id: number): Promise<SignedDocument | undefined> {
    const { data, error } = await this.client
      .from("signed_documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSigned(data as SignedRow) : undefined;
  }

  async guestCheckIn(
    checkIn: GuestCheckIn,
  ): Promise<{ visitor: Visitor; signedDocuments: SignedDocument[] }> {
    const activeTemplates = await this.listActiveDocumentTemplates();
    const missingActive = activeTemplates.filter(
      (template) => !checkIn.acknowledgedTemplateIds.includes(template.id),
    );
    if (missingActive.length > 0) {
      throw new Error("All active visitor documents must be acknowledged");
    }

    const templates = activeTemplates.filter((template) =>
      checkIn.acknowledgedTemplateIds.includes(template.id),
    );

    const nowIso = new Date().toISOString();
    const { data: visitorData, error: visitorError } = await this.client
      .from("visitors")
      .insert({
        full_name: checkIn.fullName,
        company: checkIn.company,
        email: checkIn.email,
        phone: checkIn.phone,
        host_name: checkIn.hostName,
        purpose: checkIn.purpose,
        expected_arrival: new Date().toISOString().slice(0, 16),
        status: "checked_in",
        badge_number: `G-${Date.now().toString().slice(-4)}`,
        notes: "Guest self check-in with signed documents",
        checked_in_at: nowIso,
        checked_out_at: null,
      })
      .select("*")
      .single();
    if (visitorError) throw visitorError;
    const visitor = mapVisitor(visitorData as VisitorRow);

    const signedAt = new Date().toISOString();
    const signedRows = templates.map((template) => ({
      visitor_id: visitor.id,
      template_id: template.id,
      document_name: template.name,
      document_kind: template.kind,
      signer_name: checkIn.fullName,
      signer_email: checkIn.email,
      signature: checkIn.signature,
      acknowledged: true,
      signed_at: signedAt,
      pdf_content: this.buildSignedDocumentHtml(
        visitor,
        template,
        checkIn.signature,
        signedAt,
      ),
    }));

    let createdDocuments: SignedDocument[] = [];
    if (signedRows.length > 0) {
      const { data: signedData, error: signedError } = await this.client
        .from("signed_documents")
        .insert(signedRows)
        .select("*");
      if (signedError) throw signedError;
      createdDocuments = (signedData ?? []).map((row) => mapSigned(row as SignedRow));
    }

    await this.log(
      "guest",
      "guest_check_in",
      `visitor:${visitor.id}`,
      `${visitor.fullName} checked in and signed ${createdDocuments.length} document(s).`,
    );

    return { visitor, signedDocuments: createdDocuments };
  }

  private async getAudienceVisitors(audience: string): Promise<Visitor[]> {
    const { data, error } = await this.client.from("visitors").select("*");
    if (error) throw error;
    const all = (data ?? []).map(mapVisitor);
    if (audience === "all") return all;
    return all.filter((visitor) => visitor.status === audience);
  }

  private canTextVisitor(visitor: Visitor): boolean {
    const normalizedPhone = visitor.phone.replace(/\D/g, "");
    const hasValidPhone = normalizedPhone.length >= 10;
    const notes = visitor.notes?.toLowerCase() ?? "";
    const hasOptOut = notes.includes("opt out") || notes.includes("stop");
    return hasValidPhone && !hasOptOut;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  private buildSignedDocumentHtml(
    visitor: Visitor,
    template: DocumentTemplate,
    signature: string,
    signedAt: string,
  ) {
    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${this.escapeHtml(template.name)} - Signed Visitor Document</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; color: #1f2937; line-height: 1.55; padding: 48px; }
            .header { border-bottom: 2px solid #0b7280; padding-bottom: 16px; margin-bottom: 28px; }
            h1 { font-size: 24px; margin: 0 0 6px; }
            .muted { color: #6b7280; font-size: 12px; }
            .box { border: 1px solid #d1d5db; border-radius: 12px; padding: 18px; margin: 18px 0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
            .value { font-size: 14px; margin-top: 3px; }
            .signature { font-family: Georgia, serif; font-size: 26px; color: #0b7280; margin-top: 8px; }
          </style>
        </head>
        <body>
          <section class="header">
            <h1>${this.escapeHtml(template.name)}</h1>
            <div class="muted">Signed visitor document generated by VisitFlow</div>
          </section>
          <section class="box">
            <div class="grid">
              <div><div class="label">Visitor</div><div class="value">${this.escapeHtml(visitor.fullName)}</div></div>
              <div><div class="label">Company</div><div class="value">${this.escapeHtml(visitor.company)}</div></div>
              <div><div class="label">Email</div><div class="value">${this.escapeHtml(visitor.email)}</div></div>
              <div><div class="label">Host</div><div class="value">${this.escapeHtml(visitor.hostName)}</div></div>
              <div><div class="label">Signed at</div><div class="value">${this.escapeHtml(signedAt)}</div></div>
              <div><div class="label">Document type</div><div class="value">${this.escapeHtml(template.kind.toUpperCase())}</div></div>
            </div>
          </section>
          <section class="box">
            <div class="label">Agreement text</div>
            <p>${this.escapeHtml(template.body)}</p>
          </section>
          <section class="box">
            <div class="label">Electronic signature</div>
            <div class="signature">${this.escapeHtml(signature)}</div>
            <p class="muted">The signer acknowledged this document electronically during visitor check-in.</p>
          </section>
        </body>
      </html>
    `;
  }

  private async log(actor: string, action: string, target: string, detail: string) {
    const { error } = await this.client.from("audit_logs").insert({
      actor,
      action,
      target,
      detail,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error("Failed to write audit log:", error);
    }
  }
}

export const storage: IStorage = new SupabaseStorage();
