import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  saveMyProfile,
  type Profile,
  type LearnerType,
  type ExamTrack,
} from "@/lib/profile.functions";
import { listUniversities } from "@/lib/universities.functions";
import { GraduationCap, BookOpen, Briefcase, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

const LEVELS = ["100", "200", "300", "400", "500", "600", "Postgraduate"];
const CLASS_LEVELS = ["SS1", "SS2", "SS3", "JAMB Candidate"];

const EXAMS: { value: ExamTrack; label: string }[] = [
  { value: "waec", label: "WAEC" },
  { value: "neco", label: "NECO" },
  { value: "jamb", label: "JAMB" },
];

const LEARNER_OPTIONS: { value: LearnerType; label: string; desc: string; icon: any }[] = [
  { value: "university", label: "University student", desc: "Tertiary — undergraduate or postgraduate", icon: GraduationCap },
  { value: "pre_university", label: "Pre-university", desc: "WAEC / NECO / JAMB candidate", icon: BookOpen },
  { value: "professional", label: "Professional / Agency", desc: "Writing for clients, not a student", icon: Briefcase },
];

const inputCls =
  "w-full bg-paper border border-ink/15 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage";

export function ProfileForm({
  initialProfile,
  onSaved,
}: {
  initialProfile: Profile | null;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveMyProfile);
  const listUnisFn = useServerFn(listUniversities);

  const { data: universities = [] } = useQuery({
    queryKey: ["universities"],
    queryFn: () => listUnisFn(),
  });

  const [learnerType, setLearnerType] = useState<LearnerType>(
    initialProfile?.learner_type ?? "university",
  );
  const [university, setUniversity] = useState(initialProfile?.university ?? "");
  const [department, setDepartment] = useState(initialProfile?.department ?? "");
  const [level, setLevel] = useState(initialProfile?.level ?? "");
  const [examTracks, setExamTracks] = useState<ExamTrack[]>(initialProfile?.exam_tracks ?? []);
  const [classLevel, setClassLevel] = useState(initialProfile?.class_level ?? "");

  const selectedUni = universities.find((u) => u.name === university);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          learner_type: learnerType,
          university,
          department,
          level,
          exam_tracks: examTracks,
          class_level: classLevel,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile saved.");
      onSaved();
    },
    onError: (e) => toast.error(String(e)),
  });

  function toggleExam(track: ExamTrack) {
    setExamTracks((prev) =>
      prev.includes(track) ? prev.filter((t) => t !== track) : [...prev, track],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (learnerType === "university" && !university.trim()) {
      toast.error("Please enter your university.");
      return;
    }
    if (learnerType === "pre_university" && examTracks.length === 0) {
      toast.error("Select at least one exam track.");
      return;
    }
    saveMut.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-2 block">
          I am a…
        </label>
        <div className="grid sm:grid-cols-3 gap-3">
          {LEARNER_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = learnerType === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setLearnerType(opt.value)}
                className={`text-left p-4 rounded-sm border transition-all ${
                  active
                    ? "border-ink bg-ink/5 ring-1 ring-ink/20"
                    : "border-ink/10 hover:border-sage/40"
                }`}
              >
                <Icon className={`size-5 mb-2 ${active ? "text-sage" : "text-ink/40"}`} />
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-ink/50 mt-0.5">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {learnerType === "university" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-1 block">
              University
            </label>
            <select
              value={university}
              onChange={(e) => {
                setUniversity(e.target.value);
                setDepartment("");
              }}
              className={inputCls}
            >
              <option value="">Select university</option>
              {universities.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-1 block">
              Department / Faculty
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={inputCls}
              disabled={!university}
            >
              <option value="">Select department</option>
              {(selectedUni?.departments ?? []).map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-1 block">
              Level
            </label>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={inputCls}>
              <option value="">Select level</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {learnerType === "pre_university" && (
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-2 block">
              Which exam(s) are you preparing for?
            </label>
            <div className="flex flex-wrap gap-2">
              {EXAMS.map((e) => {
                const active = examTracks.includes(e.value);
                return (
                  <button
                    type="button"
                    key={e.value}
                    onClick={() => toggleExam(e.value)}
                    className={`px-3 py-1.5 rounded-sm border text-sm transition-colors ${
                      active
                        ? "bg-ink text-bone border-ink"
                        : "border-ink/15 text-ink/60 hover:bg-ink/5"
                    }`}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink/60 mb-1 block">
              Class
            </label>
            <select value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className={inputCls}>
              <option value="">Select class</option>
              {CLASS_LEVELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {learnerType === "professional" && (
        <p className="text-sm text-ink/50">No extra details needed — you're all set.</p>
      )}

      <button
        type="submit"
        disabled={saveMut.isPending}
        className="px-5 py-2.5 bg-ink text-bone rounded-sm text-sm font-medium hover:bg-sage transition-colors flex items-center gap-2 disabled:opacity-60"
      >
        {saveMut.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Check className="size-4" /> Save &amp; continue
          </>
        )}
      </button>
    </form>
  );
}
