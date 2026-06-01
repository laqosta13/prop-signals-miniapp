import { appendPastedText } from "../FieldLabelWithPaste";
import { PasteButton } from "../PasteButton";
import { ruTextFieldProps } from "../../utils/textFieldProps";
import { isTelegramDesktop } from "../../utils/platform";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
};

export function SignalFormCommentSection({
  value,
  onChange,
  disabled = false,
  placeholder = "Краткий разбор…",
  hint = "на русском",
}: Props) {
  return (
    <>
      {isTelegramDesktop() ? (
        <div className="signal-form__paste-row">
          <PasteButton
            onPaste={(text) => onChange(appendPastedText(value, text))}
            disabled={disabled}
          />
        </div>
      ) : null}
      <textarea
        {...ruTextFieldProps}
        className="signal-form__comment"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </>
  );
}
