import React, { useState, useContext } from 'react';
import { Form, Input, Button, Steps, Select, Typography, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import WayonLogo from '../../components/common/WayonLogo';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Option } = Select;

export default function Register() {
  const [current, setCurrent] = useState(0);
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const next = async () => {
    try {
      if (current === 0) {
        await form.validateFields(['companyName', 'companyEmail', 'phone']);
      } else if (current === 1) {
        await form.validateFields(['adminName', 'adminEmail', 'password']);
      }
      setCurrent(current + 1);
    } catch (error) {
      // Validation failed, errors will be shown by Ant Design
    }
  };

  const prev = () => setCurrent(current - 1);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await register({
        company_name: values.companyName,
        name: values.adminName,
        email: values.adminEmail,
        password: values.password,
        phone: values.phone,
        currency: values.currency,
        tax_system: values.taxSystem,
        fy_start_month: values.fyStart
      });
      message.success('Company created successfully!');
      navigate('/app/dashboard');
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.response?.data?.message || 'Could not create company');
    }
  };

  const inputStyle = { background: '#ffffff', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' };
  const labelStyle = { color: '#5c5c5e' };

  return (
    <div className="auth-container" style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--color-bg-primary)',
      overflow: 'hidden'
    }}>
      <style>
        {`
          .ant-steps-item-title { color: #8e8e93 !important; }
          .ant-steps-item-active .ant-steps-item-title { color: var(--color-text-primary) !important; }
          @media (max-width: 991px) {
            .auth-cover-pane {
              display: none !important;
            }
            .auth-form-pane {
              flex: 1 !important;
              width: 100% !important;
            }
            .mobile-logo-header {
              display: block !important;
            }
          }
          @media (min-width: 992px) {
            .mobile-logo-header {
              display: none !important;
            }
          }
        `}
      </style>

      {/* Left Pane - Premium Cover */}
      <div className="auth-cover-pane" style={{
        flex: '1.2',
        position: 'relative',
        background: 'radial-gradient(circle at 80% 20%, rgba(181, 66, 48, 0.18) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(181, 66, 48, 0.08) 0%, transparent 60%), #121214',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px',
        overflow: 'hidden'
      }}>
        {/* Glow decoration */}
        <div style={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'rgba(181, 66, 48, 0.12)',
          filter: 'blur(80px)',
          top: '10%',
          left: '10%',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'rgba(181, 66, 48, 0.06)',
          filter: 'blur(100px)',
          bottom: '10%',
          right: '10%',
          pointerEvents: 'none'
        }} />

        <div style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '480px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          padding: '48px',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.4)'
        }}>
          <WayonLogo inverse size={62} style={{ marginBottom: 24 }} />
          <p style={{ color: '#fca390', fontSize: '16px', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 24px 0' }}>
            Manufacturing Excellence
          </p>
          <p style={{ color: '#a1a1a6', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
            An enterprise suite meticulously crafted for modern fragrance houses. Seamlessly orchestrate inventory, formulas, production, and financials with bespoke precision.
          </p>
        </div>
      </div>

      {/* Right Pane - Form */}
      <div className="auth-form-pane" style={{
        flex: '1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        padding: '40px 24px',
        overflowY: 'auto'
      }}>
        <div style={{ width: '100%', maxWidth: 540 }}>
          {/* Logo visible only on mobile */}
          <div className="mobile-logo-header" style={{ textAlign: 'center', marginBottom: 32 }}>
            <WayonLogo size={50} />
            <Text style={{ color: '#5c5c5e', display: 'block', marginTop: 10 }}>Manufacturing Excellence Platform</Text>
          </div>

          <div style={{ marginBottom: 24 }}>
            <Title level={2} style={{ color: 'var(--color-text-primary)', margin: '0 0 8px 0', fontWeight: 600 }}>
              Create Account
            </Title>
            <Text style={{ color: 'var(--color-text-secondary)' }}>
              Set up your fragrance house on the platform
            </Text>
          </div>

          <Steps current={current} size="small" style={{ marginBottom: 32 }}>
            <Step title="Company" />
            <Step title="Admin" />
            <Step title="Preferences" />
          </Steps>

          <Form form={form} layout="vertical" initialValues={{ currency: 'INR', taxSystem: 'GST', fyStart: 4 }}>
            <div style={{ display: current === 0 ? 'block' : 'none' }}>
              <Form.Item name="companyName" label={<Text style={labelStyle}>Company Name</Text>} rules={[{ required: true }]}>
                <Input size="large" style={inputStyle} placeholder="Perfume Co." />
              </Form.Item>
              <Form.Item name="companyEmail" label={<Text style={labelStyle}>Company Email</Text>} rules={[{ type: 'email' }]}>
                <Input size="large" style={inputStyle} placeholder="contact@perfumeco.com" />
              </Form.Item>
              <Form.Item name="phone" label={<Text style={labelStyle}>Phone Number</Text>}>
                <Input size="large" style={inputStyle} placeholder="+1 234 567 890" />
              </Form.Item>
            </div>

            <div style={{ display: current === 1 ? 'block' : 'none' }}>
              <Form.Item name="adminName" label={<Text style={labelStyle}>Admin Name</Text>} rules={[{ required: true }]}>
                <Input size="large" style={inputStyle} placeholder="John Doe" />
              </Form.Item>
              <Form.Item name="adminEmail" label={<Text style={labelStyle}>Admin Email</Text>} rules={[{ required: true }, { type: 'email' }]}>
                <Input size="large" style={inputStyle} placeholder="john@perfumeco.com" />
              </Form.Item>
              <Form.Item name="password" label={<Text style={labelStyle}>Password</Text>} rules={[{ required: true }, { min: 8 }]}>
                <Input.Password size="large" style={inputStyle} placeholder="••••••••" />
              </Form.Item>
            </div>

            <div style={{ display: current === 2 ? 'block' : 'none' }}>
              <Form.Item name="currency" label={<Text style={labelStyle}>Currency</Text>}>
                <Select size="large">
                  <Option value="INR">INR (₹)</Option>
                  <Option value="USD">USD ($)</Option>
                  <Option value="EUR">EUR (€)</Option>
                </Select>
              </Form.Item>
              <Form.Item name="taxSystem" label={<Text style={labelStyle}>Tax System</Text>}>
                <Select size="large">
                  <Option value="GST">GST</Option>
                  <Option value="VAT">VAT</Option>
                  <Option value="None">None</Option>
                </Select>
              </Form.Item>
              <Form.Item name="fyStart" label={<Text style={labelStyle}>Financial Year Start</Text>}>
                <Select size="large">
                  <Option value={4}>April</Option>
                  <Option value={1}>January</Option>
                </Select>
              </Form.Item>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
              {current > 0 ? (
                <Button onClick={prev} size="large" style={{ background: 'transparent', color: 'var(--color-gold)', borderColor: 'var(--color-gold)' }}>
                  Previous
                </Button>
              ) : <div/>}
              
              {current < 2 && (
                <Button onClick={next} size="large" type="primary">
                  Next
                </Button>
              )}
              
              {current === 2 && (
                <Button onClick={handleCreate} size="large" type="primary">
                  Create Company
                </Button>
              )}
            </div>
          </Form>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Text style={{ color: '#8e8e93' }}>Already have an account? </Text>
            <Link to="/login" style={{ color: 'var(--color-gold)', fontWeight: 600 }}>Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
