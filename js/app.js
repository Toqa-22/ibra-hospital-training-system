// ============================================================================
// app.js
// منطق صفحة التسجيل: اختيار الفئة → الأقسام + فترة تدريب مستقلة لكل قسم + الإرسال
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  initDeptPicker();
  initFormSubmit();
});


// ---------------------------------------------------------------------------
// منتقي الفئة → الأقسام (اختيار متعدد عبر فئة واحدة أو أكثر)
// كل قسم مختار له فترة تدريب (بداية/نهاية) مستقلة عن بقية الأقسام
// ---------------------------------------------------------------------------
const deptPickerState = {
  activeCategoryId: null,
  selected: new Set(),      // أسماء الأقسام المختارة، بترتيب الاختيار
  dates: new Map(),         // dep -> { start: "yyyy-mm-dd", end: "yyyy-mm-dd" }
};

function initDeptPicker(){
  renderCategoryCards();
  renderDeptChecklist();
  renderSelectedSummary();
  renderPeriods();
}

function renderCategoryCards(){
  const grid = document.getElementById("categoryGrid");
  grid.innerHTML = CATEGORIES.map(cat => {
    const countInCat = cat.departments.filter(d => deptPickerState.selected.has(d)).length;
    return `
      <div class="category-card ${cat.id === deptPickerState.activeCategoryId ? "active" : ""}" data-cat="${cat.id}">
        <span class="cat-badge ${countInCat > 0 ? "show" : ""}">${countInCat}</span>
        <div class="cat-icon">${cat.icon}</div>
        <div class="cat-name">${escapeHtml(cat.name)}</div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", () => {
      const catId = card.dataset.cat;
      deptPickerState.activeCategoryId = deptPickerState.activeCategoryId === catId ? null : catId;
      renderCategoryCards();
      renderDeptChecklist();
    });
  });
}

function renderDeptChecklist(){
  const hint = document.getElementById("categoryHint");
  const list = document.getElementById("deptChecklist");
  const cat = CATEGORIES.find(c => c.id === deptPickerState.activeCategoryId);

  if (!cat){
    hint.style.display = "block";
    hint.textContent = "اختر فئة أعلاه لعرض أقسامها";
    list.innerHTML = "";
    return;
  }

  hint.style.display = "none";
  list.innerHTML = cat.departments.map(dep => `
    <div class="dept-check-card ${deptPickerState.selected.has(dep) ? "checked" : ""}" data-dep="${escapeHtml(dep)}">
      <span class="box">${deptPickerState.selected.has(dep) ? "✓" : ""}</span>
      <span>${escapeHtml(dep)}</span>
    </div>
  `).join("");

  list.querySelectorAll(".dept-check-card").forEach(card => {
    card.addEventListener("click", () => {
      toggleDepartment(card.dataset.dep);
    });
  });
}

function toggleDepartment(dep){
  if (deptPickerState.selected.has(dep)){
    deptPickerState.selected.delete(dep);
    deptPickerState.dates.delete(dep);
  } else {
    deptPickerState.selected.add(dep);
    deptPickerState.dates.set(dep, { start: "", end: "" });
  }
  renderCategoryCards();
  renderDeptChecklist();
  renderSelectedSummary();
  renderPeriods();
  if (deptPickerState.selected.size > 0) clearFieldError("department");
}

function renderSelectedSummary(){
  const summary = document.getElementById("selectedSummary");
  const countEl = document.getElementById("selectedCount");
  const chipsEl = document.getElementById("selectedChips");
  const n = deptPickerState.selected.size;

  summary.classList.toggle("has-selection", n > 0);
  countEl.textContent = n === 0 ? "لم يتم اختيار أي قسم بعد" : `تم اختيار ${formatSelectedDeptCount(n)}`;

  chipsEl.innerHTML = Array.from(deptPickerState.selected).map(dep => `
    <span class="dept-chip" data-dep="${escapeHtml(dep)}">
      ${escapeHtml(dep)}
      <button type="button" aria-label="إزالة">✕</button>
    </span>
  `).join("");

  chipsEl.querySelectorAll(".dept-chip button").forEach(btn => {
    btn.addEventListener("click", () => {
      toggleDepartment(btn.parentElement.dataset.dep);
    });
  });
}

// صياغة عربية لعدد الأقسام المختارة (قسم واحد / قسمان / أقسام)
function formatSelectedDeptCount(n){
  if (n === 1) return "قسم واحد";
  if (n === 2) return "قسمان";
  if (n >= 3 && n <= 10) return `${n} أقسام`;
  return `${n} قسماً`;
}

// ---------------------------------------------------------------------------
// فترة تدريب مستقلة لكل قسم مختار
// ---------------------------------------------------------------------------
function renderPeriods(){
  const hint = document.getElementById("periodsHint");
  const list = document.getElementById("periodsList");
  const depts = Array.from(deptPickerState.selected);

  if (depts.length === 0){
    hint.style.display = "block";
    list.innerHTML = "";
    return;
  }
  hint.style.display = "none";

  list.innerHTML = depts.map(dep => {
    const d = deptPickerState.dates.get(dep) || { start: "", end: "" };
    return `
      <div class="period-row" data-dep="${escapeHtml(dep)}">
        <div class="period-row-head">
          <span class="period-dept-name"><span class="dept-tag-icon">${getDepartmentIcon(dep)}</span>${escapeHtml(dep)}</span>
          <button type="button" class="period-row-remove" aria-label="إزالة القسم">✕</button>
        </div>
        <div class="period-fields">
          <div class="p-field">
            <label>تاريخ بداية التدريب <span class="req">*</span></label>
            <input type="date" class="p-start" value="${d.start || ""}">
          </div>
          <div class="p-field">
            <label>تاريخ نهاية التدريب <span class="req">*</span></label>
            <input type="date" class="p-end" value="${d.end || ""}">
          </div>
        </div>
        <div class="period-duration" data-role="duration"><span>⏱ مدة التدريب:</span><span class="num"></span></div>
        <div class="period-error-inline">تاريخ النهاية لا يمكن أن يسبق تاريخ البداية</div>
      </div>`;
  }).join("");

  list.querySelectorAll(".period-row").forEach(row => {
    const dep = row.dataset.dep;
    const startInput = row.querySelector(".p-start");
    const endInput = row.querySelector(".p-end");
    const durationEl = row.querySelector(".period-duration");
    const durationNum = durationEl.querySelector(".num");

    function updateRow(){
      const start = startInput.value;
      const end = endInput.value;
      deptPickerState.dates.set(dep, { start, end });

      if (!start || !end){
        durationEl.classList.remove("show");
        row.classList.remove("has-error");
        return;
      }
      if (new Date(end) < new Date(start)){
        row.classList.add("has-error");
        durationEl.classList.remove("show");
        return;
      }
      row.classList.remove("has-error");
      const days = calcDurationDays(start, end);
      durationNum.textContent = formatDurationLabel(days);
      durationEl.classList.add("show");
      clearFieldError("periods");
    }

    startInput.addEventListener("change", updateRow);
    endInput.addEventListener("change", updateRow);

    row.querySelector(".period-row-remove").addEventListener("click", () => {
      toggleDepartment(dep);
    });
  });
}

// ---------------------------------------------------------------------------
// أدوات التحقق من الحقول
// ---------------------------------------------------------------------------
function setFieldError(name){
  const field = document.querySelector(`[data-field="${name}"]`);
  if (!field) return;
  field.classList.add("has-error");
  const input = field.querySelector("input, select");
  if (input) input.classList.add("error");
}
function clearFieldError(name){
  const field = document.querySelector(`[data-field="${name}"]`);
  if (!field) return;
  field.classList.remove("has-error");
  const input = field.querySelector("input, select");
  if (input) input.classList.remove("error");
}

// تتحقق من صلاحية بيانات الطالب الأساسية + كل فترة تدريب لكل قسم مختار
function validateForm(){
  let valid = true;

  const name = document.getElementById("student_name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const specialization = document.getElementById("specialization").value.trim();
  const college = document.getElementById("college").value.trim();
  const departments = Array.from(deptPickerState.selected);

  [
    ["student_name", name.length > 0],
    ["phone", phone.length >= 6 && /^[0-9]+$/.test(phone)],
    ["specialization", specialization.length > 0],
    ["department", departments.length > 0],
  ].forEach(([field, ok]) => {
    if (ok) clearFieldError(field); else { setFieldError(field); valid = false; }
  });

  // تحقق من فترة كل قسم على حدة
  let periodsValid = departments.length > 0;
  document.querySelectorAll(".period-row").forEach(row => {
    const dep = row.dataset.dep;
    const d = deptPickerState.dates.get(dep) || {};
    const ok = d.start && d.end && new Date(d.end) >= new Date(d.start);
    row.classList.toggle("has-error", !ok);
    if (!ok) periodsValid = false;
  });
  if (periodsValid) clearFieldError("periods"); else { setFieldError("periods"); valid = false; }

  if (!valid) return null;

  const items = departments.map(dep => {
    const d = deptPickerState.dates.get(dep);
    return { department: dep, start: d.start, end: d.end };
  });

  return { name, phone, specialization, college, items };
}

// ---------------------------------------------------------------------------
// إرسال النموذج إلى Supabase
// ---------------------------------------------------------------------------
function initFormSubmit(){
  const form = document.getElementById("registerForm");
  const submitBtn = document.getElementById("submitBtn");
  let isSubmitting = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // منع النقر المتكرر

    // رسائل تحقق محددة قبل التحقق الشامل، لإظهار أدق سبب للفشل
    if (deptPickerState.selected.size === 0){
      setFieldError("department");
      showToast("يرجى اختيار قسم واحد على الأقل", "error");
      return;
    }

    const values = validateForm();
    if (!values){
      showToast("يرجى تحديد فترة تدريب صحيحة لكل قسم مختار", "error");
      return;
    }

    isSubmitting = true;
    setButtonLoading(submitBtn, true);

    try {
      // إنشاء سجل مستقل لكل قسم مختار، بفترة تدريب خاصة به
      await insertStudentsWithPeriods(
        {
          student_name: values.name,
          phone: values.phone,
          specialization: values.specialization,
          college: values.college,
        },
        values.items
      );

      const deptWord = values.items.length === 1 ? "قسم واحد" : `${values.items.length} أقسام`;
      showToast(`تم تسجيل المتدرب بنجاح في ${deptWord}`, "success");

      form.reset();
      deptPickerState.selected.clear();
      deptPickerState.dates.clear();
      deptPickerState.activeCategoryId = null;
      renderCategoryCards();
      renderDeptChecklist();
      renderSelectedSummary();
      renderPeriods();
    } catch (err){
      console.error("فشل إدراج بيانات المتدرب:", err);
      showToast(describeSupabaseError(err, "تعذر إتمام التسجيل"), "error");
    } finally {
      isSubmitting = false;
      setButtonLoading(submitBtn, false);
    }
  });
}
