const OCR_API_KEY = process.env.BAIDU_OCR_API_KEY;
const OCR_API_SECRET = process.env.BAIDU_OCR_API_SECRET;

type TokenCache = {
  token: string;
  expiresAt: number;
};

let cachedToken: TokenCache | null = null;

export type OcrResult = {
  text: string;
  confidence: number;
  pages: number[];
};

export async function fetchBaiduAccessToken(): Promise<string | null> {
  if (!OCR_API_KEY || !OCR_API_SECRET) {
    return null;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: OCR_API_KEY,
    client_secret: OCR_API_SECRET,
  });

  const response = await fetch(
    `https://aip.baidubce.com/oauth/2.0/token?${params.toString()}`,
    { method: "POST" }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    return null;
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 0) - 60) * 1000,
  };

  return cachedToken.token;
}

export async function requestBaiduOcr(payload: {
  fileUrl: string;
  pageRange?: [number, number];
}): Promise<OcrResult> {
  const token = await fetchBaiduAccessToken();
  if (!token) {
    throw new Error("Baidu OCR credentials are missing or invalid.");
  }

  const fileResponse = await fetch(payload.fileUrl);
  if (!fileResponse.ok) {
    throw new Error(`Failed to download file for OCR (${fileResponse.status})`);
  }

  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  const base64 = buffer.toString("base64");

  const form = new URLSearchParams({
    image: base64,
    language_type: "CHN_ENG",
  });

  const ocrResponse = await fetch(
    `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  if (!ocrResponse.ok) {
    throw new Error(`Baidu OCR responded with ${ocrResponse.status}`);
  }

  const data = (await ocrResponse.json()) as {
    words_result?: Array<{ words: string }>;
  };

  const text =
    data.words_result?.map((item) => item.words).join("\n") ??
    "No text recognised.";

  return {
    text,
    confidence: data.words_result ? 1 : 0,
    pages: payload.pageRange
      ? Array.from(
          { length: payload.pageRange[1] - payload.pageRange[0] + 1 },
          (_, index) => payload.pageRange![0] + index
        )
      : [],
  };
}
