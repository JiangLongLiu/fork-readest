import clsx from 'clsx';
import React, { useCallback, useState } from 'react';
import { RiAddLine, RiDeleteBinLine, RiEditLine, RiCheckLine } from 'react-icons/ri';
import { MdCheckCircle, MdRadioButtonUnchecked } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import { useServerConfig } from '@/context/ServerConfigContext';
import { isTauriAppPlatform } from '@/services/environment';
import type { ServerConfig, ServerProfile } from '@/utils/supabase';
import SubPageHeader from '../SubPageHeader';
import { SectionTitle } from '../primitives';

interface ServerManagerProps {
  onBack: () => void;
}

/**
 * Multi-server management sub-page. Lists all saved server profiles,
 * allows switching between them, adding new ones, editing, and deleting.
 *
 * Only meaningful on Tauri platform — on Web, the server is fixed by
 * runtime-config.js and this component shows a read-only indicator.
 */
const ServerManager: React.FC<ServerManagerProps> = ({ onBack }) => {
  const _ = useTranslation();
  const { profiles, activeProfileId, switchProfile, addProfile, deleteProfile, editProfile } =
    useServerConfig();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');

  // ── Add form state ──────────────────────────────────────────────
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newAnonKey, setNewAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const isTauri = isTauriAppPlatform();

  const handleTestAndAdd = useCallback(async () => {
    const url = newUrl.trim().replace(/\/+$/, '');
    if (!url) {
      setError(_('Please enter the server URL'));
      return;
    }
    setTesting(true);
    setError('');

    try {
      const resp = await fetch(`${url}/auth/v1/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok && resp.status !== 401) {
        setError(_('Server responded with status {{status}}', { status: resp.status }));
        setTesting(false);
        return;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(_('Cannot reach server: {{msg}}', { msg }));
      setTesting(false);
      return;
    }

    const config: ServerConfig = {
      supabaseUrl: url,
      ...(newAnonKey.trim() ? { supabaseAnonKey: newAnonKey.trim() } : {}),
      apiBaseUrl: url,
      webBaseUrl: url,
    };
    const name = newName.trim() || url.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    addProfile(name, config);
    setShowAddForm(false);
    setNewName('');
    setNewUrl('');
    setNewAnonKey('');
    setTesting(false);
  }, [newUrl, newName, newAnonKey, addProfile, _]);

  const handleSwitch = useCallback(
    (id: string) => {
      if (id === activeProfileId) return;
      switchProfile(id);
    },
    [activeProfileId, switchProfile],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (profiles.length <= 1) return;
      deleteProfile(id);
    },
    [profiles.length, deleteProfile],
  );

  const startEdit = useCallback((profile: ServerProfile) => {
    setEditingId(profile.id);
    setEditName(profile.name);
    setEditUrl(profile.supabaseUrl);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName('');
    setEditUrl('');
  }, []);

  const saveEdit = useCallback(
    (id: string) => {
      editProfile(id, {
        name: editName.trim() || editUrl,
        supabaseUrl: editUrl.trim().replace(/\/+$/, ''),
        apiBaseUrl: editUrl.trim().replace(/\/+$/, ''),
        webBaseUrl: editUrl.trim().replace(/\/+$/, ''),
      });
      cancelEdit();
    },
    [editName, editUrl, editProfile, cancelEdit],
  );

  const description = isTauri
    ? _(
        'Manage your self-hosted servers. Switch between profiles to connect to different instances.',
      )
    : _('Server configuration is managed by the deployment environment.');

  return (
    <div className='w-full'>
      <SubPageHeader
        parentLabel={_('Integrations')}
        currentLabel={_('Servers')}
        description={description}
        onBack={onBack}
        rightSlot={
          isTauri && !showAddForm ? (
            <button
              type='button'
              onClick={() => setShowAddForm(true)}
              className='btn btn-primary btn-sm gap-1'
            >
              <RiAddLine className='h-4 w-4' />
              {_('Add')}
            </button>
          ) : undefined
        }
      />

      {/* ── Add new server form ───────────────────────────────────── */}
      {isTauri && showAddForm && (
        <div className='mb-6 space-y-4 px-4'>
          <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border p-4'>
            <h4 className='mb-3 text-sm font-semibold'>{_('Add Server')}</h4>

            <div className='space-y-3'>
              <div>
                <label className='mb-1 block text-xs font-medium opacity-70'>{_('Name')}</label>
                <input
                  type='text'
                  placeholder={_('Home Server')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className='input input-bordered eink-bordered h-10 w-full text-sm'
                />
              </div>
              <div>
                <label className='mb-1 block text-xs font-medium opacity-70'>
                  {_('Server URL')} *
                </label>
                <input
                  type='url'
                  placeholder='http://192.168.1.100:8000'
                  value={newUrl}
                  onChange={(e) => {
                    setNewUrl(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !testing) handleTestAndAdd();
                  }}
                  className='input input-bordered eink-bordered h-10 w-full text-sm'
                  autoFocus
                />
              </div>
              <div>
                <label className='mb-1 block text-xs font-medium opacity-70'>
                  {_('Anon Key')} <span className='opacity-50'>({_('optional')})</span>
                </label>
                <input
                  type='text'
                  placeholder={_('Leave blank to use the default key')}
                  value={newAnonKey}
                  onChange={(e) => setNewAnonKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !testing) handleTestAndAdd();
                  }}
                  className='input input-bordered eink-bordered h-10 w-full text-sm'
                />
              </div>

              {error && (
                <div className='text-error rounded-md bg-error/10 px-3 py-2 text-xs'>{error}</div>
              )}

              <div className='flex justify-end gap-2'>
                <button
                  type='button'
                  onClick={() => {
                    setShowAddForm(false);
                    setError('');
                  }}
                  className='btn btn-ghost btn-sm'
                >
                  {_('Cancel')}
                </button>
                <button
                  type='button'
                  onClick={handleTestAndAdd}
                  disabled={testing || !newUrl.trim()}
                  className={clsx('btn btn-primary btn-sm', testing && 'opacity-60')}
                >
                  {testing ? <span className='loading loading-spinner loading-xs' /> : _('Connect')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Server profiles list ─────────────────────────────────── */}
      <div className='px-4'>
        <SectionTitle className='mb-2'>{_('Server Profiles')}</SectionTitle>

        {profiles.length === 0 ? (
          <div className='text-base-content/50 py-8 text-center text-sm'>
            {_('No servers configured')}
          </div>
        ) : (
          <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border'>
            <div className='divide-base-200 divide-y'>
              {profiles.map((profile) => {
                const isActive = profile.id === activeProfileId;
                const isEditing = editingId === profile.id;

                if (isEditing) {
                  return (
                    <div key={profile.id} className='space-y-2 px-4 py-3'>
                      <input
                        type='text'
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className='input input-bordered eink-bordered h-9 w-full text-sm'
                        placeholder={_('Name')}
                      />
                      <input
                        type='url'
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className='input input-bordered eink-bordered h-9 w-full text-sm'
                        placeholder={_('Server URL')}
                      />
                      <div className='flex justify-end gap-2'>
                        <button type='button' onClick={cancelEdit} className='btn btn-ghost btn-xs'>
                          {_('Cancel')}
                        </button>
                        <button
                          type='button'
                          onClick={() => saveEdit(profile.id)}
                          className='btn btn-primary btn-xs gap-1'
                        >
                          <RiCheckLine className='h-3.5 w-3.5' />
                          {_('Save')}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={profile.id}
                    className={clsx(
                      'group flex items-center gap-3 px-4 py-3 transition-colors duration-150',
                      isActive && 'bg-primary/5',
                      !isActive && isTauri && 'hover:bg-base-200/50 cursor-pointer',
                    )}
                    onClick={() => !isEditing && handleSwitch(profile.id)}
                  >
                    {/* Active indicator */}
                    {isActive ? (
                      <MdCheckCircle className='text-primary h-5 w-5 flex-shrink-0' />
                    ) : (
                      <MdRadioButtonUnchecked className='text-base-content/30 h-5 w-5 flex-shrink-0' />
                    )}

                    {/* Profile info */}
                    <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                      <span
                        className={clsx(
                          'text-sm font-medium',
                          isActive ? 'text-primary' : 'text-base-content',
                        )}
                      >
                        {profile.name}
                      </span>
                      <span className='text-base-content/50 truncate text-xs'>
                        {profile.supabaseUrl}
                      </span>
                    </div>

                    {/* Actions (visible on hover or when active) */}
                    {isTauri && (
                      <div
                        className={clsx(
                          'flex flex-shrink-0 items-center gap-1',
                          'opacity-0 transition-opacity duration-150 group-hover:opacity-100',
                          isActive && 'opacity-100',
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type='button'
                          onClick={() => startEdit(profile)}
                          className='btn btn-ghost btn-xs h-7 w-7 p-0'
                          title={_('Edit')}
                        >
                          <RiEditLine className='h-3.5 w-3.5' />
                        </button>
                        {profiles.length > 1 && (
                          <button
                            type='button'
                            onClick={() => handleDelete(profile.id)}
                            className='btn btn-ghost btn-xs h-7 w-7 p-0 text-error/70 hover:text-error'
                            title={_('Delete')}
                          >
                            <RiDeleteBinLine className='h-3.5 w-3.5' />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isTauri && profiles.length > 0 && (
          <p className='text-base-content/50 mt-3 text-xs leading-relaxed'>
            {_('Click a server to switch to it. You will need to sign in again after switching.')}
          </p>
        )}
      </div>
    </div>
  );
};

export default ServerManager;
