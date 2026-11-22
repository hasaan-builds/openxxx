import type { CarouselDeck, CarouselSlide, CarouselThemeId } from './types';

export interface CarouselThemeStyle {
  id: CarouselThemeId;
  name: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
}

export const CAROUSEL_THEMES: Record<CarouselThemeId, CarouselThemeStyle> = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Authority',
    bg: '#0B1120',
    surface: '#111827',
    text: '#F8FAFC',
    muted: '#94A3B8',
    accent: '#38BDF8',
    border: '#1E293B',
  },
  editorial: {
    id: 'editorial',
    name: 'Editorial Light',
    bg: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#0F172A',
    muted: '#64748B',
    accent: '#0284C7',
    border: '#E2E8F0',
  },
  cobalt: {
    id: 'cobalt',
    name: 'Cobalt Studio',
    bg: '#0C2340',
    surface: '#133157',
    text: '#F8FAFC',
    muted: '#BAE6FD',
    accent: '#38BDF8',
    border: '#1D4ED8',
  },
  ivory: {
    id: 'ivory',
    name: 'Warm Ivory Paper',
    bg: '#FAF8F5',
    surface: '#F2EEE7',
    text: '#1C1917',
    muted: '#78716C',
    accent: '#0369A1',
    border: '#E7E5E4',
  },
};

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Renders a crisp 1080x1350 PostNitro-style carousel slide onto an HTML5 canvas
 * and returns a PNG Data URL ready for instant download or preview.
 */
