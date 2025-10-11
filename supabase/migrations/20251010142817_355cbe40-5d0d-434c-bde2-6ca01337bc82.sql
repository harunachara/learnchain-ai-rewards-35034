-- Add wallet_address to wallets table
ALTER TABLE public.wallets 
ADD COLUMN wallet_address TEXT UNIQUE;

-- Generate wallet addresses for existing wallets
UPDATE public.wallets 
SET wallet_address = 'LCT' || substring(md5(id::text || user_id::text) from 1 for 40)
WHERE wallet_address IS NULL;

-- Add contract address as a constant
CREATE TABLE IF NOT EXISTS public.token_info (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_symbol TEXT NOT NULL,
  token_name TEXT NOT NULL,
  contract_address TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 18,
  total_supply BIGINT NOT NULL DEFAULT 1000000000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.token_info ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view token info
CREATE POLICY "Anyone can view token info"
  ON public.token_info FOR SELECT
  USING (true);

-- Insert LearnChain Token info
INSERT INTO public.token_info (token_symbol, token_name, contract_address, decimals, total_supply)
VALUES ('LCT', 'LearnChain Token', '0x' || substring(md5('LearnChain Token Contract') from 1 for 40), 18, 1000000000)
ON CONFLICT DO NOTHING;