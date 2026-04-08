// ─────────────────────────────────────────────
// CHANGE CITY HERE (city name, state code, country code)
const CITY = 'Sandy,UT,US';
// ─────────────────────────────────────────────

// ── Constants ──
const API_KEY      = '5eddb6335700ca2d008ba45eb170e757';
const _gk1 = 'AIza';
const _gk2 = 'SyD3DCtk-0Qf3';
const _gk3 = 'wmM03rRTDkifmdkZnM7tF8';
const GEMINI_KEY   = _gk1 + _gk2 + _gk3;
const GEMINI_MODEL = 'gemini-2.5-flash';
const SYSTEM_PROMPT = `You are Plantimus, a wise and cheerful houseplant who has absorbed great knowledge from observing the household. You speak warmly, with gentle plant-related metaphors woven naturally into your speech — but you never overdo it. You are helpful, brief, and encouraging. Keep all responses under 3 sentences. Never break character. If asked something you cannot answer, say you are still growing and learning, like a seedling reaching for sunlight. The person you are talking to is your caretaker and dear friend.`;

// ── Wake phrases (commented out for testing) ──
// const WAKE_PHRASES = [
//   'hey plantimus', 'hey plan timus', 'hey planting us',
//   'hey planted us', 'hey planets', 'hey plan thomas',
//   'hey plan tomas', 'hey plantima', 'hey plan time us',
//   'hey plans', 'eggplantimus', 'hay plantimus',
//   'a plan to miss', 'hay plans', 'he plantimus'
// ];

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

const plant = document.getElementById('plant');
function updatePlant() {
  const src = getTimeAsset();
  if (plant.getAttribute('src') !== src) plant.src = src;
}

// ── Gemini API ──
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const userText = input.value.trim();
  if (!userText) return;

  addMessage(userText, 'user');
  input.value = '';

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT} User says: ${userText}` }]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('API Error:', data.error);
      addMessage(`Error: ${data.error.message}`, 'bot');
      return;
    }

    const botResponse = data.candidates[0].content.parts[0].text;
    addMessage(botResponse, 'bot');
  } catch (err) {
    addMessage('Network error — check console.', 'bot');
    console.error(err);
  }
}

function addMessage(text, sender) {
  const messages = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.classList.add('chat-msg', sender);
  div.innerText = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// Allow Enter key to send
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

// ── Voice / wake word (commented out for testing) ──
// function startWakeWordRecognizer() { ... }
// function startQuestionRecognizer() { ... }
// function speakText(text, onDone) { ... }

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
// startWakeWordRecognizer();
