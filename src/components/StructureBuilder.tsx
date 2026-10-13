import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Loader2, Check, Plus, Trash2, Wand2, Edit3, BookOpen, RotateCcw, X } from "lucide-react";
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

export function parseRawOutline(text: string): ChapterTemplate[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const chapters: ChapterTemplate[] = [];
  let currentChapter: ChapterTemplate | null = null;

  const parseNum = (str: string, fallback: number): number => {
    const s = str.toLowerCase().trim();
    const wordMap: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
      i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
    };
    if (wordMap[s]) return wordMap[s];
    const n = parseInt(s, 10);
    return isNaN(n) ? fallback : n;
  };

  for (const line of lines) {
    const isExplicit = /^chapter\s+([0-9a-z]+)[\s:\-\—]*(.*)$/i.exec(line);
    const isShort = /^ch\.?\s*([0-9a-z]+)[\s:\-\—]*(.*)$/i.exec(line);
    const isNumbered = /^(\d+)[\.\s]+([A-Za-z].*)$/.exec(line);

    if (isExplicit || isShort) {
      const match = isExplicit || isShort!;
      const numStr = match[1];
      const rest = match[2]?.trim() || "";
      const order = parseNum(numStr, chapters.length + 1);
      const title = rest ? `Chapter ${order}: ${rest}` : `Chapter ${order}`;
      currentChapter = { order, title, sections: [] };
      chapters.push(currentChapter);
    } else if (isNumbered && !/^\d+\.\d+/.test(line)) {
      const order = parseInt(isNumbered[1], 10);
      const titleText = isNumbered[2].trim();
      currentChapter = { order, title: `Chapter ${order}: ${titleText}`, sections: [] };
      chapters.push(currentChapter);
    } else if (currentChapter) {
      const cleaned = line
        .replace(/^[\*\-\•\–\—\s]+/, "")
        .replace(/^\d+(?:\.\d+)+\s*[:\-\—\.\)]*\s*/, "")
        .replace(/^[a-z]\s*[\)\.\-]\s*/i, "")
        .trim();
      if (cleaned.length > 0) {
        currentChapter.sections.push(cleaned);
      }
    } else {
      currentChapter = { order: 1, title: `Chapter 1: ${line}`, sections: [] };
      chapters.push(currentChapter);
    }
  }

  return chapters.map((ch, idx) => ({
    ...ch,
    order: idx + 1,
    title: /^chapter/i.test(ch.title) ? ch.title : `Chapter ${idx + 1}: ${ch.title}`,
  }));
}

