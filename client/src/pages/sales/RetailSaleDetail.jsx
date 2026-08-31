import React, { useContext, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Empty, Row, Space, Spin, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, ExperimentOutlined, PrinterOutlined, RollbackOutlined, SwapOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';
import SalesReturnModal from './SalesReturnModal';
import SalesExchangeModal from './SalesExchangeModal';
import { AuthContext } from '../../context/AuthContext';

const { Title, Text } = Typography;
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RetailSaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const canReturn = ['super_admin', 'admin', 'manager', 'accountant', 'sales'].includes(user?.role);
  const [returnOpen, setReturnOpen] = useState(false);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const saleQuery = useApiData(`/retail-sales/${id}`, { initialData: {} });
  const { data: tenantSettings } = useApiData('/tenant/settings', { initialData: {} });
  const { data: sale, loading } = saleQuery;
  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>;
  if (!sale.id) return <Empty description="Sale not found" />;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/retail-sales')}>Sales</Button>
          <Title level={3} style={{ margin: 0 }}>{sale.sale_number}</Title>
          <Tag color={sale.return_status === 'full' ? 'default' : sale.return_status === 'partial' ? 'orange' : 'success'}>{sale.return_status === 'full' ? 'Fully returned' : sale.return_status === 'partial' ? 'Partially returned' : 'Posted'}</Tag>
        </Space>
        <Space wrap>
          {canReturn && sale.return_status !== 'full' && <Button danger icon={<RollbackOutlined />} onClick={() => setReturnOpen(true)}>Return</Button>}
          {canReturn && sale.return_status !== 'full' && <Button icon={<SwapOutlined />} onClick={() => setExchangeOpen(true)}>Exchange</Button>}
          <Button type="primary" icon={<PrinterOutlined />} onClick={() => navigate(`/app/retail-sales/${sale.id}/invoice`)}>Invoice &amp; Print</Button>
        </Space>
      </div>
      {sale.exchangeReturn?.retailSale && <Alert type="success" showIcon message={`Replacement invoice for ${sale.exchangeReturn.retailSale.sale_number}`} description={<Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/app/retail-sales/${sale.exchangeReturn.retailSale.id}`)}>View original sale</Button>} style={{ marginBottom: 16 }} />}
      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 4 }}>
          <Descriptions.Item label="Date">{sale.sale_date}</Descriptions.Item>
          <Descriptions.Item label="Customer">{sale.customer?.name || 'Walk-in customer'}</Descriptions.Item>
          <Descriptions.Item label="Received in">{sale.paymentAccount?.name || sale.paymentMethod?.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Total">{money(sale.total_amount)}</Descriptions.Item>
          <Descriptions.Item label="Returned">{money(sale.returned_amount)}</Descriptions.Item>
          <Descriptions.Item label="Net sale">{money(Number(sale.total_amount || 0) - Number(sale.returned_amount || 0))}</Descriptions.Item>
          <Descriptions.Item label="Material/stock cost">{money(sale.cogs_amount)}</Descriptions.Item>
          <Descriptions.Item label="Net gross profit">{money(Number(sale.subtotal || 0) - Number(sale.discount_amount || 0) - Number(sale.returned_revenue || 0) - Number(sale.cogs_amount || 0) + Number(sale.returned_cost || 0))}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Row gutter={[16, 16]}>
        {(sale.retailSaleItems || []).map(item => {
          const variant = item.finishedGood;
          const packingMaterial = item.packagingMaterial;
          const isPackaging = item.item_type === 'packaging_material' || Boolean(packingMaterial);
          const isMeasured = Boolean(variant?.product?.sell_by_measurement);
          const order = item.productionOrder;
          const deficits = order?.inventoryDeficits || [];
          const columns = [
            { title: 'Material', dataIndex: 'material_name' },
            { title: 'Type', dataIndex: 'material_type', render: value => <Tag>{value}</Tag> },
            { title: 'Used', render: (_, row) => {
              const used = Number(row.consumed_qty ?? row.required_qty);
              return Number.isFinite(used) ? `${used.toLocaleString()} ${row.material_unit || 'units'}` : '—';
            } },
            { title: 'Cost', dataIndex: 'consumed_cost', align: 'right', render: money }
          ];
          return <Col span={24} key={item.id}>
            <Card title={isPackaging ? `${packingMaterial?.name || 'Packing material'} · ${packingMaterial?.sku || 'Material'}` : isMeasured ? (variant?.product?.name || variant?.name || 'Product') : `${variant?.product?.name || variant?.name || 'Product'} · ${variant?.size_label || variant?.sku || 'Variant'}`} extra={<Tag color={item.fulfillment_mode === 'make_now' ? 'gold' : 'blue'}>{isPackaging ? 'Packing Material Stock' : isMeasured ? 'Measured · Make Now' : item.fulfillment_mode === 'make_now' ? 'Make Now' : 'Finished Stock'}</Tag>}>
              <Descriptions column={{ xs: 1, sm: 3 }} size="small">
                <Descriptions.Item label="Quantity">{Number(item.quantity)}{isPackaging ? ` ${packingMaterial?.unit || 'pcs'}` : isMeasured ? ` ${variant.product.measurement_unit || 'ml'}` : ''}</Descriptions.Item>
                <Descriptions.Item label="Returned">{Number(item.returned_quantity || 0)}{isPackaging ? ` ${packingMaterial?.unit || 'pcs'}` : isMeasured ? ` ${variant.product.measurement_unit || 'ml'}` : ''}</Descriptions.Item>
                <Descriptions.Item label="Sale amount">{money(item.total)}</Descriptions.Item>
                <Descriptions.Item label="Cost">{money(item.cost_amount)}</Descriptions.Item>
                {item.packingKit && <Descriptions.Item label="Packing kit">{item.packingKit.name}</Descriptions.Item>}
                {isMeasured && item.fill_quantity_ml && <Descriptions.Item label="Packing">{Number(item.fill_quantity_ml)} ml × {Number(item.pack_count || 1)} pack(s)</Descriptions.Item>}
                {tenantSettings.show_formula_in_sales && order && <Descriptions.Item label="Formula">{order.formula?.name || '—'}</Descriptions.Item>}
                {order && <Descriptions.Item label="Batch">{order.batch_number}</Descriptions.Item>}
                {order && <Descriptions.Item label="Production"><Button type="link" icon={<ExperimentOutlined />} onClick={() => navigate(`/app/production/${order.id}`)}>{order.order_number}</Button></Descriptions.Item>}
              </Descriptions>
              {order && <>
                <Table style={{ marginTop: 16 }} size="small" pagination={false} rowKey="id" columns={columns} dataSource={order.productionMaterials || []} scroll={{ x: 560 }} />
                {deficits.length > 0 && <div style={{ marginTop: 12 }}><Text type="danger">Negative stock tracked: {deficits.filter(row => row.status === 'open').length} open material deficit(s).</Text></div>}
              </>}
              {(item.retailSaleItemPackagings || []).length > 0 && <Table
                style={{ marginTop: 16 }} size="small" pagination={false} rowKey="id"
                columns={[
                  { title: 'Packing material', dataIndex: 'material_name' },
                  { title: 'Used', render: (_, row) => `${Number(row.quantity)} ${row.packagingMaterial?.unit || 'pcs'}` },
                  { title: 'Cost', dataIndex: 'total_cost', align: 'right', render: money }
                ]}
                dataSource={item.retailSaleItemPackagings}
              />}
            </Card>
          </Col>;
        })}
      </Row>
      {(sale.salesReturns || []).length > 0 && <Card title={<Space><RollbackOutlined />Return history</Space>} style={{ marginTop: 16 }}>
        <Alert type="info" showIcon message="Posted invoices remain unchanged" description="These linked credit transactions contain the refund, tax reversal, and any inventory restored." style={{ marginBottom: 16 }} />
        <Table
          rowKey="id"
          pagination={false}
          scroll={{ x: 760 }}
          dataSource={sale.salesReturns}
          columns={[
            { title: 'Return #', dataIndex: 'return_number' },
            { title: 'Date', dataIndex: 'return_date' },
            { title: 'Reason', dataIndex: 'reason', render: (value, row) => row.exchangeSale ? <Button type="link" icon={<SwapOutlined />} onClick={() => navigate(`/app/retail-sales/${row.exchangeSale.id}`)}>{value} · {row.exchangeSale.sale_number}</Button> : value },
            { title: 'Items', render: (_, row) => (row.salesReturnItems || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0).toLocaleString('en-IN') },
            { title: 'Restocked', render: (_, row) => (row.salesReturnItems || []).reduce((sum, item) => sum + Number(item.restock_quantity || 0), 0).toLocaleString('en-IN') },
            { title: 'Refunded via', render: (_, row) => row.paymentMethod?.name || row.refundAccount?.name || '—' },
            { title: 'Amount', dataIndex: 'total_amount', align: 'right', render: money }
          ]}
        />
      </Card>}
      <SalesReturnModal sale={sale} open={returnOpen} onClose={() => setReturnOpen(false)} onCreated={saleQuery.reload} />
      <SalesExchangeModal sale={sale} open={exchangeOpen} onClose={() => setExchangeOpen(false)} onCreated={saleQuery.reload} />
    </div>
  );
}
