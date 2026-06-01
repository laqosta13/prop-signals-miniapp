import type { UploadProgress } from "../../api";
import { uploadProgressLabel } from "../../utils/upload";
import { UploadProgressBar } from "../UploadProgressBar";

type Props = {
  error: string | null;
  submitting: boolean;
  uploadProgress: UploadProgress | null;
  hasVideo: boolean;
  disabled: boolean;
  publishLabel: string;
  saveLabel?: string;
};

export function SignalFormSubmitFooter({
  error,
  submitting,
  uploadProgress,
  hasVideo,
  disabled,
  publishLabel,
  saveLabel = "Сохранение…",
}: Props) {
  const buttonLabel =
    submitting && uploadProgress
      ? uploadProgress.phase === "processing"
        ? saveLabel
        : `Загрузка… ${uploadProgress.percent}%`
      : submitting
        ? saveLabel
        : publishLabel;

  return (
    <>
      {error ? (
        <p className="signal-form__alert signal-form__alert--err" role="alert">
          {error}
        </p>
      ) : null}
      {submitting && uploadProgress ? (
        <UploadProgressBar
          progress={uploadProgress}
          label={uploadProgressLabel(hasVideo, uploadProgress.phase)}
        />
      ) : null}
      <button type="submit" className="submit-btn signal-form__submit" disabled={disabled}>
        {buttonLabel}
      </button>
    </>
  );
}
