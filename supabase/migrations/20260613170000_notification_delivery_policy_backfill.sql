grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update on public.push_subscriptions to authenticated;
grant select on public.notification_deliveries to authenticated;

drop policy if exists "Users can read own notification preferences"
  on public.notification_preferences;
create policy "Users can read own notification preferences"
  on public.notification_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification preferences"
  on public.notification_preferences;
create policy "Users can insert own notification preferences"
  on public.notification_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification preferences"
  on public.notification_preferences;
create policy "Users can update own notification preferences"
  on public.notification_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own push subscriptions"
  on public.push_subscriptions;
create policy "Users can read own push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own push subscriptions"
  on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
  on public.push_subscriptions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own push subscriptions"
  on public.push_subscriptions;
create policy "Users can update own push subscriptions"
  on public.push_subscriptions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own notification deliveries"
  on public.notification_deliveries;
create policy "Users can read own notification deliveries"
  on public.notification_deliveries
  for select
  to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
