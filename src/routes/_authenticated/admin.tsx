import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { adminListLimits, updateUserLimits } from "@/lib/admin-limits.functions";
import { adminListTransactions, adminListUniversitySubmissions, adminMarkUniversityDone, adminGetSettings, adminUpdateSettings, adminBulkSetCredits } from "@/lib/admin.functions";
import { Loader2, Shield, Save, X, Search, CheckCircle, XCircle, Clock, University, ExternalLink, DollarSign, ToggleLeft, Users, Gift } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [tab, setTab] = useState<"limits" | "transactions" | "university" | "pricing" | "tools" | "credits" | "referral">("limits");
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
    presentation: 0, cv: 0, seminar: 0,
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
  return (
    <div className="text-center py-16">
      <Gift className="size-12 mx-auto mb-4 text-ink/20" />
      <h2 className="text-xl font-serif mb-2">Referral Program</h2>
      <p className="text-ink/50 text-sm max-w-md mx-auto">
        The referral system is coming soon. Users will be able to share their referral links and earn credits when new users sign up and make a purchase.
      </p>
      <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-sm text-xs text-amber-700">
        <Clock className="size-3" />
        Coming Soon
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Tab Button helper
// ═══════════════════════════════════════════════════════════

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
