/* Cancer Registry Workspace (ระบบบันทึกและติดตามงานทะเบียนมะเร็ง)
 * - โหมดใช้งานจริง: Supabase Auth + PostgreSQL (RLS) + Private Storage
 * - โหมดตัวอย่าง (config.js ว่าง): ข้อมูลสมมติเก็บในเบราว์เซอร์นี้เท่านั้น ใช้ทดลองทุกฟังก์ชันได้
 */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CONFIG = window.APP_CONFIG || {};
const LIVE = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
const MAX_ROWS = 5000, PAGE_SIZE = 15, MAX_FILE = 10 * 1024 * 1024;
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const STATUSES = ['กำลังดำเนินการ', 'รอข้อมูล', 'เสร็จสิ้น'];
const SHADES = ['#9E76B4', '#5f3a77', '#c7a6d8', '#7d5596', '#e0cdea', '#3d2350', '#b48fc7'];

/* ---------- icons ---------- */
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
  upload: '<path d="M12 16V5m0 0-4 4m4-4 4 4M5 20h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  clip: '<path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  done: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  ribbon: '<path d="M12 3c-2.2 0-3.6 1.7-3.6 3.7 0 2.3 1.6 4.3 3.6 7.1 2-2.8 3.6-4.8 3.6-7.1C15.6 4.7 14.2 3 12 3z"/><path d="M10.2 11.3 5.5 21M13.8 11.3 18.5 21"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'
};
const icon = name => `<span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg></span>`;
const hydrateIcons = (root = document) => root.querySelectorAll('[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon).replace('class="ico"', `class="${el.className}"`); });

/* ---------- หมวดงาน (อ้างอิงหัวตาราง Excel) ---------- */
const f = (label, type = 'text', opts = {}) => ({ label, type, ...opts });
const CATEGORIES = [
  { id: 'service', name: 'บริการข้อมูล', desc: 'คำขอข้อมูลและโครงการวิจัย', icon: 'db', fields: [f('โครงการวิจัย', 'text', { wide: true }), f('จำนวนผู้ป่วย', 'number'), f('ผู้ขอข้อมูล'), f('วันรับงาน', 'date'), f('วันส่งงาน', 'date')] },
  { id: 'sso', name: 'SSO', desc: 'ทะเบียนผู้ป่วยและการส่งต่อ', icon: 'user', fields: [f('HN', 'text', { key: true }), f('CaseNo'), f('ชื่อผู้ป่วย'), f('โรงพยาบาลส่งต่อ'), f('การวินิจฉัย', 'text', { wide: true })] },
  { id: 'tcb1', name: 'TCB+ 1', desc: 'บันทึกทะเบียนมะเร็ง ชุดที่ 1', icon: 'ribbon', fields: [f('HN', 'text', { key: true }), f('ชื่อผู้ป่วย'), f('ตำแหน่งมะเร็ง', 'text', { wide: true })] },
  { id: 'tcb2', name: 'TCB+ 2', desc: 'บันทึกทะเบียนมะเร็ง ชุดที่ 2', icon: 'ribbon', fields: [f('HN', 'text', { key: true }), f('ชื่อผู้ป่วย'), f('ตำแหน่งมะเร็ง'), f('วันที่วินิจฉัย', 'date')] },
  { id: 'training', name: 'สอน / อบรม / ให้คำปรึกษา', desc: 'การถ่ายทอดความรู้และสถิติ', icon: 'book', fields: [f('เวลา', 'time'), f('หัวข้อ'), f('ผู้อบรม/ผู้ร่วมประชุม'), f('จำนวนคน', 'number'), f('ผู้ให้คำปรึกษา')] },
  { id: 'newcase', name: 'ผู้ป่วยใหม่ / การเสียชีวิต', desc: 'สรุปผลงานการลงข้อมูลรายวัน', icon: 'pulse', fields: [f('ลงข้อมูลผู้ป่วยใหม่', 'number'), f('ลงข้อมูลเสียชีวิต', 'number')] },
  { id: 'meeting', name: 'ประชุม', desc: 'ประชุมวิชาการและคณะทำงาน', icon: 'people', fields: [f('เวลา', 'time'), f('สถานที่'), f('ผู้ร่วมประชุม', 'text', { wide: true })] }
].map((c, i) => ({ ...c, color: SHADES[i % SHADES.length] }));
const cat = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
const ALL_FIELDS = [...new Set(CATEGORIES.flatMap(c => c.fields.map(x => x.label)))];

/* ---------- วันที่ ---------- */
const todayISO = () => new Date().toLocaleDateString('en-CA');
const thDate = (iso, opts = { day: 'numeric', month: 'short', year: '2-digit' }) => iso ? new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('th-TH', opts) : '-';
const thDateTime = iso => iso ? new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const fmt = n => Number(n || 0).toLocaleString('th-TH');
const iso = d => d.toLocaleDateString('en-CA');

/* ---------- state ---------- */
const state = {
  user: null, memberName: '', isMember: false, records: [],
  view: 'dashboard', sort: { key: 'work_date', dir: -1 }, page: 1,
  editingId: null, editCategory: 'service', viewing: null, pendingFile: null
};

/* =========================================================
 *  Data stores
 * ========================================================= */
const DEMO_KEY = 'cancer-registry-demo-v2';
const DemoStore = {
  user: { id: 'demo-user', email: 'demo@example.local' },
  name: 'ผู้ทดลองใช้ (โหมดตัวอย่าง)',
  async init() { this.records = this.read() || this.seed(); this.write(); setSession(this.user); },
  read() { try { return JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { return null; } },
  write() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.records)); return true; } catch { return false; } },
  seed() {
    const people = [['demo-user', this.name], ['demo-other', 'เจ้าหน้าที่ตัวอย่าง ข']];
    const samples = {
      service: [['ขอข้อมูลผู้ป่วยมะเร็งเต้านม ปี 2567', { 'โครงการวิจัย': 'การรอดชีพผู้ป่วยมะเร็งเต้านม (สมมติ)', 'จำนวนผู้ป่วย': 120, 'ผู้ขอข้อมูล': 'ภาควิชาตัวอย่าง' }], ['ขอสถิติมะเร็งปอดรายปี', { 'โครงการวิจัย': 'แนวโน้มมะเร็งปอด (สมมติ)', 'จำนวนผู้ป่วย': 80, 'ผู้ขอข้อมูล': 'หน่วยระบาดวิทยาตัวอย่าง' }]],
      sso: [['ส่งต่อผู้ป่วยรายใหม่', { HN: '0001234', CaseNo: 'S-001', 'ชื่อผู้ป่วย': 'ผู้ป่วยสมมติ ก', 'โรงพยาบาลส่งต่อ': 'รพ.ตัวอย่าง', 'การวินิจฉัย': 'C50.9' }], ['ตรวจสอบเอกสารส่งต่อ', { HN: '0005678', CaseNo: 'S-002', 'ชื่อผู้ป่วย': 'ผู้ป่วยสมมติ ข', 'โรงพยาบาลส่งต่อ': 'รพ.สมมติ', 'การวินิจฉัย': 'C34.1' }]],
      tcb1: [['ลงทะเบียน TCB+ ชุด 1', { HN: '0002468', 'ชื่อผู้ป่วย': 'ผู้ป่วยสมมติ ค', 'ตำแหน่งมะเร็ง': 'ลำไส้ใหญ่' }]],
      tcb2: [['ลงทะเบียน TCB+ ชุด 2', { HN: '0001357', 'ชื่อผู้ป่วย': 'ผู้ป่วยสมมติ ง', 'ตำแหน่งมะเร็ง': 'ปากมดลูก' }]],
      training: [['อบรมการลงรหัส ICD-O-3', { 'เวลา': '09:00', 'หัวข้อ': 'ICD-O-3 เบื้องต้น', 'จำนวนคน': 25 }], ['ให้คำปรึกษาสถิติแก่นักศึกษา', { 'เวลา': '13:30', 'หัวข้อ': 'การวิเคราะห์การรอดชีพ', 'จำนวนคน': 3 }]],
      newcase: [['สรุปการลงข้อมูลประจำวัน', { 'ลงข้อมูลผู้ป่วยใหม่': 18, 'ลงข้อมูลเสียชีวิต': 4 }], ['สรุปการลงข้อมูลประจำวัน', { 'ลงข้อมูลผู้ป่วยใหม่': 22, 'ลงข้อมูลเสียชีวิต': 2 }], ['สรุปการลงข้อมูลประจำวัน', { 'ลงข้อมูลผู้ป่วยใหม่': 15, 'ลงข้อมูลเสียชีวิต': 6 }]],
      meeting: [['ประชุมคณะทำงานทะเบียนมะเร็ง', { 'เวลา': '10:00', 'สถานที่': 'ห้องประชุมตัวอย่าง', 'ผู้ร่วมประชุม': 'คณะทำงาน 8 คน' }]]
    };
    const out = []; let n = 0; const now = new Date();
    for (const [category, list] of Object.entries(samples)) list.forEach(([title, details], j) => {
      const d = new Date(now); d.setDate(d.getDate() - (n * 11 + j * 5) % 170);
      const [created_by, author_name] = people[n % 2];
      const ts = new Date(d.getTime() + 9 * 3600e3).toISOString();
      out.push({ id: `demo-${n}`, category, title, work_date: iso(d), status: STATUSES[(n + j) % 3], details, notes: n % 3 ? '' : 'ข้อมูลสมมติสำหรับทดลองใช้งาน', created_by, author_name, file_path: null, file_name: null, created_at: ts, updated_at: ts });
      n++;
    });
    return out;
  },
  async list() { return [...this.records]; },
  async save(id, rec, file) {
    let fileFields = {};
    if (file) {
      if (file.size > 2 * 1024 * 1024) throw Error('โหมดตัวอย่างเก็บไฟล์ได้ไม่เกิน 2 MB (ระบบจริงรองรับ 10 MB)');
      const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
      fileFields = { file_path: `demo-user/${crypto.randomUUID()}`, file_name: file.name, file_data: data };
    }
    const now = new Date().toISOString();
    if (id) {
      const i = this.records.findIndex(r => r.id === id);
      if (i < 0 || this.records[i].created_by !== this.user.id) throw Error('ไม่มีสิทธิ์บันทึกรายการนี้ (แก้ไขได้เฉพาะรายการของตนเอง)');
      this.records[i] = { ...this.records[i], ...rec, ...fileFields, updated_at: now };
    } else {
      this.records.unshift({ id: crypto.randomUUID(), ...rec, file_path: null, file_name: null, ...fileFields, created_by: this.user.id, author_name: this.name, created_at: now, updated_at: now });
    }
    if (!this.write()) { this.records = this.read() || this.records; throw Error('พื้นที่เก็บในเบราว์เซอร์เต็ม ลองไฟล์ที่เล็กลง'); }
  },
  async openFile(r) {
    if (!r.file_data) throw Error('ไม่พบไฟล์ตัวอย่าง');
    const blob = await (await fetch(r.file_data)).blob();
    return URL.createObjectURL(blob);
  },
  reset() { try { localStorage.removeItem(DEMO_KEY); } catch {} this.records = this.seed(); this.write(); }
};

