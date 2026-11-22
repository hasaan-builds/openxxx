import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { GuidedStage } from '../lib/accountScope';
import type { AccountProfile, NavSection } from '../lib/types';

interface GuidedJourneyBarProps {
  account: AccountProfile;
  stages: GuidedStage[];
  completedCount: number;
  nextStage: GuidedStage | null;
  onJumpToStage: (section: NavSection, stageId: GuidedStage['id']) => void;
  onChangeNiche: () => void;
}

export function GuidedJourneyBar({
  stages,
  completedCount,
  nextStage,
  onJumpToStage,
}: GuidedJourneyBarProps) {
  return (
    <div className="border-b border-black/[0.05] dark:border-white/[0.07] bg-white/60 dark:bg-[#111113]/60 backdrop-blur-xl px-4 sm:px-6 lg:px-10 py-2.5">
      <div className="max-w-[1360px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Whisper-clean Apple horizontal stepper rail */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {stages.map((st) => {
            const isNext = nextStage?.id === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => onJumpToStage(st.targetSection, st.id)}
                className={`inline-flex items-center gap-2 text-xs transition-colors whitespace-nowrap ${
                  st.completed
                    ? 'text-[#1D1D1F] dark:text-[#F5F5F7] font-medium'
                    : isNext
                      ? 'text-[#0071E3] dark:text-[#0A84FF] font-semibold'
                      : 'text-[#86868B] hover:text-[#1D1D1F] dark:hover:text-white'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-mono shrink-0 ${
                    st.completed
                      ? 'bg-[#16A34A] dark:bg-[#30D158] text-white dark:text-black'
                      : isNext
                        ? 'bg-[#0071E3] dark:bg-[#0A84FF] text-white'
                        : 'bg-black/[0.07] dark:bg-white/[0.1] text-[#6E6E73] dark:text-[#98989D]'
                  }`}
                >
                  {st.completed ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : st.step}
                </span>
                <span>{st.title}</span>
              </button>
            );
          })}
        </div>

        {/* Quiet inline next-step CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-[11px] text-[#86868B] tabular-nums">
            Process {completedCount}/5
          </span>
          {nextStage ? (
            <button
              type="button"
              onClick={() => onJumpToStage(nextStage.targetSection, nextStage.id)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0071E3] dark:text-[#0A84FF] hover:underline whitespace-nowrap"
            >
              <span>
                Step {nextStage.step}: {nextStage.actionLabel}
              </span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : (
            <span className="text-xs font-medium text-[#16A34A] dark:text-[#30D158]">
              Autopilot Ready
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
