import { useEffect, useMemo, useState } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardList,
  ClipboardSignature,
  ConciergeBell,
  DoorOpen,
  Download,
  FileCheck2,
  FileSignature,
  FileText,
  Globe,
  HardHat,
  History,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Moon,
  PenTool,
  Plus,
  QrCode,
  RadioTower,
  Search,
  Send,
  ServerCog,
  ShieldCheck,
  Siren,
  Smartphone,
  Sun,
  UserCheck,
  UserCircle,
  UserCog,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { Link } from "wouter";
import { queryClient, apiRequest, API_BASE } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import NotFound from "@/pages/not-found";
import {
  createDocumentTemplateSchema,
  createSmsCampaignSchema,
  guestCheckInSchema,
  insertVisitorSchema,
  type AuditLog,
  type ComplianceControl,
  type ComplianceControlStatus,
  type CreateDocumentTemplate,
  type CreateSmsCampaign,
  type DocumentTemplate,
  type GuestCheckIn,
  type InsertVisitor,
  type SignedDocument,
  type SmsCampaign,
  type Visitor,
  type VisitStatus,
} from "@shared/schema";

type Theme = "light" | "dark";
type StatusFilter = "all" | VisitStatus;

const SITE_TITLE = "Entra SB";
const SITE_SUBTITLE = "HQ Reception";
const SITE_LOCATION = "Santa Barbara HQ";

const statusLabels: Record<VisitStatus, string> = {
  scheduled: "Scheduled",
  checked_in: "Checked in",
  checked_out: "Checked out",
};

const complianceStatusLabels: Record<ComplianceControlStatus, string> = {
  implemented: "Implemented",
  in_progress: "In progress",
  needs_evidence: "Needs evidence",
};

const audienceLabels: Record<CreateSmsCampaign["audience"], string> = {
  all: "All visitors",
  scheduled: "Scheduled visitors",
  checked_in: "Visitors on site",
  checked_out: "Completed visits",
};

const purposeOptions = [
  "Interview",
  "Client meeting",
  "Facilities planning",
  "Workspace analytics demo",
  "Vendor visit",
  "Delivery",
  "Security audit",
];

const visitorTypes = [
  { id: "guest", label: "General Guest", icon: UserCircle, detail: "Standard reception check-in" },
  { id: "contractor", label: "Contractor", icon: HardHat, detail: "OSHA waiver required" },
  { id: "candidate", label: "Candidate", icon: Briefcase, detail: "Interview reception" },
] as const;

function QRCodeGraphic({ size = 88 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="rounded-lg border border-white/20 bg-white p-1.5 text-slate-900"
    >
      <rect x="0" y="0" width="30" height="30" fill="currentColor" />
      <rect x="5" y="5" width="20" height="20" fill="white" />
      <rect x="10" y="10" width="10" height="10" fill="currentColor" />
      <rect x="70" y="0" width="30" height="30" fill="currentColor" />
      <rect x="75" y="5" width="20" height="20" fill="white" />
      <rect x="80" y="10" width="10" height="10" fill="currentColor" />
      <rect x="0" y="70" width="30" height="30" fill="currentColor" />
      <rect x="5" y="75" width="20" height="20" fill="white" />
      <rect x="10" y="80" width="10" height="10" fill="currentColor" />
      <rect x="40" y="40" width="20" height="20" fill="currentColor" />
      <rect x="85" y="85" width="15" height="15" fill="currentColor" />
    </svg>
  );
}

function VisitFlowLogo({ className = "h-9 w-9 text-primary" }: { className?: string }) {
  return (
    <svg aria-label="VisitFlow logo" viewBox="0 0 48 48" className={className} fill="none">
      <rect x="8" y="7" width="23" height="34" rx="4" stroke="currentColor" strokeWidth="3" />
      <path d="M31 14h5.5A3.5 3.5 0 0 1 40 17.5v13A3.5 3.5 0 0 1 36.5 34H31" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M18 24h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M29 19l5 5-5 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.5" cy="24" r="1.8" fill="currentColor" />
    </svg>
  );
}

