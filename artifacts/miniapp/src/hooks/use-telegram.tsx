import { useEffect, useState } from "react";

// Add Telegram to window
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        themeParams: any;
      };
    };
  }
}

export function useTelegram() {
  const [initData, setInitData] = useState<string>("");

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      webApp.ready();
      webApp.expand();
      setInitData(webApp.initData || "");
    }
  }, []);

  return {
    initData,
    isTestMode: !initData
  };
}
