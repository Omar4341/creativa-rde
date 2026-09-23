export interface AuthProfile {
  id: string; full_name: string; email: string; phone: string | null;
  role: 'USER' | 'ADMIN' | 'PRESENTER'; avatar_url: string | null;
  is_active: boolean; created_at: string; updated_at: string;
}
export interface AuthenticatedUser { id: string; profile: AuthProfile }
