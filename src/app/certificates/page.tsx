import { getCertificateInfo } from "@/lib/dataService";

export const dynamic = "force-static";

export default async function CertificatesPage() {
  const certificate = await getCertificateInfo();

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">证书中心</h2>

      </header>
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-500">
          演示证书
        </p>
        <h3 className="mt-3 text-xl font-semibold text-zinc-900">
          {certificate.teacherName}
        </h3>
        <dl className="mt-4 grid gap-4 text-sm text-zinc-700 md:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-zinc-500">证书编号</dt>
            <dd className="mt-1 font-semibold text-zinc-800">
              {certificate.certificateId}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">预计发放时间</dt>
            <dd className="mt-1 font-semibold text-zinc-800">
              {certificate.issuedAt}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">当前状态</dt>
            <dd className="mt-1 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 font-semibold text-zinc-700">
              {certificateStatusMap[certificate.status]}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">下载链接</dt>
            <dd className="mt-1 text-zinc-600">
              {certificate.downloadUrl ? (
                <a
                  href={certificate.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-sky-600 hover:underline"
                >
                  下载 PDF
                </a>
              ) : (
                "条件达成后自动生成"
              )}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

const certificateStatusMap: Record<string, string> = {
  ready: "已可下载",
  pending: "条件达成后生成",
  locked: "未达成条件",
};
