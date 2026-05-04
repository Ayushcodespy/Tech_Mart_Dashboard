import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { usersApi } from '../api/endpoints';
import { EmptyState } from '../components/ui/EmptyState';
import { Loader } from '../components/ui/Loader';
import { Panel } from '../components/ui/Panel';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDateTime } from '../components/ui/utils';

const ROLE_OPTIONS = ['USER', 'STAFF', 'MANAGER', 'SUPER_ADMIN', 'ADMIN'];

export const UsersPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStrategy, setDeleteStrategy] = useState('set_null');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await usersApi.list({ page: 1, pageSize: 100 });
      setRows(data.data || []);
    } catch (err) {
      if (err?.response?.status === 403) {
        setError('Only SUPER_ADMIN can access user management.');
      } else {
        setError(err?.response?.data?.detail || 'Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateRole = async (userId, role) => {
    try {
      await usersApi.setRole(userId, role);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Role update failed');
    }
  };

  const openDeleteDialog = (user) => {
    setDeleteTarget(user);
    setDeleteStrategy('set_null');
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteStrategy('set_null');
  };

  const removeUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      const hasLinkedDetails =
        Number(deleteTarget.order_count || 0) > 0 ||
        Number(deleteTarget.inventory_log_count || 0) > 0 ||
        Number(deleteTarget.activity_log_count || 0) > 0;
      const params = hasLinkedDetails ? { related_strategy: deleteStrategy } : undefined;
      await usersApi.remove(deleteTarget.id, params);
      setDeleteTarget(null);
      setDeleteStrategy('set_null');
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Panel title="User Roles & Access">
        {loading ? (
          <Loader label="Loading users..." />
        ) : error && rows.length === 0 ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : rows.length === 0 ? (
          <EmptyState title="No users found" subtitle="Users will appear after registrations." />
        ) : (
          <div className="space-y-3">
            {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="table-head text-left">User</th>
                    <th className="table-head text-left">Contact</th>
                    <th className="table-head text-left">Role</th>
                    <th className="table-head text-left">Status</th>
                    <th className="table-head text-left">Joined</th>
                    <th className="table-head text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((user) => (
                    <tr key={user.id}>
                      <td className="table-cell">
                        <p className="font-semibold text-slate-900">{user.full_name}</p>
                        <p className="text-xs text-slate-500">#{user.id}</p>
                      </td>
                      <td className="table-cell">
                        <p>{user.email}</p>
                        <p className="text-xs text-slate-500">{user.phone || '-'}</p>
                        <p className="text-xs text-slate-500">Orders: {user.order_count || 0}</p>
                      </td>
                      <td className="table-cell">
                        <select
                          value={user.role}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          onChange={(e) => updateRole(user.id, e.target.value)}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{role}</option>
                          ))}
                        </select>
                      </td>
                      <td className="table-cell">
                        <StatusBadge label={user.is_active ? 'Active' : 'Disabled'} tone={user.is_active ? 'success' : 'danger'} />
                      </td>
                      <td className="table-cell text-xs text-slate-500">{formatDateTime(user.created_at)}</td>
                      <td className="table-cell">
                        <button className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => openDeleteDialog(user)}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Delete User</h3>
              <button className="text-sm text-slate-500" onClick={closeDeleteDialog}>Close</button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Delete <span className="font-semibold text-slate-900">{deleteTarget.full_name}</span>?
              </p>
              <p className="text-xs text-slate-500">{deleteTarget.email}</p>

              {Number(deleteTarget.order_count || 0) > 0 ||
              Number(deleteTarget.inventory_log_count || 0) > 0 ||
              Number(deleteTarget.activity_log_count || 0) > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    This user has linked records:
                    {' '}
                    <span className="font-semibold text-slate-900">Orders {deleteTarget.order_count || 0}</span>,
                    {' '}
                    <span className="font-semibold text-slate-900">Inventory logs {deleteTarget.inventory_log_count || 0}</span>,
                    {' '}
                    <span className="font-semibold text-slate-900">Activity logs {deleteTarget.activity_log_count || 0}</span>.
                  </p>

                  <label className={`block cursor-pointer rounded-xl border p-3 ${deleteStrategy === 'set_null' ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="user-delete-strategy"
                        checked={deleteStrategy === 'set_null'}
                        onChange={() => setDeleteStrategy('set_null')}
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Keep related details and set user to None</p>
                        <p className="text-xs text-slate-500">Orders and logs will stay, but the user reference will become None/null.</p>
                      </div>
                    </div>
                  </label>

                  <label className={`block cursor-pointer rounded-xl border p-3 ${deleteStrategy === 'delete_related' ? 'border-rose-400 bg-rose-50' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="user-delete-strategy"
                        checked={deleteStrategy === 'delete_related'}
                        onChange={() => setDeleteStrategy('delete_related')}
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Delete related details too</p>
                        <p className="text-xs text-slate-500">Orders, user-linked logs, cart, wishlist, and session data for this user will also be removed.</p>
                      </div>
                    </div>
                  </label>
                </div>
              ) : (
                <p className="text-sm text-slate-600">This user has no linked order or log history.</p>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={closeDeleteDialog}>
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                onClick={removeUser}
              >
                {deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
