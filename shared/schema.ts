import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const visitStatuses = ["scheduled", "checked_in", "checked_out"] as const;
export const complianceControlStatuses = ["implemented", "in_progress", "needs_evidence"] as const;
export const smsCampaignStatuses = ["draft", "simulated", "ready_for_provider"] as const;
export const documentKinds = ["nda", "waiver", "policy"] as const;

export const visitors = sqliteTable("visitors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  company: text("company").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  hostName: text("host_name").notNull(),
  purpose: text("purpose").notNull(),
  expectedArrival: text("expected_arrival").notNull(),
  status: text("status", { enum: visitStatuses }).notNull().default("scheduled"),
  badgeNumber: text("badge_number"),
  notes: text("notes"),
  checkedInAt: text("checked_in_at"),
  checkedOutAt: text("checked_out_at"),
});

export const complianceControls = sqliteTable("compliance_controls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  controlId: text("control_id").notNull(),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status", { enum: complianceControlStatuses }).notNull(),
  evidence: text("evidence").notNull(),
  owner: text("owner").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const smsCampaigns = sqliteTable("sms_campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  audience: text("audience").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: smsCampaignStatuses }).notNull().default("draft"),
  recipientCount: integer("recipient_count").notNull().default(0),
  deliveredCount: integer("delivered_count").notNull().default(0),
  blockedCount: integer("blocked_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  detail: text("detail").notNull(),
  createdAt: text("created_at").notNull(),
});

export const documentTemplates = sqliteTable("document_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  kind: text("kind", { enum: documentKinds }).notNull(),
  body: text("body").notNull(),
  requiresSignature: integer("requires_signature", { mode: "boolean" }).notNull().default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const signedDocuments = sqliteTable("signed_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorId: integer("visitor_id").notNull(),
  templateId: integer("template_id").notNull(),
  documentName: text("document_name").notNull(),
  documentKind: text("document_kind", { enum: documentKinds }).notNull(),
  signerName: text("signer_name").notNull(),
  signerEmail: text("signer_email").notNull(),
  signature: text("signature").notNull(),
  acknowledged: integer("acknowledged", { mode: "boolean" }).notNull().default(true),
  signedAt: text("signed_at").notNull(),
  pdfContent: text("pdf_content").notNull(),
});

export const insertVisitorSchema = createInsertSchema(visitors)
  .omit({
    id: true,
    checkedInAt: true,
    checkedOutAt: true,
  })
  .extend({
    fullName: z.string().min(2, "Visitor name is required"),
    company: z.string().min(2, "Company is required"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().min(7, "Phone number is required"),
    hostName: z.string().min(2, "Host is required"),
    purpose: z.string().min(2, "Purpose is required"),
    expectedArrival: z.string().min(1, "Arrival time is required"),
    status: z.enum(visitStatuses).default("scheduled"),
    badgeNumber: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  });

export const visitorStatusUpdateSchema = z.object({
  badgeNumber: z.string().optional().nullable(),
});

export const createSmsCampaignSchema = createInsertSchema(smsCampaigns)
  .omit({
    id: true,
    status: true,
    recipientCount: true,
    deliveredCount: true,
    blockedCount: true,
    createdAt: true,
  })
  .extend({
    name: z.string().min(3, "Campaign name is required"),
    audience: z.enum(["all", "scheduled", "checked_in", "checked_out"]),
    message: z
      .string()
      .min(10, "Message must be at least 10 characters")
      .max(320, "Keep SMS campaigns under 320 characters"),
  });

export const createDocumentTemplateSchema = createInsertSchema(documentTemplates)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    name: z.string().min(3, "Document name is required"),
    kind: z.enum(documentKinds),
    body: z.string().min(20, "Document body must be at least 20 characters"),
    requiresSignature: z.boolean().default(true),
    active: z.boolean().default(true),
  });

export const guestCheckInSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  company: z.string().min(2, "Company is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(7, "Phone number is required"),
  hostName: z.string().min(2, "Host is required"),
  purpose: z.string().min(2, "Purpose is required"),
  signature: z.string().min(2, "Signature is required"),
  acknowledgedTemplateIds: z.array(z.number()).min(1, "Acknowledge required documents"),
});

export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitors.$inferSelect;
export type VisitStatus = (typeof visitStatuses)[number];
export type ComplianceControl = typeof complianceControls.$inferSelect;
export type ComplianceControlStatus = (typeof complianceControlStatuses)[number];
export type CreateSmsCampaign = z.infer<typeof createSmsCampaignSchema>;
export type SmsCampaign = typeof smsCampaigns.$inferSelect;
export type SmsCampaignStatus = (typeof smsCampaignStatuses)[number];
export type AuditLog = typeof auditLogs.$inferSelect;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;
export type DocumentKind = (typeof documentKinds)[number];
export type CreateDocumentTemplate = z.infer<typeof createDocumentTemplateSchema>;
export type GuestCheckIn = z.infer<typeof guestCheckInSchema>;
export type SignedDocument = typeof signedDocuments.$inferSelect;
