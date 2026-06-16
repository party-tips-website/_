/**
 * data.js — Waypoint
 * Edit this file to update affiliate IDs and content.
 * Load this BEFORE app.js in index.html.
 */

/* ============================================================
   AFFILIATE IDs  — replace placeholders with your real IDs
   ============================================================

   GetYourGuide  → sign up at partner.getyourguide.com
                   Your ID is a number e.g. 12345

   Amazon UK     → sign up at affiliate-program.amazon.co.uk
                   Your ID looks like: waypointtravel-21

   Expedia       → sign up at expedia.com/affiliate-program
                   Your ID looks like: EXPUS1234
*/
const AFFILIATES = {
  GYG_PARTNER_ID: 'YOUR_GYG_PARTNER_ID',
  AMAZON_TAG:     'YOUR_AMAZON_TAG',
  EXPEDIA_CID:    'YOUR_EXPEDIA_CID',
};

/* ============================================================
   AFFILIATE LINK BUILDERS
   ============================================================ */
const AffiliateLinks = {

  /** Expedia hotel search with check-in/out and guest count pre-filled */
  expedia(destination, checkIn, checkOut, guests) {
    const q   = encodeURIComponent(destination);
    const ci  = checkIn  ? `&startDate=${checkIn}`   : '';
    const co  = checkOut ? `&endDate=${checkOut}`     : '';
    const g   = guests   ? `&adults=${guests}`        : '';
    const cid = AFFILIATES.EXPEDIA_CID !== 'YOUR_EXPEDIA_CID'
      ? `&affcid=${AFFILIATES.EXPEDIA_CID}` : '';
    return `https://www.expedia.co.uk/Hotel-Search?destination=${q}${ci}${co}${g}${cid}`;
  },

  /** GetYourGuide destination search */
  gyg(destination) {
    const q   = encodeURIComponent(destination);
    const pid = AFFILIATES.GYG_PARTNER_ID !== 'YOUR_GYG_PARTNER_ID'
      ? `&partner_id=${AFFILIATES.GYG_PARTNER_ID}` : '';
    return `https://www.getyourguide.com/s/?q=${q}${pid}`;
  },

  /** GetYourGuide specific activity search */
  gygActivity(activityName, destination) {
    const q   = encodeURIComponent(`${activityName} ${destination}`);
    const pid = AFFILIATES.GYG_PARTNER_ID !== 'YOUR_GYG_PARTNER_ID'
      ? `&partner_id=${AFFILIATES.GYG_PARTNER_ID}` : '';
    return `https://www.getyourguide.com/s/?q=${q}${pid}`;
  },

  /** Amazon product search */
  amazon(searchTerm) {
    const q   = encodeURIComponent(searchTerm);
    const tag = AFFILIATES.AMAZON_TAG !== 'YOUR_AMAZON_TAG'
      ? `&tag=${AFFILIATES.AMAZON_TAG}` : '';
    return `https://www.amazon.co.uk/s?k=${q}${tag}`;
  },
};

/* ============================================================
   FIREBASE CONFIG
   ============================================================
   1. Go to console.firebase.google.com
   2. Create a project → Add a Web App → copy the config below
   3. Enable Authentication → Email/Password
   4. Enable Firestore Database → start in production mode
   5. Set Firestore rules (see app.js for the exact rules to paste)
*/
const FIREBASE_CONFIG = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};
