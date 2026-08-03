-- ============================================================================
-- schema.sql
-- جدول المتدربين — نظام تسجيل المتدربين لقسم التدريب والتطوير المهني
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.students (
  id                uuid primary key default gen_random_uuid(),
  student_name      text not null,
  phone             text not null,
  specialization    text not null,
  department        text not null,
  training_start    date not null,
  training_end      date not null,
  registration_date date not null default current_date,
  created_at        timestamp with time zone not null default now(),

  constraint chk_training_dates check (training_end >= training_start)
);

-- فهارس لتسريع الفلترة والتجميع الشائعين في لوحة التحكم
create index if not exists idx_students_department on public.students (department);
create index if not exists idx_students_name_phone on public.students (student_name, phone);
create index if not exists idx_students_created_at on public.students (created_at desc);
