import React, { useMemo, useState } from 'react';
import {
  Copy,
  Download,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { api } from '../lib/api';
import type { CrmContact, CrmList, GhostPilotStore } from '../lib/types';

interface EngageCrmViewProps {
  store: GhostPilotStore;
  onSaveStore: (patch: Partial<GhostPilotStore>) => Promise<void>;
  onNotify: (text: string, tone?: 'success' | 'error') => void;
}

const STAGES: CrmContact['stage'][] = ['New', 'Engaged', 'DM Sent', 'Buyer'];

export function EngageCrmView({ store, onSaveStore, onNotify }: EngageCrmViewProps) {
  const [tab, setTab] = useState<'engage' | 'crm'>('engage');
  const [selectedListId, setSelectedListId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [draftReplies, setDraftReplies] = useState<Record<string, string>>({});
  const [draftingId, setDraftingId] = useState<string | null>(null);

  // Add contact / list state
  const [newListName, setNewListName] = useState('');
  const [newName, setNewName] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newFollowers, setNewFollowers] = useState('1200');
  const [newTweet, setNewTweet] = useState('');

  const filteredContacts = useMemo(() => {
    return store.crmContacts.filter((c) => {
      if (selectedListId !== 'all' && c.listId !== selectedListId) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return `${c.name} ${c.handle} ${c.bio} ${c.latestTweet} ${c.notes}`.toLowerCase().includes(q);
      }
      return true;
    });
  }, [store.crmContacts, selectedListId, search]);

  const handleDraftReply = async (contact: CrmContact) => {
    setDraftingId(contact.id);
    try {
      const res = await api.aiGhostwrite({
        action: 'reply',
        text: contact.latestTweet || `${contact.name} (${contact.bio})`,
        tone: store.brandBrain.tone,
      });
      const replyText = res.blocks[0] || '';
      setDraftReplies((prev) => ({ ...prev, [contact.id]: replyText }));
      onNotify(`Drafted authority reply for ${contact.handle} (${res.engine}).`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to draft reply.', 'error');
    } finally {
      setDraftingId(null);
    }
  };

  const handleCopyAndLogEngagement = async (contact: CrmContact) => {
    const reply = draftReplies[contact.id];
    if (reply) {
      try {
        await navigator.clipboard.writeText(reply);
      } catch {
        // Ignore clipboard denial in automated environments
      }
    }
    const nextStage: CrmContact['stage'] = contact.stage === 'New' ? 'Engaged' : contact.stage;
    await onSaveStore({
      crmContacts: store.crmContacts.map((c) =>
        c.id === contact.id
          ? { ...c, stage: nextStage, lastInteractedAt: new Date().toISOString() }
          : c
      ),
    });
    onNotify(`Copied reply for ${contact.handle} and marked as ${nextStage}.`);
  };

  const handleAddList = async () => {
    if (!newListName.trim()) return;
    const list: CrmList = {
      id: `list-${Date.now()}`,
      name: newListName.trim(),
      description: 'Custom Twitter CRM segment',
    };
    await onSaveStore({ crmLists: [...store.crmLists, list] });
    setSelectedListId(list.id);
    setNewListName('');
    onNotify(`Created CRM list "${list.name}".`);
  };

  const handleAddContact = async () => {
    if (!newName.trim() || !newHandle.trim()) {
      onNotify('Enter a contact name and @handle.', 'error');
      return;
    }
    const handle = newHandle.trim().startsWith('@') ? newHandle.trim() : `@${newHandle.trim()}`;
    const targetListId =
      selectedListId !== 'all' ? selectedListId : store.crmLists[0]?.id || 'list-buyers';
    const contact: CrmContact = {
      id: `crm-${Date.now()}`,
      name: newName.trim(),
      handle,
      avatarUrl: store.accounts[0]?.avatarUrl || '',
      bio: newBio.trim() || `${store.brandBrain.niche} prospect`,
      followers: Number(newFollowers) || 500,
      listId: targetListId,
      stage: 'New',
      notes: '',
      latestTweet: newTweet.trim() || `Looking for better systems in ${store.brandBrain.niche}.`,
      lastInteractedAt: new Date().toISOString(),
    };
    await onSaveStore({ crmContacts: [contact, ...store.crmContacts] });
    setNewName('');
    setNewHandle('');
    setNewBio('');
    setNewTweet('');
    onNotify(`Added ${handle} to CRM.`);
  };

  const handleUpdateContact = async (id: string, patch: Partial<CrmContact>) => {
    await onSaveStore({
      crmContacts: store.crmContacts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const handleDeleteContact = async (id: string) => {
    await onSaveStore({
      crmContacts: store.crmContacts.filter((c) => c.id !== id),
    });
    onNotify('Removed contact from CRM.');
  };

  const handleExportCsv = () => {
    const header = ['Name', 'Handle', 'Followers', 'List', 'Stage', 'Notes'];
    const rows = filteredContacts.map((c) => {
      const listName = store.crmLists.find((l) => l.id === c.listId)?.name || '';
      return [
        c.name,
        c.handle,
        String(c.followers),
        listName,
        c.stage,
        c.notes.replace(/"/g, '""'),
      ]
        .map((cell) => `"${cell}"`)
        .join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ghostpilot-twitter-crm.csv';
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Exported ${filteredContacts.length} CRM contacts to CSV.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Engage Hub & Twitter CRM
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Reply to high-value creators & warm buyers with AI-drafted authority comments and track every lead to checkout.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-1">
            <button
              type="button"
              onClick={() => setTab('engage')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                tab === 'engage'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Engage Hub
            </button>
            <button
              type="button"
              onClick={() => setTab('crm')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                tab === 'crm'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Twitter CRM ({store.crmContacts.length})
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filters & Lists */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedListId('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              selectedListId === 'all'
                ? 'border-sky-600 bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            All Lists ({store.crmContacts.length})
          </button>
          {store.crmLists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => setSelectedListId(list.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                selectedListId === list.id
                  ? 'border-sky-600 bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {list.name}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter leads or tweets..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* ENGAGE HUB */}
      {tab === 'engage' && (
        <div className="space-y-4">
          {filteredContacts.map((contact) => {
            const replyText = draftReplies[contact.id] ?? '';
            return (
              <article
                key={contact.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={contact.avatarUrl}
                      alt={contact.name}
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {contact.name}{' '}
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          {contact.handle}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {contact.followers.toLocaleString()} followers · Stage: {contact.stage} ·{' '}
                        {contact.bio}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={draftingId === contact.id}
                    onClick={() => handleDraftReply(contact)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
                  >
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{draftingId === contact.id ? 'Drafting...' : 'AI Draft Reply'}</span>
                  </button>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3.5 text-sm text-slate-800 dark:text-slate-200">
                  <div className="text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" aria-hidden="true" />
                    Recent Post
                  </div>
                  {contact.latestTweet}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) =>
                      setDraftReplies((prev) => ({ ...prev, [contact.id]: e.target.value }))
                    }
                    placeholder="Write or AI-draft a high-value reply (never generic praise)..."
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyAndLogEngagement(contact)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold whitespace-nowrap"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy Reply & Mark Engaged</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* TWITTER CRM TABLE + ADD CONTACT */}
      {tab === 'crm' && (
        <div className="space-y-5">
          {/* Quick Add Contact & List */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                Add Lead or Creator to CRM
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="New CRM list name..."
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddList}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Add List</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
                className="lg:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder="@handle"
                className="lg:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
              <input
                type="number"
                value={newFollowers}
                onChange={(e) => setNewFollowers(e.target.value)}
                placeholder="Followers"
                className="lg:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={newBio}
                onChange={(e) => setNewBio(e.target.value)}
                placeholder="Role / Bio"
                className="lg:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={newTweet}
                onChange={(e) => setNewTweet(e.target.value)}
                placeholder="Latest tweet or buying signal"
                className="lg:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddContact}
                className="lg:col-span-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold px-3 py-2"
              >
                Add Contact
              </button>
            </div>
          </section>

          {/* CRM Table */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-medium">Contact</th>
                  <th className="py-3 px-4 font-medium">Followers</th>
                  <th className="py-3 px-4 font-medium">Pipeline Stage</th>
                  <th className="py-3 px-4 font-medium">Notes / Deal Context</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredContacts.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{c.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{c.handle}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
                      {c.followers.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={c.stage}
                        onChange={(e) =>
                          handleUpdateContact(c.id, {
                            stage: e.target.value as CrmContact['stage'],
                          })
                        }
                        className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-200"
                      >
                        {STAGES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 px-4">
                      <input
                        type="text"
                        defaultValue={c.notes}
                        onBlur={(e) => {
                          if (e.target.value !== c.notes) {
                            handleUpdateContact(c.id, { notes: e.target.value });
                          }
                        }}
                        placeholder="Add follow-up note..."
                        className="w-full min-w-[200px] bg-transparent border-b border-transparent focus:border-sky-500 text-xs text-slate-700 dark:text-slate-300 focus:outline-none py-1"
                      />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteContact(c.id)}
                        aria-label={`Remove ${c.name}`}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
