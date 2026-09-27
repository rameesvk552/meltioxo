import React, { useState } from 'react';
import { ArrowRightOutlined, BarChartOutlined, BookOutlined, CheckCircleOutlined, FallOutlined, FileTextOutlined, FundOutlined, RiseOutlined, SafetyCertificateOutlined, WalletOutlined } from '@ant-design/icons';
import { Button, Empty, Segmented, Spin, Tag } from 'antd';
import { money } from '../reports/AccountingUI';
import './AccountingOverview.css';

const MODULES = [
  { title: 'Chart of accounts', detail: 'Browse balances and manage your ledger hierarchy', icon: <BookOutlined />, target: 'Ledgers' },
  { title: 'Journal entries', detail: 'Review postings from every business workflow', icon: <FileTextOutlined />, route: '/app/journal-entries', permission: 'finance.journal_entries' },
  { title: 'Receipts & payments', detail: 'Trace collections and supplier payments', icon: <WalletOutlined />, target: 'Money', permission: 'finance.payments' },
  { title: 'Financial reports', detail: 'Balance sheet, trial balance, P&L and MIS', icon: <BarChartOutlined />, target: 'Reports' },
  { title: 'Payables & receivables', detail: 'See outstanding invoices and aging', icon: <SafetyCertificateOutlined />, target: 'Invoices' },
  { title: 'Accounting health', detail: 'Check journal totals and ledger balances', icon: <CheckCircleOutlined />, target: 'Reconcile' }
];

function SummaryCard({ icon, label, amount, detail, className = '' }) {
  return <div className={`ao-summary-card ${className}`}><span className="ao-summary-icon">{icon}</span><strong>{amount}</strong><span className="ao-summary-label">{label}</span>{detail && <small>{detail}</small>}</div>;
}

