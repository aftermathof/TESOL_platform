import Link from "next/link";
import {
  getLearningModules,
  getProgressSnapshot,
} from "@/lib/dataService";

export default function Home() {
  return <Dashboard />;
}

async function Dashboard() {
  const [modules, progress] = await Promise.all([
    getLearningModules(),
    getProgressSnapshot(),
  ]);

  const nextModule = modules.find((module) => module.progress < 1);

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-zinc-900">
          欢迎来到 TESOL 平台 MVP
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          该 MVP 聚焦展示学习模块、在线测验、Teaching Plan AI 评分与证书进度的核心流程。
          当前未接入 SSO，所有数据来自演示样本，便于快速验证端到端体验。
        </p>
        {nextModule && (
          <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-sm text-sky-700 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-sky-900">
                下一学习任务：{nextModule.title}
              </p>
              <p>当前完成度 {(nextModule.progress * 100).toFixed(0)}%</p>
            </div>
            <Link
              href="/learning"
              className="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-600"
            >
              前往学习模块
            </Link>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <ProgressCard
          title="学习进度"
          value={`${Math.round(progress.learningCompletion * 100)}%`}
          description="已完成 TESOL 课程内容"
        />
        <ProgressCard
          title="待完成测验"
          value={progress.pendingQuizzes.toString()}
          description="仍需完成的测验次数"
        />
        <ProgressCard
          title="Teaching Plan"
          value={statusMap[progress.teachingPlanStatus]}
          description="AI 评分与人工审核状态"
        />
        <ProgressCard
          title="证书状态"
          value={statusMap[progress.certificateStatus]}
          description="满足条件后自动生成 PDF 证书"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <QuickLinks />
        <KeyMilestones />
      </section>
    </div>
  );
}

const statusMap: Record<string, string> = {
  not_submitted: "待提交",
  in_review: "审核中",
  approved: "已通过",
  not_eligible: "未达成",
  generating: "生成中",
  available: "可下载",
};

function ProgressCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-zinc-500">{title}</p>
      <p className="mt-3 text-3xl font-bold text-zinc-900">{value}</p>
      <p className="mt-2 text-sm text-zinc-600">{description}</p>
    </article>
  );
}

function QuickLinks() {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-zinc-900">快捷入口</h3>
      <ul className="mt-4 grid gap-2 text-sm text-sky-600">
        <li>
          <Link className="hover:underline" href="/learning">
            · 学习模块目录与阅读记录
          </Link>
        </li>
        <li>
          <Link className="hover:underline" href="/quiz">
            · 在线测验作答与自动批改
          </Link>
        </li>
        <li>
          <Link className="hover:underline" href="/teaching-plan">
            · Teaching Plan 填写与 AI 评分
          </Link>
        </li>
        <li>
          <Link className="hover:underline" href="/certificates">
            · 证书生成状态追踪与下载
          </Link>
        </li>
      </ul>
    </article>
  );
}

function KeyMilestones() {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-zinc-900">MVP 开发里程碑</h3>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-600">
        <li>静态数据验证学习模块展示、测验、Teaching Plan 与证书流程。</li>
        <li>接入百度 OCR 与 OpenRoute AI 接口 (使用 `.env.example` 模板配置密钥)。</li>
        <li>替换演示数据为 Supabase 表结构，实现真实读写。</li>
        <li>引入 51Talk SSO、权限体系与多角色管理后台。</li>
      </ol>
    </article>
  );
}
