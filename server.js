const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3001;

const DATA_DIR = path.join(__dirname, 'data');
const INVOICES_DIR = path.join(__dirname, 'invoices');
const PUBLIC_DIR = path.join(__dirname, 'public');
const CLIENT_DIST = path.join(__dirname, 'client', 'dist');

[DATA_DIR, INVOICES_DIR, PUBLIC_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const FILES = {
  invoices: path.join(DATA_DIR, 'invoices.json'),
  clients: path.join(DATA_DIR, 'clients.json'),
  counter: path.join(DATA_DIR, 'counter.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
};

function initFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

initFile(FILES.invoices, []);
initFile(FILES.clients, []);
initFile(FILES.counter, { next: 1 });
initFile(FILES.settings, {
  name: 'Joaquín Martorano Perozzi',
  address: 'Belgrano 731',
  city: '1876 Quilmes Oeste',
  state: 'Buenos Aires',
  country: 'Argentina',
  email: 'yoakodesign@gmail.com',
});

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(express.json());
app.use('/invoices', express.static(INVOICES_DIR));
app.use('/public', express.static(PUBLIC_DIR));
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

// ── API ──────────────────────────────────────────────────────────────────────

app.get('/api/invoices', (req, res) => {
  const invoices = readJSON(FILES.invoices);
  const clients = readJSON(FILES.clients);
  const result = invoices
    .map(inv => ({ ...inv, client: clients.find(c => c.id === inv.clientId) || null }))
    .reverse();
  res.json(result);
});

app.get('/api/clients', (req, res) => {
  res.json(readJSON(FILES.clients));
});

app.get('/api/settings', (req, res) => {
  res.json(readJSON(FILES.settings));
});

app.put('/api/settings', (req, res) => {
  writeJSON(FILES.settings, req.body);
  res.json(req.body);
});

app.post('/api/invoices', async (req, res) => {
  try {
    const { client: clientData, items, date, currencySymbol, upfrontPayment, discount, notes } = req.body;

    // Upsert client
    const clients = readJSON(FILES.clients);
    let client = clients.find(c => c.name.toLowerCase() === clientData.name.toLowerCase());
    if (!client) {
      client = { id: uuidv4(), ...clientData, createdAt: new Date().toISOString() };
      clients.push(client);
    } else {
      Object.assign(client, clientData);
    }
    writeJSON(FILES.clients, clients);

    // Invoice number
    const counter = readJSON(FILES.counter);
    const invoiceNumber = counter.next;
    counter.next++;
    writeJSON(FILES.counter, counter);

    const invoiceId = `INV-${String(invoiceNumber).padStart(5, '0')}`;

    // Totals
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    let discountAmount = 0;
    if (discount?.enabled && discount.value > 0) {
      discountAmount = discount.type === 'percentage'
        ? subtotal * (discount.value / 100)
        : discount.value;
    }
    const afterDiscount = subtotal - discountAmount;
    let upfrontAmount = 0;
    if (upfrontPayment?.enabled && upfrontPayment.percentage > 0) {
      upfrontAmount = afterDiscount * (upfrontPayment.percentage / 100);
    }
    const total = afterDiscount - upfrontAmount;

    const settings = readJSON(FILES.settings);

    // Generate PDF
    const pdfFilename = `${invoiceId}.pdf`;
    const pdfPath = path.join(INVOICES_DIR, pdfFilename);

    const html = buildInvoiceHTML({
      id: invoiceId,
      date,
      client,
      items,
      currencySymbol,
      subtotal,
      discount: discount?.enabled && discountAmount > 0 ? { ...discount, amount: discountAmount } : null,
      upfrontPayment: upfrontPayment?.enabled ? { ...upfrontPayment, amount: upfrontAmount } : null,
      total,
      notes,
      settings,
    });

    await renderPDF(html, pdfPath);

    const invoice = {
      id: invoiceId,
      number: invoiceNumber,
      date,
      clientId: client.id,
      currencySymbol,
      items,
      subtotal,
      discount: discount?.enabled && discountAmount > 0 ? { ...discount, amount: discountAmount } : null,
      upfrontPayment: upfrontPayment?.enabled ? { ...upfrontPayment, amount: upfrontAmount } : null,
      total,
      notes,
      pdfPath: `/invoices/${pdfFilename}`,
      createdAt: new Date().toISOString(),
    };

    const invoices = readJSON(FILES.invoices);
    invoices.push(invoice);
    writeJSON(FILES.invoices, invoices);

    res.json({ ...invoice, client });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Fallback for SPA
app.get('*', (req, res) => {
  const index = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.status(404).send('Run `npm run build` first or use the dev server.');
});

// ── PDF ───────────────────────────────────────────────────────────────────────

async function renderPDF(html, outputPath) {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
  });
  await browser.close();
}

function getLogoBase64() {
  const p = path.join(PUBLIC_DIR, 'logo.png');
  if (fs.existsSync(p)) return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  return '';
}

function fmt(symbol, amount) {
  return `${symbol}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildInvoiceHTML({ id, date, client, items, currencySymbol, subtotal, discount, upfrontPayment, total, notes, settings }) {
  const logo = getLogoBase64();

  const itemRows = items.map(item => `
    <tr>
      <td>
        <div class="item-name">${escHtml(item.name)}</div>
        ${item.description ? `<div class="item-desc">${escHtml(item.description).replace(/\n/g, '<br>')}</div>` : ''}
      </td>
      <td class="r">${item.quantity}</td>
      <td class="r">${fmt(currencySymbol, item.rate)}</td>
      <td class="r">${fmt(currencySymbol, item.quantity * item.rate)}</td>
    </tr>`).join('');

  const hasBreakdown = discount || upfrontPayment;
  const totalsRows = hasBreakdown ? `
    <div class="trow"><span class="tlabel">Subtotal:</span><span class="tamount">${fmt(currencySymbol, subtotal)}</span></div>
    ${discount ? `<div class="trow"><span class="tlabel">Discount${discount.type === 'percentage' ? ` (${discount.value}%)` : ''}:</span><span class="tamount">-${fmt(currencySymbol, discount.amount)}</span></div>` : ''}
    ${upfrontPayment ? `<div class="trow"><span class="tlabel">Upfront payment (${upfrontPayment.percentage}%):</span><span class="tamount">-${fmt(currencySymbol, upfrontPayment.amount)}</span></div>` : ''}
    <div class="trow total-final"><span class="tlabel">Total:</span><span class="tamount">${fmt(currencySymbol, total)}</span></div>
  ` : `
    <div class="trow"><span class="tlabel">Total:</span><span class="tamount">${fmt(currencySymbol, total)}</span></div>
  `;

  const notesHTML = notes ? `
    <div class="notes-section">
      <div class="notes-label">Notes:</div>
      <div class="notes-body">${escHtml(notes).replace(/\n/g, '<br>')}</div>
    </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; font-size: 13px; padding: 48px 52px; background: #fff; }

  /* Header: logo left, INVOICE+ID right */
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .logo-box { display: flex; align-items: center; }
  .logo-box img { height: 70px; width: auto; }
  .inv-title { text-align: right; }
  .inv-title h1 { font-size: 52px; font-weight: 300; letter-spacing: 0; color: #2a2a2a; line-height: 1; }
  .inv-title .inv-id { font-size: 15px; color: #777; margin-top: 6px; }

  /* Date inside inv-title */
  .date-row { display: flex; justify-content: flex-end; align-items: center; gap: 48px; margin-top: 10px; }
  .date-row .dlabel { color: #aaa; }

  /* Two-column info block: addresses left, balance right */
  .info-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; margin-bottom: 40px; }
  .info-left { flex: 1; }
  .from-name { font-weight: 700; margin-bottom: 3px; }
  .from-details { color: #555; line-height: 1.75; }
  .bill-label { color: #aaa; font-size: 12px; margin: 22px 0 5px; }
  .client-name { font-weight: 700; }
  .client-address { color: #555; line-height: 1.75; }
  .info-right { flex-shrink: 0; }
  .balance-box { display: flex; justify-content: space-between; align-items: center; background: #efefef; padding: 10px 18px; border-radius: 3px; min-width: 280px; }
  .balance-box .blabel { font-weight: 700; font-size: 13px; }
  .balance-box .bamount { font-weight: 700; font-size: 15px; }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin: 36px 0 0; }
  thead tr { background: #2a2a2a; }
  thead th { color: #fff; padding: 11px 16px; font-weight: 400; font-size: 12px; text-align: left; }
  thead th.r { text-align: right; }
  tbody tr { border-bottom: 1px solid #e8e8e8; }
  tbody td { padding: 15px 16px; vertical-align: top; }
  td.r { text-align: right; white-space: nowrap; }
  .item-name { font-weight: 700; }
  .item-desc { color: #aaa; margin-top: 4px; font-size: 12px; line-height: 1.5; }

  /* Totals */
  .totals { display: flex; flex-direction: column; align-items: flex-end; gap: 9px; margin: 28px 0 48px; }
  .trow { display: flex; gap: 52px; }
  .tlabel { color: #aaa; }
  .tamount { min-width: 100px; text-align: right; }

  /* Notes */
  .notes-section { border-top: 1px solid #e8e8e8; padding-top: 18px; }
  .notes-label { color: #aaa; font-size: 12px; margin-bottom: 7px; }
  .notes-body { color: #555; line-height: 1.7; }

  /* Page number */
  .page-num { position: fixed; bottom: 24px; left: 52px; color: #bbb; font-size: 11px; letter-spacing: 0.5px; }
</style>
</head>
<body>

  <div class="header">
    <div class="logo-box">
      ${logo ? `<img src="${logo}" alt="Tangerine Studios">` : '<span style="color:#e8821e;font-size:11px;padding:10px;text-align:center">Tangerine<br>Studios</span>'}
    </div>
    <div class="inv-title">
      <h1>INVOICE</h1>
      <div class="inv-id">${id}</div>
      <div class="date-row">
        <span class="dlabel">Date:</span>
        <span>${fmtDate(date)}</span>
      </div>
    </div>
  </div>

  <div class="info-row">
    <div class="info-left">
      <div class="from-name">${escHtml(settings.name)}</div>
      <div class="from-details">
        ${[settings.address, settings.city, settings.state, settings.country].filter(Boolean).map(escHtml).join('<br>')}
        ${settings.email ? `<br>${escHtml(settings.email)}` : ''}
      </div>
      <div class="bill-label">Bill To:</div>
      <div class="client-name">${escHtml(client.name)}</div>
      <div class="client-address">${escHtml(client.address || '').replace(/\n/g, '<br>')}${client.country ? `<br>${escHtml(client.country)}` : ''}</div>
    </div>
    <div class="info-right">
      <div class="balance-box">
        <span class="blabel">Balance Due:</span>
        <span class="bamount">${fmt(currencySymbol, total)}</span>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:52%">Item</th>
        <th class="r">Quantity</th>
        <th class="r">Rate</th>
        <th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">${totalsRows}</div>

  ${notesHTML}

  <div class="page-num">PAGE 1 OF 1</div>

</body>
</html>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

app.listen(PORT, () => console.log(`Tangerine Invoicing running at http://localhost:${PORT}`));
