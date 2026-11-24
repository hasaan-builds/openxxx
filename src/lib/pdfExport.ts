import { jsPDF } from 'jspdf';
import type { LeadMagnet, MonetizationOffer } from './types';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [2, 132, 199];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Generates and downloads a real, modern multi-page Gamma-style PDF Lead Magnet
 * complete with cover page, structured framework cards, checklists, scripts,
 * and an embedded Whop / Affiliate Offer callout card.
 */
export function exportLeadMagnetToPdf(
  magnet: LeadMagnet,
  linkedOffer?: MonetizationOffer
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 52;
  const contentWidth = pageWidth - margin * 2;
  const [accentR, accentG, accentB] = hexToRgb(magnet.themeColor || '#0284C7');

  // --- PAGE 1: MODERN EDITORIAL COVER ---
  doc.setFillColor(11, 17, 32); // Deep slate cover
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Top accent rule
  doc.setFillColor(accentR, accentG, accentB);
  doc.rect(margin, 72, 64, 5, 'F');

  // Format & Niche kicker
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184);
  doc.text(`${magnet.format.toUpperCase()}  ·  ${magnet.niche.toUpperCase()}`, margin, 108);

  // Main Cover Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(magnet.title, contentWidth);
  doc.text(titleLines, margin, 170, { lineHeightFactor: 1.2 });

  const afterTitleY = 170 + titleLines.length * 42 + 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(15);
  doc.setTextColor(203, 213, 225);
  const subtitleLines = doc.splitTextToSize(magnet.subtitle, contentWidth);
  doc.text(subtitleLines, margin, afterTitleY, { lineHeightFactor: 1.45 });

  // What's inside preview card (supports up to 7 paid-worth chapters)
  const visibleToc = magnet.sections.slice(0, 7);
  const tocHeight = Math.max(210, 62 + visibleToc.length * 24 + 18);
  const tocTop = Math.min(Math.max(afterTitleY + subtitleLines.length * 24 + 36, 360), pageHeight - tocHeight - 105);
  doc.setFillColor(17, 24, 39);
  doc.setDrawColor(51, 65, 85);
  doc.roundedRect(margin, tocTop, contentWidth, tocHeight, 10, 10, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(accentR, accentG, accentB);
  doc.text(
    `INSIDE THIS ${magnet.format.toUpperCase()}  ·  ${(magnet.perceivedValueLabel || 'COMPLETE EDITION').toUpperCase()}`,
    margin + 24,
    tocTop + 32
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11.5);
  doc.setTextColor(226, 232, 240);
  visibleToc.forEach((sec, idx) => {
    const rowY = tocTop + 60 + idx * 24;
    const cleanHeading = sec.heading.replace(/^0?\d+\.\s*/, '');
    doc.text(`0${idx + 1}.  ${cleanHeading.slice(0, 64)}`, margin + 24, rowY);
  });

  // Author Footer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(magnet.authorName, margin, pageHeight - 78);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(148, 163, 184);
  doc.text(`${magnet.authorHandle}  ·  Prepared with GhostPilot`, margin, pageHeight - 60);

  // --- PAGE 2: VISUAL SYSTEM ROADMAP + COMPARISON TABLE ---
  doc.addPage();
  let cursorY = 58;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - 68) {
      doc.addPage();
      cursorY = 58;
    }
  };

  // Visual 4-Step Execution Architecture Diagram
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(accentR, accentG, accentB);
  doc.text('SYSTEM ARCHITECTURE  ·  AT A GLANCE', margin, cursorY);
  cursorY += 16;

  const roadmapSteps = magnet.sections.slice(0, 4);
  if (roadmapSteps.length > 0) {
    const gap = 10;
    const stepW = (contentWidth - gap * (roadmapSteps.length - 1)) / roadmapSteps.length;
    const stepH = 74;
    roadmapSteps.forEach((sec, i) => {
      const x = margin + i * (stepW + gap);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, cursorY, stepW, stepH, 6, 6, 'FD');

      doc.setFillColor(accentR, accentG, accentB);
      doc.rect(x, cursorY, stepW, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(accentR, accentG, accentB);
      doc.text(`STEP 0${i + 1}`, x + 10, cursorY + 20);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const shortHeading = doc.splitTextToSize(sec.heading, stepW - 20).slice(0, 3);
      doc.text(shortHeading, x + 10, cursorY + 35, { lineHeightFactor: 1.25 });
    });
    cursorY += stepH + 20;
  }

  // Common Mistake vs Top 1% Play Comparison Box
  const halfW = (contentWidth - 12) / 2;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(252, 165, 165);
  doc.roundedRect(margin, cursorY, halfW, 74, 6, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(185, 28, 28);
  doc.text('WHAT 95% DO WRONG', margin + 12, cursorY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(127, 29, 29);
  const wrongLines = doc.splitTextToSize(
    `Guessing without a repeatable ${magnet.niche} framework, relying on generic advice, and leaving execution to willpower.`,
    halfW - 24
  );
  doc.text(wrongLines, margin + 12, cursorY + 34, { lineHeightFactor: 1.35 });

  const rightX = margin + halfW + 12;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(134, 239, 172);
  doc.roundedRect(rightX, cursorY, halfW, 74, 6, 6, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(21, 128, 61);
  doc.text('THE TOP 1% PLAYBOOK', rightX + 12, cursorY + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(20, 83, 45);
  const rightLines = doc.splitTextToSize(
    `Following the exact checklists, scripts, and diagnostic steps inside this ${magnet.format} in order — zero guesswork.`,
    halfW - 24
  );
  doc.text(rightLines, rightX + 12, cursorY + 34, { lineHeightFactor: 1.35 });

  cursorY += 94;

  magnet.sections.forEach((section, index) => {
    const bodyLines = section.body
      ? doc.splitTextToSize(section.body, contentWidth - 40)
      : [];
    const bulletHeight = section.bullets.reduce((sum, b) => {
      const bLines = doc.splitTextToSize(`•  ${b}`, contentWidth - 52);
      return sum + bLines.length * 16 + 6;
    }, 0);
    const estimatedCardHeight = 68 + bodyLines.length * 17 + bulletHeight + 24;

    ensureSpace(Math.min(estimatedCardHeight, 260));

    const isOffer = section.type === 'offer-callout';
    if (isOffer) {
      doc.setFillColor(240, 249, 255);
      doc.setDrawColor(accentR, accentG, accentB);
    } else {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
    }

    const cardTop = cursorY;
    const drawHeight = Math.min(estimatedCardHeight, pageHeight - cursorY - 64);
    doc.roundedRect(margin, cardTop, contentWidth, drawHeight, 8, 8, 'FD');

    let innerY = cardTop + 26;

    // Kicker label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(accentR, accentG, accentB);
    const labelMap: Record<typeof section.type, string> = {
      takeaway: 'EXECUTIVE TAKEAWAY',
      framework: `OPERATING SYSTEM  ·  PART 0${index + 1}`,
      comparison: '95% MISTAKES VS TOP 1% PLAYBOOK',
      checklist: '7-DAY ACTION CHECKLIST',
      script: 'COPY-PASTE SWIPE FILE & PROMPTS',
      worksheet: 'TROUBLESHOOTING & DIAGNOSTIC',
      'offer-callout': 'RECOMMENDED GROUP NEXT STEP',
    };
    doc.text(labelMap[section.type] || `SECTION 0${index + 1}`, margin + 20, innerY);
    innerY += 20;

    // Heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    const headingLines = doc.splitTextToSize(section.heading, contentWidth - 40);
    doc.text(headingLines, margin + 20, innerY);
    innerY += headingLines.length * 20 + 6;

    // Body
    if (bodyLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.text(bodyLines, margin + 20, innerY, { lineHeightFactor: 1.45 });
      innerY += bodyLines.length * 16 + 10;
    }

    // Bullets
    if (section.bullets.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      section.bullets.forEach((bullet) => {
        const prefix = section.type === 'checklist' ? '[ ]  ' : '•  ';
        const bLines = doc.splitTextToSize(`${prefix}${bullet}`, contentWidth - 48);
        if (innerY + bLines.length * 15 > pageHeight - 60) {
          doc.addPage();
          innerY = 64;
        }
        doc.text(bLines, margin + 24, innerY, { lineHeightFactor: 1.4 });
        innerY += bLines.length * 15 + 6;
      });
    }

    cursorY = Math.max(cardTop + drawHeight, innerY + 12) + 18;
  });

  // --- FINAL OFFER / WHOP CTA BLOCK ---
  if (linkedOffer) {
    ensureSpace(155);
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, cursorY, contentWidth, 138, 10, 10, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(56, 189, 248);
    doc.text(`READY TO GO FASTER?  ·  ${linkedOffer.platform.toUpperCase()}`, margin + 24, cursorY + 28);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text(`${linkedOffer.name} (${linkedOffer.priceLabel})`, margin + 24, cursorY + 54);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(203, 213, 225);
    const offerDesc = doc.splitTextToSize(linkedOffer.promise, contentWidth - 48);
    doc.text(offerDesc, margin + 24, cursorY + 76, { lineHeightFactor: 1.4 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(56, 189, 248);
    doc.textWithLink(`Access Here -> ${linkedOffer.url}`, margin + 24, cursorY + 116, {
      url: linkedOffer.url,
    });
  }

  // Page numbers on pages 2+
  const totalPages = doc.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${magnet.title}  ·  ${magnet.authorHandle}`, margin, pageHeight - 28);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin - 55, pageHeight - 28);
  }

  const safeFile = magnet.slug.replace(/[^a-z0-9-_]/gi, '-') || 'playbook';
  doc.save(`${safeFile}.pdf`);
}
