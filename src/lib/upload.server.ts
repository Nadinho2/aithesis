// Shared file upload parsing — PDF, DOCX, images
import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";

export async function parseUploadedFile(
  base64: string,
  mimeType: string,
  fileName: string,
): Promise<{ text: string; images: string[] }> {
  const buffer = Buffer.from(base64, "base64");
  const text: string[] = [];
  const images: string[] = [];

  if (mimeType === "application/pdf") {
    const pdfParse: any = await import("pdf-parse");
    const data = await pdfParse.default(buffer);
    text.push(data.text);
  } else if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    text.push(result.value);
  } else if (mimeType.startsWith("image/")) {
    images.push(`data:${mimeType};base64,${base64}`);
    // Try OCR for text extraction (tesseract.js may not be installed)
    try {
      let Tesseract: any;
      try { Tesseract = await import("tesseract.js"); } catch { Tesseract = null; }
      if (Tesseract?.recognize) {
        const { data } = await Tesseract.recognize(buffer, "eng");
        if (data.text.trim()) text.push(data.text);
      }
    } catch {
      // OCR failed — image will be sent as base64 context
    }
  } else {
    // Plain text fallback
    text.push(buffer.toString("utf-8"));
  }

  return { text: text.join("\n\n").trim(), images };
}

export const uploadFile = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        base64: z.string().min(1),
        mimeType: z.string().min(1),
        fileName: z.string().min(1),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    return parseUploadedFile(data.base64, data.mimeType, data.fileName);
  });
