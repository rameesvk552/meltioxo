const colors = {
  primary: '#a53727', primaryHover: '#b84432', primaryActive: '#86291d',
  surface: '#ffffff', background: '#f4f6f8', border: '#e9ecef',
  text: '#1c1c1e', secondary: '#5e6e82', muted: '#64748b',
};

export const antdTheme = {
  token: {
    colorPrimary: colors.primary,
    colorPrimaryHover: colors.primaryHover,
    colorPrimaryActive: colors.primaryActive,
    colorBgContainer: colors.surface,
    colorBgElevated: colors.surface,
    colorBgLayout: colors.background,
    colorBorder: colors.border,
    colorBorderSecondary: '#f1f3f5',
    colorText: colors.text,
    colorTextSecondary: colors.secondary,
    colorTextDescription: colors.muted,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
    fontSize: 14,
    borderRadius: 8,
    controlHeight: 36,
    boxShadow: '0 1px 3px rgba(28, 28, 30, 0.07)',
    
    // Explicit control item states to prevent calculation issues from CSS variables
    controlItemBgHover: colors.background,
    controlItemBgActive: 'rgba(181, 66, 48, 0.08)',
    controlItemBgActiveHover: 'rgba(181, 66, 48, 0.12)',
  },
  components: {
    Card: {
      colorBgContainer: '#ffffff',
      borderColor: '#e9ecef',
      boxShadow: '0 1px 3px rgba(28, 28, 30, 0.07)',
    },
    Menu: {
      colorBgContainer: 'transparent',
      itemSelectedBg: 'rgba(181, 66, 48, 0.08)',
      itemSelectedColor: colors.primary,
      itemColor: colors.secondary,
      itemHoverColor: colors.primary,
      activeBarColor: colors.primary,
    },
    Input: {
      colorBgContainer: '#ffffff',
      colorBorder: '#dcdfe3',
      activeBorderColor: colors.primary,
      hoverBorderColor: colors.primaryHover,
      colorTextPlaceholder: 'rgba(28, 28, 30, 0.35)',
    },
    InputNumber: {
      colorBgContainer: '#ffffff',
      colorBorder: '#dcdfe3',
    },
    Select: {
      colorBgContainer: '#ffffff',
      colorBorder: '#dcdfe3',
      colorPrimaryHover: colors.primaryHover,
      controlOutline: 'rgba(181, 66, 48, 0.05)',
    },
    DatePicker: {
      colorBgContainer: '#ffffff',
      colorBorder: '#dcdfe3',
    },
    Button: {
      colorPrimary: colors.primary,
      colorPrimaryHover: colors.primaryHover,
      colorPrimaryActive: colors.primaryActive,
      colorLink: colors.primary,
      colorLinkHover: colors.primaryHover,
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
      colorLink: colors.primary,
      colorLinkHover: colors.primaryHover,
    }
  }
};
