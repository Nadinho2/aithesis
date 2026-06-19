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
    // Images are sent as base64 context to the AI — no OCR needed
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