const LiveStore = {
  client: null,
  async init() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm');
    this.client = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    await setSession(data.session?.user || null);
    this.client.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      setTimeout(() => setSession(s?.user || null), 0);
    });
  },
  async signInGoogle() {
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } }
    });
    if (error) throw error;
  },
  async signIn(email, password) { const { error } = await this.client.auth.signInWithPassword({ email, password }); if (error) throw error; },
  async signOut() { const { error } = await this.client.auth.signOut(); if (error) throw error; },
  async member(uid) {
    const { data, error } = await this.client.from('team_members').select('display_name').eq('user_id', uid).maybeSingle();
    if (error) throw error; return data;
  },
  async list() {
    const { data, error } = await this.client.from('work_records').select('*')
      .order('work_date', { ascending: false }).order('created_at', { ascending: false }).limit(MAX_ROWS);
    if (error) throw error; return data;
  },
  async save(id, rec, file) {
    const db = this.client, old = id ? state.records.find(x => x.id === id) : null;
    let uploaded = null;
    try {
      if (file) {
        uploaded = `${state.user.id}/${crypto.randomUUID()}`;
        const { error } = await db.storage.from('documents').upload(uploaded, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        rec = { ...rec, file_path: uploaded, file_name: file.name };
      }
      const q = id ? db.from('work_records').update(rec).eq('id', id) : db.from('work_records').insert(rec);
      const { data, error } = await q.select('id');
      if (error) throw error;
      if (!data?.length) throw Error('ไม่มีสิทธิ์บันทึกรายการนี้ (แก้ไขได้เฉพาะรายการของตนเอง)');
      uploaded = null;
      if (file && old?.file_path && old.created_by === state.user.id) await db.storage.from('documents').remove([old.file_path]);
    } catch (e) {
      if (uploaded) await db.storage.from('documents').remove([uploaded]);
      throw e;
    }
  },
  async openFile(r) {
    const { data, error } = await this.client.storage.from('documents').createSignedUrl(r.file_path, 60);
    if (error) throw error; return data.signedUrl;
  }
};
const store = LIVE ? LiveStore : DemoStore;

