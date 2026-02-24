import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { conversationAPI, sessionAPI } from '../services/api';
import styles from './ConversationPage.module.css';

const OPENERS = {
  Open:   '¡Hola! ¿Qué tal? What\'s going on today?',
  Travel: '¿Has viajado mucho? Have you traveled much lately?',
  Food:   '¿Qué comiste hoy? What did you eat today?',
  Work:   '¿Cómo estuvo el trabajo? How\'s work been going?',
  Slang:  '¿Qué onda? What\'s up? (That\'s Mexican slang — "qué onda")',
};

// Web Speech API support check
const HAS_SPEECH = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function ConversationPage() {
  const { sessionId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const focus = state?.focus ?? 'Open';

  const [turns, setTurns]       = useState([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [listening, setListening] = useState(false);
  const [correction, setCorrection] = useState(null);
  const [tlRatio, setTlRatio]   = useState(0.3);
  const [ending, setEnding]     = useState(false);

  const scrollRef = useRef(null);
  const inputRef  = useRef(null);
  const recogRef  = useRef(null);

  // Bootstrap opening message
  useEffect(() => {
    const opener = OPENERS[focus] ?? OPENERS.Open;
    setTurns([{ role: 'assistant', content: opener, id: 'opener' }]);
    speak(opener);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, correction]);

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    // Try to find a Spanish voice
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith('es'));
    if (esVoice) utt.voice = esVoice;
    utt.lang = 'es-ES';
    utt.rate = 0.88;
    window.speechSynthesis.speak(utt);
  };

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput('');
    setCorrection(null);
    setSending(true);

    const userTurn = { role: 'user', content: trimmed, id: Date.now() };
    setTurns(prev => [...prev, userTurn]);

    try {
      const result = await conversationAPI.sendTurn({
        sessionId,
        userText: trimmed,
        turnHistory: [...turns, userTurn].slice(-10).map(t => ({ role: t.role, content: t.content })),
      });

      // Strip structured tags from display
      const clean = result.reply.replace(/\[(VOCAB|RECAST):[^\]]+\]/g, '').trim();
      const botTurn = { role: 'assistant', content: clean, id: Date.now() + 1 };

      setTurns(prev => [...prev, botTurn]);
      setTlRatio(result.tl_ratio ?? tlRatio);
      if (result.correction) setCorrection(result.correction);

      speak(clean);
    } catch (err) {
      setTurns(prev => [...prev, { role: 'assistant', content: 'Lo siento — something went wrong. Try again?', id: Date.now() + 1 }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [turns, sessionId, sending, tlRatio]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  // Web Speech API mic
  const toggleMic = () => {
    if (!HAS_SPEECH) { alert('Your browser doesn\'t support voice input. Try Chrome.'); return; }
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const recog = new SpeechRecognition();
    recog.lang = 'es-ES';
    recog.interimResults = false;
    recog.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
      sendMessage(transcript);
    };
    recog.onerror = () => setListening(false);
    recog.onend   = () => setListening(false);
    recogRef.current = recog;
    recog.start();
    setListening(true);
  };

  const endSession = async () => {
    setEnding(true);
    try {
      await sessionAPI.end(sessionId, { target_language_ratio_avg: tlRatio });
      const { receipt } = await conversationAPI.getReceipt(sessionId);
      navigate(`/receipt/${sessionId}`, { state: { receipt } });
    } catch { navigate('/'); }
  };

  const replayLast = () => {
    const last = [...turns].reverse().find(t => t.role === 'assistant');
    if (last) speak(last.content);
  };

  return (
    <div className={styles.page}>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>Spanish Chat</span>
          <div className={styles.tlPill}>
            <div className={styles.tlFill} style={{ width: `${Math.round(tlRatio * 100)}%` }} />
            <span className={styles.tlText}>{Math.round(tlRatio * 100)}% ES</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.replayBtn} onClick={replayLast} title="Replay last message">🔊</button>
          <button className={styles.endBtn} onClick={endSession} disabled={ending}>
            {ending ? '…' : 'End session'}
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className={styles.messages} ref={scrollRef}>
        {turns.map((turn, i) => (
          <div
            key={turn.id ?? i}
            className={`${styles.bubble} ${turn.role === 'user' ? styles.userBubble : styles.botBubble} slide-in`}
            style={{ animationDelay: `${i * 0.02}s` }}
          >
            {turn.content}
          </div>
        ))}

        {sending && (
          <div className={styles.botBubble + ' ' + styles.bubble + ' ' + styles.typing}>
            <span /><span /><span />
          </div>
        )}

        {correction && (
          <div className={styles.correction + ' fade-in'}>
            <span className={styles.correctionBadge}>
              {correction.correction_mode === 'explicit' ? '✏️ Fix' : '💡 Tip'}
            </span>
            <span className={styles.correctionWrong}>{correction.wrong_span}</span>
            <span className={styles.correctionArrow}>→</span>
            <span className={styles.correctionRight}>{correction.corrected_span}</span>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className={styles.inputBar}>
        <button
          className={`${styles.micBtn} ${listening ? styles.micActive : ''}`}
          onClick={toggleMic}
          title={HAS_SPEECH ? 'Click to speak' : 'Voice not supported in this browser'}
        >
          {listening ? '🔴' : '🎙️'}
        </button>
        <textarea
          ref={inputRef}
          className={styles.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type in Spanish (or English) — press Enter to send"
          rows={1}
          disabled={sending}
        />
        <button
          className={styles.sendBtn}
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || sending}
        >
          ↑
        </button>
      </div>

      {/* Hint */}
      <div className={styles.hint}>
        {HAS_SPEECH ? '🎙️ Click mic to speak · ' : ''}
        Enter to send · Shift+Enter for new line · 🔊 to replay
      </div>
    </div>
  );
}
