/**
 * app.js — Waypoint
 * Requires data.js to be loaded first (as a regular script tag).
 *
 * Uses Firebase for auth + Firestore user profiles.
 * Claude AI handles the entire trip planning conversation.
 * Booking redirect: Expedia (hotels), GetYourGuide (experiences), Amazon (gear).
 */

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ============================================================
   UTILITIES
   ============================================================ */
function esc(str) {
  return String(str || '').replace(/[&<>"']/g, m =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function friendlyAuthError(code) {
  return ({
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/user-not-found':       'No account found with that email.',
    'auth/wrong-password':       'Incorrect password.',
    'auth/invalid-credential':   'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/too-many-requests':    'Too many attempts — please try again later.',
  })[code] || 'Something went wrong. Please try again.';
}

/* ============================================================
   FIREBASE INIT
   ============================================================ */
let fbApp, auth, db;
let currentUser  = null;
let userProfile  = {};

const firebaseReady = FIREBASE_CONFIG.apiKey !== 'YOUR_API_KEY';

if (firebaseReady) {
  fbApp = initializeApp(FIREBASE_CONFIG);
  auth  = getAuth(fbApp);
  db    = getFirestore(fbApp);

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    if (user) {
      const snap = await getDoc(doc(db, 'users', user.uid));
      userProfile = snap.exists() ? snap.data() : {};
      populateProfilePanel();
    } else {
      userProfile = loadGuestProfile();
    }
    updateNavAuth();
  });
} else {
  userProfile = loadGuestProfile();
}

function loadGuestProfile() {
  try { return JSON.parse(localStorage.getItem('wp_profile') || '{}'); }
  catch { return {}; }
}

async function persistProfile(data) {
  if (currentUser && db) {
    await setDoc(doc(db, 'users', currentUser.uid), data, { merge: true });
  } else {
    localStorage.setItem('wp_profile', JSON.stringify(data));
  }
}

/* ============================================================
   AUTH UI
   ============================================================ */
const authOverlay = document.getElementById('authOverlay');

function openAuth() {
  showAuthView(currentUser ? 'viewProfile' : 'viewSignIn');
  authOverlay.classList.add('open');
}
function closeAuth() { authOverlay.classList.remove('open'); }
function showAuthView(id) {
  ['viewSignIn','viewSignUp','viewProfile'].forEach(v =>
    document.getElementById(v).style.display = v === id ? '' : 'none');
}

document.getElementById('closeAuth').addEventListener('click', closeAuth);
authOverlay.addEventListener('click', e => { if (e.target === authOverlay) closeAuth(); });
document.getElementById('goSignUp').addEventListener('click', () => showAuthView('viewSignUp'));
document.getElementById('goSignIn').addEventListener('click', () => showAuthView('viewSignIn'));
document.getElementById('continueGuest').addEventListener('click', closeAuth);

/* Sign in */
document.getElementById('signInBtn').addEventListener('click', async () => {
  const email = document.getElementById('siEmail').value.trim();
  const pass  = document.getElementById('siPassword').value;
  const errEl = document.getElementById('siError');
  errEl.textContent = '';
  if (!firebaseReady) { errEl.textContent = 'Firebase not configured yet — see data.js.'; return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    closeAuth(); showToast('✓ Signed in');
  } catch (e) { errEl.textContent = friendlyAuthError(e.code); }
});

/* Sign up */
document.getElementById('signUpBtn').addEventListener('click', async () => {
  const name  = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim();
  const pass  = document.getElementById('suPassword').value;
  const errEl = document.getElementById('suError');
  errEl.textContent = '';
  if (!name || !email || !pass) { errEl.textContent = 'Please fill in all fields.'; return; }
  if (!firebaseReady) { errEl.textContent = 'Firebase not configured yet — see data.js.'; return; }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, 'users', cred.user.uid), { name }, { merge: true });
    closeAuth(); showToast('✓ Account created — welcome!');
  } catch (e) { errEl.textContent = friendlyAuthError(e.code); }
});