export default function AccountingOverview({ accounts, sheet, profit, health, journals, payments, receivables, payables, cash, allowed, canOpenRoute, navigate, openTab }) {
  const [composition, setComposition] = useState('Expenses');
  const [periodStart] = useState(() => `${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1}-04-01`);
  const profitSummary = profit.data.summary || {};
  const sheetData = sheet.data || {};
  const profitAvailable = allowed('reports.profit_loss') && !profit.error && !profit.loading;
  const sheetAvailable = allowed('reports.balance_sheet') && !sheet.error && !sheet.loading;
  const accountRows = composition === 'Expenses'
    ? [...(profit.data.accounts?.cogs || []), ...(profit.data.accounts?.operating_expenses || [])]
    : (profit.data.accounts?.revenue || []);
  const compositionRows = accountRows.filter(row => Math.abs(Number(row.amount || 0)) > 0).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 6);
  const compositionTotal = compositionRows.reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
  const sortedJournals = [...journals.data].sort((a,b) => String(b.entry_date).localeCompare(String(a.entry_date)) || String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5);
  const sortedPayments = [...payments.data].sort((a,b) => String(b.payment_date).localeCompare(String(a.payment_date)) || String(b.created_at).localeCompare(String(a.created_at))).slice(0, 4);
  const jump = item => item.route ? navigate(item.route) : openTab(item.target);
  return <>
    <div className="ao-top-grid">
      <div className="ao-financial-grid">
        <SummaryCard className="ao-profit-card" icon={<FundOutlined />} label="Net profit · current financial year" amount={profitAvailable ? money(profitSummary.net_profit) : profit.loading ? 'Loading…' : '—'} detail={profitAvailable ? `${profitSummary.net_margin_pct ?? 0}% net margin · since ${periodStart}` : 'Posted journals only'} />
        <SummaryCard className="ao-revenue-card" icon={<RiseOutlined />} label="Revenue" amount={profitAvailable ? money(profitSummary.revenue) : profit.loading ? 'Loading…' : '—'} detail="Current financial year" />
        <SummaryCard className="ao-expense-card" icon={<FallOutlined />} label="Total costs" amount={profitAvailable ? money(Number(profitSummary.cogs || 0) + Number(profitSummary.operating_expenses || 0)) : profit.loading ? 'Loading…' : '—'} detail="Direct costs + operating expenses" />
        <SummaryCard className="ao-asset-card" icon={<WalletOutlined />} label="Total assets" amount={sheetAvailable ? money(sheetData.assets) : sheet.loading ? 'Loading…' : '—'} detail="Closing posted balance" />
        <SummaryCard className="ao-liability-card" icon={<FileTextOutlined />} label="Total liabilities" amount={sheetAvailable ? money(sheetData.liabilities) : sheet.loading ? 'Loading…' : '—'} detail="Closing posted balance" />
      </div>
      <section className="ao-composition-card" aria-label="Income and cost composition">
        <div className="ao-card-header"><div><span className="ao-eyebrow">COMPOSITION</span><h2>Where the money comes from and goes</h2><p>Current financial year · grouped by account</p></div><Segmented value={composition} options={['Expenses','Revenue']} onChange={setComposition} /></div>
        {profit.loading ? <div className="ao-composition-empty"><Spin /></div> : !profitAvailable ? <div className="ao-composition-empty">Financial details are unavailable for this account.</div> : compositionRows.length ? <div className="ao-composition-list">{compositionRows.map(row => <div className="ao-composition-row" key={row.id}><div className="ao-composition-line"><span title={row.name}>{row.name}</span><strong>{money(row.amount)}</strong></div><div className="ao-composition-track"><span style={{ width: `${Math.max(2, Math.abs(Number(row.amount || 0)) / compositionTotal * 100)}%` }} /></div></div>)}</div> : <div className="ao-composition-empty"><FundOutlined /><strong>No {composition.toLowerCase()} posted yet</strong><span>Account activity will appear here as journals are posted.</span></div>}
      </section>
    </div>
    <div className="ao-secondary-grid">
      <div className="ao-kpi"><span>Cash & bank</span><strong>{money(cash)}</strong><small>Including inactive historical ledgers</small></div>
      <div className="ao-kpi"><span>Customer receivables</span><strong>{money(receivables)}</strong><small>Posted customer ledger balance</small></div>
      <div className="ao-kpi"><span>Supplier payables</span><strong>{money(payables)}</strong><small>Posted supplier ledger balance</small></div>
      <div className="ao-kpi"><span>Accounts / journals</span><strong>{accounts.length} / {health.data.posted_journals ?? '—'}</strong><small>Configured accounts / posted entries</small></div>
    </div>
    {!health.error && <button className={`ao-health-strip ${health.data.balanced ? '' : 'needs-review'}`} onClick={() => openTab('Reconcile')}><CheckCircleOutlined /><span><strong>{health.data.balanced ? 'Journals balance' : 'Accounting review required'}</strong>{health.data.stored_balance_mismatches?.length ? ` · ${health.data.stored_balance_mismatches.length} cached balances differ from posted entries` : ' · Statements use posted entries'}</span><span>Review <ArrowRightOutlined /></span></button>}
    <div className="ao-bottom-grid">
      <section className="ao-modules"><div className="ao-section-heading"><span className="ao-eyebrow">CORE ACCOUNTING</span><p>Everything you need, connected to sales, purchases, production and inventory.</p></div><div className="ao-module-grid">{MODULES.filter(item => !item.permission || allowed(item.permission)).map(item => <button className="ao-module" key={item.title} onClick={() => jump(item)}><span className="ao-module-icon">{item.icon}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRightOutlined className="ao-module-arrow" /></button>)}</div><div className="ao-connected"><span className="ao-eyebrow">CONNECTED WORKFLOWS</span><div>{[['Purchases','/app/purchases'],['Production','/app/production'],['Sales','/app/retail-sales'],['Inventory','/app/reports/stock']].filter(([,route])=>canOpenRoute(route)).map(([name,route])=><button key={route} onClick={()=>navigate(route)}>{name}<ArrowRightOutlined /></button>)}</div></div></section>
      <aside className="ao-activity"><div className="ao-section-heading"><span className="ao-eyebrow">RECENT ACTIVITY</span><p>Trace a transaction back to its journal.</p></div><div className="ao-activity-card"><div className="ao-card-header"><h2>Latest journal entries</h2>{allowed('finance.journal_entries') && <Button type="link" onClick={() => navigate('/app/journal-entries')}>View all</Button>}</div>{!allowed('finance.journal_entries') ? <div className="ao-activity-empty">Journal access is not enabled for your account.</div> : journals.loading ? <div className="ao-activity-empty"><Spin /></div> : sortedJournals.length ? sortedJournals.map(row => <button className="ao-journal" key={row.id} onClick={() => navigate('/app/journal-entries?entry='+row.id)}><span className="ao-journal-icon"><BookOutlined /></span><span><strong>{row.entry_number}</strong><small>{row.entry_date} · {row.narration || row.reference_type?.replaceAll('_',' ')}</small></span><Tag color={row.status === 'posted' ? 'success' : 'warning'}>{row.status}</Tag></button>) : <div className="ao-activity-empty"><Empty description="No journal entries yet" /></div>}</div>
        {allowed('finance.payments') && <div className="ao-activity-card"><div className="ao-card-header"><h2>Receipts & payments</h2><Button type="link" onClick={() => openTab('Money')}>View register</Button></div>{payments.loading ? <div className="ao-activity-empty"><Spin /></div> : sortedPayments.length ? sortedPayments.map(row => <div className="ao-payment" key={row.id}><span><strong>{row.payment_number}</strong><small>{row.party_name || 'Walk-in customer'} · {row.payment_date}</small></span><strong className={row.payment_type === 'incoming' ? 'incoming' : ''}>{row.payment_type === 'incoming' ? '+' : '−'}{money(row.amount)}</strong></div>) : <div className="ao-activity-empty">No receipts or payments yet.</div>}</div>}
      </aside>
    </div>
  </>;
}