/* =========================================================
 *  Session
 * ========================================================= */
let lastUid;
async function setSession(user) {
  const uid = user?.id || null;
  if (LIVE && lastUid !== undefined && uid === lastUid) return;
  lastUid = uid; state.user = user; state.memberName = ''; state.isMember = false; state.records = [];
  $('#loginScreen').hidden = !!user || !LIVE;
  $('#app').hidden = LIVE && !user;
  $('#logout').hidden = !LIVE || !user;
  if (!user) { closeAll(); return; }
  if (!LIVE) { state.memberName = DemoStore.name; state.isMember = true; }
  else {
    try {
      const m = await LiveStore.member(user.id);
      state.isMember = !!m; state.memberName = m?.display_name || '';
    } catch (e) { showNotice(`ตรวจสอบสิทธิ์ไม่ได้: ${e.message}`, 'warn'); }
  }
  renderIdentity();
  await reload();
}
async function reload() {
  if (LIVE && !state.isMember) {
    state.records = []; render();
    showNotice(`บัญชี ${state.user?.email || ''} ยังไม่ได้รับสิทธิ์ในทีม กรุณาแจ้งอีเมลนี้กับผู้ดูแลระบบเพื่อเพิ่มเป็นสมาชิก แล้วโหลดหน้านี้ใหม่`, 'warn');
    return;
  }
  try {
    state.records = await store.list();
    if (!LIVE) showNotice('โหมดตัวอย่าง · ข้อมูลทั้งหมดเป็นข้อมูลสมมติและเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ทดลองเพิ่ม แก้ไข และแนบไฟล์ได้ · ตั้งค่า Supabase ตาม README เพื่อใช้งานจริงหลายคน', '', 'reset');
    else if (state.records.length >= MAX_ROWS) showNotice(`แสดง ${fmt(MAX_ROWS)} รายการล่าสุด ยอดสรุปคำนวณจากรายการที่แสดงเท่านั้น`, 'warn');
    else showNotice('');
  } catch (e) { showNotice(`โหลดข้อมูลไม่ได้: ${e.message}`, 'warn'); }
  render();
}
function renderIdentity() {
  const name = state.memberName || state.user?.email || '-';
  $('#identity').textContent = name;
  $('#identitySub').textContent = LIVE ? (state.isMember ? state.user.email : 'ยังไม่ได้รับสิทธิ์') : 'โหมดตัวอย่าง';
  $('#avatar').textContent = name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || 'CR';
  const b = $('#modeBadge'); b.textContent = LIVE ? 'เชื่อมต่อฐานข้อมูลแล้ว' : 'โหมดตัวอย่าง'; b.classList.toggle('live', LIVE);
}
function showNotice(text, kind = '', action = '') {
  const n = $('#notice'); n.hidden = !text; n.className = 'notice' + (kind ? ' ' + kind : '');
  n.innerHTML = text ? `${icon('info')}<span>${esc(text)}</span>${action === 'reset' ? '<button class="btn" data-action="reset-demo">รีเซ็ตข้อมูลตัวอย่าง</button>' : ''}` : '';
}

/* =========================================================
 *  Filtering / sorting
 * ========================================================= */
