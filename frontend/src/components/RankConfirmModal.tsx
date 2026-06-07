import { useState } from "react";
import { createPortal } from "react-dom";
import type { TraderRank } from "../api";
import { confirmMyRank } from "../api";
import { useAppTheme } from "../hooks/useAppTheme";
import { resolveRankName } from "../utils/punkTheme";
import { rankStyle } from "../utils/ranks";
import { RankIcon } from "./RankIcon";

type Props = {
  rank: TraderRank;
  onDone: () => void;
};

export function RankConfirmModal({ rank, onDone }: Props) {
  const theme = useAppTheme();
  const [busy, setBusy] = useState(false);
  const st = rankStyle(rank.current_rank_id);
  const rankName = resolveRankName(rank.current_rank_id, rank.current_rank_name, theme);
  const pct = rank.weekly_pct;
  const pctLabel = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

  const submit = async () => {
    setBusy(true);
    try {
      await confirmMyRank();
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop modal-backdrop--rank" role="dialog" aria-modal="true">
      <div className="rank-confirm-sheet">
        <h2>Подтверди свой ранг</h2>
        <div className="rank-confirm-sheet__hero" style={{ background: st.bg, color: st.color }}>
          {st.iconId && <RankIcon id={st.iconId} size={32} className="rank-confirm-sheet__icon" />}
          <span className="rank-confirm-sheet__name">{rankName}</span>
          <span className="rank-confirm-sheet__pct">{pctLabel}</span>
          <span className="rank-confirm-sheet__sub">за неделю</span>
        </div>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? "…" : "Подтвердить результат"}
        </button>
        <p className="rank-confirm-sheet__hint">Подтвердите до вс 23:59 МСК</p>
      </div>
    </div>,
    document.body,
  );
}
