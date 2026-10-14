import React from 'react';
import { Select } from 'antd';

export default function SingleTagSelect({ onSelect, onOpenChange, ...props }) {
  const [open, setOpen] = React.useState(false);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const handleSelect = (value, option) => {
    setOpen(false);
    onSelect?.(value, option);
  };

  return (
    <Select
      {...props}
      mode="tags"
      maxCount={1}
      open={open}
      onOpenChange={handleOpenChange}
      onSelect={handleSelect}
    />
  );
}
