import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function TestSupabase() {
  const [status, setStatus] = useState('Connecting...');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('profiles')
      .select('count')
      .then(({ data, error }) => {
        if (error) {
          setStatus('❌ Connection failed');
          setError(error.message);
        } else {
          setStatus('✅ Connected!');
          setError('');
        }
      })
      .catch((err) => {
        setStatus('❌ Connection error');
        setError(err.message);
      });
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Connection Test</h1>
      <p className="text-lg mb-2">Status: {status}</p>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
