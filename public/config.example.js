// =====================================================================
// RUNTIME API CONFIGURATION — TEMPLATE
// =====================================================================
// এই ফাইলটি git-এ থাকে। ব্যবহার করার জন্য কপি করুন:
//
//   cp public/config.example.js public/config.js
//
// তারপর public/config.js-এ নিজের environment অনুযায়ী apiUrl বসান।
// public/config.js gitignored — তাই লোকাল সেটিং ভুল করে commit বা
// deploy হয়ে যাওয়ার ঝুঁকি নেই।
//
// Rebuild ছাড়াই API URL বদলানো যায় (lib/api.ts রানটাইমে এটি পড়ে)।
// =====================================================================

window.__FARM_CONFIG__ = {
  // Production:
  // apiUrl: 'https://api.easyfarm.live/api/v1'

  // Local development:
  apiUrl: 'http://localhost:8000/api/v1'
};
