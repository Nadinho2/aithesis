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
            ThesisPro AI is designed as a research assistant — a tool to accelerate literature
            discovery, topic exploration, and structural drafting. It is not a substitute for
            independent thought, original analysis, or the scholarly judgment that defines genuine
            academic work.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">1. Responsible Use</h2>
          <p>
            Users are expected to engage critically with every output. AI-generated drafts should
            be treated as a starting point — reviewed, revised, and refined through the lens of
            the user&apos;s own expertise and disciplinary standards. Every citation, claim, and
            argument must be verified before submission.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">2. Plagiarism and Originality</h2>
          <p>
            ThesisPro does not copy from existing sources. All generated text is produced by a
            language model trained on a broad corpus of academic writing — but the final
            intellectual work remains the user&apos;s own. We strongly advise running all output
            through institutional plagiarism detection tools and making substantive modifications
            to align with your voice and contribution.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">3. Citation Integrity</h2>
          <p>
            Our citation engine queries OpenAlex and Crossref in real time to surface authentic,
            peer-reviewed references. However, no automated system is perfect. Users must manually
            confirm that every cited source exists, is accurately attributed, and is relevant to
            the claim it supports. Fabricated or hallucinated citations are the user&apos;s
            responsibility to catch.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">4. Institutional Policies</h2>
          <p>
            Different universities have different policies on AI-assisted writing. It is the
            user&apos;s responsibility to review their institution&apos;s academic integrity
            guidelines and determine whether and how AI tools may be used in their work.
            ThesisPro AI disclaims any liability for violations of institutional policies.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">5. Transparency</h2>
          <p>
            We encourage users to disclose their use of AI writing tools in their methodology or
            acknowledgments section, following evolving norms in academic publishing. Transparency
            strengthens trust in the research process.
          </p>

          <p className="italic mt-8 text-sm">
            Last updated: June 2026. If you have questions, contact our research integrity team.
          </p>
        </div>
      </div>
    </div>
  );
}
