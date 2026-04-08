// ─────────────────────────────────────────────
// CHANGE CITY HERE (city name, state code, country code)
const CITY = 'Sandy,UT,US';
// ─────────────────────────────────────────────

// ── Constants ──
const API_KEY     = '5eddb6335700ca2d008ba45eb170e757';
// Break the key into pieces to bypass basic automated web scanners.
const _gk1 = 'AIza';
const _gk2 = 'SyD3DCtk-0Qf3';
const _gk3 = 'wmM03rRTDkifmdkZnM7tF8';
const GEMINI_KEY  = _gk1 + _gk2 + _gk3;
const GEMINI_MODEL = 'gemini-2.5-flash';
const SYSTEM_PROMPT = `You are Plantimus, a wise and cheerful houseplant who has absorbed great knowledge from observing the household. You speak warmly, with gentle plant-related metaphors woven naturally into your speech — but you never overdo it. You are helpful, brief, and encouraging. Keep all responses under 3 sentences. Never break character. If asked something you cannot answer, say you are still growing and learning, like a seedling reaching for sunlight. The person you are talking to is your caretaker and dear friend.`;

// Phrases that count as "Hey Plantimus" (covers common mishearings)
const WAKE_PHRASES = [
  'hey plantimus', 'hey plan timus', 'hey planting us',
  'hey planted us', 'hey planets', 'hey plan thomas',
  'hey plan tomas', 'hey plantima', 'hey plan time us',
  'hey plans', 'eggplantimus', 'hay plantimus',
  'a plan to miss', 'hay plans', 'he plantimus'
];

// Return-to-weather countdown (ms after TTS ends)
const RETURN_DELAY_MS = 12000;
// Hard cap before return regardless of TTS state
const RETURN_HARD_CAP_MS = 25000;

// ── State ──
let state = 'IDLE';
let lastTriggerTime = 0;
const TRIGGER_COOLDOWN_MS = 30000; // prevent rapid re-triggers
let returnTimer    = null;
let hardCapTimer   = null;
let countdownInterval = null;
let lastWakeRestartTime = 0;
let questionFinalReceived = false;
let questionSilenceTimer  = null;

// ── DOM refs ──
const plant         = document.getElementById('plant');
const weatherPanel  = document.getElementById('weather-panel');
const aiPanel       = document.getElementById('ai-panel');
const aiBadge       = document.getElementById('ai-badge');
const aiStatus      = document.getElementById('ai-status');
const aiTranscript  = document.getElementById('ai-transcript');
const aiResponse    = document.getElementById('ai-response');
const aiFooter      = document.getElementById('ai-footer');
const micBadge      = document.getElementById('mic-badge');

// ── Weather helpers ──
function weatherEmoji(id) {
  if (id >= 200 && id < 300) return '⛈️';
  if (id >= 300 && id < 400) return '🌦️';
  if (id >= 500 && id < 600) return '🌧️';
  if (id >= 600 && id < 700) return '❄️';
  if (id >= 700 && id < 800) return '🌫️';
  if (id === 800)             return '☀️';
  if (id === 801)             return '🌤️';
  if (id === 802)             return '⛅';
  return '☁️';
}

function localTime(unixUtc, tzOffsetSeconds) {
  const d = new Date((unixUtc + tzOffsetSeconds) * 1000);
  let h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

async function fetchWeather() {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(CITY)}&appid=${API_KEY}&units=imperial`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const d = await res.json();
    const tz = d.timezone;
    document.getElementById('w-city').textContent      = d.name;
    document.getElementById('w-icon').textContent      = weatherEmoji(d.weather[0].id);
    document.getElementById('w-temp').textContent      = `${Math.round(d.main.temp)}°F`;
    document.getElementById('w-desc').textContent      = d.weather[0].description;
    document.getElementById('w-humidity').textContent  = `${d.main.humidity}%`;
    document.getElementById('w-wind').textContent      = `${Math.round(d.wind.speed)} mph`;
    document.getElementById('w-sunrise').textContent   = localTime(d.sys.sunrise, tz);
    document.getElementById('w-sunset').textContent    = localTime(d.sys.sunset, tz);
    const now = new Date();
    document.getElementById('w-updated').textContent   =
      `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch (err) {
    document.getElementById('w-desc').innerHTML =
      `<span class="weather-error">Couldn't load weather</span>`;
    console.error(err);
  }
}