/* Sign out */
document.getElementById('signOutBtn').addEventListener('click', async () => {
  if (auth) await signOut(auth);
  currentUser = null; userProfile = {};
  updateNavAuth(); closeAuth(); showToast('Signed out');
});

/* Save profile */
document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const p = readProfileFromPanel();
  userProfile = { ...userProfile, ...p };
  await persistProfile(p);
  closeAuth();
  showToast(currentUser ? '✓ Profile saved to your account' : '✓ Profile saved to this browser');
});

function readProfileFromPanel() {
  const p = {
    airport:     document.getElementById('pAirport').value.trim(),
    currency:    document.getElementById('pCurrency').value,
    flightClass: document.getElementById('pFlight').value,
    notes:       document.getElementById('pNotes').value.trim(),
  };
  document.querySelectorAll('.chip-group').forEach(g => {
    const active = [...g.querySelectorAll('.chip.active')].map(c => c.dataset.value);
    p[g.dataset.group] = g.dataset.multi === 'true' ? active : (active[0] || '');
  });
  return p;
}

function populateProfilePanel() {
  const p = userProfile;
  const fields = { pAirport:'airport', pCurrency:'currency', pFlight:'flightClass', pNotes:'notes' };
  Object.entries(fields).forEach(([id, key]) => {
    if (p[key]) document.getElementById(id).value = p[key];
  });
  document.querySelectorAll('.chip-group').forEach(g => {
    const saved = p[g.dataset.group];
    g.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('active',
        g.dataset.multi === 'true'
          ? Array.isArray(saved) && saved.includes(c.dataset.value)
          : saved === c.dataset.value);
    });
  });
}

function updateNavAuth() {
  const avatar = document.getElementById('navAvatar');
  const label  = document.getElementById('navLabel');
  if (currentUser) {
    const name = currentUser.displayName || currentUser.email || '';
    avatar.textContent = name.charAt(0).toUpperCase() || '?';
    label.textContent  = name.split(' ')[0] || 'Account';
    document.getElementById('profileAvatarLg').textContent = avatar.textContent;
    document.getElementById('profileName').textContent     = currentUser.displayName || '';
    document.getElementById('profileEmail').textContent    = currentUser.email || '';
  } else {
    avatar.textContent = '?';
    label.textContent  = 'Sign in';
  }
}

/* Chips */
document.querySelectorAll('.chip-group').forEach(g => {
  const multi = g.dataset.multi === 'true';
  g.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      if (!multi) g.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      if (multi) c.classList.toggle('active');
      else       c.classList.add('active');
    });
  });
});

/* ============================================================
   NAV + BURGER
   ============================================================ */
const burgerBtn = document.getElementById('burgerBtn');
const navLinks  = document.getElementById('navLinks');

burgerBtn.addEventListener('click', () => {
  burgerBtn.classList.toggle('open');
  navLinks.classList.toggle('open');
});
document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => {
  burgerBtn.classList.remove('open'); navLinks.classList.remove('open');
}));
document.getElementById('authBtn').addEventListener('click', () => {
  burgerBtn.classList.remove('open'); navLinks.classList.remove('open');
  openAuth();
});

/* ============================================================
   STATIC CONTENT — experiences grid
   ============================================================ */
(function buildPage() {
  const grid = document.getElementById('experiencesGrid');
  if (!grid) return;
  const exps = [
    { id:'EXP/01', title:'Skip-the-line Temple Tour', sponsored:true,
      desc:'Guided half-day tour of iconic temples with a local historian.',
      search:'temple tour', dest:'Kyoto' },
    { id:'EXP/02', title:'Evening Food & Market Walk', sponsored:false,
      desc:'Small-group street food crawl with tastings included.',
      search:'food market tour', dest:'Kyoto' },
    { id:'EXP/03', title:'Arashiyama Bamboo Day Trip', sponsored:false,
      desc:'Full-day escape with a scenic train ride and guided hike.',
      search:'arashiyama bamboo', dest:'Kyoto' },
  ];
  grid.innerHTML = exps.map(e => `
    <div class="feature-card">
      ${e.sponsored ? '<span class="sponsored-badge">Recommended · Sponsored</span><br>' : ''}
      <span class="step-num">${esc(e.id)}</span>
      <h3>${esc(e.title)}</h3>
      <p>${esc(e.desc)}</p>
      <div class="booking-actions">
        <a href="${AffiliateLinks.gygActivity(e.search, e.dest)}" target="_blank" rel="noopener">
          Book on GetYourGuide →</a>
      </div>
    </div>`).join('');
})();

