import { useState } from "react";

const STEPS = [
  {
    img: "/bybit-guide/step1.jpg",
    label: "Шаг 1 из 5",
    title: "Профиль → API",
    text: 'Нажми на иконку профиля (правый верхний угол) → прокрути вниз → выбери "API"',
  },
  {
    img: "/bybit-guide/step2.jpg",
    label: "Шаг 2 из 5",
    title: "Создать ключ",
    text: 'Нажми "Создать API" → выбери тип "Сторонний сервис" → введи любое название, например "Volnovoi"',
  },
  {
    img: "/bybit-guide/step3.jpg",
    label: "Шаг 3 из 5",
    title: "Только Торговля",
    text: 'Включи ТОЛЬКО "Контракты — Чтение и Торговля". Всё остальное — не трогай. Вывод средств НЕ включать.',
  },
  {
    img: "/bybit-guide/step4.jpg",
    label: "Шаг 4 из 5",
    title: "Скопируй ключи",
    text: "Нажми «Создать», подтверди SMS. Сразу скопируй API Key и API Secret — Secret показывается только один раз.",
  },
  {
    img: "/bybit-guide/step5.jpg",
    label: "Шаг 5 из 5",
    title: "⚠️ Переведи депозит на Фьючерсы",
    text: "Деньги приходят на Спот-счёт — там копирование не работает. Зайди в «Активы» → «Перевод» → переведи нужную сумму с Единого/Спот на Деривативы (USDT Perpetual). Только после этого сделки будут открываться.",
  },
];

export function BybitApiGuide() {
  const [step, setStep] = useState(0);
  const s = STEPS[step];

  return (
    <div className="bybit-guide">
      <p className="bybit-guide__header">Как создать API на Bybit</p>
      <div className="bybit-guide__card">
        <div className="bybit-guide__img-wrap">
          <img
            src={s.img}
            alt={s.title}
            className="bybit-guide__img"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <div className="bybit-guide__body">
          <span className="bybit-guide__step-label">{s.label}</span>
          <p className="bybit-guide__title">{s.title}</p>
          <p className="bybit-guide__text">{s.text}</p>
        </div>
        <div className="bybit-guide__nav">
          <button
            type="button"
            className="bybit-guide__nav-btn"
            disabled={step === 0}
            onClick={() => setStep((v) => v - 1)}
          >
            ←
          </button>
          <div className="bybit-guide__dots">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`bybit-guide__dot${i === step ? " bybit-guide__dot--active" : ""}`}
                onClick={() => setStep(i)}
                aria-label={`Шаг ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            className="bybit-guide__nav-btn"
            disabled={step === STEPS.length - 1}
            onClick={() => setStep((v) => v + 1)}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
