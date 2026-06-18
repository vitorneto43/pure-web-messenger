import { useEffect, useMemo, useState } from "react";
import { Loader2, BarChart3 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getBoostReport } from "@/lib/boost-analytics.functions";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { currentLocale } from "@/i18n";
import { formatMoney, type Currency } from "@/lib/currency";
import { labelOfInterest, emojiOfInterest } from "@/lib/interests";

const COLORS = ["#ec4899", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#06b6d4", "#ef4444"];

function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

export function BoostReportDialog({
  boostId,
  open,
  onOpenChange,
}: {
  boostId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  void i18n.language;
  const locale = currentLocale();
  const fn = useServerFn(getBoostReport);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !boostId) return;
    setLoading(true);
    fn({ data: { boostId } })
      .then((r) => setData(r))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, boostId]);

  const currency: Currency = (data?.boost?.currency?.toString().toUpperCase() ?? "BRL") as Currency;
  const money = (cents: number) =>
    formatMoney(cents / 100, currency, locale);

  const series = useMemo(() => {
    return (data?.series ?? [])
      .reduce((acc: any[], row: any) => {
        const found = acc.find((x) => x.date === row.date);
        if (found) {
          found.views += row.views;
          found.clicks += row.clicks;
        } else acc.push({ date: row.date, views: row.views, clicks: row.clicks });
        return acc;
      }, [])
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [data]);

  // Localize the gender labels coming back as raw strings.
  const genderData = useMemo(() => {
    const raw = data?.by_gender ?? [];
    const total = raw.reduce((s: number, r: any) => s + r.count, 0);
    return raw.map((r: any) => {
      const key = (r.name ?? "").toString().toLowerCase();
      const label =
        key === "male" || key === "m" || key === "masculino"
          ? t("boostReport.male")
          : key === "female" || key === "f" || key === "feminino"
          ? t("boostReport.female")
          : t("boostReport.unknown");
      return { ...r, name: label, percent: pct(r.count, total) };
    });
  }, [data, t]);

  const ageData = useMemo(() => {
    const raw = data?.by_age ?? [];
    const total = raw.reduce((s: number, r: any) => s + r.count, 0);
    return raw.map((r: any) => ({
      ...r,
      name: r.name && r.name !== "?" ? r.name : t("boostReport.unknown"),
      percent: pct(r.count, total),
    }));
  }, [data, t]);

  const stateData = useMemo(() => {
    return (data?.by_state ?? []).map((r: any) => ({
      ...r,
      name: r.name && r.name !== "?" ? r.name : t("boostReport.unknown"),
    }));
  }, [data, t]);

  const countryData = useMemo(() => {
    return (data?.by_country ?? []).map((r: any) => ({
      ...r,
      name: r.name && r.name !== "?" ? r.name : t("boostReport.unknown"),
    }));
  }, [data, t]);

  const interestData = useMemo(() => {
    return (data?.by_interest ?? []).map((r: any) => ({
      ...r,
      label: `${emojiOfInterest(r.name)} ${labelOfInterest(r.name)}`,
    }));
  }, [data]);

  const viewsDelivered = data?.views_delivered ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" /> {t("boostReport.title")}
          </DialogTitle>
        </DialogHeader>
        {loading || !data ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Stat label={t("boostReport.spent")} value={money(data.boost?.amount_cents ?? 0)} />
              <Stat label={t("boostReport.impressions")} value={viewsDelivered.toLocaleString(locale)} />
              <Stat label={t("boostReport.clicks")} value={(data.clicks ?? 0).toLocaleString(locale)} />
              <Stat label={t("boostReport.reactions")} value={(data.reactions ?? 0).toLocaleString(locale)} />
              <Stat label={t("boostReport.ctr")} value={`${data.ctr ?? 0}%`} />
              <Stat label={t("boostReport.cpm")} value={money(data.real_cpm_cents ?? 0)} />
              <Stat label={t("boostReport.cpc")} value={money(data.cpc_cents ?? 0)} />
              <Stat label={t("boostReport.cpv")} value={money(data.cost_per_view_cents ?? 0)} />
            </div>

            <Card title={t("boostReport.seriesTitle")}>
              {series.length === 0 ? (
                <Empty t={t} />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" fontSize={10} tickFormatter={(d) => d.slice(5)} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Line type="monotone" dataKey="views" name={t("boostReport.views")} stroke="#ec4899" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="clicks" name={t("boostReport.clicks")} stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            <div className="grid md:grid-cols-2 gap-3">
              <Card title={t("boostReport.byCountry")}>
                {countryData.length === 0 ? <Empty t={t} /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={countryData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card title={t("boostReport.byState")}>
                {stateData.length === 0 ? <Empty t={t} /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stateData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <Card title={t("boostReport.byAge")}>
                {ageData.length === 0 ? <Empty t={t} /> : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={ageData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={10} />
                        <YAxis fontSize={10} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      {ageData.map((r: any) => (
                        <li key={r.name} className="flex justify-between">
                          <span>{r.name}</span>
                          <span className="font-medium text-foreground">{r.percent}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>

              <Card title={t("boostReport.byGender")}>
                {genderData.length === 0 ? <Empty t={t} /> : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={genderData} dataKey="count" nameKey="name" outerRadius={60} label={(e: any) => `${e.name} ${e.percent}`}>
                          {genderData.map((_: any, i: number) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
                      {genderData.map((r: any) => (
                        <li key={r.name} className="flex justify-between">
                          <span>{r.name}</span>
                          <span className="font-medium text-foreground">{r.percent}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            </div>

            <Card title={t("boostReport.byInterest")}>
              {interestData.length === 0 ? <Empty t={t} /> : (
                <ResponsiveContainer width="100%" height={Math.min(280, 36 + interestData.length * 28)}>
                  <BarChart data={interestData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" fontSize={10} />
                    <YAxis dataKey="label" type="category" fontSize={10} width={130} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base font-bold mt-1 break-words">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">{title}</p>
      {children}
    </div>
  );
}

function Empty({ t }: { t: (k: string) => string }) {
  return (
    <p className="text-xs text-muted-foreground py-6 text-center">{t("boostReport.empty")}</p>
  );
}
