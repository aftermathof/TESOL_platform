import { CertificateClient } from "./CertificateClient";

export default function CertificatesPage() {
  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">Certificate Center</h2>
        <p className="text-sm text-zinc-600">
          Track your eligibility and download your TESOL certificate here once it is issued.
        </p>
      </header>
      <CertificateClient />
    </div>
  );
}
