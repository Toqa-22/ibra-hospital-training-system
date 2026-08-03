// ============================================================================
// dashboard.js
// منطق لوحة إدارة المتدربين: الفئات، بطاقات الأقسام، الفلاتر، الجدول، التقارير، التصدير
// ============================================================================

const PAGE_SIZE = 10;

const state = {
  allStudents: [],
  activeDepartment: "",   // فلتر بطاقة القسم النشطة
  activeCategory: "",     // فلتر شريحة الفئة النشطة (id من CATEGORIES)
  sortField: "created_at",
  sortDir: "desc",
  page: 1,
};

document.addEventListener("DOMContentLoaded", async () => {
  renderCategoryChips();
  populateCategoryFilterOptions();
  bindStaticEvents();
  await loadStudents();
});

// ---------------------------------------------------------------------------
// تحميل البيانات من Supabase
// ---------------------------------------------------------------------------
async function loadStudents(){
  try {
    state.allStudents = await fetchAllStudents();
  } catch (err){
    console.error(err);
    showToast("تعذر تحميل بيانات المتدربين", "error");
    state.allStudents = [];
  }
  renderDepartmentCards();
  populateDepartmentFilterOptions();
  renderTable();
}

// ---------------------------------------------------------------------------
// شرائح تصفية الفئة الرئيسية (تُطبَّق على بطاقات الأقسام والجدول معاً)
// ---------------------------------------------------------------------------
function renderCategoryChips(){
  const row = document.getElementById("categoryChipRow");
  const chips = [`<div class="category-chip ${state.activeCategory === "" ? "active" : ""}" data-cat="">الكل</div>`]
    .concat(CATEGORIES.map(cat => `
      <div class="category-chip ${state.activeCategory === cat.id ? "active" : ""}" data-cat="${cat.id}">
        <span class="chip-icon">${cat.icon}</span>${escapeHtml(cat.name)}
      </div>`));
  row.innerHTML = chips.join("");

  row.querySelectorAll(".category-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      state.activeCategory = chip.dataset.cat;
      document.getElementById("f_category").value = state.activeCategory;
      // إعادة ضبط فلتر القسم إن كان لا ينتمي للفئة الجديدة
      const deptSelect = document.getElementById("f_department");
      if (state.activeCategory && deptSelect.value){
        const cat = CATEGORIES.find(c => c.id === state.activeCategory);
        if (!cat.departments.includes(deptSelect.value)){
          deptSelect.value = "";
          state.activeDepartment = "";
        }
      }
      state.page = 1;
      renderCategoryChips();
      renderDepartmentCards();
      populateDepartmentFilterOptions();
      renderTable();
    });
  });
}

function populateCategoryFilterOptions(){
  const select = document.getElementById("f_category");
  select.innerHTML = `<option value="">جميع الفئات</option>` +
    CATEGORIES.map(c => `<option value="${c.id}">${c.icon} ${escapeHtml(c.name)}</option>`).join("");
}

// ---------------------------------------------------------------------------
// بطاقات الأقسام
// ---------------------------------------------------------------------------
function renderDepartmentCards(){
  const grid = document.getElementById("deptGrid");
  let groups = groupStudentsByDepartment(state.allStudents);

  if (state.activeCategory){
    const cat = CATEGORIES.find(c => c.id === state.activeCategory);
    groups = groups.filter(g => cat.departments.includes(g.department));
  }

  if (groups.length === 0){
    grid.innerHTML = `
      <div class="empty-state">
        <div class="e-icon">📋</div>
        <p>لا توجد بيانات متدربين مسجلة حالياً.</p>
      </div>`;
    return;
  }

  grid.innerHTML = groups.map((g) => `
    <div class="dept-card ${g.department === state.activeDepartment ? "active" : ""}" data-dept="${escapeHtml(g.department)}">
      <div class="dept-icon">${getDepartmentIcon(g.department)}</div>
      <div class="dept-name">${escapeHtml(g.department)}</div>
      <div class="dept-count-row">
        <span class="dept-badge">${formatTraineeCount(g.count)}</span>
      </div>
    </div>
  `).join("");

  grid.querySelectorAll(".dept-card").forEach(card => {
    card.addEventListener("click", () => {
      const dept = card.dataset.dept;
      state.activeDepartment = state.activeDepartment === dept ? "" : dept;
      document.getElementById("f_department").value = state.activeDepartment;
      document.getElementById("showAllBtn").classList.toggle("active", state.activeDepartment === "");
      state.page = 1;
      renderDepartmentCards();
      renderTable();
    });
  });
}

