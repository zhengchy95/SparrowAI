import { useUI } from "../store";

const useNotification = () => {
  const { showNotification, clearNotification, notification } = useUI();

  const showSuccess = (message, timeout = 5000) => {
    showNotification(message, "success", timeout);
  };

  const showError = (message, timeout = 8000) => {
    showNotification(message, "error", timeout);
  };

  const showWarning = (message, timeout = 6000) => {
    showNotification(message, "warning", timeout);
  };

  const showInfo = (message, timeout = 5000) => {
    showNotification(message, "info", timeout);
  };

  return {
    notification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearNotification,
  };
};

export default useNotification;