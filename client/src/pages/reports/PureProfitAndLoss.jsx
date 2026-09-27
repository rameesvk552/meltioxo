import React, { useContext, useState } from 'react';
import useApiData from '../../hooks/useApiData';
import { AuthContext } from '../../context/AuthContext';
import { hasViewPermission } from '../../config/permissions';
import { exportCsv, Metric, ReportShell, StatementLine, useReportRange } from './AccountingUI';
import LedgerDrawer from './LedgerDrawer';

export default function PureProfitAndLoss({ embedded = false }) {
  const period = useReportRange();
  const [ledger, setLedger] = useState(null);
  const { user } = useContext(AuthContext);
  const query = useApiData('/reports/profit-loss-statement?from='+period.from+'&to='+period.to, { initialData: {} });
  const summary = query.data.summary || {};
  const accounts = query.data.accounts || {};
  const section = (title, key, total) => <section><h3>{title}</h3>{accounts[key]?.length ? accounts[key].map(row =>
    <StatementLine key={row.id} code={row.code} label={row.name} value={row.amount} onClick={hasViewPermission(user,'finance.accounts') ? () => setLedger(row) : undefined} />
  ) : <div className="ar-empty">No postings in this period</div>}<StatementLine label={'Total '+title.toLowerCase()} value={total} total /></section>;
  return <><ReportShell title="Profit & loss" subtitle="Income, direct costs, and operating expenses from the same accounting ledger." embedded={embedded} query={query} controls={period.controls} onExport={() => exportCsv('profit-loss-'+period.from+'-'+period.to+'.csv', [
    ['Profit & loss',period.from,period.to], ['Section','Code','Account','Amount'],
    ...Object.entries(accounts).flatMap(([key,rows]) => rows.map(row => [key,row.code,row.name,row.amount])),
    ['Total income','','',summary.revenue],['Total direct costs','','',summary.cogs],['Gross profit','','',summary.gross_profit],
    ['Operating expenses','','',summary.operating_expenses],['Net profit / loss','','',summary.net_profit]
  ])}>
    <div className="ar-metrics"><Metric label="Net income" value={summary.revenue} detail="After discounts and returns" /><Metric label="Gross profit" value={summary.gross_profit} detail={(summary.gross_margin_pct || 0)+'% gross margin'} /><Metric label="Operating expenses" value={summary.operating_expenses} detail="Excludes direct costs" /><Metric label={summary.net_profit < 0 ? 'Net loss' : 'Net profit'} value={summary.net_profit} tone={summary.net_profit < 0 ? 'negative' : 'positive'} detail={(summary.net_margin_pct || 0)+'% net margin'} /></div>
    <article className="ar-statement-card"><div className="ar-statement-title"><div><h2>Profit & loss account</h2><p>{period.range[0].format('DD MMM YYYY')} to {period.range[1].format('DD MMM YYYY')}</p></div><span className="ar-eyebrow">ACCRUAL BASIS</span></div>
      <div className="ar-statement-body">{section('Income','revenue',summary.revenue)}{section('Direct costs','cogs',summary.cogs)}
        <div className={'ar-result'+(summary.gross_profit < 0 ? ' is-loss' : '')}><span>Gross profit</span><StatementLine value={summary.gross_profit} /></div>
        {section('Operating expenses','operating_expenses',summary.operating_expenses)}
        <div className={'ar-result'+(summary.net_profit < 0 ? ' is-loss' : '')}><span>{summary.net_profit < 0 ? 'Net loss' : 'Net profit'}</span><StatementLine value={summary.net_profit} /></div>
      </div><footer className="ar-footnote">Income less direct costs gives gross profit. Operating expenses are deducted once to arrive at net profit. Click an account to see its posted entries.</footer>
    </article>
  </ReportShell><LedgerDrawer account={ledger} from={period.from} to={period.to} onClose={() => setLedger(null)} /></>;
}
