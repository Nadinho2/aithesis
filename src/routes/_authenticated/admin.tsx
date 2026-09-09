import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, Fragment } from "react";
import { adminListLimits, updateUserLimits } from "@/lib/admin-limits.functions";
import { adminListTransactions, adminListUniversitySubmissions, adminMarkUniversityDone, adminGetSettings, adminUpdateSettings, adminBulkSetCredits, adminListNotifications, adminDeleteNotification, adminListRoles, adminSetRole } from "@/lib/admin.functions";
import { adminListReferralApplications, adminReviewReferralApplication, adminListReferralCodes, adminSetCodeType } from "@/lib/referral.functions";
import { adminImportPastQuestions, adminImportPastQuestionsCsv } from "@/lib/past-questions.functions";
import { listUniversities, adminAddUniversity, adminDeleteUniversity, adminAddFaculty, adminDeleteFaculty, adminAddDepartment, adminDeleteDepartment, adminImportUniversitiesCsv } from "@/lib/universities.functions";
import {
  adminListMentorApplications,
  adminReviewMentor,
  type MentorCard,
} from "@/lib/mentorship.functions";
import { Loader2, Shield, Save, X, Search, CheckCircle, XCircle, Clock, University, ExternalLink, DollarSign, ToggleLeft, Users, Gift, Mail, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [tab, setTab] = useState<"limits" | "transactions" | "university" | "pricing" | "tools" | "credits" | "referral" | "waitlist" | "questions" | "directory" | "roles" | "mentors">("limits");
  const [txSearchEmail, setTxSearchEmail] = useState("");
  const qc = useQueryClient();
  const fn = useServerFn(adminListLimits);
  const up = useServerFn(updateUserLimits);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-limits"],
    queryFn: () => fn(),
  });

  const mut = useMutation({
      mutationFn: (v: {
        user_id: string;
        thesis_available_ug: number;
        thesis_available_masters: number;
        thesis_available_phd: number;
        proposal_limit: number;
        assignment_available: number;
        exam_available: number;
        presentation_available: number;
        cv_available: number;
        seminar_available: number;
        chat_available: number;
        assessment_available: number;
      }) => up({ data: v }),
    onSuccess: () => {
      toast.success("Limits saved");
      qc.invalidateQueries({ queryKey: ["admin-limits"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    thesis_available_ug: 0,
    thesis_available_masters: 0,
    thesis_available_phd: 0,
    proposal_limit: 0,
    assignment_available: 0,
    exam_available: 0,
    presentation_available: 0,
    cv_available: 0,
    seminar_available: 0,
    chat_available: 0,
    assessment_available: 0,
  });

  function startEdit(user: NonNullable<typeof data>[number]) {
    setEditId(user.user_id);
    setForm({
      thesis_available_ug: user.thesis_available_ug,
      thesis_available_masters: user.thesis_available_masters,
      thesis_available_phd: user.thesis_available_phd,
      proposal_limit: user.proposal_limit,
      assignment_available: user.assignment_available ?? 0,
      exam_available: user.exam_available ?? 0,
      presentation_available: user.presentation_available ?? 0,
      cv_available: user.cv_available ?? 0,
      seminar_available: user.seminar_available ?? 0,
      chat_available: (user as any).chat_available ?? 0,
      assessment_available: (user as any).assessment_available ?? 0,
    });
  }

  function save() {
    if (!editId) return;
    mut.mutate({ user_id: editId, ...form });
    setEditId(null);
  }

  if (error) {
    return (
      <div className="min-h-screen bg-paper text-ink font-sans p-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="size-5 text-red" />
            <h1 className="font-serif text-2xl">Access Denied</h1>
          </div>
          <p className="text-ink/60">You do not have admin privileges.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-sans p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="size-5 text-verde" />
          <h1 className="font-serif text-2xl sm:text-3xl">Admin</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-ink/10 mb-6 overflow-x-auto">
          <TabBtn tab="limits" active={tab} onClick={() => setTab("limits")} label="Usage Limits" />
          <TabBtn tab="transactions" active={tab} onClick={() => setTab("transactions")} label="Transactions" />
          <TabBtn tab="university" active={tab} onClick={() => setTab("university")} label="University" />
          <TabBtn tab="pricing" active={tab} onClick={() => setTab("pricing")} label="Pricing" />
          <TabBtn tab="tools" active={tab} onClick={() => setTab("tools")} label="Tools" />
          <TabBtn tab="credits" active={tab} onClick={() => setTab("credits")} label="Bulk Credits" />
          <TabBtn tab="referral" active={tab} onClick={() => setTab("referral")} label="Referral" />
          <TabBtn tab="waitlist" active={tab} onClick={() => setTab("waitlist")} label="Waitlist" />
          <TabBtn tab="questions" active={tab} onClick={() => setTab("questions")} label="Question Bank" />
          <TabBtn tab="directory" active={tab} onClick={() => setTab("directory")} label="Directory" />
          <TabBtn tab="roles" active={tab} onClick={() => setTab("roles")} label="Roles" />
          <TabBtn tab="mentors" active={tab} onClick={() => setTab("mentors")} label="Mentors" />
        </div>

        {tab === "limits" && (
          <>
            <p className="text-ink-secondary max-w-xl text-sm mb-8">
              Manage draft limits for all users. Each user gets defaults of 0 thesis and 0 proposal drafts — they purchase credits separately.
            </p>

            {isLoading && (
              <div className="flex items-center gap-3 text-ink/60">
                <Loader2 className="size-5 animate-spin" /> Loading users…
              </div>
            )}

            {!isLoading && error && (
              <div className="text-sm text-ink/60">
                <p className="text-red mb-2">Access Denied — You do not have admin privileges.</p>
              </div>
            )}

            {!isLoading && data && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-ink/10">
                      <th className="text-left py-3 pr-4 font-medium">User</th>
                      <th className="text-center py-3 px-1 font-medium text-[11px]">UG</th>
                      <th className="text-center py-3 px-1 font-medium text-[11px]">Masters</th>
                      <th className="text-center py-3 px-1 font-medium text-[11px]">PhD</th>
                      <th className="text-center py-3 px-1 font-medium text-[11px]">Proposal</th>
                      <th className="text-center py-3 px-1 font-medium text-[11px]">Assgn</th>
                      <th className="text-center py-3 px-1 font-medium text-[11px]">Exam</th>
                      <th className="text-center py-3 px-1 font-medium text-[11px]">Pres</th>
                      <th className="text-center py-3 px-1 font-medium text-[11px]">CV</th>
                      <th className="text-center py-3 px-1 font-medium text-[11px]">Sem</th>
                      <th className="text-center py-3 px-1 font-medium text-[11px]">Chat</th>
                      <th className="text-center py-3 px-1 font-medium text-[11px]">Asmt</th>
                      <th className="text-right py-3 pl-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((user) => {
                      const isEditing = editId === user.user_id;
                      return (
                        <tr key={user.user_id} className="border-b border-ink/5 hover:bg-ink/[0.02]">
                          <td className="py-3 pr-4">
                            <button
                              onClick={() => {
                                if (user.email) {
                                  setTxSearchEmail(user.email);
                                  setTab("transactions");
                                }
                              }}
                              className="text-xs font-mono text-ink/60 hover:text-verde transition-colors text-left"
                              title="View transactions for this user"
                            >
                              {user.email ?? user.user_id.slice(0, 12)}
                            </button>
                          </td>
                          <td className="py-3 px-2 text-center">
                            {isEditing ? (
                              <Input
                                value={form.thesis_available_ug}
                                onChange={(v) => setForm({ ...form, thesis_available_ug: v })}
                              />
                            ) : (
                              <span>{user.thesis_available_ug}</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {isEditing ? (
                              <Input
                                value={form.thesis_available_masters}
                                onChange={(v) => setForm({ ...form, thesis_available_masters: v })}
                              />
                            ) : (
                              <span>{user.thesis_available_masters}</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {isEditing ? (
                              <Input
                                value={form.thesis_available_phd}
                                onChange={(v) => setForm({ ...form, thesis_available_phd: v })}
                              />
                            ) : (
                              <span>{user.thesis_available_phd}</span>
                            )}
                          </td>
                          <td className="py-3 px-1 text-center">
                            {isEditing ? (
                              <Input value={form.proposal_limit} onChange={(v) => setForm({ ...form, proposal_limit: v })} />
                            ) : (
                              <span>{user.proposal_available ?? user.proposal_limit - user.proposal_used}</span>
                            )}
                          </td>
                          <td className="py-3 px-1 text-center">
                            {isEditing ? (
                              <Input value={form.assignment_available} onChange={(v) => setForm({ ...form, assignment_available: v })} />
                            ) : (
                              <span>{user.assignment_available ?? 0}</span>
                            )}
                          </td>
                          <td className="py-3 px-1 text-center">
                            {isEditing ? (
                              <Input value={form.exam_available} onChange={(v) => setForm({ ...form, exam_available: v })} />
                            ) : (
                              <span>{user.exam_available ?? 0}</span>
                            )}
                          </td>
                          <td className="py-3 px-1 text-center">
                            {isEditing ? (
                              <Input value={form.presentation_available} onChange={(v) => setForm({ ...form, presentation_available: v })} />
                            ) : (
                              <span>{user.presentation_available ?? 0}</span>
                            )}
                          </td>
                          <td className="py-3 px-1 text-center">
                            {isEditing ? (
                              <Input value={form.cv_available} onChange={(v) => setForm({ ...form, cv_available: v })} />
                            ) : (
                              <span>{user.cv_available ?? 0}</span>
                            )}
                          </td>
                          <td className="py-3 px-1 text-center">
                            {isEditing ? (
                              <Input value={form.seminar_available} onChange={(v) => setForm({ ...form, seminar_available: v })} />
                            ) : (
                              <span>{user.seminar_available ?? 0}</span>
                            )}
                          </td>
                          <td className="py-3 px-1 text-center">
                            {isEditing ? (
                              <Input value={form.chat_available} onChange={(v) => setForm({ ...form, chat_available: v })} />
                            ) : (
                              <span>{user.chat_available ?? 0}</span>
                            )}
                          </td>
                          <td className="py-3 px-1 text-center">
                            {isEditing ? (
                              <Input value={form.assessment_available} onChange={(v) => setForm({ ...form, assessment_available: v })} />
                            ) : (
                              <span>{(user as any).assessment_available ?? 0}</span>
                            )}
                          </td>
                          <td className="py-3 pl-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={save}
                                  className="p-1.5 rounded-sm bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                  title="Save"
                                >
                                  <Save className="size-4" />
                                </button>
                                <button
                                  onClick={() => setEditId(null)}
                                  className="p-1.5 rounded-sm bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                  title="Cancel"
                                >
                                  <X className="size-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => startEdit(user)}
                                className="text-xs font-medium text-verde hover:text-verde/70 transition-colors"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === "transactions" && <TransactionSearch initialSearch={txSearchEmail} />}
        {tab === "university" && <UniversitySubmissions />}
        {tab === "pricing" && <PricingManager />}
        {tab === "tools" && <ToolToggles />}
        {tab === "credits" && <BulkCredits />}
        {tab === "referral" && <ReferralTab />}
        {tab === "waitlist" && <WaitlistTab />}
        {tab === "questions" && <PastQuestionsAdmin />}
        {tab === "directory" && <UniversitiesAdmin />}
        {tab === "roles" && <RoleManager />}
        {tab === "mentors" && <MentorApplications />}
      </div>
    </div>
  );
}

function Input({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={999}
      value={value}
      onChange={(e) => onChange(Math.max(0, Math.min(999, parseInt(e.target.value) || 0)))}
      className="w-16 text-center border border-ink/20 rounded-sm px-1 py-0.5 text-xs bg-white"
    />
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-ink/40">{label}</dt>
      <dd className={`mt-0.5 text-ink/80 ${mono ? "font-mono text-xs break-all" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function UniversitySubmissions() {
  const listFn = useServerFn(adminListUniversitySubmissions);
  const markFn = useServerFn(adminMarkUniversityDone);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-university-submissions"],
    queryFn: () => listFn(),
  });

  const markMut = useMutation({
    mutationFn: (id: number) => markFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-university-submissions"] });
      toast.success("Marked as done");
    },
    onError: () => toast.error("Failed to update"),
  });

  return (
    <div>
      <p className="text-ink-secondary max-w-xl text-sm mb-6">
        University chapter structure submissions. Review and set up the correct chapter structure, then mark as done.
      </p>

      {isLoading && (
        <div className="flex items-center gap-3 text-ink/60">
          <Loader2 className="size-4 animate-spin" /> Loading submissions…
        </div>
      )}

      {data && data.length === 0 && <p className="text-sm text-ink/40">No submissions yet.</p>}

      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="text-left py-3 pr-3 font-medium">Date</th>
                <th className="text-left py-3 pr-3 font-medium">University</th>
                <th className="text-left py-3 pr-3 font-medium">Department</th>
                <th className="text-left py-3 pr-3 font-medium">Structure</th>
                <th className="text-left py-3 pr-3 font-medium">Email</th>
                <th className="text-center py-3 pr-3 font-medium">Status</th>
                <th className="text-right py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((sub: any) => (
                <tr key={sub.id} className="border-b border-ink/5 hover:bg-ink/[0.02]">
                  <td className="py-3 pr-3 text-xs text-ink/60 whitespace-nowrap">
                    {new Date(sub.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3 pr-3 font-medium">{sub.university_name}</td>
                  <td className="py-3 pr-3 text-ink/60">{sub.department}</td>
                  <td className="py-3 pr-3 text-xs text-ink/40 max-w-[200px] truncate" title={sub.chapter_structure}>
                    {sub.chapter_structure}
                  </td>
                  <td className="py-3 pr-3 text-sm">
                    {sub.email ? (
                      <a href={`mailto:${sub.email}`} className="text-verde hover:underline text-xs">
                        {sub.email}
                      </a>
                    ) : (
                      <span className="text-ink/30">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-center">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${
                      sub.status === "done" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                    }`}>
                      {sub.status === "done" ? "Done" : "Pending"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {sub.status !== "done" && (
                      <button
                        onClick={() => markMut.mutate(sub.id)}
                        disabled={markMut.isPending}
                        className="text-xs font-medium text-verde hover:text-verde/70 transition-colors disabled:opacity-50"
                      >
                        Mark Done
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TransactionSearch({ initialSearch = "" }: { initialSearch?: string }) {
  const txnFn = useServerFn(adminListTransactions);
  const [searchEmail, setSearchEmail] = useState(initialSearch);
  const [txData, setTxData] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSearch(email?: string) {
    const query = email ?? searchEmail;
    if (!query.trim()) return;
    setSearching(true);
    try {
      const result = await txnFn({ data: { search: query.trim() } });
      setTxData(result);
    } catch {
      toast.error("Failed to load transactions");
      setTxData([]);
    } finally {
      setSearching(false);
    }
  }

  // Auto-search when initialSearch changes externally (e.g. clicking a user in limits table)
  useEffect(() => {
    if (initialSearch) {
      setSearchEmail(initialSearch);
      handleSearch(initialSearch);
    }
  }, [initialSearch]);

  return (
    <div>
      <p className="text-ink-secondary max-w-xl text-sm mb-6">
        Look up payment history for a user. Enter their email address or user ID.
      </p>

      <div className="flex items-center gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink/40" />
          <input
            type="text"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by email or user ID\u2026"
            className="w-full pl-9 pr-3 py-2 text-sm border border-ink/20 rounded-sm bg-white focus:outline-none focus:border-verde/50"
          />
        </div>
        <button
          onClick={() => handleSearch()}
          disabled={searching || !searchEmail.trim()}
          className="px-4 py-2 text-sm font-medium bg-verde text-white rounded-sm hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {searching ? <Loader2 className="size-4 animate-spin" /> : "Search"}
        </button>
      </div>

      {txData !== null && txData.length === 0 && (
        <p className="text-sm text-ink/40">No transactions found for this user.</p>
      )}

      {txData && txData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="text-left py-3 pr-3 font-medium">Date</th>
                <th className="text-left py-3 pr-3 font-medium">Product</th>
                <th className="text-left py-3 pr-3 font-medium">Level</th>
                <th className="text-right py-3 pr-3 font-medium">Amount</th>
                <th className="text-center py-3 pr-3 font-medium">Status</th>
                <th className="text-center py-3 pr-3 font-medium">Used</th>
                <th className="text-left py-3 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {txData.map((tx: any, i: number) => (
                <tr key={tx.id ?? i} className="border-b border-ink/5 hover:bg-ink/[0.02]">
                  <td className="py-3 pr-3 text-xs text-ink/60 whitespace-nowrap">
                    {new Date(tx.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3 pr-3 capitalize">{tx.product}</td>
                  <td className="py-3 pr-3 text-xs text-ink/60">{tx.level ?? "\u2014"}</td>
                  <td className="py-3 pr-3 text-right font-medium">&#x20A6;{tx.amount?.toLocaleString() ?? "\u2014"}</td>
                  <td className="py-3 pr-3 text-center">
                    {tx.status === "completed" ? (
                      <CheckCircle className="size-4 text-green-500 inline" />
                    ) : tx.status === "failed" ? (
                      <XCircle className="size-4 text-red-400 inline" />
                    ) : (
                      <Clock className="size-4 text-amber-400 inline" />
                    )}
                  </td>
                  <td className="py-3 pr-3 text-center">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${tx.used ? "bg-ink/5 text-ink/40" : "bg-green-50 text-green-600"}`}>
                      {tx.used ? "Used" : "Available"}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-[10px] text-ink/40">{tx.reference?.slice(0, 16)}\u2026</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Pricing Manager
// ═══════════════════════════════════════════════════════════

function PricingManager() {
  const getFn = useServerFn(adminGetSettings);
  const updateFn = useServerFn(adminUpdateSettings);
  const qc = useQueryClient();

  const { data: allSettings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => getFn(),
  });

  const settingsMap = new Map<string, any>();
  if (allSettings) {
    for (const s of allSettings) settingsMap.set(s.key, s.value);
  }

  const [edit, setEdit] = useState<Record<string, number>>({});

  const products = [
    { key: "price:proposal", label: "Research Proposal" },
    { key: "price:thesis:undergraduate", label: "Undergraduate Thesis" },
    { key: "price:thesis:masters", label: "Masters Thesis" },
    { key: "price:thesis:phd", label: "PhD Thesis" },
    { key: "price:assignment", label: "Assignment Assistant" },
    { key: "price:exam", label: "Exam Preparation" },
    { key: "price:presentation", label: "Presentation Assistant" },
    { key: "price:cv", label: "CV Maker" },
    { key: "price:seminar_journal", label: "Journal / Conference Paper" },
    { key: "price:seminar_departmental", label: "Departmental Seminar" },
    { key: "price:seminar_postgraduate", label: "Postgraduate Seminar" },
    { key: "price:seminar_technical", label: "Technical / Engineering Seminar" },
    { key: "price:seminar_book_review", label: "Book Review Seminar" },
    { key: "price:custom_analysis", label: "Assessment" },
  ];

  useEffect(() => {
    const e: Record<string, number> = {};
    for (const p of products) {
      const s = settingsMap.get(p.key);
      e[p.key] = s?.price ?? 0;
    }
    setEdit(e);
  }, [allSettings]);

  const mut = useMutation({
    mutationFn: (updates: { key: string; value: any }[]) =>
      updateFn({ data: { settings: updates } }),
    onSuccess: () => {
      toast.success("Prices saved");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: any) => toast.error(String(e)),
  });

  function saveAll() {
    const updates = products.map((p) => ({
      key: p.key,
      value: { label: p.label, price: edit[p.key] ?? 0, currency: "NGN" },
    }));
    mut.mutate(updates);
  }

  if (isLoading) return <Loader2 className="size-5 animate-spin text-ink/60" />;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="size-4 text-verde" />
        <p className="text-ink-secondary text-sm">
          Set prices for all services. Changes take effect immediately for new purchases.
        </p>
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="w-full max-w-lg text-sm border-collapse">
          <thead>
            <tr className="border-b border-ink/10">
              <th className="text-left py-3 pr-3 font-medium">Product</th>
              <th className="text-right py-3 font-medium">Price (₦)</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.key} className="border-b border-ink/5">
                <td className="py-2.5 pr-3">{p.label}</td>
                <td className="py-2.5 text-right">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={edit[p.key] ?? 0}
                    onChange={(e) => setEdit({ ...edit, [p.key]: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-28 text-right border border-ink/20 rounded-sm px-2 py-1 text-xs bg-white"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={saveAll}
        disabled={mut.isPending}
        className="mt-4 px-4 py-2 text-sm font-medium bg-verde text-white rounded-sm hover:opacity-90 disabled:opacity-50 transition-all"
      >
        {mut.isPending ? <Loader2 className="size-4 animate-spin inline mr-1" /> : <Save className="size-4 inline mr-1" />}
        Save All Prices
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tool Enable / Disable Toggles
// ═══════════════════════════════════════════════════════════

function ToolToggles() {
  const getFn = useServerFn(adminGetSettings);
  const updateFn = useServerFn(adminUpdateSettings);
  const qc = useQueryClient();

  const { data: allSettings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => getFn(),
  });

  const settingsMap = new Map<string, any>();
  if (allSettings) {
    for (const s of allSettings) settingsMap.set(s.key, s.value);
  }

  const tools = [
    { key: "tool:topics:enabled", label: "Topic Discovery" },
    { key: "tool:proposal:enabled", label: "Research Proposal" },
    { key: "tool:thesis:enabled", label: "Thesis" },
    { key: "tool:assignment:enabled", label: "Assignment Assistant" },
    { key: "tool:exam:enabled", label: "Exam Preparation" },
    { key: "tool:presentation:enabled", label: "Presentation" },
    { key: "tool:cv:enabled", label: "CV Maker" },
    { key: "tool:seminar:enabled", label: "Seminar" },
    { key: "tool:custom_analysis:enabled", label: "Assessment" },
  ];

  const mut = useMutation({
    mutationFn: (updates: { key: string; value: any }[]) =>
      updateFn({ data: { settings: updates } }),
    onSuccess: () => {
      toast.success("Tool status updated");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: any) => toast.error(String(e)),
  });

  function toggleTool(key: string) {
    const current = settingsMap.get(key);
    const enabled = current === true || current === "true";
    mut.mutate([{ key, value: !enabled }]);
  }

  if (isLoading) return <Loader2 className="size-5 animate-spin text-ink/60" />;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <ToggleLeft className="size-4 text-verde" />
        <p className="text-ink-secondary text-sm">
          Enable or disable tools. Disabled tools show "Coming Soon" to users.
        </p>
      </div>

      <div className="space-y-2 mt-4 max-w-md">
        {tools.map((t) => {
          const enabled = settingsMap.get(t.key) === true || settingsMap.get(t.key) === "true";
          return (
            <div key={t.key} className="flex items-center justify-between py-2.5 px-3 border border-ink/10 rounded-sm">
              <span className="text-sm">{t.label}</span>
              <button
                onClick={() => toggleTool(t.key)}
                className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? "bg-verde" : "bg-ink/20"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Bulk Credit Assignment
// ═══════════════════════════════════════════════════════════

function BulkCredits() {
  const bulkFn = useServerFn(adminBulkSetCredits);

  const [emails, setEmails] = useState("");
  const [credits, setCredits] = useState({
    thesis_ug: 0, thesis_masters: 0, thesis_phd: 0,
    proposal: 0, assignment: 0, exam: 0,
    presentation: 0, cv: 0, seminar: 0, assessment: 0,
  });

  const mut = useMutation({
    mutationFn: (v: any) => bulkFn({ data: v }),
    onSuccess: (result: any) => {
      toast.success(`Credits assigned: ${result.ok} users updated, ${result.skipped} skipped, ${result.notFound} not found`);
    },
    onError: (e: any) => toast.error(String(e)),
  });

  function handleSubmit() {
    const emailList = emails.split(/[\n,]+/).map((e) => e.trim()).filter(Boolean);
    if (emailList.length === 0) return toast.error("Enter at least one email");
    mut.mutate({ emails: emailList, ...credits });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Users className="size-4 text-verde" />
        <p className="text-ink-secondary text-sm">
          Assign credits to multiple users at once. Paste emails separated by commas or newlines.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mt-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 block mb-1">Email Addresses</label>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="user1@uni.edu, user2@uni.edu"
            className="w-full h-32 border border-ink/20 rounded-sm px-3 py-2 text-sm bg-white"
          />
        </div>
        <div className="space-y-3">
          {[
            ["thesis_ug", "Thesis — Undergraduate"],
            ["thesis_masters", "Thesis — Masters"],
            ["thesis_phd", "Thesis — PhD"],
            ["proposal", "Research Proposal"],
            ["assignment", "Assignment"],
            ["exam", "Exam Preparation"],
            ["presentation", "Presentation"],
            ["cv", "CV Maker"],
            ["seminar", "Seminar"],
            ["assessment", "Assessment"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-xs text-ink/60">{label}</label>
              <input
                type="number"
                min={0}
                max={999}
                value={(credits as any)[key]}
                onChange={(e) => setCredits({ ...credits, [key]: Math.max(0, Math.min(999, parseInt(e.target.value) || 0)) })}
                className="w-20 text-center border border-ink/20 rounded-sm px-1 py-0.5 text-xs bg-white"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={mut.isPending}
        className="mt-4 px-4 py-2 text-sm font-medium bg-verde text-white rounded-sm hover:opacity-90 disabled:opacity-50 transition-all"
      >
        {mut.isPending ? <Loader2 className="size-4 animate-spin inline mr-1" /> : null}
        Assign Credits
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Referral — Coming Soon
// ═══════════════════════════════════════════════════════════

function ReferralTab() {
  const getFn = useServerFn(adminGetSettings);
  const updateFn = useServerFn(adminUpdateSettings);
  const listAppsFn = useServerFn(adminListReferralApplications);
  const reviewFn = useServerFn(adminReviewReferralApplication);
  const listCodesFn = useServerFn(adminListReferralCodes);
  const setCodeTypeFn = useServerFn(adminSetCodeType);
  const qc = useQueryClient();

  const [newUserId, setNewUserId] = useState("");
  const [newCodeType, setNewCodeType] = useState<"standard" | "ambassador" | "influencer">("ambassador");
  const [newCustomCode, setNewCustomCode] = useState("");
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);

  const { data: allSettings, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => getFn(),
  });

  const settingsMap = new Map<string, any>();
  if (allSettings) {
    for (const s of allSettings) settingsMap.set(s.key, s.value);
  }

  const enabled = settingsMap.get("tool:referral:enabled") === true || settingsMap.get("tool:referral:enabled") === "true";

  const mut = useMutation({
    mutationFn: (updates: { key: string; value: any }[]) =>
      updateFn({ data: { settings: updates } }),
    onSuccess: () => {
      toast.success("Referral setting updated");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: any) => toast.error(String(e)),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ["admin-referral-applications"],
    queryFn: () => listAppsFn(),
  });

  const { data: codes = [] } = useQuery({
    queryKey: ["admin-referral-codes"],
    queryFn: () => listCodesFn(),
  });

  const reviewMut = useMutation({
    mutationFn: (v: { applicationId: string; action: "approve" | "reject" }) =>
      reviewFn({ data: v }),
    onSuccess: () => {
      toast.success("Application updated");
      qc.invalidateQueries({ queryKey: ["admin-referral-applications"] });
      qc.invalidateQueries({ queryKey: ["admin-referral-codes"] });
    },
    onError: (e: any) => toast.error(String(e)),
  });

  const assignMut = useMutation({
    mutationFn: (v: { userId: string; codeType: "standard" | "ambassador" | "influencer"; customCode?: string }) =>
      setCodeTypeFn({ data: v }),
    onSuccess: () => {
      toast.success("Code assigned");
      qc.invalidateQueries({ queryKey: ["admin-referral-codes"] });
      setNewUserId("");
      setNewCustomCode("");
    },
    onError: (e: any) => toast.error(String(e)),
  });

  function toggle() {
    mut.mutate([{ key: "tool:referral:enabled", value: !enabled }]);
  }

  function assignCode() {
    if (!newUserId.trim()) return toast.error("Enter a user ID");
    assignMut.mutate({
      userId: newUserId.trim(),
      codeType: newCodeType,
      customCode: newCustomCode.trim() || undefined,
    });
  }

  if (isLoading) return <Loader2 className="size-5 animate-spin text-ink/60" />;

  return (
    <div className="space-y-8">
      {/* Toggle */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Gift className="size-4 text-verde" />
          <p className="text-ink-secondary text-sm">
            Toggle the referral system. When disabled, users see a "Coming Soon" page.
          </p>
        </div>

        <div className="mt-4 max-w-md p-4 border border-ink/10 rounded-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium">Referral System</span>
              <p className="text-[10px] text-ink/40 mt-0.5">
                {enabled ? "Users can share referral links and earn 15%/5% commission" : "Users see Coming Soon placeholder"}
              </p>
            </div>
            <button
              onClick={toggle}
              disabled={mut.isPending}
              className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${enabled ? "bg-verde" : "bg-ink/20"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform shadow ${enabled ? "translate-x-6" : "translate-x-0"}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Assign partner code directly */}
      <div>
        <h3 className="font-medium text-sm mb-3">Assign Partner Code (no application needed)</h3>
        <div className="flex flex-wrap items-end gap-3 p-4 border border-ink/10 rounded-sm">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-ink/50 mb-1">User ID (Clerk)</label>
            <input
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="user_2..."
              className="w-full px-3 py-2 border border-ink/20 rounded-sm text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-ink/50 mb-1">Type</label>
            <select
              value={newCodeType}
              onChange={(e) => setNewCodeType(e.target.value as any)}
              className="px-3 py-2 border border-ink/20 rounded-sm text-sm"
            >
              <option value="ambassador">Ambassador</option>
              <option value="influencer">Influencer</option>
              <option value="standard">Standard</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-ink/50 mb-1">Custom Code (optional)</label>
            <input
              value={newCustomCode}
              onChange={(e) => setNewCustomCode(e.target.value)}
              placeholder="e.g. UNILAG_MIKE"
              className="w-full px-3 py-2 border border-ink/20 rounded-sm text-sm"
            />
          </div>
          <button
            onClick={assignCode}
            disabled={assignMut.isPending}
            className="px-4 py-2 bg-ink text-bone rounded-sm text-sm hover:bg-sage transition-colors disabled:opacity-50"
          >
            {assignMut.isPending ? "Saving..." : "Assign"}
          </button>
        </div>
      </div>

      {/* Applications */}
      <div>
        <h3 className="font-medium text-sm mb-3">Ambassador Applications</h3>
        {applications.length === 0 ? (
          <p className="text-sm text-ink/50">No applications yet.</p>
        ) : (
          <div className="overflow-x-auto border border-ink/10 rounded-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-ink/50">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">School / Dept</th>
                  <th className="px-3 py-2 font-medium">Requested Code</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a: any) => (
                  <Fragment key={a.id}>
                    <tr className="border-b border-ink/5">
                      <td className="px-3 py-2">{a.full_name}</td>
                      <td className="px-3 py-2 text-ink/70">
                        <div>{a.email ?? "—"}</div>
                        {a.phone && <div className="text-xs text-ink/50">{a.phone}</div>}
                      </td>
                      <td className="px-3 py-2 text-ink/70">{a.school ?? "—"} · {a.department ?? "—"}</td>
                      <td className="px-3 py-2">{a.requested_code ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          a.status === "approved" ? "bg-green-100 text-green-800" :
                          a.status === "rejected" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                        }`}>{a.status}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2 items-center">
                          <button
                            onClick={() => setExpandedAppId(expandedAppId === a.id ? null : a.id)}
                            className="text-ink/60 hover:text-verde text-xs font-medium"
                          >
                            {expandedAppId === a.id ? "Hide" : "View"}
                          </button>
                          {a.status === "pending" && (
                            <>
                              <button
                                onClick={() => reviewMut.mutate({ applicationId: a.id, action: "approve" })}
                                className="text-green-600 hover:underline text-xs"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => reviewMut.mutate({ applicationId: a.id, action: "reject" })}
                                className="text-red-600 hover:underline text-xs"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedAppId === a.id && (
                      <tr className="border-b border-ink/5 bg-ink/[0.02]">
                        <td colSpan={6} className="px-4 py-4">
                          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                            <Field label="Full Name" value={a.full_name} />
                            <Field label="Email" value={a.email} />
                            <Field label="Phone" value={a.phone} />
                            <Field label="School" value={a.school} />
                            <Field label="Department" value={a.department} />
                            <Field label="Level" value={a.level} />
                            <Field label="Requested Code" value={a.requested_code} />
                            <Field label="Social Handles" value={a.social_handles} />
                            <Field label="User ID" value={a.user_id} mono />
                            <div className="sm:col-span-2">
                              <dt className="text-[10px] font-bold uppercase tracking-wide text-ink/40">Promotion Plan</dt>
                              <dd className="mt-0.5 whitespace-pre-wrap text-ink/80">{a.promo_plan || "—"}</dd>
                            </div>
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Existing codes */}
      <div>
        <h3 className="font-medium text-sm mb-3">Referral Codes ({codes.length})</h3>
        {codes.length === 0 ? (
          <p className="text-sm text-ink/50">No referral codes generated yet.</p>
        ) : (
          <div className="overflow-x-auto border border-ink/10 rounded-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-ink/50">
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">User ID</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c: any) => (
                  <tr key={c.id} className="border-b border-ink/5">
                    <td className="px-3 py-2 font-mono">{c.code}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        c.code_type === "ambassador" ? "bg-sage/15 text-sage" :
                        c.code_type === "influencer" ? "bg-purple-100 text-purple-800" : "bg-ink/5 text-ink/60"
                      }`}>{c.code_type}</span>
                    </td>
                    <td className="px-3 py-2">{c.user_name ?? "—"}</td>
                    <td className="px-3 py-2 text-ink/70">
                      {c.user_email ? (
                        <a href={`mailto:${c.user_email}`} className="text-verde hover:underline">{c.user_email}</a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-ink/70">{c.user_phone ?? "—"}</td>
                    <td className="px-3 py-2 text-ink/60 font-mono text-xs">{c.user_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Waitlist — Coming Soon Notifications
// ═══════════════════════════════════════════════════════════

function WaitlistTab() {
  const listFn = useServerFn(adminListNotifications);
  const deleteFn = useServerFn(adminDeleteNotification);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-waitlist"],
    queryFn: () => listFn(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-waitlist"] });
      toast.success("Entry removed");
    },
    onError: (e: any) => toast.error(String(e)),
  });

  const learnCount = data?.filter((n: any) => n.feature === "learn").length ?? 0;
  const communityCount = data?.filter((n: any) => n.feature === "community").length ?? 0;
  const totalCount = data?.length ?? 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Mail className="size-4 text-verde" />
        <p className="text-ink-secondary text-sm">
          Users who signed up for "Notify Me" on the Learn and Community coming-soon pages.
        </p>
      </div>

      {/* Summary cards */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 max-w-[140px] border border-ink/10 rounded-sm p-3 text-center">
          <p className="text-2xl font-bold text-ink">{totalCount}</p>
          <p className="text-[10px] font-medium text-ink/50 uppercase tracking-wide mt-0.5">Total</p>
        </div>
        <div className="flex-1 max-w-[140px] border border-ink/10 rounded-sm p-3 text-center">
          <p className="text-2xl font-bold text-sage">{learnCount}</p>
          <p className="text-[10px] font-medium text-ink/50 uppercase tracking-wide mt-0.5">Learn</p>
        </div>
        <div className="flex-1 max-w-[140px] border border-ink/10 rounded-sm p-3 text-center">
          <p className="text-2xl font-bold text-verde">{communityCount}</p>
          <p className="text-[10px] font-medium text-ink/50 uppercase tracking-wide mt-0.5">Community</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 text-ink/60">
          <Loader2 className="size-4 animate-spin" /> Loading waitlist…
        </div>
      )}

      {data && data.length === 0 && (
        <p className="text-sm text-ink/40">No signups yet.</p>
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="text-left py-3 pr-3 font-medium">Date</th>
                <th className="text-left py-3 pr-3 font-medium">Email</th>
                <th className="text-center py-3 pr-3 font-medium">Feature</th>
                <th className="text-left py-3 pr-3 font-medium">User ID</th>
                <th className="text-right py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry: any) => (
                <tr key={entry.id} className="border-b border-ink/5 hover:bg-ink/[0.02]">
                  <td className="py-3 pr-3 text-xs text-ink/60 whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="py-3 pr-3 text-sm">
                    <a href={`mailto:${entry.email}`} className="text-verde hover:underline">
                      {entry.email}
                    </a>
                  </td>
                  <td className="py-3 pr-3 text-center">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-sm ${entry.feature === "learn" ? "bg-sage/10 text-sage" : "bg-verde/10 text-verde"}`}>
                      {entry.feature === "learn" ? "Learn" : "Community"}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-xs text-ink/40 font-mono">
                    {entry.user_id ? entry.user_id.slice(0, 12) + "…" : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => { if (confirm("Delete this waitlist entry?")) deleteMut.mutate(entry.id); }}
                      disabled={deleteMut.isPending}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// University / Department directory — admin seed
// ═══════════════════════════════════════════════════════════

function UniversitiesAdmin() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUniversities);
  const addUniFn = useServerFn(adminAddUniversity);
  const delUniFn = useServerFn(adminDeleteUniversity);
  const addDeptFn = useServerFn(adminAddDepartment);
  const delDeptFn = useServerFn(adminDeleteDepartment);
  const addFacFn = useServerFn(adminAddFaculty);
  const delFacFn = useServerFn(adminDeleteFaculty);
  const importFn = useServerFn(adminImportUniversitiesCsv);

  const { data: universities = [], isLoading } = useQuery({
    queryKey: ["universities"],
    queryFn: () => listFn(),
  });

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [csvText, setCsvText] = useState("");
  const [deptDrafts, setDeptDrafts] = useState<Record<string, string>>({});
  const [facultyDrafts, setFacultyDrafts] = useState<Record<string, string>>({});

  const invalidate = () => qc.invalidateQueries({ queryKey: ["universities"] });

  const addUniMut = useMutation({
    mutationFn: () => addUniFn({ data: { name, country } }),
    onSuccess: () => {
      toast.success("University added.");
      setName("");
      setCountry("");
      invalidate();
    },
    onError: (e: any) => toast.error(String(e)),
  });

  const delUniMut = useMutation({
    mutationFn: (id: string) => delUniFn({ data: { id } }),
    onSuccess: () => {
      toast.success("University removed.");
      invalidate();
    },
    onError: (e: any) => toast.error(String(e)),
  });

  const addDeptMut = useMutation({
    mutationFn: (v: { university_id: string; name: string; faculty_id?: string; key: string }) =>
      addDeptFn({ data: { university_id: v.university_id, name: v.name, faculty_id: v.faculty_id } }),
    onSuccess: (_res, v) => {
      toast.success("Department added.");
      setDeptDrafts((prev) => ({ ...prev, [v.key]: "" }));
      invalidate();
    },
    onError: (e: any) => toast.error(String(e)),
  });

  const addFacMut = useMutation({
    mutationFn: (v: { university_id: string; name: string }) => addFacFn({ data: v }),
    onSuccess: (_res, v) => {
      toast.success("Faculty added.");
      setFacultyDrafts((prev) => ({ ...prev, [v.university_id]: "" }));
      invalidate();
    },
    onError: (e: any) => toast.error(String(e)),
  });

  const delFacMut = useMutation({
    mutationFn: (id: string) => delFacFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Faculty removed.");
      invalidate();
    },
    onError: (e: any) => toast.error(String(e)),
  });

  const delDeptMut = useMutation({
    mutationFn: (id: string) => delDeptFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Department removed.");
      invalidate();
    },
    onError: (e: any) => toast.error(String(e)),
  });

  const importMut = useMutation({
    mutationFn: () => importFn({ data: { csv: csvText } }),
    onSuccess: (res: any) => {
      toast.success(`Imported ${res.universities} university/ies, ${res.faculties} faculties and ${res.departments} department(s).`);
      setCsvText("");
      invalidate();
    },
    onError: (e: any) => toast.error(String(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <University className="size-4 text-verde" />
        <p className="text-ink-secondary text-sm">
          Seed the university, faculty &amp; department directory used by onboarding, settings, and past questions.
        </p>
      </div>

      {/* Add university */}
      <div className="border border-ink/10 rounded-sm p-4 space-y-3">
        <h3 className="text-sm font-medium">Add university</h3>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label className="block">
            <span className={labelCls}>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. University of Lagos" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Country (optional)</span>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Nigeria" className={inputCls} />
          </label>
          <button
            onClick={() => {
              if (!name.trim()) return toast.error("University name is required.");
              addUniMut.mutate();
            }}
            disabled={addUniMut.isPending}
            className="px-4 py-2 text-sm font-medium bg-ink text-bone rounded-sm hover:bg-sage transition-colors disabled:opacity-50"
          >
            {addUniMut.isPending ? <Loader2 className="size-4 animate-spin inline" /> : "Add"}
          </button>
        </div>
      </div>

      {/* Bulk CSV import */}
      <div className="border border-ink/10 rounded-sm p-4 space-y-3">
        <h3 className="text-sm font-medium">Bulk import (CSV)</h3>
        <p className="text-xs text-ink/50">
          One row per line: <code className="bg-ink/5 px-1 rounded">University,Faculty,Department</code>. Repeated universities and faculties are merged automatically.
        </p>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={6}
          placeholder={"University of Lagos,Faculty of Science,Computer Science\nUniversity of Lagos,Faculty of Science,Economics\nUniversity of Lagos,Faculty of Arts,Law\nUniversity of Ibadan,Faculty of Law,Law"}
          className="mt-1 w-full border border-ink/20 rounded-sm px-3 py-2 text-sm bg-white font-mono focus:outline-none focus:border-verde/50"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm cursor-pointer text-ink/60 hover:text-ink">
            Upload .csv
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                file
                  .text()
                  .then((t) => setCsvText(t))
                  .catch(() => toast.error("Could not read file."));
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() => {
              if (!csvText.trim()) return toast.error("Paste or upload CSV content first.");
              importMut.mutate();
            }}
            disabled={importMut.isPending}
            className="px-4 py-2 text-sm font-medium bg-verde text-white rounded-sm hover:opacity-90 disabled:opacity-50"
          >
            {importMut.isPending ? <Loader2 className="size-4 animate-spin inline" /> : "Import CSV"}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 text-ink/60">
          <Loader2 className="size-5 animate-spin" /> Loading directory…
        </div>
      )}

      {!isLoading && universities.length === 0 && (
        <p className="text-sm text-ink/50">No universities yet. Add your first one above.</p>
      )}

      <div className="space-y-4">
        {universities.map((u) => (
          <div key={u.id} className="border border-ink/10 rounded-sm p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="min-w-0">
                <span className="font-medium">{u.name}</span>
                {u.country && <span className="text-xs text-ink/40 ml-2">{u.country}</span>}
              </div>
              <button
                onClick={() => delUniMut.mutate(u.id)}
                className="text-red-500 hover:text-red-700 shrink-0"
                title="Delete university"
              >
                <Trash2 className="size-4" />
              </button>
            </div>

            <div className="pl-3 border-l border-ink/10 space-y-3">
              {/* Add faculty */}
              <div className="flex gap-2 items-center">
                <input
                  value={facultyDrafts[u.id] ?? ""}
                  onChange={(e) => setFacultyDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))}
                  placeholder="Add faculty (e.g. Faculty of Science)"
                  className={inputCls}
                />
                <button
                  onClick={() => {
                    const facName = (facultyDrafts[u.id] ?? "").trim();
                    if (!facName) return toast.error("Faculty name is required.");
                    addFacMut.mutate({ university_id: u.id, name: facName });
                  }}
                  disabled={addFacMut.isPending}
                  className="px-3 py-2 text-sm font-medium bg-ink text-bone rounded-sm hover:bg-sage transition-colors disabled:opacity-50 shrink-0"
                >
                  Add
                </button>
              </div>

              {u.faculties.length === 0 && (
                <p className="text-xs text-ink/40">No faculties yet.</p>
              )}

              {u.faculties.map((f) => {
                const isOther = f.id === "";
                const draftKey = `${u.id}:${f.id || "other"}`;
                return (
                  <div key={draftKey} className="pl-3 border-l border-ink/10 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink/70">{f.name}</span>
                      {!isOther && (
                        <button
                          onClick={() => delFacMut.mutate(f.id)}
                          className="text-red-500 hover:text-red-700 shrink-0"
                          title="Delete faculty"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>

                    {f.departments.length === 0 && (
                      <p className="text-xs text-ink/40 pl-3">No departments yet.</p>
                    )}
                    {f.departments.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-3 text-sm pl-3">
                        <span>{d.name}</span>
                        <button
                          onClick={() => delDeptMut.mutate(d.id)}
                          className="text-red-500 hover:text-red-700 shrink-0"
                          title="Delete department"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2 items-center pt-1 pl-3">
                      <input
                        value={deptDrafts[draftKey] ?? ""}
                        onChange={(e) => setDeptDrafts((prev) => ({ ...prev, [draftKey]: e.target.value }))}
                        placeholder="Add department (e.g. Computer Science)"
                        className={inputCls}
                      />
                      <button
                        onClick={() => {
                          const deptName = (deptDrafts[draftKey] ?? "").trim();
                          if (!deptName) return toast.error("Department name is required.");
                          addDeptMut.mutate({
                            university_id: u.id,
                            name: deptName,
                            faculty_id: isOther ? undefined : f.id,
                            key: draftKey,
                          });
                        }}
                        disabled={addDeptMut.isPending}
                        className="px-3 py-2 text-sm font-medium bg-verde text-white rounded-sm hover:opacity-90 disabled:opacity-50 shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Past Questions Bank — Admin import
// ═══════════════════════════════════════════════════════════

type ImportCategory = "university" | "waec" | "neco" | "jamb";

interface PendingQuestion {
  category: ImportCategory;
  university: string;
  course: string;
  level: string;
  year: string;
  subject: string;
  question_type: "objectives" | "theory";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  marks: number;
}

const EMPTY_QUESTION: PendingQuestion = {
  category: "university",
  university: "",
  course: "",
  level: "",
  year: "",
  subject: "",
  question_type: "objectives",
  question: "",
  options: [],
  answer: "",
  explanation: "",
  marks: 0,
};

const inputCls =
  "mt-1 w-full border border-ink/20 rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-verde/50";
const labelCls = "text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60";

function PastQuestionsAdmin() {
  const importFn = useServerFn(adminImportPastQuestions);
  const importCsvFn = useServerFn(adminImportPastQuestionsCsv);
  const listUnisFn = useServerFn(listUniversities);
  const { data: universities = [] } = useQuery({
    queryKey: ["universities"],
    queryFn: () => listUnisFn(),
  });
  const [form, setForm] = useState<PendingQuestion>(EMPTY_QUESTION);
  const [optionsText, setOptionsText] = useState("");
  const [batch, setBatch] = useState<PendingQuestion[]>([]);
  const [csvText, setCsvText] = useState("");

  const set = (key: keyof PendingQuestion, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const importMut = useMutation({
    mutationFn: () => importFn({ data: { questions: batch } }),
    onSuccess: (res: any) => {
      toast.success(`Imported ${res.imported} question(s)`);
      setBatch([]);
    },
    onError: (e: any) => toast.error(String(e)),
  });

  const csvMut = useMutation({
    mutationFn: () => importCsvFn({ data: { csv: csvText } }),
    onSuccess: (res: any) => {
      toast.success(`Imported ${res.imported} question(s) from CSV.`);
      setCsvText("");
    },
    onError: (e: any) => toast.error(String(e)),
  });

  function addToBatch() {
    const options = optionsText.split("\n").map((o) => o.trim()).filter(Boolean);

    if (!form.question.trim()) return toast.error("Question text is required.");
    if (!form.answer.trim()) return toast.error("Answer is required.");
    if (form.category === "university") {
      if (!form.university.trim()) return toast.error("University is required.");
      if (!form.course.trim()) return toast.error("Course is required.");
    } else if (!form.subject.trim()) {
      return toast.error("Subject is required for this category.");
    }
    if (form.question_type === "objectives" && options.length < 2) {
      return toast.error("Objectives need at least 2 options (one per line).");
    }

    const isUniversity = form.category === "university";
    setBatch((prev) => [
      ...prev,
      {
        ...form,
        options,
        university: isUniversity ? form.university.trim() : "",
        course: isUniversity ? form.course.trim() : "",
        level: isUniversity ? form.level.trim() : "",
        subject: form.subject.trim(),
      },
    ]);
    setForm(EMPTY_QUESTION);
    setOptionsText("");
  }

  function removeFromBatch(index: number) {
    setBatch((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-verde" />
        <p className="text-ink-secondary text-sm">
          Seed the past questions bank. University questions need a university + course; WAEC/NECO/JAMB need a subject.
        </p>
      </div>

      {/* Bulk CSV import */}
      <div className="border border-ink/10 rounded-sm p-4 space-y-3">
        <h3 className="text-sm font-medium">Bulk import (CSV)</h3>
        <p className="text-xs text-ink/50">
          One question per row. Columns:{" "}
          <code className="bg-ink/5 px-1 rounded">category,university,course,level,year,subject,question_type,question,options,answer,explanation,marks</code>.
          Objectives options use <code className="bg-ink/5 px-1 rounded">|</code>; wrap fields containing commas in quotes.
        </p>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={6}
          placeholder={'university,University of Lagos,Computer Science,200,2024,,objectives,"What is 2+2?","2|3|4|5",4,,1'}
          className="mt-1 w-full border border-ink/20 rounded-sm px-3 py-2 text-sm bg-white font-mono focus:outline-none focus:border-verde/50"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm cursor-pointer text-ink/60 hover:text-ink">
            Upload .csv
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                file
                  .text()
                  .then((t) => setCsvText(t))
                  .catch(() => toast.error("Could not read file."));
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() => {
              if (!csvText.trim()) return toast.error("Paste or upload CSV content first.");
              csvMut.mutate();
            }}
            disabled={csvMut.isPending}
            className="px-4 py-2 text-sm font-medium bg-verde text-white rounded-sm hover:opacity-90 disabled:opacity-50"
          >
            {csvMut.isPending ? <Loader2 className="size-4 animate-spin inline" /> : "Import CSV"}
          </button>
        </div>
      </div>

      <div className="border border-ink/10 rounded-sm p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Category</span>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value as ImportCategory)}
              className={inputCls}
            >
              <option value="university">University</option>
              <option value="waec">WAEC</option>
              <option value="neco">NECO</option>
              <option value="jamb">JAMB</option>
            </select>
          </label>

          <label className="block">
            <span className={labelCls}>Type</span>
            <select
              value={form.question_type}
              onChange={(e) => set("question_type", e.target.value as "objectives" | "theory")}
              className={inputCls}
            >
              <option value="objectives">Objectives</option>
              <option value="theory">Theory</option>
            </select>
          </label>

          {form.category === "university" ? (
            <>
              <label className="block">
                <span className={labelCls}>University</span>
                <select value={form.university} onChange={(e) => set("university", e.target.value)} className={inputCls}>
                  <option value="">Select university</option>
                  {universities.map((u) => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Course</span>
                <input value={form.course} onChange={(e) => set("course", e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Level (optional)</span>
                <input value={form.level} onChange={(e) => set("level", e.target.value)} className={inputCls} />
              </label>
            </>
          ) : (
            <label className="block">
              <span className={labelCls}>Subject</span>
              <input value={form.subject} onChange={(e) => set("subject", e.target.value)} className={inputCls} />
            </label>
          )}

          <label className="block">
            <span className={labelCls}>Year (optional)</span>
            <input value={form.year} onChange={(e) => set("year", e.target.value)} className={inputCls} />
          </label>
        </div>

        <label className="block">
          <span className={labelCls}>Question</span>
          <textarea value={form.question} onChange={(e) => set("question", e.target.value)} rows={2} className={inputCls} />
        </label>

        {form.question_type === "objectives" && (
          <label className="block">
            <span className={labelCls}>Options (one per line)</span>
            <textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={4} className={inputCls} />
          </label>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className={labelCls}>Answer</span>
            <textarea value={form.answer} onChange={(e) => set("answer", e.target.value)} rows={2} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Explanation (optional)</span>
            <textarea value={form.explanation} onChange={(e) => set("explanation", e.target.value)} rows={2} className={inputCls} />
          </label>
        </div>

        <label className="block max-w-[200px]">
          <span className={labelCls}>Marks</span>
          <input
            type="number"
            min={0}
            max={100}
            value={form.marks}
            onChange={(e) => set("marks", Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
            className={inputCls}
          />
        </label>

        <button
          onClick={addToBatch}
          className="px-4 py-2 text-sm font-medium bg-ink text-bone rounded-sm hover:bg-sage transition-colors"
        >
          + Add to batch
        </button>
      </div>

      {batch.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-sm">Pending ({batch.length})</h3>
            <button
              onClick={() => importMut.mutate()}
              disabled={importMut.isPending}
              className="px-4 py-2 text-sm font-medium bg-verde text-white rounded-sm hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {importMut.isPending ? <Loader2 className="size-4 animate-spin inline mr-1" /> : null}
              Import {batch.length} question(s)
            </button>
          </div>
          <div className="space-y-2">
            {batch.map((q, i) => (
              <div key={i} className="flex items-start justify-between gap-3 border border-ink/10 rounded-sm p-3">
                <div className="text-sm min-w-0">
                  <span className="text-[10px] uppercase text-ink/40">{q.category}</span>{" "}
                  <span className="font-medium">{q.question}</span>
                  <span className="text-xs text-ink/40"> · {q.category === "university" ? q.course : q.subject}</span>
                </div>
                <button onClick={() => removeFromBatch(i)} className="text-red-500 hover:text-red-700 shrink-0" title="Remove">
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab Button helper
// ═══════════════════════════════════════════════════════════

function RoleManager() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListRoles);
  const setFn = useServerFn(adminSetRole);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => listFn(),
  });

  const mut = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "community_manager" | "none" }) =>
      setFn({ data: v }),
    onSuccess: () => {
      toast.success("Role updated.");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (e: any) => toast.error(String(e)),
  });

  const roleLabel = (role: string | null) =>
    role === "admin" ? "Admin" : role === "community_manager" ? "Community Manager" : "None";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-verde" />
        <p className="text-ink-secondary text-sm">
          Grant or revoke global roles. Admins can access this panel; community managers can moderate the community.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-ink/50">
          <Loader2 className="size-4 animate-spin" /> Loading users…
        </div>
      ) : (
        <div className="border border-ink/10 rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink/5 text-left">
              <tr>
                <th className="px-3 py-2 font-medium text-xs text-ink/60">User</th>
                <th className="px-3 py-2 font-medium text-xs text-ink/60">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{u.email ?? u.id.slice(0, 8)}</div>
                    {u.first_name || u.last_name ? (
                      <div className="text-xs text-ink/50">
                        {[u.first_name, u.last_name].filter(Boolean).join(" ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role ?? "none"}
                      onChange={(e) =>
                        mut.mutate({
                          user_id: u.id,
                          role: e.target.value as "admin" | "community_manager" | "none",
                        })
                      }
                      disabled={mut.isPending}
                      className={inputCls + " max-w-[180px]"}
                      title={roleLabel(u.role)}
                    >
                      <option value="none">None</option>
                      <option value="community_manager">Community Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="px-3 py-4 text-sm text-ink/50">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
}

function MentorApplications() {
  const listFn = useServerFn(adminListMentorApplications);
  const reviewFn = useServerFn(adminReviewMentor);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-mentors"],
    queryFn: () => listFn(),
  });

  const reviewMut = useMutation({
    mutationFn: (v: { user_id: string; action: "approve" | "reject" }) =>
      reviewFn({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-mentors"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-ink/60 py-8">
        <Loader2 className="size-5 animate-spin" /> Loading…
      </div>
    );
  }

  const pending = (data ?? []).filter((m: MentorCard) => m.status === "pending");
  const others = (data ?? []).filter((m: MentorCard) => m.status !== "pending");

  return (
    <div>
      <p className="text-ink-secondary max-w-xl text-sm mb-6">
        Review mentor applications. Approved mentors appear in the student-facing directory.
      </p>

      {pending.length === 0 ? (
        <p className="text-sm text-ink/50 mb-6">No pending applications.</p>
      ) : (
        <div className="space-y-4 mb-8">
          {pending.map((m: MentorCard) => (
            <div key={m.id} className="border border-ink/10 rounded-sm p-4 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{m.full_name ?? m.user_id}</p>
                  <p className="text-xs text-ink/50">{m.headline}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => reviewMut.mutate({ user_id: m.user_id, action: "approve" })}
                    disabled={reviewMut.isPending}
                    className="px-3 py-1.5 bg-verde text-white rounded-sm text-xs font-medium hover:bg-verde-dark disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => reviewMut.mutate({ user_id: m.user_id, action: "reject" })}
                    disabled={reviewMut.isPending}
                    className="px-3 py-1.5 border border-ink/20 text-ink rounded-sm text-xs font-medium hover:bg-ink/5 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>

              {m.bio && (
                <p className="text-xs text-ink/60 mt-2 whitespace-pre-wrap">{m.bio}</p>
              )}

              {(m.university || m.department || m.level || m.availability) && (
                <div className="flex flex-wrap gap-2 mt-3 text-[11px] text-ink/60">
                  {m.university && (
                    <span className="px-2 py-0.5 bg-paper border border-ink/10 rounded-sm">{m.university}</span>
                  )}
                  {m.department && (
                    <span className="px-2 py-0.5 bg-paper border border-ink/10 rounded-sm">{m.department}</span>
                  )}
                  {m.level && (
                    <span className="px-2 py-0.5 bg-paper border border-ink/10 rounded-sm">{m.level}</span>
                  )}
                  {m.availability && (
                    <span className="px-2 py-0.5 bg-paper border border-ink/10 rounded-sm">{m.availability}</span>
                  )}
                </div>
              )}

              {m.expertise_areas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {m.expertise_areas.map((tag: string) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-verde/10 text-verde-dark border border-verde/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div>
          <h3 className="font-serif text-lg text-ink mb-3">Reviewed</h3>
          <div className="space-y-2">
            {others.map((m: MentorCard) => (
              <div
                key={m.id}
                className="border border-ink/10 rounded-sm p-3 bg-white flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{m.full_name ?? m.user_id}</p>
                  <p className="text-xs text-ink/50 truncate">{m.headline}</p>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${
                    m.status === "approved" ? "bg-verde-light text-verde-dark" : "bg-ink/10 text-ink/60"
                  }`}
                >
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ tab, active, onClick, label }: { tab: string; active: string; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`pb-2 text-sm font-medium transition-colors whitespace-nowrap ${active === tab ? "text-verde border-b-2 border-verde" : "text-ink/50 hover:text-ink"}`}
    >
      {label}
    </button>
  );
}
