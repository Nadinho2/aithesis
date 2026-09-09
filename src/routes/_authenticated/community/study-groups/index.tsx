import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  listStudyGroups,
  createStudyGroup,
  requestToJoin,
  type StudyGroupCard,
} from "@/lib/study-groups.functions";
import {
  ArrowLeft,
  Plus,
  Search,
  Users,
  MessageCircle,
  Loader2,
  GraduationCap,
  Building2,
  BookOpen,
  Check,
  Clock,
  Send,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/community/study-groups/")({
  head: () => ({ meta: [{ title: "Study Groups — Mybrainpadi" }] }),
  component: StudyGroupsPage,
});

function GroupTag({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-paper border border-ink/10 text-ink/60">
      <Icon className="size-3" /> {label}
    </span>
  );
}

function GroupCard({
  group,
  onJoin,
  joinPending,
}: {
  group: StudyGroupCard;
  onJoin: () => void;
  joinPending: boolean;
}) {
  const statusLabel =
    group.my_status === "creator"
      ? "Creator"
      : group.my_status === "approved"
        ? "Member"
        : group.my_status === "pending"
          ? "Requested"
          : null;

  return (
    <div className="bg-card border border-ink/10 rounded-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to="/community/study-groups/$id"
            params={{ id: group.id }}
            className="font-medium text-ink hover:text-verde-dark transition-colors"
          >
            {group.name}
          </Link>
          {group.description && (
            <p className="text-sm text-ink/60 mt-1 line-clamp-2">{group.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-ink/50">
              <Users className="size-3.5" />
              {group.member_count} {group.member_count === 1 ? "member" : "members"}
            </span>
            {group.university && (
              <GroupTag icon={GraduationCap} label={group.university} />
            )}
            {group.department && <GroupTag icon={Building2} label={group.department} />}
            {group.level && <GroupTag icon={BookOpen} label={group.level} />}
          </div>
        </div>

        <div className="flex-shrink-0">
          {statusLabel === "Creator" || statusLabel === "Member" ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-medium bg-verde/10 text-verde-dark">
              <Check className="size-3.5" /> {statusLabel}
            </span>
          ) : statusLabel === "Requested" ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-medium bg-amber-bg text-amber-text">
              <Clock className="size-3.5" /> Requested
            </span>
          ) : (
            <button
              onClick={onJoin}
              disabled={joinPending}
              className="px-3 py-1.5 bg-ink text-bone rounded-sm text-xs font-medium hover:bg-sage transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {joinPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Join
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StudyGroupsPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listStudyGroups);
  const createFn = useServerFn(createStudyGroup);
  const joinFn = useServerFn(requestToJoin);

  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["study-groups", filter, query],
    queryFn: () => listFn({ data: { filter, query: query || undefined } }),
    refetchInterval: 30000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          name,
          description: description || undefined,
          university: university || undefined,
          department: department || undefined,
          level: level || undefined,
        },
      }),
    onSuccess: (res) => {
      setShowCreate(false);
      setName("");
      setDescription("");
      setUniversity("");
      setDepartment("");
      setLevel("");
      qc.invalidateQueries({ queryKey: ["study-groups"] });
      navigate({ to: "/community/study-groups/$id", params: { id: res.id } });
    },
    onError: (e) => toast.error(String(e)),
  });

  const joinMut = useMutation({
    mutationFn: (groupId: string) => joinFn({ data: { group_id: groupId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["study-groups"] });
      toast.success("Request sent. The creator will review it.");
    },
    onError: (e) => toast.error(String(e)),
  });

  return (
    <div className="flex flex-col h-full">
      {isMobile && (
        <div className="px-5 py-4 border-b border-ink/10 bg-white flex-shrink-0 flex items-center gap-3">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            aria-label="Back"
            className="size-9 rounded-lg flex items-center justify-center hover:bg-ink/5 transition-colors text-ink"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h2 className="font-serif text-lg font-bold text-ink">Community</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Study groups</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2">
                Community
              </div>
              <h1 className="font-serif text-3xl text-ink">Study Groups</h1>
              <p className="text-ink/60 text-sm mt-1">
                Form or join a group to study, share notes and stay accountable.
              </p>
            </div>
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors inline-flex items-center gap-2 flex-shrink-0"
            >
              <Plus className="size-4" /> New group
            </button>
          </div>

          {showCreate && (
            <div className="bg-card border border-ink/10 rounded-sm p-4 mb-5">
              <h3 className="font-medium text-ink mb-3">Create a study group</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-ink/40 block mb-1">
                    Group name *
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Biochemistry 300L Study Circle"
                    className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-ink/40 block mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What will you study together?"
                    rows={3}
                    className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage resize-y"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-ink/40 block mb-1">
                      University (optional)
                    </label>
                    <input
                      value={university}
                      onChange={(e) => setUniversity(e.target.value)}
                      placeholder="University"
                      className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-ink/40 block mb-1">
                      Department (optional)
                    </label>
                    <input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Department"
                      className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-ink/40 block mb-1">
                      Level (optional)
                    </label>
                    <input
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      placeholder="e.g. 300L"
                      className="w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-3 py-2 text-sm text-ink/60 hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => createMut.mutate()}
                    disabled={createMut.isPending || name.trim().length < 3}
                    className="px-4 py-2 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {createMut.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Create group
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === "all"
                  ? "bg-verde text-white border-verde"
                  : "bg-paper text-ink/60 border-ink/15 hover:border-ink/30"
              }`}
            >
              All groups
            </button>
            <button
              onClick={() => setFilter("mine")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === "mine"
                  ? "bg-verde text-white border-verde"
                  : "bg-paper text-ink/60 border-ink/15 hover:border-ink/30"
              }`}
            >
              My groups
            </button>
            <div className="flex-1" />
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search groups…"
                className="pl-9 pr-3 py-1.5 bg-paper border border-ink/15 rounded-sm text-sm focus:outline-none focus:border-sage w-40 sm:w-56"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-3 text-ink/60 py-12 justify-center">
              <Loader2 className="size-5 animate-spin" /> Loading groups…
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-card border border-ink/10 rounded-sm p-8 text-center">
              <MessageCircle className="size-8 text-sage mx-auto mb-3" />
              <h2 className="font-serif text-xl text-ink mb-1">No groups yet</h2>
              <p className="text-sm text-ink/60">
                {filter === "mine"
                  ? "You haven't joined any study groups yet."
                  : "Be the first to create a study group."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g: StudyGroupCard) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  onJoin={() => joinMut.mutate(g.id)}
                  joinPending={joinMut.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
