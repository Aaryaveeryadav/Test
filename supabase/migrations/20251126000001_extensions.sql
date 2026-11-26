-- Sahayak Study Platform
-- Migration 1: extensions (pgvector for embeddings; pgcrypto for tokens)

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;
