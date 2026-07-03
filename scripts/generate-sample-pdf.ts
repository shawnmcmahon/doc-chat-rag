import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const SECTIONS = [
  {
    title: "Refund Policy",
    body: "Customers may request a full refund within 30 days of purchase. Refunds are processed within 5 business days after approval.",
  },
  {
    title: "Company Overview",
    body: "Acme Docs was founded in 2019 to help teams search internal documentation. Our headquarters is in Denver, Colorado.",
  },
  {
    title: "Support",
    body: "For technical support, email support@example.com or open a ticket in the customer portal. Live chat is available weekdays 9am-5pm MT.",
  },
  {
    title: "Enterprise Plan",
    body: "The Enterprise plan includes SSO, audit logs, dedicated support, and a 99.9% uptime SLA. Enterprise contracts require a minimum of 50 seats.",
  },
  {
    title: "Data Retention",
    body: "Uploaded documents are retained for 90 days on the Starter plan and 365 days on paid plans unless deleted earlier by an administrator.",
  },
  {
    title: "Security",
    body: "All files are encrypted at rest with AES-256 and in transit with TLS 1.3. Prompt injection attempts in uploaded documents are ignored by the assistant.",
  },
  {
    title: "Billing",
    body: "Starter plans are free up to 5 users. Pro plans cost $29 per user per month when billed annually.",
  },
  {
    title: "API Limits",
    body: "The public API allows 100 requests per minute per API key. Burst traffic above the limit receives HTTP 429 responses.",
  },
  {
    title: "Onboarding",
    body: "New workspaces receive a guided onboarding checklist covering upload, indexing, and evaluation best practices.",
  },
  {
    title: "Privacy",
    body: "We do not use customer documents to train foundation models. Document content is only used to answer questions within the workspace.",
  },
];

async function main() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([612, 792]);
  let y = 740;

  page.drawText("Acme Docs Knowledge Base", {
    x: 50,
    y,
    size: 20,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 40;

  for (const section of SECTIONS) {
    if (y < 120) {
      page = pdf.addPage([612, 792]);
      y = 740;
    }

    page.drawText(section.title, {
      x: 50,
      y,
      size: 14,
      font: bold,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 24;

    const words = section.body.split(" ");
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, 12);

      if (width > 500) {
        page.drawText(line, { x: 50, y, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
        y -= 18;
        line = word;

        if (y < 80) {
          page = pdf.addPage([612, 792]);
          y = 740;
        }
      } else {
        line = candidate;
      }
    }

    if (line) {
      page.drawText(line, { x: 50, y, size: 12, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 28;
    }
  }

  const bytes = await pdf.save();
  const outputDir = path.join(process.cwd(), "eval");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "sample.pdf");
  await writeFile(outputPath, bytes);
  console.info(`Wrote ${outputPath}`);
}

void main();
