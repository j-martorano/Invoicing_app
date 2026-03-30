import React from 'react';
import { Routes, Route } from 'react-router-dom';
import InvoiceList from './pages/InvoiceList';
import CreateInvoice from './pages/CreateInvoice';

export default function App() {
  return (
    <main className="main-content">
      <Routes>
        <Route path="/" element={<InvoiceList />} />
        <Route path="/create" element={<CreateInvoice />} />
      </Routes>
    </main>
  );
}
