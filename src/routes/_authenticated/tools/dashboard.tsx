import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileText, GraduationCap, Presentation, UserSquare2, BookOpen,
  Search, BookmarkCheck, Library, Sparkles, Zap, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/tools/dashboard")({
  head: () => ({ meta: [{ title: "Student Tools — Mybrainpadi" }] }),
  component: ToolsDashboardPage,
});

const researchTools = [
  {
    to: "/topic-generator",
    label: "Topic Discovery",
    desc: "Enter your department, area of interest, and country. Find up to 50 candidate topics with novelty and feasibility scores.",
    icon: Search,
    price: "Free",
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    to: "/my-topics",
    label: "My Topics",
    desc: "Review and manage every topic in your research library. Save, export, or turn them into proposals.",
    icon: BookmarkCheck,
    price: "",
    color: "bg-teal-50 text-teal-700",
  },
  {
    to: "/quick-proposal",
    label: "Draft Proposal",
    desc: "Turn a topic into a structured proposal with verified references. APA 7th or Harvard citation style.",
    icon: FileText,
    price: "₦2,000",
    color: "bg-sage/10 text-sage",
  },
  {
    to: "/proposals",
    label: "My Proposals",
    desc: "Browse, review, and continue your saved proposals. Download as PDF or DOCX.",
    icon: Library,
    price: "",
    color: "bg-teal-50 text-teal-700",
  },
  {
    to: "/new-thesis",
    label: "Draft Thesis",
    desc: "Generate a full 5-chapter thesis — Undergraduate, Master's, or PhD. APA 7th citations verified against real sources.",
    icon: Sparkles,
    price: "From ₦20,000",
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    to: "/theses",
    label: "My Theses",
    desc: "Browse, review, and continue your saved theses across all academic levels.",
    icon: BookOpen,
    price: "",
    color: "bg-teal-50 text-teal-700",
  },
];

const studentTools = [
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
  {
    to: "/tools/side-hustle",
    label: "Side Hustle Finder",
    desc: "Answer 5 questions and discover personalised side hustle ideas tailored to your skills and interests.",
    icon: Zap,
    price: "₦1,000",
    color: "bg-yellow-50 text-yellow-700",
  },
];

function ToolCard({ to, icon: Icon, label, desc, price, color }: {
  to: string; icon: any; label: string; desc: string; price: string; color: string;
}) {
  return (
    <Link
      to={to}
      className="group p-6 bg-card border border-ink/10 rounded-sm hover:border-sage/40 transition-all hover:shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-sm ${color}`}>
          <Icon className="size-5" />
        </div>
        {price && <span className="text-xs font-medium text-ink/40">{price}</span>}
      </div>
      <h3 className="font-serif text-lg mb-1.5 group-hover:text-sage transition-colors">
        {label}
      </h3>
      <p className="text-sm text-ink/60 leading-relaxed">{desc}</p>
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-sage opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ArrowRight className="size-3" />
      </div>
    </Link>
  );
}

function ToolsDashboardPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-3">
          Research &amp; Student Tools
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl mb-3">All Tools</h1>
        <p className="text-ink/60 max-w-xl text-sm">
          Academic tools to help you discover topics, draft proposals and theses, write
          assignments, prepare for exams, build presentations, and craft your CV.
        </p>
      </div>

      {/* Research Tools */}
      <div className="mb-8">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 mb-4">
          Research
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {researchTools.map((tool) => (
            <ToolCard key={tool.to} {...tool} />
          ))}
        </div>
      </div>

      {/* Student & Career Tools */}
      <div>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/40 mb-4">
          Student &amp; Career Tools
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {studentTools.map((tool) => (
            <ToolCard key={tool.to} {...tool} />
          ))}
        </div>
      </div>
    </div>
  );
}
