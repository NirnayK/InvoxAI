create table if not exists files (
  id uuid primary key,
  owner uuid references auth.users (id),
  hash_sha256 char(64) not null unique,
  path text not null,
  url text not null,
  size_bytes bigint not null,
  mime_type text not null,
  original_name text,
  created_at timestamptz default now()
);

create index if not exists files_hash_idx on files (hash_sha256);
