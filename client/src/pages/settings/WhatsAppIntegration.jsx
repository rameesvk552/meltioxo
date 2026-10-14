import React from 'react';
import { Alert, Button, Card, Empty, Modal, Space, Steps, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, LinkOutlined, PlusOutlined, ReloadOutlined, WhatsAppOutlined } from '@ant-design/icons';
import client from '../../api/client';

const FACEBOOK_ORIGINS = ['https://www.facebook.com', 'https://web.facebook.com'];

const loadFacebookSdk = appId => new Promise((resolve, reject) => {
  if (!appId) return reject(new Error('Facebook app ID is missing.'));
  if (window.FB) {
    window.FB.init({ appId, cookie: true, xfbml: true, version: 'v25.0' });
    return resolve(window.FB);
  }
  window.fbAsyncInit = () => {
    window.FB.init({ appId, cookie: true, xfbml: true, version: 'v25.0' });
    resolve(window.FB);
  };
  if (document.getElementById('facebook-jssdk')) return;
  const script = document.createElement('script');
  script.id = 'facebook-jssdk';
  script.src = 'https://connect.facebook.net/en_US/sdk.js';
  script.async = true;
  script.defer = true;
  script.crossOrigin = 'anonymous';
  script.onerror = () => reject(new Error('Failed to load the Facebook SDK.'));
  document.body.appendChild(script);
});

const runEmbeddedSignup = embeddedSignup => loadFacebookSdk(embeddedSignup.appId).then(FB => new Promise((resolve, reject) => {
  let sessionInfo = null;
  let settled = false;
  const cleanup = () => window.removeEventListener('message', listener);
  const finish = value => { if (!settled) { settled = true; cleanup(); resolve(value); } };
  const fail = error => { if (!settled) { settled = true; cleanup(); reject(error); } };
  const listener = event => {
    if (!FACEBOOK_ORIGINS.includes(event.origin)) return;
    let data = event.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return; }
    }
    if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
    if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') sessionInfo = data.data || null;
    if (data.event === 'ERROR') fail(new Error(data.data?.error_message || 'Facebook embedded signup failed.'));
    if (data.event === 'CANCEL') fail(new Error('Facebook signup was cancelled before completion.'));
  };
  window.addEventListener('message', listener);

  const extras = {
    feature: 'whatsapp_embedded_signup',
    sessionInfoVersion: embeddedSignup.sessionInfoVersion || '3',
    version: 'v3',
    setup: {},
  };
  if (embeddedSignup.featureType) extras.featureType = embeddedSignup.featureType;
  const options = {
    scope: 'whatsapp_business_management,whatsapp_business_messaging',
    response_type: 'code',
    override_default_response_type: true,
    extras,
  };
  if (embeddedSignup.configId) options.config_id = embeddedSignup.configId;

  FB.login(response => {
    const code = response?.authResponse?.code;
    if (!code) return fail(new Error('Facebook signup was cancelled or returned no authorization code.'));
    finish({ code, sessionInfo });
  }, options);
}));

const statusColor = status => ({ CONNECTED: 'success', PENDING: 'warning', FAILED: 'error' }[status] || 'default');
const errorText = error => error.response?.data?.message || error.message || 'WhatsApp connection failed.';