export function renderSlideToPngDataUrl(
  deck: CarouselDeck,
  slide: CarouselSlide,
  slideIndex: number,
  totalSlides: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const theme = CAROUSEL_THEMES[deck.themeId] || CAROUSEL_THEMES.obsidian;

  // Background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle top bar & border frame
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

  // Top Accent Rule
  ctx.fillStyle = theme.accent;
  ctx.fillRect(96, 108, 84, 8);

  // Eyebrow + Slide Number
  ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = theme.accent;
  ctx.fillText((slide.eyebrow || `SLIDE ${slideIndex + 1}`).toUpperCase(), 96, 166);

  ctx.font = '600 24px "JetBrains Mono", monospace';
  ctx.fillStyle = theme.muted;
  const counter = `${String(slideIndex + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`;
  const counterWidth = ctx.measureText(counter).width;
  ctx.fillText(counter, canvas.width - 96 - counterWidth, 166);

  // Main Headline
  const headlineSize = slide.layout === 'cover' ? 74 : slide.layout === 'quote' ? 62 : 58;
  ctx.font = `700 ${headlineSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = theme.text;
  const headlineLines = wrapCanvasText(ctx, slide.headline, canvas.width - 192);
  let cursorY = slide.layout === 'cover' ? 320 : 270;
  for (const line of headlineLines.slice(0, 5)) {
    ctx.fillText(line, 96, cursorY);
    cursorY += headlineSize * 1.18;
  }

  cursorY += 28;

  // Body text
  if (slide.body) {
    ctx.font = '400 34px "DM Sans", sans-serif';
    ctx.fillStyle = theme.muted;
    const bodyLines = wrapCanvasText(ctx, slide.body, canvas.width - 192);
    for (const line of bodyLines.slice(0, 6)) {
      ctx.fillText(line, 96, cursorY);
      cursorY += 48;
    }
    cursorY += 24;
  }

  // Bullets or Comparison
  if (slide.layout === 'comparison' && slide.bullets.length >= 2) {
    const colW = (canvas.width - 224) / 2;
    const boxTop = cursorY;
    // Left box
    ctx.fillStyle = theme.surface;
    ctx.fillRect(96, boxTop, colW, 380);
    ctx.strokeStyle = theme.border;
    ctx.strokeRect(96, boxTop, colW, 380);
    ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = theme.muted;
    ctx.fillText(slide.leftLabel || 'OLD WAY', 124, boxTop + 54);

    // Right box
    ctx.fillStyle = theme.surface;
    ctx.fillRect(96 + colW + 32, boxTop, colW, 380);
    ctx.strokeStyle = theme.accent;
    ctx.strokeRect(96 + colW + 32, boxTop, colW, 380);
    ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = theme.accent;
    ctx.fillText(slide.rightLabel || 'S-TIER WAY', 124 + colW + 32, boxTop + 54);

    ctx.font = '400 28px "DM Sans", sans-serif';
    ctx.fillStyle = theme.text;
    const leftLines = wrapCanvasText(ctx, slide.bullets[0] || '', colW - 56);
    leftLines.slice(0, 6).forEach((l, i) => ctx.fillText(l, 124, boxTop + 114 + i * 42));

    const rightLines = wrapCanvasText(ctx, slide.bullets[1] || '', colW - 56);
    rightLines.slice(0, 6).forEach((l, i) =>
      ctx.fillText(l, 124 + colW + 32, boxTop + 114 + i * 42)
    );
  } else if (slide.bullets.length > 0) {
    slide.bullets.slice(0, 5).forEach((bullet, idx) => {
      ctx.fillStyle = theme.surface;
      ctx.fillRect(96, cursorY - 36, canvas.width - 192, 94);
      ctx.strokeStyle = theme.border;
      ctx.strokeRect(96, cursorY - 36, canvas.width - 192, 94);

      ctx.font = '700 28px "JetBrains Mono", monospace';
      ctx.fillStyle = theme.accent;
      const marker = slide.layout === 'checklist' ? '✓' : `0${idx + 1}`;
      ctx.fillText(marker, 124, cursorY + 18);

      ctx.font = '500 29px "DM Sans", sans-serif';
      ctx.fillStyle = theme.text;
      const bLines = wrapCanvasText(ctx, bullet, canvas.width - 300);
      ctx.fillText(bLines[0] || '', 194, cursorY + 18);
      cursorY += 114;
    });
  }

  // Bottom Author Bar
  ctx.strokeStyle = theme.border;
  ctx.beginPath();
  ctx.moveTo(96, canvas.height - 168);
  ctx.lineTo(canvas.width - 96, canvas.height - 168);
  ctx.stroke();

  ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = theme.text;
  ctx.fillText(deck.authorName, 96, canvas.height - 114);

  ctx.font = '500 24px "JetBrains Mono", monospace';
  ctx.fillStyle = theme.muted;
  ctx.fillText(deck.authorHandle, 96, canvas.height - 78);

  const swipeText = slideIndex < totalSlides - 1 ? 'SWIPE →' : 'BOOKMARK & SHARE';
  ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = theme.accent;
  const swipeW = ctx.measureText(swipeText).width;
  ctx.fillText(swipeText, canvas.width - 96 - swipeW, canvas.height - 96);

  return canvas.toDataURL('image/png');
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Converts any Free PDF Lead Magnet into 4 crisp 1080x1350 viral X Carousel PNG slides
 * (Cover Hook -> Core Framework -> Action Checklist -> Comment-to-PDF CTA) and downloads them.
 */
export function exportLeadMagnetToCarouselPngs(
  magnet: {
    slug: string;
    title: string;
    subtitle: string;
    format: string;
    niche: string;
    authorName: string;
    authorHandle: string;
    giveawayKeyword: string;
    sections: Array<{ heading: string; body: string; bullets: string[] }>;
  },
  themeId: CarouselThemeId = 'obsidian'
): number {
  const s1 = magnet.sections[0];
  const s2 = magnet.sections[1] || s1;
  const deck: CarouselDeck = {
    id: `deck-${magnet.slug}`,
    title: magnet.title,
    themeId,
    authorName: magnet.authorName,
    authorHandle: magnet.authorHandle,
    createdAt: new Date().toISOString(),
    slides: [
      {
        id: 'sl-1',
        eyebrow: `FREE ${magnet.format.toUpperCase()}`,
        headline: magnet.title,
        body: magnet.subtitle,
        bullets: [],
        layout: 'cover',
      },
      {
        id: 'sl-2',
        eyebrow: 'THE CORE FRAMEWORK',
        headline: s1?.heading || `How Top 1% Win at ${magnet.niche}`,
        body: s1?.body || magnet.subtitle,
        bullets: (s1?.bullets || []).slice(0, 3),
        layout: 'framework',
      },
      {
        id: 'sl-3',
        eyebrow: 'ACTION CHECKLIST',
        headline: s2?.heading || 'Step-by-Step Execution Checklist',
        body: s2?.body || 'Follow these exact steps in order:',
        bullets: (s2?.bullets || s1?.bullets || []).slice(0, 4),
        layout: 'checklist',
      },
      {
        id: 'sl-4',
        eyebrow: 'GRAB THE FULL PDF FREE',
        headline: `Comment "${magnet.giveawayKeyword || 'PLAYBOOK'}" below`,
        body: `I'll send you the complete ${magnet.title} PDF (plus word-for-word scripts & checklist) for $0.`,
        bullets: [
          'Follow so I can send it fast',
          `Comment "${magnet.giveawayKeyword || 'PLAYBOOK'}" right now`,
          'Bookmark this thread for later',
        ],
        layout: 'cta',
      },
    ],
  };

  const safeSlug = magnet.slug.replace(/[^a-z0-9-_]/gi, '-') || 'carousel';
  deck.slides.forEach((slide, idx) => {
    const png = renderSlideToPngDataUrl(deck, slide, idx, deck.slides.length);
    if (png) {
      downloadDataUrl(png, `${safeSlug}-slide-${idx + 1}.png`);
    }
  });
  return deck.slides.length;
}
