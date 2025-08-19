import React from "react";
import { Box } from "@mui/material";

const PageContainer = ({ 
  children, 
  maxWidth = "100%", 
  centered = false,
  sx = {} 
}) => {
  return (
    <Box
      sx={{
        maxWidth,
        mx: centered ? "auto" : 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

export default PageContainer;