/* ============================================================
   BOOKING REDIRECT MODAL
   ============================================================ */
const bookingModal = document.getElementById('bookingModal');
document.getElementById('closeBookingModal').addEventListener('click', () =>
  bookingModal.classList.remove('open'));
bookingModal.addEventListener('click', e => {
  if (e.target === bookingModal) bookingModal.classList.remove('open');
});

function openBookingRedirect({ platform, label, url, destination, checkIn, checkOut, guests }) {
  const names = { expedia:'Expedia', gyg:'GetYourGuide', amazon:'Amazon' };
  const platformName = names[platform] || platform;

  document.getElementById('bookingModalContent').innerHTML = `
    <h3 style="font-family:'Fraunces',serif;font-size:1.4rem;margin-bottom:5px;">
      ${esc(label)}</h3>
    ${destination ? `<p style="opacity:0.6;font-size:0.86rem;margin-bottom:16px;">${esc(destination)}</p>` : ''}
    <div class="booking-summary-box">
      <div class="booking-summary-line"><span>Book on</span><strong>${platformName}</strong></div>
      ${checkIn  ? `<div class="booking-summary-line"><span>Check-in</span><strong>${esc(checkIn)}</strong></div>`  : ''}
      ${checkOut ? `<div class="booking-summary-line"><span>Check-out</span><strong>${esc(checkOut)}</strong></div>` : ''}
      ${guests   ? `<div class="booking-summary-line"><span>Guests</span><strong>${esc(String(guests))}</strong></div>` : ''}
    </div>
    <p style="font-size:0.84rem;opacity:0.7;margin-bottom:18px;">
      You'll complete payment directly on ${platformName}.
      Waypoint earns a small referral commission at no extra cost to you.
    </p>
    <a href="${esc(url)}" target="_blank" rel="noopener"
       class="btn" style="width:100%;display:block;text-align:center;margin-bottom:8px;"
       onclick="document.getElementById('bookingModal').classList.remove('open')">
      Go to ${platformName} →
    </a>
    <p class="booking-disclaimer">
      Opens in a new tab. Payment is taken by ${platformName}, not Waypoint.
    </p>`;

  bookingModal.classList.add('open');
}

/* ============================================================
   CLAUDE AI CHATBOT — the entire trip planning experience
   ============================================================ */

const chatBubble  = document.getElementById('chatBubble');
const chatWindow  = document.getElementById('chatWindow');
const chatMsgsEl  = document.getElementById('chatMessages');
const chatQREl    = document.getElementById('chatQR');
const chatInput   = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSend');
const chatUnread  = document.getElementById('chatUnread');

let chatHistory = [];
let chatIsOpen  = false;
let chatIsBusy  = false;

