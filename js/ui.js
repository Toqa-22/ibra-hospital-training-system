// ============================================================================
// ui.js
// عناصر واجهة مشتركة تُستخدم من كل من index.html وdashboard.html:
// التنبيهات المنبثقة (Toast)، نافذة التأكيد المخصصة، نافذة تعديل بيانات
// المتدرب، بالإضافة إلى دوال تنسيق التواريخ والمدة (بأسبوع عمل من الأحد
// للخميس)، حساب حالة التدريب، وترجمة أخطاء Supabase لرسائل عربية مفهومة.
//
// لا يوجد أي استخدام لـ alert() أو confirm() الأصليتين في المتصفح؛ كل تفاعل
// مع المستخدم يمر عبر showToast()، showConfirm()، أو showEditStudentModal().
//
// يجب تحميل هذا الملف *قبل* supabase.js وapp.js وdashboard.js وreport.js
// لأنهم جميعاً يعتمدون على الدوال المعرَّفة هنا.
// ============================================================================

/**
 * التأكد من وجود حاوية التنبيهات المنبثقة (toast-stack) في الصفحة، وإنشاؤها
 * إن لم تكن موجودة بعد. تُستدعى داخلياً من showToast() فقط.
 * @returns {HTMLElement} عنصر الحاوية
 */
