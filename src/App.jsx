import { useState, useEffect, useRef } from "react";
import { askInterview } from "./api";
import VoiceButton from "./VoiceButton";
import AuthPanel from "./components/AuthPanel";
import { useAuth } from "./context/AuthContext";
import { db } from "./firebase";
import { addDoc, collection, serverTimestamp, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import "./App.css";

export default function App() {
  const { user, loading, logout } = useAuth();
  const [jobText, setJobText] = useState("");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [diff, setDiff] = useState("вежливый спокойный");
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(localStorage.getItem("voiceName") || "");
  const [rate, setRate] = useState(parseFloat(localStorage.getItem("rate")) || 1);
  const [pitch, setPitch] = useState(parseFloat(localStorage.getItem("pitch")) || 1);

  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);

  const synthRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;

    const loadVoices = () => {
      const allVoices = synthRef.current.getVoices();
      const russianVoices = allVoices.filter((voice) => voice.lang.toLowerCase().startsWith("ru"));
      const finalList = russianVoices.length ? russianVoices : allVoices;

      setVoices(finalList);

      if (!selectedVoice && finalList.length > 0) {
        setSelectedVoice(finalList[0].name);
        localStorage.setItem("voiceName", finalList[0].name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [selectedVoice]);

  useEffect(() => {
    if (!isVoiceEnabled || !messages.length) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;

    const utter = new SpeechSynthesisUtterance(last.content);
    const voiceObj = voices.find((voice) => voice.name === selectedVoice);
    utter.voice = voiceObj || null;
    utter.lang = voiceObj?.lang || "ru-RU";
    utter.rate = rate;
    utter.pitch = pitch;

    synthRef.current.cancel();
    synthRef.current.speak(utter);
  }, [messages, isVoiceEnabled, selectedVoice, rate, pitch, voices]);

  useEffect(() => {
    if (!chatContainerRef.current) return;
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }

    const q = query(collection(db, "users", user.uid, "conversations"), orderBy("updatedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setConversations(items);
    });

    return () => unsubscribe();
  }, [user]);

  async function startInterview() {
    if (!jobText.trim()) return alert("Введите описание вакансии");

    const systemMessage = {
      role: "system",
      content:
        "Ты — " +
        diff +
        " интервьюер и если кандидат не подходит ты должен закончить разговор. Используй только эту вакансию:\n\n" +
        jobText +
        "\n\nНачни собеседование с первого вопроса.",
    };

    setMessages([systemMessage]);

    const first = await askInterview([systemMessage]);
    setMessages([systemMessage, first]);
    setStarted(true);
  }

  async function handleDeleteConversation(id) {
    if (!user) return;
    if (!confirm("Удалить выбранную сессию? Это действие необратимо.")) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "conversations", id));
      if (selectedConversationId === id) {
        setSelectedConversationId(null);
        setMessages([]);
        setStarted(false);
      }
    } catch (err) {
      console.error("Не удалось удалить разговор", err);
      alert("Не удалось удалить разговор. Попробуйте снова.");
    }
  }

  function handleLoadConversation(convo) {
    if (!convo) return;
    const systemMessage = {
      role: "system",
      content:
        "Ты — " +
        (convo.diff || diff) +
        " интервьюер и если кандидат не подходит ты должен закончить разговор. Используй только эту вакансию:\n\n" +
        (convo.jobText || jobText) +
        "\n\nНачни собеседование с первого вопроса.",
    };

    setJobText(convo.jobText || "");
    setDiff(convo.diff || "вежливый спокойный");
    setMessages([systemMessage, ...(convo.messages || [])]);
    setStarted(true);
    setSelectedConversationId(convo.id);
  }

  async function sendMessage(event, overrideContent) {
    event?.preventDefault();
    const text = typeof overrideContent === "string" ? overrideContent : input;
    if (!text.trim()) return;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");

    const aiReply = await askInterview(newMessages);
    setMessages([...newMessages, aiReply]);
  }

  function handleVoiceInput(text) {
    setInput("");
    sendMessage(null, text);
  }

  async function handleSaveConversation() {
    if (!user || !messages.length) return;
    setIsSaving(true);
    setSaveStatus("");
    try {
      const visibleMessages = messages.filter((message) => message.role !== "system");
      await addDoc(collection(db, "users", user.uid, "conversations"), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        title: visibleMessages[0]?.content?.slice(0, 80) || "Сессия собеседования",
        jobText,
        diff,
        messages: visibleMessages,
      });
      setSaveStatus("Сессия сохранена");
    } catch (error) {
      setSaveStatus("Не удалось сохранить, попробуйте позже");
      console.error("Error saving conversation", error);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(""), 3000);
    }
  }

  const onboardingView = (
    <section className="app-card onboarding-card">
      <div className="top-bar">
        <span />
        <button className="profile-logout" type="button" onClick={logout}>
          Выйти
        </button>
      </div>
      <div className="hero">
        <span className="hero-badge">Nurbolai</span>
        <h1 className="hero-title">Nurbolai — ваш AI-интервьюер</h1>
        <p className="hero-subtitle">
          Загрузите вакансию, определите стиль интервьюера и получите реалистичный диалог с мгновенной
          обратной связью.
        </p>
      </div>

      <div className="stats-row">
        <article className="stat-chip">
          <span className="stat-value">+250</span>
          <span className="stat-label">Типовых вопросов</span>
        </article>
        <article className="stat-chip">
          <span className="stat-value">3</span>
          <span className="stat-label">уровня строгости</span>
        </article>
        <article className="stat-chip">
          <span className="stat-value">∞</span>
          <span className="stat-label">сценариев</span>
        </article>
      </div>

      <div className="onboarding-grid">
        <label className="field field--ghost">
          <span className="field-label">Описание вакансии</span>
          <textarea
            className="field-control"
            rows={8}
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Например: React-разработчик, TypeScript, 1+ год опыта..."
          />
        </label>

        <div className="tips-panel">
          <p className="tips-title">Как улучшить сценарий</p>
          <ul className="tips-list">
            <li>Добавьте стек, задачи и KPI — ответы станут точнее.</li>
            <li>Укажите уровень опыта и soft skills.</li>
            <li>Опишите корпоративную культуру для дополнительных вопросов.</li>
          </ul>
        </div>
      </div>

      <div className="form-grid">
        <label className="field">
          <span className="field-label">Стиль интервьюера</span>
          <select
            value={diff}
            onChange={(e) => setDiff(e.target.value)}
            className="field-control select-control"
          >
            <option value="вежливый спокойный">Легкий</option>
            <option value="нормальный">Средний</option>
            <option value="давящий строгий">Сложный</option>
          </select>
        </label>

        <div className="steps-card">
          <p className="steps-title">План сессии</p>
          <ol className="steps-list">
            <li>Сформулируйте вакансию и стиль интервьюера.</li>
            <li>Получите вопросы, отвечайте голосом или текстом.</li>
            <li>Анализируйте обратную связь и улучшайте ответы.</li>
          </ol>
        </div>
      </div>

      <div className="conversations-panel">
        <h3 className="panel-title">Сохранённые разговоры</h3>
        {conversations.length === 0 ? (
          <p className="muted">Нет сохранённых разговоров</p>
        ) : (
          <div className="conversations-list">
            {conversations.map((c) => (
              <div key={c.id} className={`conversation-item ${selectedConversationId === c.id ? "is-active" : ""}`}>
                <div className="conversation-title">{c.title}</div>
                <div className="conversation-actions">
                  <button type="button" className="chat-submit" onClick={() => handleLoadConversation(c)} style={{ marginRight: 8 }}>
                    Продолжить
                  </button>
                  <button type="button" className="chat-save" onClick={() => handleDeleteConversation(c.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cta-row">
        <button className="primary-button" onClick={startInterview}>
          Начать собеседование
        </button>
        <p className="cta-hint">Можно переключиться на голосовой режим в любой момент.</p>
      </div>
    </section>
  );

  const chatView = (
    <section className="app-card chat-card">
      <header className="chat-header">
        <div className="chat-header__col">
          <span className="hero-badge hero-badge--outline">Nurbolai session</span>
          <h1 className="chat-title">Nurbolai — собеседование</h1>
          <p className="hero-subtitle">
            Стиль: {diff}. Озвучивание {isVoiceEnabled ? "включено" : "выключено"}.
          </p>
        </div>
        <div className="chat-header__col profile-chip">
          <div className="profile-avatar">{user?.displayName?.[0] || user?.email?.[0] || "?"}</div>
          <div>
            <p className="profile-name">{user?.displayName || user?.email}</p>
            <button type="button" className="profile-logout" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
        <div className="session-pulse">
          <span className="pulse-dot" />
          <span className="pulse-label">Идет интервью</span>
        </div>
      </header>

      <div className="voice-settings">
        <div className="voice-field">
          <span className="field-label">Голос</span>
          <select
            value={selectedVoice}
            onChange={(e) => {
              setSelectedVoice(e.target.value);
              localStorage.setItem("voiceName", e.target.value);
            }}
            className="field-control select-control"
          >
            {voices.map((voice) => (
              <option key={voice.name} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>

        <div className="voice-field">
          <span className="field-label">Скорость речи</span>
          <div className="slider-control">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={rate}
              onChange={(e) => {
                setRate(e.target.value);
                localStorage.setItem("rate", e.target.value);
              }}
            />
            <span className="slider-value">{Number(rate).toFixed(1)}x</span>
          </div>
        </div>

        <div className="voice-field">
          <span className="field-label">Высота голоса</span>
          <div className="slider-control">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={pitch}
              onChange={(e) => {
                setPitch(e.target.value);
                localStorage.setItem("pitch", e.target.value);
              }}
            />
            <span className="slider-value">{Number(pitch).toFixed(1)}x</span>
          </div>
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={isVoiceEnabled}
            onChange={() => setIsVoiceEnabled(!isVoiceEnabled)}
            className="toggle-input"
          />
          <span className="toggle-track">
            <span className="toggle-thumb" />
          </span>
          <span className="toggle-label">Озвучивать ответы AI</span>
        </label>
      </div>

      <div className="chat-panel">
        <div className="chat-window glossy" ref={chatContainerRef}>
          {messages
            .filter((message) => message.role !== "system")
            .map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`message ${message.role === "user" ? "message--user" : "message--assistant"}`}
              >
                <div className="message-meta">
                  <span>{message.role === "user" ? "Вы" : "AI"}</span>
                  <span className="message-pill">{message.role === "user" ? "Ответ" : "Вопрос"}</span>
                </div>
                <p>{message.content}</p>
              </div>
            ))}
        </div>
      </div>

      <form onSubmit={sendMessage} className="chat-form">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ваш ответ..."
          className="chat-input"
        />

        <div className="chat-actions">
          <button className="chat-submit" type="submit">
            Отправить
          </button>
          <VoiceButton onSpeech={handleVoiceInput} />
          <button
            className="chat-save"
            type="button"
            onClick={handleSaveConversation}
            disabled={isSaving || !messages.length}
          >
            {isSaving ? "Сохраняю..." : "Сохранить сессию"}
          </button>
        </div>
      </form>
      {saveStatus && <p className="save-status">{saveStatus}</p>}
    </section>
  );

  const glowBackground = (
    <>
      <div className="glow glow-one" />
      <div className="glow glow-two" />
      <div className="glow glow-three" />
    </>
  );

  if (loading) {
    return (
      <main className="page-shell fancy-bg">
        {glowBackground}
        <section className="app-card loader-card">
          <div className="loader-spinner" />
          <p>Загружаем ваш профиль...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell fancy-bg">
        {glowBackground}
        <AuthPanel />
      </main>
    );
  }

  return (
    <main className="page-shell fancy-bg">
      {glowBackground}
      {started ? chatView : onboardingView}
    </main>
  );
}
