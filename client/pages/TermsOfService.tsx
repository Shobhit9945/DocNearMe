import { PolicyDocument } from "@/components/PolicyDocument";

export default function TermsOfService() {
  const sections = [
    {
      title: "Acceptance of these terms",
      paragraphs: [
        "These Terms of Service apply when you access or use DocNearMe websites, mobile experiences, and related services.",
        "By continuing to use the service, you confirm that you have read and accepted these terms.",
      ],
    },
    {
      title: "Service scope",
      paragraphs: [
        "DocNearMe helps patients discover clinics, submit appointment requests, and manage health-related information they choose to share.",
        "Availability of features can vary by clinic, geography, regulatory requirements, and operational needs.",
      ],
    },
    {
      title: "Medical disclaimer",
      paragraphs: [
        "DocNearMe does not provide medical diagnosis or emergency care. Content in the service is informational and does not replace professional medical advice.",
        "If you need urgent care, contact local emergency services immediately.",
      ],
    },
    {
      title: "User responsibilities",
      paragraphs: [
        "You are responsible for keeping submitted information accurate and up to date.",
      ],
      bullets: [
        "Do not impersonate another person or misrepresent eligibility for healthcare services.",
        "Do not use the platform for unlawful, fraudulent, or abusive activity.",
        "Do not attempt to disrupt service operations or access data without authorization.",
      ],
    },
    {
      title: "Accounts and security",
      paragraphs: [
        "If you create an account, you are responsible for maintaining the confidentiality of your credentials and devices.",
        "Notify us promptly if you suspect unauthorized account activity.",
      ],
    },
    {
      title: "Intellectual property",
      paragraphs: [
        "All trademarks, logos, and service marks remain the property of their respective owners.",
        "Except as explicitly allowed, you may not reproduce, distribute, or create derivative works from platform content.",
      ],
    },
    {
      title: "Limitation of liability",
      paragraphs: [
        "To the fullest extent allowed by law, DocNearMe is not liable for indirect, incidental, or consequential damages arising from use of the service.",
        "Nothing in these terms limits liability where such limitations are prohibited by applicable law.",
      ],
    },
    {
      title: "Changes and contact",
      paragraphs: [
        "We may update these terms when required by legal, security, or product changes. Continued use after updates means you accept the revised version.",
        "For legal or policy questions, contact support@docnearme.jp.",
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
      badge="Legal"
      title="Terms of Service"
      summary="These terms explain the rules, responsibilities, and limitations that apply when using DocNearMe."
      effectiveDate="January 1, 2026"
      lastUpdated="January 1, 2026"
      sections={sections}
      relatedPolicies={relatedPolicies}
    />
  );
}
