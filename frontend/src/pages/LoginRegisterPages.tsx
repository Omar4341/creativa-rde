import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { ApiRequestError } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      navigate(location.state?.from ?? '/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'فشل تسجيل الدخول');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="mb-6 text-center text-2xl font-bold">تسجيل الدخول</h1>
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">{error}</p>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">البريد الإلكتروني</label>
            <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="label" htmlFor="password">كلمة المرور</label>
            <input id="password" type="password" className="input" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? 'جارٍ الدخول…' : 'دخول'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-navy/60">
          ليس لديك حساب؟ <Link to="/register" className="font-semibold text-primary">أنشئ حسابًا</Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await register(form.full_name, form.email, form.password, form.phone || undefined);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'فشل إنشاء الحساب');
    } finally {
      setPending(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="mb-6 text-center text-2xl font-bold">إنشاء حساب جديد</h1>
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">{error}</p>}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="full_name">الاسم الكامل</label>
            <input id="full_name" className="input" required minLength={1} value={form.full_name} onChange={set('full_name')} />
          </div>
          <div>
            <label className="label" htmlFor="reg-email">البريد الإلكتروني</label>
            <input id="reg-email" type="email" className="input" required value={form.email} onChange={set('email')} dir="ltr" />
          </div>
          <div>
            <label className="label" htmlFor="reg-password">كلمة المرور</label>
            <input id="reg-password" type="password" className="input" required minLength={8} value={form.password} onChange={set('password')} />
            <p className="mt-1 text-xs text-navy/40">8 أحرف على الأقل</p>
          </div>
          <div>
            <label className="label" htmlFor="phone">رقم الهاتف (اختياري)</label>
            <input id="phone" className="input" value={form.phone} onChange={set('phone')} dir="ltr" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-navy/60">
          لديك حساب بالفعل؟ <Link to="/login" className="font-semibold text-primary">سجّل الدخول</Link>
        </p>
      </div>
    </div>
  );
}
