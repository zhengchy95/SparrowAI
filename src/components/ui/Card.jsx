import React from "react";
import { Card as MuiCard, CardContent, CardActions, CardHeader } from "@mui/material";

const Card = ({ 
  children, 
  title,
  action,
  actions,
  elevation = 1,
  sx = {},
  ...props 
}) => {
  return (
    <MuiCard
      elevation={elevation}
      sx={{
        borderRadius: 3,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        ...sx,
      }}
      {...props}
    >
      {title && (
        <CardHeader
          title={title}
          action={action}
          sx={{
            pb: 1,
          }}
        />
      )}
      <CardContent sx={{ pt: title ? 0 : 2 }}>
        {children}
      </CardContent>
      {actions && (
        <CardActions sx={{ pt: 0, pb: 2, px: 2 }}>
          {actions}
        </CardActions>
      )}
    </MuiCard>
  );
};

export default Card;