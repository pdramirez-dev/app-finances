import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "pdf-lib";

export type InvoicePdfData = {
  issuer: {
    name: string;
    legalName?: string | null;
    taxId?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  bank?: {
    bankName?: string | null;
    beneficiaryName?: string | null;
    accountNumberMasked?: string | null;
    routingNumberMasked?: string | null;
    ibanMasked?: string | null;
    swiftCode?: string | null;
  } | null;
  invoice: {
    label: string;
    date: string;
    dueDate?: string | null;
    weekNumber: number;
    billToName: string;
    billToAddress: string;
    project: string;
    currency: string;
    notes?: string | null;
    grandTotal: number;
    sections: Array<{
      title: string;
      total: number;
      lineItems: Array<{ description: string; quantity: number; amount: number }>;
    }>;
  };
};

// Characters the standard (WinAnsi) PDF fonts can draw beyond printable ASCII.
const WIN_ANSI_EXTRAS = new Set(Array.from("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"));

// Letters NFKD does not decompose into an ASCII base.
const TRANSLITERATIONS: Record<string, string> = { Ł: "L", ł: "l", Đ: "D", đ: "d", ı: "i", ħ: "h", Ħ: "H" };

function isWinAnsi(char: string) {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(char);
}

/**
 * Standard PDF fonts only cover WinAnsi; anything else would make pdf-lib throw
 * and fail the whole send. Accents are stripped when possible, the rest becomes "?".
 */
export function toWinAnsi(value: string | null | undefined): string {
  return Array.from((value ?? "").replace(/\t/g, " ").replace(/\r\n?/g, "\n"))
    .map((char) => {
      if (char === "\n" || isWinAnsi(char)) return char;
      if (TRANSLITERATIONS[char]) return TRANSLITERATIONS[char];
      const stripped = char.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      return stripped && Array.from(stripped).every(isWinAnsi) ? stripped : "?";
    })
    .join("");
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function quantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function displayDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${month}/${day}/${year}` : value;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of toWinAnsi(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      // Hard-break single words that are wider than the column.
      while (font.widthOfTextAtSize(line, size) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

const PAGE = { width: 612, height: 792, margin: 48 }; // US Letter
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.4, 0.45, 0.52);
const RULE = rgb(0.85, 0.87, 0.9);

export async function renderInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(`Invoice ${data.invoice.label}`));
  pdf.setAuthor(toWinAnsi(data.issuer.name));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  const contentWidth = right - PAGE.margin;

  const ensureSpace = (needed: number) => {
    if (y - needed >= PAGE.margin) return;
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
  };
  const text = (value: string, x: number, size: number, font = regular, color = INK) => {
    page.drawText(toWinAnsi(value), { x, y, size, font, color });
  };
  const textRight = (value: string, xRight: number, size: number, font = regular, color = INK) => {
    const safe = toWinAnsi(value);
    page.drawText(safe, { x: xRight - font.widthOfTextAtSize(safe, size), y, size, font, color });
  };
  const paragraph = (value: string, x: number, width: number, size: number, font = regular, color = INK) => {
    for (const line of wrap(value, font, size, width)) {
      ensureSpace(size + 4);
      text(line, x, size, font, color);
      y -= size + 4;
    }
  };

  // Header: issuer on the left, invoice facts on the right.
  text("INVOICE", PAGE.margin, 10, bold, MUTED);
  textRight(`Invoice Number: ${data.invoice.label}`, right, 10, bold);
  y -= 22;
  text(data.issuer.legalName || data.issuer.name, PAGE.margin, 18, bold);
  textRight(`Date: ${displayDate(data.invoice.date)}`, right, 10);
  y -= 16;
  const facts = [
    data.invoice.dueDate ? `Due Date: ${displayDate(data.invoice.dueDate)}` : null,
    `Week Number: ${data.invoice.weekNumber}`,
  ].filter((value): value is string => Boolean(value));
  const issuerLines = [
    data.issuer.taxId ? `Tax ID: ${data.issuer.taxId}` : null,
    ...(data.issuer.address ? wrap(data.issuer.address, regular, 9, contentWidth / 2) : []),
    data.issuer.email ?? null,
    data.issuer.phone ?? null,
  ].filter((value): value is string => Boolean(value));
  for (let index = 0; index < Math.max(facts.length, issuerLines.length); index += 1) {
    if (issuerLines[index]) text(issuerLines[index], PAGE.margin, 9, regular, MUTED);
    if (facts[index]) textRight(facts[index], right, 10);
    y -= 13;
  }

  y -= 12;
  text("BILL TO", PAGE.margin, 9, bold, MUTED);
  text("PROJECT", PAGE.margin + contentWidth / 2, 9, bold, MUTED);
  y -= 14;
  const billTo = [data.invoice.billToName, ...wrap(data.invoice.billToAddress, regular, 10, contentWidth / 2 - 12)];
  const project = wrap(data.invoice.project, regular, 10, contentWidth / 2);
  for (let index = 0; index < Math.max(billTo.length, project.length); index += 1) {
    if (billTo[index]) text(billTo[index], PAGE.margin, 10, index === 0 ? bold : regular);
    if (project[index]) text(project[index], PAGE.margin + contentWidth / 2, 10);
    y -= 14;
  }

  // Line items, one table per section.
  const columns = { qty: right - 190, amount: right - 100, total: right };
  for (const section of data.invoice.sections) {
    y -= 14;
    ensureSpace(60);
    text(section.title, PAGE.margin, 12, bold);
    y -= 18;
    text("DESCRIPTION", PAGE.margin, 8, bold, MUTED);
    textRight("QTY", columns.qty, 8, bold, MUTED);
    textRight("AMOUNT", columns.amount, 8, bold, MUTED);
    textRight("TOTAL", columns.total, 8, bold, MUTED);
    y -= 6;
    page.drawLine({ start: { x: PAGE.margin, y }, end: { x: right, y }, thickness: 0.5, color: RULE });
    y -= 12;
    for (const item of section.lineItems) {
      const descriptionLines = wrap(item.description, regular, 10, columns.qty - PAGE.margin - 60);
      ensureSpace(descriptionLines.length * 13 + 4);
      textRight(quantity(item.quantity), columns.qty, 10);
      textRight(money(item.amount, data.invoice.currency), columns.amount, 10);
      textRight(money(item.quantity * item.amount, data.invoice.currency), columns.total, 10);
      for (const line of descriptionLines) {
        text(line, PAGE.margin, 10);
        y -= 13;
      }
    }
    ensureSpace(20);
    textRight(`Subtotal: ${money(section.total, data.invoice.currency)}`, right, 10, bold);
    y -= 8;
  }

  y -= 10;
  ensureSpace(30);
  page.drawLine({ start: { x: PAGE.margin, y: y + 8 }, end: { x: right, y: y + 8 }, thickness: 1, color: INK });
  y -= 10;
  textRight(`Grand Total: ${money(data.invoice.grandTotal, data.invoice.currency)}`, right, 14, bold);
  y -= 28;

  if (data.invoice.notes) {
    ensureSpace(30);
    text("NOTES", PAGE.margin, 9, bold, MUTED);
    y -= 14;
    paragraph(data.invoice.notes, PAGE.margin, contentWidth, 10);
    y -= 8;
  }

  const bank = data.bank;
  const bankLines = bank
    ? [
        bank.beneficiaryName ? `Beneficiary: ${bank.beneficiaryName}` : null,
        bank.bankName ? `Bank: ${bank.bankName}` : null,
        bank.accountNumberMasked ? `Account Number: ${bank.accountNumberMasked}` : null,
        bank.routingNumberMasked ? `Routing Number: ${bank.routingNumberMasked}` : null,
        bank.ibanMasked ? `IBAN: ${bank.ibanMasked}` : null,
        bank.swiftCode ? `SWIFT: ${bank.swiftCode}` : null,
      ].filter((value): value is string => Boolean(value))
    : [];
  if (bankLines.length) {
    ensureSpace(20 + bankLines.length * 13);
    text("PAYMENT DETAILS", PAGE.margin, 9, bold, MUTED);
    y -= 14;
    for (const line of bankLines) {
      text(line, PAGE.margin, 10);
      y -= 13;
    }
  }

  return pdf.save();
}
