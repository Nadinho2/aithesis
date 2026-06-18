import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-verde mb-4">
          Policy
        </div>
        <h1 className="font-serif text-4xl md:text-5xl mb-8">Terms of Service</h1>

        <div className="prose prose-sm max-w-none text-ink-secondary leading-[1.7] space-y-5">
          <h2 className="font-serif text-xl text-ink mt-8 mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using ThesisPro, you agree to be bound by these Terms of Service.
            If you do not agree, do not use the service. These terms may be updated from time to
            time; continued use after changes constitutes acceptance.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">2. Description of Service</h2>
          <p>
            ThesisPro provides an education ecosystem, including research topic discovery, proposal
            drafting, thesis structuring, assignment assistance, exam preparation, presentation
            building, and CV creation — all with citation verification. The service is offered on
            both free and paid subscription tiers. Features and pricing may change with notice.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">3. User Responsibilities</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials.
            You agree not to use the service for any unlawful purpose or in violation of your
            educational institution&apos;s policies. You are solely responsible for the content
            you create and submit using the platform.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">4. Intellectual Property</h2>
          <p>
            You retain full ownership of all research content you create using ThesisPro.
            We claim no intellectual property rights over your topics, proposals, theses, or other
            output. You grant us a limited license to store and process your content solely for
            the purpose of providing the service.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">5. Service Availability</h2>
          <p>
            We strive for high availability but do not guarantee uninterrupted access. ThesisPro
            may be temporarily unavailable for maintenance, updates, or due to factors beyond our
            control. We are not liable for any loss arising from service interruptions.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">6. Limitation of Liability</h2>
          <p>
            ThesisPro is provided &quot;as is&quot; without warranties of any kind. We are not
            liable for any damages arising from the use or inability to use the service, including
            but not limited to academic penalties, lost data, or lost opportunities. Users should
            always verify tool-generated content before academic submission.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">7. Termination</h2>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms or
            engage in abusive behaviour. You may terminate your account at any time by contacting
            support. Upon termination, your data will be deleted per our Privacy Policy.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">8. Governing Law</h2>
          <p>
            These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes
            shall be resolved through arbitration in accordance with the Arbitration and
            Conciliation Act.
          </p>

          <p className="italic mt-8 text-sm">
            Last updated: June 2026. Contact legal@thesispro.ai with questions.
          </p>
        </div>
      </div>
    </div>
  );
}
