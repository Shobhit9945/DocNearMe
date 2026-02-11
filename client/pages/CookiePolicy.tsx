import { PolicyDocument } from "@/components/PolicyDocument";

export default function CookiePolicy() {
  const sections = [
    {
      title: "What this policy covers",
      paragraphs: [
        "This Cookie Policy explains how DocNearMe uses cookies and similar technologies on our websites and patient-facing experiences.",
        "By using our services, you consent to cookie use as described in this policy, subject to your browser and device settings.",
      ],
    },
    {
      title: "What cookies are",
      paragraphs: [
        "Cookies are small text files stored on your browser or device that help websites recognize you and remember preferences.",
      ],
    },
    {
      title: "How we use cookies",
      paragraphs: [
        "We use cookies and similar technologies for reliability, security, and performance.",
      ],
      bullets: [
        "Essential cookies: Required for authentication, navigation, and secure functionality.",
        "Preference cookies: Remember settings such as language and session preferences.",
        "Analytics cookies: Help us understand usage patterns and improve performance.",
        "Security cookies: Support fraud prevention and platform abuse detection.",
      ],
    },
    {
      title: "Third-party technologies",
      paragraphs: [
        "Some analytics or service providers may set their own cookies when integrated features are loaded.",
        "Those providers are responsible for their own privacy and cookie practices.",
      ],
    },
    {
      title: "Managing cookie choices",
      paragraphs: [
        "Most browsers let you delete, block, or restrict cookies through settings. Blocking essential cookies can impact key product functionality.",
        "If you clear cookies, some saved preferences may reset and sign-in sessions may end.",
      ],
    },
    {
      title: "Policy updates and contact",
      paragraphs: [
        "We may update this policy to reflect legal, technical, or product changes. The latest version is always posted on this page.",
        "For cookie or tracking questions, contact support@docnearme.jp.",
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
      badge="Data Practices"
      title="Cookie Policy"
      summary="This policy explains how DocNearMe uses cookies and similar technologies to run, secure, and improve the service."
      effectiveDate="January 1, 2026"
      lastUpdated="January 1, 2026"
      sections={sections}
      relatedPolicies={relatedPolicies}
    />
  );
}
