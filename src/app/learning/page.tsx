import { getLearningModules } from "@/lib/dataService";

export const dynamic = "force-static";

export default async function LearningPage() {
  const modules = await getLearningModules();

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">学习模块</h2>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          演示版展示了 TESOL 课程内容如何在平台内进行模块化管理。后续将由 OCR
          解析的文档内容填充至此，并记录教师学习进度。
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <article
            key={module.id}
            className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-500">
                {module.id.toUpperCase()}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-zinc-900">
                {module.title}
              </h3>
              <p className="mt-2 text-sm text-zinc-600">{module.description}</p>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500">
                <span>完成度</span>
                <span>{Math.round(module.progress * 100)}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-zinc-100">
                <div
                  className="h-2 rounded-full bg-sky-500 transition-all"
                  style={{ width: `${Math.max(module.progress * 100, 4)}%` }}
                />
              </div>
            </div>
            <ul className="space-y-3 text-sm text-zinc-600">
              {module.sections.map((section) => (
                <li
                  key={section.id}
                  className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
                    <span>{section.title}</span>
                    <span>{section.duration}</span>
                  </div>
                  <p className="mt-2 text-zinc-600">{section.content}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
