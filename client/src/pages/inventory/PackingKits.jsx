import React, { useState } from 'react';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Switch, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';
import { usePageTitle } from '../../context/PageTitleContext';

const { Text, Title } = Typography;

export default function PackingKits() {
  usePageTitle('Packing Kits');
  const { data: kits, loading, reload } = useApiData('/packing-kits');
  const { data: materials } = useApiData('/packaging-materials');
  const [form] = Form.useForm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const openKit = kit => {
    setEditing(kit || null);
    form.resetFields();
    form.setFieldsValue(kit ? {
      code: kit.code, name: kit.name, minimum_fill_ml: Number(kit.minimum_fill_ml), maximum_fill_ml: Number(kit.maximum_fill_ml),
      priority: Number(kit.priority || 0), is_default: Boolean(kit.is_default), is_active: kit.is_active !== false,
      items: (kit.packingKitItems || []).map(item => ({ packaging_material_id: item.packaging_material_id, quantity: Number(item.quantity) }))
    } : { minimum_fill_ml: 1, maximum_fill_ml: 5, priority: 0, is_default: false, is_active: true, items: [{ quantity: 1 }] });
    setOpen(true);
  };

  const save = async values => {
    setSaving(true);
    try {
      const payload = { ...values, items: values.items || [] };
      if (editing) await client.put(`/packing-kits/${editing.id}`, payload);
      else await client.post('/packing-kits', payload);
      await reload();
      setOpen(false);
      message.success(`Packing kit ${editing ? 'updated' : 'created'}.`);
    } catch (error) { message.error(error.response?.data?.message || 'Could not save packing kit.'); }
    finally { setSaving(false); }
  };

  const removeKit = kit => Modal.confirm({
    title: `Delete ${kit.name}?`, okText: 'Delete kit', okButtonProps: { danger: true },
    onOk: async () => {
      try { await client.delete(`/packing-kits/${kit.id}`); await reload(); message.success('Packing kit deleted.'); }
      catch (error) { message.error(error.response?.data?.message || 'Could not delete packing kit.'); }
    }
  });

  const columns = [
    { title: 'Kit', render: (_, kit) => <div><Text strong>{kit.name}</Text><Text type="secondary" style={{ display: 'block' }}>{kit.code}</Text></div> },
    { title: 'Fill capacity', render: (_, kit) => Number(kit.minimum_fill_ml) === Number(kit.maximum_fill_ml) ? `${Number(kit.minimum_fill_ml)} ml exact` : `${Number(kit.minimum_fill_ml)}–${Number(kit.maximum_fill_ml)} ml` },
    { title: 'Materials', render: (_, kit) => (kit.packingKitItems || []).map(item => `${item.packagingMaterial?.name || 'Material'} ×${Number(item.quantity)}`).join(' + ') },
    { title: 'Status', render: (_, kit) => <Space>{kit.is_default && <Tag color="gold">Default</Tag>}<Tag color={kit.is_active !== false ? 'success' : 'default'}>{kit.is_active !== false ? 'Active' : 'Inactive'}</Tag></Space> },
    { title: '', width: 110, render: (_, kit) => <Space><Button type="text" icon={<EditOutlined />} onClick={() => openKit(kit)} /><Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeKit(kit)} /></Space> }
  ];

  return <div style={{ padding: 24 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 20 }}>
      <div><Title level={2} style={{ margin: 0 }}>Packing Kits</Title><Text type="secondary">Group bottles, caps, sprays, labels and boxes by supported fill capacity.</Text></div>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => openKit(null)}>New Kit</Button>
    </div>
    <Card><Table rowKey="id" loading={loading} dataSource={kits} columns={columns} scroll={{ x: 820 }} /></Card>
    <Modal title={editing ? 'Edit Packing Kit' : 'New Packing Kit'} open={open} onCancel={() => setOpen(false)} footer={null} width={720} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={save}>
        <Row gutter={12}><Col span={8}><Form.Item name="code" label="Kit code" rules={[{ required: true }]}><Input placeholder="KIT-30" /></Form.Item></Col><Col span={16}><Form.Item name="name" label="Kit name" rules={[{ required: true }]}><Input placeholder="30 ml Standard Kit" /></Form.Item></Col></Row>
        <Row gutter={12}><Col span={8}><Form.Item name="minimum_fill_ml" label="Minimum fill (ml)" rules={[{ required: true }]}><InputNumber min={0.0001} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="maximum_fill_ml" label="Maximum fill (ml)" dependencies={['minimum_fill_ml']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, value) => Number(value) >= Number(getFieldValue('minimum_fill_ml')) ? Promise.resolve() : Promise.reject(new Error('Maximum must be at least the minimum')) })]}><InputNumber min={0.0001} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="priority" label="Priority"><InputNumber precision={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
        <Text type="secondary">For an exact size such as 30 ml, enter 30 as both minimum and maximum.</Text>
        <Card size="small" title="Materials per pack" style={{ marginTop: 16, marginBottom: 16 }}>
          <Form.List name="items">{(fields, { add, remove }) => <>{fields.map(field => <Row gutter={10} key={field.key}><Col span={16}><Form.Item {...field} name={[field.name, 'packaging_material_id']} rules={[{ required: true, message: 'Select a material' }]}><Select showSearch optionFilterProp="label" placeholder="Bottle, cap, spray, label..." options={materials.map(material => ({ value: material.id, label: `${material.name} (${material.sku}) · ${Number(material.current_stock || 0)} ${material.unit}` }))} /></Form.Item></Col><Col span={6}><Form.Item {...field} name={[field.name, 'quantity']} rules={[{ required: true }]}><InputNumber min={0.0001} placeholder="Qty" style={{ width: '100%' }} /></Form.Item></Col><Col span={2}><Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} /></Col></Row>)}<Button block type="dashed" icon={<PlusOutlined />} onClick={() => add({ quantity: 1 })}>Add material</Button></>}</Form.List>
        </Card>
        <Row gutter={12}><Col span={8}><Form.Item name="is_default" label="Default for range" valuePropName="checked"><Switch /></Form.Item></Col><Col span={8}><Form.Item name="is_active" label="Available in POS" valuePropName="checked"><Switch /></Form.Item></Col></Row>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button type="primary" htmlType="submit" loading={saving}>Save Kit</Button></div>
      </Form>
    </Modal>
  </div>;
}
