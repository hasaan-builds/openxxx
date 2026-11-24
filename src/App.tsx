import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AccountLoginGate } from './components/AccountLoginGate';
import { NicheLockdownWizard } from './components/NicheLockdownWizard';
import { Sidebar } from './components/Sidebar';
import { ToastStack, type ToastMessage } from './components/Toast';
import { TopBar } from './components/TopBar';
import { mergeScopedPatchIntoStore, scopeStoreToAccount } from './lib/accountScope';
import { api } from './lib/api';
import type {
  AccountNicheProfile,
  AccountProfile,
  BrandBrain,
  GhostPilotStore,
  NavSection,
} from './lib/types';
import { SimpleAccountsTelegramView } from './views/SimpleAccountsTelegramView';
import { SimpleEngageDmView } from './views/SimpleEngageDmView';
import { SimpleIdeasView } from './views/SimpleIdeasView';
import { SimpleQueuePdfsView } from './views/SimpleQueuePdfsView';
import { SimpleTodayView } from './views/SimpleTodayView';

type SimpleHub = 'today' | 'ideas' | 'queue-pdfs' | 'engage-dm' | 'accounts-telegram';

export function App() {
  const [store, setStore] = useState<GhostPilotStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [signedInAccountId, setSignedInAccountId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('ghostpilot-signed-in-account');
    } catch {
      return null;
    }
  });

  const [activeHub, setActiveHub] = useState<SimpleHub>('today');
  const [queueInitialTab, setQueueInitialTab] = useState<'posts' | 'pdfs' | 'write'>('posts');
  const [incomingDraftBlocks, setIncomingDraftBlocks] = useState<string[] | undefined>(undefined);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [manualWizardOpen, setManualWizardOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ghostpilot-theme') === 'dark';
    } catch {
      return false;
    }
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('ghostpilot-theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage errors
    }
  }, [darkMode]);

  const persistSignedInSession = useCallback((accountId: string | null) => {
    setSignedInAccountId(accountId);
    try {
      if (accountId) {
        localStorage.setItem('ghostpilot-signed-in-account', accountId);
      } else {
        localStorage.removeItem('ghostpilot-signed-in-account');
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const notify = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchStore = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getStore();
      setStore(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to reach GhostPilot local server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  const navigateTo = useCallback((section: NavSection) => {
    if (section === 'today' || section === 'autopilot' || section === 'analytics') {
      setActiveHub('today');
      return;
    }
    if (section === 'ideas' || section === 'research-hub' || section === 'research' || section === 'viral') {
      setActiveHub('ideas');
      return;
    }
    if (section === 'engage-dm' || section === 'crm' || section === 'grow-hub') {
      setActiveHub('engage-dm');
      return;
    }
    if (section === 'lead-magnets' || section === 'carousels') {
      setQueueInitialTab('pdfs');
      setActiveHub('queue-pdfs');
      return;
    }
    if (section === 'write') {
      setQueueInitialTab('write');
      setActiveHub('queue-pdfs');
      return;
    }
    if (
      section === 'queue-pdfs' ||
      section === 'write-hub' ||
      section === 'queue' ||
      section === 'automations'
    ) {
      setQueueInitialTab('posts');
      setActiveHub('queue-pdfs');
      return;
    }
    setActiveHub('accounts-telegram');
  }, []);

  const handleScopedUpdateStore = useCallback(
    async (patch: Partial<GhostPilotStore>) => {
      if (!store) return;
      const activeId = store.activeAccountId;
      const mergedPatch = mergeScopedPatchIntoStore(store, activeId, patch);
      setStore((prev) => (prev ? { ...prev, ...mergedPatch } : prev));
      const updated = await api.saveStore(mergedPatch);
      setStore(updated);
    },
    [store]
  );

  const handleRawUpdateStore = useCallback(async (patch: Partial<GhostPilotStore>) => {
    setStore((prev) => (prev ? { ...prev, ...patch } : prev));
    const updated = await api.saveStore(patch);
    setStore(updated);
  }, []);

  const handleSignInExisting = useCallback(
    async (accountId: string) => {
      if (!store) return;
      const target = store.accounts.find((a) => a.id === accountId);
      if (!target) return;
      const nextBrain = target.brandBrain ?? store.brandBrain;
      await handleRawUpdateStore({
        activeAccountId: accountId,
        brandBrain: nextBrain,
      });
      persistSignedInSession(accountId);
      setActiveHub('today');
      notify(`Switched to ${target.handle}.`);
    },
    [store, handleRawUpdateStore, persistSignedInSession, notify]
  );

  const handleCreateAndSignInAccount = useCallback(
    async (name: string, rawHandle: string) => {
      if (!store) return;
      const handle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
      const activeAcc =
        store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
      const newAcc: AccountProfile = {
        id: `acc-${Date.now()}`,
        name,
        handle,
        bio: '',
        avatarUrl: activeAcc.avatarUrl,
        followers: 0,
        verified: false,
        isPremium: false,
        xConnected: false,
        xMode: 'sandbox',
        nicheProfile: undefined,
        brandBrain: undefined,
      };
      await handleRawUpdateStore({
        accounts: [...store.accounts, newAcc],
        activeAccountId: newAcc.id,
      });
      persistSignedInSession(newAcc.id);
      setActiveHub('today');
      notify(`Created clean workspace for ${handle}. Pick your niche now.`);
    },
    [store, handleRawUpdateStore, persistSignedInSession, notify]
  );

  const handleCompleteNicheLockdown = useCallback(
    async (result: { brandBrain: BrandBrain; nicheProfile: AccountNicheProfile }) => {
      if (!store) return;
      const nextAccounts = store.accounts.map((acc) =>
        acc.id === store.activeAccountId
          ? {
              ...acc,
              bio:
                acc.bio ||
                `${result.nicheProfile.subNicheName} · ${result.nicheProfile.microAngle}`,
              nicheProfile: result.nicheProfile,
              brandBrain: result.brandBrain,
            }
          : acc
      );
      await handleRawUpdateStore({
        accounts: nextAccounts,
        brandBrain: result.brandBrain,
      });
      setManualWizardOpen(false);
      setActiveHub('today');
      notify(`Locked ${result.nicheProfile.subNicheName}! You are ready to create posts.`);
    },
    [store, handleRawUpdateStore, notify]
  );

  const activeAccount = useMemo(() => {
    if (!store) return null;
    const matchId = signedInAccountId || store.activeAccountId;
    return store.accounts.find((a) => a.id === matchId) || store.accounts[0];
  }, [store, signedInAccountId]);

  const scopedStore = useMemo(() => {
    if (!store || !activeAccount) return null;
    return scopeStoreToAccount(store, activeAccount.id);
  }, [store, activeAccount]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] flex items-center justify-center p-6">
        <div className="w-full max-w-md apple-card p-7 space-y-4">
          <div className="h-5 w-36 rounded-full bg-black/[0.06] dark:bg-white/[0.08] animate-pulse" />
          <div className="h-3 w-full rounded-full bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
          <div className="h-3 w-3/4 rounded-full bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
        </div>
      </div>
    );
  }

  if (loadError || !store || !activeAccount || !scopedStore) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] flex items-center justify-center p-6">
        <div className="w-full max-w-md apple-card p-8 text-center space-y-4">
          <h1 className="font-display text-lg font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            GhostPilot Local Server Offline
          </h1>
          <p className="text-sm text-[#6E6E73] dark:text-[#86868B]">
            {loadError || 'Could not load your local database.'}
          </p>
          <button
            type="button"
            onClick={fetchStore}
            className="apple-btn-primary px-5 py-2.5 text-sm"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    );
  }

  const isSignedIn = Boolean(
    signedInAccountId && store.accounts.some((a) => a.id === signedInAccountId)
  );
  if (!isSignedIn) {
    return (
      <>
        <AccountLoginGate
          accounts={store.accounts}
          onSignInExisting={handleSignInExisting}
          onCreateAndSignIn={handleCreateAndSignInAccount}
          onNotify={notify}
        />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const needsForcedLockdown = !activeAccount.nicheProfile?.locked;
  const showNicheWizard = needsForcedLockdown || manualWizardOpen;
  const queuedCount = scopedStore.posts.filter(
    (p) => p.status === 'queued' || p.status === 'draft'
  ).length;

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-[#1D1D1F] dark:text-[#F5F5F7] flex">
      <Sidebar
        activeSection={activeHub}
        onSelectSection={navigateTo}
        accounts={store.accounts}
        activeAccount={activeAccount}
        onSwitchAccount={handleSignInExisting}
        onQuickAddAccount={handleCreateAndSignInAccount}
        onOpenNicheWizard={() => setManualWizardOpen(true)}
        onLogout={() => {
          persistSignedInSession(null);
          notify('Signed out — choose or create any X account.');
        }}
        queuedCount={queuedCount}
        pendingAntigravityCount={0}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeHub}
          activeAccount={activeAccount}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode((d) => !d)}
          onNewPost={() => {
            setQueueInitialTab('write');
            setActiveHub('queue-pdfs');
          }}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-8 max-w-[1160px] w-full mx-auto">
          {activeHub === 'today' && (
            <SimpleTodayView
              key={`today-${activeAccount.id}`}
              store={scopedStore}
              activeAccount={activeAccount}
              onReplaceStore={setStore}
              onNavigate={navigateTo}
              onOpenNicheWizard={() => setManualWizardOpen(true)}
              onNotify={notify}
            />
          )}

          {activeHub === 'ideas' && (
            <SimpleIdeasView
              key={`ideas-${activeAccount.id}`}
              store={scopedStore}
              onUpdateStore={handleScopedUpdateStore}
              onReplaceStore={setStore}
              onOpenQueue={() => {
                setQueueInitialTab('posts');
                setActiveHub('queue-pdfs');
              }}
              onOpenPdfs={() => {
                setQueueInitialTab('pdfs');
                setActiveHub('queue-pdfs');
              }}
              onLoadDraftInWrite={(blocks) => {
                setIncomingDraftBlocks(blocks);
                setQueueInitialTab('write');
                setActiveHub('queue-pdfs');
              }}
              onNotify={notify}
            />
          )}

          {activeHub === 'queue-pdfs' && (
            <SimpleQueuePdfsView
              key={`queue-${activeAccount.id}`}
              store={scopedStore}
              initialTab={queueInitialTab}
              incomingDraftBlocks={incomingDraftBlocks}
              onConsumeIncomingDraft={() => setIncomingDraftBlocks(undefined)}
              onUpdateStore={handleScopedUpdateStore}
              onReplaceStore={setStore}
              onGoToTelegramSetup={() => setActiveHub('accounts-telegram')}
              onNotify={notify}
            />
          )}

          {activeHub === 'engage-dm' && (
            <SimpleEngageDmView
              key={`engage-${activeAccount.id}`}
              store={scopedStore}
              activeAccount={activeAccount}
              onUpdateStore={handleScopedUpdateStore}
              onReplaceStore={setStore}
              onGoToTelegramSetup={() => setActiveHub('accounts-telegram')}
              onNotify={notify}
            />
          )}

          {activeHub === 'accounts-telegram' && (
            <SimpleAccountsTelegramView
              key={`acc-${activeAccount.id}`}
              store={store}
              activeAccount={activeAccount}
              onSaveRawStore={handleRawUpdateStore}
              onReplaceStore={setStore}
              onSwitchAccount={handleSignInExisting}
              onCreateAccount={handleCreateAndSignInAccount}
              onOpenNicheWizard={() => setManualWizardOpen(true)}
              onNotify={notify}
            />
          )}
        </main>
      </div>

      {showNicheWizard && (
        <NicheLockdownWizard
          account={activeAccount}
          canDismiss={!needsForcedLockdown}
          onCancel={() => setManualWizardOpen(false)}
          onComplete={handleCompleteNicheLockdown}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
