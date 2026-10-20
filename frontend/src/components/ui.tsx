import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  X,
} from "lucide-react";
import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "theme-primary shadow-sm",
        variant === "secondary" &&
          "border border-ink-200 bg-white text-ink-800 hover:border-ocean-300 hover:bg-ocean-50",
        variant === "ghost" && "text-ink-600 hover:bg-ocean-50 hover:text-ocean-800",
        variant === "danger" &&
          "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
        size === "sm" && "min-h-9 px-3 text-xs",
        size === "md" && "min-h-11 px-4 text-sm",
        size === "lg" && "min-h-12 px-5 text-sm",
        className,
      )}
      type={type}
      {...props}
    />
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, id, className, ...props }: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <label className="block" htmlFor={fieldId}>
      <span className="mb-2 block text-sm font-semibold text-ink-800">{label}</span>
      <input
        {...props}
        id={fieldId}
        className={cn(
          "input-field",
          error && "border-red-300 focus:border-red-500 focus:ring-red-200",
          className,
        )}
      />
      {error ? (
        <span className="mt-1.5 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>
      ) : null}
    </label>
  );
}

interface PasswordFieldProps extends Omit<TextFieldProps, "type"> {
  showLabel?: string;
  hideLabel?: string;
}

export function PasswordField({
  className,
  showLabel = "Show password",
  hideLabel = "Hide password",
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const { label, hint, error, id, ...inputProps } = props;
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <label className="block" htmlFor={fieldId}>
      <span className="mb-2 block text-sm font-semibold text-ink-800">{label}</span>
      <span className="relative block">
        <input
          {...inputProps}
          id={fieldId}
          type={visible ? "text" : "password"}
          className={cn(
            "input-field pr-12",
            error && "border-red-300 focus:border-red-500 focus:ring-red-200",
            className,
          )}
        />
        <button
          aria-label={visible ? hideLabel : showLabel}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-400 transition hover:text-ocean-700"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      {error ? (
        <span className="mt-1.5 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextArea({
  label,
  hint,
  error,
  id,
  ...props
}: {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <label className="block" htmlFor={fieldId}>
      <span className="mb-2 block text-sm font-semibold text-ink-800">{label}</span>
      <textarea
        {...props}
        id={fieldId}
        className={cn(
          "input-field min-h-28 resize-y py-3",
          error && "border-red-300 focus:border-red-500 focus:ring-red-200",
        )}
      />
      {error ? (
        <span className="mt-1.5 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>
      ) : null}
    </label>
  );
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/35 p-4 backdrop-blur-sm">
      <button
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <div
        aria-modal="true"
        className={cn(
          "relative max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-soft sm:p-8",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
        role="dialog"
      >
        <div className="mb-6 flex items-start justify-between gap-5">
          <div>
            <h2 className="font-display text-xl font-bold text-ink-900">{title}</h2>
            {description ? <p className="mt-1.5 text-sm leading-6 text-ink-500">{description}</p> : null}
          </div>
          <button
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-7 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          {title}
        </h1>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading your vault" }: { label?: string }) {
  return (
    <div className="flex min-h-[45vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm font-medium text-ink-500">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ocean-500" />
        {label}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white/70 px-6 py-14 text-center">
      <div className="mx-auto max-w-md">
        <h2 className="font-display text-xl font-bold text-ink-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-500">{description}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}

export function ToastMessage({
  tone,
  message,
  onDismiss,
}: {
  tone: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex max-w-sm items-start gap-3 rounded-xl border border-white/80 bg-white px-4 py-3.5 shadow-soft">
      {tone === "success" ? (
        <CheckCircle2 className="mt-0.5 shrink-0 text-ocean-600" size={18} />
      ) : (
        <AlertCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
      )}
      <p className="flex-1 text-sm leading-5 text-ink-700">{message}</p>
      <button
        aria-label="Dismiss notification"
        className="shrink-0 text-ink-400 hover:text-ink-700"
        onClick={onDismiss}
        type="button"
      >
        <X size={16} />
      </button>
    </div>
  );
}
