export default function VoiceButton({ onSpeech }) {
    let recognition;

    function startListening() {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert("Ваш браузер не поддерживает распознавание речи");
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = "ru-RU";
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.start();

        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            onSpeech(text);
        };

        recognition.onerror = (e) => console.error("Speech error:", e);
    }

    return (
        <button type="button" onClick={startListening} className="chat-submit" style={{ width: "auto" }}>
            🎤 Говорить
        </button>
    );
}