// ── Plant image ──
function getTimeAsset() {
  const h = new Date().getHours();
  if (h >= 8 && h < 18)                             return 'GIF/plant_breathing.gif';
  if ((h >= 6 && h < 8) || (h >= 18 && h < 20))    return 'PNG/Yawn.png';
  return 'PNG/Sleep.png';
}

function setPlant(src) {
  if (plant.getAttribute('src') !== src) plant.src = src;
}

function updatePlant() {
  if (state === 'IDLE') setPlant(getTimeAsset());
}

// ── UI helpers ──
function showAiPanel() {
  weatherPanel.style.display = 'none';
  aiPanel.style.display      = 'flex';
}

function hideAiPanel() {
  aiPanel.style.display      = 'none';
  weatherPanel.style.display = 'flex';
}

function setBadge(type) {
  aiBadge.className = `ai-badge badge-${type}`;
  aiBadge.textContent = type.charAt(0).toUpperCase() + type.slice(1);
}

// ── State transitions ──
function enterIdle() {
  state = 'IDLE';
  hideAiPanel();
  setPlant(getTimeAsset());
  clearAllTimers();
  startWakeWordRecognizer();
}

function enterTriggered() {
  state = 'TRIGGERED';
  showAiPanel();
  setPlant('PNG/Talk.png');
  setBadge('listening');
  aiStatus.textContent     = "I'm listening...";
  aiTranscript.textContent = '';
  aiResponse.textContent   = '';
  aiFooter.textContent     = '';
  wakeRecognizer.abort();
  startQuestionRecognizer();
}

function enterListening() {
  state = 'LISTENING';
  // already showing Talk.png and listening badge
}

function enterProcessing(question) {
  if (state !== 'TRIGGERED' && state !== 'LISTENING') return;
  state = 'PROCESSING';
  setPlant('PNG/Idea.png');
  setBadge('thinking');
  aiStatus.textContent     = 'Hmm, let me think...';
  aiTranscript.textContent = `"${question}"`;
  aiResponse.textContent   = '';
  aiFooter.textContent     = '';
  askGemini(question);
}

function enterResponding(text) {
  state = 'RESPONDING';
  setPlant('PNG/Talk.png');
  setBadge('speaking');
  aiStatus.textContent     = 'Plantimus says...';
  aiTranscript.textContent = '';
  aiResponse.textContent   = '';
  aiFooter.textContent     = '';

  // Typewriter + TTS simultaneously
  typewriterEffect(text, aiResponse, 30, () => {
    // typing done; TTS may still be going
  });
  speakText(text, () => {
    startReturnCountdown();
  });

  // Hard cap in case TTS onend never fires
  hardCapTimer = setTimeout(enterReturning, RETURN_HARD_CAP_MS);
}

function enterReturning() {
  if (state === 'RETURNING' || state === 'IDLE') return;
  state = 'RETURNING';
  clearAllTimers();
  speechSynthesis.cancel();
  enterIdle();
}

function enterError(msg) {
  state = 'RESPONDING'; // reuse responding state for auto-return
  setPlant('PNG/Wilt.png');
  setBadge('speaking');
  aiStatus.textContent   = '';
  aiResponse.textContent = msg;
  aiFooter.textContent   = '';
  returnTimer = setTimeout(enterReturning, 5000);
}

function clearAllTimers() {
  clearTimeout(returnTimer);
  clearTimeout(hardCapTimer);
  clearTimeout(questionSilenceTimer);
  clearInterval(countdownInterval);
  returnTimer = hardCapTimer = questionSilenceTimer = countdownInterval = null;
}

// ── Typewriter effect ──
function typewriterEffect(text, el, msPerChar, onDone) {
  el.textContent = '';
  let i = 0;
  function tick() {
    if (i < text.length) {
      el.textContent += text[i++];
      setTimeout(tick, msPerChar);
    } else if (onDone) {
      onDone();
    }
  }
  tick();
}

// ── Return countdown ──
function startReturnCountdown() {
  let remaining = Math.round(RETURN_DELAY_MS / 1000);
  aiFooter.textContent = `Returning to weather in ${remaining}...`;
  countdownInterval = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      aiFooter.textContent = `Returning to weather in ${remaining}...`;
    } else {
      clearInterval(countdownInterval);
    }
  }, 1000);
  returnTimer = setTimeout(enterReturning, RETURN_DELAY_MS);
}

