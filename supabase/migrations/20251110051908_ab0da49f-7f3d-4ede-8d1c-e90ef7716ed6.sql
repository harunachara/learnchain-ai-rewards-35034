-- Create mesh rooms table for peer discovery
CREATE TABLE IF NOT EXISTS public.mesh_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 hours',
  CONSTRAINT code_length CHECK (LENGTH(code) = 6)
);

-- Create mesh signaling table for WebRTC handshake
CREATE TABLE IF NOT EXISTS public.mesh_signaling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL REFERENCES public.mesh_rooms(code) ON DELETE CASCADE,
  peer_id TEXT NOT NULL,
  peer_name TEXT NOT NULL,
  target_peer_id TEXT,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice-candidate')),
  signal_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_mesh_signaling_room_code ON public.mesh_signaling(room_code);
CREATE INDEX idx_mesh_signaling_target_peer ON public.mesh_signaling(target_peer_id);
CREATE INDEX idx_mesh_rooms_code ON public.mesh_rooms(code);
CREATE INDEX idx_mesh_rooms_active ON public.mesh_rooms(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.mesh_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesh_signaling ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mesh_rooms
CREATE POLICY "Anyone can view active rooms"
  ON public.mesh_rooms FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can create rooms"
  ON public.mesh_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Room hosts can update their rooms"
  ON public.mesh_rooms FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Room hosts can delete their rooms"
  ON public.mesh_rooms FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- RLS Policies for mesh_signaling
CREATE POLICY "Anyone can view signals in active rooms"
  ON public.mesh_signaling FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mesh_rooms 
      WHERE code = mesh_signaling.room_code AND is_active = true
    )
  );

CREATE POLICY "Anyone can send signals to active rooms"
  ON public.mesh_signaling FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mesh_rooms 
      WHERE code = mesh_signaling.room_code AND is_active = true
    )
  );

-- Function to clean up expired rooms
CREATE OR REPLACE FUNCTION cleanup_expired_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE mesh_rooms 
  SET is_active = false 
  WHERE expires_at < NOW() AND is_active = true;
END;
$$;

-- Enable realtime for mesh signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.mesh_signaling;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mesh_rooms;