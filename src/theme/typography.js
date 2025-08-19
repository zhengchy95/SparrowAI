// Typography configuration
export const getTypography = (mode) => ({
  fontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    '"Segoe UI Symbol"',
  ].join(','),
  
  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01562em',
    color: mode === "dark" ? "#ffffff" : "#1a1a1a",
  },
  
  h2: {
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.00833em',
    color: mode === "dark" ? "#ffffff" : "#1a1a1a",
  },
  
  h3: {
    fontSize: '1.75rem',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '0em',
    color: mode === "dark" ? "#ffffff" : "#1a1a1a",
  },
  
  h4: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0.00735em',
    color: mode === "dark" ? "#ffffff" : "#1a1a1a",
  },
  
  h5: {
    fontSize: '1.25rem',
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: '0em',
    color: mode === "dark" ? "#ffffff" : "#1a1a1a",
  },
  
  h6: {
    fontSize: '1.125rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.0075em',
    color: mode === "dark" ? "#ffffff" : "#1a1a1a",
  },
  
  subtitle1: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.75,
    letterSpacing: '0.00938em',
    color: mode === "dark" ? "#b3b3b3" : "#666666",
  },
  
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.57,
    letterSpacing: '0.00714em',
    color: mode === "dark" ? "#b3b3b3" : "#666666",
  },
  
  body1: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: '0.00938em',
    color: mode === "dark" ? "#ffffff" : "#1a1a1a",
  },
  
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: '0.01071em',
    color: mode === "dark" ? "#b3b3b3" : "#666666",
  },
  
  button: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.02857em',
    textTransform: 'none',
  },
  
  caption: {
    fontSize: '0.75rem',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0.03333em',
    color: mode === "dark" ? "#999999" : "#999999",
  },
  
  overline: {
    fontSize: '0.625rem',
    fontWeight: 500,
    lineHeight: 2.5,
    letterSpacing: '0.08333em',
    textTransform: 'uppercase',
    color: mode === "dark" ? "#999999" : "#999999",
  },
});