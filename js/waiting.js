// ============================================================================
// waiting.js
// منطق صفحة قائمة الانتظار (waiting.html) بالكامل: تحميل سجلات is_waitlist=true
// من Supabase، فلترة بسيطة بالاسم/القسم، رسم الجدول، وزرا الإجراء الرئيسيان:
//   - «📅 تحديد الفترة»: يفتح نفس نافذة التعديل المستخدمة في لوحة الإدارة
//     (showEditStudentModal في js/ui.js)، وعند الحفظ يستدعي updateStudentRecord()
//     الذي يضبط is_waitlist=false صراحة — فينتقل السجل تلقائياً إلى لوحة
//     الإدارة ويختفي من هنا، دون حذف/إدراج يدوي.
//   - «🗑 حذف»: يحذف السجل نهائياً من قائمة الانتظار (نفس منطق الحذف في
//     لوحة الإدارة، عبر نافذة تأكيد صريحة).
//
// الاعتماديات المطلوب تحميلها قبل هذا الملف (بنفس الترتيب في waiting.html):
//   1) js/config.js       — بيانات الاتصال بـ Supabase
//   2) js/departments.js  — يوفر DEPARTMENTS (تُستخدم داخل نافذة التعديل)
//   3) js/ui.js           — يوفر showToast, showConfirm, showEditStudentModal...
//   4) js/supabase.js     — يوفر fetchWaitlistStudents, updateStudentRecord,
//                            deleteStudentsByIds, describeSupabaseError
//
// كل البيانات تُجلب مرة واحدة عند تحميل الصفحة وتُخزَّن في waitingState.all؛
// أي فلترة أو حذف أو نقل لاحق يعمل محلياً على هذه النسخة دون إعادة جلب كامل.
// ============================================================================

const waitingState = {
  all: [],
  filterName: "",
  filterDepartment: "",
};

document.addEventListener("DOMContentLoaded", async () => {
  bindWaitingEvents();
  await loadWaitlist();
});

// ---------------------------------------------------------------------------
// تحميل البيانات من Supabase
// ---------------------------------------------------------------------------
/**
 * جلب كل سجلات قائمة الانتظار من Supabase عبر fetchWaitlistStudents() وتخزينها
 * في waitingState.all، ثم تعبئة قائمة فلتر الأقسام ورسم الجدول. تُستدعى مرة
 * واحدة عند تحميل الصفحة؛ أي نقل/حذف لاحق يُحدّث waitingState.all محلياً
 * مباشرة بدل إعادة الجلب الكامل من الخادم في كل مرة.
 */
async function loadWaitlist(){
  try {
    waitingState.all = await fetchWaitlistStudents();
  } catch (err){
    console.error(err);
    showToast("تعذر تحميل قائمة الانتظار", "error");
    waitingState.all = [];
  }
  populateWaitingDepartmentFilter();
  renderWaitingTable();
}

// ---------------------------------------------------------------------------
// أحداث الفلترة (اسم + قسم)
// ---------------------------------------------------------------------------
/**
 * ربط مستمعي أحداث حقلي الفلترة (اسم الطالب، القسم). حقل الاسم يبحث بحثاً
 * جزئياً فورياً مع تأخير debounce، بينما القائمة المنسدلة تطابق مطابقة دقيقة.
 * تُستدعى مرة واحدة فقط عند تحميل الصفحة.
 */
function bindWaitingEvents(){
  const nameInput = document.getElementById("w_name");
  const deptSelect = document.getElementById("w_department");

  nameInput.addEventListener("input", debounce(() => {
    waitingState.filterName = nameInput.value.trim().toLowerCase();
    renderWaitingTable();
  }, 200));

  deptSelect.addEventListener("change", () => {
    waitingState.filterDepartment = deptSelect.value;
    renderWaitingTable();
  });
}

/**
 * تعبئة القائمة المنسدلة «القسم» بأقسام سجلات قائمة الانتظار الحالية فقط
 * (وليس كل الأقسام الأربعين الممكنة)، لتبقى القائمة قصيرة وذات صلة بما هو
 * موجود فعلياً في قائمة الانتظار الآن.
 */
function populateWaitingDepartmentFilter(){
  const select = document.getElementById("w_department");
  const current = select.value;
  const depts = Array.from(new Set(waitingState.all.map(s => s.department))).sort((a, b) => a.localeCompare(b, "ar"));

  select.innerHTML = `<option value="">جميع الأقسام</option>` +
    depts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
  select.value = depts.includes(current) ? current : "";
  waitingState.filterDepartment = select.value;
}

/**
 * تطبيق فلاتر الاسم والقسم معاً (AND منطقي) على waitingState.all.
 * @returns {Array} السجلات المطابقة للفلاتر الحالية
 */
