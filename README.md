# Tangerine Studios — Invoicing App

## Requirements

- [Node.js](https://nodejs.org/) v18 or higher

## Installation

```bash
npm install
npm install --prefix client
npm run build
```

## Start

```bash
npm start
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

## Configuration

### Invoice numbering

Invoice codes follow the format `{client}-0001`: the first word of the client
name in lowercase (alphanumeric only, max 12 chars), then a 4-digit number that
counts up **separately for each client** (`pedrito-0001`, `pedrito-0002`,
`jose-0001`, ...). New clients start at 0001.

The next number for each client can be changed from the **Settings** page, or
typed directly in the "Invoice number" field when creating an invoice. The
counters live in `data/counter.json`:

```json
{ "byClient": { "pedrito": 3, "jose": 2 } }
```

### Sender information

Edit `data/settings.json` to set your sender information:

```json
{
  "name": "Your Name",
  "address": "Street 123",
  "city": "City",
  "state": "State",
  "country": "Country",
  "email": "you@email.com"
}
```
