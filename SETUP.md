
# INTERNET 2008 — Setup Guide

## Requirements
- GitHub account
- Supabase project
- Vercel account

## Setup
1. Upload all project files to the repository root.
2. Create a Supabase project.
3. Review and run supabase/schema.sql in the Supabase SQL Editor.
4. Configure the required Supabase URL and publishable/anon key as environment variables.
5. Import the GitHub repository into Vercel.
6. Set the build command to npm run build and output directory to dist, if required by Vercel.
7. Deploy and test the website.

## Important
Never put service-role keys or passwords in public source code. Verify the build and test authentication, chat, and database security before treating the site as production-ready.
