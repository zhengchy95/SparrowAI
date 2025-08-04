import { createTheme } from "@mui/material/styles";

// Define color palettes
const colorPalettes = {
  orange: {
    main: "#ff8c00",
    light: "#ffb347",
    dark: "#e67e00",
  },
  blue: {
    main: "#2196f3",
    light: "#64b5f6",
    dark: "#1976d2",
  },
  purple: {
    main: "#9c27b0",
    light: "#ba68c8",
    dark: "#7b1fa2",
  },
  green: {
    main: "#4caf50",
    light: "#81c784",
    dark: "#388e3c",
  },
  red: {
    main: "#f44336",
    light: "#ef5350",
    dark: "#d32f2f",
  },
  teal: {
    main: "#009688",
    light: "#4db6ac",
    dark: "#00695c",
  },
  indigo: {
    main: "#3f51b5",
    light: "#7986cb",
    dark: "#303f9f",
  },
  pink: {
    main: "#e91e63",
    light: "#f06292",
    dark: "#c2185b",
  },
};

// Create theme function that takes mode and color as parameters
export const createAppTheme = (mode, color = "orange") => {
  const primaryColor = colorPalettes[color] || colorPalettes.orange;

  return createTheme({
    palette: {
      mode: mode,
      primary: primaryColor,
      secondary: {
        main: primaryColor.light,
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
                borderColor: primaryColor.main,
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
};

// Export available theme colors for settings
export const getAvailableThemeColors = () => Object.keys(colorPalettes);
