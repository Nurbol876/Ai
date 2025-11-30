import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

const initialForm = {
  fullName: "",
  email: "",
  password: "",
};

export default function AuthPanel() {
  const { login, register, googleLogin, error, clearError } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const title = mode === "login" ? "Добро пожаловать" : "Создайте аккаунт";
  const subtitle =
    mode === "login"
      ? "Войдите по email/паролю или используйте Google, чтобы продолжить."
      : "Зарегистрируйтесь, чтобы сохранять историю сессий и пользоваться голосовым режимом.";

  function handleChange(field) {
    return (event) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setLocalError("");
      if (error) clearError();
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setLocalError("");

    try {
      if (mode === "login") {
        await login(form.email, form.password);
      } else {
        if (!form.fullName.trim()) {
          setLocalError("Пожалуйста, укажите имя.");
          return;
        }
        await register(form.email, form.password, form.fullName.trim());
      }
      setForm(initialForm);
    } catch (submitError) {
      // error state handled via context; fallback for silent failures
      if (!submitError?.message) {
        setLocalError("Что-то пошло не так. Попробуйте снова.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setSubmitting(true);
    setLocalError("");
    try {
      await googleLogin();
    } catch (submitError) {
      if (!submitError?.message) {
        setLocalError("Не удалось авторизоваться через Google.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const errorMessage = useMemo(() => {
    if (localError) return localError;
    if (!error) return "";
    if (error.includes("auth/invalid-credential") || error.includes("wrong-password")) {
      return "Неверный email или пароль.";
    }
    if (error.includes("auth/user-not-found")) {
      return "Аккаунт не найден. Попробуйте зарегистрироваться.";
    }
    if (error.includes("auth/email-already-in-use")) {
      return "Такой email уже зарегистрирован.";
    }
    return error;
  }, [error, localError]);

  return (
    <section className="app-card auth-card">
      <div className="hero">
        <span className="hero-badge">Secure profile</span>
        <h1 className="hero-title">{title}</h1>
        <p className="hero-subtitle">{subtitle}</p>
      </div>

      <div className="auth-toggle">
        <button
          className={`auth-toggle__button ${mode === "login" ? "is-active" : ""}`}
          onClick={() => setMode("login")}
          type="button"
        >
          Вход
        </button>
        <button
          className={`auth-toggle__button ${mode === "register" ? "is-active" : ""}`}
          onClick={() => setMode("register")}
          type="button"
        >
          Регистрация
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {mode === "register" && (
          <label className="field">
            <span className="field-label">Имя и фамилия</span>
            <input
              type="text"
              className="field-control input-control"
              placeholder="Например, Анна Иванова"
              value={form.fullName}
              onChange={handleChange("fullName")}
            />
          </label>
        )}

        <label className="field">
          <span className="field-label">Email</span>
          <input
            type="email"
            className="field-control input-control"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange("email")}
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Пароль</span>
          <input
            type="password"
            className="field-control input-control"
            placeholder="Минимум 6 символов"
            value={form.password}
            onChange={handleChange("password")}
            required
          />
        </label>

        {errorMessage && <p className="form-error">{errorMessage}</p>}

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Загрузка..." : mode === "login" ? "Войти" : "Создать аккаунт"}
        </button>
      </form>

      <div className="divider">
        <span>или</span>
      </div>

      <button className="google-button" type="button" onClick={handleGoogle} disabled={submitting}>
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
          <path
            d="M21.35 11.1h-9.18v2.96h5.26c-.22 1.35-1.58 3.97-5.26 3.97a6.08 6.08 0 1 1 0-12.17 5.63 5.63 0 0 1 3.98 1.56l2.72-2.63A9.62 9.62 0 1 0 12.17 22a9.3 9.3 0 0 0 9.18-10.9z"
            fill="currentColor"
          />
        </svg>
        Войти через Google
      </button>
    </section>
  );
}

