import React, { useState } from 'react';
import { Card, Form, Select, DatePicker, Input, Button, Table, Row, Col, Typography, InputNumber, Divider, message } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

const { Title, Text } = Typography;
const { Option } = Select;

const JournalEntryForm = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { data: accountData } = useApiData('/accounts');
  const accounts = accountData.filter(item => !item.is_group && item.is_active !== false).map(item => ({ ...item, name: `${item.code} - ${item.name}` }));
  const [lines, setLines] = useState([
    { key: '1', account: null, description: '', debit: 0, credit: 0 },
    { key: '2', account: null, description: '', debit: 0, credit: 0 }
  ]);

  const handleLineChange = (val, field, key) => {
    const newLines = lines.map(line => {
      if (line.key === key) {
        const updated = { ...line, [field]: val };
        // Clear the other amount field to ensure line is either debit or credit
        if (field === 'debit' && val > 0) updated.credit = 0;
        if (field === 'credit' && val > 0) updated.debit = 0;
        return updated;
      }
      return line;
    });
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { key: Date.now().toString(), account: null, description: '', debit: 0, credit: 0 }]);
  };

  const removeLine = (key) => {
    if (lines.length > 2) {
      setLines(lines.filter(line => line.key !== key));
    }
  };

  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const difference = totalDebit - totalCredit;
  const isBalanced = totalDebit > 0 && Math.round(totalDebit * 100) === Math.round(totalCredit * 100);

  const saveEntry = async (values, shouldPost) => {
    try {
      const { data: entry } = await client.post('/journal-entries', {
        entry_date: values.date.format('YYYY-MM-DD'),
        reference_type: values.reference,
        narration: values.narration,
        lines: lines.filter(line => line.account).map(line => ({
          account_id: line.account, description: line.description,
          debit_amount: Number(line.debit || 0), credit_amount: Number(line.credit || 0)
        }))
      });
      if (shouldPost) await client.post(`/journal-entries/${entry.id}/post`);
      message.success(shouldPost ? 'Journal posted' : 'Draft saved');
      navigate('/app/journal-entries');
    } catch (error) { message.error(error.response?.data?.message || 'Could not save the journal'); }
  };

  const onFinish = values => saveEntry(values, true);
  const saveDraft = async () => saveEntry(await form.validateFields(), false);

  const columns = [
    {
      title: 'Account',
      dataIndex: 'account',
      key: 'account',
      width: '30%',
      render: (val, record) => (
        <Select 
          style={{ width: '100%' }} 
          placeholder="Select account" 
          value={val} 
          onChange={(v) => handleLineChange(v, 'account', record.key)}
          showSearch
          filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
        >
          {accounts.map(a => <Option key={a.id} value={a.id}>{a.name}</Option>)}
        </Select>
      )
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (val, record) => (
        <Input value={val} onChange={(e) => handleLineChange(e.target.value, 'description', record.key)} />
      )
    },
    {
      title: 'Debit (₹)',
      dataIndex: 'debit',
      key: 'debit',
      width: '15%',
      render: (val, record) => (
        <InputNumber min={0} value={val} onChange={(v) => handleLineChange(v, 'debit', record.key)} style={{ width: '100%' }} />
      )
    },
    {
      title: 'Credit (₹)',
      dataIndex: 'credit',
      key: 'credit',
      width: '15%',
      render: (val, record) => (
        <InputNumber min={0} value={val} onChange={(v) => handleLineChange(v, 'credit', record.key)} style={{ width: '100%' }} />
      )
    },
    {
      title: '',
      key: 'action',
      width: '5%',
      render: (_, record) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeLine(record.key)} disabled={lines.length <= 2} />
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ fontFamily: "'Playfair Display', serif", color: 'var(--color-gold)', margin: 0 }}>Create Journal Entry</Title>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col xs={24} sm={8}>
              <Form.Item name="date" label={<span >Entry Date</span>} rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="narration" label={<span >Narration</span>} rules={[{ required: true }]}>
                <Input placeholder="Description for the entire journal entry" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 16 }}>Journal Lines</Title>
          <div className="desktop-only">
            <Table 
              columns={columns} 
              dataSource={lines} 
              pagination={false} 
              scroll={{ x: 'max-content' }}
              style={{ marginBottom: 16 }}
            />
          </div>
          <div className="mobile-only" style={{ marginBottom: 16 }}>
            {lines.map((line, index) => (
              <Card 
                key={line.key} 
                size="small" 
                title={`Line #${index + 1}`}
                extra={lines.length > 2 ? (
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeLine(line.key)} />
                ) : null}
                style={{ marginBottom: 12, borderColor: 'var(--color-border)' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Account</div>
                    <Select 
                      style={{ width: '100%' }} 
                      placeholder="Select account" 
                      value={line.account || undefined} 
                      onChange={(v) => handleLineChange(v, 'account', line.key)}
                      showSearch
                      filterOption={(input, option) => option.children.toLowerCase().includes(input.toLowerCase())}
                    >
                      {accounts.map(a => <Option key={a.id} value={a.id}>{a.name}</Option>)}
                    </Select>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Description</div>
                    <Input value={line.description} onChange={(e) => handleLineChange(e.target.value, 'description', line.key)} placeholder="Description for this line" />
                  </div>

                  <Row gutter={10}>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Debit (₹)</div>
                      <InputNumber min={0} value={line.debit} onChange={(v) => handleLineChange(v, 'debit', line.key)} style={{ width: '100%' }} />
                    </Col>
                    <Col span={12}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Credit (₹)</div>
                      <InputNumber min={0} value={line.credit} onChange={(v) => handleLineChange(v, 'credit', line.key)} style={{ width: '100%' }} />
                    </Col>
                  </Row>
                </div>
              </Card>
            ))}
          </div>
          <Button type="dashed" onClick={addLine} icon={<PlusOutlined />} style={{ width: '100%', borderColor: 'var(--color-gold)', color: 'var(--color-gold)', marginBottom: 24 }}>
            Add Line
          </Button>

          <Row justify="end">
            <Col xs={24} sm={12} lg={10}>
              <div style={{ padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px solid #30363d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: 'var(--color-text-secondary)' }}>Total Debit:</Text>
                  <Text style={{ fontWeight: 'bold' }}>₹{totalDebit.toLocaleString('en-IN')}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: 'var(--color-text-secondary)' }}>Total Credit:</Text>
                  <Text style={{ fontWeight: 'bold' }}>₹{totalCredit.toLocaleString('en-IN')}</Text>
                </div>
                <Divider style={{ margin: '12px 0', borderColor: '#30363d' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Title level={5} style={{ color: difference === 0 ? '#52c41a' : '#ff4d4f', margin: 0 }}>Difference:</Title>
                  <Title level={5} style={{ color: difference === 0 ? '#52c41a' : '#ff4d4f', margin: 0 }}>₹{Math.abs(difference).toLocaleString('en-IN')}</Title>
                </div>
              </div>
            </Col>
          </Row>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
          <Button icon={<SaveOutlined />} onClick={saveDraft} disabled={!isBalanced}>
            Save Draft
          </Button>
          <Button type="primary" htmlType="submit" disabled={!isBalanced} icon={<CheckCircleOutlined />} style={{ background: isBalanced ? 'var(--color-gold)' : '#30363d', borderColor: isBalanced ? 'var(--color-gold)' : '#30363d', color: isBalanced ? '#0f1729' : '#8b949e' }}>
            Post Entry
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default JournalEntryForm;
