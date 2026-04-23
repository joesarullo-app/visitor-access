import { useEffect, useState } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ClipboardSignature,
  DoorOpen,
  Download,
  FileCheck2,
  FileText,
  LockKeyhole,
  MessageSquareText,
  Moon,
  Plus,
  RadioTower,
  Search,
  Send,
  ServerCog,
  ShieldCheck,
  Sun,
  UserCheck,
  UserCog,
  Users,
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

function VisitFlowLogo() {
  return (
    <svg
      aria-label="VisitFlow logo"
      viewBox="0 0 48 48"
      className="h-9 w-9 text-primary"
      fill="none"
    >
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
    scheduled: visitors.filter((visitor) => visitor.status === "scheduled").length,
    checkedIn: visitors.filter((visitor) => visitor.status === "checked_in").length,
    checkedOut: visitors.filter((visitor) => visitor.status === "checked_out").length,
  };
}

function complianceStats(controls: ComplianceControl[]) {
  const implemented = controls.filter((control) => control.status === "implemented").length;
  const score = controls.length === 0 ? 0 : Math.round((implemented / controls.length) * 100);

  return {
    implemented,
    total: controls.length,
    score,
  };
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
  const rows = visitors.map((visitor) => [
    visitor.fullName,
    visitor.company,
    visitor.email,
    visitor.phone,
    visitor.hostName,
    visitor.purpose,
    visitor.expectedArrival,
    statusLabels[visitor.status],
    visitor.badgeNumber,
    visitor.notes,
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-10 text-center" data-testid="empty-visitors">
      <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
        <ClipboardList className="h-7 w-7" />
      </div>
      <h3 className="text-base font-semibold">No visitors match this view</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Register the next guest or adjust your filters to see today’s visit queue.
      </p>
      <Button className="mt-5" onClick={onNewVisitor} data-testid="button-empty-register">
        Register visitor
      </Button>
    </div>
  );
}

function GuestCheckInPage() {
  const [theme, setTheme] = useState<Theme>("light");
  const [step, setStep] = useState<1 | 2 | 3>(1);

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
      form.setValue("acknowledgedTemplateIds", documents.map((document) => document.id));
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <VisitFlowLogo />
            <div>
              <div className="font-semibold">VisitFlow</div>
              <div className="text-xs text-muted-foreground">Guest check-in</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              data-testid="button-guest-toggle-theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href="/admin">
              <Button variant="outline" data-testid="link-admin-backend">Admin</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div>
            <Badge variant="outline" className="mb-3">Secure visitor kiosk</Badge>
            <h1 className="text-xl font-semibold tracking-tight">Welcome. Check in for your visit.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Enter your visit details, review required documents, sign once, and receive your check-in confirmation.
            </p>
          </div>

          <Card>
            <CardHeader className="p-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {step === 1 && "Step 1: Visit details"}
                  {step === 2 && "Step 2: Documents and signature"}
                  {step === 3 && "Check-in complete"}
                </CardTitle>
                <Badge variant="outline">{step}/3</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {step === 1 && (
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
                                {purposeOptions.map((purpose) => (
                                  <SelectItem key={purpose} value={purpose}>
                                    {purpose}
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
                      onClick={async () => {
                        const ok = await form.trigger(["fullName", "company", "email", "phone", "hostName", "purpose"]);
                        if (ok) setStep(2);
                      }}
                      data-testid="button-guest-next-documents"
                    >
                      Continue to documents
                    </Button>
                  </form>
                </Form>
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
                      ) : (
                        documents.map((document) => (
                          <div key={document.id} className="rounded-xl border border-border p-4" data-testid={`card-guest-document-${document.id}`}>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium">{document.name}</p>
                              </div>
                              <Badge variant="outline">{document.kind.toUpperCase()}</Badge>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">{document.body}</p>
                            <p className="mt-3 text-xs text-muted-foreground">Required for visitor entry.</p>
                          </div>
                        ))
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="signature"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Electronic signature</FormLabel>
                          <FormControl>
                            <Input placeholder="Type your full legal name" data-testid="input-guest-signature" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="rounded-lg border border-border bg-muted p-3 text-xs leading-5 text-muted-foreground">
                      By checking in, you acknowledge all listed visitor documents. Signed copies will be available in the admin visitor log.
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => setStep(1)} data-testid="button-guest-back-details">
                        Back
                      </Button>
                      <Button type="submit" disabled={checkInMutation.isPending} data-testid="button-guest-complete-checkin">
                        <ClipboardSignature className="h-4 w-4" />
                        {checkInMutation.isPending ? "Checking in..." : "Sign and check in"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}

              {step === 3 && (
                <div className="space-y-4" data-testid="status-guest-checkin-complete">
                  <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300 w-fit">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">You are checked in.</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Please wait for your host. Your signed documents have been attached to the visitor log.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-sm font-medium">Signed documents</p>
                    <div className="mt-3 grid gap-2">
                      {signedDocuments.map((document) => (
                        <a
                          key={document.id}
                          href={`${API_BASE}/api/signed-documents/${document.id}/pdf`}
                          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                          data-testid={`link-guest-signed-pdf-${document.id}`}
                        >
                          <Download className="h-4 w-4" />
                          {document.documentName} PDF
                        </a>
                      ))}
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
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Secure by default
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Every completed check-in creates audit evidence, signed document records, and a badge-ready visitor entry.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-medium">Required documents</p>
              <p className="mt-2 text-xl font-semibold tabular-nums" data-testid="text-guest-document-count">{documents.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">NDA, OSHA waiver, and any active admin templates.</p>
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
                    {purposeOptions.map((purpose) => (
                      <SelectItem key={purpose} value={purpose}>
                        {purpose}
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
                <Textarea placeholder="Parking, NDA, floor, or accessibility notes" data-testid="textarea-notes" {...field} value={field.value || ""} />
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
      message: "VisitFlow update: Please check in at the front desk when you arrive. Reply STOP to opt out.",
    },
  });

  const selectedAudience = form.watch("audience");
  const selectedMessage = form.watch("message") ?? "";
  const estimatedAudience =
    selectedAudience === "all"
      ? visitors
      : visitors.filter((visitor) => visitor.status === selectedAudience);
  const estimatedDeliverable = estimatedAudience.filter((visitor) => {
    const normalizedPhone = visitor.phone.replace(/\D/g, "");
    const notes = visitor.notes?.toLowerCase() ?? "";
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
              SMS is in simulation mode. A real provider should enforce consent, opt-out handling,
              rate limits, quiet hours, and delivery webhooks before production sends.
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
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300" data-testid="status-sms-simulated">
            Simulated send complete: {createCampaignMutation.data.deliveredCount} deliverable,
            {" "}{createCampaignMutation.data.blockedCount} blocked by safeguards.
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

function SmsCenter({
  visitors,
  campaigns,
}: {
  visitors: Visitor[];
  campaigns: SmsCampaign[];
}) {
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
              Connect Twilio, Telnyx, or Plivo server-side. Store provider message IDs, ingest delivery
              receipts, and process STOP/START webhooks before enabling live sends.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent campaigns</p>
            {campaigns.length === 0 ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground" data-testid="text-no-sms-campaigns">
                No SMS simulations yet.
              </p>
            ) : (
              campaigns.slice(0, 4).map((campaign) => (
                <div key={campaign.id} className="rounded-lg border border-border p-3" data-testid={`card-sms-campaign-${campaign.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{campaign.name}</p>
                    <Badge variant="outline">{campaign.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {audienceLabels[campaign.audience as CreateSmsCampaign["audience"]]} · {campaign.deliveredCount} deliverable · {campaign.blockedCount} blocked
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
          {controls.map((control) => (
            <div key={control.id} className="rounded-xl border border-border p-4" data-testid={`card-control-${control.controlId}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{control.controlId}</Badge>
                    <span className="text-xs text-muted-foreground">{control.category}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{control.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{control.description}</p>
                </div>
                <Badge variant="outline" className={complianceTone(control.status)}>
                  {complianceStatusLabels[control.status]}
                </Badge>
              </div>
              <div className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                Evidence: {control.evidence}
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
            <CardTitle className="text-lg">Recent audit activity</CardTitle>
            <p className="text-sm text-muted-foreground">Latest evidence-generating events.</p>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {auditLogs.length === 0 ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground" data-testid="text-no-audit-logs">
                No audit events yet.
              </p>
            ) : (
              auditLogs.slice(0, 6).map((log) => (
                <div key={log.id} className="rounded-lg border border-border p-3" data-testid={`card-audit-log-${log.id}`}>
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
      body: "Visitor acknowledges that they will follow all posted safety instructions, remain with their host in controlled areas, and report hazards, injuries, or unsafe conditions immediately.",
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
              <FileText className="h-5 w-5 text-primary" />
              Admin document manager
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Add required NDAs, OSHA waivers, safety policies, and visitor acknowledgments.
            </p>
          </div>
          <Badge variant="outline">{documents.filter((document) => document.active).length} active</Badge>
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
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300" data-testid="status-document-created">
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
            documents.slice(0, 8).map((document) => (
              <div key={document.id} className="rounded-lg border border-border p-3" data-testid={`card-document-template-${document.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{document.name}</p>
                  <Badge variant="outline">{document.kind.toUpperCase()}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{document.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{document.active ? "Active in guest check-in" : "Inactive"}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VisitorDashboard() {
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const visitorsQuery = useQuery<Visitor[]>({
    queryKey: ["/api/visitors"],
  });

  const controlsQuery = useQuery<ComplianceControl[]>({
    queryKey: ["/api/compliance-controls"],
  });

  const auditLogsQuery = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  const campaignsQuery = useQuery<SmsCampaign[]>({
    queryKey: ["/api/sms-campaigns"],
  });

  const documentsQuery = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });

  const signedDocumentsQuery = useQuery<SignedDocument[]>({
    queryKey: ["/api/signed-documents"],
  });

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
  const activeVisitors = visitors.filter((visitor) => visitor.status === "checked_in");
  const nextArrivals = visitors
    .filter((visitor) => visitor.status === "scheduled")
    .slice()
    .sort((a, b) => new Date(a.expectedArrival).getTime() - new Date(b.expectedArrival).getTime())
    .slice(0, 3);

  const filteredVisitors = visitors.filter((visitor) => {
    const searchText = `${visitor.fullName} ${visitor.company} ${visitor.hostName} ${visitor.purpose}`.toLowerCase();
    const matchesSearch = searchText.includes(search.toLowerCase());
    const matchesFilter = filter === "all" || visitor.status === filter;
    return matchesSearch && matchesFilter;
  });

  const signedDocumentsByVisitor = signedDocuments.reduce<Record<number, SignedDocument[]>>((acc, document) => {
    acc[document.visitorId] = [...(acc[document.visitorId] ?? []), document];
    return acc;
  }, {});

  const statCards = [
    { label: "Today’s visitors", value: stats.total, icon: Users, hint: "Registered guests" },
    { label: "Expected", value: stats.scheduled, icon: CalendarClock, hint: "Waiting to arrive" },
    { label: "On site", value: stats.checkedIn, icon: UserCheck, hint: "Currently checked in" },
    { label: "Completed", value: stats.checkedOut, icon: CheckCircle2, hint: "Checked out" },
    { label: "SOC 2 controls", value: `${soc2Stats.implemented}/${soc2Stats.total}`, icon: ShieldCheck, hint: "Readiness evidence" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[272px_1fr]">
        <aside className="hidden border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground lg:flex lg:flex-col" aria-label="Primary navigation">
          <div className="flex items-center gap-3">
            <VisitFlowLogo />
            <div>
              <div className="font-semibold leading-tight">VisitFlow</div>
              <div className="text-xs text-sidebar-foreground/65">Admin backend</div>
            </div>
          </div>
          <nav className="mt-8 grid gap-1 text-sm">
            {[
              { label: "Guest kiosk", icon: ClipboardSignature },
              { label: "Lobby dashboard", icon: ClipboardList, active: true },
              { label: "Mass texting", icon: MessageSquareText },
              { label: "Documents", icon: FileText },
              { label: "SOC 2 center", icon: ShieldCheck },
              { label: "Badge log", icon: BadgeCheck },
              { label: "Hosts", icon: Building2 },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  if (item.label === "Guest kiosk") {
                    window.location.hash = "/";
                  }
                }}
                className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-left transition ${
                  item.active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
                data-testid={`button-nav-${item.label.toLowerCase().replaceAll(" ", "-")}`}
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
              Guest records are persisted in the app database and ready for access-control integrations.
            </p>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-border bg-background/88 px-4 py-3 backdrop-blur md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 lg:hidden">
                <VisitFlowLogo />
                <div>
                  <div className="font-semibold">VisitFlow</div>
                  <div className="text-xs text-muted-foreground">Front desk control</div>
                </div>
              </div>
              <div className="hidden lg:block">
                <h1 className="text-xl font-semibold tracking-tight">Lobby dashboard</h1>
                <p className="text-sm text-muted-foreground">Admin backend for visitor logs, documents, and compliance evidence.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="View alerts" data-testid="button-alerts">
                  <Bell className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Toggle theme"
                  onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
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
          </header>

          <section className="space-y-6 p-4 md:p-8" aria-label="Visitor management workspace">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {statCards.map((stat) => (
                <Card key={stat.label} className="overflow-hidden" data-testid={`card-stat-${stat.label.toLowerCase().replaceAll(" ", "-").replace("’", "")}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="mt-2 text-xl font-semibold tabular-nums" data-testid={`text-stat-${stat.label.toLowerCase().replaceAll(" ", "-").replace("’", "")}`}>
                          {stat.value}
                        </p>
                      </div>
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <stat.icon className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">{stat.hint}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <Card className="min-w-0">
                <CardHeader className="gap-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">Visitor queue</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">Search, filter, check in, and check out guests.</p>
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
                        onChange={(event) => setSearch(event.target.value)}
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
                        {filteredVisitors.map((visitor) => (
                          <TableRow key={visitor.id} data-testid={`row-visitor-${visitor.id}`}>
                            <TableCell>
                              <div className="font-medium" data-testid={`text-visitor-name-${visitor.id}`}>
                                {visitor.fullName}
                              </div>
                              <div className="text-xs text-muted-foreground">{visitor.company} · {visitor.purpose}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{visitor.hostName}</div>
                              <div className="text-xs text-muted-foreground">{visitor.email}</div>
                            </TableCell>
                            <TableCell className="tabular-nums">{formatArrival(visitor.expectedArrival)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusTone(visitor.status)} data-testid={`status-visitor-${visitor.id}`}>
                                {statusLabels[visitor.status]}
                                {visitor.badgeNumber ? ` · ${visitor.badgeNumber}` : ""}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                {(signedDocumentsByVisitor[visitor.id] ?? []).length === 0 ? (
                                  <span className="text-xs text-muted-foreground" data-testid={`text-no-signed-docs-${visitor.id}`}>None</span>
                                ) : (
                                  signedDocumentsByVisitor[visitor.id].map((document) => (
                                    <a
                                      key={document.id}
                                      href={`${API_BASE}/api/signed-documents/${document.id}/pdf`}
                                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                                      data-testid={`link-signed-pdf-${document.id}`}
                                    >
                                      <Download className="h-3 w-3" />
                                      {document.documentKind.toUpperCase()}
                                    </a>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {visitor.status === "scheduled" && (
                                <Button
                                  size="sm"
                                  onClick={() => checkInMutation.mutate(visitor)}
                                  disabled={checkInMutation.isPending}
                                  data-testid={`button-check-in-${visitor.id}`}
                                >
                                  Check in
                                </Button>
                              )}
                              {visitor.status === "checked_in" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => checkOutMutation.mutate(visitor)}
                                  disabled={checkOutMutation.isPending}
                                  data-testid={`button-check-out-${visitor.id}`}
                                >
                                  Check out
                                </Button>
                              )}
                              {visitor.status === "checked_out" && (
                                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" data-testid={`text-complete-${visitor.id}`}>
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

              <div className="space-y-6">
                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="text-lg">Active visitors</CardTitle>
                    <p className="text-sm text-muted-foreground">People currently on site.</p>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5 pt-0">
                    {activeVisitors.length === 0 ? (
                      <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground" data-testid="text-no-active-visitors">
                        No active guests right now.
                      </p>
                    ) : (
                      activeVisitors.map((visitor) => (
                        <div key={visitor.id} className="rounded-lg border border-border p-3" data-testid={`card-active-${visitor.id}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{visitor.fullName}</p>
                              <p className="text-xs text-muted-foreground">Hosted by {visitor.hostName}</p>
                            </div>
                            <Badge variant="outline">{visitor.badgeNumber || "No badge"}</Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-5">
                    <CardTitle className="text-lg">Next arrivals</CardTitle>
                    <p className="text-sm text-muted-foreground">Upcoming guests to prepare for.</p>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5 pt-0">
                    {nextArrivals.length === 0 ? (
                      <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground" data-testid="text-no-next-arrivals">
                        No scheduled arrivals are waiting.
                      </p>
                    ) : (
                      nextArrivals.map((visitor) => (
                        <div key={visitor.id} className="flex items-start gap-3 rounded-lg border border-border p-3" data-testid={`card-arrival-${visitor.id}`}>
                          <div className="mt-0.5 rounded-md bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
                            <CalendarClock className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{visitor.fullName}</p>
                            <p className="text-xs text-muted-foreground">{formatArrival(visitor.expectedArrival)} · {visitor.hostName}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <DocumentAdmin documents={documents} />

            <SmsCenter visitors={visitors} campaigns={campaigns} />

            <ComplianceCenter controls={controls} auditLogs={auditLogs} />
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