function getFilteredWaitlist(){
  return waitingState.all.filter(s => {
    if (waitingState.filterName && !(s.student_name || "").toLowerCase().includes(waitingState.filterName)) return false;
    if (waitingState.filterDepartment && s.department !== waitingState.filterDepartment) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// رسم الجدول
// ---------------------------------------------------------------------------
const WAITING_COLSPAN = 7;

/**
 * رسم جدول قائمة الانتظار بالكامل: تُطبَّق الفلاتر أولاً، ثم يُبنى صف واحد
 * لكل سجل مع زري «📅 تحديد الفترة» و«🗑 حذف». يُحدَّث أيضاً شريط إحصاء العدد
 * الإجمالي أعلى الصفحة (بغض النظر عن الفلترة الحالية). تُستدعى بعد أي تغيير
 * يؤثر على البيانات المعروضة (تحميل، فلترة، حذف، نقل لتحديد الفترة).
 */
function renderWaitingTable(){
  const tbody = document.getElementById("waitingTableBody");
  const countEl = document.getElementById("waitingCount");
  if (countEl) countEl.textContent = String(waitingState.all.length);

  const list = getFilteredWaitlist();

  if (list.length === 0){
    const msg = waitingState.all.length === 0
      ? "لا يوجد متدربون في قائمة الانتظار حالياً."
      : "لا توجد نتائج مطابقة لمعايير البحث الحالية.";
    tbody.innerHTML = `<tr><td colspan="${WAITING_COLSPAN}"><div class="table-empty">${escapeHtml(msg)}</div></td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((r, idx) => `
    <tr>
      <td>${escapeHtml(r.student_name)}</td>
      <td>${escapeHtml(r.phone)}</td>
      <td>${escapeHtml(r.college || "—")}</td>
      <td>${escapeHtml(r.specialization)}</td>
      <td>${escapeHtml(r.department)}</td>
      <td>${formatDateShort(r.registration_date)}</td>
      <td>
        <div class="actions-cell">
          <button class="btn-edit" data-assign-idx="${idx}">📅 تحديد الفترة</button>
          <button class="btn-delete" data-delete-idx="${idx}">🗑 حذف</button>
        </div>
      </td>
    </tr>`).join("");

  tbody.querySelectorAll("[data-assign-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.assignIdx);
      handleAssignPeriod(list[idx]);
    });
  });

  tbody.querySelectorAll("[data-delete-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.deleteIdx);
      handleDeleteWaitlistRecord(list[idx]);
    });
  });
}

// ---------------------------------------------------------------------------
// تحديد فترة التدريب ونقل السجل إلى لوحة الإدارة
// ---------------------------------------------------------------------------
/**
 * معالجة الضغط على زر «📅 تحديد الفترة»: تفتح نفس نافذة تعديل بيانات المتدرب
 * المستخدمة في لوحة الإدارة (بعنوان وزر حفظ مخصصين لسياق النقل)، مع حقلي
 * تاريخ فارغين يفرض التحقق الداخلي في showEditStudentModal تعبئتهما قبل
 * القبول. عند الحفظ: يُستدعى updateStudentRecord() الذي يضبط is_waitlist=false
 * ضمن نفس الطلب، فيختفي السجل من waitingState.all محلياً فوراً (ويظهر عند
 * فتح لوحة الإدارة لاحقاً لأنها تجلب فقط is_waitlist=false).
 * @param {object} record - سجل قائمة الانتظار المطلوب تحديد فترته
 */
async function handleAssignPeriod(record){
  const updates = await showEditStudentModal(record, {
    title: "تحديد فترة التدريب ونقل الطالب",
    confirmLabel: "حفظ ونقل إلى لوحة الإدارة",
  });
  if (!updates) return;

  try {
    await updateStudentRecord(record.id, updates);
    waitingState.all = waitingState.all.filter(s => s.id !== record.id);

    showToast("تم تحديد فترة التدريب، وانتقل الطالب إلى لوحة الإدارة", "success");
    populateWaitingDepartmentFilter();
    renderWaitingTable();
  } catch (err){
    console.error("فشل تحديد فترة تدريب من قائمة الانتظار:", err);
    showToast(describeSupabaseError(err, "تعذر حفظ الفترة"), "error");
  }
}

// ---------------------------------------------------------------------------
// حذف سجل من قائمة الانتظار نهائياً
// ---------------------------------------------------------------------------
/**
 * معالجة الضغط على زر «🗑 حذف»: تعرض نافذة تأكيد صريحة أولاً، ولا تُنفّذ أي
 * حذف فعلي إلا بعد موافقة المستخدم — بنفس منطق الحذف في لوحة الإدارة تماماً.
 * @param {object} record - سجل قائمة الانتظار المطلوب حذفه نهائياً
 */
async function handleDeleteWaitlistRecord(record){
  const confirmed = await showConfirm({
    title: "حذف من قائمة الانتظار",
    text: `سيتم حذف ${escapeHtml(record.student_name)} (${escapeHtml(record.department)}) نهائياً من قائمة الانتظار. لا يمكن التراجع عن هذا الإجراء.`,
    confirmLabel: "حذف نهائياً",
  });
  if (!confirmed) return;

  try {
    await deleteStudentsByIds([record.id]);
    waitingState.all = waitingState.all.filter(s => s.id !== record.id);

    showToast("تم الحذف من قائمة الانتظار", "success");
    populateWaitingDepartmentFilter();
    renderWaitingTable();
  } catch (err){
    console.error("فشل حذف سجل من قائمة الانتظار:", err);
    showToast(describeSupabaseError(err, "تعذر الحذف"), "error");
  }
}
