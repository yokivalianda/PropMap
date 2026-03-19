// ═══════════════════════════════════════════════
// MULTI-PROYEK — MarketPro v4.1
// ═══════════════════════════════════════════════

// ── LOAD PROYEK ──────────────────────────────────
async function loadProyek() {
  if (!sb || !me) return;

  if (myProf?.role === 'admin') {
    // Admin: load semua proyek
    const { data } = await sb.from('proyek')
      .select('*, proyek_members(user_id, role)')
      .eq('is_archived', false)
      .order('created_at', { ascending: true });
    allProyek = data || [];
  } else {
    // Marketing: hanya proyek yang dia jadi member
    const { data } = await sb.from('proyek')
      .select('*, proyek_members!inner(user_id, role)')
      .eq('is_archived', false)
      .eq('proyek_members.user_id', me.id)
      .order('created_at', { ascending: true });
    allProyek = data || [];
  }

  // Auto-pilih proyek pertama jika belum ada yang aktif
  if (!curProyekId && allProyek.length > 0) {
    const saved = localStorage.getItem(`mp_proyek_${me.id}`);
    const found = allProyek.find(p => p.id === saved);
    curProyekId = found ? found.id : null; // null = semua proyek
    curProyek   = found || null;
  }

  renderProyekSwitcher();
}

// ── RENDER SWITCHER (header dropdown) ────────────
function renderProyekSwitcher() {
  const sw = document.getElementById('proyekSwitcher');
  if (!sw) return;

  const label = curProyek ? curProyek.nama : 'Semua Proyek';
  const warna = curProyek ? curProyek.warna : '#6366f1';

  sw.innerHTML = `
    <button class="proyek-switch-btn" onclick="toggleProyekDropdown(event)">
      <span class="proyek-dot" style="background:${warna}"></span>
      <span class="proyek-switch-label">${label}</span>
      <span class="proyek-switch-caret">▾</span>
    </button>`;
}

function toggleProyekDropdown(e) {
  e.stopPropagation();
  let dd = document.getElementById('proyekDropdown');
  if (dd) { dd.remove(); return; }

  dd = document.createElement('div');
  dd.id = 'proyekDropdown';
  dd.className = 'proyek-dropdown';
  dd.onclick = e => e.stopPropagation();

  const isAdmin = myProf?.role === 'admin';

  dd.innerHTML = `
    <div class="proyek-dd-header">
      <span class="proyek-dd-title">Pilih Proyek</span>
      ${isAdmin ? `<button class="proyek-dd-add" onclick="openModalProyek()">＋ Baru</button>` : ''}
    </div>
    <div class="proyek-dd-list">
      <div class="proyek-dd-item ${!curProyekId ? 'active' : ''}" onclick="setProyek(null)">
        <span class="proyek-dot" style="background:#6366f1"></span>
        <span>Semua Proyek</span>
        ${!curProyekId ? '<span class="proyek-check">✓</span>' : ''}
      </div>
      ${allProyek.map(p => `
        <div class="proyek-dd-item ${curProyekId === p.id ? 'active' : ''}" onclick="setProyek('${p.id}')">
          <span class="proyek-dot" style="background:${p.warna}"></span>
          <span class="proyek-dd-name">${p.nama}</span>
          <span class="proyek-dd-count">${countKonsumenProyek(p.id)}</span>
          ${curProyekId === p.id ? '<span class="proyek-check">✓</span>' : ''}
          ${isAdmin ? `<button class="proyek-dd-edit" onclick="event.stopPropagation();openEditProyek('${p.id}')">✏️</button>` : ''}
        </div>`).join('')}
    </div>`;

  document.body.appendChild(dd);

  // Posisi dropdown di bawah switcher
  const btn = document.getElementById('proyekSwitcher');
  if (btn) {
    const rect = btn.getBoundingClientRect();
    dd.style.top  = (rect.bottom + 8) + 'px';
    dd.style.left = Math.min(rect.left, window.innerWidth - 260) + 'px';
  }

  // Tutup saat klik di luar
  setTimeout(() => document.addEventListener('click', closeProyekDropdown, { once: true }), 0);
}

