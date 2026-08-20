import React, { createContext } from 'react';
import { message, notification } from 'antd';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [notificationApi, notifContextHolder] = notification.useNotification();

  const showSuccess = (msg) => messageApi.success(msg);
  const showError = (msg) => messageApi.error(msg);
  const showWarning = (msg) => messageApi.warning(msg);
  const showInfo = (msg) => messageApi.info(msg);

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, showWarning, showInfo, notificationApi }}>
      {contextHolder}
      {notifContextHolder}
      {children}
    </NotificationContext.Provider>
  );
};
