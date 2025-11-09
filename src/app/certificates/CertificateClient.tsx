"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type CertificateInfo = {
  status: "not_eligible" | "eligible" | "ready";
  certificateNumber: string | null;
  fullName: string | null;
  issuedAt: string | null;
  pdfUrl: string | null;
};

type CertificateResponse = {
  certificate: CertificateInfo;
  eligibility: {
    eligible: boolean;
    completedModules: number;
    totalModules: number;
    highestScore: number | null;
  };
};

const statusLabel: Record<CertificateInfo["status"], string> = {
  not_eligible: "暂未满足条件",
  eligible: "可领取证书",
  ready: "证书已生成",
};

export function CertificateClient() {
  const { session, loading } = useAuth();
  const [state, setState] = useState<{
    data: CertificateResponse | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const [claiming, setClaiming] = useState(false);

  const accessToken = session?.access_token;

  useEffect(() => {
    if (loading) return;
    if (!accessToken) {
      setState({ data: null, loading: false, error: "请先登录再查看证书信息。" });
      return;
    }
    let cancelled = false;
    (async () => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const response = await fetch("/api/certificate", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "获取证书信息失败");
        }
        const payload = (await response.json()) as CertificateResponse;
        if (!cancelled) {
          setState({ data: payload, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "获取证书信息失败",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, loading]);

  const certificate = state.data?.certificate ?? null;
  const eligibility = state.data?.eligibility ?? null;

  const canClaim = certificate?.status === "eligible";
  const showPreview = certificate?.status === "ready" && Boolean(certificate.pdfUrl);

  const completionSummary = useMemo(() => {
    if (!eligibility) return "尚未加载完成";
    const { completedModules, totalModules } = eligibility;
    if (totalModules === 0) return "暂无学习模块记录";
    return `学习模块：已完成 ${completedModules} / ${totalModules}`;
  }, [eligibility]);

  if (loading && state.loading) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-500" />
          <span>正在加载证书信息...</span>
        </div>
      </section>
    );
  }

  if (state.error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50/70 p-6 text-sm text-red-700 shadow-sm">
        <p>{state.error}</p>
      </section>
    );
  }

  if (!certificate || !eligibility) {
    return null;
  }

  const highestScore =
    eligibility.highestScore != null
      ? `${eligibility.highestScore.toFixed(1)} 分`
      : "暂无成绩";

  const issuedAt = certificate.issuedAt
    ? new Date(certificate.issuedAt).toLocaleDateString()
    : "待生成";

  return (
    <section className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-500">
            TESOL Certificate
          </p>
          <h3 className="mt-2 text-xl font-semibold text-zinc-900">
            {certificate.fullName ?? "未命名学员"}
          </h3>
          <p className="text-sm text-zinc-600">
            当前状态：{statusLabel[certificate.status]}
          </p>
        </div>
        <button
          type="button"
          disabled={!canClaim || claiming}
          onClick={() => handleClaim(accessToken!, setClaiming, setState)}
          className="inline-flex items-center justify-center rounded-full bg-[rgb(0,102,255)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[rgb(0,92,230)] disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {certificate.status === "ready"
            ? "证书已生成"
            : claiming
            ? "生成中..."
            : "领取证书"}
        </button>
      </div>

      <div className="grid gap-4 text-sm text-zinc-700 md:grid-cols-2">
        <InfoBlock label="证书编号" value={certificate.certificateNumber ?? "待生成"} />
        <InfoBlock label="发放日期" value={issuedAt} />
        <InfoBlock label="学习进度" value={completionSummary} />
        <InfoBlock label="测验最高分" value={highestScore} />
      </div>

      {showPreview ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-zinc-700">证书预览</p>
          <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-zinc-200">
            <object
              key={certificate.pdfUrl ?? undefined}
              type="application/pdf"
              data={certificate.pdfUrl ?? undefined}
              className="h-full w-full"
            >
              <p className="p-4 text-sm text-zinc-600">
                浏览器不支持内嵌预览，请{" "}
                <a
                  href={certificate.pdfUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 underline"
                >
                  点击这里下载
                </a>
                。
              </p>
            </object>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href={certificate.pdfUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full border border-sky-500 px-4 py-2 font-semibold text-sky-600 hover:bg-sky-50"
            >
              下载 PDF
            </a>
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">
          证书生成后将提供 PDF 预览与下载链接。
        </p>
      )}
    </section>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-1 font-semibold text-zinc-800">{value}</dd>
    </div>
  );
}

async function handleClaim(
  token: string,
  setClaiming: (value: boolean) => void,
  setState: React.Dispatch<
    React.SetStateAction<{
      data: CertificateResponse | null;
      loading: boolean;
      error: string | null;
    }>
  >
) {
  setClaiming(true);
  try {
    const response = await fetch("/api/certificate/claim", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? "生成证书失败");
    }
    await response.json();
    const refreshed = await fetch("/api/certificate", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!refreshed.ok) {
      const body = await refreshed.json().catch(() => ({}));
      throw new Error(body.error ?? "刷新证书信息失败");
    }
    const payload = (await refreshed.json()) as CertificateResponse;
    setState({ data: payload, loading: false, error: null });
  } catch (error) {
    setState((prev) => ({
      ...prev,
      error: error instanceof Error ? error.message : "生成证书失败",
    }));
  } finally {
    setClaiming(false);
  }
}
