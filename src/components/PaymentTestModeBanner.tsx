import "@/i18n";
import { useTranslation } from "react-i18next";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  const { t } = useTranslation();
  if (!clientToken?.startsWith("pk_test_")) return null;
  return (
    <div className="w-full bg-amber-500/15 border-b border-amber-500/30 px-3 py-1.5 text-center text-[11px] text-amber-200">
      {t("app.payment.testBanner")}
    </div>
  );
}
