import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtAmount(symbol, amount) {
  return `${symbol}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    fetch('/api/invoices')
      .then(r => r.json())
      .then(data => { setInvoices(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const clients = useMemo(() => {
    const names = [...new Set(invoices.map(inv => inv.client?.name).filter(Boolean))];
    return names.sort();
  }, [invoices]);

  const filtered = useMemo(() => {
    let result = [...invoices];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(inv =>
        inv.id.toLowerCase().includes(q) ||
        (inv.client?.name || '').toLowerCase().includes(q)
      );
    }

    if (filterClient) {
      result = result.filter(inv => inv.client?.name === filterClient);
    }

    if (filterFrom) {
      result = result.filter(inv => inv.date >= filterFrom);
    }

    if (filterTo) {
      result = result.filter(inv => inv.date <= filterTo);
    }

    result.sort((a, b) => {
      if (sortBy === 'newest') return b.number - a.number;
      if (sortBy === 'oldest') return a.number - b.number;
      if (sortBy === 'amount-high') return b.total - a.total;
      if (sortBy === 'amount-low') return a.total - b.total;
      return 0;
    });

    return result;
  }, [invoices, search, filterClient, filterFrom, filterTo, sortBy]);

  const hasFilters = search || filterClient || filterFrom || filterTo;

  function clearFilters() {
    setSearch('');
    setFilterClient('');
    setFilterFrom('');
    setFilterTo('');
    setSortBy('newest');
  }

  if (loading) return <div className="loading-wrap">Loading invoices...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Invoices</h1>
          <p>
            {filtered.length !== invoices.length
              ? `${filtered.length} of ${invoices.length} invoices`
              : `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <Link to="/create" className="btn btn-primary">+ New Invoice</Link>
      </div>

      {/* Search & Filters */}
      {invoices.length > 0 && (
        <div className="filters-bar">
          <div className="filters-top">
            <input
              className="filter-search"
              type="text"
              placeholder="Search by invoice ID or client name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {hasFilters && (
              <span className="filters-active-badge">
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
            {hasFilters && (
              <button className="btn btn-secondary" onClick={clearFilters} style={{ fontSize: 13, padding: '8px 14px', whiteSpace: 'nowrap' }}>
                Clear all
              </button>
            )}
          </div>
          <div className="filters-row">
            <div className="filter-group grow">
              <span className="filter-label">Client</span>
              <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="filter-select">
                <option value="">All clients</option>
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="filter-divider" />
            <div className="filter-group">
              <span className="filter-label">From</span>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="filter-date" />
            </div>
            <div className="filter-group">
              <span className="filter-label">To</span>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="filter-date" />
            </div>
            <div className="filter-divider" />
            <div className="filter-group">
              <span className="filter-label">Sort by</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="filter-select">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="amount-high">Amount ↓</option>
                <option value="amount-low">Amount ↑</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>No invoices yet</h3>
            <p>Create your first invoice to get started.</p>
            <Link to="/create" className="btn btn-primary" style={{ marginTop: 20 }}>Create Invoice</Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h3>No results</h3>
            <p>No invoices match your search.</p>
            <button className="btn btn-secondary" onClick={clearFilters} style={{ marginTop: 20 }}>Clear filters</button>
          </div>
        </div>
      ) : (
        <div className="invoice-grid">
          {filtered.map(inv => (
            <InvoiceCard key={inv.id} invoice={inv} />
          ))}
        </div>
      )}
    </div>
  );
}

function InvoiceCard({ invoice }) {
  const clientName = invoice.client?.name || 'Unknown Client';
  const [opening, setOpening] = useState(false);

  function openPDF(e) {
    e.preventDefault();
    setOpening(true);
    window.open(invoice.pdfPath, '_blank');
    setTimeout(() => setOpening(false), 1000);
  }

  return (
    <div className="invoice-card">
      <div className="invoice-card-left">
        <span className="inv-badge">{invoice.id}</span>
        <div className="inv-meta">
          <span className="inv-client">{clientName}</span>
          <span className="inv-date">{fmtDate(invoice.date)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <span className="inv-amount">{fmtAmount(invoice.currencySymbol, invoice.total)}</span>
        <div className="inv-actions">
          <button className="btn btn-secondary" onClick={openPDF} disabled={opening} style={{ fontSize: 13 }}>
            {opening ? <span className="spinner" style={{ borderTopColor: '#333' }} /> : 'View PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
