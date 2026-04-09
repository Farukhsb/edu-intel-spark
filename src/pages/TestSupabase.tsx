import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestSupabase() {
  const [status, setStatus] = useState('Connecting...');
  const [error, setError] = useState('');

  useEffect(() => {
    // Test connection
    supabase
      .from('profiles')
      .select('count')
      .then(({ data, error }) => {
        if (error) {
          setStatus('❌ Connection failed');
          setError(error.message);
        } else {
          setStatus('✅ Connected to Supabase!');
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
      <h1 className="text-2xl mb-4">Supabase Connection Test</h1>
      <p className="text-lg mb-2">Status: {status}</p>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}
