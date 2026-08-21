import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
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
import './ProductsAndVariants.css';

const { Text } = Typography;
const EMPTY_LIST = [];

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;

const outputNeededPerVariant = (formula, fillQuantityMl) => {
  const outputUnit = String(formula?.output_unit || '').trim().toLowerCase();
  if (['pcs', 'pc', 'unit', 'units'].includes(outputUnit)) return 1;
  if (!Number.isFinite(fillQuantityMl) || fillQuantityMl <= 0) return null;
  if (['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'].includes(outputUnit)) return fillQuantityMl;
  if (['l', 'litre', 'litres', 'liter', 'liters'].includes(outputUnit)) return fillQuantityMl / 1000;
  return null;
};

export default function ProductsAndVariants() {
  const { data: variantData, loading, reload: reloadVariants } = useApiData('/finished-goods');
  const { data: products, reload: reloadProducts } = useApiData('/products');
  const { data: formulas, reload: reloadFormulas } = useApiData('/formulas');
  const { data: rawMaterials } = useApiData('/raw-materials');
  const { data: packagingMaterials } = useApiData('/packaging-materials');
  const [searchText, setSearchText] = useState('');
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [productForm] = Form.useForm();
  const [variantForm] = Form.useForm();
  const [formulaForm] = Form.useForm();
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [savingFormula, setSavingFormula] = useState(false);
  const selectedProductSourceType = Form.useWatch('source_type', productForm) || 'live_make';
  const isReadyMadeProduct = selectedProductSourceType === 'ready_made';
  const selectedProductId = Form.useWatch('product_id', variantForm);
  const selectedFormulaId = Form.useWatch('formula_id', variantForm);
  const fillQuantityMl = Form.useWatch('fill_quantity_ml', variantForm);
  const selectedSourceType = Form.useWatch('source_type', variantForm) || 'live_make';
  const isReadyMade = selectedSourceType === 'ready_made';
  const selectedPackaging = Form.useWatch('packaging', variantForm) || EMPTY_LIST;
  const [formulaCost, setFormulaCost] = useState(null);
  const [formulaCostLoading, setFormulaCostLoading] = useState(false);
  const [formulaCostError, setFormulaCostError] = useState('');
  usePageTitle('Products & Variants');

  const selectedProduct = products.find(item => item.id === selectedProductId);
  const selectedFormula = formulas.find(item => item.id === selectedFormulaId);
  const effectiveFormulaId = selectedFormulaId || selectedProduct?.formula_id;
  const effectiveFormula = selectedFormula
    || formulas.find(item => item.id === effectiveFormulaId)
    || selectedProduct?.formula;
  const formulaOutputQuantity = Number(effectiveFormula?.output_quantity || 0);
  const requiredFormulaOutput = outputNeededPerVariant(effectiveFormula, Number(fillQuantityMl));
  const variantFormulaScale = formulaOutputQuantity > 0 && requiredFormulaOutput !== null
    ? requiredFormulaOutput / formulaOutputQuantity
    : 0;
  const scaledIngredients = (effectiveFormula?.formulaIngredients || []).map(ingredient => {
    const material = rawMaterials.find(item => item.id === ingredient.raw_material_id);
    return {
      id: ingredient.id || ingredient.raw_material_id,
      name: material?.name || 'Raw material',
      unit: ingredient.unit || material?.unit || '',
      quantity: Number(ingredient.quantity || 0) * variantFormulaScale
    };
  });

  useEffect(() => {
    if (!variantModalOpen || !effectiveFormulaId || isReadyMade) {
      setFormulaCost(null);
      setFormulaCostError('');
      setFormulaCostLoading(false);
      return undefined;
    }

    let active = true;
    setFormulaCostLoading(true);
    setFormulaCostError('');
    client.get(`/formulas/${effectiveFormulaId}/cost`)
      .then(response => {
        if (active) setFormulaCost({ formulaId: effectiveFormulaId, ...response.data });
      })
      .catch(error => {
        if (!active) return;
        setFormulaCost(null);
        setFormulaCostError(error.response?.data?.message || 'Could not calculate formula cost.');
      })
      .finally(() => {
        if (active) setFormulaCostLoading(false);
      });

    return () => { active = false; };
  }, [effectiveFormulaId, isReadyMade, variantModalOpen]);

  const costBreakdown = useMemo(() => {
    if (!effectiveFormula || formulaCost?.formulaId !== effectiveFormulaId) return null;
    const outputQuantity = Number(effectiveFormula.output_quantity);
    const requiredOutput = outputNeededPerVariant(effectiveFormula, Number(fillQuantityMl));
    if (!Number.isFinite(outputQuantity) || outputQuantity <= 0 || requiredOutput === null) return null;

    const rawMaterialCost = Number(formulaCost.raw_material_cost || 0) * (requiredOutput / outputQuantity);
    const packagingCost = selectedPackaging.reduce((sum, row) => {
      const material = packagingMaterials.find(item => item.id === row?.packaging_material_id);
      return sum + (Number(row?.quantity || 0) * Number(material?.avg_cost || 0));
    }, 0);

    return {
      rawMaterialCost,
      packagingCost,
      totalCost: rawMaterialCost + packagingCost
    };
  }, [effectiveFormula, effectiveFormulaId, fillQuantityMl, formulaCost, packagingMaterials, selectedPackaging]);

  useEffect(() => {
    if (!variantModalOpen || isReadyMade) return;
    variantForm.setFieldValue(
      'cost_price',
      costBreakdown ? Number(costBreakdown.totalCost.toFixed(2)) : undefined
    );
  }, [costBreakdown, isReadyMade, variantForm, variantModalOpen]);

  const variants = useMemo(() => variantData.map(item => ({
    ...item,
    productName: item.product?.name || 'Legacy product',
    sourceType: item.source_type || 'live_make',
    formulaName: item.source_type === 'ready_made' ? 'Not required' : item.formula?.name || item.product?.formula?.name || '—',
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
      const payload = {
        ...values,
        source_type: values.source_type || 'live_make',
        formula_id: values.source_type === 'ready_made' ? null : values.formula_id || null
      };
      if (editingProduct) await client.put(`/products/${editingProduct.id}`, payload);
      else await client.post('/products', payload);
      await Promise.all([reloadProducts(), reloadVariants()]);
      productForm.resetFields();
      setProductModalOpen(false);
      setEditingProduct(null);
      message.success(editingProduct ? 'Product updated successfully.' : 'Product created. You can now add its variants.');
    } catch (error) {
      message.error(error.response?.data?.message || `Could not ${editingProduct ? 'update' : 'create'} product`);
    }
  };

  const openCreateProduct = () => {
    setEditingProduct(null);
    productForm.resetFields();
    productForm.setFieldsValue({ source_type: 'live_make' });
    setProductModalOpen(true);
  };

  const openEditProduct = productId => {
    const product = products.find(item => item.id === productId);
    if (!product) return message.error('Product not found');
    setEditingProduct(product);
    productForm.setFieldsValue({
      name: product.name,
      code: product.code,
      source_type: product.source_type || 'live_make',
      formula_id: product.formula_id || null,
      description: product.description
    });
    setProductModalOpen(true);
  };

  const selectProductFormula = formulaId => {
    productForm.setFieldValue('formula_id', formulaId);
    void productForm.validateFields(['formula_id']).catch(() => undefined);
  };

  const openFormulaModal = () => {
    formulaForm.resetFields();
    formulaForm.setFieldsValue({
      version: 1,
      output_quantity: 100,
      output_unit: 'L',
      ingredients: [{ raw_material_id: undefined, quantity: 1 }]
    });
    setFormulaModalOpen(true);
  };

  const createFormulaForProduct = async values => {
    setSavingFormula(true);
    try {
      const { data: created } = await client.post('/formulas', {
        code: values.code?.trim() || undefined,
        name: values.name.trim(),
        version: Number(values.version || 1),
        description: values.description?.trim() || undefined,
        output_quantity: Number(values.output_quantity),
        output_unit: values.output_unit,
        ingredients: values.ingredients.map(row => ({
          raw_material_id: row.raw_material_id,
          quantity: Number(row.quantity),
          unit: rawMaterials.find(material => material.id === row.raw_material_id)?.unit || 'kg'
        }))
      });
      await reloadFormulas();
      selectProductFormula(created.id);
      setFormulaModalOpen(false);
      formulaForm.resetFields();
      message.success('Formula created and selected for this product.');
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not create the formula.');
    } finally {
      setSavingFormula(false);
    }
  };

  const createVariant = async values => {
    try {
      const payload = {
        product_id: values.product_id,
        source_type: values.source_type || 'live_make',
        formula_id: values.source_type === 'ready_made' ? null : values.formula_id || null,
        name: values.name || undefined,
        sku: values.sku || undefined,
        size_label: values.size_label,
        fill_quantity_ml: values.source_type === 'ready_made' ? null : values.fill_quantity_ml,
        selling_price: values.selling_price,
        cost_price: values.cost_price,
        ...(!editingVariant ? { current_stock: values.current_stock || 0 } : {}),
        reorder_level: values.reorder_level || 0,
        packaging: values.source_type === 'ready_made' ? [] : values.packaging || []
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
      source_type: 'live_make',
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
      source_type: variant.sourceType,
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
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{row.sourceType === 'ready_made' ? 'Purchased finished product' : `${row.formulaName}${row.formulaOverride ? ' · Variant override' : ' · Product default'}`}</Text>
        </div>
      )
    },
    {
      title: 'Variant',
      key: 'variant',
      render: (_, row) => (
        <div>
          <Text>{row.size}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{row.sourceType === 'ready_made' ? 'Supplier stock' : `${row.fillMl} ml fill`}</Text>
        </div>
      )
    },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Packaging BOM', dataIndex: 'packagingCount', key: 'packagingCount', render: (value, row) => row.sourceType === 'ready_made' ? 'Not required' : `${value} items` },
    { title: 'Source', key: 'source', render: (_, row) => row.sourceType === 'ready_made' ? <Tag color="blue">Ready-made</Tag> : <Tag color={row.readyToMake ? 'success' : 'warning'}>{row.readyToMake ? 'Make live' : 'Incomplete live setup'}</Tag> },
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
    , { title: 'Actions', key: 'actions', render: (_, row) => <Space size="small"><Button type="text" icon={<AppstoreAddOutlined />} onClick={() => openEditProduct(row.product_id)}>Product</Button><Button type="text" icon={<EditOutlined />} onClick={() => openEditVariant(row)}>Variant</Button></Space> }
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
          <Text type="secondary">Variants can be made live from a formula or purchased ready-made from a supplier.</Text>
        </div>
        <div className="responsive-list-page-actions two-primary-actions">
          <PageDrawerControls title="Products & variants" summary={summary} filters={filters} activeFilterCount={searchText ? 1 : 0} onReset={() => setSearchText('')} />
          <Button icon={<AppstoreAddOutlined />} onClick={openCreateProduct}>New Product</Button>
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
              <span className="mobile-data-list__code">{variant.sourceType === 'ready_made' ? 'Ready-made · Purchased from supplier' : `Formula: ${variant.formulaName}${variant.formulaOverride ? ' · Override' : ' · Product default'}`}</span>
              <div className="mobile-data-list__metrics"><span>Stock <strong>{variant.stock} units</strong></span><span>Price <strong>₹{variant.sellingPrice.toLocaleString('en-IN')}</strong></span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <Button icon={<AppstoreAddOutlined />} onClick={() => openEditProduct(variant.product_id)}>Edit Product</Button>
                <Button type="primary" icon={<EditOutlined />} onClick={() => openEditVariant(variant)}>Edit Variant</Button>
              </div>
            </>;
          }}
        />
      </Card>

      <Modal
        title={editingProduct ? 'Edit Product' : 'Create Product'}
        open={productModalOpen}
        onCancel={() => { setProductModalOpen(false); setEditingProduct(null); productForm.resetFields(); }}
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
          <Form.Item name="source_type" label="How is this product supplied?" rules={[{ required: true }]}>
            <Segmented
              block
              options={[
                { value: 'live_make', label: 'Make live' },
                { value: 'ready_made', label: 'Ready-made purchase' }
              ]}
              onChange={value => {
                if (value === 'ready_made') productForm.setFieldValue('formula_id', null);
              }}
            />
          </Form.Item>
          {isReadyMadeProduct && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="No formula required"
              description="This product is purchased from a supplier as finished stock. Add its cost and selling details when you create the variant."
            />
          )}
          {!isReadyMadeProduct && <Form.Item label="Default Formula" extra="Optional. Variants can also select their own formula.">
            <Space.Compact block>
              <Form.Item name="formula_id" noStyle>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select a formula"
                  onChange={selectProductFormula}
                  options={formulas.filter(item => item.is_active).map(item => ({
                    value: item.id,
                    label: `${item.code} — ${item.name} (${Number(item.output_quantity)} ${item.output_unit})`
                  }))}
                />
              </Form.Item>
              <Button htmlType="button" icon={<PlusOutlined />} onClick={openFormulaModal}>New formula</Button>
            </Space.Compact>
          </Form.Item>}
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setProductModalOpen(false); setEditingProduct(null); productForm.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit">{editingProduct ? 'Update Product' : 'Create Product'}</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Create Formula for Product"
        open={formulaModalOpen}
        onCancel={() => { setFormulaModalOpen(false); formulaForm.resetFields(); }}
        onOk={() => formulaForm.submit()}
        okText="Create & Select"
        confirmLoading={savingFormula}
        width={680}
        destroyOnHidden
      >
        <Form form={formulaForm} layout="vertical" onFinish={createFormulaForProduct}>
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item name="name" label="Formula Name" rules={[{ required: true, whitespace: true, message: 'Enter a formula name' }]}>
                <Input placeholder="e.g. Midnight Oud Eau de Parfum" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="code" label="Formula Code" extra="Auto-generated if blank">
                <Input placeholder="FORM-001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12} sm={9}>
              <Form.Item name="output_quantity" label="Batch Output" rules={[{ required: true, message: 'Enter the output quantity' }]}>
                <InputNumber min={0.001} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={9}>
              <Form.Item name="output_unit" label="Output Unit" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'L', label: 'Litres (L)' },
                  { value: 'ml', label: 'Millilitres (ml)' },
                  { value: 'kg', label: 'Kilograms (kg)' },
                  { value: 'pcs', label: 'Units (pcs)' }
                ]} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="version" label="Version" rules={[{ required: true }]}>
                <InputNumber min={1} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.List name="ingredients">
            {(fields, { add, remove }) => <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong>Formula Ingredients</Text>
                <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => add({ quantity: 1 })}>Add ingredient</Button>
              </div>
              {fields.map((field, index) => <Row gutter={10} key={field.key} align="middle">
                <Col xs={24} sm={15}>
                  <Form.Item {...field} name={[field.name, 'raw_material_id']} label={index === 0 ? 'Raw Material' : undefined} rules={[{ required: true, message: 'Select a raw material' }]}>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="Select raw material"
                      options={rawMaterials.map(material => ({ value: material.id, label: `${material.name} (${material.unit})` }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={19} sm={7}>
                  <Form.Item {...field} name={[field.name, 'quantity']} label={index === 0 ? 'Quantity' : undefined} rules={[{ required: true, message: 'Enter a quantity' }]}>
                    <InputNumber min={0.001} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={5} sm={2} style={{ paddingTop: index === 0 ? 22 : 0 }}>
                  <Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove ingredient" disabled={fields.length === 1} onClick={() => remove(field.name)} />
                </Col>
              </Row>)}
            </>}
          </Form.List>

          <Form.Item name="description" label="Description" style={{ marginBottom: 8 }}>
            <Input.TextArea rows={2} placeholder="Formula notes or mixing instructions" />
          </Form.Item>
          <Text type="secondary">Packaging is configured separately for each product variant.</Text>
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
          <Form.Item name="source_type" label="How is this variant supplied?" rules={[{ required: true }]}>
            <Segmented
              block
              options={[
                { value: 'live_make', label: 'Make live' },
                { value: 'ready_made', label: 'Ready-made purchase' }
              ]}
              onChange={value => {
                if (value === 'ready_made') variantForm.setFieldsValue({ formula_id: null, fill_quantity_ml: null, packaging: [] });
              }}
            />
          </Form.Item>
          {isReadyMade && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="Purchased as a finished product"
              description="This variant appears under Ready-made product in Purchases. Sales always use its finished stock automatically."
            />
          )}
          <Form.Item name="product_id" label="Product" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              onChange={productId => {
                const product = products.find(item => item.id === productId);
                const sourceType = product?.source_type || 'live_make';
                variantForm.setFieldsValue({
                  source_type: sourceType,
                  formula_id: null,
                  ...(sourceType === 'ready_made' ? { fill_quantity_ml: null, packaging: [] } : {})
                });
              }}
              options={products.filter(item => item.is_active).map(item => ({
                value: item.id,
                label: item.source_type === 'ready_made'
                  ? `${item.name} — Ready-made`
                  : `${item.name} — ${item.formula?.name || 'No formula'}`
              }))}
            />
          </Form.Item>
          {!isReadyMade && <Form.Item
            name="formula_id"
            label="Formula for this variant"
            extra={selectedFormula
              ? `Override: this variant will use ${selectedFormula.name} instead of the product default.`
              : selectedProduct?.formula
                ? `Product default: ${selectedProduct.formula.name}. Leave unchanged to inherit it.`
                : 'Select a product to see its default formula.'}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              disabled={!selectedProduct}
              placeholder={selectedProduct?.formula ? `Use product default — ${selectedProduct.formula.name}` : 'Select a product first'}
              options={formulas.filter(item => item.is_active && item.id !== selectedProduct?.formula_id).map(item => ({
                value: item.id,
                label: `${item.code} — ${item.name} (override)`
              }))}
            />
          </Form.Item>}
          <Row gutter={16}>
            <Col xs={24} md={isReadyMade ? 12 : 8}>
              <Form.Item name="size_label" label="Variant Label" rules={[{ required: true }]}>
                <Input placeholder="100ml" />
              </Form.Item>
            </Col>
            {!isReadyMade && <Col xs={24} md={8}>
              <Form.Item name="fill_quantity_ml" label="Fill Quantity (ml)" rules={[{ required: true }]}>
                <InputNumber min={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>}
            <Col xs={24} md={isReadyMade ? 12 : 8}>
              <Form.Item name="sku" label="SKU">
                <Input placeholder="WO-100" />
              </Form.Item>
            </Col>
          </Row>
          {!isReadyMade && effectiveFormula && Number(fillQuantityMl) > 0 && variantFormulaScale > 0 && (
            <Alert
              type="info"
              showIcon
              className="variant-formula-guide"
              message={`How the ${Number(fillQuantityMl)}ml variant works with ${effectiveFormula.name}`}
              description={(
                <div className="variant-formula-guide__body">
                  <p>
                    The selected formula produces <strong>{formulaOutputQuantity.toLocaleString()} {effectiveFormula.output_unit}</strong> per batch.
                    One {Number(fillQuantityMl)}ml unit uses <strong>{variantFormulaScale.toLocaleString(undefined, { maximumFractionDigits: 4 })}×</strong> of that recipe.
                  </p>
                  {scaledIngredients.length > 0 && (
                    <div className="variant-formula-guide__ingredients">
                      {scaledIngredients.map(ingredient => (
                        <span key={ingredient.id}><strong>{ingredient.name}:</strong> {ingredient.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })} {ingredient.unit}</span>
                      ))}
                    </div>
                  )}
                  <p><strong>Make Now:</strong> the quantities above are deducted for one unit; selling two units doubles every ingredient and packaging quantity.</p>
                  <p><strong>Packaging:</strong> each BOM quantity below is deducted per finished unit{selectedPackaging.length ? ` (${selectedPackaging.length} item${selectedPackaging.length === 1 ? '' : 's'} currently selected)` : ''}.</p>
                  <p><strong>Sell from Stock:</strong> only finished-product stock is reduced because its ingredients and packaging were already consumed during production.</p>
                </div>
              )}
            />
          )}
          <Form.Item name="name" label="Display Name (optional)">
            <Input placeholder="Defaults to Product Name + Variant Label" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={12} md={6}>
              <Form.Item
                name="cost_price"
                label="Cost Price"
                rules={[{ required: true }]}
                extra={isReadyMade ? 'Expected cost; purchases update it automatically.' : formulaCostLoading ? 'Calculating from formula and packaging…' : 'Calculated automatically per finished unit.'}
              >
                <InputNumber min={0} precision={2} prefix="₹" readOnly={!isReadyMade} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="selling_price" label="Selling Price" rules={[{ required: true }]}>
                <InputNumber min={0} prefix="₹" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="current_stock" label="Opening Stock">
                <InputNumber min={0} disabled={Boolean(editingVariant)} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="reorder_level" label="Reorder Level">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {!isReadyMade && <Card size="small" title="Packaging BOM per unit" style={{ marginBottom: 16 }}>
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
                            options={packagingMaterials.map(item => ({
                              value: item.id,
                              label: `${item.name} (${item.sku}) · ${money(item.avg_cost)} / ${item.unit || 'unit'}`
                            }))}
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
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'var(--color-bg-secondary)' }}>
              {formulaCostError ? (
                <Text type="danger">{formulaCostError}</Text>
              ) : costBreakdown ? (
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Formula raw materials</Text>
                    <Text>{money(costBreakdown.rawMaterialCost)}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">Packaging materials</Text>
                    <Text>{money(costBreakdown.packagingCost)}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text strong>Automatic cost price / unit</Text>
                    <Text strong style={{ color: 'var(--color-gold)' }}>{money(costBreakdown.totalCost)}</Text>
                  </div>
                </Space>
              ) : (
                <Text type="secondary">Select a product, enter the fill quantity, and add packaging to calculate the unit cost.</Text>
              )}
            </div>
          </Card>}

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
