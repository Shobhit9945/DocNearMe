import { PolicyDocument } from "@/components/PolicyDocument";

export default function ContentPolicies() {
  const sections = [
    {
      title: "Purpose and safety standards",
      paragraphs: [
        "DocNearMe maintains content standards designed to support patient safety, trust, and legal compliance.",
        "Content must be clear, respectful, and suitable for a healthcare environment.",
      ],
    },
    {
      title: "Medical and clinic information",
      paragraphs: [
        "Clinic details, specialties, and appointment information should be accurate and not misleading.",
        "Medical information published through DocNearMe is informational and should not be interpreted as individualized diagnosis or treatment instructions.",
      ],
    },
    {
      title: "Prohibited content",
      paragraphs: [
        "The following content categories are not allowed on DocNearMe.",
      ],
      bullets: [
        "False, deceptive, or manipulated information likely to mislead patients.",
        "Harassment, hate speech, threats, or discriminatory content.",
        "Promotion of illegal activity, violence, or self-harm.",
        "Unauthorized use of copyrighted or trademarked material.",
        "Spam, phishing, or malicious links.",
      ],
    },
    {
      title: "User submissions and responsibility",
      paragraphs: [
        "If you submit text, files, or records, you remain responsible for ensuring your submissions are lawful and appropriate.",
        "You must only submit information you have a right to share.",
      ],
    },
    {
      title: "Moderation and enforcement",
      paragraphs: [
        "We may review, remove, or restrict content that violates these policies or creates safety, legal, or operational risk.",
        "Repeated violations may result in temporary or permanent account restrictions.",
      ],
    },
    {
      title: "Reporting concerns",
      paragraphs: [
        "Users can report suspected policy violations by contacting support@docnearme.jp with sufficient detail for investigation.",
        "We review reports promptly and take action based on severity, supporting evidence, and legal obligations.",
      ],
    },
    {
      title: "Policy updates",
      paragraphs: [
        "These content policies may be updated to reflect product changes, legal requirements, and evolving safety standards.",
        "When updates are material, we will publish the revised date and policy version on this page.",
      ],
    },
  ];

  const relatedPolicies = [
    { label: "Terms of Service", href: "/terms-of-service" },
    { label: "Cookie Policy", href: "/cookie-policy" },
    { label: "Privacy Policy", href: "/privacy-policy" },
    { label: "Content Policies", href: "/content-policies" },
  ];

  return (
    <PolicyDocument
      badge="Trust & Safety"
      title="Content Policies"
      summary="These policies describe how content on DocNearMe is governed to protect patients, clinics, and platform integrity."
      effectiveDate="January 1, 2026"
      lastUpdated="January 1, 2026"
      sections={sections}
      relatedPolicies={relatedPolicies}
    />
  );
}
