// Simble web app — vanilla ES module, Vue 3 from CDN
import { createApp, reactive, ref, computed, onMounted } from 'https://unpkg.com/vue@3.4.21/dist/vue.esm-browser.prod.js';

const API = '';  // same origin; Caddy routes /api/* to campaign-manager

async function api(method, path, body) {
  const token = localStorage.getItem('simble_token');
  const r = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    localStorage.removeItem('simble_token');
    if (path !== '/api/auth/login') location.reload();
  }
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(data?.error || r.statusText);
  return data;
}

const app = createApp({
  template: '#main-tpl',
  setup() {
    const view = ref(localStorage.getItem('simble_token') ? 'app' : 'login');
    const me = ref(null);
    const tab = ref('dashboard');
    const busy = ref(false);
    const err = ref('');

    // login state
    const email = ref(''); const password = ref('');
    const showSignup = ref(false);
    const suName = ref(''); const suDevice = ref('');
    const suErr = ref('');
    const debug = ref(''); // visible diagnostic so we can see exactly what's being sent

    // app state
    const contacts = ref([]); const contactsTotal = ref(0); const contactQuery = ref('');
    const page = ref(0);
    const campaigns = ref([]);
    const stats = reactive({ contacts: 0, campaigns: 0 });
    const showCsv = ref(false); const csvText = ref(''); const csvResult = ref('');
    const showNew = ref(false);
    const newC = reactive({ name: '', message: '', throttleMs: 2000 });
    const selectedContacts = ref([]);
    const newErr = ref('');

    async function loadMe() {
      me.value = await api('GET', '/api/clients/me');
    }

    async function loadContacts() {
      const q = encodeURIComponent(contactQuery.value || '');
      const r = await api('GET', `/api/contacts?page=${page.value}&limit=50&q=${q}`);
      contacts.value = r.contacts;
      contactsTotal.value = r.total;
      stats.contacts = r.total;
    }

    async function loadCampaigns() {
      const r = await api('GET', '/api/campaigns');
      campaigns.value = r;
      stats.campaigns = r.length;
    }

    async function login(e) {
      e?.preventDefault();
      busy.value = true; err.value = '';
      const pw = password.value;
      // Show enough about the password to spot typos / autofill / spaces, but
      // never the full value (so we can paste a screenshot without leaking).
      const masked = pw.length > 0
        ? `${pw[0] === ' ' ? '␣' : pw[0]}…${pw[pw.length-1] === ' ' ? '␣' : pw[pw.length-1]} (len=${pw.length}, charCodes=${[...pw].map(c => c.charCodeAt(0)).join(',')})`
        : '(empty)';
      debug.value = `Sending: email="${email.value}"\npassword = ${masked}`;
      console.log('[simble] login attempt', { email: email.value, pwLen: pw.length, pwCodes: [...pw].map(c => c.charCodeAt(0)) });
      try {
        const r = await api('POST', '/api/auth/login', { email: email.value, password: pw });
        debug.value = `Got 200 OK. token length=${r.token?.length}, email=${r.client?.email}, role=${r.client?.role}`;
        console.log('[simble] login OK', r.client);
        localStorage.setItem('simble_token', r.token);
        view.value = 'app';
        await afterLogin();
      } catch (e) {
        err.value = e.message;
        debug.value = `Error: ${e.message}\n(sent email="${email.value}", password length=${pw.length}, charCodes=${[...pw].map(c => c.charCodeAt(0)).join(',')})`;
        console.error('[simble] login failed', e);
      }
      busy.value = false;
    }

    async function signup() {
      busy.value = true; suErr.value = '';
      try {
        const r = await api('POST', '/api/auth/signup', {
          name: suName.value, email: email.value, password: password.value, deviceId: suDevice.value,
        });
        localStorage.setItem('simble_token', r.token);
        view.value = 'app';
        await afterLogin();
      } catch (e) { suErr.value = e.message; }
      busy.value = false;
    }

    async function afterLogin() {
      await loadMe();
      await loadContacts();
      await loadCampaigns();
    }

    function logout() {
      localStorage.removeItem('simble_token');
      location.reload();
    }

    async function importCsv() {
      busy.value = true;
      try {
        const r = await api('POST', '/api/contacts/bulk', { csv: csvText.value });
        csvResult.value = `${r.upserts} added, ${r.updates} updated, ${r.skipped} skipped`;
        csvText.value = '';
        showCsv.value = false;
        await loadContacts();
      } catch (e) { csvResult.value = 'Error: ' + e.message; }
      busy.value = false;
    }

    async function createCampaign() {
      newErr.value = '';
      if (!newC.name || !newC.message || !selectedContacts.value.length) {
        newErr.value = 'name, message, and at least one contact required';
        return;
      }
      busy.value = true;
      try {
        await api('POST', '/api/campaigns', {
          name: newC.name, message: newC.message,
          contactIds: selectedContacts.value, throttleMs: newC.throttleMs,
        });
        showNew.value = false;
        newC.name = ''; newC.message = ''; newC.throttleMs = 2000;
        selectedContacts.value = [];
        await loadCampaigns();
        // trigger send immediately
        // (could be a separate button; for now create-and-send)
        const last = campaigns.value[0];
        if (last && last.status === 'draft') {
          await api('POST', `/api/campaigns/${last._id}/send`);
        }
      } catch (e) { newErr.value = e.message; }
      busy.value = false;
    }

    onMounted(async () => {
      if (view.value === 'app') {
        try { await afterLogin(); } catch (e) { view.value = 'login'; localStorage.removeItem('simble_token'); }
      }
    });

    return {
      view, me, tab, busy, err,
      email, password, showSignup, suName, suDevice, suErr, debug, login, signup,
      contacts, contactsTotal, contactQuery, page, loadContacts,
      campaigns, stats, showCsv, csvText, csvResult, importCsv,
      showNew, newC, selectedContacts, newErr, createCampaign, logout,
    };
  },
}).mount('#app');
