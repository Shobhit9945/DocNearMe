import { PolicyDocument } from "@/components/PolicyDocument";

export default function PrivacyPolicy() {
  const sections = [
    {
      title: "Scope",
      paragraphs: [
        "This Privacy Policy describes how DocNearMe collects, uses, stores, and discloses personal data when you use our services.",
        "It applies to patient users, clinic users, and visitors interacting with DocNearMe properties.",
      ],
    },
    {
      title: "Information we collect",
      paragraphs: [
        "The data we collect depends on how you use the service.",
      ],
      bullets: [
        "Identity and account data: name, email, phone number, and profile details.",
        "Appointment data: clinic selection, scheduling preferences, and visit-related notes.",
        "Technical data: device, browser, IP address, and service interaction logs.",
        "Optional health-related submissions: records or notes you choose to provide.",
      ],
    },
    {
      title: "How we use personal data",
      paragraphs: [
        "We use personal data to provide and improve the service, support appointment workflows, maintain security, and communicate important updates.",
        "Where required, we process personal data according to applicable legal obligations and user consent choices.",
      ],
    },
    {
      title: "Data sharing",
      paragraphs: [
        "We share data with clinics and service providers only when needed to deliver requested services, operate the platform, or satisfy legal obligations.",
        "We do not sell personal data.",
      ],
    },
    {
      title: "Data retention",
      paragraphs: [
        "We retain personal data only for as long as needed for service delivery, legal compliance, dispute resolution, and security requirements.",
        "Retention periods can vary based on data category and legal obligations.",
      ],
    },
    {
      title: "Data protection and user rights",
      paragraphs: [
        "We maintain administrative, technical, and organizational safeguards designed to protect personal data from unauthorized access, loss, or misuse.",
        "Subject to applicable law, you may request access, correction, deletion, or portability of your personal information.",
      ],
    },
    {
      title: "International transfers and minors",
      paragraphs: [
        "If data is transferred across borders, we implement appropriate safeguards required by applicable law.",
        "Our services are not intended for unsupervised use by children without the involvement of a parent or legal guardian where required.",
      ],
    },
    {
      title: "Policy updates and contact",
      paragraphs: [
        "We may update this policy to reflect legal, operational, or product changes. The latest version and date will be posted here.",
        "For privacy questions or requests, contact support@docnearme.jp.",
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
      badge="Data Protection"
      title="Privacy Policy"
      summary="This policy outlines what personal data DocNearMe handles, why it is used, and the choices available to users."
      effectiveDate="January 1, 2026"
      lastUpdated="January 1, 2026"
      sections={sections}
      relatedPolicies={relatedPolicies}
    />
  );
}
