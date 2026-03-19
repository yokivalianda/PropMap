// ═══════════════════════════════════════════════
// MULTI-PROYEK — MarketPro v4.1
// ═══════════════════════════════════════════════

// ── LOAD PROYEK ──────────────────────────────────
async function loadProyek() {
  if (!sb || !me || !myProf) return;
  allProyek = [];
  try {
    // Query sederhana tanpa join dulu — lebih reliable
    const { data, error } = await sb.from('proyek')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('loadProyek:', error.message);
    } else {
      // Admin: lihat semua, Marketing: filter by membership
      if (myProf.role === 'admin') {
        allProyek = data || [];
      } else {
        // Ambil proyek_id yang user ini jadi member
        const { data: mData } = await sb.from('proyek_members')
          .select('proyek_id')
          .eq('user_id', me.id);
        const ids = (mData || []).map(m => m.proyek_id);
        allProyek = (data || []).filter(p => ids.includes(p.id));
      }
    }

    // Load members per proyek (untuk modal edit)
    if (allProyek.length > 0) {
      const { data: mData } = await sb.from('proyek_members')
        .select('proyek_id, user_id, role');
      const mMap = {};
      (mData || []).forEach(m => {
        if (!mMap[m.proyek_id]) mMap[m.proyek_id] = [];
        mMap[m.proyek_id].push(m);
      });
      allProyek = allProyek.map(p => ({ ...p, proyek_members: mMap[p.id] || [] }));
    }

    // Restore pilihan dari localStorage
    if (allProyek.length > 0) {
      const saved = localStorage.getItem('mp_proyek_' + me.id);
      const found = allProyek.find(p => p.id === saved);
      if (found) { curProyekId = found.id; curProyek = found; }
    } else {
      curProyekId = null; curProyek = null;
    }
  } catch(e) {
    console.warn('loadProyek exception:', e.message);
  }
  renderProyekSwitcher();
}

// ── RENDER SWITCHER ───────────────────────────────
function renderProyekSwitcher() {
  const sw  = document.getElementById('proyekSwitcher');
  const bar = document.getElementById('proyekBar');
  if (!sw || !bar) return;

  const isAdmin = myProf?.role === 'admin';

  if (!isAdmin && allProyek.length === 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'block';

  if (isAdmin && allProyek.length === 0) {
    sw.innerHTML = `
      <button class="proyek-switch-btn proyek-switch-empty" onclick="openModalProyek()">
        <span style="font-size:15px;line-height:1">＋</span>
        <span class="proyek-switch-label">Buat Proyek Pertama</span>
      </button>`;
    return;
  }

  const label = curProyek ? curProyek.nama : 'Semua Proyek';
  const warna = curProyek ? curProyek.warna : '#6366f1';
  sw.innerHTML = `
    <button class="proyek-switch-btn" onclick="toggleProyekDropdown(event)">
      <span class="proyek-dot" style="background:${warna}"></span>
      <span class="proyek-switch-label">${label}</span>
      <span style="font-size:10px;color:var(--text-4)">▾</span>
    </button>
    ${isAdmin ? `<button class="proyek-add-btn" onclick="openModalProyek()" title="Proyek baru">＋</button>` : ''}`;
}

// ── DROPDOWN ─────────────────────────────────────
function toggleProyekDropdown(e) {
  e.stopPropagation();
  const existing = document.getElementById('proyekDropdown');
  if (existing) { existing.remove(); return; }

  const isAdmin = myProf?.role === 'admin';
  const dd = document.createElement('div');
  dd.id = 'proyekDropdown';
  dd.className = 'proyek-dropdown';
  dd.onclick = ev => ev.stopPropagation();

  dd.innerHTML = `
    <div class="proyek-dd-header">
      <span class="proyek-dd-title">Pilih Proyek</span>
      ${isAdmin ? `<button class="proyek-dd-add" onclick="openModalProyek()">＋ Baru</button>` : ''}
    </div>
    <div class="proyek-dd-list">
      <div class="proyek-dd-item ${!curProyekId ? 'active' : ''}" onclick="setProyek(null)">
        <span class="proyek-dot" style="background:#6366f1"></span>
        <span>Semua Proyek</span>
        <span style="font-size:10px;color:var(--text-4);margin-left:auto">${allKons.length}</span>
        ${!curProyekId ? '<span class="proyek-check">✓</span>' : ''}
      </div>
      ${allProyek.map(p => `
        <div class="proyek-dd-item ${curProyekId === p.id ? 'active' : ''}" onclick="setProyek('${p.id}')">
          <span class="proyek-dot" style="background:${p.warna}"></span>
          <span class="proyek-dd-name">${p.nama}</span>
          <span style="font-size:10px;color:var(--text-4);margin-left:auto">${allKons.filter(k=>k.proyek_id===p.id).length}</span>
          ${curProyekId === p.id ? '<span class="proyek-check">✓</span>' : ''}
          ${isAdmin ? `<button class="proyek-dd-edit" onclick="event.stopPropagation();openEditProyek('${p.id}')">✏️</button>` : ''}
        </div>`).join('')}
    </div>`;

  document.body.appendChild(dd);

  const bar = document.getElementById('proyekBar');
  if (bar) {
    const rect = bar.getBoundingClientRect();
    dd.style.top  = (rect.bottom + 4) + 'px';
    dd.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 268)) + 'px';
  }
  setTimeout(() => document.addEventListener('click', closeProyekDropdown, { once: true }), 10);
}

