-- Sent / Inbox folder flags from Gmail labelIds
alter table emails add column if not exists is_sent boolean default false;
alter table emails add column if not exists is_inbox boolean default true;

create index if not exists emails_user_sent_idx on emails (user_id, is_sent) where is_sent = true;
create index if not exists emails_user_inbox_idx on emails (user_id, is_inbox) where is_inbox = true;
