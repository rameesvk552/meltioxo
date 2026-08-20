import React from 'react';
import { Button, Card, Col, Descriptions, Empty, Row, Space, Spin, Table, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, ExperimentOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function RetailSaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sale, loading } = useApiData(`/retail-sales/${id}`, { initialData: {} });
  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div>;
  if (!sale.id) return <Empty description="Sale not found" />;

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/retail-sales')}>Sales</Button>
        <Title level={3} style={{ margin: 0 }}>{sale.sale_number}</Title>
        <Tag color="success">Posted</Tag>
      </Space>
      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, lg: 4 }}>
          <Descriptions.Item label="Date">{sale.sale_date}</Descriptions.Item>
          <Descriptions.Item label="Customer">{sale.customer?.name || 'Walk-in customer'}</Descriptions.Item>
          <Descriptions.Item label="Received in">{sale.paymentAccount?.name || sale.paymentMethod?.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Total">{money(sale.total_amount)}</Descriptions.Item>
          <Descriptions.Item label="Material/stock cost">{money(sale.cogs_amount)}</Descriptions.Item>
          <Descriptions.Item label="Gross profit">{money(Number(sale.subtotal || 0) - Number(sale.discount_amount || 0) - Number(sale.cogs_amount || 0))}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Row gutter={[16, 16]}>
        {(sale.retailSaleItems || []).map(item => {
          const variant = item.finishedGood;
          const order = item.productionOrder;
          const deficits = order?.inventoryDeficits || [];
          const columns = [
            { title: 'Material', dataIndex: 'material_name' },
            { title: 'Type', dataIndex: 'material_type', render: value => <Tag>{value}</Tag> },
            { title: 'Used', render: (_, row) => `${Number(row.consumed_qty || row.required_qty).toLocaleString()} ${row.material_unit}` },
            { title: 'Cost', dataIndex: 'consumed_cost', align: 'right', render: money }
          ];
          return <Col span={24} key={item.id}>
            <Card title={`${variant?.product?.name || variant?.name || 'Product'} · ${variant?.size_label || variant?.sku || 'Variant'}`} extra={<Tag color={item.fulfillment_mode === 'make_now' ? 'gold' : 'blue'}>{item.fulfillment_mode === 'make_now' ? 'Make Now' : 'Finished Stock'}</Tag>}>
              <Descriptions column={{ xs: 1, sm: 3 }} size="small">
                <Descriptions.Item label="Quantity">{Number(item.quantity)}</Descriptions.Item>
                <Descriptions.Item label="Sale amount">{money(item.total)}</Descriptions.Item>
                <Descriptions.Item label="Cost">{money(item.cost_amount)}</Descriptions.Item>
                {order && <Descriptions.Item label="Formula">{order.formula?.name || '—'}</Descriptions.Item>}
                {order && <Descriptions.Item label="Batch">{order.batch_number}</Descriptions.Item>}
                {order && <Descriptions.Item label="Production"><Button type="link" icon={<ExperimentOutlined />} onClick={() => navigate(`/app/production/${order.id}`)}>{order.order_number}</Button></Descriptions.Item>}
              </Descriptions>
              {order && <>
                <Table style={{ marginTop: 16 }} size="small" pagination={false} rowKey="id" columns={columns} dataSource={order.productionMaterials || []} scroll={{ x: 560 }} />
                {deficits.length > 0 && <div style={{ marginTop: 12 }}><Text type="danger">Negative stock tracked: {deficits.filter(row => row.status === 'open').length} open material deficit(s).</Text></div>}
              </>}
            </Card>
          </Col>;
        })}
      </Row>
    </div>
  );
}
