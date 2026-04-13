import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const CURRENCIES = [
  { label: '$ (USD)', symbol: '$' },
  { label: 'US$ (USD)', symbol: 'US$' },
  { label: '€ (EUR)', symbol: '€' },
  { label: '£ (GBP)', symbol: '£' },
  { label: 'ARS$ (ARS)', symbol: 'ARS$' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function newItem() {
  return { name: '', description: '', quantity: 1, rate: 0 };
}

function fmt(symbol, amount) {
  return `${symbol}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CreateInvoice() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [date, setDate] = useState(todayISO());
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [items, setItems] = useState([newItem()]);
  const [upfrontEnabled, setUpfrontEnabled] = useState(false);
  const [upfrontPct, setUpfrontPct] = useState(50);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountType, setDiscountType] = useState('percentage'); // 'percentage' | 'fixed'
  const [discountValue, setDiscountValue] = useState(10);
  const [notes, setNotes] = useState('');

  // Client fields
  const [clientName, setClientName] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientCountry, setClientCountry] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const clientRef = useRef(null);

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients).catch(() => {});
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function handle(e) {
      if (clientRef.current && !clientRef.current.contains(e.target)) setShowSuggestions(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filteredClients = clientName.length > 0
    ? clients.filter(c => c.name.toLowerCase().includes(clientName.toLowerCase()))
    : [];

  function selectClient(c) {
    setClientName(c.name);
    setClientAddress(c.address || '');
    setClientCountry(c.country || '');
    setShowSuggestions(false);
  }

  // Items
  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function addItem() { setItems(prev => [...prev, newItem()]); }

  function removeItem(idx) {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  // Totals
  const subtotal = items.reduce((s, it) => s + Number(it.quantity) * Number(it.rate), 0);
  const discountAmount = discountEnabled
    ? (discountType === 'percentage' ? subtotal * (Number(discountValue) / 100) : Number(discountValue))
    : 0;
  const afterDiscount = subtotal - discountAmount;
  const upfrontAmount = upfrontEnabled ? afterDiscount * (upfrontPct / 100) : 0;
  const total = afterDiscount - upfrontAmount;

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!clientName.trim()) return showToast('Client name is required.', 'error');
    if (items.some(it => !it.name.trim())) return showToast('All items need a name.', 'error');

    setSubmitting(true);

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          currencySymbol,
          client: { name: clientName.trim(), address: clientAddress.trim(), country: clientCountry.trim() },
          items: items.map(it => ({
            name: it.name.trim(),
            description: it.description.trim(),
            quantity: Number(it.quantity),
            rate: Number(it.rate),
          })),
          upfrontPayment: { enabled: upfrontEnabled, percentage: Number(upfrontPct) },
          discount: { enabled: discountEnabled, type: discountType, value: Number(discountValue) },
          notes: notes.trim(),
        }),
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Server error');
      const invoice = await res.json();
      showToast(`${invoice.id} created successfully!`);
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>New Invoice</h1>
        <p>Fill in the details below to generate a PDF invoice.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">

          {/* ── Invoice Details ── */}
          <div className="form-section">
            <div className="form-section-title">Invoice Details</div>
            <div className="form-grid">
              <label>
                Date
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </label>
              <label>
                Currency
                <select value={currencySymbol} onChange={e => setCurrencySymbol(e.target.value)}>
                  {CURRENCIES.map(c => (
                    <option key={c.symbol} value={c.symbol}>{c.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* ── Client ── */}
          <div className="form-section">
            <div className="form-section-title">Bill To</div>
            <div className="form-grid">
              <label className="form-full">
                Client Name
                <div className="autocomplete-wrap" ref={clientRef}>
                  <input
                    type="text"
                    placeholder="e.g. Nameless Horse LLC"
                    value={clientName}
                    onChange={e => { setClientName(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    autoComplete="off"
                    required
                  />
                  {showSuggestions && filteredClients.length > 0 && (
                    <div className="autocomplete-list">
                      {filteredClients.map(c => (
                        <div key={c.id} className="autocomplete-item" onMouseDown={() => selectClient(c)}>
                          <strong>{c.name}</strong>
                          {c.country && <span style={{ color: '#888', marginLeft: 8 }}>{c.country}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </label>
              <label className="form-full">
                Address
                <textarea
                  placeholder={"7127 S 76th St, Unit #8032\nFranklin, Wisconsin WI 53132"}
                  value={clientAddress}
                  onChange={e => setClientAddress(e.target.value)}
                  rows={3}
                />
              </label>
              <label className="form-full">
                Country
                <input
                  type="text"
                  placeholder="United States"
                  value={clientCountry}
                  onChange={e => setClientCountry(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* ── Line Items ── */}
          <div className="form-section">
            <div className="items-header">
              <div className="form-section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Line Items</div>
            </div>
            <div className="items-table-wrap">
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Item</th>
                    <th style={{ width: '12%' }} className="r">Qty</th>
                    <th style={{ width: '18%' }} className="r">Rate ({currencySymbol})</th>
                    <th style={{ width: '18%' }} className="r">Amount</th>
                    <th style={{ width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          type="text"
                          placeholder="Service or item name"
                          value={item.name}
                          onChange={e => updateItem(idx, 'name', e.target.value)}
                        />
                        <textarea
                          className="item-desc-input"
                          placeholder="Description (optional)"
                          value={item.description}
                          onChange={e => updateItem(idx, 'description', e.target.value)}
                          rows={2}
                        />
                      </td>
                      <td className="r">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                          style={{ textAlign: 'right' }}
                        />
                      </td>
                      <td className="r">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={e => updateItem(idx, 'rate', e.target.value)}
                          style={{ textAlign: 'right' }}
                        />
                      </td>
                      <td className="r">
                        <span className="item-amount">{fmt(currencySymbol, item.quantity * item.rate)}</span>
                      </td>
                      <td>
                        <button type="button" className="btn-remove" onClick={() => removeItem(idx)} title="Remove">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button type="button" className="btn btn-ghost" onClick={addItem} style={{ marginTop: 12, fontSize: 13 }}>
              + Add Item
            </button>

            {/* Discount toggle */}
            <div className="upfront-row">
              <label>
                <input
                  type="checkbox"
                  checked={discountEnabled}
                  onChange={e => setDiscountEnabled(e.target.checked)}
                />
                Discount
              </label>
              {discountEnabled && (
                <>
                  <select
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value)}
                    style={{ width: 110 }}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed ({currencySymbol})</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                    style={{ width: 80 }}
                  />
                  <span style={{ color: '#888', fontSize: 13 }}>
                    -{fmt(currencySymbol, discountAmount)}
                  </span>
                </>
              )}
            </div>

            {/* Upfront payment toggle */}
            <div className="upfront-row">
              <label>
                <input
                  type="checkbox"
                  checked={upfrontEnabled}
                  onChange={e => setUpfrontEnabled(e.target.checked)}
                />
                Upfront payment (%)
              </label>
              {upfrontEnabled && (
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={upfrontPct}
                  onChange={e => setUpfrontPct(e.target.value)}
                  style={{ width: 72 }}
                />
              )}
              {upfrontEnabled && (
                <span style={{ color: '#888', fontSize: 13 }}>
                  Client pays {fmt(currencySymbol, upfrontAmount)} now, {fmt(currencySymbol, afterDiscount - upfrontAmount)} on completion.
                </span>
              )}
            </div>

            {/* Totals */}
            <div className="totals-section">
              {(discountEnabled || upfrontEnabled) && (
                <div className="total-row">
                  <span className="t-label">Subtotal</span>
                  <span className="t-amount">{fmt(currencySymbol, subtotal)}</span>
                </div>
              )}
              {discountEnabled && (
                <div className="total-row">
                  <span className="t-label">
                    Discount {discountType === 'percentage' ? `(${discountValue}%)` : ''}
                  </span>
                  <span className="t-amount">–{fmt(currencySymbol, discountAmount)}</span>
                </div>
              )}
              {upfrontEnabled && (
                <div className="total-row">
                  <span className="t-label">Upfront payment ({upfrontPct}%)</span>
                  <span className="t-amount">–{fmt(currencySymbol, upfrontAmount)}</span>
                </div>
              )}
              <div className="total-row grand">
                <span className="t-label">Total (Balance Due)</span>
                <span className="t-amount">{fmt(currencySymbol, total)}</span>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="form-section" style={{ marginBottom: 0 }}>
            <div className="form-section-title">Notes</div>
            <textarea
              placeholder="e.g. 50% remaining upon completion."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <><span className="spinner" /> Generating PDF...</> : 'Create Invoice'}
          </button>
        </div>
      </form>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
