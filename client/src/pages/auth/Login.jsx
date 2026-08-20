import React, { useContext } from 'react';
import { Form, Input, Button, Checkbox, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, CrownOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const { Title, Text } = Typography;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const onFinish = async (values) => {
    console.log('onFinish values submitted:', values);
    const hide = message.loading('Signing in...', 0);
    try {
      await login(values.email, values.password);
      hide();
      message.success('Sign in successful!');
      console.log('Login function completed, navigating to /app/dashboard');
      navigate('/app/dashboard');
    } catch (err) {
      hide();
      message.error('Sign in failed!');
      console.error('onFinish login error:', err);
    }
  };

  return (
    <div className="auth-container" style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--color-bg-primary)',
      overflow: 'hidden'
    }}>
      <style>
        {`
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
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '64px', 
            height: '64px', 
            borderRadius: '16px', 
            background: 'rgba(181, 66, 48, 0.15)', 
            border: '1px solid rgba(181, 66, 48, 0.3)', 
            marginBottom: '32px' 
          }}>
            <CrownOutlined style={{ fontSize: 32, color: '#fca390' }} />
          </div>
          <h1 style={{ color: '#ffffff', fontFamily: 'Playfair Display, Georgia, serif', fontSize: '38px', fontWeight: 600, margin: '0 0 16px 0', lineHeight: 1.2 }}>
            Perfume ERP
          </h1>
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
        padding: '40px 24px'
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Logo visible only on mobile */}
          <div className="mobile-logo-header" style={{ textAlign: 'center', marginBottom: 32 }}>
            <CrownOutlined style={{ fontSize: 40, color: 'var(--color-gold)' }} />
            <Title level={2} style={{ color: 'var(--color-text-primary)', fontFamily: 'Playfair Display', margin: '8px 0' }}>
              Perfume ERP
            </Title>
            <Text style={{ color: '#5c5c5e' }}>Manufacturing Excellence Platform</Text>
          </div>

          <div style={{ marginBottom: 32 }}>
            <Title level={2} style={{ color: 'var(--color-text-primary)', margin: '0 0 8px 0', fontWeight: 600 }}>
              Sign In
            </Title>
            <Text style={{ color: 'var(--color-text-secondary)' }}>
              Enter your credentials to access your workspace
            </Text>
          </div>

          <Form 
            layout="vertical" 
            requiredMark={false} 
            onFinish={onFinish}
          >
            <Form.Item 
              label={<Text style={{ color: '#5c5c5e' }}>Email</Text>} 
              name="email"
              rules={[{ required: true, message: 'Please input your email!' }]}
            >
              <Input 
                prefix={<UserOutlined style={{ color: '#8e8e93' }} />} 
                placeholder="admin@perfume.com" 
                size="large"
                style={{ background: '#ffffff', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </Form.Item>

            <Form.Item 
              label={<Text style={{ color: '#5c5c5e' }}>Password</Text>} 
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password 
                prefix={<LockOutlined style={{ color: '#8e8e93' }} />} 
                placeholder="••••••••" 
                size="large"
                style={{ background: '#ffffff', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </Form.Item>

            <Form.Item>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Checkbox style={{ color: '#5c5c5e' }}>Remember me</Checkbox>
                <Link to="/forgot-password" style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>Forgot Password?</Link>
              </div>
            </Form.Item>

            <Form.Item>
              <Button type="primary" size="large" block htmlType="submit">
                Sign In
              </Button>
            </Form.Item>

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Text style={{ color: '#5c5c5e' }}>Don't have an account? </Text>
              <Link to="/register" style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Create an account</Link>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}