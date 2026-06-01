import { ruTextFieldProps } from "../../utils/textFieldProps";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function SignalFormCommentSection({
  value,
  onChange,
  disabled = false,
  placeholder = "Краткий разбор…",
}: Props) {
  return (
    <textarea
      {...ruTextFieldProps}
      className="signal-form__comment"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