function closeProyekDropdown() {
  document.getElementById('proyekDropdown')?.remove();
}

function countKonsumenProyek(proyekId) {
  const cnt = allKons.filter(k => k.proyek_id === proyekId).length;
  return cnt > 0 ? `<span style="font-size:10px;color:var(--text-4)">${cnt}</span>` : '';
}

// ── SET PROYEK AKTIF ─────────────────────────────
async function setProyek(id) {
  closeProyekDropdown();
  curProyekId = id;
  curProyek   = id ? allProyek.find(p => p.id === id) : null;

  // Simpan pilihan ke localStorage
  if (id) localStorage.setItem(`mp_proyek_${me.id}`, id);
  else    localStorage.removeItem(`mp_proyek_${me.id}`);

  renderProyekSwitcher();
  renderKons();
  renderDash();
  if (curPage === 'laporan') { renderLapKpi(); renderCharts(); }
  if (curPage === 'kalender') renderKalender();
}

// ── FILTER KONSUMEN BY PROYEK ────────────────────
// Dipanggil dari renderKons dan renderDash sebagai filter tambahan
function filterKonsByProyek(list) {
  if (!curProyekId) return list;
  return list.filter(k => k.proyek_id === curProyekId);
}

// ── MODAL TAMBAH / EDIT PROYEK ───────────────────
function openModalProyek(id = null) {
  closeProyekDropdown();
  const p = id ? allProyek.find(x => x.id === id) : null;
  const members = p?.proyek_members || [];
  const marketing = allProfs.filter(x => x.role !== 'admin');

  const warnaOptions = [
    '#6366f1','#a855f7','#10b981','#f59e0b','#f43f5e',
    '#0ea5e9','#f97316','#ec4899','#14b8a6','#84cc16',
  ];

  document.getElementById('modalProyekBody').innerHTML = `
    <input type="hidden" id="proyekEditId" value="${p?.id || ''}"/>
    <div class="field">
      <label class="field-label">Nama Proyek *</label>
      <input type="text" class="field-input" id="proyekNama" placeholder="Contoh: Cluster Melati" value="${p?.nama || ''}"/>
    </div>
    <div class="field">
      <label class="field-label">Deskripsi</label>
      <input type="text" class="field-input" id="proyekDesc" placeholder="Keterangan singkat (opsional)" value="${p?.deskripsi || ''}"/>
    </div>
    <div class="field">
      <label class="field-label">Warna Penanda</label>
      <div class="warna-picker" id="warnaPicker">
        ${warnaOptions.map(w => `
          <div class="warna-opt ${(p?.warna || '#6366f1') === w ? 'active' : ''}"
               style="background:${w}" onclick="pickWarna('${w}')"></div>`).join('')}
      </div>
      <input type="hidden" id="proyekWarna" value="${p?.warna || '#6366f1'}"/>
    </div>
    ${marketing.length > 0 ? `
    <div class="field">
      <label class="field-label">Anggota Tim Marketing</label>
      <div class="member-checklist">
        ${marketing.map(m => {
          const isMember = members.some(mb => mb.user_id === m.id);
          return `<label class="member-check-item">
            <input type="checkbox" class="member-cb" value="${m.id}" ${isMember ? 'checked' : ''}/>
            <div class="member-av av${Math.abs(hsh(m.id)) % 8}">${(m.full_name || m.email).charAt(0).toUpperCase()}</div>
            <div>
              <div style="font-size:13px;font-weight:600">${m.full_name || m.email}</div>
              <div style="font-size:11px;color:var(--text-3)">${m.email}</div>
            </div>
          </label>`;
        }).join('')}
      </div>
    </div>` : `<div style="font-size:12px;color:var(--text-3);padding:8px 0">Belum ada tim marketing. Tambah anggota dari menu Pengaturan.</div>`}
    ${p ? `
    <div style="border-top:1px solid var(--glass-border);margin-top:16px;padding-top:16px">
      <button onclick="archiveProyek('${p.id}')" style="width:100%;padding:10px;background:var(--rose-soft);border:1px solid rgba(244,63,94,.2);border-radius:var(--r-md);color:var(--rose);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font-body)">
        🗄 Arsipkan Proyek
      </button>
    </div>` : ''}`;

  openModal('modalProyek');
}