function formatArrival(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function statusTone(status: VisitStatus) {
  if (status === "checked_in") {
    return "bg-emerald-500/12 text-emerald-700 border-emerald-500/25 dark:text-emerald-300";
  }
  if (status === "checked_out") {
    return "bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-300";
  }
  return "bg-amber-500/12 text-amber-700 border-amber-500/25 dark:text-amber-300";
}

function complianceTone(status: ComplianceControlStatus) {
  if (status === "implemented") {
    return "bg-emerald-500/12 text-emerald-700 border-emerald-500/25 dark:text-emerald-300";
  }
  if (status === "in_progress") {
    return "bg-sky-500/12 text-sky-700 border-sky-500/25 dark:text-sky-300";
  }
  return "bg-amber-500/12 text-amber-700 border-amber-500/25 dark:text-amber-300";
}

function dashboardStats(visitors: Visitor[]) {
  return {
    total: visitors.length,
    scheduled: visitors.filter((v) => v.status === "scheduled").length,
    checkedIn: visitors.filter((v) => v.status === "checked_in").length,
    checkedOut: visitors.filter((v) => v.status === "checked_out").length,
  };
}

function complianceStats(controls: ComplianceControl[]) {
  const implemented = controls.filter((c) => c.status === "implemented").length;
  const score = controls.length === 0 ? 0 : Math.round((implemented / controls.length) * 100);
  return { implemented, total: controls.length, score };
}

function csvCell(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadVisitorsCsv(visitors: Visitor[]) {
  const header = [
    "Visitor",
    "Company",
    "Email",
    "Phone",
    "Host",
    "Purpose",
    "Arrival",
    "Status",
    "Badge",
    "Notes",
  ];
  const rows = visitors.map((v) => [
    v.fullName,
    v.company,
    v.email,
    v.phone,
    v.hostName,
    v.purpose,
    v.expectedArrival,
    statusLabels[v.status],
    v.badgeNumber,
    v.notes,
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "visitflow-visitors.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function formatAuditTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function SkeletonRows() {
  return (
    <div className="space-y-3" data-testid="status-loading-visitors">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

function EmptyVisitors({ onNewVisitor }: { onNewVisitor: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-10 text-center"
      data-testid="empty-visitors"
    >
      <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
        <ClipboardList className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold">No visitors match this view</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Register the next guest or adjust your filters to see today&rsquo;s visit queue.
      </p>
      <Button className="mt-5" onClick={onNewVisitor} data-testid="button-empty-register">
        Register visitor
      </Button>
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Visit details", "Documents & sign", "Confirmation"];
  return (
    <ol className="flex items-center gap-2" aria-label="Check-in progress">
      {labels.map((label, i) => {
        const idx = (i + 1) as 1 | 2 | 3;
        const active = idx === step;
        const done = idx < step;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                  ? "bg-primary/15 text-primary ring-2 ring-primary"
                  : "bg-muted text-muted-foreground"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : idx}
            </span>
            <span
              className={`hidden text-xs font-medium md:inline ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < labels.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

function GuestCheckInPage() {
  const [theme, setTheme] = useState<Theme>("light");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [visitorType, setVisitorType] = useState<(typeof visitorTypes)[number]["id"]>("guest");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const documentsQuery = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates/active"],
  });

  const documents = documentsQuery.data ?? [];

  const form = useForm<GuestCheckIn>({
    resolver: zodResolver(guestCheckInSchema),
    defaultValues: {
      fullName: "",
      company: "",
      email: "",
      phone: "",
      hostName: "",
      purpose: "Client meeting",
      signature: "",
      acknowledgedTemplateIds: [],
    },
  });

  useEffect(() => {
    if (documents.length > 0 && form.getValues("acknowledgedTemplateIds").length === 0) {
      form.setValue(
        "acknowledgedTemplateIds",
        documents.map((d) => d.id),
      );
    }
  }, [documents, form]);

  const checkInMutation = useMutation({
    mutationFn: async (values: GuestCheckIn) => {
      const response = await apiRequest("POST", "/api/guest-check-in", values);
      return response.json() as Promise<{ visitor: Visitor; signedDocuments: SignedDocument[] }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/signed-documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
      setStep(3);
    },
  });

  const signedDocuments = checkInMutation.data?.signedDocuments ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-foreground dark:from-slate-950 dark:to-slate-900">
      {/* Kiosk header */}
      <header className="border-b border-border bg-background/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <VisitFlowLogo />
            <div>
              <div className="font-semibold leading-tight">VisitFlow</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                {SITE_LOCATION}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden border-emerald-500/25 bg-emerald-500/10 text-emerald-700 sm:inline-flex dark:text-emerald-300">
              <ShieldCheck className="mr-1 h-3 w-3" />
              SOC 2 ready
            </Badge>
            <Button
              variant="outline"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme((c) => (c === "dark" ? "light" : "dark"))}
              data-testid="button-guest-toggle-theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href="/admin">
              <Button variant="outline" data-testid="link-admin-backend">
                <LayoutDashboard className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          {/* Hero / location card */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-slate-900 p-8 text-white shadow-xl">
            <div
              aria-hidden
              className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl"
            />
            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
                  <MapPin className="h-3 w-3 text-primary" />
                  {SITE_LOCATION}
                </div>
                <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
                  Welcome to {SITE_TITLE}
                </h1>
                <p className="mt-2 max-w-xl text-sm text-slate-300">
                  {SITE_SUBTITLE} &middot; Check in, review required documents, sign once, and your host will be notified.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" /> Audit evidence
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                    <FileSignature className="h-3 w-3 text-primary" /> Signed NDA
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-slate-200 ring-1 ring-white/10">
                    <HardHat className="h-3 w-3 text-amber-300" /> OSHA waiver
                  </span>
                </div>
              </div>
              <div className="hidden flex-col items-center gap-2 md:flex">
                <QRCodeGraphic size={112} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Scan to check in
                </span>
              </div>
            </div>
          </div>

          {/* Visitor type picker + check-in card */}
          <Card className="overflow-hidden">
            <CardHeader className="gap-3 border-b border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">
                    {step === 1 && "Visit details"}
                    {step === 2 && "Documents & signature"}
                    {step === 3 && "Check-in complete"}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step === 1 && "Pick your visit type and tell us who you're here to see."}
                    {step === 2 && "Review each required document, then sign once to acknowledge all of them."}
                    {step === 3 && "Your host has been notified."}
                  </p>
                </div>
                <StepIndicator step={step} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                      Visitor type
                    </p>
                    <div className="grid gap-3 md:grid-cols-3">
                      {visitorTypes.map((type) => {
                        const Icon = type.icon;
                        const active = visitorType === type.id;
                        return (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setVisitorType(type.id)}
                            className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
                              active
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/40 hover:bg-accent/40"
                            }`}
                            data-testid={`button-visitor-type-${type.id}`}
                          >
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{type.label}</p>
                              <p className="text-xs text-muted-foreground">{type.detail}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Form {...form}>
                    <form className="grid gap-4" data-testid="form-guest-details">
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Your name</FormLabel>
                              <FormControl>
                                <Input placeholder="Jane Cooper" data-testid="input-guest-name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company</FormLabel>
                              <FormControl>
                                <Input placeholder="Acme Workplace" data-testid="input-guest-company" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="jane@company.com" data-testid="input-guest-email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone</FormLabel>
                              <FormControl>
                                <Input placeholder="(555) 010-2200" data-testid="input-guest-phone" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="hostName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Host</FormLabel>
                              <FormControl>
                                <Input placeholder="Who are you visiting?" data-testid="input-guest-host" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="purpose"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Purpose</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-guest-purpose">
                                    <SelectValue placeholder="Select purpose" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {purposeOptions.map((p) => (
                                    <SelectItem key={p} value={p}>
                                      {p}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        className="h-12 text-base font-semibold"
                        onClick={async () => {
                          const ok = await form.trigger([
                            "fullName",
                            "company",
                            "email",
                            "phone",
                            "hostName",
                            "purpose",
                          ]);
                          if (ok) setStep(2);
                        }}
                        data-testid="button-guest-next-documents"
                      >
                        Continue to documents
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </form>
                  </Form>
                </div>
              )}

              {step === 2 && (
                <Form {...form}>
                  <form
                    className="space-y-5"
                    onSubmit={form.handleSubmit((values) => checkInMutation.mutate(values))}
                    data-testid="form-guest-signature"
                  >
                    <div className="space-y-3">
                      {documentsQuery.isLoading ? (
                        <SkeletonRows />
                      ) : documents.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                          No active documents. Proceed to sign.
                        </div>
                      ) : (
                        documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="rounded-2xl border border-border bg-muted/30 p-4"
                            data-testid={`card-guest-document-${doc.id}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <p className="text-sm font-semibold">{doc.name}</p>
                              </div>
                              <Badge variant="outline" className="font-mono text-[10px] uppercase">
                                {doc.kind}
                              </Badge>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">{doc.body}</p>
                            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                              <ShieldCheck className="h-3 w-3 text-emerald-600" />
                              Required for visitor entry
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="signature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <PenTool className="h-4 w-4 text-primary" />
                            Electronic signature
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Type your full legal name"
                              className="h-12 text-base"
                              data-testid="input-guest-signature"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
                      By checking in, you acknowledge all listed visitor documents. Signed copies are attached to the visitor log with a
                      non-repudiation signature record.
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(1)}
                        data-testid="button-guest-back-details"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="h-12 flex-1 text-base font-semibold"
                        disabled={checkInMutation.isPending}
                        data-testid="button-guest-complete-checkin"
                      >
                        <ClipboardSignature className="h-4 w-4" />
                        {checkInMutation.isPending ? "Checking in..." : "Sign and check in"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}

              {step === 3 && (
                <div className="space-y-5" data-testid="status-guest-checkin-complete">
                  <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
                    <div className="rounded-full bg-emerald-500/15 p-4 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">You are checked in.</h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Please have a seat in the lobby. Your host has been notified and is on their way.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border p-4">
                    <p className="text-sm font-semibold">Signed documents</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Downloadable PDFs are attached to the visitor log.
                    </p>
                    <div className="mt-3 grid gap-2">
                      {signedDocuments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No signed documents.</p>
                      ) : (
                        signedDocuments.map((doc) => (
                          <a
                            key={doc.id}
                            href={`${API_BASE}/api/signed-documents/${doc.id}/pdf`}
                            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                            data-testid={`link-guest-signed-pdf-${doc.id}`}
                          >
                            <Download className="h-4 w-4" />
                            {doc.documentName} PDF
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      form.reset();
                      setStep(1);
                    }}
                    data-testid="button-guest-new-checkin"
                  >
                    Start another check-in
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Secure by default
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Every completed check-in creates audit evidence, signed document records, and a badge-ready visitor entry.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Encryption
                  </p>
                  <p className="mt-1 text-sm font-semibold">AES-256</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Retention
                  </p>
                  <p className="mt-1 text-sm font-semibold">30 days</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4 text-primary" />
                Required documents
              </p>
              <p
                className="mt-2 text-2xl font-bold tabular-nums"
                data-testid="text-guest-document-count"
              >
                {documents.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                NDA, OSHA waiver, and any active admin templates.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ConciergeBell className="h-4 w-4 text-primary" />
                Need a human?
              </p>
              <p className="text-sm text-muted-foreground">
                Tap the front-desk bell or ask any staff member. Reception is staffed during business hours.
              </p>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Smartphone className="h-3 w-3" />
                SMS-first notifications
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function VisitorForm({ onSuccess }: { onSuccess: () => void }) {
  const form = useForm<InsertVisitor>({
    resolver: zodResolver(insertVisitorSchema),
    defaultValues: {
      fullName: "",
      company: "",
      email: "",
      phone: "",
      hostName: "",
      purpose: "Client meeting",
      expectedArrival: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
      status: "scheduled",
      badgeNumber: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: InsertVisitor) => {
      const response = await apiRequest("POST", "/api/visitors", values);
      return response.json() as Promise<Visitor>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
      form.reset();
      onSuccess();
    },
  });

  return (
    <Form {...form}>
      <form
        className="grid gap-4"
        onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        data-testid="form-register-visitor"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Visitor name</FormLabel>
                <FormControl>
                  <Input placeholder="Jane Cooper" data-testid="input-full-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <Input placeholder="Acme Workplace" data-testid="input-company" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="jane@company.com" data-testid="input-email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="(555) 010-2200" data-testid="input-phone" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="hostName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Host</FormLabel>
                <FormControl>
                  <Input placeholder="Alex Morgan" data-testid="input-host" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="expectedArrival"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expected arrival</FormLabel>
                <FormControl>
                  <Input type="datetime-local" data-testid="input-arrival" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purpose</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-purpose">
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {purposeOptions.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="badgeNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Badge number</FormLabel>
                <FormControl>
                  <Input placeholder="Optional" data-testid="input-badge" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Parking, NDA, floor, or accessibility notes"
                  data-testid="textarea-notes"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-visitor">
          {createMutation.isPending ? "Registering..." : "Register visitor"}
        </Button>
      </form>
    </Form>
  );
}

function SmsCampaignForm({ visitors }: { visitors: Visitor[] }) {
  const form = useForm<CreateSmsCampaign>({
    resolver: zodResolver(createSmsCampaignSchema),
    defaultValues: {
      name: "Emergency lobby update",
      audience: "scheduled",
      message:
        "VisitFlow update: Please check in at the front desk when you arrive. Reply STOP to opt out.",
    },
  });

  const selectedAudience = form.watch("audience");
  const selectedMessage = form.watch("message") ?? "";
  const estimatedAudience =
    selectedAudience === "all"
      ? visitors
      : visitors.filter((v) => v.status === selectedAudience);
  const estimatedDeliverable = estimatedAudience.filter((v) => {
    const normalizedPhone = v.phone.replace(/\D/g, "");
    const notes = v.notes?.toLowerCase() ?? "";
    return normalizedPhone.length >= 10 && !notes.includes("opt out") && !notes.includes("stop");
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (values: CreateSmsCampaign) => {
      const response = await apiRequest("POST", "/api/sms-campaigns", values);
      return response.json() as Promise<SmsCampaign>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sms-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
    },
  });

  return (
    <Form {...form}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => createCampaignMutation.mutate(values))}
        data-testid="form-sms-campaign"
      >
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              SMS is in simulation mode. A real provider should enforce consent, opt-out handling, rate limits, quiet hours,
              and delivery webhooks before production sends.
            </p>
          </div>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Campaign name</FormLabel>
              <FormControl>
                <Input placeholder="Lobby delay notice" data-testid="input-campaign-name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="audience"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Audience</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-sms-audience">
                    <SelectValue placeholder="Choose audience" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="all">All visitors</SelectItem>
                  <SelectItem value="scheduled">Scheduled visitors</SelectItem>
                  <SelectItem value="checked_in">Visitors on site</SelectItem>
                  <SelectItem value="checked_out">Completed visits</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Write a concise text message"
                  className="min-h-28"
                  data-testid="textarea-sms-message"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Audience</p>
            <p className="text-lg font-semibold tabular-nums" data-testid="text-sms-audience-count">
              {estimatedAudience.length}
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Deliverable</p>
            <p className="text-lg font-semibold tabular-nums" data-testid="text-sms-deliverable-count">
              {estimatedDeliverable.length}
            </p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Characters</p>
            <p className="text-lg font-semibold tabular-nums" data-testid="text-sms-character-count">
              {selectedMessage.length}
            </p>
          </div>
        </div>

        {createCampaignMutation.data && (
          <div
            className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
            data-testid="status-sms-simulated"
          >
            Simulated send complete: {createCampaignMutation.data.deliveredCount} deliverable,{" "}
            {createCampaignMutation.data.blockedCount} blocked by safeguards.
          </div>
        )}

        <Button type="submit" disabled={createCampaignMutation.isPending} data-testid="button-simulate-sms">
          <Send className="h-4 w-4" />
          {createCampaignMutation.isPending ? "Simulating..." : "Simulate mass text"}
        </Button>
      </form>
    </Form>
  );
}

function SmsCenter({ visitors, campaigns }: { visitors: Visitor[]; campaigns: SmsCampaign[] }) {
  return (
    <Card>
      <CardHeader className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquareText className="h-5 w-5 text-primary" />
              Mass text center
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Compose consent-aware bulk SMS campaigns in simulation mode.
            </p>
          </div>
          <Badge variant="outline" className="border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300">
            Provider-ready
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-5 pt-0 xl:grid-cols-[1fr_320px]">
        <SmsCampaignForm visitors={visitors} />
        <div className="space-y-3">
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <RadioTower className="h-4 w-4 text-primary" />
              Provider integration notes
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Connect Twilio, Telnyx, or Plivo server-side. Store provider message IDs, ingest delivery receipts, and process
              STOP/START webhooks before enabling live sends.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent campaigns</p>
            {campaigns.length === 0 ? (
              <p
                className="rounded-lg bg-muted p-3 text-sm text-muted-foreground"
                data-testid="text-no-sms-campaigns"
              >
                No SMS simulations yet.
              </p>
            ) : (
              campaigns.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-border p-3"
                  data-testid={`card-sms-campaign-${c.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{c.name}</p>
                    <Badge variant="outline">{c.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {audienceLabels[c.audience as CreateSmsCampaign["audience"]]} &middot; {c.deliveredCount} deliverable &middot;{" "}
                    {c.blockedCount} blocked
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComplianceCenter({
  controls,
  auditLogs,
}: {
  controls: ComplianceControl[];
  auditLogs: AuditLog[];
}) {
  const stats = complianceStats(controls);
  const trustControls = [
    { label: "SSO and RBAC", detail: "Define roles for receptionist, host, security admin, and auditor.", icon: UserCog },
    { label: "Audit evidence", detail: "Sensitive actions are logged with actor, target, detail, and timestamp.", icon: Activity },
    { label: "PII retention", detail: "Policy-ready control for visitor, badge, SMS, and export retention.", icon: LockKeyhole },
    { label: "Vendor review", detail: "SMS provider should be reviewed as a subservice organization.", icon: ServerCog },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" />
                SOC 2 readiness center
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Product controls that support SOC 2 evidence collection.
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 px-3 py-2 text-primary">
              <span className="text-lg font-semibold tabular-nums" data-testid="text-compliance-score">
                {stats.score}%
              </span>
              <span className="ml-1 text-xs">implemented</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          {controls.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-border p-4"
              data-testid={`card-control-${c.controlId}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{c.controlId}</Badge>
                    <span className="text-xs text-muted-foreground">{c.category}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{c.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{c.description}</p>
                </div>
                <Badge variant="outline" className={complianceTone(c.status)}>
                  {complianceStatusLabels[c.status]}
                </Badge>
              </div>
              <div className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Evidence: {c.evidence}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader className="p-5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCheck2 className="h-5 w-5 text-primary" />
              Required next steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {trustControls.map((item) => (
              <div key={item.label} className="flex gap-3 rounded-lg border border-border p-3">
                <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Recent audit activity
            </CardTitle>
            <p className="text-sm text-muted-foreground">Latest evidence-generating events.</p>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {auditLogs.length === 0 ? (
              <p
                className="rounded-lg bg-muted p-3 text-sm text-muted-foreground"
                data-testid="text-no-audit-logs"
              >
                No audit events yet.
              </p>
            ) : (
              auditLogs.slice(0, 6).map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-border p-3"
                  data-testid={`card-audit-log-${log.id}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{log.action.replaceAll("_", " ")}</p>
                    <span className="text-xs text-muted-foreground">{formatAuditTime(log.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{log.detail}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DocumentAdmin({ documents }: { documents: DocumentTemplate[] }) {
  const form = useForm<CreateDocumentTemplate>({
    resolver: zodResolver(createDocumentTemplateSchema),
    defaultValues: {
      name: "Contractor OSHA Acknowledgment",
      kind: "waiver",
      body:
        "Visitor acknowledges that they will follow all posted safety instructions, remain with their host in controlled areas, and report hazards, injuries, or unsafe conditions immediately.",
      requiresSignature: true,
      active: true,
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: async (values: CreateDocumentTemplate) => {
      const response = await apiRequest("POST", "/api/document-templates", values);
      return response.json() as Promise<DocumentTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
    },
  });

  return (
    <Card>
      <CardHeader className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSignature className="h-5 w-5 text-primary" />
              Document manager
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Add required NDAs, OSHA waivers, safety policies, and visitor acknowledgments.
            </p>
          </div>
          <Badge variant="outline">
            {documents.filter((d) => d.active).length} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-5 pt-0 xl:grid-cols-[1fr_360px]">
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => createDocumentMutation.mutate(values))}
            data-testid="form-document-template"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document name</FormLabel>
                    <FormControl>
                      <Input placeholder="OSHA waiver" data-testid="input-document-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-document-kind">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="nda">NDA</SelectItem>
                        <SelectItem value="waiver">Waiver</SelectItem>
                        <SelectItem value="policy">Policy</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document text</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-32"
                      placeholder="Paste waiver, NDA, or acknowledgment text"
                      data-testid="textarea-document-body"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {createDocumentMutation.data && (
              <div
                className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
                data-testid="status-document-created"
              >
                Added {createDocumentMutation.data.name} to the guest check-in flow.
              </div>
            )}
            <Button type="submit" disabled={createDocumentMutation.isPending} data-testid="button-create-document">
              <Plus className="h-4 w-4" />
              {createDocumentMutation.isPending ? "Adding..." : "Add required document"}
            </Button>
          </form>
        </Form>

        <div className="space-y-3">
          <p className="text-sm font-medium">Current templates</p>
          {documents.length === 0 ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground" data-testid="text-no-documents">
              No document templates yet.
            </p>
          ) : (
            documents.slice(0, 8).map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-border p-3"
                data-testid={`card-document-template-${d.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-medium">{d.name}</p>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    {d.kind}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{d.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {d.active ? "Active in guest check-in" : "Inactive"}
                </p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type AdminSection = "dashboard" | "visitors" | "documents" | "sms" | "compliance";

function VisitorDashboard() {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [section, setSection] = useState<AdminSection>("dashboard");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const visitorsQuery = useQuery<Visitor[]>({ queryKey: ["/api/visitors"] });
  const controlsQuery = useQuery<ComplianceControl[]>({ queryKey: ["/api/compliance-controls"] });
  const auditLogsQuery = useQuery<AuditLog[]>({ queryKey: ["/api/audit-logs"] });
  const campaignsQuery = useQuery<SmsCampaign[]>({ queryKey: ["/api/sms-campaigns"] });
  const documentsQuery = useQuery<DocumentTemplate[]>({ queryKey: ["/api/document-templates"] });
  const signedDocumentsQuery = useQuery<SignedDocument[]>({ queryKey: ["/api/signed-documents"] });

  const exportMutation = useMutation({
    mutationFn: async (recordCount: number) => {
      const response = await apiRequest("POST", "/api/exports/visitors", { recordCount });
      return response.json() as Promise<AuditLog>;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] }),
  });

  const checkInMutation = useMutation({
    mutationFn: async (visitor: Visitor) => {
      const badgeNumber = visitor.badgeNumber || `G-${String(visitor.id).padStart(3, "0")}`;
      const response = await apiRequest("PATCH", `/api/visitors/${visitor.id}/check-in`, { badgeNumber });
      return response.json() as Promise<Visitor>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (visitor: Visitor) => {
      const response = await apiRequest("PATCH", `/api/visitors/${visitor.id}/check-out`);
      return response.json() as Promise<Visitor>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
    },
  });

  const visitors = visitorsQuery.data ?? [];
  const controls = controlsQuery.data ?? [];
  const auditLogs = auditLogsQuery.data ?? [];
  const campaigns = campaignsQuery.data ?? [];
  const documents = documentsQuery.data ?? [];
  const signedDocuments = signedDocumentsQuery.data ?? [];
  const stats = dashboardStats(visitors);
  const soc2Stats = complianceStats(controls);
  const activeVisitors = visitors.filter((v) => v.status === "checked_in");
  const nextArrivals = visitors
    .filter((v) => v.status === "scheduled")
    .slice()
    .sort((a, b) => new Date(a.expectedArrival).getTime() - new Date(b.expectedArrival).getTime())
    .slice(0, 3);

  const filteredVisitors = visitors.filter((v) => {
    const text = `${v.fullName} ${v.company} ${v.hostName} ${v.purpose}`.toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesFilter = filter === "all" || v.status === filter;
    return matchesSearch && matchesFilter;
  });

  const signedDocumentsByVisitor = useMemo(
    () =>
      signedDocuments.reduce<Record<number, SignedDocument[]>>((acc, d) => {
        acc[d.visitorId] = [...(acc[d.visitorId] ?? []), d];
        return acc;
      }, {}),
    [signedDocuments],
  );

  const statCards = [
    { label: "Today's visitors", value: stats.total, icon: Users, hint: "Registered guests", tone: "text-primary bg-primary/10" },
    { label: "Expected", value: stats.scheduled, icon: CalendarClock, hint: "Waiting to arrive", tone: "text-amber-700 bg-amber-500/10 dark:text-amber-300" },
    { label: "On site", value: stats.checkedIn, icon: UserCheck, hint: "Currently checked in", tone: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300" },
    { label: "Completed", value: stats.checkedOut, icon: CheckCircle2, hint: "Checked out", tone: "text-slate-700 bg-slate-500/10 dark:text-slate-300" },
    { label: "SOC 2 controls", value: `${soc2Stats.implemented}/${soc2Stats.total}`, icon: ShieldCheck, hint: "Readiness evidence", tone: "text-sky-700 bg-sky-500/10 dark:text-sky-300" },
  ];

  const nav: { id: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "visitors", label: "Visitor log", icon: ClipboardList },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "sms", label: "Mass texting", icon: MessageSquareText },
    { id: "compliance", label: "Compliance", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[272px_1fr]">
        <aside
          className="hidden border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground lg:flex lg:flex-col"
          aria-label="Primary navigation"
        >
          <div className="flex items-center gap-3">
            <VisitFlowLogo className="h-9 w-9 text-primary" />
            <div>
              <div className="font-semibold leading-tight">VisitFlow</div>
              <div className="text-xs text-sidebar-foreground/65">Admin console</div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Building2 className="h-4 w-4 text-primary" />
              {SITE_LOCATION}
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/60">
              {SITE_TITLE} &middot; {SITE_SUBTITLE}
            </div>
          </div>

          <nav className="mt-6 grid gap-1 text-sm">
            <Link href="/">
              <button
                className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sidebar-foreground/65 transition hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                data-testid="button-nav-guest-kiosk"
              >
                <ClipboardSignature className="h-4 w-4" />
                Guest kiosk
              </button>
            </Link>
            {nav.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-left transition ${
                  section === item.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
                data-testid={`button-nav-${item.id}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/80 p-4 text-sidebar-accent-foreground">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Security mode
            </div>
            <p className="mt-2 text-xs leading-5 text-sidebar-foreground/65">
              Guest records are persisted in Supabase and ready for access-control integrations.
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Systems nominal
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-border bg-background/88 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 lg:hidden">
                <VisitFlowLogo />
                <div>
                  <div className="font-semibold">VisitFlow</div>
                  <div className="text-xs text-muted-foreground">Admin console</div>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight">
                    {nav.find((n) => n.id === section)?.label ?? "Dashboard"}
                  </h1>
                  <Badge
                    variant="outline"
                    className="border-sky-500/25 bg-sky-500/10 text-[10px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300"
                  >
                    SOC 2 verified
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Admin backend for visitor logs, documents, and compliance evidence.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 md:inline-flex">
                  <Globe className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">{SITE_LOCATION}</span>
                </div>
                <Button variant="outline" size="icon" aria-label="View alerts" data-testid="button-alerts">
                  <Bell className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Toggle theme"
                  onClick={() => setTheme((c) => (c === "dark" ? "light" : "dark"))}
                  data-testid="button-toggle-theme"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-open-register">
                      <Plus className="h-4 w-4" />
                      New visitor
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" data-testid="dialog-register-visitor">
                    <DialogHeader>
                      <DialogTitle>Register a visitor</DialogTitle>
                      <DialogDescription>
                        Add the guest, host, visit purpose, and arrival details.
                      </DialogDescription>
                    </DialogHeader>
                    <VisitorForm onSuccess={() => setIsDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Mobile + tablet section tabs */}
            <div className="mt-3 flex gap-1 overflow-x-auto whitespace-nowrap lg:hidden">
              {nav.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    section === item.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
            </div>
          </header>

          <section className="space-y-6 p-4 md:p-8" aria-label="Visitor management workspace">
            {section === "dashboard" && (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {statCards.map((stat) => (
                    <Card
                      key={stat.label}
                      className="overflow-hidden"
                      data-testid={`card-stat-${stat.label.toLowerCase().replaceAll(" ", "-").replace("'", "")}`}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              {stat.label}
                            </p>
                            <p
                              className="mt-2 text-2xl font-bold tabular-nums"
                              data-testid={`text-stat-${stat.label.toLowerCase().replaceAll(" ", "-").replace("'", "")}`}
                            >
                              {stat.value}
                            </p>
                          </div>
                          <div className={`rounded-lg p-2 ${stat.tone}`}>
                            <stat.icon className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="mt-4 text-xs text-muted-foreground">{stat.hint}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
                  <Card>
                    <CardHeader className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <BarChart3 className="h-5 w-5 text-primary" />
                            Traffic overview
                          </CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Visitor flow snapshot for {SITE_LOCATION}.
                          </p>
                        </div>
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                          Live
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <div className="flex h-40 items-end gap-2">
                        {[40, 65, 80, 45, 90, 30, 50, 60, 40, 75, 85, 55].map((h, i) => (
                          <div
                            key={i}
                            className="relative flex-1 overflow-hidden rounded-t-lg bg-muted"
                            aria-hidden
                          >
                            <div
                              className="absolute bottom-0 w-full rounded-t-lg bg-primary/80 transition-all"
                              style={{ height: `${h}%` }}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        <span>00:00</span>
                        <span>06:00</span>
                        <span>12:00</span>
                        <span>18:00</span>
                        <span>23:59</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="overflow-hidden border-0 bg-slate-900 text-white">
                    <CardContent className="space-y-5 p-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5 text-primary" />
                          <p className="text-base font-bold">Trust hub</p>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          Security governance
                        </p>
                      </div>
                      {[
                        { label: "Encryption", value: "AES-256", color: "bg-emerald-500" },
                        { label: "PII masking", value: "Active", color: "bg-sky-500" },
                        { label: "Retention", value: "30 days", color: "bg-primary" },
                      ].map((row) => (
                        <div key={row.label}>
                          <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-200">
                            <span>{row.label}</span>
                            <span className="text-slate-100">{row.value}</span>
                          </div>
                          <div className="h-1 rounded-full bg-white/10">
                            <div className={`h-full w-full rounded-full ${row.color}`} />
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20"
                        onClick={() => {
                          exportMutation.mutate(visitors.length);
                          downloadVisitorsCsv(visitors);
                        }}
                        data-testid="button-export-evidence"
                      >
                        <Download className="h-4 w-4" />
                        Export SOC 2 evidence
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
                  <Card className="min-w-0">
                    <CardHeader className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Siren className="h-5 w-5 text-rose-600" />
                            Quick actions
                          </CardTitle>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Frequent operations for the reception team.
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-3 p-5 pt-0 md:grid-cols-2">
                      <button
                        onClick={() => setIsDialogOpen(true)}
                        className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-accent/30"
                        data-testid="button-quick-register"
                      >
                        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                          <UserPlus className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Register visitor</p>
                          <p className="text-xs text-muted-foreground">Pre-arrival check-in</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setSection("sms")}
                        className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-accent/30"
                        data-testid="button-quick-sms"
                      >
                        <div className="rounded-xl bg-sky-500/10 p-2.5 text-sky-700 dark:text-sky-300">
                          <MessageSquareText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Mass text</p>
                          <p className="text-xs text-muted-foreground">Notify on-site visitors</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setSection("documents")}
                        className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-accent/30"
                        data-testid="button-quick-docs"
                      >
                        <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-700 dark:text-emerald-300">
                          <FileSignature className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Documents</p>
                          <p className="text-xs text-muted-foreground">Add NDA / OSHA waiver</p>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          exportMutation.mutate(filteredVisitors.length);
                          downloadVisitorsCsv(filteredVisitors);
                        }}
                        className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left transition hover:border-primary/40 hover:bg-accent/30"
                        data-testid="button-quick-export"
                      >
                        <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-700 dark:text-amber-300">
                          <Download className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Export CSV</p>
                          <p className="text-xs text-muted-foreground">Audit-logged download</p>
                        </div>
                      </button>
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    <Card>
                      <CardHeader className="p-5">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <UserCheck className="h-5 w-5 text-emerald-600" />
                          Active visitors
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">People currently on site.</p>
                      </CardHeader>
                      <CardContent className="space-y-3 p-5 pt-0">
                        {activeVisitors.length === 0 ? (
                          <p
                            className="rounded-lg bg-muted p-4 text-sm text-muted-foreground"
                            data-testid="text-no-active-visitors"
                          >
                            No active guests right now.
                          </p>
                        ) : (
                          activeVisitors.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center gap-3 rounded-lg border border-border p-3"
                              data-testid={`card-active-${v.id}`}
                            >
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                {v.fullName
                                  .split(" ")
                                  .map((p) => p[0])
                                  .slice(0, 2)
                                  .join("")}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{v.fullName}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  Hosted by {v.hostName}
                                </p>
                              </div>
                              <Badge variant="outline">{v.badgeNumber || "No badge"}</Badge>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="p-5">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <CalendarClock className="h-5 w-5 text-amber-600" />
                          Next arrivals
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Upcoming guests to prepare for.</p>
                      </CardHeader>
                      <CardContent className="space-y-3 p-5 pt-0">
                        {nextArrivals.length === 0 ? (
                          <p
                            className="rounded-lg bg-muted p-4 text-sm text-muted-foreground"
                            data-testid="text-no-next-arrivals"
                          >
                            No scheduled arrivals are waiting.
                          </p>
                        ) : (
                          nextArrivals.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-start gap-3 rounded-lg border border-border p-3"
                              data-testid={`card-arrival-${v.id}`}
                            >
                              <div className="mt-0.5 rounded-md bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
                                <CalendarClock className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{v.fullName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatArrival(v.expectedArrival)} &middot; {v.hostName}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}

            {section === "visitors" && (
              <Card className="min-w-0">
                <CardHeader className="gap-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <ClipboardList className="h-5 w-5 text-primary" />
                        Visitor queue
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Search, filter, check in, and check out guests. Signed PDFs attach here.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        exportMutation.mutate(filteredVisitors.length);
                        downloadVisitorsCsv(filteredVisitors);
                      }}
                      data-testid="button-export-csv"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Search visitor, company, host, or purpose"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        data-testid="input-search-visitors"
                      />
                    </div>
                    <Select value={filter} onValueChange={(value) => setFilter(value as StatusFilter)}>
                      <SelectTrigger data-testid="select-status-filter">
                        <SelectValue placeholder="Filter status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="checked_in">Checked in</SelectItem>
                        <SelectItem value="checked_out">Checked out</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {visitorsQuery.isLoading ? (
                    <div className="p-5">
                      <SkeletonRows />
                    </div>
                  ) : filteredVisitors.length === 0 ? (
                    <div className="p-5">
                      <EmptyVisitors onNewVisitor={() => setIsDialogOpen(true)} />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Visitor</TableHead>
                          <TableHead>Host</TableHead>
                          <TableHead>Arrival</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Documents</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredVisitors.map((v) => (
                          <TableRow key={v.id} data-testid={`row-visitor-${v.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                  {v.fullName
                                    .split(" ")
                                    .map((p) => p[0])
                                    .slice(0, 2)
                                    .join("")}
                                </div>
                                <div>
                                  <div className="font-medium" data-testid={`text-visitor-name-${v.id}`}>
                                    {v.fullName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {v.company} &middot; {v.purpose}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{v.hostName}</div>
                              <div className="text-xs text-muted-foreground">{v.email}</div>
                            </TableCell>
                            <TableCell className="tabular-nums">{formatArrival(v.expectedArrival)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusTone(v.status)} data-testid={`status-visitor-${v.id}`}>
                                {statusLabels[v.status]}
                                {v.badgeNumber ? ` · ${v.badgeNumber}` : ""}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                {(signedDocumentsByVisitor[v.id] ?? []).length === 0 ? (
                                  <span
                                    className="text-xs text-muted-foreground"
                                    data-testid={`text-no-signed-docs-${v.id}`}
                                  >
                                    None
                                  </span>
                                ) : (
                                  signedDocumentsByVisitor[v.id].map((d) => (
                                    <a
                                      key={d.id}
                                      href={`${API_BASE}/api/signed-documents/${d.id}/pdf`}
                                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                                      data-testid={`link-signed-pdf-${d.id}`}
                                    >
                                      <Download className="h-3 w-3" />
                                      {d.documentKind.toUpperCase()}
                                    </a>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {v.status === "scheduled" && (
                                <Button
                                  size="sm"
                                  onClick={() => checkInMutation.mutate(v)}
                                  disabled={checkInMutation.isPending}
                                  data-testid={`button-check-in-${v.id}`}
                                >
                                  Check in
                                </Button>
                              )}
                              {v.status === "checked_in" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => checkOutMutation.mutate(v)}
                                  disabled={checkOutMutation.isPending}
                                  data-testid={`button-check-out-${v.id}`}
                                >
                                  Check out
                                </Button>
                              )}
                              {v.status === "checked_out" && (
                                <span
                                  className="inline-flex items-center gap-2 text-xs text-muted-foreground"
                                  data-testid={`text-complete-${v.id}`}
                                >
                                  <DoorOpen className="h-3.5 w-3.5" />
                                  Complete
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {section === "documents" && <DocumentAdmin documents={documents} />}

            {section === "sms" && <SmsCenter visitors={visitors} campaigns={campaigns} />}

            {section === "compliance" && <ComplianceCenter controls={controls} auditLogs={auditLogs} />}
          </section>
        </main>
      </div>
    </div>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={GuestCheckInPage} />
      <Route path="/admin" component={VisitorDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
