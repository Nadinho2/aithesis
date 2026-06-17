import { useEffect, useState } from "react";
import { Lightbulb, Sparkles, BookOpen, GraduationCap, Globe, Microscope, Loader2 } from "lucide-react";

const facts = [
  {
    icon: Lightbulb,
    text: "The first university in Africa, the University of al-Qarawiyyin in Morocco, was founded in 859 AD — predating Oxford by nearly 200 years.",
  },
  {
    icon: Microscope,
    text: "Peer review — the foundation of academic publishing — was first introduced by the Royal Society of London in 1665.",
  },
  {
    icon: BookOpen,
    text: "Nigerian academics publish over 20,000 scholarly articles annually, making Nigeria one of Africa's largest research producers.",
  },
  {
    icon: GraduationCap,
    text: "The PhD degree originated in medieval European universities, but the first earned doctorate in Africa was awarded in 1928.",
  },
  {
    icon: Sparkles,
    text: "APA 7th edition — the most widely used citation style in the social sciences — was published in October 2019.",
  },
  {
    icon: Globe,
    text: "OpenAlex indexes over 200 million scholarly works and is completely free to use — it's the database behind every citation we find.",
  },
  {
    icon: Lightbulb,
    text: "The average PhD dissertation contains about 80,000 words — roughly the length of a 300-page book.",
  },
  {
    icon: BookOpen,
    text: "Nigeria's National Universities Commission (NUC) was established in 1962 to regulate university education across the country.",
  },
  {
    icon: Microscope,
    text: "The word 'research' comes from the Old French 'recercher', meaning 'to seek out' or 'search closely'.",
  },
  {
    icon: GraduationCap,
    text: "Cross-sectional surveys are the most common research design in Nigerian undergraduate and Master's theses in the social sciences.",
  },
];

function pickDayFact(): number {
  const day = new Date().getDate();
  return day % facts.length;
}

export default function WhileYouWait({ onDismiss }: { onDismiss: () => void }) {
  const [index, setIndex] = useState(pickDayFact());
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % facts.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 120000);
    return () => clearTimeout(timeout);
  }, [onDismiss]);

  if (!visible) return null;

  const fact = facts[index];
  const Icon = fact.icon;

  return (
    <div className="bg-gradient-to-br from-[#FAF8F3] to-[#F5F0E6] border border-[#E5E2D8] rounded-sm p-5 mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Loading spinner section */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="relative flex size-8 items-center justify-center">
            <Loader2 className="size-5 text-verde animate-spin" />
            <span className="absolute inset-0 size-8 rounded-full border-2 border-verde/20 animate-ping" />
          </span>
          <span className="text-xs font-medium text-verde whitespace-nowrap">
            Drafting…
          </span>
        </div>

        {/* Trivia section */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink/80 leading-relaxed">{fact.text}</p>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[10px] text-ink/30 font-medium uppercase tracking-wider">
              Did you know?
            </span>
            <div className="flex gap-1.5">
              {facts.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? "bg-verde scale-110" : "bg-ink/15"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => {
                setVisible(false);
                onDismiss();
              }}
              className="ml-auto text-[11px] text-ink/30 hover:text-ink/60 transition-colors uppercase tracking-wider"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 bg-ink/5 rounded-full overflow-hidden">
        <div className="h-full bg-verde/40 rounded-full animate-[progress_120s_linear]" />
      </div>
      <style>{`@keyframes progress { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>
  );
}