function closeProyekDropdown() {
  document.getElementById('proyekDropdown')?.remove();
}

// ── SET PROYEK AKTIF ─────────────────────────────
async function setProyek(id) {
  closeProyekDropdown();
  curProyekId = id;
  curProyek   = id ? allProyek.find(p => p.id === id) : null;
  if (id) localStorage.setItem('mp_proyek_' + me.id, id);
  else    localStorage.removeItem('mp_proyek_' + me.id);
  renderProyekSwitcher();
  renderKons();
  renderDash();
  if (curPage === 'laporan')  { renderLapKpi(); renderCharts(); }
  if (curPage === 'kalender') renderKalender();
}

// ── FILTER BY PROYEK ─────────────────────────────
function filterKonsByProyek(list) {
  if (!curProyekId) return list;
  return list.filter(k => k.proyek_id === curProyekId);
}

// ── MODAL TAMBAH / EDIT PROYEK ───────────────────
function openModalProyek(id = null) {
  closeProyekDropdown();
  const p      = id ? allProyek.find(x => x.id === id) : null;
  const members = p?.proyek_members || [];
  const mktg   = allProfs.filter(x => x.role !== 'admin');
  const warnas = ['#6366f1','#a855f7','#10b981','#f59e0b','#f43f5e',
                  '#0ea5e9','#f97316','#ec4899','#14b8a6','#84cc16'];
  const curWarna = p?.warna || '#6366f1';

  const titleEl = document.getElementById('proyekModalTitle');
  if (titleEl) titleEl.textContent = p ? 'Edit Proyek' : 'Proyek Baru';

  document.getElementById('modalProyekBody').innerHTML = `
    <input type="hidden" id="proyekEditId" value="${p?.id || ''}"/>
    <div class="field">
      <label class="field-label">Nama Proyek *</label>
      <input type="text" class="field-input" id="proyekNama"
        placeholder="Contoh: Cluster Melati" value="${p?.nama || ''}"/>
    </div>
    <div class="field">
      <label class="field-label">Deskripsi</label>
      <input type="text" class="field-input" id="proyekDesc"
        placeholder="Keterangan singkat (opsional)" value="${p?.deskripsi || ''}"/>
    </div>
    <div class="field">
      <label class="field-label">Warna Penanda</label>
      <div style="display:flex;flex-wrap:wrap;gap:10px;padding:8px 0">
        ${warnas.map(w => `
          <div data-warna="${w}"
               style="width:30px;height:30px;border-radius:50%;background:${w};cursor:pointer;
                      transition:transform .15s,box-shadow .15s;flex-shrink:0;
                      ${curWarna===w ? 'outline:3px solid var(--text-1);outline-offset:3px;transform:scale(1.1)' : ''}"
               onclick="pickWarna('${w}')"></div>`).join('')}
      </div>
      <input type="hidden" id="proyekWarna" value="${curWarna}"/>
    </div>
    ${mktg.length ? `
    <div class="field">
      <label class="field-label">Anggota Tim</label>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${mktg.map(m => {
          const isMember = members.some(mb => mb.user_id === m.id);
          const ci = Math.abs(hsh(m.id)) % 8;
          return `<label style="display:flex;align-items:center;gap:12px;padding:10px 12px;
                               background:var(--glass-10);border:1px solid var(--glass-border);
                               border-radius:var(--r-md);cursor:pointer">
            <input type="checkbox" class="member-cb" value="${m.id}"
                   ${isMember ? 'checked' : ''}
                   style="width:16px;height:16px;accent-color:var(--brand);flex-shrink:0"/>
            <div class="member-av av${ci}">${(m.full_name||m.email).charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-size:13px;font-weight:600">${m.full_name||m.email}</div>
              <div style="font-size:11px;color:var(--text-3)">${m.email}</div>
            </div>
          </label>`;
        }).join('')}
      </div>
    </div>` : `<p style="font-size:12px;color:var(--text-3);padding:8px 0">Belum ada tim marketing.</p>`}
    ${p ? `
    <div style="border-top:1px solid var(--glass-border);margin-top:16px;padding-top:14px">
      <button onclick="archiveProyek('${p.id}')"
              style="width:100%;padding:10px;background:var(--rose-soft);
                     border:1px solid rgba(244,63,94,.2);border-radius:var(--r-md);
                     color:var(--rose);font-size:13px;font-weight:700;cursor:pointer;
                     font-family:var(--font-body)">
        🗄 Arsipkan Proyek
      </button>
    </div>` : ''}`;

  openModal('modalProyek');
}

