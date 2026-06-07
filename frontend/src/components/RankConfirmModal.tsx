import { useState } from "react";
import { createPortal } from "react-dom";
import type { TraderRank } from "../api";
import { confirmMyRank } from "../api";
import { useAppTheme } from "../hooks/useAppTheme";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { isPunkTheme, resolveRankName } from "../utils/punkTheme";
import { resolveRankStyle } from "../utils/ranks";
import { PunkRankIcon } from "./PunkRankIcon";
import { RankIcon } from "./RankIcon";

type Props = {
  rank: TraderRank;
  onDone: () => void;
};

export function RankConfirmModal({ rank, onDone }: Props) {
  const theme = useAppTheme();
  const copy = useThemedCopy();
  const [busy, setBusy] = useState(false);
  const punk = isPunkTheme(theme);
  const st = resolveRankStyle(rank.current_rank_id, theme);
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
      <div className={`rank-confirm-sheet${punk ? " rank-confirm-sheet--punk" : ""}`}>
        <h2>{copy.rankConfirmTitle}</h2>
        <div className={`rank-confirm-sheet__hero${punk ? " rank-confirm-sheet__hero--punk" : ""}`} style={{ background: st.bg, color: st.color }}>
          {st.iconId &&
            (punk ? (
              <PunkRankIcon id={st.iconId} size={32} className="rank-confirm-sheet__icon" />
            ) : (
              <RankIcon id={st.iconId} size={32} className="rank-confirm-sheet__icon" />
            ))}
          <span className="rank-confirm-sheet__name">{rankName}</span>
          <span className="rank-confirm-sheet__pct">{pctLabel}</span>
          <span className="rank-confirm-sheet__sub">{copy.rankConfirmWeek}</span>
        </div>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? "…" : copy.rankConfirmBtn}
        </button>
        <p className="rank-confirm-sheet__hint">Подтвердите до вс 23:59 МСК</p>
      </div>
    </div>,
    document.body,
  );
}
