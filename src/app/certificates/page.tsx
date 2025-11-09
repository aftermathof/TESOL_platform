import { CertificateClient } from "./CertificateClient";

export default function CertificatesPage() {
  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">证书中心</h2>
        <p className="text-sm text-zinc-600">
          完成所有学习模块并通过测验后，即可领取官方 TESOL 证书 PDF。
        </p>
      </header>
      <CertificateClient />
    </div>
  );
}
