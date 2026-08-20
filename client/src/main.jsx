import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import App from './App';
import './styles/design-system.css';
import './styles/global.css';
import { antdTheme } from './theme/antdTheme';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider theme={antdTheme}>
        <NotificationProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </NotificationProvider>
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);