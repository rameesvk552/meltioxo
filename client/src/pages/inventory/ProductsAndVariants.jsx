import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message
} from 'antd';
import { AppstoreAddOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import useApiData from '../../hooks/useApiData';
import client from '../../api/client';
import { usePageTitle } from '../../context/PageTitleContext';
import PageDrawerControls from '../../components/common/PageDrawerControls';
import ResponsiveDataTable from '../../components/common/ResponsiveDataTable';

const { Title, Text } = Typography;

export default function ProductsAndVariants() {
  const { data: variantData, loading, reload: reloadVariants } = useApiData('/finished-goods');
  const { data: products, reload: reloadProducts } = useApiData('/products');
  const { data: formulas } = useApiData('/formulas');
  const { data: packagingMaterials } = useApiData('/packaging-materials');
  const [searchText, setSearchText] = useState('');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [productForm] = Form.useForm();
  const [variantForm] = Form.useForm();
  usePageTitle('Products & Variants');


  const variants = useMemo(() => variantData.map(item => ({
    ...item,
    productName: item.product?.name || 'Legacy product',
    formulaName: item.formula?.name || item.product?.formula?.name || '—',
    formulaOverride: Boolean(item.formula_id && item.formula_id !== item.product?.formula_id),
    size: item.size_label || (item.fill_quantity_ml ? `${Number(item.fill_quantity_ml)}ml` : '—'),
    fillMl: Number(item.fill_quantity_ml || 0),
    sellingPrice: Number(item.selling_price || 0),
    costPrice: Number(item.cost_price || 0),
    stock: Number(item.current_stock || 0),
    reorder: Number(item.reorder_level || 0),
    packagingCount: item.variantPackagings?.length || 0,
    readyToMake: Boolean((item.formula_id || item.product?.formula_id) && Number(item.fill_quantity_ml) > 0 && item.variantPackagings?.length)
  })), [variantData]);

  const filteredVariants = variants.filter(item => {
    const query = searchText.trim().toLowerCase();
    return !query || [item.productName, item.name, item.sku, item.size]
      .some(value => String(value || '').toLowerCase().includes(query));
  });

  const createProduct = async values => {
    try {
      await client.post('/products', values);
      await reloadProducts();
      productForm.resetFields();
      setProductModalOpen(false);
      message.success('Product created. You can now add its variants.');
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not create product');
    }
  };

  const createVariant = async values => {
    try {
      const payload = {
        product_id: values.product_id,
        formula_id: values.formula_id || null,
        name: values.name || undefined,
        sku: values.sku || undefined,
        size_label: values.size_label,
        fill_quantity_ml: values.fill_quantity_ml,
        selling_price: values.selling_price,
        cost_price: values.cost_price,
        current_stock: values.current_stock || 0,
        reorder_level: values.reorder_level || 0,
        packaging: values.packaging || []
      };
      if (editingVariant) await client.put(`/finished-goods/${editingVariant.id}`, payload);
      else await client.post('/finished-goods', payload);
      await Promise.all([reloadVariants(), reloadProducts()]);
      variantForm.resetFields();
      setVariantModalOpen(false);
      setEditingVariant(null);
      message.success(editingVariant ? 'Product variant updated successfully.' : 'Product variant created successfully.');
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not create variant');
    }
  };

  const openVariantModal = () => {
    setEditingVariant(null);
    variantForm.setFieldsValue({
      size_label: '100ml',
      fill_quantity_ml: 100,
      current_stock: 0,
      reorder_level: 20,
      packaging: []
    });
    setVariantModalOpen(true);
  };

  const openEditVariant = (variant) => {
    setEditingVariant(variant);
    variantForm.setFieldsValue({
      product_id: variant.product_id,
      formula_id: variant.formula_id && variant.formula_id !== variant.product?.formula_id ? variant.formula_id : null,
      name: variant.name,
      sku: variant.sku,
      size_label: variant.size_label,
      fill_quantity_ml: variant.fillMl,
      selling_price: variant.sellingPrice,
      cost_price: variant.costPrice,
      current_stock: variant.stock,
      reorder_level: variant.reorder,
      packaging: (variant.variantPackagings || []).map(row => ({ packaging_material_id: row.packaging_material_id, quantity: Number(row.quantity) }))
    });
    setVariantModalOpen(true);
  };

  const columns = [
    {
      title: 'Product',
      dataIndex: 'productName',
      key: 'productName',
      render: (value, row) => (
        <div>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{row.formulaName}{row.formulaOverride ? ' · Variant override' : ' · Product default'}</Text>
        </div>
      )
    },
    {
      title: 'Variant',
      key: 'variant',
      render: (_, row) => (
        <div>
          <Text>{row.size}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{row.fillMl} ml fill</Text>
        </div>
      )
    },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Packaging BOM', dataIndex: 'packagingCount', key: 'packagingCount', render: value => `${value} items` },
    { title: 'Make Status', key: 'makeStatus', render: (_, row) => <Tag color={row.readyToMake ? 'success' : 'warning'}>{row.readyToMake ? 'Ready to Make' : 'Missing Formula/Packaging'}</Tag> },
    { title: 'Cost', dataIndex: 'costPrice', key: 'costPrice', align: 'right', render: value => `₹${value.toLocaleString('en-IN')}` },
    { title: 'Price', dataIndex: 'sellingPrice', key: 'sellingPrice', align: 'right', render: value => `₹${value.toLocaleString('en-IN')}` },
    { title: 'Stock', dataIndex: 'stock', key: 'stock', align: 'right', render: value => `${value} units` },
    {
      title: 'Status',
      key: 'status',
      render: (_, row) => {
        const status = row.stock === 0 ? 'Out of Stock' : row.stock <= row.reorder ? 'Low Stock' : 'In Stock';
        return <Tag color={status === 'In Stock' ? 'success' : status === 'Low Stock' ? 'warning' : 'error'}>{status}</Tag>;
      }
    }
    , { title: 'Actions', key: 'actions', render: (_, row) => <Button type="text" icon={<EditOutlined />} onClick={() => openEditVariant(row)}>Edit</Button> }
  ];

  const inventoryValue = variants.reduce((sum, item) => sum + item.stock * item.costPrice, 0);
  const summary = (
    <Row gutter={[12, 12]}>
      <Col span={12}><Card size="small"><Statistic title="Products" value={products.length} /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="Variants / SKUs" value={variants.length} /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="Units in Stock" value={variants.reduce((sum, item) => sum + item.stock, 0)} /></Card></Col>
      <Col span={12}><Card size="small"><Statistic title="Inventory Value" value={inventoryValue} prefix="₹" precision={2} /></Card></Col>
    </Row>
  );
  const filters = (
    <Input allowClear value={searchText} onChange={event => setSearchText(event.target.value)} prefix={<SearchOutlined />} placeholder="Search product, variant, or SKU" />
  );

  return (
    <div style={{ padding: 24 }}>
      <div className="responsive-list-page-header">
        <div className="responsive-list-page-description">
          <Text type="secondary">A product owns the fragrance formula; each variant owns its SKU, fill size, packaging, and stock.</Text>
        </div>
        <div className="responsive-list-page-actions two-primary-actions">
          <PageDrawerControls title="Products & variants" summary={summary} filters={filters} activeFilterCount={searchText ? 1 : 0} onReset={() => setSearchText('')} />
          <Button icon={<AppstoreAddOutlined />} onClick={() => setProductModalOpen(true)}>New Product</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openVariantModal} disabled={!products.length}>New Variant</Button>
        </div>
      </div>

      <Row className="page-summary-inline" gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}><Card><Statistic title="Products" value={products.length} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Variants / SKUs" value={variants.length} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Units in Stock" value={variants.reduce((sum, item) => sum + item.stock, 0)} /></Card></Col>
        <Col xs={12} lg={6}><Card><Statistic title="Inventory Value" value={inventoryValue} prefix="₹" precision={2} /></Card></Col>
      </Row>

      <Card>
        <Input className="page-filter-inline"
          allowClear
          value={searchText}
          onChange={event => setSearchText(event.target.value)}
          prefix={<SearchOutlined />}
          placeholder="Search product, variant, or SKU"
          style={{ width: 320, maxWidth: '100%', marginBottom: 16 }}
        />
        <ResponsiveDataTable
          columns={columns}
          dataSource={filteredVariants}
          loading={loading}
          scroll={{ x: 1000 }}
          emptyText="No product variants found"
          mobileRenderItem={(variant) => {
            const status = variant.stock === 0 ? 'Out of Stock' : variant.stock <= variant.reorder ? 'Low Stock' : 'In Stock';
            return <>
              <div className="mobile-data-list__title-row"><strong>{variant.productName}</strong><Tag color={status === 'In Stock' ? 'success' : status === 'Low Stock' ? 'warning' : 'error'}>{status}</Tag></div>
              <span className="mobile-data-list__code">{variant.size} · {variant.sku || 'No SKU'}</span>
              <div className="mobile-data-list__metrics"><span>Stock <strong>{variant.stock} units</strong></span><span>Price <strong>₹{variant.sellingPrice.toLocaleString('en-IN')}</strong></span></div>
              <Button type="primary" block icon={<EditOutlined />} onClick={() => openEditVariant(variant)} style={{ marginTop: 12 }}>Edit Variant</Button>
            </>;
          }}
        />
      </Card>

      <Modal
        title="Create Product"
        open={productModalOpen}
        onCancel={() => setProductModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={productForm} layout="vertical" onFinish={createProduct}>
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="name" label="Product Name" rules={[{ required: true }]}>
                <Input placeholder="White Oud" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="code" label="Product Code">
                <Input placeholder="WO" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="formula_id" label="Fragrance Formula" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={formulas.filter(item => item.is_active).map(item => ({
                value: item.id,
                label: `${item.code} — ${item.name} (${Number(item.output_quantity)} ${item.output_unit})`
              }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setProductModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit">Create Product</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingVariant ? 'Edit Product Variant' : 'Create Product Variant'}
        open={variantModalOpen}
        onCancel={() => { setVariantModalOpen(false); setEditingVariant(null); variantForm.resetFields(); }}
        footer={null}
        width={720}
        className="variant-editor-modal"
        destroyOnHidden
      >
        <Form form={variantForm} layout="vertical" onFinish={createVariant}>
          <Form.Item name="product_id" label="Product" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={products.filter(item => item.is_active).map(item => ({
                value: item.id,
                label: `${item.name} — ${item.formula?.name || 'No formula'}`
              }))}
            />
          </Form.Item>
          <details style={{ marginBottom: 18, padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Advanced: use a different formula</summary>
            <Text type="secondary" style={{ display: 'block', margin: '8px 0 12px' }}>Leave empty to use the product's default formula. Choose an override only for variants such as EDP or Extrait.</Text>
            <Form.Item name="formula_id" label="Formula override" style={{ marginBottom: 4 }}>
              <Select
                allowClear
                placeholder="Use product default"
                options={formulas.filter(item => item.is_active).map(item => ({ value: item.id, label: `${item.code} — ${item.name}` }))}
              />
            </Form.Item>
          </details>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="size_label" label="Variant Label" rules={[{ required: true }]}>
                <Input placeholder="100ml" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="fill_quantity_ml" label="Fill Quantity (ml)" rules={[{ required: true }]}>
                <InputNumber min={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="sku" label="SKU">
                <Input placeholder="WO-100" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="name" label="Display Name (optional)">
            <Input placeholder="Defaults to Product Name + Variant Label" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={12} md={6}>
              <Form.Item name="cost_price" label="Cost Price" rules={[{ required: true }]}>
                <InputNumber min={0} prefix="₹" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="selling_price" label="Selling Price" rules={[{ required: true }]}>
                <InputNumber min={0} prefix="₹" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="current_stock" label="Opening Stock">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="reorder_level" label="Reorder Level">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" title="Packaging BOM per unit" style={{ marginBottom: 16 }}>
            <Form.List name="packaging">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(field => (
                    <Row gutter={12} key={field.key} align="middle">
                      <Col xs={24} sm={15}>
                        <Form.Item
                          {...field}
                          name={[field.name, 'packaging_material_id']}
                          rules={[{ required: true, message: 'Select packaging' }]}
                        >
                          <Select
                            placeholder="Bottle, cap, label, box..."
                            options={packagingMaterials.map(item => ({ value: item.id, label: `${item.name} (${item.sku})` }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={16} sm={6}>
                        <Form.Item
                          {...field}
                          name={[field.name, 'quantity']}
                          rules={[{ required: true }]}
                        >
                          <InputNumber min={0.0001} placeholder="Qty/unit" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={8} sm={3}>
                        <Form.Item>
                          <Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                        </Form.Item>
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ quantity: 1 })}>
                    Add Packaging Item
                  </Button>
                </>
              )}
            </Form.List>
          </Card>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setVariantModalOpen(false); setEditingVariant(null); variantForm.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit">{editingVariant ? 'Update Variant' : 'Create Variant'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
