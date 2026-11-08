-- Run once in Supabase SQL Editor. No patient records belong in this repository.
create table public.team_members(user_id uuid primary key references auth.users(id) on delete cascade, display_name text not null);
alter table public.team_members enable row level security;
create policy members_self on public.team_members for select to authenticated using(user_id=auth.uid());
create function public.is_team_member() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.team_members where user_id=auth.uid()); $$;
revoke execute on function public.is_team_member() from public, anon;
grant execute on function public.is_team_member() to authenticated;

create table public.work_records(
 id uuid primary key default gen_random_uuid(),
 category text not null check(category in ('service','sso','tcb1','tcb2','training','newcase','meeting')),
 title text not null check(length(trim(title)) between 1 and 500), work_date date not null,
 status text not null check(status in ('กำลังดำเนินการ','เสร็จสิ้น','รอข้อมูล')),
 details jsonb not null default '{}', notes text not null default '',
 created_by uuid not null references auth.users(id), author_name text not null,
 file_path text, file_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Owner, author name and timestamps are always set by the database, never by the browser.
-- A newly attached file must live in the caller's own folder (<uid>/...), so a record cannot
-- point at (and thereby expose) someone else's unreferenced file.
create function public.stamp_record() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='INSERT' then
  NEW.created_by=auth.uid();
  select display_name into NEW.author_name from public.team_members where user_id=auth.uid();
  NEW.created_at=now();
 else
  NEW.created_by=OLD.created_by; NEW.author_name=OLD.author_name; NEW.created_at=OLD.created_at;
 end if;
 if NEW.file_path is not null and (TG_OP='INSERT' or NEW.file_path is distinct from OLD.file_path)
    and split_part(NEW.file_path,'/',1) <> coalesce(auth.uid()::text,'') then
  raise exception 'file_path must be inside your own folder';
 end if;
 NEW.updated_at=now(); return NEW;
end $$;
create trigger stamp_work before insert or update on public.work_records for each row execute function public.stamp_record();

alter table public.work_records enable row level security;
create policy team_read on public.work_records for select to authenticated using(public.is_team_member());
create policy own_insert on public.work_records for insert to authenticated with check(public.is_team_member() and created_by=auth.uid());
create policy own_update on public.work_records for update to authenticated using(public.is_team_member() and created_by=auth.uid()) with check(public.is_team_member() and created_by=auth.uid());
create index work_date_idx on public.work_records(work_date desc);
create index work_file_idx on public.work_records(file_path) where file_path is not null;

-- Explicit grants (no delete from the web app; anon gets nothing).
revoke all on public.team_members, public.work_records from anon;
grant select on public.team_members to authenticated;
grant select, insert, update on public.work_records to authenticated;

-- Private bucket: PDF/JPG/PNG up to 10 MB.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('documents','documents',false,10485760,array['application/pdf','image/jpeg','image/png']);
create policy docs_upload on storage.objects for insert to authenticated with check(bucket_id='documents' and public.is_team_member() and (storage.foldername(name))[1]=auth.uid()::text);
-- Team members can read files attached to a record; owners can also see their own folder (needed to clean up failed/replaced uploads).
create policy docs_read on storage.objects for select to authenticated using(bucket_id='documents' and public.is_team_member() and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.work_records r where r.file_path=objects.name)));
create policy docs_cleanup on storage.objects for delete to authenticated using(bucket_id='documents' and public.is_team_member() and (storage.foldername(name))[1]=auth.uid()::text);