function openEditProyek(id) { openModalProyek(id); }

function pickWarna(w) {
  document.getElementById('proyekWarna').value = w;
  document.querySelectorAll('.warna-opt').forEach(el =>
    el.classList.toggle('active', el.style.background === w || el.style.backgroundColor === w)
  );
}

// ── SIMPAN PROYEK ────────────────────────────────
async function saveProyek() {
  const nama = document.getElementById('proyekNama').value.trim();
  if (!nama) { showToast('Nama proyek wajib diisi', '⚠️'); return; }

  const id    = document.getElementById('proyekEditId').value;
  const warna = document.getElementById('proyekWarna').value;
  const desc  = document.getElementById('proyekDesc').value.trim();
  const memberIds = [...document.querySelectorAll('.member-cb:checked')].map(cb => cb.value);

  setBtnLoading('btnSaveProyek', true, 'Menyimpan...');
  try {
    let proyekId = id;
    if (id) {
      // Update
      const { error } = await sb.from('proyek')
        .update({ nama, deskripsi: desc, warna, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } else {
      // Insert
      const { data, error } = await sb.from('proyek')
        .insert({ nama, deskripsi: desc, warna, owner_id: me.id })
        .select().single();
      if (error) throw error;
      proyekId = data.id;
    }

    // Sync members: hapus semua lalu insert ulang
    await sb.from('proyek_members').delete().eq('proyek_id', proyekId);
    if (memberIds.length > 0) {
      const rows = memberIds.map(uid => ({ proyek_id: proyekId, user_id: uid, role: 'marketing' }));
      // Tambahkan admin/owner juga
      rows.push({ proyek_id: proyekId, user_id: me.id, role: 'admin' });
      const { error: merr } = await sb.from('proyek_members').insert(rows);
      if (merr) console.warn('member sync:', merr.message);
    }

    showToast(id ? 'Proyek diperbarui' : 'Proyek dibuat', '✅');
    closeModal('modalProyek');
    await loadProyek();
    renderProyekSwitcher();
  } catch(e) {
    showToast('Gagal: ' + e.message, '❌');
  }
  setBtnLoading('btnSaveProyek', false, 'Simpan Proyek');
}

// ── ARSIPKAN PROYEK ───────────────────────────────
async function archiveProyek(id) {
  if (!confirm('Arsipkan proyek ini? Konsumen di dalamnya tidak akan terhapus.')) return;
  const { error } = await sb.from('proyek').update({ is_archived: true }).eq('id', id);
  if (!error) {
    showToast('Proyek diarsipkan', '🗄');
    if (curProyekId === id) await setProyek(null);
    closeModal('modalProyek');
    await loadProyek();
  } else {
    showToast('Gagal mengarsipkan', '❌');
  }
}

// ── BADGE PROYEK DI KARTU KONSUMEN ───────────────
function proyekBadge(proyekId) {
  if (!proyekId || !allProyek.length) return '';
  const p = allProyek.find(x => x.id === proyekId);
  if (!p) return '';
  return `<span class="proyek-tag" style="border-color:${p.warna};color:${p.warna}">
    <span class="proyek-tag-dot" style="background:${p.warna}"></span>${p.nama}
  </span>`;
}

// ── NAMA PROYEK (untuk detail konsumen) ──────────
function proyekNama(proyekId) {
  if (!proyekId) return '—';
  return allProyek.find(p => p.id === proyekId)?.nama || '—';
}
