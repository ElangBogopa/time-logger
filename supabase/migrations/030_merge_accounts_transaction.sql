-- Atomic merge-accounts function
-- Moves all data from email_user to google_user in a single transaction,
-- then deletes the email user. If any step fails, everything rolls back.

CREATE OR REPLACE FUNCTION merge_accounts(
  p_email_user_id UUID,
  p_google_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_moved_entries INT := 0;
  v_deleted_dupes INT := 0;
  v_moved_targets INT := 0;
  v_moved_goals INT := 0;
  v_moved_plans INT := 0;
  v_moved_completions INT := 0;
  v_moved_moods INT := 0;
  v_moved_checkins INT := 0;
  v_moved_reviews INT := 0;
BEGIN
  -- Verify both users exist
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_email_user_id) THEN
    RAISE EXCEPTION 'Email user not found: %', p_email_user_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_google_user_id) THEN
    RAISE EXCEPTION 'Google user not found: %', p_google_user_id;
  END IF;

  -- 1. Delete duplicate time entries (same date + start_time in both accounts)
  WITH dupes AS (
    DELETE FROM time_entries e
    WHERE e.user_id = p_email_user_id
      AND EXISTS (
        SELECT 1 FROM time_entries g
        WHERE g.user_id = p_google_user_id
          AND g.date = e.date
          AND COALESCE(g.start_time, '') = COALESCE(e.start_time, '')
      )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted_dupes FROM dupes;

  -- 2. Move remaining time entries
  WITH moved AS (
    UPDATE time_entries SET user_id = p_google_user_id
    WHERE user_id = p_email_user_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved_entries FROM moved;

  -- 3. Delete duplicate weekly targets (same target_type)
  DELETE FROM weekly_targets
  WHERE user_id = p_email_user_id
    AND target_type IN (
      SELECT target_type FROM weekly_targets WHERE user_id = p_google_user_id
    );

  -- Move remaining targets
  WITH moved AS (
    UPDATE weekly_targets SET user_id = p_google_user_id
    WHERE user_id = p_email_user_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved_targets FROM moved;

  -- 4. Move goals (delete dupes by name first)
  DELETE FROM user_goals
  WHERE user_id = p_email_user_id
    AND title IN (
      SELECT title FROM user_goals WHERE user_id = p_google_user_id
    );

  WITH moved AS (
    UPDATE user_goals SET user_id = p_google_user_id
    WHERE user_id = p_email_user_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved_goals FROM moved;

  -- 5. Move daily plans
  WITH moved AS (
    UPDATE daily_plans SET user_id = p_google_user_id
    WHERE user_id = p_email_user_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved_plans FROM moved;

  -- 6. Move session completions
  WITH moved AS (
    UPDATE session_completions SET user_id = p_google_user_id
    WHERE user_id = p_email_user_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved_completions FROM moved;

  -- 7. Move mood checkins
  WITH moved AS (
    UPDATE mood_checkins SET user_id = p_google_user_id
    WHERE user_id = p_email_user_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved_moods FROM moved;

  -- 8. Move morning checkins
  WITH moved AS (
    UPDATE morning_checkins SET user_id = p_google_user_id
    WHERE user_id = p_email_user_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved_checkins FROM moved;

  -- 9. Move day reviews
  WITH moved AS (
    UPDATE day_reviews SET user_id = p_google_user_id
    WHERE user_id = p_email_user_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved_reviews FROM moved;

  -- 10. Delete email user's preferences
  DELETE FROM user_preferences WHERE user_id = p_email_user_id;

  -- 11. Delete email user's calendar connections
  DELETE FROM calendar_connections WHERE user_id = p_email_user_id;

  -- 12. Delete pending calendar connections
  DELETE FROM pending_calendar_connections WHERE user_id = p_email_user_id;

  -- 13. Delete push subscriptions
  DELETE FROM push_subscriptions WHERE user_id = p_email_user_id;

  -- 14. Delete the email user
  DELETE FROM users WHERE id = p_email_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'moved_entries', v_moved_entries,
    'deleted_duplicate_entries', v_deleted_dupes,
    'moved_targets', v_moved_targets,
    'moved_goals', v_moved_goals,
    'moved_plans', v_moved_plans,
    'moved_completions', v_moved_completions,
    'moved_moods', v_moved_moods,
    'moved_checkins', v_moved_checkins,
    'moved_reviews', v_moved_reviews
  );
END;
$$;
