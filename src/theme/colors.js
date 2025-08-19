// Color palette definitions
export const colorPalettes = {
  orange: {
    main: "#ff8c00",
    light: "#ffb347",
    dark: "#e67e00",
    contrastText: "#ffffff",
  },
  blue: {
    main: "#2196f3",
    light: "#64b5f6",
    dark: "#1976d2",
    contrastText: "#ffffff",
  },
  purple: {
    main: "#9c27b0",
    light: "#ba68c8",
    dark: "#7b1fa2",
    contrastText: "#ffffff",
  },
  green: {
    main: "#4caf50",
    light: "#81c784",
    dark: "#388e3c",
    contrastText: "#ffffff",
  },
  red: {
    main: "#f44336",
    light: "#ef5350",
    dark: "#d32f2f",
    contrastText: "#ffffff",
  },
  teal: {
    main: "#009688",
    light: "#4db6ac",
    dark: "#00695c",
    contrastText: "#ffffff",
  },
  indigo: {
    main: "#3f51b5",
    light: "#7986cb",
    dark: "#303f9f",
    contrastText: "#ffffff",
  },
  pink: {
    main: "#e91e63",
    light: "#f06292",
    dark: "#c2185b",
    contrastText: "#ffffff",
  },
};

// Theme-specific color schemes
export const getColorScheme = (mode) => ({
  background: {
    default: mode === "dark" ? "#0f0f0f" : "#fafafa",
    paper: mode === "dark" ? "#1a1a1a" : "#ffffff",
    elevated: mode === "dark" ? "#2d2d2d" : "#f5f5f5",
  },
  text: {
    primary: mode === "dark" ? "#ffffff" : "#1a1a1a",
    secondary: mode === "dark" ? "#b3b3b3" : "#666666",
    disabled: mode === "dark" ? "#666666" : "#9e9e9e",
  },
  divider: mode === "dark" ? "#333333" : "#e0e0e0",
  action: {
    hover: mode === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)",
    selected: mode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)",
    disabled: mode === "dark" ? "rgba(255, 255, 255, 0.26)" : "rgba(0, 0, 0, 0.26)",
  },
});

export const getAvailableThemeColors = () => Object.keys(colorPalettes);