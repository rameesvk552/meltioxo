import React from 'react';
import { Card, Descriptions, Table, Tag, Typography, Breadcrumb, Steps, Button, Space } from 'antd';
import { HomeOutlined, ExperimentOutlined, PlayCircleOutlined, CheckSquareOutlined, StopOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';

const { Title } = Typography;
const { Step } = Steps;

const ProductionOrderDetail = () => {
  const { id } = useParams();
  const orderId = id || 'PROD-2024-103';

  const materials = [
    { key: '1', material: 'Sandalwood Oil', type: 'Raw Material', required: '5000 ml', available: '8500 ml', consumed: '-', status: 'Available' },
    { key: '2', material: 'Rose Absolute', type: 'Raw Material', required: '2000 ml', available: '2100 ml', consumed: '-', status: 'Available' },
    { key: '3', material: 'Ethanol', type: 'Raw Material', required: '85000 ml', available: '50000 ml', consumed: '-', status: 'Insufficient' },
    { key: '4', material: '100ml Glass Bottle', type: 'Packaging', required: '1000 pcs', available: '1500 pcs', consumed: '-', status: 'Available' },
    { key: '5', material: 'Gold Sprayer Pump', type: 'Packaging', required: '1000 pcs', available: '800 pcs', consumed: '-', status: 'Insufficient' },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item href=""><HomeOutlined /></Breadcrumb.Item>
        <Breadcrumb.Item href="/manufacturing/production"><ExperimentOutlined /> Production</Breadcrumb.Item>
        <Breadcrumb.Item>{orderId}</Breadcrumb.Item>
      </Breadcrumb>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <Title level={2} style={{ color: '#d4a853', fontFamily: 'Playfair Display', margin: 0 }}>Production Order: {orderId}</Title>
        <Space>
          <Button type="primary" icon={<PlayCircleOutlined />} style={{ backgroundColor: '#3b82f6', border: 'none' }}>Start Production</Button>
          <Button type="default" icon={<CheckSquareOutlined />} style={{ color: '#22c55e', borderColor: '#22c55e', background: 'transparent' }}>Complete</Button>
          <Button danger icon={<StopOutlined />} type="text">Cancel</Button>
        </Space>
      </div>

      <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: '24px' }}>
        <Steps current={1} style={{ padding: '20px 40px' }} className="custom-steps">
          <Step title="Planned" description="Order Created" />
          <Step title="In Progress" description="Manufacturing ongoing" />
          <Step title="Completed" description="Stock updated" />
        </Steps>
      </Card>

      <Card style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, marginBottom: '24px' }}>
        <Descriptions title={<span style={{ color: '#d4a853' }}>Order Details</span>} bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }} contentStyle={{ color: '#e2e8f0' }} labelStyle={{ color: '#94a3b8' }}>
          <Descriptions.Item label="Formula">Citrus Breeze (FORM-003)</Descriptions.Item>
          <Descriptions.Item label="Batch Number">B-CB-2402</Descriptions.Item>
          <Descriptions.Item label="Status"><Tag color="blue">In Progress</Tag></Descriptions.Item>
          <Descriptions.Item label="Planned Quantity">2000 units</Descriptions.Item>
          <Descriptions.Item label="Actual Quantity">-</Descriptions.Item>
          <Descriptions.Item label="Planned Date">2024-02-01</Descriptions.Item>
          <Descriptions.Item label="Completion Date">-</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title={<span style={{ color: '#d4a853' }}>Material Requirements</span>} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12 }}>
        <Table 
          dataSource={materials} 
          columns={[
            { title: 'Material', dataIndex: 'material', key: 'material' },
            { title: 'Type', dataIndex: 'type', key: 'type' },
            { title: 'Required Qty', dataIndex: 'required', key: 'required' },
            { title: 'Available in Stock', dataIndex: 'available', key: 'available' },
            { title: 'Consumed', dataIndex: 'consumed', key: 'consumed' },
            { title: 'Status', dataIndex: 'status', key: 'status', render: s => <Tag color={s === 'Available' ? 'green' : 'red'}>{s}</Tag> }
          ]} 
          pagination={false}
          scroll={{ x: 'max-content' }}
          className="dark-theme-table"
        />
      </Card>
    </div>
  );
};

export default ProductionOrderDetail;
