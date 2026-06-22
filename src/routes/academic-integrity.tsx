import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/academic-integrity")({
  component: IntegrityPage,
});

function IntegrityPage() {
  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-verde mb-4">
          Policy
        </div>
        <h1 className="font-serif text-4xl md:text-5xl mb-8">Academic Integrity</h1>

        <div className="prose prose-sm max-w-none text-ink-secondary leading-[1.7] space-y-5">
          <p>
            Mybrainpadi is an all-in-one education ecosystem — a platform to help you conduct research,
            draft assignments, prepare for exams, build presentations, and create professional CVs.
            It does not replace your own intellectual work. Every idea, every analysis, every
            conclusion remains your own. Mybrainpadi helps you organise, structure, and source your
            work, but the final output — analysis, conclusions, and writing — is yours.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">1. Your Authorship</h2>
          <p>
            You are the author of every document created using Mybrainpadi. The tool provides
            structural suggestions and source discovery, much like a citation manager or a
            writing centre advisor. All intellectual work — the arguments, interpretations,
            methodology decisions, and conclusions — must come from you.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">2. Responsible Use</h2>
          <p>
            Users are expected to engage critically with every draft. Suggested text should be
            treated as a starting point — reviewed, revised, and refined through the lens of
            your own expertise and disciplinary standards. Every citation, claim, and argument
            must be verified before submission.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">3. Originality</h2>
          <p>
            Mybrainpadi does not copy from existing sources. All suggested text is produced by a
            language model trained on a broad corpus of academic writing — but the final
            intellectual work remains your own. We strongly advise running all output through
            institutional plagiarism detection tools and making substantive modifications
            to align with your voice and contribution.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">4. Citation Integrity</h2>
          <p>
            Our citation engine queries OpenAlex and Crossref in real time to surface authentic,
            peer-reviewed references. However, no automated system is perfect. You must manually
            confirm that every cited source exists, is accurately attributed, and is relevant to
            the claim it supports.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">5. Institutional Policies</h2>
          <p>
            Different universities have different policies on AI-assisted writing. It is your
            responsibility to review your institution&apos;s academic integrity guidelines and
            determine whether and how such tools may be used in your work. Mybrainpadi disclaims
            any liability for violations of institutional policies.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">6. Transparency</h2>
          <p>
            We encourage you to disclose your use of research structuring tools in your
            methodology or acknowledgments section, following evolving norms in academic
            publishing. Transparency strengthens trust in the research process.
          </p>

          <p className="italic mt-8 text-sm">
            Last updated: June 2026. If you have questions, contact our research integrity team.
          </p>
        </div>
      </div>
    </div>
  );
}