export function StructureBuilder({ documentType, onChaptersChange, initialChapters, onSelectionChange }: Props) {
  const [mode, setMode] = useState<"preset" | "custom">(initialChapters && initialChapters.length > 0 ? "custom" : "preset");
  const [selectedUni, setSelectedUni] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [chapters, setChapters] = useState<ChapterTemplate[]>(initialChapters ?? []);
  const [pasteText, setPasteText] = useState("");
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [newSectionInputs, setNewSectionInputs] = useState<Record<number, string>>({});
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);

  // Submit your university form state
  const [subName, setSubName] = useState("");
  const [subDept, setSubDept] = useState("");
  const [subStructure, setSubStructure] = useState("");
  const [subEmail, setSubEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isOther = selectedUni === UNLISTED_KEY;

  const updateChapters = (next: ChapterTemplate[]) => {
    setChapters(next);
    onChaptersChange?.(next);
  };

  // Load chapters when a known university is selected (in preset mode)
  useEffect(() => {
    if (mode !== "preset") return;
    if (!selectedUni || isOther) return;
    const pattern = getPatternForUni(selectedUni, selectedDept);
    if (!pattern) return;
    const tmpl = getTemplate(pattern);
    if (!tmpl) return;
    const raw = documentType === "proposal" ? tmpl.proposal_chapters : tmpl.thesis_chapters;
    const chs = documentType === "proposal" ? raw.filter((c) => c.order <= 3) : raw;
    updateChapters(chs);
  }, [selectedUni, selectedDept, documentType, mode]);

  // Preload Pattern A when "Other / Not listed" is selected (in preset mode)
  useEffect(() => {
    if (mode !== "preset") return;
    if (isOther) {
      const tmpl = getTemplate("A");
      const raw = documentType === "proposal" ? tmpl.proposal_chapters : tmpl.thesis_chapters;
      const chs = documentType === "proposal" ? raw.filter((c) => c.order <= 3) : raw;
      updateChapters(chs);
    }
  }, [isOther, documentType, mode]);

  const handleParsePaste = () => {
    if (!pasteText.trim()) {
      toast.error("Please paste your outline text first.");
      return;
    }
    const parsed = parseRawOutline(pasteText);
    if (parsed.length === 0) {
      toast.error("Could not detect chapter titles. Try prefixing lines with 'Chapter 1: ...'");
      return;
    }
    const totalSecs = parsed.reduce((sum, c) => sum + c.sections.length, 0);
    updateChapters(parsed);
    setMode("custom");
    setShowPasteBox(false);
    toast.success(`Loaded ${parsed.length} chapters with ${totalSecs} sub-sections.`);
  };

  const handleAddChapter = () => {
    const nextOrder = chapters.length + 1;
    const next: ChapterTemplate[] = [
      ...chapters,
      {
        order: nextOrder,
        title: `Chapter ${nextOrder}: New Chapter`,
        sections: [`${nextOrder}.1 Overview`],
      },
    ];
    updateChapters(next);
  };

  const handleRemoveChapter = (index: number) => {
    const next = chapters
      .filter((_, i) => i !== index)
      .map((c, i) => ({ ...c, order: i + 1 }));
    updateChapters(next);
  };

  const handleChapterTitleChange = (index: number, newTitle: string) => {
    const next = [...chapters];
    next[index] = { ...next[index], title: newTitle };
    updateChapters(next);
  };

  const handleAddSection = (chIndex: number) => {
    const val = (newSectionInputs[chIndex] ?? "").trim();
    if (!val) return;
    const next = [...chapters];
    next[chIndex] = {
      ...next[chIndex],
      sections: [...next[chIndex].sections, val],
    };
    updateChapters(next);
    setNewSectionInputs((prev) => ({ ...prev, [chIndex]: "" }));
  };

  const handleRemoveSection = (chIndex: number, secIndex: number) => {
    const next = [...chapters];
    next[chIndex] = {
      ...next[chIndex],
      sections: next[chIndex].sections.filter((_, i) => i !== secIndex),
    };
    updateChapters(next);
  };

  const handleMoveChapter = (index: number, dir: "up" | "down") => {
    if ((dir === "up" && index === 0) || (dir === "down" && index === chapters.length - 1)) return;
    const next = [...chapters];
    const targetIdx = dir === "up" ? index - 1 : index + 1;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    const reordered = next.map((c, i) => ({ ...c, order: i + 1 }));
    updateChapters(reordered);
  };

  const handleSubmitUniversity = async () => {
    if (!subName.trim() || !subDept.trim()) {
      toast.error("Please enter your university name and department");
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
          chapterStructure: subStructure.trim() || `${documentType === "proposal" ? "Proposal" : "Thesis"} chapters needed for ${subName.trim()} - ${subDept.trim()}`,
          email: subEmail.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSubmitDone(true);
        toast.success("Thank you! We'll review and add your university soon.");
      } else {
        toast.error(json.error ?? "Submission failed");
      }
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between border-b border-ink/10 pb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-ink/[0.04] p-1 rounded-sm">
          <button
            type="button"
            onClick={() => setMode("preset")}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all flex items-center gap-1.5 ${
              mode === "preset"
                ? "bg-white text-ink shadow-xs border border-ink/10"
                : "text-ink/60 hover:text-ink"
            }`}
          >
            <BookOpen className="size-3.5 text-sage" /> University Preset
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("custom");
              if (chapters.length === 0) setShowPasteBox(true);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all flex items-center gap-1.5 ${
              mode === "custom"
                ? "bg-white text-ink shadow-xs border border-ink/10"
                : "text-ink/60 hover:text-ink"
            }`}
          >
            <Wand2 className="size-3.5 text-sage" /> Custom Outline / Paste
          </button>
        </div>

        {chapters.length > 0 && (
          <span className="text-[11px] text-ink/50 font-medium">
            {chapters.length} chapters · {chapters.reduce((sum, c) => sum + c.sections.length, 0)} sections
          </span>
        )}
      </div>

      {/* Preset Mode Controls */}
      {mode === "preset" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-[0.15em] mb-1.5 text-ink/70">
              Select your university
            </label>
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

          {/* Department Selector */}
          {selectedUni && !isOther && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-[0.15em] mb-1.5 text-ink/70">
                Department
              </label>
              <DepartmentSelector
                value={selectedDept}
                onChange={(dept) => {
                  setSelectedDept(dept);
                  onSelectionChange?.({ university: selectedUni, department: dept });
                }}
              />
            </div>
          )}

          {/* Notice for unlisted universities */}
          {isOther && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm text-xs text-amber-900 leading-relaxed">
              We loaded Nigeria's standard university structure as a starting point. Click <strong>"Customize / Edit"</strong> below if your supervisor gave you specific chapters or headings.
            </div>
          )}
        </div>
      )}

      {/* Custom Mode: Paste Outline Box */}
      {mode === "custom" && (
        <div className="p-4 bg-ink/[0.02] border border-ink/15 rounded-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink/80 flex items-center gap-1.5">
                <Wand2 className="size-3.5 text-sage" /> Paste Supervisor Outline
              </h4>
              <p className="text-[11px] text-ink/50 mt-0.5">
                Paste any outline from Word, WhatsApp, or supervisor's notes. We will extract all chapters and subheadings instantly.
              </p>
            </div>
            {chapters.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPasteBox(!showPasteBox)}
                className="text-xs text-sage font-medium hover:underline"
              >
                {showPasteBox ? "Hide Box" : "Paste New"}
              </button>
            )}
          </div>

          {(showPasteBox || chapters.length === 0) && (
            <div className="space-y-2 pt-1">
              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`Chapter 1: Historical Evolution and Geography of Ubon Akwa
1.1 Physical environment and geographical landmarks
1.2 Traditions of origin and early migration
1.3 Inter-group relations and settlements

Chapter 2: Socio-Political Structures
2.1 Traditional administrative institutions
2.2 The chieftaincy stool and village democracy`}
                className="w-full bg-white border border-ink/20 rounded-sm p-2.5 text-xs font-mono focus:outline-none focus:border-sage leading-relaxed"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleParsePaste}
                  className="px-3.5 py-1.5 bg-sage text-white text-xs font-medium rounded-sm hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-xs"
                >
                  <Wand2 className="size-3.5" /> Parse & Apply Outline
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPasteText(
`Chapter 1: Ubon Akwa in Historical Perspective
1.1 Geographical Setting and Physical Environment
1.2 Traditions of Origin and Migration
1.3 Early Settlements and Inter-group Relations

Chapter 2: Socio-Political and Economic Institutions
2.1 Traditional Political Structure and Chieftaincy
2.2 Economic Activities, Agriculture and Trade Networks
2.3 Cultural Festivals and Religious Beliefs

Chapter 3: Colonial Impact and Transformations (1900–1960)
3.1 British Penetration and Native Court Administration
3.2 Missionary Education and Social Change
3.3 Economic Transformations and Cash Crop Production

Chapter 4: Post-Colonial Developments (1960–2025)
4.1 Local Government Reforms and Community Governance
4.2 Infrastructure, Education and Modern Development
4.3 Contemporary Challenges and Inter-Community Relations

Chapter 5: Summary, Conclusion and Recommendations
5.1 Summary of Major Historical Trajectories
5.2 General Conclusion
5.3 Recommendations for Heritage Preservation`
                    );
                  }}
                  className="text-[11px] text-ink/40 hover:text-ink hover:underline"
                >
                  Load sample historical outline
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chapter Cards / Structure View */}
      {chapters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-base text-ink">
              {mode === "custom" ? "Editable Chapter Structure" : "Chapter Structure Preview"}
            </h3>
            {mode === "preset" ? (
              <button
                type="button"
                onClick={() => setMode("custom")}
                className="text-xs text-sage font-medium hover:underline flex items-center gap-1"
              >
                <Edit3 className="size-3" /> Customize / Edit Chapters
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAddChapter}
                className="text-xs text-sage font-medium hover:underline flex items-center gap-1"
              >
                <Plus className="size-3.5" /> Add Chapter
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {chapters.map((ch, i) => (
              <div
                key={i}
                className="p-3 border border-ink/15 bg-white rounded-sm space-y-2.5 shadow-2xs transition-colors hover:border-ink/25"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-[10px] font-mono font-bold text-sage bg-sage/10 px-2 py-0.5 rounded-sm shrink-0 uppercase">
                      Ch {ch.order}
                    </span>
                    {mode === "custom" ? (
                      <input
                        type="text"
                        value={ch.title}
                        onChange={(e) => handleChapterTitleChange(i, e.target.value)}
                        className="w-full text-xs font-semibold text-ink bg-transparent border-b border-dashed border-ink/20 focus:border-sage focus:outline-none py-0.5"
                        placeholder="Chapter title"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-ink truncate">{ch.title}</span>
                    )}
                  </div>

                  {mode === "custom" && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => handleMoveChapter(i, "up")}
                        className="p-1 text-ink/40 hover:text-ink disabled:opacity-20 transition-opacity"
                        title="Move chapter up"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={i === chapters.length - 1}
                        onClick={() => handleMoveChapter(i, "down")}
                        className="p-1 text-ink/40 hover:text-ink disabled:opacity-20 transition-opacity"
                        title="Move chapter down"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                      {chapters.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChapter(i)}
                          className="p-1 text-ink/40 hover:text-red-700 transition-colors"
                          title="Remove chapter"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Sub-sections */}
                <div className="space-y-1.5 pl-2.5 border-l-2 border-ink/10">
                  <div className="flex flex-wrap gap-1.5">
                    {ch.sections.map((s, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-ink/[0.04] text-[11px] text-ink/80 border border-ink/10 rounded-sm"
                      >
                        <span>{s}</span>
                        {mode === "custom" && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(i, j)}
                            className="text-ink/30 hover:text-red-600 transition-colors"
                            title="Remove section"
                          >
                            <X className="size-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {ch.sections.length === 0 && (
                      <span className="text-[11px] text-ink/40 italic">No sub-sections added yet</span>
                    )}
                  </div>

                  {/* Add section input (custom mode only) */}
                  {mode === "custom" && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="text"
                        value={newSectionInputs[i] ?? ""}
                        onChange={(e) =>
                          setNewSectionInputs((prev) => ({ ...prev, [i]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddSection(i);
                          }
                        }}
                        placeholder={`+ Add sub-section under Chapter ${ch.order}...`}
                        className="flex-1 text-[11px] bg-bone border border-ink/15 rounded-sm px-2.5 py-1 focus:outline-none focus:border-sage"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSection(i)}
                        className="px-2.5 py-1 bg-ink text-white text-[11px] font-medium rounded-sm hover:bg-sage transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {mode === "custom" && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleAddChapter}
                className="text-xs flex items-center gap-1.5 text-sage font-medium hover:underline"
              >
                <Plus className="size-3.5" /> Add Another Chapter
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("preset");
                  if (selectedUni) {
                    const pattern = getPatternForUni(selectedUni, selectedDept);
                    const tmpl = getTemplate(pattern || "A");
                    const raw = documentType === "proposal" ? tmpl.proposal_chapters : tmpl.thesis_chapters;
                    updateChapters(documentType === "proposal" ? raw.filter((c) => c.order <= 3) : raw);
                  }
                }}
                className="text-[11px] text-ink/40 hover:text-ink flex items-center gap-1"
              >
                <RotateCcw className="size-3" /> Reset to Preset
              </button>
            </div>
          )}
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
                <p className="text-xs text-ink/60 leading-relaxed">
                  Tell us your university and department. We'll set up the correct chapter structure and add it to our list.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-ink/70">
                    Chapter Structure <span className="text-ink/40 font-normal">(optional — list your chapter titles)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full border border-ink/20 rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-sage"
                    placeholder="e.g. Chapter 1: Introduction, Chapter 2: Literature Review, Chapter 3: Methodology"
                    value={subStructure}
                    onChange={(e) => setSubStructure(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-ink/70">
                    Email <span className="text-ink/40 font-normal">(optional — so we can follow up)</span>
                  </label>
                  <input
                    type="email"
                    className="w-full border border-ink/20 rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-sage"
                    placeholder="you@example.com"
                    value={subEmail}
                    onChange={(e) => setSubEmail(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-sage text-white text-sm rounded-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                  disabled={submitting}
                  onClick={handleSubmitUniversity}
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Submit
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
