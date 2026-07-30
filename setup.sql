-- ============================================================
-- إعداد صلاحيات القراءة للوحة التحليلات
-- شغّل هذا السكربت مرة واحدة في: Supabase Studio → SQL Editor
-- على الـ instance: https://supabase-automation.medipol.edu.tr
-- ============================================================
--
-- الهدف: السماح لأي مستخدم مسجّل دخوله (authenticated) بقراءة
-- جدولي التحليلات فقط (قراءة فقط، بدون تعديل)، مع إبقاء الوصول
-- مغلقًا أمام الزوار غير المسجّلين (anon).

-- 1) جدول الصفقات / الليدز
alter table public.bitrix_deals enable row level security;

drop policy if exists "authenticated can read deals" on public.bitrix_deals;
create policy "authenticated can read deals"
  on public.bitrix_deals
  for select
  to authenticated
  using (true);

-- 2) جدول الأنشطة
alter table public.bitrix_activities enable row level security;

drop policy if exists "authenticated can read activities" on public.bitrix_activities;
create policy "authenticated can read activities"
  on public.bitrix_activities
  for select
  to authenticated
  using (true);

-- (اختياري) لو أردت السماح للزوار غير المسجّلين بالقراءة أيضًا،
-- أضف "anon" مع "authenticated" أعلاه — لكن الأفضل إبقاؤه مغلقًا.