function openEditProyek(id) { openModalProyek(id); }

// ── PICK WARNA — pakai data attribute, bukan style.backgroundColor ──
function pickWarna(w) {
  document.getElementById('proyekWarna').value = w;
  document.querySelectorAll('[data-warna]').forEach(el => {
    const isActive = el.dataset.warna === w;
    el.style.outline      = isActive ? '3px solid var(--text-1)' : 'none';
    el.style.outlineOffset = isActive ? '3px' : '0';
    el.style.transform     = isActive ? 'scale(1.1)' : 'scale(1)';
  });
}

// ── SIMPAN PROYEK ────────────────────────────────
async function saveProyek() {
  const nama = document.getElementById('proyekNama')?.value.trim();
  if (!nama) { showToast('Nama proyek wajib diisi', '⚠️'); return; }

  const id        = document.getElementById('proyekEditId')?.value || '';
  const warna     = document.getElementById('proyekWarna')?.value || '#6366f1';
  const desc      = document.getElementById('proyekDesc')?.value.trim() || '';
  const memberIds = [...document.querySelectorAll('.member-cb:checked')].map(cb => cb.value);

  setBtnLoading('btnSaveProyek', true, 'Menyimpan...');
  try {
    let proyekId = id;

    if (id) {
      // Update proyek
      const { error } = await sb.from('proyek')
        .update({ nama, deskripsi: desc, warna, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } else {
      // Insert proyek baru
      const { data, error } = await sb.from('proyek')
        .insert({ nama, deskripsi: desc, warna, owner_id: me.id })
        .select('id').single();
      if (error) throw error;
      proyekId = data.id;
    }

    // Sync members — hapus lama, insert baru
    await sb.from('proyek_members').delete().eq('proyek_id', proyekId);

    // Selalu include admin/owner
    const allIds = [...new Set([...memberIds, me.id])];
    const rows = allIds.map(uid => ({
      proyek_id: proyekId,
      user_id:   uid,
      role:      uid === me.id ? 'admin' : 'marketing'
    }));
    const { error: merr } = await sb.from('proyek_members').insert(rows);
    if (merr) console.warn('member insert error:', merr.message);

    closeModal('modalProyek');
    showToast(id ? 'Proyek diperbarui' : 'Proyek berhasil dibuat', '✅');

    // Reload dan langsung switch ke proyek baru
    await loadProyek();
    if (!id && proyekId) await setProyek(proyekId);

  } catch(e) {
    console.error('saveProyek:', e);
    showToast('Gagal: ' + e.message, '❌');
  }
  setBtnLoading('btnSaveProyek', false, 'Simpan Proyek');
}

// ── ARSIPKAN PROYEK ───────────────────────────────
async function archiveProyek(id) {
  if (!confirm('Arsipkan proyek ini? Data konsumen tetap tersimpan.')) return;
  const { error } = await sb.from('proyek').update({ is_archived: true }).eq('id', id);
  if (!error) {
    if (curProyekId === id) { curProyekId = null; curProyek = null; }
    closeModal('modalProyek');
    await loadProyek();
    showToast('Proyek diarsipkan', '🗄');
  } else {
    showToast('Gagal: ' + error.message, '❌');
  }
}

// ── BADGE & LABEL ─────────────────────────────────
function proyekBadge(proyekId) {
  if (!proyekId) return '';
  const p = allProyek.find(x => x.id === proyekId);
  if (!p) return '';
  return `<span class="proyek-tag" style="border-color:${p.warna};color:${p.warna}">
    <span class="proyek-tag-dot" style="background:${p.warna}"></span>${p.nama}
  </span>`;
}

function proyekNama(proyekId) {
  if (!proyekId) return '—';
  return allProyek.find(p => p.id === proyekId)?.nama || '—';
}
