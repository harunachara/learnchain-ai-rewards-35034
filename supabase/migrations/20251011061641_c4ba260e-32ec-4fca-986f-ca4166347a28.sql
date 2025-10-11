-- Create a secure function to process quiz rewards
CREATE OR REPLACE FUNCTION public.process_quiz_reward(
  p_user_id UUID,
  p_quiz_id UUID,
  p_reward_amount INTEGER,
  p_quiz_title TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Get user's wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;

  -- Create transaction record
  INSERT INTO transactions (wallet_id, amount, type, metadata)
  VALUES (
    v_wallet_id,
    p_reward_amount,
    'reward',
    jsonb_build_object('quiz_id', p_quiz_id, 'quiz_title', p_quiz_title)
  );

  -- Update wallet balance
  UPDATE wallets
  SET balance = balance + p_reward_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  RETURN TRUE;
END;
$function$;