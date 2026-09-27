import React, { useContext, useState } from 'react';
import { Alert, DatePicker, Tag } from 'antd';
import dayjs from 'dayjs';
import useApiData from '../../hooks/useApiData';
import { AuthContext } from '../../context/AuthContext';
import { hasViewPermission } from '../../config/permissions';
import { exportCsv, fyRange, Metric, ReportShell, StatementLine } from './AccountingUI';
import LedgerDrawer from './LedgerDrawer';

export default function BalanceSheet({ embedded = false }) {
  const [date, setDate] = useState(dayjs());
  const [ledger, setLedger] = useState(null);
  const { user } = useContext(AuthContext);
  const query = useApiData('/reports/balance-sheet?as_of='+date.format('YYYY-MM-DD'), { initialData: {} });
  const report = query.data;
  const section = (title, type, total) => <section><h3>{title}</h3>{report.sections?.[type]?.length ? report.sections[type].map(account =>
    <StatementLine key={account.id} code={account.code} label={account.name} value={account.balance} onClick={!account.synthetic && hasViewPermission(user, 'finance.accounts') ? () => setLedger(account) : undefined} />
  ) : <div className="ar-empty">No posted balances</div>}<StatementLine label={'Total '+title.toLowerCase()} value={total} total /></section>;
  return <><ReportShell title="Balance sheet" subtitle="Your financial position, with every balance traceable to its ledger." query={query} embedded={embedded} controls={<><span>As of</span><DatePicker aria-label="Balance sheet date" value={date} allowClear={false} onChange={setDate} format="DD MMM YYYY" /></>} onExport={() => exportCsv('balance-sheet-'+date.format('YYYY-MM-DD')+'.csv', [
    ['Balance Sheet', date.format('YYYY-MM-DD')], ['Type', 'Code', 'Account', 'Balance'],
    ...(report.accounts || []).map(row => [row.type, row.code, row.name, row.balance]),
    ['Total assets', '', '', report.assets], ['Total liabilities', '', '', report.liabilities], ['Total equity', '', '', report.equity], ['Difference', '', '', report.difference]
  ])}>
    <div className="ar-metrics"><Metric label="Total assets" value={report.assets} detail="Resources owned by the business" /><Metric label="Total liabilities" value={report.liabilities} detail="Amounts owed by the business" /><Metric label="Total equity" value={report.equity} detail="Includes unclosed earnings" /><Metric label="Balance difference" value={report.difference} detail={report.balanced ? 'Assets = liabilities + equity' : 'Investigate journal postings'} tone={report.balanced ? 'positive' : 'negative'} /></div>
    {!report.balanced && <Alert className="ar-health-banner" type="error" showIcon message="This balance sheet does not balance" />}
    <div className="ar-statement-card"><div className="ar-statement-title"><div><h2>Statement of financial position</h2><p>As at {date.format('DD MMMM YYYY')}</p></div><Tag color={report.balanced ? 'success' : 'error'}>{report.balanced ? 'Balanced' : 'Needs review'}</Tag></div>
      <div className="ar-statement-body ar-split"><div>{section('Assets', 'asset', report.assets)}</div><div>{section('Liabilities', 'liability', report.liabilities)}{section('Equity', 'equity', report.equity)}<StatementLine total label="Total liabilities & equity" value={Number(report.liabilities || 0)+Number(report.equity || 0)} /></div></div>
      <footer className="ar-footnote">Unclosed profit / loss includes cumulative earnings not yet transferred into equity by closing journals. Click an account to inspect its movements.</footer>
    </div>
  </ReportShell><LedgerDrawer account={ledger} from={fyRange(date)[0].format('YYYY-MM-DD')} to={date.format('YYYY-MM-DD')} onClose={() => setLedger(null)} /></>;
}
