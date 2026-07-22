import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, GraduationCap, Presentation, UserSquare2, BookOpen, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools/dashboard")({
  head: () => ({ meta: [{ title: "Student Tools — Mybrainpadi" }] }),
  component: ToolsDashboardPage,
});

const tools = [
  {
    to: "/tools/assignment",
    label: "Assignment Assistant",
    desc: "Upload your assignment question (text, PDF, DOCX). Get a well-structured answer with verified scholarly sources — or no references if you choose.",
    icon: FileText,
    price: "₦1,000",
    color: "bg-blue-50 text-blue-700",
  },
  {
    to: "/tools/exam",
    label: "Exam Preparation",
    desc: "Upload your notes (text, PDF, DOCX, images). Set the number and type of questions — objectives, theory, or both with custom split.",
    icon: GraduationCap,
    price: "₦1,000",
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    to: "/tools/presentation",
    label: "Presentation Assistant",
    desc: "Upload your content (text, DOCX, images). Get presentation slides with speaker notes. Download as PDF, DOCX, or PPTX.",
    icon: Presentation,
    price: "₦3,000",
    color: "bg-amber-50 text-amber-700",
  },
  {
    to: "/tools/cv",
    label: "CV Maker",
    desc: "Upload your existing CV (PDF/DOCX) to auto-fill, or use the form. Add a headshot. Get a professionally formatted CV.",
    icon: UserSquare2,
    price: "₦3,000",
    color: "bg-purple-50 text-purple-700",
  },
  {
    to: "/tools/seminar",
    label: "Seminar Paper",
    desc: "Generate a complete seminar paper in 5 academic formats — journal paper, departmental, postgraduate, technical, or book review.",
    icon: BookOpen,
    price: "₦1,500–₦3,500",
    color: "bg-sage/10 text-sage",
  },
];

function ToolsDashboardPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
          Student Tools
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl mb-3">All Tools</h1>
        <p className="text-ink/60 max-w-xl text-sm">
          Academic tools to help you write assignments, prepare for exams, build presentations, and
          craft your CV.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.to}
              to={tool.to}
              className="group p-6 bg-card border border-ink/10 rounded-sm hover:border-sage/40 transition-all hover:shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-sm ${tool.color}`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-xs font-medium text-ink/40">{tool.price}</span>
              </div>
              <h3 className="font-serif text-lg mb-1.5 group-hover:text-sage transition-colors">
                {tool.label}
              </h3>
              <p className="text-sm text-ink/60 leading-relaxed">{tool.desc}</p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-sage opacity-0 group-hover:opacity-100 transition-opacity">
                Open <ArrowRight className="size-3" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
