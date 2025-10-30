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
          欢迎来到 TESOL 证书学习平台
        </h2>
        {/* <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          该平台聚焦展示学习模块、在线测验、Teaching Plan AI 评分与证书进度的核心流程。
        </p> */}
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
              className="inline-flex items-center justify-center rounded-full bg-[rgb(0,102,255)] px-4 py-2 font-medium text-white !text-white hover:bg-[rgb(0,92,230)] hover:text-white focus:text-white"
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