export default function WhatsAppIntegration({ canManage }) {
  const [connection, setConnection] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState('coexistence');
  const [flowOpen, setFlowOpen] = React.useState(false);
  const [flowStep, setFlowStep] = React.useState('idle');
  const [flowError, setFlowError] = React.useState('');

  const refresh = React.useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true);
      const response = await client.get('/tenant/whatsapp-connection');
      setConnection(response.data.data);
    } catch (error) {
      message.error(errorText(error));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  const connect = async selectedMode => {
    setMode(selectedMode);
    setBusy(true);
    setFlowOpen(true);
    setFlowStep('handshake');
    setFlowError('');
    try {
      const startResponse = await client.post('/tenant/whatsapp-connection/connect', {
        provider: 'MARKETING_OS',
        onboardingMode: selectedMode,
      });
      const setup = startResponse.data.data;
      if (!setup?.embeddedSignup?.appId) throw new Error('Marketing OS returned no Embedded Signup configuration.');
      setConnection(setup);
      setFlowStep('meta');
      const { code, sessionInfo } = await runEmbeddedSignup(setup.embeddedSignup);
      setFlowStep('sync');
      const completeResponse = await client.post('/tenant/whatsapp-connection/complete', {
        code,
        sessionToken: setup.sessionToken || setup.embeddedSignup.sessionToken,
        sessionInfo,
        phoneNumberId: sessionInfo?.phone_number_id,
        wabaId: sessionInfo?.waba_id,
        businessId: sessionInfo?.business_id,
      });
      setConnection(completeResponse.data.data);
      setFlowStep('connected');
      message.success('WhatsApp connected successfully through Marketing OS.');
    } catch (error) {
      const text = errorText(error);
      setFlowError(text);
      setFlowStep('error');
      message.error(text);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = channel => Modal.confirm({
    title: 'Disconnect WhatsApp number?',
    content: `${channel.displayPhoneNumber || channel.label || 'This number'} will be removed from Marketing OS. Another connected number will become the default when available.`,
    okText: 'Disconnect',
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        const response = await client.delete(`/tenant/whatsapp-channels/${encodeURIComponent(channel.id)}`);
        setConnection(response.data.data);
        message.success('WhatsApp number disconnected.');
      } catch (error) {
        message.error(errorText(error));
        throw error;
      }
    },
  });

  const channels = connection?.channels || [];
  const activeStep = flowStep === 'handshake' ? 0 : flowStep === 'meta' ? 1 : flowStep === 'sync' ? 2 : 3;
  const stepStatus = flowStep === 'error' ? 'error' : flowStep === 'connected' ? 'finish' : 'process';

  return (
    <div>
      {connection?.syncWarning && <Alert type="warning" showIcon message={connection.syncWarning} style={{ marginBottom: 16 }} />}
      {connection?.errorMessage && connection.status === 'FAILED' && <Alert type="error" showIcon message={connection.errorMessage} style={{ marginBottom: 16 }} />}

      <Card loading={loading} title={<Space><WhatsAppOutlined style={{ color: '#25D366' }} />WhatsApp Channels</Space>} extra={<Tag>{channels.length} connected</Tag>}>
        <Typography.Paragraph type="secondary">
          Connect WhatsApp through Marketing OS using the same Meta Embedded Signup flow as Travel Bot.
        </Typography.Paragraph>

        <Space wrap style={{ marginBottom: 20 }}>
          <Button type="primary" icon={<PlusOutlined />} loading={busy && mode === 'coexistence'} disabled={!canManage || busy} onClick={() => connect('coexistence')}>
            Add Business App Number
          </Button>
          <Button icon={<LinkOutlined />} loading={busy && mode === 'standard'} disabled={!canManage || busy} onClick={() => connect('standard')}>
            Add Cloud API Number
          </Button>
          <Button icon={<ReloadOutlined />} disabled={loading || busy} onClick={() => refresh()}>Refresh channels</Button>
        </Space>

        {!canManage && <Alert type="info" showIcon message="Only administrators can connect or disconnect WhatsApp numbers." style={{ marginBottom: 16 }} />}

        {channels.length ? (
          <div style={{ display: 'grid', gap: 12 }}>
            {channels.map(channel => (
              <Card key={channel.id} size="small" styles={{ body: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 } }}>
                <div style={{ minWidth: 0 }}>
                  <Space wrap>
                    <Typography.Text strong>{channel.label || channel.displayPhoneNumber || 'WhatsApp Number'}</Typography.Text>
                    <Tag color={statusColor(channel.status)}>{channel.status}</Tag>
                    {channel.isDefault && <Tag color="blue">Default</Tag>}
                  </Space>
                  <div style={{ marginTop: 8 }}><Typography.Text>{channel.displayPhoneNumber || 'Number pending provider sync'}</Typography.Text></div>
                  <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Meta Phone Number ID: {channel.phoneNumberId || 'Waiting for provider sync'}</Typography.Text>
                  <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Provider: {channel.provider} · Mode: {channel.onboardingMode}</Typography.Text>
                  {channel.coexistence?.enabled && (
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Contacts: {channel.coexistence.contactSyncStatus} · History: {channel.coexistence.historySyncStatus}
                    </Typography.Text>
                  )}
                  {channel.errorMessage && <Typography.Text type="danger" style={{ display: 'block', marginTop: 4 }}>{channel.errorMessage}</Typography.Text>}
                </div>
                {canManage && <Button danger type="text" icon={<DeleteOutlined />} disabled={busy} onClick={() => disconnect(channel)} aria-label="Disconnect WhatsApp number" />}
              </Card>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No WhatsApp numbers connected yet" />
        )}

        <Alert
          type="info"
          showIcon
          style={{ marginTop: 20 }}
          message="Business App vs Cloud API"
          description="Business App keeps an existing WhatsApp Business app number in coexistence and starts contact/history sync. Cloud API onboards a number managed directly by Marketing OS."
        />
      </Card>

      <Modal
        title={mode === 'coexistence' ? 'Business app coexistence' : 'Cloud API onboarding'}
        open={flowOpen}
        closable={!busy}
        maskClosable={!busy}
        footer={flowStep === 'connected' || flowStep === 'error' ? <Button type="primary" onClick={() => setFlowOpen(false)}>Close</Button> : null}
        onCancel={() => !busy && setFlowOpen(false)}
      >
        <Typography.Paragraph type="secondary">
          {mode === 'coexistence'
            ? 'Use this for an existing WhatsApp Business app number. Complete Meta approval and the verification step in the Business app.'
            : 'Select the business phone number that Marketing OS should manage through WhatsApp Cloud API.'}
        </Typography.Paragraph>
        <Steps
          direction="vertical"
          current={activeStep}
          status={stepStatus}
          items={[
            { title: 'Handshake with Marketing OS' },
            { title: mode === 'coexistence' ? 'Meta Business app connection' : 'Meta Cloud API connection' },
            { title: mode === 'coexistence' ? 'Sync contacts and history' : 'Save phone configuration' },
          ]}
        />
        {flowStep === 'connected' && <Alert type="success" showIcon icon={<CheckCircleOutlined />} message={mode === 'coexistence' ? 'WhatsApp Business app coexistence is active.' : 'WhatsApp Cloud API connection is active.'} />}
        {flowError && <Alert type="error" showIcon message={flowError} />}
      </Modal>
    </div>
  );
}
