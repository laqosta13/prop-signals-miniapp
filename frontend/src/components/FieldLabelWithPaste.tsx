import { PasteButton } from "./PasteButton";
import { isTelegramDesktop } from "../utils/platform";

type Props = {
  label: string;
  onPaste?: (text: string) => void;
  disabled?: boolean;
};

export function FieldLabelWithPaste({ label, onPaste, disabled }: Props) {
  if (!isTelegramDesktop() || !onPaste) {
    return <label className="field-label">{label}</label>;
  }

  return (
    <div className="field-row">
      <label className="field-label">{label}</label>
      <PasteButton onPaste={onPaste} disabled={disabled} />
    </div>
  );
}

/** Вставка в textarea: дописывает к уже набранному тексту. */
export function appendPastedText(current: string, pasted: string): string {
  const chunk = pasted.trim();
  if (!chunk) return current;
  if (!current.trim()) return chunk;
  return `${current.replace(/\s+$/, "")}\n${chunk}`;
}
