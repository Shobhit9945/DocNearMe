import { PageScaffold } from "@/components/PageScaffold";

export default function TermsOfService() {
  return (
    <PageScaffold>
      <div className="prose max-w-2xl mx-auto">
        <h1>Terms of Service</h1>
        <p>
          These Terms of Service ("Terms") govern your use of DocNearMe. By accessing or using our services, you agree to these Terms.
        </p>
        <h2>1. Compliance with Japanese Law</h2>
        <p>
          DocNearMe operates in accordance with Japanese laws, including the Act on the Protection of Personal Information (APPI), Medical Care Act, and related regulations. Users must not use the service for unlawful purposes.
        </p>
        <h2>2. User Responsibilities</h2>
        <ul>
          <li>Provide accurate information when using the service.</li>
          <li>Do not impersonate others or misrepresent your identity.</li>
          <li>Do not use the service for fraudulent or illegal activities.</li>
        </ul>
        <h2>3. Privacy</h2>
        <p>
          Personal information is handled in accordance with our Content Policies and Japanese privacy laws. See our Content Policies for details.
        </p>
        <h2>4. Intellectual Property</h2>
        <p>
          All trademarks and intellectual property are owned by their respective owners. You may not use content from DocNearMe without permission.
        </p>
        <h2>5. Limitation of Liability</h2>
        <p>
          DocNearMe is not liable for any damages arising from use of the service. Medical information provided is for reference only and not a substitute for professional advice.
        </p>
        <h2>6. Changes to Terms</h2>
        <p>
          We may update these Terms. Continued use constitutes acceptance of the revised Terms.
        </p>
        <h2>7. Contact</h2>
        <p>
          For questions, contact us at support@docnearme.jp.
        </p>
      </div>
    </PageScaffold>
  );
}
