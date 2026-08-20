import React from 'react';
import { Card, Typography, DatePicker, Row, Col, Divider } from 'antd';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;

const BalanceSheet = () => {
  const { data: report } = useApiData('/reports/balance-sheet', { initialData: {} });
  const data = {
    assets: {
      current: {
        cash: Number(report.cash ?? report.assets ?? 0),
        bank: Number(report.bank || 0),
        ar: Number(report.accounts_receivable || 0),
        inventory: {
          raw: Number(report.raw_inventory || 0),
          packaging: Number(report.packaging_inventory || 0),
          wip: Number(report.work_in_progress || 0),
          finished: Number(report.finished_inventory || 0)
        }
      },
      fixed: {
        machinery: Number(report.machinery || 0),
        furniture: Number(report.furniture || 0)
      }
    },
    liabilities: {
      current: {
        ap: Number(report.accounts_payable ?? report.liabilities ?? 0),
        taxPayable: Number(report.tax_payable || 0)
      },
      longTerm: {
        loan: Number(report.long_term_debt || 0)
      }
    },
    equity: {
      capital: Number(report.capital ?? report.equity ?? 0),
      retainedEarnings: Number(report.retained_earnings || 0)
    }
  };

  const totalInventory = Object.values(data.assets.current.inventory).reduce((a, b) => a + b, 0);
  const totalCurrentAssets = data.assets.current.cash + data.assets.current.bank + data.assets.current.ar + totalInventory;
  const totalFixedAssets = Object.values(data.assets.fixed).reduce((a, b) => a + b, 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  const totalCurrentLiabilities = Object.values(data.liabilities.current).reduce((a, b) => a + b, 0);
  const totalLongTermLiabilities = Object.values(data.liabilities.longTerm).reduce((a, b) => a + b, 0);
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

  const totalEquity = Object.values(data.equity).reduce((a, b) => a + b, 0);
  const totalLiabilitiesEquity = totalLiabilities + totalEquity;

  const ItemRow = ({ label, value, indent = 0, bold = false, color = '#fff' }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', paddingLeft: indent * 24 }}>
      <Text style={{ color: bold ? color : '#8b949e', fontWeight: bold ? 'bold' : 'normal' }}>{label}</Text>
      <Text style={{ color: bold ? color : '#fff', fontWeight: bold ? 'bold' : 'normal' }}>₹{value.toLocaleString('en-IN')}</Text>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Balance Sheet</Title>
        <DatePicker  placeholder="As of Date" />
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={12}>
          <Card style={{ height: '100%' }}>
            <Title level={3} style={{ color: '#1677ff', borderBottom: '2px solid #30363d', paddingBottom: 8 }}>Assets</Title>
            
            <Title level={5} style={{ color: 'var(--color-gold)', marginTop: 16 }}>Current Assets</Title>
            <ItemRow label="Cash on Hand" value={data.assets.current.cash} indent={1} />
            <ItemRow label="Bank Balance" value={data.assets.current.bank} indent={1} />
            <ItemRow label="Accounts Receivable" value={data.assets.current.ar} indent={1} />
            <ItemRow label="Inventory" value={totalInventory} indent={1} bold />
            <ItemRow label="Raw Materials" value={data.assets.current.inventory.raw} indent={2} />
            <ItemRow label="Packaging Materials" value={data.assets.current.inventory.packaging} indent={2} />
            <ItemRow label="Work in Progress" value={data.assets.current.inventory.wip} indent={2} />
            <ItemRow label="Finished Goods" value={data.assets.current.inventory.finished} indent={2} />
            <Divider style={{ margin: '8px 0', borderColor: '#30363d' }} />
            <ItemRow label="Total Current Assets" value={totalCurrentAssets} bold />

            <Title level={5} style={{ color: 'var(--color-gold)', marginTop: 16 }}>Fixed Assets</Title>
            <ItemRow label="Machinery & Equipment" value={data.assets.fixed.machinery} indent={1} />
            <ItemRow label="Furniture & Fixtures" value={data.assets.fixed.furniture} indent={1} />
            <Divider style={{ margin: '8px 0', borderColor: '#30363d' }} />
            <ItemRow label="Total Fixed Assets" value={totalFixedAssets} bold />

            <Divider style={{ margin: '24px 0', borderColor: '#1677ff', borderWidth: 2 }} />
            <ItemRow label="TOTAL ASSETS" value={totalAssets} bold color="#1677ff" />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card style={{ height: '100%' }}>
            <Title level={3} style={{ color: '#ff4d4f', borderBottom: '2px solid #30363d', paddingBottom: 8 }}>Liabilities</Title>
            
            <Title level={5} style={{ color: 'var(--color-gold)', marginTop: 16 }}>Current Liabilities</Title>
            <ItemRow label="Accounts Payable" value={data.liabilities.current.ap} indent={1} />
            <ItemRow label="Tax Payable" value={data.liabilities.current.taxPayable} indent={1} />
            <Divider style={{ margin: '8px 0', borderColor: '#30363d' }} />
            <ItemRow label="Total Current Liabilities" value={totalCurrentLiabilities} bold />

            <Title level={5} style={{ color: 'var(--color-gold)', marginTop: 16 }}>Long-Term Liabilities</Title>
            <ItemRow label="Bank Loan" value={data.liabilities.longTerm.loan} indent={1} />
            <Divider style={{ margin: '8px 0', borderColor: '#30363d' }} />
            <ItemRow label="Total Long-Term Liabilities" value={totalLongTermLiabilities} bold />

            <Divider style={{ margin: '24px 0', borderColor: '#ff4d4f', borderWidth: 2 }} />
            <ItemRow label="TOTAL LIABILITIES" value={totalLiabilities} bold color="#ff4d4f" />

            <Title level={3} style={{ color: '#722ed1', borderBottom: '2px solid #30363d', paddingBottom: 8, marginTop: 40 }}>Equity</Title>
            <ItemRow label="Owner's Capital" value={data.equity.capital} indent={1} />
            <ItemRow label="Retained Earnings" value={data.equity.retainedEarnings} indent={1} />
            
            <Divider style={{ margin: '24px 0', borderColor: '#722ed1', borderWidth: 2 }} />
            <ItemRow label="TOTAL EQUITY" value={totalEquity} bold color="#722ed1" />

            <Divider style={{ margin: '40px 0 24px', borderColor: '#52c41a', borderWidth: 2 }} />
            <ItemRow label="TOTAL LIABILITIES & EQUITY" value={totalLiabilitiesEquity} bold color="#52c41a" />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default BalanceSheet;
