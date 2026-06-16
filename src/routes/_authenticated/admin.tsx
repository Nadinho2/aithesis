import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListLimits, updateUserLimits, requireAdmin } from "@/lib/admin-limits.functions";
import { adminCheck } from "@/lib/admin.functions";
import { Loader2, Shield, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type UserRow = {
  user_id: string;
  email: string | null;
  thesis_limit: number;
  thesis_used: number;
  proposal_limit: number;
  proposal_used: number;
};

function AdminPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<{ t: number; p: number }>({ t: 0, p: 0 });

  // Verify admin
  const adminFn = useServerFn(adminCheck);
  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ["admin-check"],
    queryFn: () => adminFn(),
    staleTime: 5 * 60_000,
  });

  const listFn = useServerFn(adminListLimits);
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-limits"],
    queryFn: () => listFn(),
    enabled: !!roleData?.isAdmin,
  });

  const updateFn = useServerFn(updateUserLimits);
  const saveMut = useMutation({
    mutationFn: (vars: { user_id: string; thesis_limit: number; proposal_limit: number }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Limits updated");
      queryClient.invalidateQueries({ queryKey: ["admin-limits"] });
      setEditingId(null);
    },
    onError: (e: any) => toast.error(String(e instanceof Error ? e.message : e)),
  });

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin h-6 w-6 text-ink/40" />
      </div>
    );
  }

  if (!roleData?.isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  function startEdit(u: UserRow) {
    setEditingId(u.user_id);
    setEditVals({ t: u.thesis_limit, p: u.proposal_limit });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-verde mb-3">
          <Shield className="size-3" />
          Admin
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mb-3">Subscription Management</h1>
        <p className="text-ink-secondary max-w-xl text-sm">
          Manage draft limits for all users. Each user gets defaults of 0 thesis and 0 proposal drafts — they purchase credits separately.
        </p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total users" value={users?.length ?? 0} />
        <StatCard label="Thesis capacity" value={users?.reduce((s: number, u: UserRow) => s + u.thesis_limit, 0) ?? 0} />
        <StatCard label="Proposal capacity" value={users?.reduce((s: number, u: UserRow) => s + u.proposal_limit, 0) ?? 0} />
        <StatCard label="Thesis used" value={users?.reduce((s: number, u: UserRow) => s + u.thesis_used, 0) ?? 0} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin h-6 w-6 text-ink/40" />
        </div>
      ) : error ? (
        <div className="text-red-500 text-sm p-4 border border-red-200 rounded-sm">{String(error)}</div>
      ) : (
        <div className="overflow-x-auto border border-[#E5E2D8] rounded-lg bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E2D8] bg-paper/50">
                <th className="text-left py-3 px-4 font-medium text-ink-secondary">Email</th>
                <th className="text-left py-3 px-4 font-medium text-ink-secondary">Thesis Used</th>
                <th className="text-left py-3 px-4 font-medium text-ink-secondary">Thesis Limit</th>
                <th className="text-left py-3 px-4 font-medium text-ink-secondary">Proposal Used</th>
                <th className="text-left py-3 px-4 font-medium text-ink-secondary">Proposal Limit</th>
                <th className="text-right py-3 px-4 font-medium text-ink-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u: UserRow) => {
                const isEditing = editingId === u.user_id;
                const saving = saveMut.isPending && saveMut.variables?.user_id === u.user_id;
                return (
                  <tr key={u.user_id} className="border-b border-[#E5E2D8]/50 last:border-0">
                    <td className="py-3 px-4 text-ink truncate max-w-[200px]">{u.email ?? "—"}</td>
                    <td className="py-3 px-4 text-ink/60">{u.thesis_used}</td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={editVals.t}
                          onChange={(e) => setEditVals({ ...editVals, t: Number(e.target.value) })}
                          className="w-20 px-2 py-1 border border-[#E5E2D8] rounded text-sm"
                        />
                      ) : (
                        <span className={u.thesis_used >= u.thesis_limit ? "text-red-500 font-medium" : "text-ink"}>
                          {u.thesis_limit}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-ink/60">{u.proposal_used}</td>
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={editVals.p}
                          onChange={(e) => setEditVals({ ...editVals, p: Number(e.target.value) })}
                          className="w-20 px-2 py-1 border border-[#E5E2D8] rounded text-sm"
                        />
                      ) : (
                        <span className={u.proposal_used >= u.proposal_limit ? "text-red-500 font-medium" : "text-ink"}>
                          {u.proposal_limit}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-ink/40 hover:text-ink transition-colors"
                          >
                            <X className="size-4" />
                          </button>
                          <button
                            onClick={() =>
                              saveMut.mutate({
                                user_id: u.user_id,
                                thesis_limit: editVals.t,
                                proposal_limit: editVals.p,
                              })
                            }
                            disabled={saving}
                            className="p-1.5 text-verde hover:text-verde/80 transition-colors disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(u)}
                          className="text-xs text-ink-secondary hover:text-ink transition-colors font-medium"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!users || users.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-ink-secondary text-sm">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-[#E5E2D8] rounded-lg p-4">
      <div className="font-serif text-2xl font-bold text-ink">{value}</div>
      <div className="text-xs text-ink-secondary mt-1">{label}</div>
    </div>
  );
}