const F = { from: $('#from'), to: $('#to'), category: $('#categoryFilter'), status: $('#statusFilter'), q: $('#search') };
F.category.innerHTML = '<option value="">ทุกหมวดงาน</option>' + CATEGORIES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
F.status.innerHTML = '<option value="">ทุกสถานะ</option>' + STATUSES.map(s => `<option>${s}</option>`).join('');
$('#status').innerHTML = STATUSES.map(s => `<option>${s}</option>`).join('');

function filtered({ ignoreCategory = false } = {}) {
  const q = F.q.value.trim().toLowerCase();
  return state.records.filter(r =>
    (!F.from.value || r.work_date >= F.from.value) &&
    (!F.to.value || r.work_date <= F.to.value) &&
    (ignoreCategory || !F.category.value || r.category === F.category.value) &&
    (!F.status.value || r.status === F.status.value) &&
    (!q || [r.title, r.author_name, r.notes, r.file_name, cat(r.category).name, ...Object.values(r.details || {})].join(' ').toLowerCase().includes(q)));
}
function sorted(list) {
  const { key, dir } = state.sort;
  const val = r => key === 'category' ? cat(r.category).name : (r[key] ?? '');
  return [...list].sort((a, b) => {
    const c = String(val(a)).localeCompare(String(val(b)), 'th');
    return c ? c * dir : String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

/* =========================================================
 *  Render
 * ========================================================= */
const VIEWS = {
  dashboard: { title: 'ภาพรวมการทำงาน', eyebrow: 'WORKSPACE OVERVIEW', sub: 'ทุกงานเป็นระบบ ทุกข้อมูลอยู่ในที่เดียว' },
  records: { title: 'บันทึกงานทั้งหมด', eyebrow: 'WORK RECORDS', sub: 'ค้นหา กรอง เรียงลำดับ และเปิดดูรายละเอียดงานของทีม' },
  documents: { title: 'คลังเอกสาร', eyebrow: 'DOCUMENT LIBRARY', sub: 'เอกสารแนบจากบันทึกงาน เปิดด้วยลิงก์ชั่วคราวที่หมดอายุใน 60 วินาที' }
};
function render() {
  const v = VIEWS[state.view];
  $('#pageTitle').textContent = F.category.value && state.view === 'records' ? cat(F.category.value).name : v.title;
  $('#eyebrow').textContent = v.eyebrow; $('#pageSub').textContent = v.sub; $('#crumbPage').textContent = v.title;
  $$('#mainNav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === state.view && !(state.view === 'records' && F.category.value)));
  $('#dashboard').hidden = state.view !== 'dashboard';
  $('#tableCard').hidden = state.view === 'documents';
  $('#documents').hidden = state.view !== 'documents';
  $('#seeAll').hidden = state.view !== 'dashboard';
  $$('#quickRange button').forEach(b => b.classList.toggle('on', b.dataset.range === activeRange));

  const data = filtered();
  $('#navCountRecords').textContent = fmt(state.records.length);
  $('#navCountDocs').textContent = fmt(state.records.filter(r => r.file_path).length);
  renderCategoryNav();
  if (state.view === 'dashboard') renderDashboard(data);
  if (state.view !== 'documents') renderTable(data);
  else renderDocuments(data);
}

function renderCategoryNav() {
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.id, 0]));
  state.records.forEach(r => counts[r.category] = (counts[r.category] || 0) + 1);
  $('#categoryNav').innerHTML = CATEGORIES.map(c => `<button class="nav-item ${state.view === 'records' && F.category.value === c.id ? 'active' : ''}" data-nav-cat="${c.id}"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}<span class="count">${fmt(counts[c.id])}</span></button>`).join('');
}

function renderDashboard(data) {
  const done = data.filter(r => r.status === 'เสร็จสิ้น').length;
  const waiting = data.filter(r => r.status === 'รอข้อมูล').length;
  const docs = data.filter(r => r.file_path).length;
  const pct = data.length ? Math.round(done / data.length * 100) : 0;
  const nc = data.filter(r => r.category === 'newcase');
  const sum = k => nc.reduce((a, r) => a + (Number(r.details?.[k]) || 0), 0);
  $('#stats').innerHTML = [
    { cls: 'accent', ic: 'chart', label: 'บันทึกงานทั้งหมด', val: data.length, unit: 'รายการตามตัวกรอง' },
    { ic: 'done', label: 'ดำเนินการเสร็จแล้ว', val: done, unit: `${pct}% ของทั้งหมด`, meter: pct },
    { ic: 'clock', label: 'อยู่ระหว่างดำเนินการ', val: data.length - done, unit: waiting ? `รอข้อมูล ${fmt(waiting)} รายการ` : 'รายการ' },
    { ic: 'pulse', label: 'ลงข้อมูลผู้ป่วยใหม่ / เสียชีวิต', val: `${fmt(sum('ลงข้อมูลผู้ป่วยใหม่'))} / ${fmt(sum('ลงข้อมูลเสียชีวิต'))}`, unit: `ยอดรวมจากหมวดผู้ป่วยใหม่ · เอกสารแนบ ${fmt(docs)} ไฟล์` }
  ].map(s => `<div class="stat ${s.cls || ''}"><div class="ico-wrap">${icon(s.ic)}</div><span>${s.label}</span><b>${typeof s.val === 'number' ? fmt(s.val) : s.val}</b><small>${s.unit}</small>${s.meter !== undefined ? `<div class="meter"><i style="width:${s.meter}%"></i></div>` : ''}</div>`).join('');

  // ปริมาณงานรายเดือน: 6 เดือนต่อเนื่อง สิ้นสุดที่ "ถึง" หรือเดือนล่าสุดที่มีข้อมูล/เดือนปัจจุบัน
  const endIso = F.to.value || [todayISO(), ...data.map(r => r.work_date)].sort().pop();
  const end = new Date(endIso.slice(0, 7) + '-01T12:00:00');
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(end); d.setMonth(d.getMonth() - 5 + i); return iso(d).slice(0, 7); });
  const counts = months.map(m => data.filter(r => r.work_date.startsWith(m)).length);
  const max = Math.max(...counts, 1);
  $('#monthly').innerHTML = months.map((m, i) => `<div class="barcol" title="${thDate(m + '-01', { month: 'long', year: 'numeric' })}: ${counts[i]} รายการ"><b>${counts[i] || ''}</b><div class="bar" style="height:${Math.max(counts[i] / max * 170, counts[i] ? 6 : 3)}px"></div><span class="lbl">${thDate(m + '-01', { month: 'short', year: '2-digit' })}</span></div>`).join('');
  $('#monthly').parentElement.classList.add('monthly-wrap');

  // donut
  const all = filtered({ ignoreCategory: false });
  const byCat = CATEGORIES.map(c => ({ c, n: all.filter(r => r.category === c.id).length }));
  let acc = 0; const total = all.length;
  const stops = byCat.filter(x => x.n).map(x => { const a = acc / total * 360; acc += x.n; return `${x.c.color} ${a}deg ${acc / total * 360}deg`; });
  $('#donut').style.background = total ? `conic-gradient(${stops.join(',')})` : 'var(--pale)';
  $('#donutTotal').textContent = fmt(total);
  $('#legend').innerHTML = byCat.map(x => `<li><span class="dot" style="background:${x.c.color}"></span>${esc(x.c.name)}<b>${fmt(x.n)}</b><small>${total ? Math.round(x.n / total * 100) : 0}%</small></li>`).join('');

  // category cards
  $('#categories').innerHTML = CATEGORIES.map(c => {
    const n = data.filter(r => r.category === c.id).length;
    return `<button class="category" data-new-cat="${c.id}"><span class="cat-ico" style="background:${c.color}22;color:${c.color === '#e0cdea' ? '#7d5596' : c.color}">${icon(c.icon)}</span><span><strong>${esc(c.name)}</strong><small>${esc(c.desc)}</small></span><span class="num">${fmt(n)}</span><span class="plus">＋ บันทึก</span></button>`;
  }).join('');
}