/* ── System prompt ── */
function buildSystemPrompt() {
  const p    = userProfile;
  const name = currentUser?.displayName || p?.name || '';
  const bits = [];
  if (name)           bits.push(`Name: ${name}`);
  if (p.airport)      bits.push(`Home airport: ${p.airport}`);
  if (p.currency)     bits.push(`Currency: ${p.currency}`);
  if (p.flightClass)  bits.push(`Preferred flight class: ${p.flightClass}`);
  if (p.pace)         bits.push(`Travel pace: ${p.pace}`);
  if (p.diet?.length) bits.push(`Dietary needs: ${p.diet.join(', ')}`);
  if (p.notes)        bits.push(`Extra notes: ${p.notes}`);
  const profileCtx = bits.length
    ? `\n\nTRAVELLER PROFILE (use automatically — never ask about these again):\n${bits.map(b => `• ${b}`).join('\n')}`
    : '';

  return `You are Waypoint's AI travel concierge powered by Claude. You plan complete, personalised trips through friendly conversation. The user never fills in a form — everything happens through chat with you.

HOW YOU WORK:
1. Greet the user warmly and ask where they want to go (if not stated).
2. Gather information conversationally, one or two questions at a time: destination, dates, duration, number of travellers, budget (backpacker / mid-range / luxury), travel interests, any special needs. Never ask all at once.
3. Once you have enough, generate a complete day-by-day itinerary with SPECIFIC hotel names, restaurant names and attraction names. Be precise — use real places.
4. Invite the user to ask for changes. Swap hotels, adjust pace, add activities — be flexible.
5. When the user is satisfied, output BOOKING CARDS for each bookable item using this exact format (one per line, no other text on that line):

Hotels → [BOOK:{"platform":"expedia","label":"Hotel Name","destination":"City, Country","checkIn":"YYYY-MM-DD","checkOut":"YYYY-MM-DD","guests":2,"search":"hotel name city"}]
Experiences/tours → [BOOK:{"platform":"gyg","label":"Tour Name","destination":"City","search":"tour name city"}]
Packing items → [BOOK:{"platform":"amazon","label":"Item Name","search":"item search term"}]

Output one BOOK card per hotel and per recommended experience. After the booking cards, also output a packing list as BOOK cards.

RULES:
• Keep messages warm, concise and conversational — short paragraphs or brief bullet lists.
• Only suggest Expedia for hotels, GetYourGuide for tours/experiences, and Amazon for gear. No other platforms.
• Never output raw URLs. Use BOOK cards only.
• If asked about flights, explain you focus on hotels and experiences, and suggest the user checks Google Flights or Skyscanner separately.
• Never invent specific prices — give realistic ranges instead (e.g. "mid-range hotels here typically run £80–£140/night").
• Always be enthusiastic and helpful — you love travel.${profileCtx}`;
}

