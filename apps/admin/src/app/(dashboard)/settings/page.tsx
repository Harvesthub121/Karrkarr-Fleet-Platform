'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '@/lib/api-client';
import { Can } from '@/lib/permissions';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@vida/shared';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';

type SettingsTab = 'policy' | 'company' | 'branches' | 'users';

interface PolicySettings {
  lateInterestRatePct: number;
  gracePeriodDays: number;
  reminderScheduleDays: number[];
  expiryWarningDays: { insurance: number; roadTax: number; coe: number; servicing: number };
  payNowUen: string;
  bankName: string;
  bankAccountNo: string;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
}

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  branchName: string | null;
  isActive: boolean;
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-zinc-100">
      <div className="w-56 shrink-0">
        <p className="text-xs font-medium text-zinc-800">{label}</p>
        {hint && <p className="text-2xs text-zinc-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step ?? 1}
        disabled={disabled}
        className="w-24 px-2 py-1 text-xs border border-zinc-200 rounded-sm focus:outline-none focus:border-teal-500 tabular-nums disabled:bg-zinc-50 disabled:text-zinc-400"
      />
      {suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
    </div>
  );
}

export default function SettingsPage() {
  const { show } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('policy');
  const [policy, setPolicy] = useState<PolicySettings | null>(null);
  const [policyDraft, setPolicyDraft] = useState<PolicySettings | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ field: string; oldVal: string; newVal: string; onConfirm: () => void } | null>(null);

  useEffect(() => {
    apiGet<PolicySettings>('/policy/settings')
      .then(p => { setPolicy(p); setPolicyDraft(p); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'branches') {
      apiGet<Branch[]>('/branches').then(setBranches).catch(() => {});
    }
    if (activeTab === 'users') {
      apiGet<AdminUser[]>('/users').then(setUsers).catch(() => {});
    }
  }, [activeTab]);

  async function savePolicyField(field: keyof PolicySettings, newVal: unknown, oldVal: unknown) {
    if (!policyDraft) return;
    setConfirmModal({
      field: field.replace(/([A-Z])/g, ' $1').trim(),
      oldVal: JSON.stringify(oldVal),
      newVal: JSON.stringify(newVal),
      onConfirm: async () => {
        setPolicyLoading(true);
        try {
          const updated = await apiPatch<PolicySettings>('/policy/settings', { [field]: newVal });
          setPolicy(updated);
          setPolicyDraft(updated);
          show(`${field} updated`, 'success');
        } catch {
          show('Failed to update setting', 'error');
          setPolicyDraft(policy);
        } finally {
          setPolicyLoading(false);
          setConfirmModal(null);
        }
      },
    });
  }

  const TABS: { key: SettingsTab; label: string }[] = [
    { key: 'policy', label: 'Policy' },
    { key: 'company', label: 'Company & Payment' },
    { key: 'branches', label: 'Branches' },
    { key: 'users', label: 'Admin Users' },
  ];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-base font-semibold text-zinc-900">Settings</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Business configuration — changes take effect immediately</p>
      </div>

      <div className="border-b border-zinc-200">
        <div className="flex">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'px-3 py-2 text-xs font-medium border-b-2 transition-colors',
                activeTab === t.key ? 'border-teal-500 text-teal-700' : 'border-transparent text-zinc-500 hover:text-zinc-800',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Can permission={PERMISSIONS.POLICY_MANAGE} fallback={
        <div className="bg-amber-50 border border-amber-200 rounded-sm px-4 py-3 text-xs text-amber-700">
          You do not have permission to modify settings. Contact a Super Admin.
        </div>
      }>
        <>
          {activeTab === 'policy' && policyDraft && (
            <div className="bg-white border border-zinc-200 rounded-sm px-4 py-2 max-w-2xl">
              <FieldRow
                label="Late Interest Rate"
                hint="Charged daily on overdue principal"
              >
                <div className="flex items-center gap-3">
                  <NumberInput
                    value={policyDraft.lateInterestRatePct}
                    onChange={v => setPolicyDraft(d => d ? { ...d, lateInterestRatePct: v } : d)}
                    min={0}
                    max={10}
                    step={0.01}
                    suffix="%"
                  />
                  {policyDraft.lateInterestRatePct !== policy?.lateInterestRatePct && (
                    <button
                      onClick={() => savePolicyField('lateInterestRatePct', policyDraft.lateInterestRatePct, policy?.lateInterestRatePct)}
                      disabled={policyLoading}
                      className="text-xs px-2 py-1 bg-teal-500 text-white rounded-sm hover:bg-teal-600 disabled:opacity-50"
                    >
                      Save
                    </button>
                  )}
                  <span className="text-2xs text-zinc-400">Current: {policy?.lateInterestRatePct}%</span>
                </div>
              </FieldRow>

              <FieldRow
                label="Grace Period"
                hint="Days after due date before interest starts"
              >
                <div className="flex items-center gap-3">
                  <NumberInput
                    value={policyDraft.gracePeriodDays}
                    onChange={v => setPolicyDraft(d => d ? { ...d, gracePeriodDays: v } : d)}
                    min={0}
                    max={30}
                    suffix="days"
                  />
                  {policyDraft.gracePeriodDays !== policy?.gracePeriodDays && (
                    <button
                      onClick={() => savePolicyField('gracePeriodDays', policyDraft.gracePeriodDays, policy?.gracePeriodDays)}
                      disabled={policyLoading}
                      className="text-xs px-2 py-1 bg-teal-500 text-white rounded-sm hover:bg-teal-600 disabled:opacity-50"
                    >
                      Save
                    </button>
                  )}
                  <span className="text-2xs text-zinc-400">Current: {policy?.gracePeriodDays} days</span>
                </div>
              </FieldRow>

              <FieldRow
                label="Expiry Warning — Insurance"
                hint="Notify N days before insurance expires"
              >
                <div className="flex items-center gap-3">
                  <NumberInput
                    value={policyDraft.expiryWarningDays.insurance}
                    onChange={v => setPolicyDraft(d => d ? { ...d, expiryWarningDays: { ...d.expiryWarningDays, insurance: v } } : d)}
                    min={1}
                    max={180}
                    suffix="days"
                  />
                  {policyDraft.expiryWarningDays.insurance !== policy?.expiryWarningDays.insurance && (
                    <button
                      onClick={() => savePolicyField('expiryWarningDays', policyDraft.expiryWarningDays, policy?.expiryWarningDays)}
                      disabled={policyLoading}
                      className="text-xs px-2 py-1 bg-teal-500 text-white rounded-sm hover:bg-teal-600 disabled:opacity-50"
                    >
                      Save
                    </button>
                  )}
                </div>
              </FieldRow>

              <FieldRow label="Expiry Warning — Road Tax" hint="Notify N days before road tax expires">
                <NumberInput
                  value={policyDraft.expiryWarningDays.roadTax}
                  onChange={v => setPolicyDraft(d => d ? { ...d, expiryWarningDays: { ...d.expiryWarningDays, roadTax: v } } : d)}
                  min={1} max={180} suffix="days"
                />
              </FieldRow>

              <FieldRow label="Expiry Warning — COE" hint="Notify N days before COE expires">
                <NumberInput
                  value={policyDraft.expiryWarningDays.coe}
                  onChange={v => setPolicyDraft(d => d ? { ...d, expiryWarningDays: { ...d.expiryWarningDays, coe: v } } : d)}
                  min={1} max={365} suffix="days"
                />
              </FieldRow>

              <FieldRow label="Reminder Schedule" hint="Days after due date to send automated reminders">
                <div>
                  <p className="text-xs text-zinc-600 font-mono">
                    [{policyDraft.reminderScheduleDays.join(', ')}]
                  </p>
                  <p className="text-2xs text-zinc-400 mt-0.5">
                    Edit via API — e.g. [1, 3, 7, 14, 30]
                  </p>
                </div>
              </FieldRow>
            </div>
          )}

          {activeTab === 'company' && policyDraft && (
            <div className="bg-white border border-zinc-200 rounded-sm px-4 py-2 max-w-2xl">
              <FieldRow label="PayNow UEN" hint="Shown on payment instructions">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={policyDraft.payNowUen}
                    onChange={e => setPolicyDraft(d => d ? { ...d, payNowUen: e.target.value } : d)}
                    className="text-xs border border-zinc-200 rounded-sm px-2 py-1 focus:outline-none focus:border-teal-500 w-40"
                  />
                  {policyDraft.payNowUen !== policy?.payNowUen && (
                    <button
                      onClick={() => savePolicyField('payNowUen', policyDraft.payNowUen, policy?.payNowUen)}
                      className="text-xs px-2 py-1 bg-teal-500 text-white rounded-sm hover:bg-teal-600"
                    >
                      Save
                    </button>
                  )}
                  <span className="text-2xs text-zinc-400">Current: {policy?.payNowUen}</span>
                </div>
              </FieldRow>
              <FieldRow label="Bank Name" hint="For bank transfer instructions">
                <input
                  type="text"
                  value={policyDraft.bankName}
                  onChange={e => setPolicyDraft(d => d ? { ...d, bankName: e.target.value } : d)}
                  className="text-xs border border-zinc-200 rounded-sm px-2 py-1 focus:outline-none focus:border-teal-500 w-48"
                />
              </FieldRow>
              <FieldRow label="Bank Account No." hint="For bank transfer instructions">
                <input
                  type="text"
                  value={policyDraft.bankAccountNo}
                  onChange={e => setPolicyDraft(d => d ? { ...d, bankAccountNo: e.target.value } : d)}
                  className="text-xs border border-zinc-200 rounded-sm px-2 py-1 focus:outline-none focus:border-teal-500 w-40 font-mono"
                />
              </FieldRow>
            </div>
          )}

          {activeTab === 'branches' && (
            <div className="space-y-2 max-w-2xl">
              {branches.map(b => (
                <div key={b.id} className="bg-white border border-zinc-200 rounded-sm px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 flex items-center gap-2">
                      {b.name}
                      {!b.isActive && <span className="text-2xs text-zinc-400 border border-zinc-200 rounded px-1">Inactive</span>}
                    </p>
                    <p className="text-2xs text-zinc-400 mt-0.5">{b.address} &bull; {b.phone}</p>
                  </div>
                  <Can permission={PERMISSIONS.BRANCH_MANAGE}>
                    <button className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-sm px-2 py-1">
                      Edit
                    </button>
                  </Can>
                </div>
              ))}
              <Can permission={PERMISSIONS.BRANCH_MANAGE}>
                <button className="text-xs text-teal-600 hover:underline">+ Add Branch</button>
              </Can>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="max-w-3xl">
              <div className="overflow-x-auto border border-zinc-200 rounded-sm">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      <th className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-400">Name</th>
                      <th className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-400">Email</th>
                      <th className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-400">Role</th>
                      <th className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-400">Branch</th>
                      <th className="px-3 py-2 text-left text-2xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-zinc-50">
                        <td className="px-3 py-2 font-medium text-zinc-900">{u.fullName}</td>
                        <td className="px-3 py-2 text-zinc-500">{u.email}</td>
                        <td className="px-3 py-2">
                          <span className="text-2xs font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-zinc-500">{u.branchName ?? 'All'}</td>
                        <td className="px-3 py-2">
                          <span className={cn('text-2xs px-1 py-0.5 rounded', u.isActive ? 'text-emerald-700 bg-emerald-50' : 'text-zinc-400 bg-zinc-100')}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <Can permission={PERMISSIONS.USER_MANAGE}>
                            <button className="text-2xs text-zinc-400 hover:text-zinc-700">Edit</button>
                          </Can>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Can permission={PERMISSIONS.USER_MANAGE}>
                <button className="mt-3 text-xs text-teal-600 hover:underline">+ Invite Admin User</button>
              </Can>
            </div>
          )}
        </>
      </Can>

      {/* Confirmation modal */}
      <Modal
        open={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title="Confirm Setting Change"
        size="sm"
      >
        {confirmModal && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-700">
              You are about to change <span className="font-semibold">{confirmModal.field}</span>:
            </p>
            <div className="bg-zinc-50 border border-zinc-200 rounded-sm px-3 py-2 text-xs font-mono">
              <p className="text-zinc-400">Before: {confirmModal.oldVal}</p>
              <p className="text-teal-700">After:&nbsp; {confirmModal.newVal}</p>
            </div>
            <p className="text-2xs text-zinc-500">This change takes effect immediately and applies to all future calculations.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmModal(null)} className="px-3 py-1.5 text-xs border border-zinc-200 rounded-sm hover:bg-zinc-50">Cancel</button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-3 py-1.5 text-xs bg-teal-500 text-white rounded-sm hover:bg-teal-600"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
