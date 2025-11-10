-- Enable realtime on mesh tables and ensure full row data for updates
ALTER TABLE public.mesh_signaling REPLICA IDENTITY FULL;
ALTER TABLE public.mesh_rooms REPLICA IDENTITY FULL;

-- Add tables to realtime publication (idempotent; will error if already added, so guard)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mesh_signaling';
  EXCEPTION WHEN duplicate_object THEN
    -- already added
    NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.mesh_rooms';
  EXCEPTION WHEN duplicate_object THEN
    -- already added
    NULL;
  END;
END $$;