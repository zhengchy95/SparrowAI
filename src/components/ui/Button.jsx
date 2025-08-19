import React from "react";
import { Button as MuiButton } from "@mui/material";

const Button = ({ 
  variant = "contained", 
  color = "primary", 
  size = "medium",
  children,
  startIcon,
  endIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  sx = {},
  ...props 
}) => {
  return (
    <MuiButton
      variant={variant}
      color={color}
      size={size}
      startIcon={startIcon}
      endIcon={endIcon}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      onClick={onClick}
      sx={{
        borderRadius: 2,
        textTransform: "none",
        fontWeight: 500,
        ...sx,
      }}
      {...props}
    >
      {children}
    </MuiButton>
  );
};

export default Button;