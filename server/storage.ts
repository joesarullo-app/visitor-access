import {
  auditLogs,
  complianceControls,
  documentTemplates,
  signedDocuments,
  smsCampaigns,
  visitors,
} from "@shared/schema";
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
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { desc, eq } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

sqlite
  .prepare(
    `
    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      host_name TEXT NOT NULL,
      purpose TEXT NOT NULL,
      expected_arrival TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      badge_number TEXT,
      notes TEXT,
      checked_in_at TEXT,
      checked_out_at TEXT
    )
  `,
  )
  .run();

sqlite
  .prepare(
    `
    CREATE TABLE IF NOT EXISTS compliance_controls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      control_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      evidence TEXT NOT NULL,
      owner TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,
  )
  .run();

sqlite
  .prepare(
    `
    CREATE TABLE IF NOT EXISTS document_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      requires_signature INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `,
  )
  .run();

sqlite
  .prepare(
    `
    CREATE TABLE IF NOT EXISTS signed_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id INTEGER NOT NULL,
      template_id INTEGER NOT NULL,
      document_name TEXT NOT NULL,
      document_kind TEXT NOT NULL,
      signer_name TEXT NOT NULL,
      signer_email TEXT NOT NULL,
      signature TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 1,
      signed_at TEXT NOT NULL,
      pdf_content TEXT NOT NULL
    )
  `,
  )
  .run();

sqlite
  .prepare(
    `
    CREATE TABLE IF NOT EXISTS sms_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      audience TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      recipient_count INTEGER NOT NULL DEFAULT 0,
      delivered_count INTEGER NOT NULL DEFAULT 0,
      blocked_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `,
  )
  .run();

sqlite
  .prepare(
    `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `,
  )
  .run();

export const db = drizzle(sqlite);

const seedCount = sqlite.prepare("SELECT COUNT(*) as count FROM visitors").get() as { count: number };

if (seedCount.count === 0) {
  const localInputDate = (offsetMinutes: number) =>
    new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString().slice(0, 16);

  const seedVisitors: InsertVisitor[] = [
    {
      fullName: "Maya Chen",
      company: "Northstar Design",
      email: "maya.chen@northstar.example",
      phone: "(415) 555-0191",
      hostName: "Alex Morgan",
      purpose: "Workspace analytics demo",
      expectedArrival: localInputDate(-45),
      status: "checked_in",
      badgeNumber: "A-104",
      notes: "NDA signed at reception",
    },
    {
      fullName: "Ethan Brooks",
      company: "Atlas Facilities",
      email: "ethan.brooks@atlas.example",
      phone: "(212) 555-0146",
      hostName: "Priya Shah",
      purpose: "Facilities planning workshop",
      expectedArrival: localInputDate(35),
      status: "scheduled",
      badgeNumber: null,
      notes: "Send to floor 8",
    },
    {
      fullName: "Sofia Ramirez",
      company: "Cobalt Real Estate",
      email: "sofia.ramirez@cobalt.example",
      phone: "(310) 555-0168",
      hostName: "Jordan Lee",
      purpose: "Lease review meeting",
      expectedArrival: localInputDate(110),
      status: "scheduled",
      badgeNumber: null,
      notes: null,
    },
    {
      fullName: "Marcus Reed",
      company: "Envoy Security",
      email: "marcus.reed@envoy.example",
      phone: "(646) 555-0182",
      hostName: "Taylor Kim",
      purpose: "Badge system audit",
      expectedArrival: localInputDate(-160),
      status: "checked_out",
      badgeNumber: "B-221",
      notes: "Returned temporary badge",
    },
  ];

  const insert = sqlite.prepare(
    `
      INSERT INTO visitors (
        full_name, company, email, phone, host_name, purpose, expected_arrival,
        status, badge_number, notes, checked_in_at, checked_out_at
      )
      VALUES (
        @fullName, @company, @email, @phone, @hostName, @purpose, @expectedArrival,
        @status, @badgeNumber, @notes, @checkedInAt, @checkedOutAt
      )
    `,
  );

  const now = new Date().toISOString();
  const seed = sqlite.transaction((records: InsertVisitor[]) => {
    records.forEach((record) =>
      insert.run({
        ...record,
        checkedInAt:
          record.status === "checked_in" || record.status === "checked_out" ? now : null,
        checkedOutAt: record.status === "checked_out" ? now : null,
      }),
    );
  });
  seed(seedVisitors);
}

const controlCount = sqlite.prepare("SELECT COUNT(*) as count FROM compliance_controls").get() as {
  count: number;
};

if (controlCount.count === 0) {
  const now = new Date().toISOString();
  const controls: Omit<ComplianceControl, "id">[] = [
    {
      controlId: "CC6.1",
      category: "Access control",
      title: "Role-based access policy",
      description: "Define least-privilege roles for receptionist, host, security admin, and auditor access.",
      status: "in_progress",
      evidence: "Product role model drafted; identity provider integration pending.",
      owner: "Security",
      updatedAt: now,
    },
    {
      controlId: "CC6.6",
      category: "Change management",
      title: "Production change log",
      description: "Track product changes, approvals, and deployment history for audit evidence.",
      status: "implemented",
      evidence: "Git commits and deployment logs are retained for each release.",
      owner: "Engineering",
      updatedAt: now,
    },
    {
      controlId: "CC7.2",
      category: "Monitoring",
      title: "Visitor activity audit trail",
      description: "Log sensitive actions including visitor registration, check-in, check-out, exports, and text campaigns.",
      status: "implemented",
      evidence: "Audit log table records action, target, actor, timestamp, and detail.",
      owner: "Operations",
      updatedAt: now,
    },
    {
      controlId: "CC8.1",
      category: "Data retention",
      title: "Visitor data retention schedule",
      description: "Set retention limits for visitor PII, badge records, SMS campaigns, and audit logs.",
      status: "needs_evidence",
      evidence: "Policy decision required before automated deletion is enabled.",
      owner: "Compliance",
      updatedAt: now,
    },
    {
      controlId: "A1.2",
      category: "Availability",
      title: "Incident response workflow",
      description: "Maintain an incident plan covering outages, security events, SMS provider failures, and breach triage.",
      status: "in_progress",
      evidence: "Incident categories drafted; escalation contacts still needed.",
      owner: "Security",
      updatedAt: now,
    },
    {
      controlId: "P1.1",
      category: "Privacy",
      title: "SMS consent and opt-out controls",
      description: "Restrict bulk messages to consented recipients and honor STOP/opt-out handling before sends.",
      status: "implemented",
      evidence: "Mass text simulation blocks recipients without consent or valid phone numbers.",
      owner: "Compliance",
      updatedAt: now,
    },
  ];

  const insertControl = sqlite.prepare(
    `
      INSERT INTO compliance_controls (
        control_id, category, title, description, status, evidence, owner, updated_at
      )
      VALUES (
        @controlId, @category, @title, @description, @status, @evidence, @owner, @updatedAt
      )
    `,
  );
  const seedControls = sqlite.transaction((records: Omit<ComplianceControl, "id">[]) => {
    records.forEach((record) => insertControl.run(record));
  });
  seedControls(controls);
}

const auditCount = sqlite.prepare("SELECT COUNT(*) as count FROM audit_logs").get() as { count: number };

if (auditCount.count === 0) {
  sqlite
    .prepare(
      `
      INSERT INTO audit_logs (actor, action, target, detail, created_at)
      VALUES (@actor, @action, @target, @detail, @createdAt)
    `,
    )
    .run({
      actor: "system",
      action: "seed_compliance_controls",
      target: "compliance",
      detail: "Initialized SOC 2 readiness controls and audit trail.",
      createdAt: new Date().toISOString(),
    });
}

const documentCount = sqlite.prepare("SELECT COUNT(*) as count FROM document_templates").get() as {
  count: number;
};

if (documentCount.count === 0) {
  const documents: CreateDocumentTemplate[] = [
    {
      name: "Standard Visitor NDA",
      kind: "nda",
      requiresSignature: true,
      active: true,
      body:
        "Visitor agrees not to disclose non-public information observed or received during the visit, including business plans, customer information, product designs, security procedures, workplace analytics, and facility data. This obligation does not apply to information that is public, already known, independently developed, rightfully received from a third party, or required to be disclosed by law.",
    },
    {
      name: "Visitor Safety and OSHA Acknowledgment",
      kind: "waiver",
      requiresSignature: true,
      active: true,
      body:
        "Visitor acknowledges site safety rules, agrees to follow posted instructions, use required protective equipment where applicable, stay with their host in restricted areas, and promptly report unsafe conditions or incidents to the host or front desk.",
    },
  ];

  const insertDocument = sqlite.prepare(
    `
      INSERT INTO document_templates (name, kind, body, requires_signature, active, created_at)
      VALUES (@name, @kind, @body, @requiresSignature, @active, @createdAt)
    `,
  );
  const seedDocuments = sqlite.transaction((records: CreateDocumentTemplate[]) => {
    records.forEach((record) =>
      insertDocument.run({
        ...record,
        requiresSignature: record.requiresSignature ? 1 : 0,
        active: record.active ? 1 : 0,
        createdAt: new Date().toISOString(),
      }),
    );
  });
  seedDocuments(documents);
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

export class DatabaseStorage implements IStorage {
  async listVisitors(): Promise<Visitor[]> {
    return db.select().from(visitors).orderBy(desc(visitors.expectedArrival)).all();
  }

  async createVisitor(insertVisitor: InsertVisitor): Promise<Visitor> {
    const visitor = db.insert(visitors).values(insertVisitor).returning().get();
    this.log("front_desk", "create_visitor", `visitor:${visitor.id}`, `Registered ${visitor.fullName}`);
    return visitor;
  }

  async checkInVisitor(id: number, badgeNumber?: string | null): Promise<Visitor | undefined> {
    const visitor = db
      .update(visitors)
      .set({
        status: "checked_in",
        badgeNumber: badgeNumber || null,
        checkedInAt: new Date().toISOString(),
        checkedOutAt: null,
      })
      .where(eq(visitors.id, id))
      .returning()
      .get();

    if (visitor) {
      this.log("front_desk", "check_in_visitor", `visitor:${visitor.id}`, `Checked in ${visitor.fullName}`);
    }

    return visitor;
  }

  async checkOutVisitor(id: number): Promise<Visitor | undefined> {
    const visitor = db
      .update(visitors)
      .set({
        status: "checked_out",
        checkedOutAt: new Date().toISOString(),
      })
      .where(eq(visitors.id, id))
      .returning()
      .get();

    if (visitor) {
      this.log("front_desk", "check_out_visitor", `visitor:${visitor.id}`, `Checked out ${visitor.fullName}`);
    }

    return visitor;
  }

  async listControls(): Promise<ComplianceControl[]> {
    return db.select().from(complianceControls).orderBy(complianceControls.controlId).all();
  }

  async listAuditLogs(): Promise<AuditLog[]> {
    return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(25).all();
  }

  async listSmsCampaigns(): Promise<SmsCampaign[]> {
    return db.select().from(smsCampaigns).orderBy(desc(smsCampaigns.createdAt)).all();
  }

  async createSmsCampaign(campaign: CreateSmsCampaign): Promise<SmsCampaign> {
    const audienceVisitors = this.getAudienceVisitors(campaign.audience);
    const deliverableVisitors = audienceVisitors.filter((visitor) => this.canTextVisitor(visitor));
    const blockedCount = audienceVisitors.length - deliverableVisitors.length;
    const smsCampaign = db
      .insert(smsCampaigns)
      .values({
        ...campaign,
        status: "simulated",
        recipientCount: audienceVisitors.length,
        deliveredCount: deliverableVisitors.length,
        blockedCount,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    this.log(
      "front_desk",
      "simulate_sms_campaign",
      `sms_campaign:${smsCampaign.id}`,
      `Simulated "${smsCampaign.name}" to ${smsCampaign.deliveredCount} recipients; ${smsCampaign.blockedCount} blocked by consent/phone safeguards.`,
    );

    return smsCampaign;
  }

  async logExport(recordCount: number): Promise<AuditLog> {
    return db
      .insert(auditLogs)
      .values({
        actor: "front_desk",
        action: "export_visitors_csv",
        target: "visitor_records",
        detail: `Exported ${recordCount} visitor records to CSV.`,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();
  }

  async listDocumentTemplates(): Promise<DocumentTemplate[]> {
    return db.select().from(documentTemplates).orderBy(desc(documentTemplates.createdAt)).all();
  }

  async listActiveDocumentTemplates(): Promise<DocumentTemplate[]> {
    return db.select().from(documentTemplates).where(eq(documentTemplates.active, true)).all();
  }

  async createDocumentTemplate(template: CreateDocumentTemplate): Promise<DocumentTemplate> {
    const document = db
      .insert(documentTemplates)
      .values({
        ...template,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    this.log("admin", "create_document_template", `document_template:${document.id}`, `Created ${document.name}`);
    return document;
  }

  async listSignedDocuments(visitorId?: number): Promise<SignedDocument[]> {
    if (visitorId) {
      return db
        .select()
        .from(signedDocuments)
        .where(eq(signedDocuments.visitorId, visitorId))
        .orderBy(desc(signedDocuments.signedAt))
        .all();
    }

    return db.select().from(signedDocuments).orderBy(desc(signedDocuments.signedAt)).all();
  }

  async getSignedDocument(id: number): Promise<SignedDocument | undefined> {
    return db.select().from(signedDocuments).where(eq(signedDocuments.id, id)).get();
  }

  async guestCheckIn(checkIn: GuestCheckIn): Promise<{ visitor: Visitor; signedDocuments: SignedDocument[] }> {
    const templates = this.getTemplatesByIds(checkIn.acknowledgedTemplateIds);
    const missingActive = db
      .select()
      .from(documentTemplates)
      .where(eq(documentTemplates.active, true))
      .all()
      .filter((template) => !checkIn.acknowledgedTemplateIds.includes(template.id));

    if (missingActive.length > 0) {
      throw new Error("All active visitor documents must be acknowledged");
    }

    const visitor = db
      .insert(visitors)
      .values({
        fullName: checkIn.fullName,
        company: checkIn.company,
        email: checkIn.email,
        phone: checkIn.phone,
        hostName: checkIn.hostName,
        purpose: checkIn.purpose,
        expectedArrival: new Date().toISOString().slice(0, 16),
        status: "checked_in",
        badgeNumber: `G-${Date.now().toString().slice(-4)}`,
        notes: "Guest self check-in with signed documents",
        checkedInAt: new Date().toISOString(),
        checkedOutAt: null,
      })
      .returning()
      .get();

    const signedAt = new Date().toISOString();
    const createdDocuments = templates.map((template) =>
      db
        .insert(signedDocuments)
        .values({
          visitorId: visitor.id,
          templateId: template.id,
          documentName: template.name,
          documentKind: template.kind,
          signerName: checkIn.fullName,
          signerEmail: checkIn.email,
          signature: checkIn.signature,
          acknowledged: true,
          signedAt,
          pdfContent: this.buildSignedDocumentHtml(visitor, template, checkIn.signature, signedAt),
        })
        .returning()
        .get(),
    );

    this.log(
      "guest",
      "guest_check_in",
      `visitor:${visitor.id}`,
      `${visitor.fullName} checked in and signed ${createdDocuments.length} document(s).`,
    );

    return { visitor, signedDocuments: createdDocuments };
  }

  private getAudienceVisitors(audience: string): Visitor[] {
    const allVisitors = db.select().from(visitors).all();

    if (audience === "all") {
      return allVisitors;
    }

    return allVisitors.filter((visitor) => visitor.status === audience);
  }

  private canTextVisitor(visitor: Visitor): boolean {
    const normalizedPhone = visitor.phone.replace(/\D/g, "");
    const hasValidPhone = normalizedPhone.length >= 10;
    const notes = visitor.notes?.toLowerCase() ?? "";
    const hasOptOut = notes.includes("opt out") || notes.includes("stop");
    return hasValidPhone && !hasOptOut;
  }

  private getTemplatesByIds(ids: number[]): DocumentTemplate[] {
    return ids
      .map((id) => db.select().from(documentTemplates).where(eq(documentTemplates.id, id)).get())
      .filter((template): template is DocumentTemplate => Boolean(template));
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

  private log(actor: string, action: string, target: string, detail: string) {
    db.insert(auditLogs)
      .values({
        actor,
        action,
        target,
        detail,
        createdAt: new Date().toISOString(),
      })
      .run();
  }
}

export const storage = new DatabaseStorage();
