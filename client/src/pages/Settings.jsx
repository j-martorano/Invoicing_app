import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { pad4 } from '../lib/clientCode';

export default function Settings() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetch('/api/counter')
      .then(r => r.json())
      .then(data => {
        setRows((data.clients || []).map(c => ({ ...c, nextInput: String(c.next) })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function updateRow(code, value) {
    setRows(prev => prev.map(r => (r.code === code ? { ...r, nextInput: value } : r)));
  }

  function parsedNext(row) {
    const n = parseInt(row.nextInput, 10);
    return Number.isInteger(n) && n >= 1 ? n : null;
  }

  const allValid = rows.every(r => parsedNext(r) !== null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!allValid) return showToast('Every next number must be a positive integer.', 'error');

    setSaving(true);
    try {
      const clients = {};
      for (const r of rows) clients[r.code] = parsedNext(r);
      const res = await fetch('/api/counter', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clients }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      setRows((data.clients || []).map(c => ({ ...c, nextInput: String(c.next) })));
      showToast('Settings saved.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-wrap">Loading settings...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Settings</h1>
        <p>Each client has its own invoice numbering.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="form-section" style={{ marginBottom: 0 }}>
            <div className="form-section-title">Invoice Numbering per Client</div>

            {rows.length === 0 ? (
              <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6 }}>
                No clients yet. A counter appears here after the first invoice for each client.
                You can also type the number directly when <Link to="/create">creating an invoice</Link>.
              </p>
            ) : (
              <div className="items-table-wrap">
                <table className="items-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40%' }}>Client</th>
                      <th style={{ width: '15%' }} className="r">Last used</th>
                      <th style={{ width: '20%' }} className="r">Next number</th>
                      <th style={{ width: '25%' }} className="r">Next code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const n = parsedNext(r);
                      const reused = n !== null && r.lastUsed > 0 && n <= r.lastUsed;
                      return (
                        <tr key={r.code}>
                          <td>
                            <div className="item-name" style={{ fontWeight: 600 }}>{r.names.join(', ') || r.code}</div>
                            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>code: {r.code}</div>
                          </td>
                          <td className="r" style={{ color: '#888' }}>{r.lastUsed > 0 ? pad4(r.lastUsed) : '—'}</td>
                          <td className="r">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={r.nextInput}
                              onChange={e => updateRow(r.code, e.target.value)}
                              style={{ textAlign: 'right', borderColor: reused ? '#e8821e' : undefined }}
                            />
                          </td>
                          <td className="r">
                            <span className="item-amount">{n !== null ? `${r.code}-${pad4(n)}` : '—'}</span>
                            {reused && (
                              <div style={{ color: '#a04a00', fontSize: 12, marginTop: 4 }}>
                                Already used. Suggested: {r.lastUsed + 1}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p style={{ color: '#888', fontSize: 13, marginTop: 16, lineHeight: 1.6 }}>
              Invoice codes follow the format <strong>{'{client}-0001'}</strong>: the first word of the
              client name in lowercase, then a 4-digit number that counts up separately for each client.
              New clients start at 0001. Change a number here only if you need a client to resume from a
              specific number.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Back</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !allValid || rows.length === 0}>
            {saving ? <><span className="spinner" /> Saving...</> : 'Save Settings'}
          </button>
        </div>
      </form>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
