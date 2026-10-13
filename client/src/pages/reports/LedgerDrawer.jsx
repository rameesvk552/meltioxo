import React, { useContext } from 'react';
import { Alert, Button, Drawer, Empty, Space, Table } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { hasViewPermission } from '../../config/permissions';
import useApiData from '../../hooks/useApiData';
import { Metric, money } from './AccountingUI';
import { downloadReport, reportData } from './reportDownloads';

export default function LedgerDrawer({ account, from, to, onClose }) {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const query = useApiData(account ? `/reports/ledger/${account.id}?from=${from}&to=${to}` : null, { enabled: !!account, initialData: {} });
  const report = query.data;
  const exportLedger = () => reportData(`ledger-${account.code}-${from}-${to}`, [
    ['Account ledger', `${account.code} ${account.name}`, `${from} to ${to}`],
    ['Date', 'Reference', 'Narration', 'Debit', 'Credit', 'Balance'],
    ['Opening balance', '', '', '', '', Number(report.opening_balance || 0)],
    ...(report.rows || []).map(row => [row.date, row.reference, row.description, row.debit, row.credit, row.balance]),
    ['Closing balance', '', '', '', '', Number(report.closing_balance || 0)]
  ]);
  const columns = [
    { title: 'Date', dataIndex: 'date', width: 105 }, { title: 'Reference', dataIndex: 'reference', width: 160, render: (reference, row) => row.journal_id && hasViewPermission(user, 'finance.journal_entries') ? <button className="ar-ledger-link" onClick={() => navigate('/app/journal-entries?entry='+row.journal_id)}>{reference}</button> : reference },
    { title: 'Narration', dataIndex: 'description' },
    { title: 'Debit', dataIndex: 'debit', align: 'right', render: money },
    { title: 'Credit', dataIndex: 'credit', align: 'right', render: money },
    { title: 'Balance', dataIndex: 'balance', align: 'right', render: money }
  ];
  return <Drawer title={account ? `${account.code} · ${account.name}` : 'Account ledger'} open={!!account} onClose={onClose} size="large" extra={<Space><Button icon={<DownloadOutlined />} disabled={query.loading || !!query.error} onClick={() => downloadReport(exportLedger(), 'xlsx')}>Excel</Button><Button icon={<DownloadOutlined />} disabled={query.loading || !!query.error} onClick={() => downloadReport(exportLedger(), 'pdf')}>PDF</Button></Space>}>
    <p style={{ color: '#827768', marginBottom: 18 }}>{from} to {to} · Posted entries · {['asset', 'expense'].includes(report.account?.type) ? 'Debit' : 'Credit'} normal balance</p>
    {query.error ? <Alert type="error" showIcon message="Could not load this ledger" description={query.error.response?.data?.message || query.error.message} action={<Button onClick={query.reload}>Retry</Button>} /> : <>
      {!query.loading && <div className="ar-ledger-summary"><Metric label="Opening balance" value={report.opening_balance} /><Metric label="Closing balance" value={report.closing_balance} /></div>}
      <Table rowKey="id" loading={query.loading} dataSource={report.rows || []} columns={columns} scroll={{ x: 850 }} pagination={{ pageSize: 25, showSizeChanger: true }} locale={{ emptyText: <Empty description="No posted movements in this period" /> }} />
    </>}
  </Drawer>;
}
