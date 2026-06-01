import type { ReactNode } from "react";

type Props = {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
};

export function SignalFormSection({ title, hint, children, className }: Props) {
  return (
    <section className={`signal-form__section${className ? ` ${className}` : ""}`}>
      <header className="signal-form__section-head">
        <h3 className="signal-form__section-title">{title}</h3>
        {hint ? <p className="signal-form__section-hint">{hint}</p> : null}
      </header>
      <div className="signal-form__section-body">{children}</div>
    </section>
  );
}
