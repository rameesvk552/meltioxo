import React from 'react';
import { Alert, Button, Card, Form, Input, Switch, Typography, message } from 'antd';
import { LockOutlined, SaveOutlined } from '@ant-design/icons';
import client from '../../api/client';
import useApiData from '../../hooks/useApiData';

export default function WhatsAppInvoiceSettings({ canManage }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = React.useState(false);
  const { data: settings, loading, reload } = useApiData('/tenant/settings', { initialData: {} });

  React.useEffect(() => {
    form.setFieldsValue({
      autoSend: Boolean(settings.whatsapp_invoice_auto_send),
      apiUrl: settings.whatsapp_invoice_api_url || 'https://travelbot.wayon.in/api/public/v1/whatsapp/messages',
      templateName: settings.whatsapp_invoice_template || 'rental_invoice_5',
      apiToken: '',
    });
  }, [form, settings]);

  const save = async values => {
    try {
      setSaving(true);
      await client.put('/tenant/whatsapp-invoice-settings', {
        auto_send: values.autoSend,
        api_url: values.apiUrl,
        template_name: values.templateName,
        ...(values.apiToken?.trim() ? { api_token: values.apiToken.trim() } : {}),
      });
      form.setFieldValue('apiToken', '');
      await reload();
      message.success('WhatsApp invoice delivery settings saved.');
    } catch (error) {
      message.error(error.response?.data?.message || 'Could not save WhatsApp invoice settings.');
    } finally { setSaving(false); }
  };

  return (
    <Card loading={loading} title="Automatic invoice delivery" style={{ marginTop: 16 }}>
      <Typography.Paragraph type="secondary">
        Send the PDF invoice automatically after each new sale. The API token is encrypted for this company and is never shown again after saving.
      </Typography.Paragraph>
      {!canManage && <Alert type="info" showIcon message="Only administrators can change the invoice delivery settings." />}
      <Form form={form} layout="vertical" onFinish={save} disabled={!canManage}>
        <Form.Item name="autoSend" label="Automatically send new invoices" valuePropName="checked"><Switch /></Form.Item>
        <Form.Item name="apiUrl" label="WhatsApp API URL" rules={[{ required: true, type: 'url', message: 'Enter the HTTPS API URL' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="templateName" label="Template name" rules={[{ required: true, whitespace: true }]}>
          <Input placeholder="rental_invoice_5" />
        </Form.Item>
        <Form.Item name="apiToken" label="API token" extra={settings.whatsapp_invoice_token_configured ? 'A token is already saved. Paste a new one only to replace it.' : 'Paste this company’s Travel Bot API token.'}>
          <Input.Password prefix={<LockOutlined />} autoComplete="new-password" placeholder={settings.whatsapp_invoice_token_configured ? 'Saved securely' : 'Paste API token'} />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>Save invoice delivery</Button>
      </Form>
    </Card>
  );
}
