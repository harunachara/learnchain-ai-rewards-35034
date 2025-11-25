import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export const SupabaseConnectionCheck = () => {
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey || supabaseUrl === 'undefined' || supabaseKey === 'undefined') {
      setIsConfigured(false);
      console.error('Supabase environment variables are not configured properly');
      console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
      console.error('VITE_SUPABASE_PUBLISHABLE_KEY:', supabaseKey ? 'Set' : 'Missing');
    }
  }, []);

  if (!isConfigured) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Configuration Error</AlertTitle>
        <AlertDescription>
          Backend connection not configured. Please set up environment variables in your deployment settings:
          <ul className="list-disc list-inside mt-2 text-xs">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_PUBLISHABLE_KEY</li>
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};