function populateDepartmentFilterOptions(){
  const select = document.getElementById("f_department");
  const current = select.value;
  let groups = groupStudentsByDepartment(state.allStudents);

  if (state.activeCategory){
    const cat = CATEGORIES.find(c => c.id === state.activeCategory);
    groups = groups.filter(g => cat.departments.includes(g.department));
  }

  select.innerHTML = `<option value="">جميع الأقسام</option>` +
    groups.map(g => `<option value="${escapeHtml(g.department)}">${escapeHtml(g.department)}</option>`).join("");
  select.value = groups.some(g => g.department === current) ? current : (state.activeDepartment || "");
}

// ---------------------------------------------------------------------------
// الأحداث الثابتة (الفلاتر، الفرز، التصدير، عرض الكل)
// ---------------------------------------------------------------------------
function bindStaticEvents(){
  document.getElementById("showAllBtn").addEventListener("click", () => {
    state.activeDepartment = "";
    document.getElementById("f_department").value = "";
    document.getElementById("showAllBtn").classList.add("active");
    state.page = 1;
    renderDepartmentCards();
    renderTable();
  });

  const filterIds = ["f_name", "f_phone", "f_spec", "f_category", "f_department", "f_start", "f_end", "f_regdate", "f_status"];
  filterIds.forEach(id => {
    const el = document.getElementById(id);
    const handler = debounce(() => {
      if (id === "f_category"){
        state.activeCategory = el.value;
        renderCategoryChips();
        renderDepartmentCards();
        populateDepartmentFilterOptions();
      }
      if (id === "f_department"){
        state.activeDepartment = el.value;
        document.getElementById("showAllBtn").classList.toggle("active", el.value === "");
        renderDepartmentCards();
      }
      state.page = 1;
      renderTable();
    }, 200);
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });

  document.getElementById("resetFiltersBtn").addEventListener("click", () => {
    filterIds.forEach(id => { document.getElementById(id).value = ""; });
    state.activeDepartment = "";
    state.activeCategory = "";
    document.getElementById("showAllBtn").classList.add("active");
    state.page = 1;
    renderCategoryChips();
    renderDepartmentCards();
    populateDepartmentFilterOptions();
    renderTable();
  });

  document.querySelectorAll("#studentsTable thead th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort;
      if (state.sortField === field){
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortField = field;
        state.sortDir = "asc";
      }
      renderTable();
    });
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    exportStudentsToExcel(state.allStudents);
  });
}

