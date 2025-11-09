import path from "node:path";
import fs from "node:fs/promises";
import dayjs from "dayjs";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import CloudConvert from "cloudconvert";
import { getSupabaseServiceClient } from "@/lib/supabaseServerClient";

const STORAGE_BUCKET = process.env.CERTIFICATE_STORAGE_BUCKET ?? "certificates";
const TEMPLATE_PATH = path.join(
  process.cwd(),
  "src",
  "app",
  "certificates",
  "51talk tesol证书模版.docx"
);
const cloudConvertClient = process.env.CLOUDCONVERT_API_KEY
  ? new CloudConvert(process.env.CLOUDCONVERT_API_KEY)
  : null;

type RawCertificateRow = {
  user_id: string;
  full_name: string | null;
  certificate_number: string | null;
  issued_at: string | null;
  pdf_url: string | null;
  docx_url: string | null;
  metadata: Record<string, unknown> | null;
};

export type CertificateInfo = {
  status: "not_eligible" | "eligible" | "ready";
  certificateNumber: string | null;
  fullName: string | null;
  issuedAt: string | null;
  pdfUrl: string | null;
};

export type CertificateEligibility = {
  eligible: boolean;
  completedModules: number;
  totalModules: number;
  highestScore: number | null;
};

let cachedTemplateBuffer: Buffer | null = null;

async function getTemplateBuffer(): Promise<Buffer> {
  if (!cachedTemplateBuffer) {
    cachedTemplateBuffer = await fs.readFile(TEMPLATE_PATH);
  }
  return cachedTemplateBuffer;
}

export async function getCertificateSnapshot(userId: string): Promise<{
  certificate: CertificateInfo;
  eligibility: CertificateEligibility;
}> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const [{ data: certificateRow }, eligibility, fullName] = await Promise.all([
    supabase
      .from("certificates")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<RawCertificateRow>(),
    computeEligibility(userId),
    fetchFullName(userId),
  ]);

  const record = certificateRow ?? null;

  const status: CertificateInfo["status"] = record?.pdf_url
    ? "ready"
    : eligibility.eligible
    ? "eligible"
    : "not_eligible";

  return {
    certificate: {
      status,
      certificateNumber: record?.certificate_number ?? null,
      fullName: record?.full_name ?? fullName,
      issuedAt: record?.issued_at ?? null,
      pdfUrl: record?.pdf_url ?? null,
    },
    eligibility,
  };
}

export async function claimCertificate(userId: string): Promise<CertificateInfo> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const eligibility = await computeEligibility(userId);
  if (!eligibility.eligible) {
    throw new Error("尚未满足领取证书的条件。");
  }

  const fullName = await fetchFullName(userId);
  const certificateRow = await ensureCertificateRow(userId, fullName);

  if (certificateRow.pdf_url && certificateRow.issued_at) {
    return {
      status: "ready",
      certificateNumber: certificateRow.certificate_number,
      fullName: certificateRow.full_name ?? fullName,
      issuedAt: certificateRow.issued_at,
      pdfUrl: certificateRow.pdf_url,
    };
  }

  const issueDate = dayjs();
  const certificateNumber =
    certificateRow.certificate_number ?? `CN${issueDate.format("YYYYMMDDHHmmss")}`;

  const populatedFullName = fullName ?? "TESOL Candidate";
  const docxBuffer = await buildCertificateDocx({
    fullName: populatedFullName,
    issueDate,
    certificateNumber,
  });
  const pdfBuffer = await convertDocxToPdf(docxBuffer);

  const storageKeyBase = `${userId}/${certificateNumber ?? issueDate.format("YYYYMMDDHHmmss")}`;
  const pdfKey = `${storageKeyBase}.pdf`;

  const storage = supabase.storage.from(STORAGE_BUCKET);
  const uploadPdf = await storage.upload(pdfKey, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadPdf.error) {
    throw uploadPdf.error;
  }

  const pdfUrl = storage.getPublicUrl(pdfKey).data.publicUrl;

  const { data: updated, error } = await supabase
    .from("certificates")
    .update({
      full_name: fullName,
      issued_at: issueDate.toISOString(),
      pdf_url: pdfUrl,
      docx_url: null,
    })
    .eq("user_id", userId)
    .select()
    .maybeSingle<RawCertificateRow>();

  if (error || !updated) {
    throw error ?? new Error("Failed to update certificate record.");
  }

  return {
    status: "ready",
    certificateNumber: updated.certificate_number,
    fullName: updated.full_name ?? fullName,
    issuedAt: updated.issued_at,
    pdfUrl: updated.pdf_url,
  };
}

async function computeEligibility(userId: string): Promise<CertificateEligibility> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const [{ data: modules }, { data: progress }, { data: submissions }] = await Promise.all([
    supabase.from("learning_modules").select("id"),
    supabase
      .from("module_progress")
      .select("module_id")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
    supabase
      .from("quiz_submissions")
      .select("final_score, score, status")
      .eq("user_id", userId),
  ]);

  const totalModules = modules?.length ?? 0;
  const completedModules = progress?.length ?? 0;

  const bestScore =
    submissions
      ?.filter((row) => row.status === "approved")
      .map((row) => row.final_score ?? row.score ?? 0)
      .reduce((max, value) => Math.max(max, value ?? 0), 0) ?? null;

  const eligible =
    totalModules > 0 &&
    completedModules >= totalModules &&
    (bestScore ?? 0) >= 60;

  return {
    eligible,
    completedModules,
    totalModules,
    highestScore: bestScore,
  };
}

async function fetchFullName(userId: string): Promise<string | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return null;
  }
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle<{ full_name: string | null }>();
  return data?.full_name ?? null;
}

