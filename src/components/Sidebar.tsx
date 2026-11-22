import React, { useState } from 'react';
import {
  FileText,
  Lightbulb,
  Lock,
  LogOut,
  Plus,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { AccountProfile, NavSection } from '../lib/types';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  accounts: AccountProfile[];
  activeAccount: AccountProfile;
  onSwitchAccount: (id: string) => void;
  onQuickAddAccount: (name: string, handle: string) => Promise<void>;
  onOpenNicheWizard: () => void;
  onLogout: () => void;
  queuedCount: number;
  pendingAntigravityCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export function Sidebar({
  activeSection,
  onSelectSection,
  accounts,
  activeAccount,
  onSwitchAccount,
  onQuickAddAccount,
  onOpenNicheWizard,
  onLogout,
  queuedCount,
  pendingAntigravityCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const [addingAccount, setAddingAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccHandle, setNewAccHandle] = useState('');

  const navItems: NavItem[] = [
    { id: 'today', label: 'Today', icon: Sparkles },
    { id: 'ideas', label: 'Ideas ($0)', icon: Lightbulb },
    { id: 'queue-pdfs', label: 'Queue & PDFs', icon: FileText, count: queuedCount },
    { id: 'accounts-telegram', label: 'Accounts & Telegram', icon: Send },
  ];

  const handleNav = (id: NavSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim() || !newAccHandle.trim()) return;
    await onQuickAddAccount(newAccName.trim(), newAccHandle.trim());
    setNewAccName('');
    setNewAccHandle('');
    setAddingAccount(false);
    onCloseMobile();
  };

  const lockedNiche = activeAccount.nicheProfile;

  const navContent = (
    <div className="flex h-full flex-col bg-[#FBFBFD]/85 dark:bg-[#111113]/90 backdrop-blur-2xl border-r border-black/[0.06] dark:border-white/[0.08]">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 h-14 shrink-0">
        <button
          type="button"
          onClick={() => handleNav('today')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] rounded-lg"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[#1D1D1F] dark:bg-white text-white dark:text-[#1D1D1F] font-display text-xs font-bold tracking-tight">
            GP
          </span>
          <span className="font-display text-[15px] font-semibold tracking-[-0.02em] text-[#1D1D1F] dark:text-[#F5F5F7] whitespace-nowrap">
            GhostPilot
          </span>
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-full text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Active Account & Locked Niche Focus — Quiet macOS Sidebar Grouping */}
      <div className="px-4 pb-4 pt-1 border-b border-black/[0.06] dark:border-white/[0.08] space-y-3">
        <div className="flex items-center gap-2.5">
          <img
            src={activeAccount.avatarUrl}
            alt={activeAccount.name}
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full object-cover ring-1 ring-black/[0.08] dark:ring-white/[0.12] shrink-0"
          />
          <div className="min-w-0 flex-1">
            <label htmlFor="account-switcher" className="sr-only">
              Active X account
            </label>
            <select
              id="account-switcher"
              value={activeAccount.id}
              onChange={(e) => onSwitchAccount(e.target.value)}
              className="w-full bg-transparent text-[13px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate focus:outline-none cursor-pointer"
            >
              {accounts.map((acc) => (
                <option
                  key={acc.id}
                  value={acc.id}
                  className="bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7]"
                >
                  {acc.name} ({acc.handle})
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 text-[11px] text-[#6E6E73] dark:text-[#86868B] tabular-nums">
              <span
                className={
                  activeAccount.telegram?.enabled
                    ? 'text-[#16A34A] dark:text-[#30D158] font-medium'
                    : 'text-[#6E6E73] dark:text-[#98989D]'
                }
              >
                {activeAccount.telegram?.enabled ? 'Telegram $0 Active' : '$0 Local Mode'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-[12px] bg-black/[0.035] dark:bg-white/[0.05] px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 font-medium text-[#0071E3] dark:text-[#0A84FF]">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Locked Account Niche
            </span>
            <button
              type="button"
              onClick={() => {
                onOpenNicheWizard();
                onCloseMobile();
              }}
              className="text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-white font-medium transition-colors"
            >
              Change
            </button>
          </div>
          <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] leading-snug">
            {lockedNiche?.subNicheName || activeAccount.brandBrain?.niche || 'Not locked yet'}
          </div>
          {lockedNiche?.microAngle && (
            <div className="text-[11px] text-[#6E6E73] dark:text-[#86868B] line-clamp-1">
              {lockedNiche.microAngle}
            </div>
          )}
        </div>

        {addingAccount && (
          <form onSubmit={handleCreateAccount} className="space-y-2 pt-1">
            <input
              type="text"
              required
              value={newAccName}
              onChange={(e) => setNewAccName(e.target.value)}
              placeholder="Account Name (e.g., Fitness Lab)"
              className="apple-input py-1.5 text-xs"
            />
            <input
              type="text"
              required
              value={newAccHandle}
              onChange={(e) => setNewAccHandle(e.target.value)}
              placeholder="@handle"
              className="apple-input py-1.5 text-xs font-mono"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="submit"
                className="apple-btn-primary flex-1 py-1.5 px-3 text-xs"
              >
                Create &amp; Pick Niche
              </button>
              <button
                type="button"
                onClick={() => setAddingAccount(false)}
                className="px-2.5 py-1.5 rounded-full text-xs text-[#6E6E73] hover:text-[#1D1D1F] dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Serene macOS Sequoia 6-Item Navigation */}
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-[10px] text-left text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] ${
                isActive
                  ? 'bg-black/[0.07] dark:bg-white/[0.12] text-[#1D1D1F] dark:text-white font-semibold'
                  : 'text-[#515154] dark:text-[#A1A1A6] hover:text-[#1D1D1F] dark:hover:text-white hover:bg-black/[0.035] dark:hover:bg-white/[0.06] font-medium'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive
                      ? 'text-[#0071E3] dark:text-[#0A84FF]'
                      : 'text-[#86868B] dark:text-[#6E6E73]'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span className="font-mono text-[11px] tabular-nums text-[#6E6E73] dark:text-[#98989D] shrink-0">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Quiet Account Actions */}
      <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-1 shrink-0">
        {!addingAccount && (
          <button
            type="button"
            onClick={() => setAddingAccount(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-medium text-[#515154] dark:text-[#A1A1A6] hover:bg-black/[0.04] dark:hover:bg-white/[0.07] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
          >
            <Plus className="h-3.5 w-3.5 text-[#86868B]" aria-hidden="true" />
            <span>Add New X Account</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onLogout();
            onCloseMobile();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-medium text-[#515154] dark:text-[#A1A1A6] hover:bg-black/[0.04] dark:hover:bg-white/[0.07] hover:text-[#1D1D1F] dark:hover:text-white transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 text-[#86868B]" aria-hidden="true" />
          <span>Sign Out / Switch X Account</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-[256px] shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[272px] max-w-[85vw] h-full">{navContent}</aside>
        </div>
      )}
    </>
  );
}
