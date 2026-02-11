import PageScaffold from "../components/PageScaffold";

export default function ContentPolicies() {
  return (
    <PageScaffold title="Content Policies">
      <div className="prose max-w-2xl mx-auto">
        <h1>Content Policies</h1>
        <p>
          DocNearMe is committed to compliance with Japanese laws and ethical standards. Our content policies ensure safety, privacy, and accuracy for all users.
        </p>
        <h2>1. Medical Information</h2>
        <p>
          Information provided is for reference only and not a substitute for professional medical advice. Users should consult qualified healthcare professionals for medical concerns.
        </p>
        <h2>2. Privacy and Data Protection</h2>
        <p>
          Personal data is handled in accordance with the Act on the Protection of Personal Information (APPI) and other relevant Japanese laws. We do not share personal data without consent except as required by law.
        </p>
        <h2>3. Prohibited Content</h2>
        <ul>
          <li>Content that violates Japanese law or public order.</li>
          <li>False, misleading, or fraudulent information.</li>
          <li>Hate speech, harassment, or discrimination.</li>
          <li>Unauthorized use of intellectual property.</li>
        </ul>
        <h2>4. Reporting Violations</h2>
        <p>
          Users may report content violations via support@docnearme.jp. We review reports promptly and take appropriate action.
        </p>
        <h2>5. Updates</h2>
        <p>
          Content policies may be updated. Continued use constitutes acceptance of the revised policies.
        </p>
      </div>
    </PageScaffold>
  );
}
