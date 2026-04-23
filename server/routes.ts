import type { Express } from "express";
import { storage } from "./storage";
import {
  createDocumentTemplateSchema,
  createSmsCampaignSchema,
  guestCheckInSchema,
  insertVisitorSchema,
  visitorStatusUpdateSchema,
} from "@shared/schema";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

async function signedDocumentPdf(document: Awaited<ReturnType<typeof storage.getSignedDocument>>) {
  if (!document) {
    return undefined;
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`${document.documentName} - Signed`);
  pdfDoc.setAuthor("Perplexity Computer");
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(0.04, 0.45, 0.5);
  const text = rgb(0.12, 0.16, 0.22);
  let y = 736;

  page.drawText("VisitFlow Signed Visitor Document", { x: 48, y, size: 18, font: bold, color: teal });
  y -= 32;
  page.drawText(document.documentName, { x: 48, y, size: 14, font: bold, color: text });
  y -= 28;

  const rows = [
    ["Signer", document.signerName],
    ["Email", document.signerEmail],
    ["Document type", document.documentKind.toUpperCase()],
    ["Signed at", document.signedAt],
    ["Acknowledged", document.acknowledged ? "Yes" : "No"],
  ];

  rows.forEach(([label, value]) => {
    page.drawText(label, { x: 48, y, size: 9, font: bold, color: rgb(0.43, 0.47, 0.53) });
    page.drawText(value, { x: 170, y, size: 10, font, color: text });
    y -= 20;
  });

  y -= 16;
  page.drawText("Electronic signature", { x: 48, y, size: 11, font: bold, color: text });
  y -= 34;
  page.drawText(document.signature, { x: 48, y, size: 24, font, color: teal });
  y -= 32;
  page.drawText("The visitor signed or acknowledged this document electronically during check-in.", {
    x: 48,
    y,
    size: 9,
    font,
    color: rgb(0.43, 0.47, 0.53),
  });

  return Buffer.from(await pdfDoc.save());
}

export async function registerRoutes(app: Express): Promise<void> {
  app.get("/api/visitors", async (_req, res) => {
    const visitors = await storage.listVisitors();
    res.json(visitors);
  });

  app.get("/api/compliance-controls", async (_req, res) => {
    const controls = await storage.listControls();
    res.json(controls);
  });

  app.get("/api/audit-logs", async (_req, res) => {
    const logs = await storage.listAuditLogs();
    res.json(logs);
  });

  app.get("/api/sms-campaigns", async (_req, res) => {
    const campaigns = await storage.listSmsCampaigns();
    res.json(campaigns);
  });

  app.get("/api/document-templates", async (_req, res) => {
    const documents = await storage.listDocumentTemplates();
    res.json(documents);
  });

  app.get("/api/document-templates/active", async (_req, res) => {
    const documents = await storage.listActiveDocumentTemplates();
    res.json(documents);
  });

  app.get("/api/signed-documents", async (req, res) => {
    const visitorId = req.query.visitorId ? Number(req.query.visitorId) : undefined;
    const documents = await storage.listSignedDocuments(visitorId);
    res.json(documents);
  });

  app.post("/api/visitors", async (req, res) => {
    const parsed = insertVisitorSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.flatten() });
      return;
    }

    const visitor = await storage.createVisitor(parsed.data);
    res.status(201).json(visitor);
  });

  app.post("/api/sms-campaigns", async (req, res) => {
    const parsed = createSmsCampaignSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.flatten() });
      return;
    }

    const campaign = await storage.createSmsCampaign(parsed.data);
    res.status(201).json(campaign);
  });

  app.post("/api/document-templates", async (req, res) => {
    const parsed = createDocumentTemplateSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.flatten() });
      return;
    }

    const document = await storage.createDocumentTemplate(parsed.data);
    res.status(201).json(document);
  });

  app.post("/api/guest-check-in", async (req, res) => {
    const parsed = guestCheckInSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.flatten() });
      return;
    }

    try {
      const result = await storage.guestCheckIn(parsed.data);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Unable to check in" });
    }
  });

  app.post("/api/exports/visitors", async (req, res) => {
    const recordCount = Number(req.body?.recordCount ?? 0);

    if (!Number.isInteger(recordCount) || recordCount < 0) {
      res.status(400).json({ message: "recordCount must be a positive integer" });
      return;
    }

    const log = await storage.logExport(recordCount);
    res.status(201).json(log);
  });

  app.patch("/api/visitors/:id/check-in", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = visitorStatusUpdateSchema.safeParse(req.body ?? {});

    if (!Number.isInteger(id)) {
      res.status(400).json({ message: "Visitor id must be a number" });
      return;
    }

    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.flatten() });
      return;
    }

    const visitor = await storage.checkInVisitor(id, parsed.data.badgeNumber);

    if (!visitor) {
      res.status(404).json({ message: "Visitor not found" });
      return;
    }

    res.json(visitor);
  });

  app.patch("/api/visitors/:id/check-out", async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      res.status(400).json({ message: "Visitor id must be a number" });
      return;
    }

    const visitor = await storage.checkOutVisitor(id);

    if (!visitor) {
      res.status(404).json({ message: "Visitor not found" });
      return;
    }

    res.json(visitor);
  });

  app.get("/api/signed-documents/:id/pdf", async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      res.status(400).json({ message: "Document id must be a number" });
      return;
    }

    const document = await storage.getSignedDocument(id);
    const pdf = await signedDocumentPdf(document);

    if (!document || !pdf) {
      res.status(404).json({ message: "Signed document not found" });
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"${document.documentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${document.id}.pdf\"`,
    );
    res.send(pdf);
  });
}
