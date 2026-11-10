import React, { useEffect, useState, useTransition } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile } from '../types/database';
import { AuthContext, type SignUpMetadata } from './authContextDef';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(() => isSupabaseConfigured);
  const [, startTransition] = useTransition();

  const fetchProfile = async (currentUser: User): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.warn('Erro ao buscar profile:', error.message);
      }

      if (data) {
        return data as Profile;
      }

      // Se profile não existir (ex: gatilho não configurado no Supabase), cria fallback
      const fallbackProfile: Profile = {
        id: currentUser.id,
        nome: currentUser.user_metadata?.nome || currentUser.email?.split('@')[0] || 'Motorista',
        email: currentUser.email || '',
        role: 'driver',
        status: 'active',
      };

      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert(fallbackProfile)
        .select('*')
        .single();

      if (!insertError && inserted) {
        return inserted as Profile;
      }

      return fallbackProfile;
    } catch (err) {
      console.error('Falha ao processar perfil do usuário:', err);
      return {
        id: currentUser.id,
        nome: currentUser.user_metadata?.nome || currentUser.email?.split('@')[0] || 'Motorista',
        email: currentUser.email || '',
        role: 'driver',
        status: 'active',
      };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user);
      setProfile(p);
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured) {
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          const userProf = await fetchProfile(initialSession.user);
          if (isMounted) setProfile(userProf);
        }
      } catch (err) {
        console.error('Erro ao inicializar sessão do Supabase:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      startTransition(async () => {
        setSession(newSession);
        const newUser = newSession?.user ?? null;
        setUser(newUser);

        if (newUser) {
          const userProf = await fetchProfile(newUser);
          setProfile(userProf);
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error('Falha no login') };
    }
  };

  const signUp = async (
    nome: string,
    email: string,
    password: string,
    metadata?: SignUpMetadata
  ) => {
    try {
      const trimmedEmail = email.trim();
      const trimmedNome = nome.trim();
      const trimmedTelefone = metadata?.telefone?.trim() || null;
      const trimmedTransportadora = metadata?.transportadora?.trim() || null;
      const trimmedRota = metadata?.rota?.trim() || null;

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            nome: trimmedNome,
            telefone: trimmedTelefone,
            transportadora: trimmedTransportadora,
            rota: trimmedRota,
          },
        },
      });

      if (error) {
        return { error, user: null };
      }

      if (data.user) {
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            nome: trimmedNome,
            email: trimmedEmail,
            telefone: trimmedTelefone,
            transportadora: trimmedTransportadora,
            rota: trimmedRota,
            role: 'driver',
            status: 'active',
          });
        } catch (profileErr) {
          console.warn('Aviso: Falha ao pré-criar perfil no cadastro:', profileErr);
        }
      }

      return { error: null, user: data.user };
    } catch (err: unknown) {
      return {
        error: err instanceof Error ? err : new Error('Falha no cadastro'),
        user: null,
      };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Erro ao sair:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
