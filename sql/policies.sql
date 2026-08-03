-- ============================================================================
-- policies.sql
-- سياسات أمان الصفوف (RLS) لجدول students
-- تُستخدم فقط مع مفتاح Anon Key من الواجهة الأمامية
-- ============================================================================

alter table public.students enable row level security;

-- السماح بالقراءة العامة (اللوحة تعرض بيانات المتدربين لجميع الموظفين المخوّلين)
create policy "allow_read_students"
on public.students
for select
using (true);

-- السماح بإدراج سجلات جديدة فقط (لا تعديل ولا حذف من الواجهة)
create policy "allow_insert_students"
on public.students
for insert
with check (
  length(trim(student_name)) > 0
  and length(trim(phone)) > 0
  and length(trim(specialization)) > 0
  and length(trim(department)) > 0
  and training_end >= training_start
);

-- لا توجد سياسة UPDATE أو DELETE عمداً:
-- بما أن النظام يعتمد على الاحتفاظ الكامل بسجل كل تسجيل (بدون حذف التكرارات)
-- فإن التعديل/الحذف يجب أن يتم فقط عبر لوحة تحكم Supabase بصلاحيات إدارية،
-- وليس عبر مفتاح Anon Key المستخدم في هذا التطبيق.
