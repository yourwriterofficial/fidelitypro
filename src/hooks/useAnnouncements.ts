// src/hooks/useAnnouncements.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

export const useAnnouncements = () => {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000,
  });
};