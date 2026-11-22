import React from 'react';
import { Menu, Moon, PenSquare, Sun } from 'lucide-react';
import type { AccountProfile, NavSection } from '../lib/types';

interface TopBarProps {
  activeSection: NavSection;
  activeAccount: AccountProfile;
  darkMode: boolean;
  onToggleDark: () => void;
  onNewPost: () => void;
  onOpenMobileMenu: () => void;
}

const SECTION_LABELS: Record<NavSection, { title: string }> = {
  today: { title: 'Today' },
  ideas: { title: 'Ideas ($0 Scraper)' },
  'queue-pdfs': { title: 'Queue & Free PDFs' },
  'accounts-telegram': { title: 'Accounts & Telegram' },
  autopilot: { title: 'Today' },
  'research-hub': { title: 'Ideas ($0 Scraper)' },
  'write-hub': { title: 'Queue & Free PDFs' },
  'grow-hub': { title: 'Accounts & Telegram' },
  antigravity: { title: 'Accounts & Telegram' },
  'account-hub': { title: 'Accounts & Telegram' },
  brand: { title: 'Accounts & Telegram' },
  research: { title: 'Ideas ($0 Scraper)' },
  'lead-magnets': { title: 'Queue & Free PDFs' },
  carousels: { title: 'Queue & Free PDFs' },
  write: { title: 'Queue & Free PDFs' },
  queue: { title: 'Queue & Free PDFs' },
  viral: { title: 'Queue & Free PDFs' },
  automations: { title: 'Accounts & Telegram' },
  crm: { title: 'Accounts & Telegram' },
  analytics: { title: 'Today' },
  settings: { title: 'Accounts & Telegram' },
};

export function TopBar({
  activeSection,
  activeAccount,
  darkMode,
  onToggleDark,
  onNewPost,
  onOpenMobileMenu,
}: TopBarProps) {
  const meta = SECTION_LABELS[activeSection] || { title: 'GhostPilot' };
  const nicheTitle =
    activeAccount.nicheProfile?.subNicheName || activeAccount.brandBrain?.niche || 'Choose Niche';

  return (
    <header className="sticky top-0 z-30 h-14 bg-[#F5F5F7]/80 dark:bg-[#000000]/80 backdrop-blur-2xl border-b border-black/[0.06] dark:border-white/[0.08] px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-full text-[#515154] hover:bg-black/[0.05] dark:text-[#A1A1A6] dark:hover:bg-white/[0.08]"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2.5 text-sm min-w-0 truncate">
          <h1 className="font-display text-[15px] font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
            {meta.title}
          </h1>
          <span className="hidden md:inline text-black/20 dark:text-white/20" aria-hidden="true">
            /
          </span>
          <span className="hidden md:inline text-[13px] text-[#6E6E73] dark:text-[#86868B] truncate">
            {activeAccount.handle} · {nicheTitle}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onToggleDark}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-[#515154] dark:text-[#D1D1D6] transition-colors"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onNewPost}
          className="apple-btn-primary h-9 px-4 text-[13px]"
        >
          <PenSquare className="h-3.5 w-3.5" aria-hidden="true" />
          <span>New Post</span>
        </button>
      </div>
    </header>
  );
}
