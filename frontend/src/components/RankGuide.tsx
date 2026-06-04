import { useState } from "react";
import { RANK_GUIDE_HINT } from "../data/appCopy";
import { RankGuideModal } from "./RankGuideModal";

/** Подсказка на вкладке ТОП — открывает то же описание, что и нажатие на ранг. */
export function RankGuide() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="rank-guide-hint" onClick={() => setOpen(true)}>
        <span className="rank-guide-hint__pulse" aria-hidden />
        {RANK_GUIDE_HINT}
      </button>
      {open && <RankGuideModal onClose={() => setOpen(false)} />}
    </>
  );
}
