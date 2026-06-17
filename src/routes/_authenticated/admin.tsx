import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListLimits, updateUserLimits } from "@/lib/admin-limits.functions";
import { Loader2, Shield, Save, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
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
      thesis_limit_ug: number;
      thesis_limit_masters: number;
      thesis_limit_phd: number;
      proposal_limit: number;
    }) => up({ data: v }),
    onSuccess: () => {
      toast.success("Limits saved");
      qc.invalidateQueries({ queryKey: ["admin-limits"] });
    },
    onError: (e) => toast.error(String(e)),
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    thesis_limit_ug: 0,
    thesis_limit_masters: 0,
    thesis_limit_phd: 0,
    proposal_limit: 0,
  });

  function startEdit(user: NonNullable<typeof data>[number]) {
    setEditId(user.user_id);
    setForm({
      thesis_limit_ug: user.thesis_limit_ug,
      thesis_limit_masters: user.thesis_limit_masters,
      thesis_limit_phd: user.thesis_limit_phd,
      proposal_limit: user.proposal_limit,
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
        <div className="flex items-center gap-3 mb-6">
          <Shield className="size-5 text-verde" />
          <h1 className="font-serif text-2xl sm:text-3xl">Admin — Usage Limits</h1>
        </div>
        <p className="text-ink-secondary max-w-xl text-sm mb-8">
          Manage draft limits for all users. Each user gets defaults of 0 thesis and 0 proposal drafts — they purchase credits separately.
        </p>

        {isLoading && (
          <div className="flex items-center gap-3 text-ink/60">
            <Loader2 className="size-5 animate-spin" /> Loading users…
          </div>
        )}

        {!isLoading && data && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-ink/10">
                  <th className="text-left py-3 pr-4 font-medium">User</th>
                  <th className="text-center py-3 px-2 font-medium">Thesis UG</th>
                  <th className="text-center py-3 px-2 font-medium">Thesis Masters</th>
                  <th className="text-center py-3 px-2 font-medium">Thesis PhD</th>
                  <th className="text-center py-3 px-2 font-medium">Proposals</th>
                  <th className="text-right py-3 pl-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((user) => {
                  const isEditing = editId === user.user_id;
                  return (
                    <tr key={user.user_id} className="border-b border-ink/5 hover:bg-ink/[0.02]">
                      <td className="py-3 pr-4">
                        <span className="text-xs font-mono text-ink/60">{user.email ?? user.user_id.slice(0, 12)}</span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        {isEditing ? (
                          <Input
                            value={form.thesis_limit_ug}
                            onChange={(v) => setForm({ ...form, thesis_limit_ug: v })}
                          />
                        ) : (
                          <span>
                            {user.thesis_used_ug}/{user.thesis_limit_ug}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {isEditing ? (
                          <Input
                            value={form.thesis_limit_masters}
                            onChange={(v) => setForm({ ...form, thesis_limit_masters: v })}
                          />
                        ) : (
                          <span>
                            {user.thesis_used_masters}/{user.thesis_limit_masters}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {isEditing ? (
                          <Input
                            value={form.thesis_limit_phd}
                            onChange={(v) => setForm({ ...form, thesis_limit_phd: v })}
                          />
                        ) : (
                          <span>
                            {user.thesis_used_phd}/{user.thesis_limit_phd}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {isEditing ? (
                          <Input
                            value={form.proposal_limit}
                            onChange={(v) => setForm({ ...form, proposal_limit: v })}
                          />
                        ) : (
                          <span>
                            {user.proposal_used}/{user.proposal_limit}
                          </span>
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
