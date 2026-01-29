import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const RECAPTCHA_SCRIPT_SRC = "https://www.google.com/recaptcha/api.js?render=explicit";

export type RecaptchaWidgetHandle = {
  reset: () => void;
};

type RecaptchaWidgetProps = {
  siteKey: string;
  onVerify: (token: string | null) => void;
  onExpire?: () => void;
  onError?: () => void;
};

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: HTMLElement, parameters: Record<string, unknown>) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

export const RecaptchaWidget = forwardRef<RecaptchaWidgetHandle, RecaptchaWidgetProps>(
  ({ siteKey, onVerify, onExpire, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<number | null>(null);
    const retryTimeoutRef = useRef<number | null>(null);
    const verifyRef = useRef(onVerify);
    const expireRef = useRef(onExpire);
    const errorRef = useRef(onError);

    useEffect(() => {
      verifyRef.current = onVerify;
      expireRef.current = onExpire;
      errorRef.current = onError;
    }, [onVerify, onExpire, onError]);

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current !== null && window.grecaptcha?.reset) {
          window.grecaptcha.reset(widgetIdRef.current);
        }
      },
    }));

    useEffect(() => {
      let cancelled = false;

      const scheduleRender = (retries = 20) => {
        if (cancelled) return;
        if (!containerRef.current) return;
        if (window.grecaptcha?.render) {
          renderWidget();
          return;
        }
        if (retries <= 0) return;
        retryTimeoutRef.current = window.setTimeout(() => scheduleRender(retries - 1), 150);
      };

      const handleVerify = (token: string) => {
        if (cancelled) return;
        verifyRef.current(token);
      };

      const handleExpired = () => {
        if (cancelled) return;
        verifyRef.current(null);
        expireRef.current?.();
      };

      const handleError = () => {
        if (cancelled) return;
        verifyRef.current(null);
        errorRef.current?.();
      };

      const renderWidget = () => {
        if (!containerRef.current) return;
        if (!window.grecaptcha?.render) return;
        if (widgetIdRef.current !== null) return;

        widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          callback: handleVerify,
          "expired-callback": handleExpired,
          "error-callback": handleError,
        });
      };

      const ensureScript = () => {
        if (window.grecaptcha?.render) {
          renderWidget();
          return;
        }

        const existingScript = document.querySelector<HTMLScriptElement>("script[data-recaptcha]");
        if (existingScript) {
          existingScript.addEventListener("load", () => scheduleRender(), { once: true });
          scheduleRender();
          return;
        }

        const script = document.createElement("script");
        script.src = RECAPTCHA_SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.dataset.recaptcha = "true";
        script.addEventListener("load", () => scheduleRender(), { once: true });
        document.body.appendChild(script);
        scheduleRender();
      };

      ensureScript();

      return () => {
        cancelled = true;
        if (retryTimeoutRef.current !== null) {
          window.clearTimeout(retryTimeoutRef.current);
        }
        if (widgetIdRef.current !== null && window.grecaptcha?.reset) {
          window.grecaptcha.reset(widgetIdRef.current);
        }
        widgetIdRef.current = null;
      };
    }, [siteKey]);

    return <div ref={containerRef} />;
  },
);

RecaptchaWidget.displayName = "RecaptchaWidget";
