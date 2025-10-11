-- Update the handle_new_user function to generate a wallet address
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email
  );
  
  -- Insert default student role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  -- Create wallet with generated address
  INSERT INTO public.wallets (user_id, balance, wallet_address)
  VALUES (
    NEW.id, 
    0, 
    'LCT' || UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 40))
  );
  
  RETURN NEW;
END;
$function$;