/* ── Render a message, parsing BOOK cards into tappable buttons ── */
function renderMessage(role, rawText, typing = false) {
  const wrap = document.createElement('div');
  wrap.className = `chat-msg ${role}${typing ? ' typing' : ''}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (typing) {
    bubble.innerHTML = `<span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>`;
    wrap.appendChild(bubble);
    chatMsgsEl.appendChild(wrap);
    chatMsgsEl.scrollTop = chatMsgsEl.scrollHeight;
    return wrap;
  }

  // Split into text and BOOK cards
  const segments = rawText.split(/(\[BOOK:\{[^}]+\}\])/g);

  segments.forEach(seg => {
    const match = seg.match(/^\[BOOK:(\{[^}]+\})\]$/);
    if (match) {
      try {
        const d = JSON.parse(match[1]);
        let url = '#';
        if (d.platform === 'expedia')
          url = AffiliateLinks.expedia(d.search || d.destination, d.checkIn, d.checkOut, d.guests);
        else if (d.platform === 'gyg')
          url = AffiliateLinks.gygActivity(d.search || d.label, d.destination || '');
        else if (d.platform === 'amazon')
          url = AffiliateLinks.amazon(d.search || d.label);

        const platformLabel = { expedia:'Expedia', gyg:'GetYourGuide', amazon:'Amazon' }[d.platform] || d.platform;

        const card = document.createElement('div');
        card.className = 'chat-book-card';

        const meta = [
          d.destination,
          d.checkIn  ? `${d.checkIn} → ${d.checkOut}` : '',
          d.guests   ? `${d.guests} guest${d.guests > 1 ? 's' : ''}` : '',
        ].filter(Boolean).join(' · ');

        card.innerHTML = `
          <h4>${esc(d.label)}</h4>
          ${meta ? `<div class="book-meta">${esc(meta)}</div>` : ''}
          <button class="chat-book-btn primary"
            data-url="${esc(url)}"
            data-platform="${esc(d.platform)}"
            data-label="${esc(d.label)}"
            data-dest="${esc(d.destination || '')}"
            data-checkin="${esc(d.checkIn || '')}"
            data-checkout="${esc(d.checkOut || '')}"
            data-guests="${esc(String(d.guests || ''))}">
            Book on ${platformLabel} →
          </button>`;
        bubble.appendChild(card);
      } catch { /* skip malformed card */ }

    } else if (seg.trim()) {
      const p = document.createElement('p');
      p.style.marginBottom = '5px';
      p.innerHTML = esc(seg.trim())
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      bubble.appendChild(p);
    }
  });

  wrap.appendChild(bubble);
  chatMsgsEl.appendChild(wrap);

  // Wire book buttons
  wrap.querySelectorAll('.chat-book-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openBookingRedirect({
        platform:    btn.dataset.platform,
        label:       btn.dataset.label,
        url:         btn.dataset.url,
        destination: btn.dataset.dest,
        checkIn:     btn.dataset.checkin,
        checkOut:    btn.dataset.checkout,
        guests:      btn.dataset.guests,
      });
    });
  });

  chatMsgsEl.scrollTop = chatMsgsEl.scrollHeight;
  return wrap;
}

/* ── Quick replies ── */
function showQR(replies) {
  chatQREl.innerHTML = replies.map(r =>
    `<button class="qr-chip" data-msg="${esc(r)}">${esc(r)}</button>`).join('');
  chatQREl.querySelectorAll('.qr-chip').forEach(btn =>
    btn.addEventListener('click', () => {
      chatQREl.innerHTML = '';
      sendChat(btn.dataset.msg);
    }));
}

/* ── Open / close ── */
function openChat() {
  chatIsOpen = true;
  chatWindow.classList.add('open');
  chatUnread.classList.remove('show');

  if (chatHistory.length === 0) {
    const name = currentUser?.displayName?.split(' ')[0] || '';
    const greeting = name
      ? `Hi ${name}! I'm your Waypoint AI travel planner. Where in the world are you thinking of going? 🌍`
      : `Hi! I'm your Waypoint AI travel planner. Tell me where you'd love to go and I'll plan your entire trip — hotels, activities, a day-by-day itinerary — all through our conversation. Where are you thinking? 🌍`;
    renderMessage('ai', greeting);
    showQR(['Europe', 'Japan', 'South East Asia', 'USA', 'Beach holiday', 'City break']);
  }

  setTimeout(() => chatInput.focus(), 150);
}

function closeChat() { chatIsOpen = false; chatWindow.classList.remove('open'); }

chatBubble.addEventListener('click', () => chatIsOpen ? closeChat() : openChat());
document.getElementById('chatClose').addEventListener('click', closeChat);
document.getElementById('heroStartChat').addEventListener('click', openChat);

/* ── Input ── */
chatInput.addEventListener('input', () => {
  chatSendBtn.disabled = chatIsBusy || !chatInput.value.trim();
});
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !chatSendBtn.disabled) {
    e.preventDefault(); sendChat(chatInput.value.trim());
  }
});
chatSendBtn.addEventListener('click', () => {
  if (!chatSendBtn.disabled) sendChat(chatInput.value.trim());
});

/* ── Send to Claude ── */
async function sendChat(text) {
  if (!text || chatIsBusy) return;

  chatQREl.innerHTML = '';
  chatInput.value = '';
  chatSendBtn.disabled = true;
  chatIsBusy = true;

  renderMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  const typing = renderMessage('ai', '', true);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 2048,
        system:     buildSystemPrompt(),
        messages:   chatHistory.map(m => ({
          role:    m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      }),
    });

    const data  = await res.json();
    if (data.error) throw new Error(data.error.message);
    const reply = data.content.map(b => b.text || '').join('').trim();

    typing.remove();
    renderMessage('ai', reply);
    chatHistory.push({ role: 'assistant', content: reply });

  } catch (err) {
    typing.remove();
    renderMessage('ai', "Sorry, I couldn't connect right now. Please try again in a moment.");
    console.error('Chat error:', err);
  }

  chatIsBusy = false;
  chatSendBtn.disabled = !chatInput.value.trim();
}

// Show dot on first visit
if (chatHistory.length === 0) chatUnread.classList.add('show');