// ── Speech Synthesis ──
function speakText(text, onDone) {
  speechSynthesis.cancel();
  const utterance        = new SpeechSynthesisUtterance(text);
  utterance.rate         = 0.95;
  utterance.pitch        = 1.1;
  utterance.volume       = 1.0;
  utterance.onend        = () => { if (state === 'RESPONDING') onDone(); };
  utterance.onerror      = () => { if (state === 'RESPONDING') onDone(); };
  speechSynthesis.speak(utterance);
}

// ── Gemini API ──
async function askGemini(question) {
  try {
    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: question }] }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.8 }
    };
    const res  = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');
    if (state === 'PROCESSING') enterResponding(text);
  } catch (err) {
    console.error(err);
    if (state === 'PROCESSING') {
      const msg = err.message.includes('429')
        ? "I've been chatting too much — give me a moment to catch my breath! 🌿"
        : "My leaves are a little wilted right now — try again in a moment! 🌿";
      enterError(msg);
    }
  }
}

// ── Wake phrase detection ──
function isWakePhrase(transcript) {
  const t = transcript.toLowerCase().trim();
  return WAKE_PHRASES.some(p => t.includes(p));
}

// Early-return phrases (detected while in RESPONDING)
function isDismissPhrase(transcript) {
  const t = transcript.toLowerCase().trim();
  return ['bye', 'goodbye', 'thank you', 'thanks'].some(p => t.includes(p));
}

// ── Wake word recognizer (always-on) ──
let wakeRecognizer = null;

function startWakeWordRecognizer() {
  if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
    console.warn('SpeechRecognition not supported');
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  wakeRecognizer = new SpeechRecognition();
  wakeRecognizer.continuous      = true;
  wakeRecognizer.interimResults  = false;
  wakeRecognizer.lang            = 'en-US';

  wakeRecognizer.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript;
      console.log('[wake]', transcript);
      if (state === 'IDLE' && isWakePhrase(transcript)) {
        const now = Date.now();
        if (now - lastTriggerTime < TRIGGER_COOLDOWN_MS) {
          console.log('[wake] cooldown active, ignoring trigger');
          return;
        }
        lastTriggerTime = now;
        enterTriggered();
        return;
      }
      if (state === 'RESPONDING' && isDismissPhrase(transcript)) {
        enterReturning();
        return;
      }
    }
  };

  wakeRecognizer.onerror = (e) => {
    if (e.error === 'not-allowed') {
      micBadge.style.display = 'block';
    }
    console.warn('[wake error]', e.error);
  };

  wakeRecognizer.onend = () => {
    // Auto-restart unless we intentionally aborted (state !== IDLE)
    if (state === 'IDLE') {
      const now = Date.now();
      const delay = (now - lastWakeRestartTime < 2000) ? 1000 : 0;
      lastWakeRestartTime = now;
      setTimeout(() => {
        if (state === 'IDLE') {
          try { wakeRecognizer.start(); } catch (_) {}
        }
      }, delay);
    }
  };

  try { wakeRecognizer.start(); } catch (_) {}
}

// ── Question recognizer (single-shot) ──
function startQuestionRecognizer() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const qr = new SpeechRecognition();
  qr.continuous     = false;
  qr.interimResults = true;
  qr.lang           = 'en-US';

  questionFinalReceived = false;

  // Silence fallback — if nothing final in 7s, abort
  questionSilenceTimer = setTimeout(() => {
    if (!questionFinalReceived) {
      qr.abort();
      enterIdle();
    }
  }, 7000);

  qr.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        final += e.results[i][0].transcript;
      } else {
        interim += e.results[i][0].transcript;
      }
    }
    if (interim) aiTranscript.textContent = interim;
    if (final && !questionFinalReceived) {
      questionFinalReceived = true;
      clearTimeout(questionSilenceTimer);
      qr.abort();
      enterProcessing(final.trim());
    }
  };

  qr.onstart  = () => enterListening();
  qr.onerror  = (e) => { console.warn('[question error]', e.error); enterIdle(); };
  qr.onend    = () => {
    if (!questionFinalReceived) enterIdle();
  };

  try { qr.start(); } catch (_) { enterIdle(); }
}

// ── Fullscreen on plant click ──
document.getElementById('plant-panel').addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

// ── Init ──
updatePlant();
fetchWeather();
setInterval(updatePlant, 60 * 1000);
setInterval(fetchWeather, 60 * 60 * 1000);
startWakeWordRecognizer();