function ensureToastStack(){
  let stack = document.querySelector(".toast-stack");
  if (!stack){
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

const TOAST_ICONS = { success: "✅", error: "⚠️", warning: "⏳" };

/**
 * عرض تنبيه منبثق قصير للمستخدم (نجاح/خطأ/تحذير) في أسفل يسار الشاشة، يختفي
 * تلقائياً بعد مدة محددة أو عند الضغط على زر الإغلاق. الاستبدال الوحيد
 * لـ alert() في هذا المشروع لعرض رسائل النجاح/الفشل.
 * @param {string} message - نص الرسالة (يُعقَّم تلقائياً عبر escapeHtml)
 * @param {'success'|'error'|'warning'} type - نوع التنبيه ولونه
 * @param {number} duration - المدة بالمللي ثانية قبل الاختفاء التلقائي (0 = لا يختفي تلقائياً)
 */
function showToast(message, type = "success", duration = 3600){
  const stack = ensureToastStack();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="icon">${TOAST_ICONS[type] || "ℹ️"}</span>
    <span class="msg">${escapeHtml(message)}</span>
    <button class="close-toast" aria-label="إغلاق">✕</button>
  `;
  stack.appendChild(toast);

  const remove = () => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 200);
  };
  toast.querySelector(".close-toast").addEventListener("click", remove);
  if (duration > 0) setTimeout(remove, duration);
}

// -------- نافذة تأكيد مخصصة (بديل لـ confirm()) --------
/**
 * التأكد من وجود نافذة التأكيد المنبثقة (confirm modal) في الصفحة، وإنشاؤها
 * إن لم تكن موجودة بعد. تُستدعى داخلياً من showConfirm() فقط.
 * @returns {HTMLElement} عنصر الطبقة الخلفية (overlay) للنافذة
 */
function ensureModal(){
  let overlay = document.querySelector(".modal-overlay");
  if (!overlay){
    overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="m-icon">❔</div>
        <h4 class="m-title"></h4>
        <p class="m-text"></p>
        <div class="modal-actions">
          <button class="m-cancel">إلغاء</button>
          <button class="m-confirm">تأكيد</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }
  return overlay;
}

/**
 * عرض نافذة تأكيد مخصصة (بديل alert/confirm الأصليين في المتصفح) وإرجاع وعد
 * (Promise) ينتظر قرار المستخدم. تُستخدم قبل أي عملية حساسة كالحذف النهائي.
 * @param {{title?:string, text?:string, confirmLabel?:string}} options - نصوص النافذة القابلة للتخصيص
 * @returns {Promise<boolean>} true إذا ضغط المستخدم تأكيد، false إذا ألغى
 */
function showConfirm({ title = "تأكيد العملية", text = "", confirmLabel = "تأكيد" } = {}){
  return new Promise(resolve => {
    const overlay = ensureModal();
    overlay.querySelector(".m-title").textContent = title;
    overlay.querySelector(".m-text").textContent = text;
    overlay.querySelector(".m-confirm").textContent = confirmLabel;
    overlay.classList.add("show");

    const cancelBtn = overlay.querySelector(".m-cancel");
    const confirmBtn = overlay.querySelector(".m-confirm");

    const cleanup = (result) => {
      overlay.classList.remove("show");
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirm);
      resolve(result);
    };
    const onCancel = () => cleanup(false);
    const onConfirm = () => cleanup(true);

    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirm);
  });
}

// -------- نافذة تعديل بيانات متدرب (سجل واحد) --------
/**
 * التأكد من وجود نافذة تعديل بيانات المتدرب في الصفحة، وإنشاؤها بكل حقولها
 * (الاسم، الهاتف، الكلية، التخصص، القسم، تاريخي البداية والنهاية) إن لم تكن
 * موجودة بعد. تُستدعى داخلياً من showEditStudentModal() فقط.
 * @returns {HTMLElement} عنصر الطبقة الخلفية (overlay) لنافذة التعديل
 */
function ensureEditModal(){
  let overlay = document.querySelector(".edit-modal-overlay");
  if (!overlay){
    overlay = document.createElement("div");
    overlay.className = "modal-overlay edit-modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box edit-modal-box">
        <h4 class="m-title">تعديل بيانات المتدرب</h4>
        <div class="edit-form">
          <div class="e-field">
            <label>اسم الطالب</label>
            <input type="text" class="e-name">
          </div>
          <div class="e-field">
            <label>رقم الهاتف</label>
            <input type="text" class="e-phone" inputmode="numeric">
          </div>
          <div class="e-field">
            <label>الكلية / الجامعة</label>
            <input type="text" class="e-college">
          </div>
          <div class="e-field">
            <label>التخصص</label>
            <input type="text" class="e-spec">
          </div>
          <div class="e-field full">
            <label>القسم</label>
            <select class="e-dept"></select>
          </div>
          <div class="e-field">
            <label>بداية التدريب</label>
            <input type="date" class="e-start">
          </div>
          <div class="e-field">
            <label>نهاية التدريب</label>
            <input type="date" class="e-end">
          </div>
        </div>
        <p class="e-error"></p>
        <div class="modal-actions">
          <button class="m-cancel">إلغاء</button>
          <button class="m-confirm m-save">حفظ التعديلات</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }
  return overlay;
}

/**
 * عرض نافذة تعديل مُعبّأة مسبقاً بقيم سجل معيّن، مع تحقق فوري من صحة الحقول
 * (كلها إلزامية، الهاتف أرقام فقط، تاريخ النهاية لا يسبق البداية) قبل قبول
 * الحفظ. تُرجع وعداً ينتظر قرار المستخدم.
 * @param {object} record - السجل الحالي المطلوب تعديله (لتعبئة الحقول بقيمه)
 * @returns {Promise<object|null>} كائن القيم الجديدة عند الحفظ، أو null عند الإلغاء
 */
function showEditStudentModal(record){
  return new Promise(resolve => {
    const overlay = ensureEditModal();
    const nameInput = overlay.querySelector(".e-name");
    const phoneInput = overlay.querySelector(".e-phone");
    const collegeInput = overlay.querySelector(".e-college");
    const specInput = overlay.querySelector(".e-spec");
    const deptSelect = overlay.querySelector(".e-dept");
    const startInput = overlay.querySelector(".e-start");
    const endInput = overlay.querySelector(".e-end");
    const errorEl = overlay.querySelector(".e-error");

    nameInput.value = record.student_name || "";
    phoneInput.value = record.phone || "";
    collegeInput.value = record.college || "";
    specInput.value = record.specialization || "";
    deptSelect.innerHTML = DEPARTMENTS.map(d => `<option value="${escapeHtml(d)}" ${d === record.department ? "selected" : ""}>${escapeHtml(d)}</option>`).join("");
    startInput.value = record.training_start || "";
    endInput.value = record.training_end || "";
    errorEl.textContent = "";
    errorEl.classList.remove("show");

    overlay.classList.add("show");

    const cancelBtn = overlay.querySelector(".m-cancel");
    const confirmBtn = overlay.querySelector(".m-save");

    const cleanup = (result) => {
      overlay.classList.remove("show");
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirm);
      resolve(result);
    };
    const onCancel = () => cleanup(null);
    const onConfirm = () => {
      const student_name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const college = collegeInput.value.trim();
      const specialization = specInput.value.trim();
      const department = deptSelect.value;
      const training_start = startInput.value;
      const training_end = endInput.value;

      if (!student_name || !phone || !specialization || !department || !training_start || !training_end){
        errorEl.textContent = "يرجى تعبئة جميع الحقول المطلوبة";
        errorEl.classList.add("show");
        return;
      }
      if (!/^[0-9]+$/.test(phone)){
        errorEl.textContent = "رقم الهاتف يجب أن يحتوي أرقاماً فقط";
        errorEl.classList.add("show");
        return;
      }
      if (new Date(training_end) < new Date(training_start)){
        errorEl.textContent = "تاريخ النهاية لا يمكن أن يسبق تاريخ البداية";
        errorEl.classList.add("show");
        return;
      }

      cleanup({ student_name, phone, college, specialization, department, training_start, training_end });
    };

    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirm);
  });
}

// -------- تبديل حالة زر التحميل (Spinner) --------
/**
 * تبديل شكل أي زر بين حالته العادية وحالة «جارٍ التحميل» (تعطيل الزر + إظهار
 * دوّارة تحميل صغيرة بداخله). تُستخدم أثناء انتظار رد Supabase لمنع النقر
 * المتكرر ولإعطاء المستخدم إشارة بصرية أن العملية قيد التنفيذ.
 * @param {HTMLElement} btn - عنصر الزر المطلوب تبديل حالته
 * @param {boolean} isLoading - true لتفعيل حالة التحميل، false لإعادته لحالته الطبيعية
 */
function setButtonLoading(btn, isLoading, labelEl){
  btn.disabled = isLoading;
  btn.classList.toggle("loading", isLoading);
}

// -------- تنسيق التاريخ الميلادي بشكل عربي مقروء --------
/**
 * تنسيق تاريخ (بصيغة yyyy-mm-dd) إلى نص عربي طويل مقروء (مثال: ٦ أغسطس ٢٠٢٦).
 * @param {string} dateStr - التاريخ بصيغة yyyy-mm-dd
 * @returns {string} التاريخ بصيغة عربية طويلة، أو «—» إن كانت القيمة فارغة
 */
function formatArabicDate(dateStr){
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * تنسيق تاريخ (بصيغة yyyy-mm-dd أو كائن Date) إلى صيغة مختصرة يوم/شهر/سنة
 * (مثال: 06/08/2026)، تُستخدم في كل الجداول والتقارير لاختصار المساحة.
 * @param {string|Date} dateStr - التاريخ المطلوب تنسيقه
 * @returns {string} التاريخ بصيغة dd/mm/yyyy، أو «—» إن كانت القيمة فارغة
 */
function formatDateShort(dateStr){
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// -------- حساب مدة التدريب بأيام العمل فقط (الأحد إلى الخميس، باستثناء الجمعة والسبت) --------
/**
 * حساب عدد أيام العمل الفعلية بين تاريخي بداية ونهاية، باعتبار أسبوع العمل
 * من الأحد إلى الخميس فقط (٥ أيام) — أي يوم جمعة أو سبت يقع ضمن الفترة
 * لا يُحتسب ضمن المدة المعروضة للمستخدم، مهما كان عدد الأيام التقويمية الفعلي.
 * @param {string} start - تاريخ البداية بصيغة yyyy-mm-dd
 * @param {string} end - تاريخ النهاية بصيغة yyyy-mm-dd
 * @returns {number} عدد أيام العمل (الأحد-الخميس) ضمن الفترة، شاملاً يومي البداية والنهاية
 */
function calcDurationDays(start, end){
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  let count = 0;
  const cur = new Date(s);
  while (cur <= e){
    const day = cur.getDay(); // 0=الأحد … 5=الجمعة، 6=السبت
    if (day !== 5 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// -------- صياغة عربية لعدد الأيام (تُستخدم كاحتياط لما دون الأسبوع، ولبقية الأيام) --------
/**
 * صياغة عربية نحوياً صحيحة لعدد أيام (يوم واحد / يومان / ٣-١٠ أيام / أكثر).
 * تُستخدم كجزء من formatDurationLabel() لعرض الأيام المتبقية بعد الأسابيع الكاملة.
 * @param {number} days - عدد الأيام
 * @returns {string} النص العربي المناسب للعدد
 */
function formatDaysArabic(days){
  if (days === 1) return "يوم واحد";
  if (days === 2) return "يومان";
  if (days >= 3 && days <= 10) return `${days} أيام`;
  return `${days} يوم`;
}

// -------- صياغة عربية لعدد الأسابيع --------
/**
 * صياغة عربية نحوياً صحيحة لعدد أسابيع العمل (أسبوع واحد / أسبوعان / ٣-١٠ أسابيع / أكثر).
 * «الأسبوع» هنا يعني أسبوع عمل من الأحد للخميس (٥ أيام)، وليس أسبوعاً تقويمياً كاملاً.
 * @param {number} weeks - عدد الأسابيع
 * @returns {string} النص العربي المناسب للعدد
 */
function formatWeeksArabic(weeks){
  if (weeks === 1) return "أسبوع واحد";
  if (weeks === 2) return "أسبوعان";
  if (weeks >= 3 && weeks <= 10) return `${weeks} أسابيع`;
  return `${weeks} أسبوعاً`;
}

// -------- صياغة مدة التدريب بأسابيع العمل (٥ أيام: الأحد–الخميس)، مع أيام متبقية إن وُجدت --------
/**
 * الدالة الرئيسية لعرض مدة التدريب للمستخدم: تحوّل عدد أيام العمل (الناتج من
 * calcDurationDays) إلى صياغة عربية مركّبة من أسابيع وأيام متبقية معاً
 * (مثال: «٤ أسابيع ويومان»)، أو أيام فقط إن كانت المدة أقل من أسبوع كامل.
 * تُستخدم في كل مكان تظهر فيه «مدة التدريب» بالمشروع (النموذج، الجدول، التقارير).
 * @param {number} workingDays - عدد أيام العمل (ناتج calcDurationDays)
 * @returns {string} نص المدة بصياغة عربية، أو «—» إن كانت القيمة صفر أو أقل
 */
function formatDurationLabel(workingDays){
  if (workingDays <= 0) return "—";

  const weeks = Math.floor(workingDays / 5);
  const remainingDays = workingDays % 5;

  if (weeks === 0) return formatDaysArabic(remainingDays);
  if (remainingDays === 0) return formatWeeksArabic(weeks);
  return `${formatWeeksArabic(weeks)} و${formatDaysArabic(remainingDays)}`;
}

// -------- تحديد حالة التدريب بناءً على تاريخ اليوم --------
/**
 * تحديد حالة تدريب سجل واحد بمقارنة تاريخ اليوم بفترة البداية والنهاية:
 * «لم يبدأ» إن كان اليوم قبل البداية، «انتهى» إن كان بعد النهاية،
 * وإلا «قيد التدريب». تُستخدم لعرض شارة الحالة الملوّنة في كل مكان بالمشروع.
 * @param {string} start - تاريخ بداية التدريب بصيغة yyyy-mm-dd
 * @param {string} end - تاريخ نهاية التدريب بصيغة yyyy-mm-dd
 * @returns {{key:string, label:string, cls:string}} مفتاح الحالة، نصها العربي، وصنف CSS الخاص بلونها
 */
function getTrainingStatus(start, end){
  const today = new Date(); today.setHours(0,0,0,0);
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (today < s) return { key: "upcoming", label: "لم يبدأ", cls: "status-upcoming" };
  if (today > e) return { key: "ended", label: "انتهى", cls: "status-ended" };
  return { key: "active", label: "قيد التدريب", cls: "status-active" };
}

// -------- بديل شعار الشريط العلوي في حال عدم وجود assets/logo.png --------
/**
 * معالج حدث onerror لصورة الشعار (assets/logo.png): إن تعذّر تحميل الصورة
 * (غير موجودة أو الرابط خاطئ)، تُستبدل تلقائياً بشارة نصية بديلة («ت»)
 * بنفس أبعاد وصنف CSS الصورة الأصلية، بدل ترك أيقونة صورة مكسورة في الواجهة.
 * @param {HTMLImageElement} img - عنصر الصورة الذي فشل تحميله
 */
function handleLogoImgError(img){
  const fallback = document.createElement("div");
  fallback.className = img.className;
  fallback.textContent = "ت";
  img.replaceWith(fallback);
}

// -------- تأخير بسيط لمنع النقر المتكرر --------
/**
 * تأخير تنفيذ دالة حتى تتوقف الاستدعاءات المتكررة لمدة معينة، لمنع تنفيذ
 * منطق مكلف (كإعادة رسم الجدول بالكامل) مع كل ضغطة مفتاح أثناء الكتابة
 * في حقول البحث الفورية. كل استدعاء جديد قبل انتهاء المهلة يُلغي المؤقت السابق.
 * @param {Function} fn - الدالة المطلوب تأخيرها
 * @param {number} wait - مدة الانتظار بالمللي ثانية بعد آخر استدعاء
 * @returns {Function} نسخة مؤخَّرة (debounced) من الدالة الأصلية
 */
function debounce(fn, wait = 250){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// -------- ترجمة أخطاء Supabase الشائعة إلى رسائل عربية واضحة وقابلة للتصرف --------
// actionLabel: فعل العملية التي فشلت، مثل "تعذر إتمام التسجيل" أو "تعذر حذف الطالب"
/**
 * ترجمة كائن خطأ خام قادم من Supabase (بعد فشل أي طلب insert/update/delete)
 * إلى رسالة عربية واضحة وقابلة للتصرف، بمطابقة أكواد/رسائل الأخطاء الشائعة
 * (سياسات RLS، جدول غير موجود، مخالفة قيد تاريخي، مفتاح API خاطئ، عدم تحديث
 * config.js بعد...). تُستخدم في كل مكان يُعرض فيه خطأ فشل عملية للمستخدم،
 * مع طباعة الخطأ الكامل في Console دائماً لتسهيل التشخيص الفني.
 * @param {object} err - كائن الخطأ كما أرجعه عميل Supabase
 * @param {string} actionLabel - وصف العملية التي فشلت (مثال: «تعذر حذف الطالب»)
 * @returns {string} رسالة عربية جاهزة للعرض في Toast
 */
function describeSupabaseError(err, actionLabel = "تعذرت العملية"){
  const code = err && err.code;
  const msg = (err && (err.message || err.error_description || err.hint)) || "";
  const lower = msg.toLowerCase();

  if (code === "42501" || lower.includes("row-level security") || lower.includes("policy")){
    return `${actionLabel} بسبب سياسات RLS — تأكد من تفعيل السياسة المناسبة (قراءة/إدراج/حذف) في مشروع Supabase`;
  }
  if (code === "42P01" || lower.includes("does not exist") || lower.includes("relation")){
    return "الجدول students غير موجود — تأكد من تنفيذ sql/full_setup.sql في مشروع Supabase";
  }
  if (code === "23514" || lower.includes("chk_training_dates") || lower.includes("check constraint")){
    return "تاريخ النهاية يجب ألا يسبق تاريخ البداية لأحد الأقسام المختارة";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network request failed")){
    return "تعذر الاتصال بـ Supabase — تحقق من اتصالك بالإنترنت ومن صحة SUPABASE_URL في js/config.js";
  }
  if (lower.includes("invalid api key") || lower.includes("apikey") || lower.includes("jwt")){
    return "مفتاح Supabase غير صحيح — تحقق من SUPABASE_ANON_KEY في js/config.js";
  }
  if (lower.includes("your-project-ref") || lower.includes("your-public-anon-key")){
    return "لم يتم تحديث js/config.js بعد — ضع بيانات مشروعك الحقيقية بدل القيم الافتراضية";
  }

  // احتياطي: أظهر رسالة Supabase الأصلية إن وُجدت لتسهيل التشخيص
  return msg ? `${actionLabel}: ${msg}` : `${actionLabel}، يرجى المحاولة مرة أخرى`;
}
