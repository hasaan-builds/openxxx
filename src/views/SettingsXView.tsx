import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  KeyRound,
  Plus,
  ShieldCheck,
  Upload,
  UserCheck,
} from 'lucide-react';
import { api } from '../lib/api';
import type { AccountProfile, GhostPilotStore } from '../lib/types';

interface SettingsXViewProps {
  store: GhostPilotStore;
  activeAccount: AccountProfile;
  onSaveStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onReplaceStore: (next: GhostPilotStore) => void;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

export function SettingsXView({
  store,
  activeAccount,
  onSaveStore,
  onReplaceStore,
  onNotify,
}: SettingsXViewProps) {
  const [xConfig, setXConfig] = useState<{
    configured: boolean;
    callbackUrl: string;
    mode: 'sandbox' | 'live';
    geminiConfigured: boolean;
  } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [accName, setAccName] = useState('');
  const [accHandle, setAccHandle] = useState('');
  const [accBio, setAccBio] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const dynamicCallbackUrl = `${window.location.origin}/auth/x/callback`;

  useEffect(() => {
    api
      .getXConfig()
      .then((cfg) => setXConfig(cfg))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'X_OAUTH_SUCCESS') {
        try {
          const fresh = await api.getStore();
          onReplaceStore(fresh);
          onNotify('Connected your official X (Twitter) account! Auto-refreshing tokens are now active.');
        } catch {
          onNotify('X login finished — refresh to see updated status.');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onReplaceStore, onNotify]);

  const handleConnectX = async () => {
    setConnecting(true);
    try {
      const { url } = await api.getXAuthUrl(dynamicCallbackUrl);
      const popup = window.open(url, 'x_oauth_popup', 'width=600,height=720');
      if (!popup) {
        onNotify('Popup was blocked by your browser. Allow popups for this site and click Connect again.', 'error');
      }
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : 'Add X_CLIENT_ID and X_CLIENT_SECRET first (see step-by-step guide below).',
        'error'
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectX = async () => {
    try {
      const res = await api.disconnectX();
      onReplaceStore(res.store);
      onNotify('Disconnected X account and returned to Safe Sandbox Mode.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Disconnect failed.', 'error');
    }
  };

  const handleToggleMode = async (mode: 'sandbox' | 'live') => {
    if (mode === 'live' && !activeAccount.xConnected) {
      onNotify('Connect your X account first before switching to Live X Mode.', 'error');
      return;
    }
    const nextAccounts = store.accounts.map((a) =>
      a.id === activeAccount.id ? { ...a, xMode: mode } : a
    );
    await onSaveStore({ accounts: nextAccounts });
    onNotify(
      mode === 'live'
        ? 'Switched to Live X Mode — scheduled posts will publish via Official X API v2 with automatic token refresh.'
        : 'Switched to Safe Sandbox Mode — posts simulate safely with zero API cost.'
    );
  };

  const handleTogglePremium = async () => {
    const nextAccounts = store.accounts.map((a) =>
      a.id === activeAccount.id ? { ...a, isPremium: !a.isPremium } : a
    );
    await onSaveStore({ accounts: nextAccounts });
    onNotify(
      !activeAccount.isPremium
        ? 'Enabled X Premium long-form mode (4,000 characters).'
        : 'Switched to standard 280-character X mode.'
    );
  };

  const handleAddAccount = async () => {
    if (!accName.trim() || !accHandle.trim()) {
      onNotify('Enter an account display name and @handle.', 'error');
      return;
    }
    const handle = accHandle.trim().startsWith('@') ? accHandle.trim() : `@${accHandle.trim()}`;
    const newAcc: AccountProfile = {
      id: `acc-${Date.now()}`,
      name: accName.trim(),
      handle,
      bio: accBio.trim() || `${store.brandBrain.niche} creator`,
      avatarUrl: activeAccount.avatarUrl,
      followers: 0,
      verified: false,
      isPremium: false,
      xConnected: false,
      xMode: 'sandbox',
    };
    await onSaveStore({
      accounts: [...store.accounts, newAcc],
      activeAccountId: newAcc.id,
    });
    setAccName('');
    setAccHandle('');
    setAccBio('');
    onNotify(`Added and switched to ${handle}.`);
  };

  const handleExportBackup = async () => {
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ghostpilot-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify('Downloaded full local JSON database backup.');
    } catch {
      onNotify('Failed to export backup.', 'error');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as GhostPilotStore;
      const restored = await api.importBackup(parsed);
      onReplaceStore(restored);
      onNotify('Restored full GhostPilot database from JSON backup.');
    } catch {
      onNotify('Invalid JSON backup file.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyText = async (val: string, label: string) => {
    try {
      await navigator.clipboard.writeText(val);
      onNotify(`Copied ${label}.`);
    } catch {
      onNotify(`Select and copy ${label} manually.`, 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-[-0.025em] text-[#1D1D1F] dark:text-[#F5F5F7]">
          X Connection &amp; Account Setup
        </h2>
        <p className="mt-1 text-sm text-[#6E6E73] dark:text-[#98989D]">
          Connect Official X API v2 (OAuth 2.0 PKCE with automatic token refresh), manage multiple accounts, and back up your $0 local database.
        </p>
      </div>

      {/* Official X OAuth 2.0 PKCE Connection */}
      <section className="apple-card p-6 lg:p-7 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-base font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
              Official X API v2 — OAuth 2.0 PKCE (Auto-Refresh Enabled)
            </h3>
            <div className="text-xs text-[#6E6E73] dark:text-[#98989D]">
              Environment keys:{' '}
              <span
                className={
                  xConfig?.configured
                    ? 'text-[#248A3D] dark:text-[#30D158] font-semibold'
                    : 'text-[#FF9500] dark:text-[#FF9F0A] font-semibold'
                }
              >
                {xConfig?.configured ? 'Configured (Ready to Connect)' : 'Waiting for X_CLIENT_ID & X_CLIENT_SECRET'}
              </span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              Account:{' '}
              <span className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {activeAccount.xConnected ? `Connected (${activeAccount.handle})` : 'Not connected'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeAccount.xConnected ? (
              <button
                type="button"
                onClick={handleDisconnectX}
                className="apple-btn-secondary px-4 py-2 text-xs text-[#D70015] dark:text-[#FF453A]"
              >
                Disconnect X
              </button>
            ) : (
              <button
                type="button"
                disabled={connecting}
                onClick={handleConnectX}
                className="apple-btn-primary px-5 py-2.5 text-sm"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>{connecting ? 'Opening X...' : 'Connect X Account'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Sandbox vs Live Mode Switch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => handleToggleMode('sandbox')}
            className={`text-left rounded-[14px] border p-4 transition-all ${
              activeAccount.xMode === 'sandbox'
                ? 'border-[#0071E3] dark:border-[#0A84FF] bg-[#0071E3]/[0.05] dark:bg-[#0A84FF]/12'
                : 'border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7] dark:bg-[#1C1C1E]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
                Safe Sandbox + $0 Post on X
              </span>
              {activeAccount.xMode === 'sandbox' && (
                <CheckCircle2 className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
              )}
            </div>
            <p className="mt-1.5 text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
              $0 forever. Test your queue safely or click &quot;Post on X ($0)&quot; on any tweet to open X pre-filled with 1 click.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleToggleMode('live')}
            className={`text-left rounded-[14px] border p-4 transition-all ${
              activeAccount.xMode === 'live'
                ? 'border-[#248A3D] dark:border-[#30D158] bg-[#34C759]/[0.08]'
                : 'border-black/[0.06] dark:border-white/[0.08] bg-[#F5F5F7] dark:bg-[#1C1C1E]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                Live Official X Autopilot
              </span>
              {activeAccount.xMode === 'live' && (
                <CheckCircle2 className="h-4 w-4 text-[#248A3D] dark:text-[#30D158]" aria-hidden="true" />
              )}
            </div>
            <p className="mt-1.5 text-xs text-[#6E6E73] dark:text-[#98989D] leading-relaxed">
              Continuous official posting via X API v2 (~$0.015/text post on Pay-Per-Use) with automatic 2-hour token refresh &amp; zero ban risk.
            </p>
          </button>
        </div>

        {/* Exact Callback URL + Beginner Developer Portal Guide */}
        <div className="apple-subsurface p-5 space-y-3.5">
          <div className="text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Your Exact Callback URL (Copy &amp; Paste into console.x.com)
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-[10px] border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#161618] px-3.5 py-2 font-mono text-xs text-[#0071E3] dark:text-[#0A84FF] overflow-x-auto">
              {dynamicCallbackUrl}
            </code>
            <button
              type="button"
              onClick={() => copyText(dynamicCallbackUrl, 'Callback URL')}
              className="apple-btn-secondary px-4 py-2 text-xs font-semibold shrink-0"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Copy</span>
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-xs text-[#515154] dark:text-[#A1A1A6] leading-relaxed">
            <li>Open <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">console.x.com</strong> → click <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Apps</strong> → click your active app.</li>
            <li>Open <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">User authentication settings (OAuth 2.0)</strong> → select <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Read and write</strong> + <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Web App, Automated App or Bot</strong>.</li>
            <li>Paste the Callback URL above (and <code className="font-mono">http://localhost:3000/auth/x/callback</code> if running inside Antigravity) into <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Callback URI / Redirect URL</strong>, then Save.</li>
            <li>Copy your <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">OAuth 2.0 Client ID</strong> and <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Client Secret</strong> into <code className="font-mono">X_CLIENT_ID</code> and <code className="font-mono">X_CLIENT_SECRET</code> in your environment variables, then click <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Connect X Account</strong> above.</li>
          </ol>
          <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08] text-xs text-[#515154] dark:text-[#A1A1A6] leading-relaxed">
            <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">Cost-Smart Engineering Tip:</strong> X Pay-Per-Use charges <strong className="font-mono">$0.015</strong> for a plain text tweet vs <strong className="font-mono">$0.20</strong> if the tweet contains a URL. Keep Tweet 1 link-free (put links in your bio or reply), set a <strong className="font-mono">$5/month</strong> spending limit in <code className="font-mono">console.x.com → Billing</code>, and 3 posts/day costs only ~$1.35/month — with 100% official account safety!
          </div>
        </div>

        <label className="flex items-center justify-between pt-4 border-t border-black/[0.06] dark:border-white/[0.08] cursor-pointer">
          <div>
            <div className="text-sm font-medium text-[#1D1D1F] dark:text-[#F5F5F7]">
              X Premium Long-Form Mode (4,000 characters)
            </div>
            <div className="text-xs text-[#6E6E73] dark:text-[#98989D]">
              Enable this if your X account has Premium so Copy Lab raises the 280-character limit.
            </div>
          </div>
          <input
            type="checkbox"
            checked={activeAccount.isPremium}
            onChange={handleTogglePremium}
            className="h-4 w-4 accent-[#0071E3]"
          />
        </label>
      </section>

      {/* Multi-Account Management */}
      <section className="apple-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
          <h3 className="font-display text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            Individual X Accounts ({store.accounts.length} profile{store.accounts.length === 1 ? '' : 's'})
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <input
            type="text"
            value={accName}
            onChange={(e) => setAccName(e.target.value)}
            placeholder="Display Name (e.g., AI Tools Radar)"
            className="md:col-span-3 apple-input"
          />
          <input
            type="text"
            value={accHandle}
            onChange={(e) => setAccHandle(e.target.value)}
            placeholder="@handle"
            className="md:col-span-3 apple-input"
          />
          <input
            type="text"
            value={accBio}
            onChange={(e) => setAccBio(e.target.value)}
            placeholder="Short niche bio"
            className="md:col-span-4 apple-input"
          />
          <button
            type="button"
            onClick={handleAddAccount}
            className="md:col-span-2 apple-btn-secondary px-4 py-2.5 text-sm font-semibold"
          >
            <Plus className="h-4 w-4 text-[#0071E3] dark:text-[#0A84FF]" aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>
      </section>

      {/* $0 Local Unlimited Database Backup & Restore */}
      <section className="apple-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] flex items-center gap-2">
            <Database className="h-4 w-4 text-[#248A3D] dark:text-[#30D158]" aria-hidden="true" />
            <span>
              $0 Unlimited Local File Database (
              <code className="font-mono text-xs text-[#0071E3] dark:text-[#0A84FF]">
                data/ghostpilot-db.json
              </code>
              )
            </span>
          </h3>
          <p className="text-xs text-[#6E6E73] dark:text-[#98989D]">
            All posts, Lead Magnet PDFs, carousels, dossiers, and CRM leads save locally with zero storage limits or monthly fees.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportBackup}
            className="apple-btn-secondary px-4 py-2 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download Backup</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportBackup}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="apple-btn-secondary px-4 py-2 text-xs font-semibold"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Restore JSON</span>
          </button>
        </div>
      </section>
    </div>
  );
}
