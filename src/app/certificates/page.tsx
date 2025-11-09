import { CertificateClient } from "./CertificateClient";

export default function CertificatesPage() {
  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">证书中心</h2>

      </header>
      <CertificateClient />
    </div>
  );
}
