import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">{t("404")}</h1>
        <p className="text-xl text-gray-600 mb-4">{t("Oops! Page not found")}</p>
        <Button asChild>
          <Link to="/">{t("Return to Home")}</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
