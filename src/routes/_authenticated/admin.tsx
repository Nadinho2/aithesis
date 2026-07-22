import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { adminListLimits, updateUserLimits } from "@/lib/admin-limits.functions";
import { adminListTransactions, adminListUniversitySubmissions, adminMarkUniversityDone } from "@/lib/admin.functions";
import { Loader2, Shield, Save, X, Search, CheckCircle, XCircle, Clock, University, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [tab, setTab] = useState<"limits" | "transactions" | "university">("limits");
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
        <div className="flex gap-4 border-b border-ink/10 mb-6">
          <button
            onClick={() => setTab("limits")}
            className={`pb-2 text-sm font-medium transition-colors ${tab === "limits" ? "text-verde border-b-2 border-verde" : "text-ink/50 hover:text-ink"}`}
          >
            Usage Limits
          </button>
          <button
            onClick={() => setTab("transactions")}
            className={`pb-2 text-sm font-medium transition-colors ${tab === "transactions" ? "text-verde border-b-2 border-verde" : "text-ink/50 hover:text-ink"}`}
          >
            Transactions
          </button>
          <button
            onClick={() => setTab("university")}
            className={`pb-2 text-sm font-medium transition-colors ${tab === "university" ? "text-verde border-b-2 border-verde" : "text-ink/50 hover:text-ink"}`}
          >
            University Submissions
          </button>
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
