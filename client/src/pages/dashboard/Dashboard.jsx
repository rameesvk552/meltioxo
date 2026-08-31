import React from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Typography, List, Avatar, Empty } from 'antd';
import { ExperimentOutlined, AlertOutlined, FallOutlined } from '@ant-design/icons';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import useApiData from '../../hooks/useApiData';
import { AuthContext } from '../../context/AuthContext';
import { ALL_DASHBOARD_WIDGET_KEYS } from '../../config/permissions';

const { Title, Text } = Typography;

const COLORS = ['var(--color-gold)', '#8b6b32', '#f3d38c', '#a68241', '#e8c471'];

export default function Dashboard() {
  const { canViewWidget } = React.useContext(AuthContext);
  const show = widget => canViewWidget(widget);
  const needsInventory = show('inventory_value') || show('low_stock_count') || show('low_stock_list');
  const { data: businessDayState } = useApiData('/business-days/current', { initialData: {}, enabled: show('today_sales') });
  const { data: productionOrders } = useApiData('/production-orders', { enabled: show('pending_production') });
  const { data: rawMaterials } = useApiData('/raw-materials', { enabled: needsInventory });
  const { data: packagingMaterials } = useApiData('/packaging-materials', { enabled: needsInventory });
  const { data: finishedGoods } = useApiData('/finished-goods', { enabled: needsInventory });
  const todaysSales = Number(businessDayState.today_record?.total_sales || 0);
  const inventoryValue = [
    ...rawMaterials.map(item => Number(item.current_stock || 0) * Number(item.avg_cost || 0)),
    ...packagingMaterials.map(item => Number(item.current_stock || 0) * Number(item.avg_cost || 0)),
    ...finishedGoods.map(item => Number(item.current_stock || 0) * Number(item.cost_price || 0))
  ].reduce((sum, value) => sum + value, 0);
  const pendingProduction = productionOrders.filter(item => ['planned', 'in_progress'].includes(item.status)).length;
  const lowStock = [...rawMaterials, ...packagingMaterials, ...finishedGoods]
    .filter(item => Number(item.current_stock || 0) <= Number(item.reorder_level || 0));
  const revenueData = [];
  const productData = [];
  const activities = [];
  const overdueData = [];
  const cardStyle = { background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 12 };

  if (!ALL_DASHBOARD_WIDGET_KEYS.some(show)) {
    return (
      <div style={{ padding: 24 }}>
        <Title level={2} style={{ color: 'var(--color-gold)', fontFamily: 'Playfair Display', marginBottom: 24 }}>Dashboard</Title>
        <Card style={cardStyle}><Empty description="No dashboard widgets are assigned to your account" /></Card>
      </div>
    );
  }
  
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ color: 'var(--color-gold)', fontFamily: 'Playfair Display', marginBottom: 24 }}>Dashboard</Title>
      
      {/* Row 1: Financial KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {show('today_sales') && <Col xs={24} sm={12} lg={12}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic title={<Text style={{ color: 'var(--color-text-secondary)' }}>Today's Sales</Text>} value={todaysSales} precision={2} prefix="₹"
                       styles={{ content: { color: '#48bb78', fontWeight: 600 } }} />
          </Card>
        </Col>}
        {show('inventory_value') && <Col xs={24} sm={12} lg={12}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic title={<Text style={{ color: 'var(--color-text-secondary)' }}>Inventory Value</Text>} value={inventoryValue} precision={2} prefix="₹"
                       styles={{ content: { color: 'var(--color-gold)', fontWeight: 600 } }} />
          </Card>
        </Col>}
      </Row>

      {/* Row 2: Operational KPIs */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {show('pending_production') && <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic title={<Text style={{ color: 'var(--color-text-secondary)' }}>Pending Production</Text>} value={pendingProduction} prefix={<ExperimentOutlined />}
                       styles={{ content: { color: '#ed8936', fontWeight: 600 } }} />
          </Card>
        </Col>}
        {show('low_stock_count') && <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic title={<Text style={{ color: 'var(--color-text-secondary)' }}>Low Stock Alerts</Text>} value={lowStock.length} prefix={<AlertOutlined />}
                       styles={{ content: { color: '#f56565', fontWeight: 600 } }}
                       suffix={<span style={{ fontSize: 14 }}><FallOutlined /> -1</span>} />
          </Card>
        </Col>}
        {show('overdue_payables') && <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic title={<Text style={{ color: 'var(--color-text-secondary)' }}>Overdue Payables</Text>} value={0} prefix="₹"
                       styles={{ content: { color: '#f56565', fontWeight: 600 } }} />
          </Card>
        </Col>}
        {show('overdue_receivables') && <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle} bodyStyle={{ padding: 20 }}>
            <Statistic title={<Text style={{ color: 'var(--color-text-secondary)' }}>Overdue Receivables</Text>} value={0} prefix="₹"
                       styles={{ content: { color: '#ed8936', fontWeight: 600 } }} />
          </Card>
        </Col>}
      </Row>

      <Row gutter={[16, 16]}>
        {show('revenue_trend') && <Col xs={24} lg={16}>
          <Card style={cardStyle} title={<Text style={{ color: 'var(--color-gold)' }}>Revenue Trend</Text>}>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                  <XAxis dataKey="name" stroke="var(--color-text-secondary)" />
                  <YAxis stroke="var(--color-text-secondary)" tickFormatter={(value) => `₹${value/1000}k`} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#1a202c', border: '1px solid var(--color-gold)' }} />
                  <Area type="monotone" dataKey="value" stroke="var(--color-gold)" fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>}
        {show('revenue_by_product') && <Col xs={24} lg={8}>
          <Card style={cardStyle} title={<Text style={{ color: 'var(--color-gold)' }}>Revenue by Product</Text>}>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={productData} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {productData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#1a202c', border: '1px solid var(--color-gold)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ textAlign: 'center', marginTop: -20, color: 'var(--color-text-secondary)' }}>
                {productData.map((p, i) => (
                  <span key={i} style={{ display: 'inline-block', margin: '0 8px', fontSize: 12 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: COLORS[i], borderRadius: '50%', marginRight: 4 }} />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </Col>}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {show('low_stock_list') && <Col xs={24} lg={8}>
          <Card style={cardStyle} title={<Text style={{ color: 'var(--color-gold)' }}>Low Stock Alerts</Text>}>
            <List
              itemLayout="horizontal"
              dataSource={lowStock.map(item => ({
                name: item.name,
                stock: `${Number(item.current_stock || 0)} ${item.unit || ''}`,
                reorder: `${Number(item.reorder_level || 0)} ${item.unit || ''}`
              }))}
              renderItem={item => (
                <List.Item actions={[<Button key="view" type="link" size="small" style={{color: 'var(--color-gold)'}}>View</Button>]}>
                  <List.Item.Meta
                    avatar={<Avatar icon={<AlertOutlined />} style={{ backgroundColor: '#f56565' }} />}
                    title={<Text style={{ color: 'inherit' }}>{item.name}</Text>}
                    description={<Text style={{ color: 'var(--color-text-secondary)' }}>Stock: {item.stock} / Reorder: {item.reorder}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>}
        {show('recent_activities') && <Col xs={24} lg={8}>
          <Card style={cardStyle} title={<Text style={{ color: 'var(--color-gold)' }}>Recent Activities</Text>}>
            <List
              itemLayout="horizontal"
              dataSource={activities.slice(0, 5)}
              renderItem={item => (
                <List.Item>
                  <List.Item.Meta
                    title={<Text style={{ color: 'inherit' }}>{item.title}</Text>}
                    description={<Text style={{ color: 'var(--color-text-secondary)' }}>{item.time}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>}
        {show('overdue_payments') && <Col xs={24} lg={8}>
          <Card style={cardStyle} title={<Text style={{ color: 'var(--color-gold)' }}>Overdue Payments</Text>}>
            <Table 
              dataSource={overdueData} 
              pagination={false} 
              size="small"
              rowClassName={() => 'dark-table-row'}
              columns={[
                { title: 'Party', dataIndex: 'party', key: 'party', render: text => <Text style={{ color: 'inherit' }}>{text}</Text> },
                { title: 'Amount', dataIndex: 'amount', key: 'amount', render: val => <Text style={{ color: '#f56565' }}>₹{val.toLocaleString()}</Text> },
                { title: 'Status', dataIndex: 'status', key: 'status', render: text => <Tag color={text === 'High Priority' ? 'red' : 'orange'}>{text}</Tag> }
              ]} 
            />
          </Card>
        </Col>}
      </Row>
    </div>
  );
}
