import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'antd';
import {
  CloseOutlined,
  DownloadOutlined,
  ReloadOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './PWAStatus.css';

const INSTALL_DISMISS_KEY = 'wayon-pwa-install-dismissed-at';
const INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

const isInstalled = () => (
  window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true
);

const isIOSDevice = () => (
  /iPad|iPhone|iPod/i.test(window.navigator.userAgent)
  || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
);

export default function PWAStatus() {
  const [online, setOnline] = useState(window.navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installVisible, setInstallVisible] = useState(false);
  const [iosInstall] = useState(() => isIOSDevice() && !isInstalled());

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      console.error('Wayon service worker registration failed:', error);
    },
  });

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (iosInstall) {
      const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
      if (Date.now() - dismissedAt > INSTALL_DISMISS_MS) setInstallVisible(true);
    }

    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);

      const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY) || 0);
      if (!isInstalled() && Date.now() - dismissedAt > INSTALL_DISMISS_MS) {
        setInstallVisible(true);
      }
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstallVisible(false);
      localStorage.removeItem(INSTALL_DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [iosInstall]);

  const dismissInstall = useCallback(() => {
    setInstallVisible(false);
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
  }, []);

  const installApp = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallVisible(false);
    setInstallPrompt(null);
    if (outcome === 'dismissed') {
      localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    }
  }, [installPrompt]);

  const notice = useMemo(() => {
    if (!online) {
      return {
        key: 'offline',
        icon: <WifiOutlined />,
        title: 'You are offline',
        body: 'The app shell is available, but live ERP data and changes need a connection.',
      };
    }
    if (needRefresh) {
      return {
        key: 'update',
        icon: <ReloadOutlined />,
        title: 'Wayon update available',
        body: 'Save your work, then reload to use the latest version.',
      };
    }
    if (offlineReady) {
      return {
        key: 'ready',
        icon: <WifiOutlined />,
        title: 'Ready for unreliable connections',
        body: 'Wayon can now open its app shell without a connection.',
      };
    }
    if (installVisible && (installPrompt || iosInstall)) {
      return {
        key: 'install',
        icon: <DownloadOutlined />,
        title: 'Install Wayon',
        body: iosInstall
          ? 'In Safari, tap Share, then Add to Home Screen.'
          : 'Add Wayon to this device for faster, app-like access.',
      };
    }
    return null;
  }, [installPrompt, installVisible, iosInstall, needRefresh, offlineReady, online]);

  if (!notice) return null;

  const dismiss = () => {
    if (notice.key === 'update') setNeedRefresh(false);
    if (notice.key === 'ready') setOfflineReady(false);
    if (notice.key === 'install') dismissInstall();
  };

  return (
    <aside className={`pwa-notice pwa-notice--${notice.key}`} role="status" aria-live="polite">
      <span className="pwa-notice__icon" aria-hidden="true">{notice.icon}</span>
      <div className="pwa-notice__copy">
        <strong>{notice.title}</strong>
        <span>{notice.body}</span>
      </div>
      <div className="pwa-notice__actions">
        {notice.key === 'update' && (
          <Button type="primary" size="small" onClick={() => updateServiceWorker(true)}>
            Reload
          </Button>
        )}
        {notice.key === 'install' && installPrompt && (
          <Button type="primary" size="small" onClick={installApp}>
            Install
          </Button>
        )}
        {notice.key !== 'offline' && (
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={dismiss}
            aria-label="Dismiss"
          />
        )}
      </div>
    </aside>
  );
}
