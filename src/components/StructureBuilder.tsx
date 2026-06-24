import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { universities } from "@/lib/seeds/universities";
import { getTemplate, universityPatternMap, engineeringDepartments, type ChapterTemplate } from "@/lib/seeds/templates";

type Props = {
  documentType: "proposal" | "thesis";
  onChaptersChange?: (chapters: ChapterTemplate[]) => void;
  initialChapters?: ChapterTemplate[];
  onSelectionChange?: (selection: { university: string; department: string }) => void;
};

// Shorten the full names for the dropdown display
const FULL_NAMES: Record<string, string> = {};
for (const u of universities) {
  FULL_NAMES[u.short_name] = u.name;
}

const UNLISTED_KEY = "__other__";

export function StructureBuilder({ documentType, onChaptersChange, initialChapters, onSelectionChange }: Props) {
  const [selectedUni, setSelectedUni] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [chapters, setChapters] = useState<ChapterTemplate[]>(initialChapters ?? []);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);

  // Submit your university form state
  const [subName, setSubName] = useState("");
  const [subDept, setSubDept] = useState("");
  const [subStructure, setSubStructure] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isOther = selectedUni === UNLISTED_KEY;

  // Load chapters when a known university is selected
  useEffect(() => {
    if (!selectedUni || isOther) return;
    const pattern = getPatternForUni(selectedUni, selectedDept);
    if (!pattern) return;
    const tmpl = getTemplate(pattern);
    if (!tmpl) return;
    const raw = documentType === "proposal" ? tmpl.proposal_chapters : tmpl.thesis_chapters;
    const chs = documentType === "proposal" ? raw.filter((c) => c.order <= 3) : raw;
    setChapters(chs);
    onChaptersChange?.(chs);
  }, [selectedUni, selectedDept, documentType]);

  // Preload Pattern A when "Other / Not listed" is selected
  useEffect(() => {
    if (isOther) {
      const tmpl = getTemplate("A");
      const raw = documentType === "proposal" ? tmpl.proposal_chapters : tmpl.thesis_chapters;
      const chs = documentType === "proposal" ? raw.filter((c) => c.order <= 3) : raw;
      setChapters(chs);
      onChaptersChange?.(chs);
    }
  }, [isOther, documentType]);

  const handleSubmitUniversity = async () => {
    if (!subName.trim() || !subDept.trim() || !subStructure.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/submit-university", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityName: subName.trim(),
          department: subDept.trim(),
          chapterStructure: subStructure.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitDone(true);
        toast.success("Thank you! We'll review and add your university soon.");
      } else {
        toast.error(json.error ?? "Submission failed");
      }
    } catch (e) {
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* University Selector */}
      <div>
        <label className="block text-sm font-medium mb-1 text-ink">Select your university</label>
        <select
          className="w-full border border-ink/20 rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-sage"
          value={selectedUni}
          onChange={(e) => {
            setSelectedUni(e.target.value);
            setSelectedDept("");
            onSelectionChange?.({ university: e.target.value, department: "" });
          }}
        >
          <option value="">Select your university</option>
          {universities.map((u) => (
            <option key={u.short_name} value={u.short_name}>
              {u.name} ({u.short_name})
            </option>
          ))}
          <option value={UNLISTED_KEY}>Other / Not listed</option>
        </select>
      </div>

      {/* Department Selector (only for known universities) */}
      {selectedUni && !isOther && (
        <div>
          <label className="block text-sm font-medium mb-1 text-ink">Department</label>
          <DepartmentSelector value={selectedDept} onChange={(dept) => { setSelectedDept(dept); onSelectionChange?.({ university: selectedUni, department: dept }); }} />
        </div>
      )}

      {/* Notice for unlisted universities */}
      {isOther && (
        <div className="p-4 bg-ink/5 border border-ink/10 rounded-sm text-sm text-ink/80 leading-relaxed">
          We don't have your university yet. We've loaded the standard Nigerian university
          structure as a starting point — edit the chapters to match your department's exact format.
        </div>
      )}

      {/* Chapter Editor */}
      {chapters.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-serif text-lg text-ink">Chapter Structure</h3>
          {chapters.map((ch, i) => (
            <div key={i} className="p-3 border border-ink/10 rounded-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-ink">{ch.title}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {ch.sections.map((s, j) => (
                  <span key={j} className="px-2 py-0.5 bg-ink/5 text-[11px] text-ink/70 border border-ink/10 rounded-sm">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Your University Form */}
      <div className="border-t border-ink/10 pt-4">
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-ink/60 hover:text-ink transition-colors"
          onClick={() => setShowSubmitForm(!showSubmitForm)}
        >
          {showSubmitForm ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          Help us add your university
        </button>

        {showSubmitForm && (
          <div className="mt-3 p-4 bg-ink/[0.02] border border-ink/10 rounded-sm">
            {submitDone ? (
              <div className="flex items-center gap-2 text-sm text-sage">
                <Check className="size-4" />
                Thank you! We'll review and add your university soon.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-ink/70">University Name</label>
                  <input
                    type="text"
                    className="w-full border border-ink/20 rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-sage"
                    placeholder="e.g. University of Lagos"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-ink/70">Department</label>
                  <input
                    type="text"
                    className="w-full border border-ink/20 rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-sage"
                    placeholder="e.g. Computer Science"
                    value={subDept}
                    onChange={(e) => setSubDept(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-ink/70">Chapter Structure</label>
                  <textarea
                    className="w-full border border-ink/20 rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-sage resize-y min-h-[100px]"
                    placeholder="Paste or describe your chapter titles and sub-sections, e.g. Chapter One: Introduction — Background to the Study, Statement of the Problem..."
                    value={subStructure}
                    onChange={(e) => setSubStructure(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-sage text-white text-sm rounded-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                  disabled={submitting}
                  onClick={handleSubmitUniversity}
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Submit Structure
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Department Selector ───

const DEPARTMENTS_BY_PATTERN = [
  "Computer Science", "Mathematics", "Physics", "Chemistry", "Biology",
  "Biochemistry", "Microbiology", "Statistics", "Sociology",
  "Political Science", "Mass Communication", "Psychology", "Economics",
  "Geography", "Business Administration", "Accounting", "Banking and Finance",
  "Marketing", "Insurance", "Education/Computer Science",
  "Education/Mathematics", "Education/English", "Guidance and Counselling",
  "Nursing", "Pharmacy", "Public Health", "Medical Laboratory Science",
  "Human and Personnel Management", "Public Administration",
  "Electrical Engineering", "Civil Engineering", "Mechanical Engineering",
  "Chemical Engineering", "Computer Engineering",
];

function DepartmentSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      className="w-full border border-ink/20 rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-sage"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select your department</option>
      {DEPARTMENTS_BY_PATTERN.map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  );
}

// ─── Pattern resolution helper ───

function getPatternForUni(shortName: string, department: string): string {
  const base = universityPatternMap[shortName];
  if (!base) return "A";

  // Engineering override for UNIPORT and ABU
  if ((shortName === "UNIPORT" || shortName === "ABU") && engineeringDepartments.includes(department)) {
    return "C";
  }

  // Comp Sci at FUTO/FUTA uses Pattern C
  if ((shortName === "FUTO" || shortName === "FUTA") && department === "Computer Science") {
    return "C";
  }

  return base;
}
