// ============================================================================
// ui.js
// عناصر واجهة مشتركة: التنبيهات (Toast) ونافذة التأكيد المخصصة
// لا يوجد أي استخدام لـ alert() أو confirm()
// ============================================================================

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

// -------- تبديل حالة زر التحميل (Spinner) --------
function setButtonLoading(btn, isLoading, labelEl){
  btn.disabled = isLoading;
  btn.classList.toggle("loading", isLoading);
}

// -------- تنسيق التاريخ الميلادي بشكل عربي مقروء --------
function formatArabicDate(dateStr){
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
}

function formatDateShort(dateStr){
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// -------- حساب مدة التدريب بالأيام + صياغة عربية --------
function calcDurationDays(start, end){
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return diff;
}

function formatDurationLabel(days){
  if (days <= 0) return "—";
  if (days === 1) return "يوم واحد";
  if (days === 2) return "يومان";
  if (days >= 3 && days <= 10) return `${days} أيام`;
  return `${days} يوم`;
}

// -------- تحديد حالة التدريب بناءً على تاريخ اليوم --------
function getTrainingStatus(start, end){
  const today = new Date(); today.setHours(0,0,0,0);
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (today < s) return { key: "upcoming", label: "لم يبدأ", cls: "status-upcoming" };
  if (today > e) return { key: "ended", label: "انتهى", cls: "status-ended" };
  return { key: "active", label: "قيد التدريب", cls: "status-active" };
}

// -------- تأخير بسيط لمنع النقر المتكرر --------
function debounce(fn, wait = 250){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
