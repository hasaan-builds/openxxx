import { jsPDF } from 'jspdf';
import type { LeadMagnet, LeadMagnetSection, MonetizationOffer } from './types';

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
  if (Number.isNaN(num)) return [0, 113, 227];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function splitPair(text: string): [string, string] | null {
  const arrowParts = text.split(/\s*(?:->|→)\s*/);
  if (arrowParts.length >= 2) {
    return [
      arrowParts[0].replace(/^(?:95%\s*Approach|Amateur|Symptom)\s*:\s*/i, '').trim(),
      arrowParts.slice(1).join(' -> ').replace(/^(?:Top\s*1%\s*Approach|Top\s*1%|Fix)\s*:\s*/i, '').trim(),
    ];
  }
  const vsParts = text.split(/\s+vs\.?\s+/i);
  if (vsParts.length >= 2) {
    return [vsParts[0].trim(), vsParts.slice(1).join(' vs. ').trim()];
  }
  return null;
}

/**
 * Generates and downloads a publication-grade ($97-style Stripe Press / Apple Editorial)
 * multi-page PDF Lead Magnet with zero generic boilerplate, real 2-column comparison tables,
 * vector checkboxes, monospaced swipe-file template blocks, and an embedded Affiliate Group CTA.
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
  const [accentR, accentG, accentB] = hexToRgb(magnet.themeColor || '#0071E3');

  // --- PAGE 1: EDITORIAL EXECUTIVE COVER ---
  doc.setFillColor(12, 16, 26); // Deep obsidian editorial slate
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Crisp top accent bar
  doc.setFillColor(accentR, accentG, accentB);
  doc.rect(margin, 64, 56, 4, 'F');

  // Kicker + Perceived Value Edition
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  const editionLabel = (magnet.perceivedValueLabel || '$97 Value · Free Edition').toUpperCase();
  doc.text(`${magnet.format.toUpperCase()}  ·  ${magnet.niche.toUpperCase()}`, margin, 94);
  doc.setTextColor(accentR, accentG, accentB);
  doc.text(editionLabel, pageWidth - margin, 94, { align: 'right' });

  // Cover Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(31);
  doc.setTextColor(255, 255, 255);
  const titleLines = doc.splitTextToSize(magnet.title, contentWidth);
  doc.text(titleLines, margin, 152, { lineHeightFactor: 1.18 });

  const afterTitleY = 152 + titleLines.length * 37 + 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13.5);
  doc.setTextColor(203, 213, 225);
  const subtitleLines = doc.splitTextToSize(magnet.subtitle, contentWidth);
  doc.text(subtitleLines, margin, afterTitleY, { lineHeightFactor: 1.48 });

  // Table of Contents Editorial Box
  const visibleToc = magnet.sections.slice(0, 7);
  const rowPitch = 25;
  const tocHeight = 64 + visibleToc.length * rowPitch + 18;
  const tocTop = Math.min(
    Math.max(afterTitleY + subtitleLines.length * 21 + 36, 355),
    pageHeight - tocHeight - 102
  );

  doc.setFillColor(19, 25, 39);
  doc.setDrawColor(45, 57, 79);
  doc.roundedRect(margin, tocTop, contentWidth, tocHeight, 10, 10, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(accentR, accentG, accentB);
  doc.text(`COMPLETE TABLE OF CONTENTS  ·  ${visibleToc.length} CHAPTERS`, margin + 24, tocTop + 30);

  doc.setDrawColor(38, 49, 68);
  doc.line(margin + 24, tocTop + 40, margin + contentWidth - 24, tocTop + 40);

  const chapterTypeLabels: Record<LeadMagnetSection['type'], string> = {
    takeaway: 'BRIEFING',
    framework: 'SYSTEM',
    comparison: 'MATRIX',
    script: 'SWIPE FILE',
    checklist: '7-DAY SPRINT',
    worksheet: 'DIAGNOSTIC',
    'offer-callout': 'NEXT STEP',
  };

  visibleToc.forEach((sec, idx) => {
    const rowY = tocTop + 62 + idx * rowPitch;
    const cleanHeading = sec.heading.replace(/^0?\d+\.\s*/, '');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(accentR, accentG, accentB);
    doc.text(`0${idx + 1}`, margin + 24, rowY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(235, 240, 248);
    const trimmedHeading = cleanHeading.length > 52 ? `${cleanHeading.slice(0, 50)}…` : cleanHeading;
    doc.text(trimmedHeading, margin + 48, rowY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 136, 160);
    doc.text(chapterTypeLabels[sec.type] || 'CHAPTER', margin + contentWidth - 24, rowY, {
      align: 'right',
    });
  });

  // Author Footer (100% Creator-Owned, zero third-party watermark)
  doc.setDrawColor(38, 49, 68);
  doc.line(margin, pageHeight - 92, pageWidth - margin, pageHeight - 92);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(magnet.authorName, margin, pageHeight - 66);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${magnet.authorHandle}  ·  ${magnet.niche} Field Manual`, margin, pageHeight - 48);

  // --- CONTENT PAGES ---
  doc.addPage();
  let cursorY = 64;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - 64) {
      doc.addPage();
      cursorY = 64;
    }
  };

  const sectionKickerMap: Record<LeadMagnetSection['type'], string> = {
    takeaway: 'EXECUTIVE REALITY CHECK',
    framework: 'CORE OPERATING SYSTEM',
    comparison: '95% AMATEUR VS. TOP 1% MATRIX',
    script: 'COPY-PASTE SWIPE FILE & PROMPTS',
    checklist: '7-DAY IMPLEMENTATION SPRINT',
    worksheet: 'DIAGNOSTIC TROUBLESHOOTING',
    'offer-callout': 'RECOMMENDED ACCELERATOR',
  };

  magnet.sections.forEach((section, index) => {
    // Start major chapters cleanly if near bottom of page
    ensureSpace(150);

    // Chapter Header Band
    doc.setFillColor(accentR, accentG, accentB);
    doc.rect(margin, cursorY - 10, 26, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(accentR, accentG, accentB);
    doc.text(
      `CHAPTER 0${index + 1}  ·  ${sectionKickerMap[section.type] || 'FIELD GUIDE'}`,
      margin + 36,
      cursorY - 6
    );
    cursorY += 16;

    // Chapter Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    const cleanHeading = section.heading.replace(/^0?\d+\.\s*/, '');
    const headingLines = doc.splitTextToSize(cleanHeading, contentWidth);
    doc.text(headingLines, margin, cursorY, { lineHeightFactor: 1.22 });
    cursorY += headingLines.length * 22 + 8;

    // Chapter Narrative Body
    if (section.body?.trim()) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      const bodyLines = doc.splitTextToSize(section.body.trim(), contentWidth);
      ensureSpace(bodyLines.length * 16 + 12);
      doc.text(bodyLines, margin, cursorY, { lineHeightFactor: 1.5 });
      cursorY += bodyLines.length * 16 + 14;
    }

    // Dedicated Chapter Renderer by Type
    if (section.type === 'comparison' && section.bullets.length > 0) {
      const colW = (contentWidth - 12) / 2;
      ensureSpace(34);
      // Table Header Row
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(margin, cursorY, colW, 24, 4, 4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(185, 28, 28);
      doc.text('WHAT 95% DO WRONG', margin + 10, cursorY + 15);

      doc.setFillColor(236, 253, 245);
      doc.roundedRect(margin + colW + 12, cursorY, colW, 24, 4, 4, 'F');
      doc.setTextColor(4, 120, 87);
      doc.text('THE TOP 1% OPERATOR PLAY', margin + colW + 22, cursorY + 15);
      cursorY += 30;

      section.bullets.forEach((bullet) => {
        const pair = splitPair(bullet);
        const leftText = pair ? pair[0] : bullet;
        const rightText = pair ? pair[1] : 'Apply the structured system in Chapter 02.';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.8);
        const leftLines = doc.splitTextToSize(leftText, colW - 20);
        const rightLines = doc.splitTextToSize(rightText, colW - 20);
        const rowH = Math.max(leftLines.length, rightLines.length) * 14 + 18;
        ensureSpace(rowH + 8);

        doc.setFillColor(250, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, cursorY, colW, rowH, 5, 5, 'FD');
        doc.setTextColor(71, 85, 105);
        doc.text(leftLines, margin + 10, cursorY + 16, { lineHeightFactor: 1.4 });

        doc.setFillColor(245, 250, 255);
        doc.setDrawColor(191, 219, 254);
        doc.roundedRect(margin + colW + 12, cursorY, colW, rowH, 5, 5, 'FD');
        doc.setTextColor(15, 23, 42);
        doc.text(rightLines, margin + colW + 22, cursorY + 16, { lineHeightFactor: 1.4 });

        cursorY += rowH + 8;
      });
    } else if (section.type === 'script' && section.bullets.length > 0) {
      section.bullets.forEach((script, sIdx) => {
        doc.setFont('courier', 'normal');
        doc.setFontSize(9.6);
        const lines = doc.splitTextToSize(script, contentWidth - 36);
        const boxH = lines.length * 14 + 34;
        ensureSpace(boxH + 10);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, cursorY, contentWidth, boxH, 6, 6, 'FD');

        doc.setFillColor(accentR, accentG, accentB);
        doc.rect(margin, cursorY, 4, boxH, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(accentR, accentG, accentB);
        doc.text(`TEMPLATE 0${sIdx + 1}  ·  COPY & ADAPT`, margin + 16, cursorY + 16);

        doc.setFont('courier', 'normal');
        doc.setFontSize(9.6);
        doc.setTextColor(15, 23, 42);
        doc.text(lines, margin + 16, cursorY + 32, { lineHeightFactor: 1.4 });

        cursorY += boxH + 10;
      });
    } else if (section.type === 'checklist' && section.bullets.length > 0) {
      section.bullets.forEach((step) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        const lines = doc.splitTextToSize(step, contentWidth - 34);
        const rowH = lines.length * 15 + 14;
        ensureSpace(rowH + 6);

        // Crisp drawn vector checkbox square
        doc.setDrawColor(accentR, accentG, accentB);
        doc.setLineWidth(1.1);
        doc.roundedRect(margin + 2, cursorY + 2, 11, 11, 2, 2, 'S');
        doc.setLineWidth(0.5);

        doc.setTextColor(30, 41, 59);
        doc.text(lines, margin + 24, cursorY + 11, { lineHeightFactor: 1.42 });
        cursorY += rowH + 4;
      });
    } else if (section.type === 'worksheet' && section.bullets.length > 0) {
      section.bullets.forEach((item) => {
        const pair = splitPair(item);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.2);
        if (pair) {
          const symLines = doc.splitTextToSize(`Symptom: ${pair[0]}`, contentWidth - 28);
          const fixLines = doc.splitTextToSize(`Fix: ${pair[1]}`, contentWidth - 28);
          const boxH = (symLines.length + fixLines.length) * 14.5 + 24;
          ensureSpace(boxH + 8);

          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(margin, cursorY, contentWidth, boxH, 6, 6, 'FD');

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(180, 83, 9);
          doc.text(symLines, margin + 14, cursorY + 18, { lineHeightFactor: 1.4 });

          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);
          doc.text(fixLines, margin + 14, cursorY + 18 + symLines.length * 14.5 + 4, {
            lineHeightFactor: 1.4,
          });
          cursorY += boxH + 8;
        } else {
          const lines = doc.splitTextToSize(`•  ${item}`, contentWidth - 16);
          ensureSpace(lines.length * 15 + 10);
          doc.setTextColor(30, 41, 59);
          doc.text(lines, margin + 8, cursorY + 10, { lineHeightFactor: 1.42 });
          cursorY += lines.length * 15 + 8;
        }
      });
    } else if (section.bullets.length > 0) {
      section.bullets.forEach((bullet, bIdx) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        const lines = doc.splitTextToSize(bullet, contentWidth - 36);
        const rowH = lines.length * 15 + 14;
        ensureSpace(rowH + 6);

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(232, 237, 243);
        doc.roundedRect(margin, cursorY, contentWidth, rowH, 6, 6, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(accentR, accentG, accentB);
        doc.text(`0${bIdx + 1}`, margin + 12, cursorY + 17);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.4);
        doc.setTextColor(30, 41, 59);
        doc.text(lines, margin + 32, cursorY + 17, { lineHeightFactor: 1.42 });

        cursorY += rowH + 7;
      });
    }

    // Subtle divider between chapters
    cursorY += 16;
    if (cursorY < pageHeight - 90 && index < magnet.sections.length - 1) {
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, cursorY - 6, pageWidth - margin, cursorY - 6);
      cursorY += 14;
    }
  });

  // --- FINAL AFFILIATE GROUP CTA BLOCK ---
  if (linkedOffer) {
    ensureSpace(155);
    doc.setFillColor(12, 16, 26);
    doc.roundedRect(margin, cursorY, contentWidth, 140, 10, 10, 'F');

    doc.setFillColor(accentR, accentG, accentB);
    doc.rect(margin, cursorY, contentWidth, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(96, 165, 250);
    doc.text(
      `RECOMMENDED NEXT STEP  ·  ${linkedOffer.platform.toUpperCase()}`,
      margin + 24,
      cursorY + 30
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(255, 255, 255);
    doc.text(`${linkedOffer.name} (${linkedOffer.priceLabel})`, margin + 24, cursorY + 56);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.8);
    doc.setTextColor(203, 213, 225);
    const offerDesc = doc.splitTextToSize(linkedOffer.promise, contentWidth - 48).slice(0, 2);
    doc.text(offerDesc, margin + 24, cursorY + 78, { lineHeightFactor: 1.4 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(96, 165, 250);
    doc.textWithLink(`Access Inside -> ${linkedOffer.url}`, margin + 24, cursorY + 118, {
      url: linkedOffer.url,
    });
  }

  // Editorial Running Header & Page Numbers on Pages 2+
  const totalPages = doc.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(236, 240, 245);
    doc.line(margin, 40, pageWidth - margin, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    const shortTitle = magnet.title.length > 58 ? `${magnet.title.slice(0, 56)}…` : magnet.title;
    doc.text(shortTitle, margin, 32);
    doc.text(magnet.authorHandle, pageWidth - margin, 32, { align: 'right' });

    doc.line(margin, pageHeight - 40, pageWidth - margin, pageHeight - 40);
    doc.text(`${magnet.niche}  ·  ${magnet.format}`, margin, pageHeight - 25);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 25, { align: 'right' });
  }

  const safeFile = magnet.slug.replace(/[^a-z0-9-_]/gi, '-') || 'playbook';
  doc.save(`${safeFile}.pdf`);
}
