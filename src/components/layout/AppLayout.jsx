import React from "react";
import { Box, useTheme } from "@mui/material";
import { useUI } from "../../store";

const DRAWER_WIDTH = 240;
const DRAWER_WIDTH_COLLAPSED = 64;

const AppLayout = ({ sidebar, children }) => {
  const theme = useTheme();
  const { sidebarCollapsed } = useUI();
  
  const drawerWidth = sidebarCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      {sidebar}
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 4 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: "background.default",
          transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
          display: "flex",
          flexDirection: "column",
          maxWidth: "100%",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            mx: "auto",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default AppLayout;