async function ensureCertificateRow(
  userId: string,
  fullName: string | null
): Promise<RawCertificateRow> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase service client is not configured.");
  }

  const { data } = await supabase
    .from("certificates")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<RawCertificateRow>();

  if (data) {
    return data;
  }

  const { data: inserted, error } = await supabase
    .from("certificates")
    .insert({
      user_id: userId,
      full_name: fullName,
    })
    .select()
    .maybeSingle<RawCertificateRow>();

  if (error || !inserted) {
    throw error ?? new Error("无法创建证书记录。");
  }

  return inserted;
}

async function buildCertificateDocx(params: {
  fullName: string;
  issueDate: dayjs.Dayjs;
  certificateNumber: string;
}): Promise<Buffer> {
  const templateBuffer = await getTemplateBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);
  const documentEntry = zip.file("word/document.xml");
  if (!documentEntry) {
    throw new Error("证书模板缺少 word/document.xml。");
  }
  const xmlContent = await documentEntry.async("string");
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const xmlDoc = parser.parseFromString(xmlContent, "application/xml");

  replaceName(xmlDoc, params.fullName);
  replaceIssueDate(xmlDoc, params.issueDate);
  replaceCertificateNumber(xmlDoc, params.certificateNumber);

  const updatedXml = serializer.serializeToString(xmlDoc);
  zip.file("word/document.xml", updatedXml);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return Buffer.from(buffer);
}

async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  if (!cloudConvertClient) {
    throw new Error("尚未配置 CLOUDCONVERT_API_KEY，无法生成 PDF 证书。");
  }

  try {
    const job = await cloudConvertClient.jobs.create({
      tasks: {
        import_docx: { operation: "import/upload" },
        convert_docx: {
          operation: "convert",
          input: "import_docx",
          input_format: "docx",
          output_format: "pdf",
        },
        export_pdf: { operation: "export/url", input: "convert_docx" },
      },
    });

    const importTask = job.tasks?.find((task) => task.name === "import_docx");
    if (!importTask) {
      throw new Error("CloudConvert 任务初始化失败（缺少 import_docx）。");
    }
    await cloudConvertClient.tasks.upload(importTask, docxBuffer, "certificate.docx");

    const completedJob = await cloudConvertClient.jobs.wait(job.id);
    const exportTask = completedJob.tasks?.find((task) => task.name === "export_pdf");
    if (!exportTask || !exportTask.result?.files?.length) {
      throw new Error("CloudConvert 未返回可用的 PDF 文件。");
    }
    const file = exportTask.result.files[0];
    const pdfUrl = file.url;
    if (!pdfUrl) {
      throw new Error("CloudConvert 返回的文件地址无效。");
    }
    const response = await fetch(pdfUrl.toString());
    if (!response.ok) {
      throw new Error("下载 CloudConvert PDF 文件失败。");
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    if (error instanceof Error) {
      console.error("[certificate] CloudConvert error:", {
        message: error.message,
        stack: error.stack,
      });
    } else {
      console.error("[certificate] CloudConvert error:", error);
    }
    throw new Error(
      error instanceof Error
        ? `CloudConvert 调用失败：${error.message}`
        : "CloudConvert 调用失败"
    );
  }
}

function replaceName(document: Document, fullName: string) {
  const textNodes = Array.from(document.getElementsByTagName("w:t"));
  const target = textNodes.find((node) => node.textContent === "Nagelyne Pascual Africa");
  if (target) {
    target.textContent = fullName;
  }
}

function replaceIssueDate(document: Document, issueDate: dayjs.Dayjs) {
  const paragraphNodes = document.getElementsByTagName("w:p");
  for (let i = 0; i < paragraphNodes.length; i += 1) {
    const paragraph = paragraphNodes.item(i);
    if (!paragraph) continue;
    const textNodes = Array.from(paragraph.getElementsByTagName("w:t"));
    const combined = textNodes.map((node) => node.textContent ?? "").join("");
    if (!combined.includes("Date of Issue:")) {
      continue;
    }
    if (textNodes.length < 8) {
      return;
    }
    textNodes[1].textContent = ` ${issueDate.format("MMMM")} `;
    textNodes[2].textContent = issueDate.date().toString();
    const year = issueDate.year().toString();
    const firstChunk = year.slice(0, 2);
    const secondChunk = year.slice(2, 3);
    const thirdChunk = year.slice(3);
    textNodes[5].textContent = firstChunk;
    textNodes[6].textContent = secondChunk;
    textNodes[7].textContent = thirdChunk;
    break;
  }
}

function replaceCertificateNumber(document: Document, certificateNumber: string) {
  const paragraphNodes = document.getElementsByTagName("w:p");
  for (let i = 0; i < paragraphNodes.length; i += 1) {
    const paragraph = paragraphNodes.item(i);
    if (!paragraph) continue;
    const textNodes = Array.from(paragraph.getElementsByTagName("w:t"));
    const combined = textNodes.map((node) => node.textContent ?? "").join("");
    if (!combined.includes("Certificate Number:")) {
      continue;
    }
    if (textNodes.length < 5) {
      return;
    }
    const sanitized = certificateNumber.startsWith("CN")
      ? certificateNumber
      : `CN${certificateNumber}`;
    const digits = sanitized.replace(/^CN/, "");
    const firstGroup = digits.slice(0, 3).padEnd(3, "0");
    const secondGroup = digits.slice(3) || "000";

    textNodes[2].textContent = "CN";
    textNodes[3].textContent = firstGroup;
    textNodes[4].textContent = secondGroup;
    break;
  }
}
