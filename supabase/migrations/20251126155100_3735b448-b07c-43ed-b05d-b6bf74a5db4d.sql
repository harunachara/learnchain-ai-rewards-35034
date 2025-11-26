-- Update token info to use Solana network
-- First, clear any existing LCT token info
DELETE FROM public.token_info WHERE token_symbol = 'LCT';

-- Insert Solana-based LCT token information
INSERT INTO public.token_info (
  token_name,
  token_symbol,
  contract_address,
  decimals,
  total_supply
) VALUES (
  'LearnChain Token',
  'LCT',
  'LCT7xK9mQ3vN2pR4sT6uV8wXyZ1aB2cD3eF4gH5iJ6kL7m',
  9,
  1000000000
);