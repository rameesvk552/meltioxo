export const antdTheme = {
  token: {
    colorPrimary: '#b54230',
    colorPrimaryHover: '#c95442',
    colorPrimaryActive: '#9a3222',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f4f6f8',
    colorBorder: '#e9ecef',
    colorBorderSecondary: '#f1f3f5',
    colorText: '#1c1c1e',
    colorTextSecondary: '#5e6e82',
    colorTextDescription: '#8492a6',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    borderRadius: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 10px 20px -5px rgba(28, 28, 30, 0.04)',
    
    // Explicit control item states to prevent calculation issues from CSS variables
    controlItemBgHover: '#f4f6f8',
    controlItemBgActive: 'rgba(181, 66, 48, 0.08)',
    controlItemBgActiveHover: 'rgba(181, 66, 48, 0.12)',
  },
  components: {
    Card: {
      colorBgContainer: '#ffffff',
      borderColor: '#e9ecef',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05), 0 10px 20px -5px rgba(28, 28, 30, 0.04)',
    },
    Menu: {
      colorBgContainer: 'transparent',
      itemSelectedBg: 'rgba(181, 66, 48, 0.08)',
      itemSelectedColor: '#b54230',
      itemColor: '#5e6e82',
      itemHoverColor: '#b54230',
      activeBarColor: '#b54230',
    },
    Input: {
      colorBgContainer: '#ffffff',
      colorBorder: '#dcdfe3',
      activeBorderColor: '#b54230',
      hoverBorderColor: '#c95442',
      colorTextPlaceholder: 'rgba(28, 28, 30, 0.35)',
    },
    InputNumber: {
      colorBgContainer: '#ffffff',
      colorBorder: '#dcdfe3',
    },
    Select: {
      colorBgContainer: '#ffffff',
      colorBorder: '#dcdfe3',
      colorPrimaryHover: '#c95442',
      controlOutline: 'rgba(181, 66, 48, 0.05)',
    },
    DatePicker: {
      colorBgContainer: '#ffffff',
      colorBorder: '#dcdfe3',
    },
    Button: {
      colorPrimary: '#b54230',
      colorPrimaryHover: '#c95442',
      colorPrimaryActive: '#9a3222',
      colorLink: '#b54230',
      colorLinkHover: '#c95442',
      borderRadius: 8,
      fontWeight: 500,
    },
    Table: {
      colorBgContainer: '#ffffff',
      colorHeaderBg: '#f8f9fa',
      colorHeaderColor: '#1c1c1e',
      colorRowHover: 'rgba(181, 66, 48, 0.02)',
      colorBorder: '#eceef0',
    },
    Steps: {
      colorPrimary: '#b54230',
      colorTextDescription: 'rgba(28, 28, 30, 0.45)',
      iconSize: 34,
    },
    Typography: {
      colorLink: '#b54230',
      colorLinkHover: '#c95442',
    }
  }
};
