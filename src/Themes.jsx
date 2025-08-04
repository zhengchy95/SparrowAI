import { createTheme } from "@mui/material/styles";

// Create theme function that takes mode as parameter
export const createAppTheme = (mode) =>
  createTheme({
    palette: {
      mode: mode,
      primary: {
        main: "#ff8c00",
        light: "#ffb347",
        dark: "#e67e00",
      },
      secondary: {
        main: "#ffb347",
      },
      background: {
        default: mode === "dark" ? "#1a1a1a" : "#ffffff",
        paper: mode === "dark" ? "#2d2d2d" : "#f5f5f5",
      },
      text: {
        primary: mode === "dark" ? "#ffffff" : "#000000",
        secondary: mode === "dark" ? "#b0b0b0" : "#666666",
      },
      divider: mode === "dark" ? "#404040" : "#e0e0e0",
    },
    typography: {
      fontFamily:
        '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
      h4: {
        fontWeight: 600,
        color: "#ffffff",
      },
      h6: {
        fontWeight: 500,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: mode === "dark" ? "#1a1a1a" : "#ffffff",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: mode === "dark" ? "#2d2d2d" : "#f5f5f5",
            borderRight:
              mode === "dark" ? "1px solid #404040" : "1px solid #e0e0e0",
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: mode === "dark" ? "#2d2d2d" : "#ffffff",
            borderRadius: 12,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: mode === "dark" ? "#2d2d2d" : "#ffffff",
            borderRadius: 12,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              backgroundColor: mode === "dark" ? "#3a3a3a" : "#ffffff",
              borderRadius: 12,
              "& fieldset": {
                borderColor: mode === "dark" ? "#505050" : "#d0d0d0",
              },
              "&:hover fieldset": {
                borderColor: mode === "dark" ? "#606060" : "#b0b0b0",
              },
              "&.Mui-focused fieldset": {
                borderColor: "#ff8c00",
              },
            },
            "& .MuiInputLabel-root": {
              color: mode === "dark" ? "#b0b0b0" : "#666666",
            },
            "& .MuiInputBase-input": {
              color: mode === "dark" ? "#ffffff" : "#000000",
            },
          },
        },
      },
    },
  });
