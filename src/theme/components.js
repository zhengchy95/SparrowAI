// MUI component overrides
export const getComponentOverrides = (mode, primaryColor) => ({
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        backgroundColor: mode === "dark" ? "#0f0f0f" : "#fafafa",
        scrollbarWidth: "thin",
        scrollbarColor: mode === "dark" ? "#666 #2b2b2b" : "#999 #f1f1f1",
        "&::-webkit-scrollbar": {
          width: "8px",
        },
        "&::-webkit-scrollbar-track": {
          background: mode === "dark" ? "#2b2b2b" : "#f1f1f1",
        },
        "&::-webkit-scrollbar-thumb": {
          background: mode === "dark" ? "#666" : "#999",
          borderRadius: "4px",
          "&:hover": {
            background: mode === "dark" ? "#777" : "#888",
          },
        },
      },
    },
  },
  
  MuiCard: {
    styleOverrides: {
      root: {
        backgroundColor: mode === "dark" ? "#1a1a1a" : "#ffffff",
        borderRadius: 16,
        border: `1px solid ${mode === "dark" ? "#333333" : "#e0e0e0"}`,
        boxShadow: mode === "dark" 
          ? "0 4px 12px rgba(0, 0, 0, 0.4)" 
          : "0 2px 8px rgba(0, 0, 0, 0.1)",
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          boxShadow: mode === "dark" 
            ? "0 8px 24px rgba(0, 0, 0, 0.5)" 
            : "0 4px 16px rgba(0, 0, 0, 0.15)",
        },
      },
    },
  },
  
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundColor: mode === "dark" ? "#1a1a1a" : "#ffffff",
        borderRadius: 12,
        backgroundImage: "none",
      },
      outlined: {
        border: `1px solid ${mode === "dark" ? "#333333" : "#e0e0e0"}`,
      },
    },
  },
  
  MuiDrawer: {
    styleOverrides: {
      paper: {
        backgroundColor: mode === "dark" ? "#1a1a1a" : "#ffffff",
        borderRight: `1px solid ${mode === "dark" ? "#333333" : "#e0e0e0"}`,
        backgroundImage: "none",
      },
    },
  },
  
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        textTransform: "none",
        fontWeight: 500,
        padding: "8px 16px",
        boxShadow: "none",
        "&:hover": {
          boxShadow: "none",
        },
      },
      contained: {
        background: `linear-gradient(45deg, ${primaryColor.main}, ${primaryColor.light})`,
        "&:hover": {
          background: `linear-gradient(45deg, ${primaryColor.dark}, ${primaryColor.main})`,
        },
      },
      outlined: {
        borderWidth: "2px",
        "&:hover": {
          borderWidth: "2px",
        },
      },
    },
  },
  
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          backgroundColor: mode === "dark" 
            ? "rgba(255, 255, 255, 0.08)" 
            : "rgba(0, 0, 0, 0.04)",
        },
      },
    },
  },
  
  MuiTextField: {
    styleOverrides: {
      root: {
        "& .MuiOutlinedInput-root": {
          backgroundColor: mode === "dark" ? "#2d2d2d" : "#ffffff",
          borderRadius: 12,
          transition: "all 0.2s ease-in-out",
          "& fieldset": {
            borderColor: mode === "dark" ? "#444444" : "#d0d0d0",
            borderWidth: "2px",
          },
          "&:hover fieldset": {
            borderColor: mode === "dark" ? "#555555" : "#b0b0b0",
          },
          "&.Mui-focused fieldset": {
            borderColor: primaryColor.main,
            boxShadow: `0 0 0 2px ${primaryColor.main}20`,
          },
        },
        "& .MuiInputLabel-root": {
          color: mode === "dark" ? "#b3b3b3" : "#666666",
          "&.Mui-focused": {
            color: primaryColor.main,
          },
        },
        "& .MuiInputBase-input": {
          color: mode === "dark" ? "#ffffff" : "#1a1a1a",
        },
      },
    },
  },
  
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: 12,
        margin: "2px 0",
        "&.Mui-selected": {
          backgroundColor: `${primaryColor.main}20`,
          "&:hover": {
            backgroundColor: `${primaryColor.main}30`,
          },
        },
        "&:hover": {
          backgroundColor: mode === "dark" 
            ? "rgba(255, 255, 255, 0.04)" 
            : "rgba(0, 0, 0, 0.04)",
        },
      },
    },
  },
  
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 20,
        backgroundColor: mode === "dark" ? "#1a1a1a" : "#ffffff",
        backgroundImage: "none",
      },
    },
  },
  
  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: 10,
        backgroundColor: mode === "dark" ? "#333333" : "#e0e0e0",
      },
      bar: {
        borderRadius: 10,
        background: `linear-gradient(90deg, ${primaryColor.main}, ${primaryColor.light})`,
      },
    },
  },
  
  MuiSnackbar: {
    styleOverrides: {
      root: {
        "& .MuiSnackbarContent-root": {
          borderRadius: 12,
          backgroundColor: mode === "dark" ? "#2d2d2d" : "#333333",
        },
      },
    },
  },
  
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: mode === "dark" ? "#2d2d2d" : "#555555",
        borderRadius: 8,
        fontSize: "0.75rem",
      },
      arrow: {
        color: mode === "dark" ? "#2d2d2d" : "#555555",
      },
    },
  },
});