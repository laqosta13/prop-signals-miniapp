import { useState } from "react";
import { useThemedCopy } from "../hooks/useThemedCopy";
import { RankGuideModal } from "./RankGuideModal";

/** Подсказка на вкладке ТОП — открывает то же описание, что и нажатие на ранг. */
export function RankGuide() {
  const copy = useThemedCopy();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="rank-guide-hint" onClick={() => setOpen(true)}>
        <span className="rank-guide-hint__pulse" aria-hidden />
        {copy.rankGuideHint}
      </button>
      {open && <RankGuideModal onClose={() => setOpen(false)} />}
    </>
  );
}
