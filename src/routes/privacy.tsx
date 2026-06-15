import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <div className="max-w-3xl mx-auto px-6 py-20">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-verde mb-4">
          Policy
        </div>
        <h1 className="font-serif text-4xl md:text-5xl mb-8">Privacy Policy</h1>

        <div className="prose prose-sm max-w-none text-ink-secondary leading-[1.7] space-y-5">
          <h2 className="font-serif text-xl text-ink mt-8 mb-3">1. Information We Collect</h2>
          <p>
            When you sign up for ThesisPro AI, we collect your email address and a user profile
            name. We also store the research topics, proposals, theses, and other content you
            generate or upload while using the platform. Payment information is processed by
            Paystack; we do not store credit card details.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">2. How We Use Your Data</h2>
          <p>
            Your research content is stored to provide the service: to save your topics, proposals,
            and theses so you can access them across sessions. We do not train language models on
            your content. We do not sell your data to third parties. Aggregated, anonymised usage
            statistics may be used to improve the product.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">3. Data Retention</h2>
          <p>
            Your account and content remain accessible as long as your account is active. If you
            delete your account, all associated research content is permanently removed within 30
            days. Backup copies may persist for up to 90 days before full erasure.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">4. Third-Party Services</h2>
          <p>
            ThesisPro integrates with Clerk (authentication), Supabase (database), Paystack
            (payments), OpenAlex and Crossref (citation lookup). Each service has its own privacy
            policy governing how it handles your data. We only share the minimum data necessary
            for each service to function.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">5. Security</h2>
          <p>
            All data is encrypted in transit (TLS 1.3) and at rest. We use industry-standard
            security practices, including regular audits and access controls. No system is
            completely secure, but we take reasonable measures to protect your information.
          </p>

          <h2 className="font-serif text-xl text-ink mt-8 mb-3">6. Your Rights</h2>
          <p>
            You may request a copy of your data, request deletion, or update your information at
            any time by contacting our support team. Under applicable law, you have the right to
            know what data we hold and to have it corrected or erased.
          </p>

          <p className="italic mt-8 text-sm">
            Last updated: June 2026. Questions? Contact privacy@thesispro.ai.
          </p>
        </div>
      </div>
    </div>
  );
}
