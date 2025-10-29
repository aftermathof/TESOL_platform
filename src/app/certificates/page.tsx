import { getCertificateInfo } from "@/lib/dataService";

export const dynamic = "force-static";

export default async function CertificatesPage() {
  const certificate = await getCertificateInfo();

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">证书中心</h2>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          演示版展示如何在完成学习、测验与 Teaching Plan 后生成证书。后续将与 Supabase
          数据库及 PDF 生成服务打通。
        </p>
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
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          <h4 className="text-base font-semibold text-zinc-900">
            自动生成流程（规划中）
          </h4>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>校验学习进度、测验分数与 Teaching Plan 审核状态。</li>
            <li>调用模板渲染服务填充姓名、证书编号与出证时间。</li>
            <li>生成 PDF 并上传至 Supabase Storage，返回签名链接。</li>
            <li>向教师推送通知，同时记录证书防伪校验信息。</li>
          </ol>
        </article>
        <article className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          <h4 className="text-base font-semibold text-zinc-900">
            下一步集成计划
          </h4>
          <ul className="mt-3 space-y-2">
            <li>接入 Supabase 表记录证书生成历史与下载日志。</li>
            <li>引入二维码校验接口，验证证书真伪。</li>
            <li>支持管理员手动发放或撤销证书。</li>
            <li>与 CRM / 邮件系统联动下发证书通知。</li>
          </ul>
        </article>
      </section>
    </div>
  );
}

const certificateStatusMap: Record<string, string> = {
  ready: "已可下载",
  pending: "条件达成后生成",
  locked: "未达成条件",
};
