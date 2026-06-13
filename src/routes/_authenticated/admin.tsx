import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  adminCheck,
  adminStats,
  adminListUsers,
  adminListGenerations,
  adminListProposals,
  adminDownloadProposal,
  adminDownloadUserTopics,
  adminSetBan,
  adminDeleteUser,
  adminSetRole,
} from "@/lib/admin.functions";
import {
  Loader2,
  Users,
  FileText,
  Sparkles,
  Shield,
  Download,
  Ban,
  UserX,
  ShieldPlus,
  ShieldMinus,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — ThesisPro AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminPage,
});

function downloadFromBase64(base64: string, filename: string, mime: string) {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AdminPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const adminCheckFn = useServerFn(adminCheck);
  const statsFn = useServerFn(adminStats);
  const usersFn = useServerFn(adminListUsers);
  const gensFn = useServerFn(adminListGenerations);
  const propsFn = useServerFn(adminListProposals);
  const dlPropFn = useServerFn(adminDownloadProposal);
  const dlTopicsFn = useServerFn(adminDownloadUserTopics);
  const banFn = useServerFn(adminSetBan);
  const delUserFn = useServerFn(adminDeleteUser);
  const roleFn = useServerFn(adminSetRole);
  const qc = useQueryClient();

  const { data: adminStatus, isFetched, isError } = useQuery({
    queryKey: ["admin-check"],
    queryFn: () => adminCheckFn(),
    enabled: isLoaded && !!isSignedIn,
    retry: false,
  });

  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => statsFn(), enabled: !!adminStatus?.isAdmin });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn(), enabled: !!adminStatus?.isAdmin });
  const gens = useQuery({ queryKey: ["admin-gens"], queryFn: () => gensFn(), enabled: !!adminStatus?.isAdmin });
  const proposals = useQuery({ queryKey: ["admin-proposals"], queryFn: () => propsFn(), enabled: !!adminStatus?.isAdmin });

  const [tab, setTab] = useState<"users" | "proposals" | "generations">("users");
  const [busy, setBusy] = useState<string | null>(null);

  const dlProposal = async (id: string) => {
    setBusy("dl-" + id);
    try {
      const r = await dlPropFn({ data: { id } });
      downloadFromBase64(r.base64, r.filename, r.mime);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };
  const dlUserTopics = async (user_id: string) => {
    setBusy("topics-" + user_id);
    try {
      const r = await dlTopicsFn({ data: { user_id } });
      downloadFromBase64(r.base64, r.filename, r.mime);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  };
  const setBan = useMutation({
    mutationFn: (v: { user_id: string; banned: boolean }) => banFn({ data: v }),
    onSuccess: (_, v) => {
      toast.success(v.banned ? "User banned" : "User unbanned");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });
  const delUser = useMutation({
    mutationFn: (user_id: string) => delUserFn({ data: { user_id } }),
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });
  const setRole = useMutation({
    mutationFn: (v: { user_id: string; role: "admin" | "user"; grant: boolean }) =>
      roleFn({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Role update failed"),
  });

  if (!isFetched) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-6 w-6 text-ink/40" />
      </div>
    );
  }

  if (isError || !adminStatus?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">
      <div className="mb-6 flex items-center gap-3">
        <Shield className="size-6 text-sage" />
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl">Admin Console</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Users" value={stats.data?.users} loading={stats.isLoading} Icon={Users} />
        <StatCard label="Proposals" value={stats.data?.proposals} loading={stats.isLoading} Icon={FileText} />
        <StatCard label="Generations" value={stats.data?.generations} loading={stats.isLoading} Icon={Sparkles} />
        <StatCard label="Topics" value={stats.data?.topics} loading={stats.isLoading} Icon={FileText} />
      </div>

      <div className="flex gap-1 mb-5 border-b border-ink/10">
        {(["users", "proposals", "generations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs uppercase font-bold tracking-widest border-b-2 -mb-px ${
              tab === t ? "border-sage text-ink" : "border-transparent text-ink/50 hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <section>
          {users.isLoading && <Spinner />}
          {users.data && (
            <div className="overflow-x-auto bg-card border border-ink/10 rounded-sm">
              <table className="w-full text-sm">
                <thead className="bg-parchment/60 text-[10px] uppercase tracking-widest text-ink/50">
                  <tr>
                    <Th>Email</Th>
                    <Th>Name</Th>
                    <Th>Role</Th>
                    <Th>Topics</Th>
                    <Th>Proposals</Th>
                    <Th>Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.map((u: any) => {
                    const isAdmin = u.roles.includes("admin");
                    return (
                      <tr key={u.id} className="border-t border-ink/5 hover:bg-parchment/30">
                        <Td className="font-mono text-xs">{u.email ?? "—"}</Td>
                        <Td>{u.full_name ?? "—"}</Td>
                        <Td>
                          {isAdmin ? (
                            <span className="px-2 py-0.5 bg-sage/15 text-sage text-[10px] font-bold uppercase rounded-sm">
                              admin
                            </span>
                          ) : (
                            <span className="text-ink/40 text-xs">user</span>
                          )}
                        </Td>
                        <Td>{u.topic_count}</Td>
                        <Td>{u.proposal_count}</Td>
                        <Td>
                          {u.banned ? (
                            <span className="px-2 py-0.5 bg-red-700/15 text-red-700 text-[10px] font-bold uppercase rounded-sm">
                              banned
                            </span>
                          ) : (
                            <span className="text-ink/40 text-xs">active</span>
                          )}
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            <IconBtn
                              title="Download topics"
                              onClick={() => dlUserTopics(u.id)}
                              disabled={busy === "topics-" + u.id || u.topic_count === 0}
                            >
                              <Download className="size-3.5" />
                            </IconBtn>
                            <IconBtn
                              title={isAdmin ? "Remove admin" : "Make admin"}
                              onClick={() =>
                                setRole.mutate({ user_id: u.id, role: "admin", grant: !isAdmin })
                              }
                            >
                              {isAdmin ? <ShieldMinus className="size-3.5" /> : <ShieldPlus className="size-3.5" />}
                            </IconBtn>
                            <IconBtn
                              title={u.banned ? "Unban" : "Ban"}
                              onClick={() => setBan.mutate({ user_id: u.id, banned: !u.banned })}
                            >
                              <Ban className="size-3.5" />
                            </IconBtn>
                            <IconBtn
                              title="Delete user"
                              danger
                              onClick={() => {
                                if (confirm(`Delete ${u.email}? This is permanent.`)) {
                                  delUser.mutate(u.id);
                                }
                              }}
                            >
                              <UserX className="size-3.5" />
                            </IconBtn>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "proposals" && (
        <section>
          {proposals.isLoading && <Spinner />}
          {proposals.data && (
            <div className="overflow-x-auto bg-card border border-ink/10 rounded-sm">
              <table className="w-full text-sm">
                <thead className="bg-parchment/60 text-[10px] uppercase tracking-widest text-ink/50">
                  <tr>
                    <Th>Date</Th>
                    <Th>Author</Th>
                    <Th>Title</Th>
                    <Th>Level</Th>
                    <Th>Words</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.data.map((p: any) => (
                    <tr key={p.id} className="border-t border-ink/5 hover:bg-parchment/30">
                      <Td className="whitespace-nowrap text-ink/60">
                        {new Date(p.created_at).toLocaleDateString()}
                      </Td>
                      <Td className="font-mono text-xs">{p.user_email ?? "—"}</Td>
                      <Td className="max-w-xs truncate" title={p.title}>{p.title}</Td>
                      <Td>{p.level}</Td>
                      <Td>{p.word_count}</Td>
                      <Td>
                        <IconBtn
                          title="Download .docx"
                          onClick={() => dlProposal(p.id)}
                          disabled={busy === "dl-" + p.id}
                        >
                          <Download className="size-3.5" />
                        </IconBtn>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "generations" && (
        <section>
          {gens.isLoading && <Spinner />}
          {gens.data && (
            <div className="overflow-x-auto bg-card border border-ink/10 rounded-sm">
              <table className="w-full text-sm">
                <thead className="bg-parchment/60 text-[10px] uppercase tracking-widest text-ink/50">
                  <tr>
                    <Th>Date</Th>
                    <Th>Author</Th>
                    <Th>Department</Th>
                    <Th>Area</Th>
                    <Th>Country</Th>
                    <Th># Topics</Th>
                  </tr>
                </thead>
                <tbody>
                  {gens.data.map((g: any) => (
                    <tr key={g.id} className="border-t border-ink/5 hover:bg-parchment/30">
                      <Td className="whitespace-nowrap text-ink/60">
                        {new Date(g.created_at).toLocaleString()}
                      </Td>
                      <Td className="font-mono text-xs">{g.user_email ?? "—"}</Td>
                      <Td>{g.department}</Td>
                      <Td>{g.area_of_interest}</Td>
                      <Td>{g.country ?? "—"}</Td>
                      <Td>{g.topic_count}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  Icon,
}: {
  label: string;
  value?: number;
  loading: boolean;
  Icon: typeof Users;
}) {
  return (
    <div className="p-4 bg-card border border-ink/10 rounded-sm">
      <Icon className="size-4 text-sage mb-2" />
      <div className="text-[10px] uppercase tracking-[0.2em] text-ink/50 font-bold mb-1">
        {label}
      </div>
      <div className="font-serif text-2xl">{loading ? "…" : (value ?? 0)}</div>
    </div>
  );
}

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="text-left font-bold px-3 py-2.5 whitespace-nowrap">{children}</th>
);
const Td = ({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) => <td className={`px-3 py-2.5 ${className}`} title={title}>{children}</td>;

function IconBtn({
  children,
  onClick,
  disabled,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 border rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "border-red-300 text-red-700 hover:bg-red-50"
          : "border-ink/15 text-ink/70 hover:bg-parchment hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex items-center gap-2 text-ink/50 py-4">
      <Loader2 className="size-4 animate-spin" /> Loading…
    </div>
  );
}
