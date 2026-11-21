import React, { useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Send, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { SegmentedProgressBar } from '../components/SegmentedBar';
import { StatusIndicator } from '../components/StatusIndicator';
import { useFinance } from '../store/FinanceContext';
import { computeFinanceMetrics, generateStrategicReport } from '../utils/aiEngine';
import { formatInDisplayCurrency } from '../utils/format';

const SUGGESTED_QUESTIONS = [
  'Dans quel projet investir davantage ?',
  'Quel est l’état de mes stocks et marges produits ?',
  'Quels projets sont sur la ligne rouge ?',
  'Quelle est ma répartition Cash vs Banque ?',
  'Quel est l’état de mes dettes et prêts internes ?',
];

export const AiCoachView: React.FC = () => {
  const { state, sendChatMessage, clearChatHistory } = useFinance();
  const [reportPeriod, setReportPeriod] = useState<'week' | 'month'>('month');
  const [question, setQuestion] = useState('');

  const { displayCurrency, currencies } = state.settings;
  const fmt = (fbu: number, opts?: { signed?: boolean }) =>
    formatInDisplayCurrency(fbu, displayCurrency, currencies, opts);

  const report = useMemo(
    () => generateStrategicReport(state, reportPeriod),
    [state, reportPeriod]
  );
  const periodMetrics = useMemo(
    () => computeFinanceMetrics(state, reportPeriod),
    [state, reportPeriod]
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    sendChatMessage(question);
    setQuestion('');
  };

  return (
    <div className="space-y-6">
      {/* Report Period Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-zinc-100">
            Assistant Stratégique
          </h2>
          <p className="text-xs text-zinc-400">
            Analyse en temps réel de vos flux, marges, supports et dettes
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-zinc-800/80 bg-[#141417] p-1">
          <button
            type="button"
            onClick={() => setReportPeriod('week')}
            className={`min-h-[36px] rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              reportPeriod === 'week'
                ? 'bg-[#F5B971] text-[#0D0D0F]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Rapport Hebdo
          </button>
          <button
            type="button"
            onClick={() => setReportPeriod('month')}
            className={`min-h-[36px] rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              reportPeriod === 'month'
                ? 'bg-[#F5B971] text-[#0D0D0F]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            Rapport Mensuel
          </button>
        </div>
      </div>

      {/* Diagnostic & Recommendation Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        {/* Left 7 cols: Diagnostic & Improvement Axes */}
        <div className="lg:col-span-7 space-y-4">
          {/* Global Diagnostic Card */}
          <section className="rounded-2xl border border-zinc-800/80 bg-[#141417] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-zinc-400">{report.periodLabel}</div>
                <h3 className="mt-1 font-display text-base font-bold text-zinc-100">
                  {report.headline}
                </h3>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${
                  report.globalHealth === 'redline'
                    ? 'text-[#EF4444]'
                    : report.globalHealth === 'warning'
                    ? 'text-[#F5B971]'
                    : 'text-[#10B981]'
                }`}
              >
                {report.globalHealth === 'redline' ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <TrendingUp className="h-3.5 w-3.5" />
                )}
                <span>
                  {report.globalHealth === 'redline'
                    ? 'Ligne rouge'
                    : report.globalHealth === 'warning'
                    ? 'Vigilance'
                    : 'Trajectoire positive'}
                </span>
              </span>
            </div>

            <p className="text-sm text-zinc-300 leading-relaxed">{report.summaryText}</p>

            {/* Cash vs Bank Segmented Split */}
            <div className="border-t border-zinc-800/70 pt-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Part en Cash liquide</span>
                <span className="font-mono-num text-zinc-200">
                  {report.cashRatioPercent}% Cash · {100 - report.cashRatioPercent}% Banque / MM
                </span>
              </div>
              <SegmentedProgressBar
                percent={report.cashRatioPercent}
                tone={report.cashRatioPercent > 50 ? 'amber' : 'emerald'}
                segments={20}
                heightClass="h-1.5"
              />
            </div>

            {/* Project-by-project health summary */}
            {periodMetrics.projectMetrics.length > 0 && (
              <div className="border-t border-zinc-800/70 pt-3.5 space-y-2.5">
                <div className="text-xs font-semibold text-zinc-300">
                  État par projet (Résultat net réel &amp; Stock)
                </div>
                <div className="divide-y divide-zinc-800/60">
                  {periodMetrics.projectMetrics.map((pm) => (
                    <div
                      key={pm.project.id}
                      className="flex items-center justify-between py-2 text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-zinc-200 truncate">
                          {pm.project.name}
                        </span>
                        <StatusIndicator status={pm.status} label={pm.statusLabel} />
                        {pm.stockValueFbu > 0 && (
                          <span className="hidden sm:inline font-mono-num text-[11px] text-[#F5B971]">
                            · Stock {fmt(pm.stockValueFbu)}
                          </span>
                        )}
                      </div>
                      <span
                        className={`font-mono-num font-semibold shrink-0 ${
                          pm.netResultFbu >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                        }`}
                      >
                        {fmt(pm.netResultFbu, { signed: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inventory & Margin Summary */}
            {(report.totalStockValueFbu > 0 || report.lowStockAlerts.length > 0) && (
              <div className="border-t border-zinc-800/70 pt-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-zinc-300">
                    <Boxes className="h-3.5 w-3.5 text-[#F5B971]" />
                    <span>Capital immobilisé en stock</span>
                  </span>
                  <span className="font-mono-num font-bold text-[#F5B971]">
                    {fmt(report.totalStockValueFbu)}
                  </span>
                </div>
                {report.topProductInsight && (
                  <p className="text-[11px] text-zinc-400">
                    Top rotation :{' '}
                    <strong className="text-zinc-200">
                      {report.topProductInsight.itemName}
                    </strong>{' '}
                    ({report.topProductInsight.soldQty} {report.topProductInsight.unit}{' '}
                    vendus · marge {report.topProductInsight.marginPercent}%)
                  </p>
                )}
                {report.lowStockAlerts.length > 0 && (
                  <p className="text-[11px] text-[#EF4444]">
                    ⚠ {report.lowStockAlerts.length} alerte(s) de stock faible à réapprovisionner.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Investment Priority + Improvement Axes */}
          <section className="rounded-2xl border border-zinc-800/80 bg-[#141417] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#F5B971]" />
              <h3 className="font-display text-base font-bold text-zinc-100">
                Où investir &amp; Axes d’amélioration
              </h3>
            </div>

            {report.recommendedProject ? (
              <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/5 p-3.5 space-y-1">
                <div className="text-xs font-semibold text-[#10B981]">
                  Projet prioritaire pour investir davantage : {report.recommendedProject.name}
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {report.recommendedProject.reason}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-[#0D0D0F] p-3.5 text-xs text-zinc-400">
                Aucun projet ne dégage encore un flux positif sur cette période. Consolidez vos marges avant d’allouer de nouveaux capitaux.
              </div>
            )}

            <div className="divide-y divide-zinc-800/60">
              {report.improvementAxes.map((axis, idx) => (
                <div key={idx} className="py-3 first:pt-1 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-100">
                      {idx + 1}. {axis.title}
                    </span>
                    <span
                      className={`text-[11px] font-medium shrink-0 ${
                        axis.priority === 'high' ? 'text-[#EF4444]' : 'text-[#F5B971]'
                      }`}
                    >
                      {axis.priority === 'high' ? 'Priorité haute' : 'Optimisation'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{axis.detail}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right 5 cols: Interactive AI Chat */}
        <section className="lg:col-span-5 flex flex-col rounded-2xl border border-zinc-800/80 bg-[#141417] p-4 sm:p-5 h-[500px] lg:h-[620px]">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/70">
            <div>
              <h3 className="font-display text-base font-bold text-zinc-100">
                Poser une question sur vos chiffres
              </h3>
              <p className="text-xs text-zinc-500">
                Réponses basées sur vos données locales en temps réel
              </p>
            </div>
            {state.chatHistory.length > 0 && (
              <button
                type="button"
                onClick={clearChatHistory}
                aria-label="Effacer la conversation"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {state.chatHistory.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Interrogez TOMI Coach sur la rentabilité de vos projets, l’équilibre Cash/Banque, vos dettes ou le meilleur projet où réinvestir.
                </p>
                <div className="space-y-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendChatMessage(q)}
                      className="block w-full rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3.5 py-2.5 text-left text-xs font-medium text-zinc-300 hover:border-[#F5B971]/60 hover:text-[#F5B971] transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              state.chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                      msg.role === 'user'
                        ? 'bg-[#F5B971] text-[#0D0D0F] font-medium'
                        : 'border border-zinc-800 bg-[#0D0D0F] text-zinc-200'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSend}
            className="pt-3 border-t border-zinc-800/70 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ex: Quel projet est le plus rentable ?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="h-11 flex-1 rounded-xl border border-zinc-800 bg-[#0D0D0F] px-3.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-[#F5B971] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!question.trim()}
              aria-label="Envoyer"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F5B971] text-[#0D0D0F] disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