function summary(r) {
  const c = cat(r.category), d = r.details || {};
  return c.fields.slice(0, 3).map(x => d[x.label] !== undefined && d[x.label] !== null && d[x.label] !== '' ? `${x.label}: ${x.type === 'date' ? thDate(d[x.label]) : d[x.label]}` : '').filter(Boolean).join(' · ');
}
function statusBadge(s) { return `<span class="badge ${s === 'เสร็จสิ้น' ? 'done' : s === 'รอข้อมูล' ? 'wait' : ''}">${esc(s)}</span>`; }

function renderTable(data) {
  const isDash = state.view === 'dashboard';
  const list = isDash ? sorted(data).slice(0, 8) : sorted(data);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const rows = isDash ? list : list.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
  $('#tableTitle').textContent = isDash ? 'รายการล่าสุด' : 'รายการบันทึกงาน';
  $('#total').textContent = `${fmt(data.length)} รายการ`;
  $$('th[data-sort]').forEach(th => { th.classList.toggle('sorted', th.dataset.sort === state.sort.key); th.classList.toggle('asc', state.sort.dir === 1); });
  $$('th:nth-child(4)').forEach(th => th.classList.add('hide-col'));
  $('#rows').innerHTML = rows.map(r => {
    const c = cat(r.category), sub = summary(r);
    return `<tr data-open="${esc(r.id)}" tabindex="0">
      <td class="date">${thDate(r.work_date)}</td>
      <td><div class="t">${esc(r.title)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</td>
      <td><span class="chip"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}</span></td>
      <td class="hide-col">${esc(r.author_name)}${state.user && r.created_by === state.user.id ? ' <small class="muted">(คุณ)</small>' : ''}</td>
      <td>${statusBadge(r.status)}</td>
      <td class="center">${r.file_path ? `<span class="file-ico" title="${esc(r.file_name)}">${icon('clip')}</span>` : '<span class="muted">–</span>'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="empty">${icon('list')}<div>${state.records.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีบันทึกงาน เริ่มต้นด้วยปุ่ม “บันทึกงานใหม่”'}</div></td></tr>`;
  const p = $('#pager');
  if (isDash || pages <= 1) { p.innerHTML = ''; return; }
  const nums = [...new Set([1, state.page - 1, state.page, state.page + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  let html = `<span class="muted">แสดง ${fmt((state.page - 1) * PAGE_SIZE + 1)}–${fmt(Math.min(state.page * PAGE_SIZE, list.length))} จาก ${fmt(list.length)}</span><button data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="ก่อนหน้า">‹</button>`;
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) html += '<span class="muted">…</span>'; html += `<button data-page="${n}" class="${n === state.page ? 'on' : ''}">${n}</button>`; });
  p.innerHTML = html + `<button data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''} aria-label="ถัดไป">›</button>`;
}

function renderDocuments(data) {
  const docs = sorted(data.filter(r => r.file_path));
  $('#documents').innerHTML = docs.map(r => {
    const ext = (r.file_name || '').split('.').pop().toLowerCase();
    const kind = ext === 'pdf' ? 'pdf' : 'img';
    return `<div class="doc"><div class="doc-top"><span class="doc-type ${kind}">${esc(ext.toUpperCase() || 'FILE')}</span><div><strong>${esc(r.file_name)}</strong><p class="muted">${esc(r.title)}</p><p class="muted">${esc(cat(r.category).name)} · ${thDate(r.work_date)} · ${esc(r.author_name)}</p></div></div>
      <div class="doc-actions"><button class="btn primary" data-file="${esc(r.id)}">${icon('eye')}เปิดเอกสาร</button><button class="btn" data-open="${esc(r.id)}">รายละเอียดงาน</button></div></div>`;
  }).join('') || `<div class="empty">${icon('file')}<div>ยังไม่มีเอกสารแนบในรายการที่เลือก<br><small>แนบไฟล์ได้จากฟอร์มบันทึกงาน</small></div></div>`;
}

/* =========================================================
 *  Detail dialog
 * ========================================================= */
function openDetail(id) {
  const r = state.records.find(x => x.id === id); if (!r) return;
  state.viewing = r;
  const c = cat(r.category), d = r.details || {}, own = state.user && r.created_by === state.user.id;
  $('#detailCat').innerHTML = `<span class="dot" style="background:${c.color}"></span>${esc(c.name)}`;
  $('#detailTitle').textContent = r.title;
  const val = x => { const v = d[x.label]; return v === undefined || v === null || v === '' ? '<span class="muted">–</span>' : esc(x.type === 'date' ? thDate(v, { dateStyle: 'medium' }) : x.type === 'number' ? fmt(v) : v); };
  $('#detailBody').innerHTML = `
    <dl class="detail-grid">
      <div><dt>วันที่ปฏิบัติงาน</dt><dd>${thDate(r.work_date, { dateStyle: 'long' })}</dd></div>
      <div><dt>สถานะ</dt><dd>${statusBadge(r.status)}</dd></div>
    </dl>
    <p class="detail-section">ข้อมูลเฉพาะหมวด</p>
    <dl class="detail-grid">${c.fields.map(x => `<div><dt>${esc(x.label)}</dt><dd>${val(x)}</dd></div>`).join('')}</dl>
    ${r.notes ? `<p class="detail-section">หมายเหตุ</p><div class="note-box">${esc(r.notes)}</div>` : ''}
    <p class="detail-section">เอกสารแนบ</p>
    ${r.file_path ? `<div class="attach"><span class="doc-type ${(r.file_name || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'img'}" style="width:36px;height:42px">${esc((r.file_name || '').split('.').pop().toUpperCase())}</span><span>${esc(r.file_name)}</span><button class="btn" data-file="${esc(r.id)}">${icon('eye')}เปิด</button></div>` : '<p class="muted small">ไม่มีเอกสารแนบ</p>'}
    <p class="meta">ผู้บันทึก: <b>${esc(r.author_name)}</b>${own ? ' (คุณ)' : ''} · สร้างเมื่อ ${thDateTime(r.created_at)}${r.updated_at && r.updated_at !== r.created_at ? ` · แก้ไขล่าสุด ${thDateTime(r.updated_at)}` : ''}</p>`;
  $('#detailEdit').hidden = !own;
  $('#detailHint').textContent = own ? '' : 'แก้ไขได้เฉพาะผู้บันทึกรายการนี้';
  $('#detail').showModal();
}

/* =========================================================
 *  Editor dialog
 * ========================================================= */
function renderCatPicker() {
  $('#catPicker').innerHTML = CATEGORIES.map(c => `<button type="button" class="cat-opt" role="radio" aria-checked="${c.id === state.editCategory}" data-pick="${c.id}"><span class="dot" style="background:${c.color}"></span>${esc(c.name)}</button>`).join('');
}
function renderFields(values = {}) {
  const c = cat(state.editCategory);
  $('#dynLegend').textContent = `ข้อมูลเฉพาะหมวด · ${c.name}`;
  $('#dynamicFields').innerHTML = c.fields.map(x => {
    const v = values[x.label] ?? '';
    const extra = x.type === 'number' ? 'min="0" step="1" inputmode="numeric"' : x.label === 'HN' ? 'inputmode="numeric" autocomplete="off" placeholder="เก็บเลขศูนย์นำหน้า"' : '';
    return `<label style="${x.wide ? 'grid-column:1/-1' : ''}">${esc(x.label)}<input data-field="${esc(x.label)}" type="${x.type}" ${extra} value="${esc(v)}"></label>`;
  }).join('');
}
function setDropText() {
  const r = state.editingId ? state.records.find(x => x.id === state.editingId) : null;
  const file = state.pendingFile;
  $('#dropText').innerHTML = file
    ? `<b>${esc(file.name)}</b><br><small class="muted">${file.size < 1048576 ? Math.max(1, Math.round(file.size / 1024)) + ' KB' : (file.size / 1048576).toFixed(1) + ' MB'} · คลิกเพื่อเปลี่ยนไฟล์</small>`
    : r?.file_name ? `<b>ไฟล์ปัจจุบัน: ${esc(r.file_name)}</b><br><small class="muted">คลิกหรือลากไฟล์ใหม่มาวางเพื่อแทนที่ · PDF, JPG, PNG ไม่เกิน 10 MB</small>`
    : `<b>คลิกเพื่อเลือกไฟล์</b> หรือลากไฟล์มาวาง<br><small class="muted">PDF, JPG, PNG ไม่เกิน 10 MB</small>`;
}
function openEditor(category = 'service', record = null) {
  if (!state.user) { toast('กรุณาเข้าสู่ระบบก่อนบันทึกงาน', 'error'); return; }
  if (LIVE && !state.isMember) { toast('บัญชีนี้ยังไม่ได้รับสิทธิ์บันทึกงาน', 'error'); return; }
  if (record && record.created_by !== state.user.id) { openDetail(record.id); return; }
  state.editingId = record?.id || null; state.editCategory = record?.category || category; state.pendingFile = null;
  $('#recordForm').reset();
  $('#recordDate').value = record?.work_date || todayISO();
  $('#title').value = record?.title || '';
  $('#notes').value = record?.notes || '';
  $('#status').value = record?.status || 'กำลังดำเนินการ';
  renderCatPicker(); renderFields(record?.details); setDropText();
  $$('#recordForm [aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
  $('#formTitle').textContent = record ? 'แก้ไขบันทึกงาน' : 'บันทึกงานใหม่';
  $('#authorHint').textContent = `ผู้บันทึก: ${record?.author_name || state.memberName || state.user.email} (กำหนดจากบัญชีผู้ใช้โดยอัตโนมัติ)`;
  $('#formError').textContent = '';
  $('#editor').showModal();
  setTimeout(() => $('#title').focus(), 50);
}
function pickFile(file) {
  if (!file) return;
  if (!FILE_TYPES.includes(file.type) || file.size > MAX_FILE) { $('#formError').textContent = 'ไฟล์ต้องเป็น PDF, JPG หรือ PNG และมีขนาดไม่เกิน 10 MB'; return; }
  $('#formError').textContent = ''; state.pendingFile = file; setDropText();
}
async function submitRecord(e) {
  e.preventDefault();
  const title = $('#title').value.trim(), date = $('#recordDate').value;
  $('#title').toggleAttribute('aria-invalid', !title); $('#recordDate').toggleAttribute('aria-invalid', !date);
  if (!title || !date) { $('#formError').textContent = 'กรุณากรอกช่องที่มีเครื่องหมาย * ให้ครบ'; return; }
  const details = {};
  for (const i of $$('[data-field]')) {
    if (i.type === 'number') {
      if (i.value !== '' && (!Number.isFinite(Number(i.value)) || Number(i.value) < 0)) { $('#formError').textContent = `${i.dataset.field} ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป`; i.setAttribute('aria-invalid', 'true'); return; }
      details[i.dataset.field] = i.value === '' ? null : Number(i.value);
    } else details[i.dataset.field] = i.value.trim();
  }
  const rec = { category: state.editCategory, work_date: date, title, status: $('#status').value, notes: $('#notes').value.trim(), details };
  const btn = $('#save'); btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = 'กำลังบันทึก…';
  try {
    await store.save(state.editingId, rec, state.pendingFile);
    const wasEdit = !!state.editingId;
    $('#editor').close();
    await reload();
    toast(wasEdit ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกงานใหม่เรียบร้อย');
  } catch (err) {
    $('#formError').textContent = friendlyError(err);
  } finally { btn.disabled = false; btn.innerHTML = label; }
}
function friendlyError(e) {
  const m = e?.message || String(e);
  if (/row-level security|permission denied|violates row-level/i.test(m)) return 'ไม่มีสิทธิ์ทำรายการนี้ กรุณาตรวจสอบว่าบัญชีได้รับสิทธิ์ในทีม';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'เชื่อมต่อเครือข่ายไม่ได้ กรุณาลองใหม่';
  if (/mime|size|exceeded/i.test(m)) return 'ไฟล์ไม่ผ่านเงื่อนไข (PDF, JPG, PNG ไม่เกิน 10 MB)';
  return m;
}

/* =========================================================
 *  Misc UI
 * ========================================================= */
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = `${icon(kind === 'error' ? 'info' : 'check')}<span>${esc(msg)}</span>`;
  $('#toasts').append(t); setTimeout(() => t.remove(), 3500);
}
function closeAll() { $$('dialog[open]').forEach(d => d.close()); }
function setView(view, category) {
  state.view = view; state.page = 1;
  if (category !== undefined) F.category.value = category;
  document.body.classList.remove('nav-open');
  render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
let activeRange = '';
function setRange(kind) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  let from;
  if (kind === 'month') from = new Date(y, m, 1);
  if (kind === 'quarter') from = new Date(y, m - 2, 1);
  if (kind === 'year') from = new Date(y, 0, 1);
  if (kind === 'fiscal') from = new Date(m >= 9 ? y : y - 1, 9, 1); // ปีงบประมาณเริ่ม 1 ต.ค.
  F.from.value = iso(from); F.to.value = kind === 'fiscal' ? iso(new Date(from.getFullYear() + 1, 8, 30)) : todayISO();
  activeRange = kind; state.page = 1; render();
}
async function openFile(id) {
  const r = state.records.find(x => x.id === id); if (!r) return;
  const win = window.open('', '_blank'); // เปิดหน้าต่างก่อน เพื่อไม่ให้ถูก popup blocker
  try {
    const url = await store.openFile(r);
    if (win) { win.opener = null; win.location.href = url; } else window.location.assign(url);
  } catch (e) { win?.close(); toast('เปิดเอกสารไม่ได้: ' + friendlyError(e), 'error'); }
}
function exportCsv() {
  const data = sorted(filtered());
  if (!data.length) { toast('ไม่มีรายการให้ส่งออก', 'error'); return; }
  const cell = v => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"';
  const head = ['วันที่ปฏิบัติงาน', 'หมวดงาน', 'เรื่อง', 'สถานะ', 'ผู้บันทึก', ...ALL_FIELDS, 'หมายเหตุ', 'ไฟล์แนบ', 'สร้างเมื่อ', 'แก้ไขล่าสุด'];
  const lines = [head, ...data.map(r => [r.work_date, cat(r.category).name, r.title, r.status, r.author_name, ...ALL_FIELDS.map(k => r.details?.[k]), r.notes, r.file_name, r.created_at, r.updated_at])];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.map(l => l.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = `cancer-registry-${todayISO()}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`ส่งออก ${fmt(data.length)} รายการแล้ว`);
}

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-close],[data-view],[data-nav-cat],[data-new-cat],[data-open],[data-file],[data-pick],[data-page],[data-range],[data-sort],[data-action]');
  if (!el) return;
  const d = el.dataset;
  if (d.close) $('#' + d.close).close();
  else if (d.view) setView(d.view, d.view === 'dashboard' ? undefined : '');
  else if (d.navCat) setView('records', d.navCat);
  else if (d.newCat) openEditor(d.newCat);
  else if (d.file) { e.stopPropagation(); openFile(d.file); }
  else if (d.open) openDetail(d.open);
  else if (d.pick) { if (state.editCategory !== d.pick) { const keep = {}; $$('[data-field]').forEach(i => keep[i.dataset.field] = i.value); state.editCategory = d.pick; renderCatPicker(); renderFields(keep); } }
  else if (d.page) { state.page = Number(d.page); render(); $('#tableCard').scrollIntoView({ behavior: 'smooth' }); }
  else if (d.range) setRange(d.range);
  else if (d.sort) { state.sort = state.sort.key === d.sort ? { key: d.sort, dir: -state.sort.dir } : { key: d.sort, dir: d.sort === 'work_date' ? -1 : 1 }; render(); }
  else if (d.action === 'reset-demo' && !LIVE) { if (confirm('ล้างข้อมูลที่ทดลองบันทึกในเบราว์เซอร์นี้ และกลับไปใช้ข้อมูลตัวอย่างเริ่มต้น?')) { DemoStore.reset(); await reload(); toast('รีเซ็ตข้อมูลตัวอย่างแล้ว'); } }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-open]')) { e.preventDefault(); openDetail(e.target.dataset.open); } });
$('#add').onclick = () => openEditor(F.category.value || 'service');
$('#seeAll').onclick = () => setView('records');
$('#detailEdit').onclick = () => { const r = state.viewing; $('#detail').close(); openEditor(r.category, r); };
$('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
$('#scrim').onclick = () => document.body.classList.remove('nav-open');
$('#clearFilters').onclick = () => { Object.values(F).forEach(i => i.value = ''); activeRange = ''; state.page = 1; render(); };
$('#export').onclick = exportCsv;
Object.values(F).forEach(i => i.addEventListener('input', () => { if (i === F.from || i === F.to) activeRange = ''; state.page = 1; render(); }));
$('#recordForm').addEventListener('submit', submitRecord);
$('#attachment').addEventListener('change', e => pickFile(e.target.files[0]));
const dz = $('#dropzone');
['dragenter', 'dragover'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove('over'); }));
dz.addEventListener('drop', e => pickFile(e.dataTransfer.files[0]));
$('#logout').onclick = async () => { try { await LiveStore.signOut(); toast('ออกจากระบบแล้ว'); } catch (e) { toast(e.message, 'error'); } };
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target), btn = $('#loginSubmit');
  if (!fd.get('email') || !fd.get('password')) { $('#authError').textContent = 'กรุณากรอกอีเมลและรหัสผ่าน'; return; }
  btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ…'; $('#authError').textContent = '';
  try { await LiveStore.signIn(fd.get('email'), fd.get('password')); e.target.reset(); }
  catch (err) { $('#authError').textContent = /Failed to fetch/i.test(err.message) ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' : 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน'; }
  finally { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
});

if (CONFIG.googleLogin) {
  $('#googleLogin').hidden = false; $('#loginDivider').hidden = false;
  $('#loginHint').textContent = 'ใช้บัญชี Google ของคุณ หรืออีเมลที่ผู้ดูแลระบบสร้างให้';
}
$('#googleLogin').onclick = async () => {
  const btn = $('#googleLogin'); btn.disabled = true; $('#authError').textContent = '';
  try { await LiveStore.signInGoogle(); }
  catch (e) { btn.disabled = false; $('#authError').textContent = /not enabled|provider/i.test(e.message) ? 'ยังไม่ได้เปิดการเข้าสู่ระบบด้วย Google ใน Supabase' : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่'; }
};

// แสดงข้อผิดพลาดที่ส่งกลับมาจากการเข้าสู่ระบบด้วย Google (เช่น ?error=server_error&error_description=...)
{
  const p = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
  if (p.get('error')) {
    const d = p.get('error_description') || p.get('error');
    $('#authError').textContent = /exchange external code/i.test(d)
      ? 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ: การตั้งค่า Google ในระบบไม่ถูกต้อง กรุณาแจ้งผู้ดูแลระบบ'
      : /signups? not allowed/i.test(d) ? 'บัญชีนี้ยังไม่ได้รับอนุญาตให้เข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ'
      : 'เข้าสู่ระบบไม่สำเร็จ: ' + d;
    history.replaceState(null, '', location.pathname);
  }
}
// ล้าง '#' ที่ค้างหลังกลับจาก Google
if (LIVE) window.addEventListener('load', () => setTimeout(() => { if (location.hash === '' && location.href.endsWith('#')) history.replaceState(null, '', location.pathname + location.search); }, 1500));

/* ---------- start ---------- */
hydrateIcons();
try { await store.init(); }
catch (e) {
  $('#loginScreen').hidden = true; $('#app').hidden = false;
  showNotice('เชื่อมต่อระบบไม่ได้: ' + e.message, 'warn'); render();
}