// ---------------------------------------------------------------------------
// تطبيق الفلاتر على البيانات الخام (تشمل الفئة الرئيسية والقسم معاً)
// ---------------------------------------------------------------------------
function getFilteredStudents(){
  const name = document.getElementById("f_name").value.trim().toLowerCase();
  const phone = document.getElementById("f_phone").value.trim();
  const spec = document.getElementById("f_spec").value.trim().toLowerCase();
  const category = state.activeCategory;
  const dept = state.activeDepartment;
  const start = document.getElementById("f_start").value;
  const end = document.getElementById("f_end").value;
  const regdate = document.getElementById("f_regdate").value;
  const status = document.getElementById("f_status").value;

  const categoryObj = category ? CATEGORIES.find(c => c.id === category) : null;

  return state.allStudents.filter(s => {
    if (name && !(s.student_name || "").toLowerCase().includes(name)) return false;
    if (phone && !(s.phone || "").includes(phone)) return false;
    if (spec && !(s.specialization || "").toLowerCase().includes(spec)) return false;
    if (categoryObj && !categoryObj.departments.includes(s.department)) return false;
    if (dept && s.department !== dept) return false;
    if (start && s.training_start !== start) return false;
    if (end && s.training_end !== end) return false;
    if (regdate && s.registration_date !== regdate) return false;
    if (status){
      const st = getTrainingStatus(s.training_start, s.training_end).key;
      if (st !== status) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// تجميع السجلات المتطابقة (نفس الاسم + نفس الهاتف) دون حذف أي سجل
// ---------------------------------------------------------------------------
function groupDuplicateStudents(students){
  const map = new Map();
  students.forEach(s => {
    const key = `${(s.student_name || "").trim().toLowerCase()}|${(s.phone || "").trim()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  });
  return Array.from(map.values()).map(records => ({
    student_name: records[0].student_name,
    phone: records[0].phone,
    records: records.sort((a, b) => new Date(b.training_start) - new Date(a.training_start)),
  }));
}

function sortGroups(groups){
  const field = state.sortField;
  const dir = state.sortDir === "asc" ? 1 : -1;

  const keyFor = (group) => {
    const latest = group.records[0]; // الأحدث بعد الفرز أعلاه
    if (field === "student_name") return group.student_name || "";
    if (field === "phone") return group.phone || "";
    if (["specialization", "department", "training_start", "training_end", "registration_date", "created_at"].includes(field)){
      return latest[field] || "";
    }
    return "";
  };

  return groups.slice().sort((a, b) => {
    const ka = keyFor(a), kb = keyFor(b);
    if (ka < kb) return -1 * dir;
    if (ka > kb) return 1 * dir;
    return 0;
  });
}

// تحديد حالة تمثيلية واحدة لمجموعة أقسام متعددة لنفس الطالب:
// الأولوية لـ"قيد التدريب" إن وُجد قسم واحد جارٍ حالياً، ثم "لم يبدأ"، وأخيراً "انتهى" إن انتهت كل الأقسام
function getGroupStatusSummary(records){
  const statuses = records.map(r => getTrainingStatus(r.training_start, r.training_end).key);
  if (statuses.includes("active")) return { label: "قيد التدريب", cls: "status-active" };
  if (statuses.includes("upcoming")) return { label: "لم يبدأ", cls: "status-upcoming" };
  return { label: "انتهى", cls: "status-ended" };
}

// ---------------------------------------------------------------------------
// رسم الجدول (مع الفرز، الترقيم، الصفوف القابلة للتوسيع، وزر التقرير)
// ---------------------------------------------------------------------------
const REPORT_COLSPAN = 10;

function renderTable(){
  const filtered = getFilteredStudents();
  let groups = groupDuplicateStudents(filtered);
  groups = sortGroups(groups);

  updateSortArrows();

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  const pageGroups = groups.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

  const tbody = document.getElementById("tableBody");

  if (groups.length === 0){
    tbody.innerHTML = `<tr><td colspan="${REPORT_COLSPAN}"><div class="table-empty">لا توجد نتائج مطابقة لمعايير البحث الحالية.</div></td></tr>`;
    renderPagination(0, 1);
    return;
  }

  let html = "";
  pageGroups.forEach((group, gIdx) => {
    const groupId = `grp-${gIdx}`;
    const reportBtn = `<button class="btn-report" data-report-idx="${gIdx}">⬇ تقرير</button>`;

    if (group.records.length === 1){
      const r = group.records[0];
      const status = getTrainingStatus(r.training_start, r.training_end);
      html += `
        <tr>
          <td>${escapeHtml(group.student_name)}</td>
          <td>${escapeHtml(group.phone)}</td>
          <td>${escapeHtml(r.specialization)}</td>
          <td>${escapeHtml(r.department)}</td>
          <td>${formatDateShort(r.training_start)}</td>
          <td>${formatDateShort(r.training_end)}</td>
          <td>${formatDurationLabel(calcDurationDays(r.training_start, r.training_end))}</td>
          <td>${formatDateShort(r.registration_date)}</td>
          <td><span class="status-pill ${status.cls}">${status.label}</span></td>
          <td>${reportBtn}</td>
        </tr>`;
    } else {
      const starts = group.records.map(r => new Date(r.training_start));
      const ends = group.records.map(r => new Date(r.training_end));
      const earliestStart = new Date(Math.min(...starts));
      const latestEnd = new Date(Math.max(...ends));
      const statusSummary = getGroupStatusSummary(group.records);

      html += `
        <tr class="group-row" data-group="${groupId}">
          <td colspan="2">
            <span class="toggle-caret">▾</span>${escapeHtml(group.student_name)}
            <div class="group-subtext">${escapeHtml(group.phone)}</div>
          </td>
          <td colspan="2">
            <span class="count-badge">${group.records.length} أقسام</span>
            <span class="expand-hint">اضغط لعرض تفاصيل كل قسم ▾</span>
          </td>
          <td colspan="2">${formatDateShort(earliestStart.toISOString().slice(0, 10))} ← ${formatDateShort(latestEnd.toISOString().slice(0, 10))}</td>
          <td>يختلف حسب القسم</td>
          <td>${formatDateShort(group.records[0].registration_date)}</td>
          <td><span class="status-pill ${statusSummary.cls}">${statusSummary.label}</span></td>
          <td>${reportBtn}</td>
        </tr>`;
      group.records.forEach(r => {
        const status = getTrainingStatus(r.training_start, r.training_end);
        html += `
          <tr class="sub-row hidden" data-parent="${groupId}">
            <td colspan="2"></td>
            <td>${escapeHtml(r.specialization)}</td>
            <td>${escapeHtml(r.department)}</td>
            <td>${formatDateShort(r.training_start)}</td>
            <td>${formatDateShort(r.training_end)}</td>
            <td>${formatDurationLabel(calcDurationDays(r.training_start, r.training_end))}</td>
            <td>${formatDateShort(r.registration_date)}</td>
            <td><span class="status-pill ${status.cls}">${status.label}</span></td>
            <td></td>
          </tr>`;
      });
    }
  });

  tbody.innerHTML = html;

  tbody.querySelectorAll(".group-row").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".btn-report")) return; // لا توسّع الصف عند الضغط على زر التقرير
      const id = row.dataset.group;
      row.classList.toggle("expanded");
      tbody.querySelectorAll(`.sub-row[data-parent="${id}"]`).forEach(sr => sr.classList.toggle("hidden"));
    });
  });

  tbody.querySelectorAll("[data-report-idx]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.reportIdx);
      openStudentReport(pageGroups[idx]);
    });
  });

  renderPagination(groups.length, totalPages);
}

function updateSortArrows(){
  document.querySelectorAll("#studentsTable thead th[data-sort]").forEach(th => {
    const arrow = th.querySelector(".sort-arrow");
    if (th.dataset.sort === state.sortField){
      arrow.textContent = state.sortDir === "asc" ? "▲" : "▼";
    } else {
      arrow.textContent = "↕";
    }
  });
}

function renderPagination(totalItems, totalPages){
  const el = document.getElementById("pagination");
  if (totalItems === 0){ el.innerHTML = ""; return; }

  const from = (state.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(state.page * PAGE_SIZE, totalItems);

  let buttons = "";
  for (let p = 1; p <= totalPages; p++){
    if (p === 1 || p === totalPages || Math.abs(p - state.page) <= 1){
      buttons += `<button data-page="${p}" class="${p === state.page ? "active" : ""}">${p}</button>`;
    } else if (buttons.slice(-3) !== "…</span>" && (p === state.page - 2 || p === state.page + 2)){
      buttons += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
    }
  }

  el.innerHTML = `
    <div class="p-info">عرض ${from} - ${to} من أصل ${totalItems} سجل</div>
    <div class="p-controls">
      <button ${state.page === 1 ? "disabled" : ""} data-page="${state.page - 1}">‹</button>
      ${buttons}
      <button ${state.page === totalPages ? "disabled" : ""} data-page="${state.page + 1}">›</button>
    </div>`;

  el.querySelectorAll("button[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.page = Number(btn.dataset.page);
      renderTable();
    });
  });
}