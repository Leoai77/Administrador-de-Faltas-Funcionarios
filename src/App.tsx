import React, { useState, useEffect, useMemo, Component } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  User,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  parseISO,
  addDays,
  subDays,
  startOfDay,
  isWithinInterval,
  isWeekend,
  isBefore
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Users, 
  Building2, 
  Calendar, 
  Download, 
  Plus, 
  Trash2, 
  LogOut, 
  LogIn, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Pencil,
  Mail,
  Share2,
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Pre-emptive fix for jspdf fetch error in some environments
if (typeof window !== 'undefined') {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'fetch');
    if (descriptor && !descriptor.writable && !descriptor.set) {
      // If fetch is read-only and has no setter, jspdf might crash trying to polyfill it.
      // Modern jspdf (2.5.1+) should handle this, but we log it for debugging.
      console.log('Fetch API detectada como somente leitura.');
    }
  } catch (e) {
    // Ignore errors during descriptor check
  }
}

import { auth, db, googleProvider, OperationType, handleFirestoreError, firebaseConfig } from './firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  Employee, 
  ConstructionSite, 
  Allocation, 
  AttendanceRecord, 
  EmployeeStatus, 
  AttendanceStatus 
} from './types';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  disabled,
  type = 'button'
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => {
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
    secondary: 'bg-slate-800 text-white hover:bg-slate-900',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
    outline: 'bg-transparent border border-slate-200 text-slate-600 hover:bg-slate-50',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; key?: React.Key; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn('bg-white rounded-2xl shadow-sm border border-slate-100 p-6', className)}
  >
    {children}
  </div>
);

const Input = ({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  placeholder,
  required
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void; 
  type?: string;
  placeholder?: string;
  required?: boolean;
}) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-sm font-semibold text-slate-700">{label}</label>
    <input
      required={required}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
    />
  </div>
);

const Select = ({ 
  label, 
  value, 
  onChange, 
  options,
  placeholder
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void; 
  options: { label: string; value: string }[];
  placeholder?: string;
}) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-sm font-semibold text-slate-700">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all bg-white"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode; 
  footer?: React.ReactNode;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
        {footer && (
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose}></div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'attendance' | 'employees' | 'sites' | 'reports'>('attendance');

  // Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  // Auth Effect
  useEffect(() => {
    // Set persistence once at initialization
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.error('Erro ao configurar persistência:', err);
    });

    // Check for redirect result first (for mobile fallback)
    getRedirectResult(auth).then((result) => {
      if (result) {
        console.log('Login via redirect com sucesso!', result.user.email);
      }
    }).catch((error) => {
      console.error('Erro no redirect:', error);
      if (error.code !== 'auth/configuration-not-found') {
        setLoginError('Erro ao retornar do login: ' + error.message);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log('Estado de autenticação alterado:', u ? u.email : 'Deslogado');
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Sync Effect
  useEffect(() => {
    if (!user) return;

    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      console.log('Recebendo snapshot de funcionários:', snapshot.size, 'documentos');
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    }, (err) => {
      console.error('Erro no snapshot de funcionários:', err);
      handleFirestoreError(err, OperationType.LIST, 'employees');
    });

    const unsubSites = onSnapshot(collection(db, 'sites'), (snapshot) => {
      console.log('Recebendo snapshot de sites:', snapshot.size, 'documentos');
      const sitesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConstructionSite));
      // Sort by createdAt descending (newest first)
      sitesData.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setSites(sitesData);
    }, (err) => {
      console.error('Erro no snapshot de sites:', err);
      handleFirestoreError(err, OperationType.LIST, 'sites');
    });

    const unsubAllocations = onSnapshot(collection(db, 'allocations'), (snapshot) => {
      setAllocations(snapshot.docs.map(doc => ({ ...doc.data() } as Allocation)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'allocations'));

    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setAttendance(data);

      // Cleanup: Remove any records that are on weekends (legacy data)
      data.forEach(async (record) => {
        if (isWeekend(parseISO(record.date))) {
          try {
            await deleteDoc(doc(db, 'attendance', record.id));
            console.log(`Removed legacy weekend record: ${record.id}`);
          } catch (err) {
            console.error('Error removing legacy weekend record:', err);
          }
        }
      });
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));

    return () => {
      unsubEmployees();
      unsubSites();
      unsubAllocations();
      unsubAttendance();
    };
  }, [user]);

  const [loginError, setLoginError] = useState<string | null>(null);

  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setAuthLoading(true);
    try {
      console.log('Tentando login com e-mail:', email);
      await signInWithEmailAndPassword(auth, email, password);
      console.log('Login com e-mail realizado com sucesso!');
    } catch (error: any) {
      console.error('Erro no login com e-mail:', error);
      if (error.code === 'auth/user-not-found') {
        // Try to create account if it doesn't exist (simple onboarding)
        try {
          console.log('Usuário não encontrado, tentando criar conta...');
          await createUserWithEmailAndPassword(auth, email, password);
          console.log('Conta criada com sucesso!');
        } catch (createError: any) {
          setLoginError('Erro ao criar conta: ' + createError.message);
        }
      } else if (error.code === 'auth/wrong-password') {
        setLoginError('Senha incorreta.');
      } else {
        setLoginError('Erro no login: ' + error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoginError(null);
    try {
      console.log('Iniciando login com Google (Popup)...');
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      console.log('Login realizado com sucesso!', result.user.email);
    } catch (error: any) {
      console.error('Erro detalhado de login:', error);
      let msg = 'Erro ao entrar com Google. ';
      
      if (error.code === 'auth/popup-blocked') {
        msg = 'O popup de login foi bloqueado pelo navegador. Por favor, permita popups para este site.';
      } else if (error.code === 'auth/unauthorized-domain') {
        msg = `Este domínio (${window.location.hostname}) não está autorizado no Firebase. Adicione-o no Firebase Console > Authentication > Settings > Authorized Domains.`;
      } else if (error.code === 'auth/popup-closed-by-user') {
        msg = 'O login foi cancelado porque a janela foi fechada.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        msg = 'Uma solicitação de login já está em andamento.';
      } else if (error.message && (error.message.includes('missing initial state') || error.code === 'auth/internal-error')) {
        msg = 'Erro de estado inicial (Cookies/Privacidade). O seu navegador está bloqueando o login. Tente limpar o cache ou usar o "Modo Celular/APK" abaixo.';
      } else {
        msg += error.message || 'Erro desconhecido.';
      }
      
      setLoginError(msg);
    }
  };

  const handleClearAndLogin = async () => {
    setLoginError(null);
    try {
      console.log('Limpando dados de sessão e tentando novamente...');
      window.sessionStorage.clear();
      window.localStorage.removeItem(`firebase:authUser:${firebaseConfig.apiKey}:[DEFAULT]`);
      await handleLogin();
    } catch (e) {
      console.error('Erro ao limpar e logar:', e);
    }
  };

  const handleLoginRedirect = async () => {
    setLoginError(null);
    try {
      console.log('Iniciando login com Google (Redirect)...');
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signInWithRedirect(auth, googleProvider);
    } catch (error: any) {
      console.error('Erro detalhado de login (Redirect):', error);
      setLoginError('Erro ao iniciar login por redirecionamento: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    console.log('Sites atualizados:', sites);
  }, [sites]);

  useEffect(() => {
    console.log('Funcionários atualizados:', employees);
  }, [employees]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full text-center py-12">
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Controle de Obras</h1>
          <p className="text-slate-500 mb-8">Gerencie presença e alocação de funcionários de forma simples e eficiente.</p>
          
          {loginError && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm text-left flex flex-col gap-3">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>{loginError}</p>
              </div>
              {loginError.includes('não está autorizado') && (
                <div className="mt-2 p-3 bg-white/50 rounded-lg border border-rose-200 text-rose-800 text-xs">
                  <p className="font-bold mb-1">Como resolver:</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Acesse o <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold">Console do Firebase</a></li>
                    <li>Vá em <b>Authentication</b> &gt; <b>Settings</b> &gt; <b>Authorized Domains</b></li>
                    <li>Adicione o domínio: <code className="bg-rose-100 px-1 rounded">{window.location.hostname}</code></li>
                    <li>Tente logar novamente após alguns segundos.</li>
                  </ol>
                </div>
              )}
              {loginError.includes('estado inicial') && (
                <div className="mt-2 p-3 bg-white/50 rounded-lg border border-rose-200 text-rose-800 text-xs">
                  <p className="font-bold mb-1">Como resolver (Erro de Estado):</p>
                  <p className="mb-2">Este erro acontece quando o navegador bloqueia cookies de terceiros ou limpa a sessão durante o redirecionamento.</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li><b>No Chrome (Android):</b> Vá em Configurações &gt; Configurações do site &gt; Cookies e marque "Permitir cookies de terceiros".</li>
                    <li><b>No APK:</b> Verifique se o navegador padrão do celular não está em modo anônimo.</li>
                    <li>Tente o botão <b>"Limpar e Tentar Novamente"</b> abaixo.</li>
                  </ul>
                  <button 
                    onClick={handleClearAndLogin}
                    className="mt-3 w-full py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg font-bold transition-colors"
                  >
                    Limpar e Tentar Novamente
                  </button>
                </div>
              )}
              {loginError.includes('cookies de terceiros') && (
                <div className="mt-2 p-3 bg-white/50 rounded-lg border border-rose-200 text-rose-800 text-xs">
                  <p className="font-bold mb-1">Como resolver no seu navegador:</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li><b>Chrome/Edge:</b> Não use aba anônima ou permita cookies de terceiros nas configurações.</li>
                    <li><b>Safari:</b> Vá em Preferências &gt; Privacidade e desmarque "Impedir rastreamento entre sites".</li>
                    <li><b>Brave:</b> Desative os "Escudos" (Shields) para este site clicando no ícone do leão na barra de endereços.</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {window.self !== window.top ? (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-sm text-left flex gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p>Você está visualizando o app dentro de um frame (como o preview do AI Studio). O login via popup pode não funcionar. Use o <b>Modo Celular/APK</b> abaixo.</p>
              </div>
            ) : (
              <Button onClick={handleLogin} className="w-full py-4 text-lg">
                <LogIn className="w-5 h-5" />
                Entrar com Google (Navegador)
              </Button>
            )}
            
            <Button onClick={handleLoginRedirect} variant="outline" className="w-full py-4 text-lg">
              <LogIn className="w-5 h-5" />
              Entrar com Google (Modo Celular/APK)
            </Button>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-[10px] text-left">
              <p className="font-bold mb-1">Aviso para APK/Android:</p>
              <p>Se você receber o erro "missing initial state" ao usar o Google, é porque o navegador do seu celular está bloqueando cookies. Use a opção <b>"Entrar com E-mail"</b> abaixo como alternativa garantida.</p>
            </div>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">OU</span>
              </div>
            </div>

            {showEmailLogin ? (
              <form onSubmit={handleEmailLogin} className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <Input 
                  label="E-mail" 
                  type="email" 
                  value={email} 
                  onChange={setEmail} 
                  required 
                  placeholder="seu@email.com"
                />
                <Input 
                  label="Senha" 
                  type="password" 
                  value={password} 
                  onChange={setPassword} 
                  required 
                  placeholder="Sua senha"
                />
                <Button type="submit" className="w-full py-3" disabled={authLoading}>
                  {authLoading ? 'Entrando...' : 'Entrar / Cadastrar com E-mail'}
                </Button>
                <Button variant="ghost" onClick={() => setShowEmailLogin(false)} className="w-full">
                  Voltar
                </Button>
              </form>
            ) : (
              <Button onClick={() => setShowEmailLogin(true)} variant="ghost" className="w-full py-4 text-slate-600">
                <Mail className="w-5 h-5" />
                Entrar com E-mail (Recomendado se o Google falhar)
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 hidden sm:block">JP Silva Construções</h1>
            </div>

            <nav className="flex items-center gap-1 sm:gap-2">
              <NavButton 
                active={activeTab === 'attendance'} 
                onClick={() => setActiveTab('attendance')}
                icon={<Calendar className="w-4 h-4" />}
                label="Presença"
              />
              <NavButton 
                active={activeTab === 'employees'} 
                onClick={() => setActiveTab('employees')}
                icon={<Users className="w-4 h-4" />}
                label="Funcionários"
              />
              <NavButton 
                active={activeTab === 'sites'} 
                onClick={() => setActiveTab('sites')}
                icon={<Building2 className="w-4 h-4" />}
                label="Obras"
              />
              <NavButton 
                active={activeTab === 'reports'} 
                onClick={() => setActiveTab('reports')}
                icon={<Download className="w-4 h-4" />}
                label="Relatórios"
              />
            </nav>

            <div className="flex items-center gap-3">
              {user.email === 'leocontanova7@gmail.com' && (
                <button 
                  onClick={() => {
                    console.log('--- DEBUG STATE ---');
                    console.log('User:', user);
                    console.log('Sites:', sites);
                    console.log('Employees:', employees);
                    console.log('Allocations:', allocations);
                    console.log('Attendance:', attendance);
                    alert('Estado do banco logado no console (F12)');
                  }}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title="Debug"
                >
                  <Filter className="w-5 h-5" />
                </button>
              )}
              <div className="hidden md:block text-right">
                <div className="flex items-center gap-2 justify-end">
                  {user.email === 'leocontanova7@gmail.com' && (
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wider">Admin</span>
                  )}
                  <p className="text-sm font-semibold text-slate-900">{user.displayName}</p>
                </div>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
          {activeTab === 'attendance' && (
            <AttendanceView 
              employees={employees} 
              sites={sites} 
              allocations={allocations} 
              attendance={attendance} 
            />
          )}
          {activeTab === 'employees' && (
            <EmployeesView 
              employees={employees} 
              sites={sites} 
              allocations={allocations} 
            />
          )}
          {activeTab === 'sites' && (
            <SitesView 
              sites={sites} 
              user={user} 
              employees={employees}
              allocations={allocations}
            />
          )}
          {activeTab === 'reports' && (
            <ReportsView 
              employees={employees} 
              sites={sites} 
              attendance={attendance} 
            />
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-sm text-slate-500">© 2026 JP Silva Construções LTDA ME. Todos os direitos reservados.</p>
          </div>
        </footer>
      </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all',
        active 
          ? 'bg-emerald-50 text-emerald-700' 
          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
      )}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

// --- Views ---

function EmployeeCalendarModal({ 
  employee, 
  attendance, 
  onStatusChange, 
  onClose 
}: { 
  employee: Employee; 
  attendance: AttendanceRecord[]; 
  onStatusChange: (date: string, status: AttendanceStatus) => Promise<void>;
  onClose: () => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getStatus = (date: Date) => {
    if (isWeekend(date)) return undefined;
    const dateStr = format(date, 'yyyy-MM-dd');
    if (!employee.admissionDate) return attendance.find(a => a.employeeId === employee.id && a.date === dateStr)?.status;
    const admissionDate = parseISO(employee.admissionDate);
    if (isBefore(startOfDay(date), startOfDay(admissionDate))) return undefined;
    return attendance.find(a => a.employeeId === employee.id && a.date === dateStr)?.status;
  };

  const handleDayClick = (date: Date) => {
    if (isWeekend(date)) return;
    if (employee.admissionDate) {
      const admissionDate = parseISO(employee.admissionDate);
      if (isBefore(startOfDay(date), startOfDay(admissionDate))) return;
    }
    
    const currentStatus = getStatus(date);
    let nextStatus: AttendanceStatus;
    if (!currentStatus) nextStatus = 'present';
    else if (currentStatus === 'present') nextStatus = 'absent';
    else if (currentStatus === 'absent') nextStatus = 'away';
    else nextStatus = 'present';
    
    onStatusChange(format(date, 'yyyy-MM-dd'), nextStatus);
  };

  return (
    <Modal title={`Calendário: ${employee.name}`} onClose={onClose} isOpen={true}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCurrentMonth(subDays(startOfMonth(currentMonth), 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setCurrentMonth(addDays(endOfMonth(currentMonth), 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-2">
              {d}
            </div>
          ))}
          {days.map(day => {
            const status = getStatus(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const isWeekendDay = isWeekend(day);
            const isBeforeAdmission = employee.admissionDate ? isBefore(startOfDay(day), startOfDay(parseISO(employee.admissionDate))) : false;

            return (
              <button
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                disabled={isWeekendDay || isBeforeAdmission}
                className={cn(
                  "h-12 flex flex-col items-center justify-center rounded-lg border transition-all relative",
                  (!isCurrentMonth || isBeforeAdmission) && "opacity-30",
                  (isWeekendDay || isBeforeAdmission) ? "bg-slate-50 border-transparent cursor-not-allowed" : "hover:border-emerald-200 hover:bg-emerald-50/30",
                  isTodayDate && "border-emerald-500 ring-1 ring-emerald-500",
                  status === 'present' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                  status === 'absent' && "bg-rose-50 text-rose-700 border-rose-200",
                  status === 'away' && "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                <span className="text-xs font-bold">{format(day, 'd')}</span>
                {status && (
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full mt-1",
                    status === 'present' && "bg-emerald-500",
                    status === 'absent' && "bg-rose-500",
                    status === 'away' && "bg-amber-500"
                  )} />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Presença
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500" /> Falta
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" /> Afastado
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-200" /> Fim de Semana
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AttendanceView({ employees, sites, allocations, attendance }: { 
  employees: Employee[]; 
  sites: ConstructionSite[]; 
  allocations: Allocation[]; 
  attendance: AttendanceRecord[]; 
}) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployeeForCalendar, setSelectedEmployeeForCalendar] = useState<Employee | null>(null);

  useEffect(() => {
    if (!selectedSiteId && sites.length > 0) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const filteredEmployees = useMemo(() => {
    if (!selectedSiteId) return [];
    
    let result: Employee[] = [];
    
    if (selectedSiteId === 'all') {
      const allocatedEmployeeIds = allocations.map(a => a.employeeId);
      result = employees.filter(e => allocatedEmployeeIds.includes(e.id));
    } else if (selectedSiteId === 'unallocated') {
      const allocatedEmployeeIds = allocations.map(a => a.employeeId);
      result = employees.filter(e => !allocatedEmployeeIds.includes(e.id));
    } else {
      const allocatedEmployeeIds = allocations
        .filter(a => a.siteId === selectedSiteId)
        .map(a => a.employeeId);
      result = employees.filter(e => allocatedEmployeeIds.includes(e.id));
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(e => e.name.toLowerCase().includes(lowerSearch));
    }

    return result;
  }, [employees, allocations, selectedSiteId, searchTerm]);

  const isSelectedWeekend = useMemo(() => {
    return isWeekend(parseISO(selectedDate));
  }, [selectedDate]);

  const handleStatusChange = async (employeeId: string, status: AttendanceStatus, date: string = selectedDate) => {
    const isWeekendDay = isWeekend(parseISO(date));
    if (isWeekendDay) return;

    const employee = employees.find(e => e.id === employeeId);
    if (employee && employee.admissionDate) {
      const admissionDate = parseISO(employee.admissionDate);
      if (isBefore(startOfDay(parseISO(date)), startOfDay(admissionDate))) return;
    }
    
    const recordId = `${employeeId}_${date}`;
    const existing = attendance.find(a => a.employeeId === employeeId && a.date === date);

    // Determine target site ID
    let targetSiteId = selectedSiteId;
    if (selectedSiteId === 'all' || selectedSiteId === 'unallocated' || !selectedSiteId) {
      const allocation = allocations.find(a => a.employeeId === employeeId);
      if (!allocation) return; 
      targetSiteId = allocation.siteId;
    }

    try {
      if (existing) {
        await updateDoc(doc(db, 'attendance', existing.id), { status });
      } else {
        await setDoc(doc(db, 'attendance', recordId), {
          employeeId,
          siteId: targetSiteId,
          date,
          status
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  const handleMarkAllPresent = async () => {
    if (!selectedSiteId || isSelectedWeekend) return;
    
    const promises = filteredEmployees.map(emp => {
      const currentStatus = getStatus(emp.id);
      if (!currentStatus) {
        return handleStatusChange(emp.id, 'present');
      }
      return Promise.resolve();
    });

    try {
      await Promise.all(promises);
    } catch (err) {
      console.error("Error marking all present:", err);
    }
  };

  const getStatus = (employeeId: string) => {
    if (isSelectedWeekend) return undefined;
    const employee = employees.find(e => e.id === employeeId);
    if (employee && employee.admissionDate) {
      const admissionDate = parseISO(employee.admissionDate);
      if (isBefore(startOfDay(parseISO(selectedDate)), startOfDay(admissionDate))) return undefined;
    }
    return attendance.find(a => a.employeeId === employeeId && a.date === selectedDate)?.status;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <Select 
              label="Obra"
              value={selectedSiteId}
              onChange={setSelectedSiteId}
              placeholder="Selecione uma obra"
              options={[
                { label: 'Todas as obras', value: 'all' },
                { label: 'Não alocados', value: 'unallocated' },
                ...sites.map(s => ({ label: s.name, value: s.id }))
              ]}
            />
          </div>
          <div className="w-full sm:w-48">
            <Input 
              label="Data"
              type="date"
              value={selectedDate}
              onChange={setSelectedDate}
            />
          </div>
          <div className="w-full sm:w-64">
            <Input 
              label="Pesquisar por nome"
              placeholder="Digite o nome..."
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleMarkAllPresent} disabled={isSelectedWeekend || filteredEmployees.length === 0}>
            Marcar Todos Presente
          </Button>
          <Button variant="outline" onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}>
            Hoje
          </Button>
        </div>
      </div>

      {!selectedSiteId ? (
        <Card className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Building2 className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">Selecione uma obra para registrar a presença</p>
        </Card>
      ) : isSelectedWeekend ? (
        <Card className="flex flex-col items-center justify-center py-20 text-amber-600 bg-amber-50 border-amber-100">
          <Calendar className="w-16 h-16 mb-4 opacity-40" />
          <p className="text-xl font-bold">Fim de Semana</p>
          <p className="text-amber-700/70">Não há expediente aos sábados e domingos.</p>
        </Card>
      ) : filteredEmployees.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Users className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhum funcionário alocado nesta obra</p>
          <p className="text-sm">Vá para a aba "Funcionários" para fazer alocações.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-sm font-bold text-slate-700 w-16">Foto</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700">Funcionário</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700 text-center">Presença</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700 text-center">Falta</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-700 text-center">Afastado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      {emp.photoBase64 ? (
                        <img src={emp.photoBase64} alt={emp.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                          <Users className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{emp.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500 uppercase tracking-wider">{emp.status}</span>
                            {selectedSiteId === 'all' && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                                  {sites.find(s => s.id === allocations.find(a => a.employeeId === emp.id)?.siteId)?.name || 'N/A'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          onClick={() => setSelectedEmployeeForCalendar(emp)}
                        >
                          <Calendar className="w-4 h-4 text-slate-400" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusButton 
                        active={getStatus(emp.id) === 'present'} 
                        onClick={() => handleStatusChange(emp.id, 'present')}
                        type="present"
                        disabled={emp.admissionDate ? isBefore(startOfDay(parseISO(selectedDate)), startOfDay(parseISO(emp.admissionDate))) : false}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusButton 
                        active={getStatus(emp.id) === 'absent'} 
                        onClick={() => handleStatusChange(emp.id, 'absent')}
                        type="absent"
                        disabled={emp.admissionDate ? isBefore(startOfDay(parseISO(selectedDate)), startOfDay(parseISO(emp.admissionDate))) : false}
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusButton 
                        active={getStatus(emp.id) === 'away'} 
                        onClick={() => handleStatusChange(emp.id, 'away')}
                        type="away"
                        disabled={emp.admissionDate ? isBefore(startOfDay(parseISO(selectedDate)), startOfDay(parseISO(emp.admissionDate))) : false}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectedEmployeeForCalendar && (
        <EmployeeCalendarModal 
          employee={selectedEmployeeForCalendar}
          attendance={attendance}
          onStatusChange={(date, status) => handleStatusChange(selectedEmployeeForCalendar.id, status, date)}
          onClose={() => setSelectedEmployeeForCalendar(null)}
        />
      )}
    </div>
  );
}

function StatusButton({ active, onClick, type, disabled }: { active: boolean; onClick: () => void; type: AttendanceStatus; disabled?: boolean }) {
  const configs = {
    present: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      activeClass: 'bg-emerald-100 text-emerald-600 border-emerald-200',
      inactiveClass: 'text-slate-300 hover:text-emerald-400 hover:bg-emerald-50'
    },
    absent: {
      icon: <XCircle className="w-5 h-5" />,
      activeClass: 'bg-rose-100 text-rose-600 border-rose-200',
      inactiveClass: 'text-slate-300 hover:text-rose-400 hover:bg-rose-50'
    },
    away: {
      icon: <Clock className="w-5 h-5" />,
      activeClass: 'bg-amber-100 text-amber-600 border-amber-200',
      inactiveClass: 'text-slate-300 hover:text-amber-400 hover:bg-amber-50'
    }
  };

  const config = configs[type];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-3 rounded-xl border transition-all mx-auto flex items-center justify-center',
        disabled ? 'opacity-20 cursor-not-allowed border-transparent grayscale' : (active ? config.activeClass : cn('border-transparent', config.inactiveClass))
      )}
    >
      {config.icon}
    </button>
  );
}

function EmployeesView({ employees, sites, allocations }: { 
  employees: Employee[]; 
  sites: ConstructionSite[]; 
  allocations: Allocation[]; 
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const [admissionDate, setAdmissionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [siteId, setSiteId] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string>('');
  
  // Confirmation Modal State
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) {
        // Using a simple state for alert could be better, but for now let's just use a console error or a small UI hint
        console.warn('A imagem é muito grande. Escolha uma foto com menos de 500KB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setName('');
    setStatus('active');
    setAdmissionDate(format(new Date(), 'yyyy-MM-dd'));
    setSiteId('');
    setPhotoBase64('');
  };

  const handleEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setName(emp.name);
    setStatus(emp.status);
    setAdmissionDate(emp.admissionDate || format(new Date(), 'yyyy-MM-dd'));
    setPhotoBase64(emp.photoBase64 || '');
    setSiteId(allocations.find(a => a.employeeId === emp.id)?.siteId || '');
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'employees', editingId), { 
          name, 
          status,
          admissionDate,
          photoBase64: photoBase64 || null
        });
        
        if (siteId) {
          await setDoc(doc(db, 'allocations', editingId), { employeeId: editingId, siteId });
        } else {
          await deleteDoc(doc(db, 'allocations', editingId));
        }
      } else {
        const docRef = await addDoc(collection(db, 'employees'), { 
          name, 
          status,
          admissionDate,
          photoBase64: photoBase64 || null
        });
        if (siteId) {
          await setDoc(doc(db, 'allocations', docRef.id), { employeeId: docRef.id, siteId });
        }
      }
      resetForm();
    } catch (err) {
      handleFirestoreError(err, editingId ? OperationType.UPDATE : OperationType.CREATE, 'employees');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'employees', id));
      await deleteDoc(doc(db, 'allocations', id));
      setConfirmDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'employees');
    }
  };

  const handleAllocationChange = async (employeeId: string, newSiteId: string) => {
    try {
      if (!newSiteId) {
        await deleteDoc(doc(db, 'allocations', employeeId));
      } else {
        await setDoc(doc(db, 'allocations', employeeId), { employeeId, siteId: newSiteId });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'allocations');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Funcionários</h2>
          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full border border-slate-200">
            {employees.length} Total
          </span>
        </div>
        <Button onClick={() => {
          if (isAdding) {
            resetForm();
          } else {
            setIsAdding(true);
          }
        }}>
          <Plus className="w-4 h-4" />
          {isAdding ? 'Cancelar' : 'Novo Funcionário'}
        </Button>
      </div>

      {isAdding && (
        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-800">
              {editingId ? 'Editar Funcionário' : 'Cadastrar Novo Funcionário'}
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <Input label="Nome Completo" value={name} onChange={setName} required />
            
            <Input label="Data de Admissão" type="date" value={admissionDate} onChange={setAdmissionDate} required />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Foto (Opcional)</label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
              />
            </div>

            <Select 
              label="Obra (Opcional)" 
              value={siteId} 
              onChange={setSiteId} 
              placeholder="Não alocado"
              options={sites.map(s => ({ label: s.name, value: s.id }))}
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Salvar</Button>
              {editingId && (
                <Button variant="danger" onClick={() => setConfirmDelete(editingId)}>Excluir</Button>
              )}
              <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
            </div>
          </form>
          {photoBase64 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2">Pré-visualização da foto:</p>
              <img src={photoBase64} alt="Preview" className="w-16 h-16 rounded-full object-cover border border-slate-200" />
            </div>
          )}
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-sm font-bold text-slate-700 w-16">Foto</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">Nome</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">Admissão</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">Status</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">Obra Alocada</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    {emp.photoBase64 ? (
                      <img src={emp.photoBase64} alt={emp.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                        <Users className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">{emp.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {emp.admissionDate ? format(parseISO(emp.admissionDate), 'dd/MM/yyyy') : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
                      emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {emp.status === 'active' ? 'Ativo' : 'Afastado'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 group/select">
                      <select
                        value={allocations.find(a => a.employeeId === emp.id)?.siteId || ''}
                        onChange={(e) => handleAllocationChange(emp.id, e.target.value)}
                        className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-slate-600 font-medium hover:text-emerald-600 transition-colors"
                      >
                        <option value="">Não alocado</option>
                        {sites.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <Share2 className="w-3.5 h-3.5 text-slate-300 group-hover/select:text-emerald-400 transition-colors" />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(emp)}
                        className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete(emp.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Excluir Funcionário"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => confirmDelete && handleDelete(confirmDelete)}>Excluir</Button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-slate-900 font-bold text-lg">Tem certeza?</p>
            <p className="text-slate-500">
              Esta ação não pode ser desfeita. O funcionário <strong>{employees.find(e => e.id === confirmDelete)?.name}</strong> será removido permanentemente do sistema.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SitesView({ sites, user, employees, allocations }: { 
  sites: ConstructionSite[], 
  user: User,
  employees: Employee[],
  allocations: Allocation[]
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [confirmDeleteSite, setConfirmDeleteSite] = useState<string | null>(null);
  const [transferData, setTransferData] = useState<{ employeeId: string, employeeName: string, newSiteId: string } | null>(null);
  const [searchContract, setSearchContract] = useState('');

  const isAdmin = user.email === 'leocontanova7@gmail.com';

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const allocatedEmployees = useMemo(() => {
    if (!selectedSiteId) return [];
    const empIds = allocations
      .filter(a => a.siteId === selectedSiteId)
      .map(a => a.employeeId);
    return employees.filter(e => empIds.includes(e.id));
  }, [selectedSiteId, allocations, employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    
    if (!isAdmin) {
      setError('Apenas o administrador pode cadastrar obras.');
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      console.log('Tentando salvar obra:', { name, location, contractNumber });
      const docRef = await addDoc(collection(db, 'sites'), { 
        name: name.trim(), 
        location: (location || '').trim(), 
        contractNumber: (contractNumber || '').trim(),
        createdAt: new Date().toISOString()
      });
      console.log('Obra salva com ID:', docRef.id);
      
      setName('');
      setLocation('');
      setContractNumber('');
      setIsAdding(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar obra:', err);
      setError('Erro ao salvar no banco de dados. Verifique sua conexão ou permissões.');
      // handleFirestoreError(err, OperationType.CREATE, 'sites');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      console.log('Tentando excluir obra com ID:', id);
      await deleteDoc(doc(db, 'sites', id));
      console.log('Obra excluída com sucesso');
      setConfirmDeleteSite(null);
    } catch (err) {
      console.error('Erro ao excluir obra:', err);
      handleFirestoreError(err, OperationType.DELETE, 'sites');
    }
  };

  const handleTransfer = async () => {
    if (!transferData) return;
    try {
      const { employeeId, newSiteId } = transferData;
      if (!newSiteId) {
        await deleteDoc(doc(db, 'allocations', employeeId));
      } else {
        await setDoc(doc(db, 'allocations', employeeId), { employeeId, siteId: newSiteId });
      }
      setTransferData(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'allocations');
    }
  };

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">
            Você está logado como <strong>{user.email}</strong>. 
            Apenas o administrador (leocontanova7@gmail.com) tem permissão para cadastrar ou excluir obras.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900">Obras</h2>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">{sites.length}</span>
          {success && (
            <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold animate-in fade-in slide-in-from-left-2">
              <CheckCircle2 className="w-4 h-4" />
              Obra salva com sucesso!
            </span>
          )}
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus className="w-4 h-4" />
          {isAdding ? 'Cancelar' : 'Nova Obra'}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar por número do contrato..."
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 sm:text-sm transition-all"
            value={searchContract}
            onChange={(e) => setSearchContract(e.target.value)}
          />
        </div>
      </div>

      {isAdding && (
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Nome da Obra" value={name} onChange={setName} required />
              <Input label="Número do Contrato" value={contractNumber} onChange={setContractNumber} />
              <Input label="Localização" value={location} onChange={setLocation} />
            </div>
            
            {error && (
              <div className="p-3 bg-rose-50 text-rose-600 text-sm font-medium rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button variant="ghost" onClick={() => setIsAdding(false)} disabled={saving}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sites
          .filter(site => 
            !searchContract || 
            (site.contractNumber && site.contractNumber.toLowerCase().includes(searchContract.toLowerCase()))
          )
          .map((site) => (
          <Card 
            key={site.id} 
            className="group relative cursor-pointer hover:border-emerald-200 hover:shadow-md transition-all"
            onClick={() => setSelectedSiteId(site.id)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                <Building2 className="w-6 h-6" />
              </div>
              {isAdmin && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteSite(site.id);
                  }}
                  className="p-2 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{site.name}</h3>
            {site.contractNumber && (
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Contrato: {site.contractNumber}</p>
            )}
            <p className="text-sm text-slate-500">{site.location || 'Sem localização definida'}</p>
            
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                <Users className="w-3.5 h-3.5" />
                <span>{allocations.filter(a => a.siteId === site.id).length} funcionários</span>
              </div>
              <span className="text-emerald-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Ver detalhes</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Modal de Funcionários Alocados */}
      {selectedSiteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedSite?.name}</h3>
                  <p className="text-sm text-slate-500">Funcionários alocados nesta obra</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedSiteId(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {allocatedEmployees.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Nenhum funcionário alocado nesta obra.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allocatedEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all group/item">
                      <div className="flex items-center gap-4">
                        {emp.photoBase64 ? (
                          <img src={emp.photoBase64} alt={emp.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border-2 border-white shadow-sm">
                            <Users className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{emp.name}</p>
                          <span className={cn(
                            'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                            emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          )}>
                            {emp.status === 'active' ? 'Ativo' : 'Afastado'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <select
                            onChange={(e) => {
                              const newSiteId = e.target.value;
                              if (newSiteId === selectedSiteId) return;
                              setTransferData({ 
                                employeeId: emp.id, 
                                employeeName: emp.name, 
                                newSiteId 
                              });
                            }}
                            className="appearance-none pl-3 pr-8 py-2 bg-slate-100 hover:bg-slate-200 border-none rounded-xl text-xs font-bold text-slate-600 cursor-pointer transition-colors focus:ring-2 focus:ring-emerald-500/20"
                            value={selectedSiteId}
                          >
                            <option value={selectedSiteId}>Transferir para...</option>
                            {sites.filter(s => s.id !== selectedSiteId).map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                            <option value="">Remover da obra</option>
                          </select>
                          <Share2 className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setSelectedSiteId(null)} variant="secondary">
                Fechar
              </Button>
            </div>
          </div>
          <div className="absolute inset-0 -z-10" onClick={() => setSelectedSiteId(null)}></div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Obra */}
      <Modal
        isOpen={!!confirmDeleteSite}
        onClose={() => setConfirmDeleteSite(null)}
        title="Excluir Obra"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDeleteSite(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => confirmDeleteSite && handleDelete(confirmDeleteSite)}>Excluir</Button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-slate-900 font-bold text-lg">Tem certeza?</p>
            <p className="text-slate-500">
              Esta ação removerá a obra <strong>{sites.find(s => s.id === confirmDeleteSite)?.name}</strong> permanentemente. 
              As alocações vinculadas a esta obra também serão perdidas.
            </p>
          </div>
        </div>
      </Modal>

      {/* Modal de Confirmação de Transferência */}
      <Modal
        isOpen={!!transferData}
        onClose={() => setTransferData(null)}
        title={transferData?.newSiteId ? "Transferir Funcionário" : "Remover da Obra"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTransferData(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleTransfer}>Confirmar</Button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
            <Share2 className="w-8 h-8" />
          </div>
          <div>
            <p className="text-slate-900 font-bold text-lg">Confirmar Alteração?</p>
            <p className="text-slate-500">
              {transferData?.newSiteId 
                ? `Deseja transferir ${transferData.employeeName} para a obra "${sites.find(s => s.id === transferData.newSiteId)?.name}"?`
                : `Deseja remover ${transferData?.employeeName} desta obra?`
              }
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ReportsView({ employees, sites, attendance }: { 
  employees: Employee[]; 
  sites: ConstructionSite[]; 
  attendance: AttendanceRecord[]; 
}) {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [siteFilter, setSiteFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const reportData = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    return employees
      .filter(emp => !employeeFilter || emp.id === employeeFilter)
      .filter(emp => !statusFilter || emp.status === statusFilter)
      .map(emp => {
        const empAttendance = attendance.filter(a => 
          a.employeeId === emp.id && 
          isWithinInterval(parseISO(a.date), { start, end }) &&
          (!siteFilter || a.siteId === siteFilter) &&
          (!emp.admissionDate || !isBefore(startOfDay(parseISO(a.date)), startOfDay(parseISO(emp.admissionDate))))
        );

        const empAbsences = empAttendance.filter(a => a.status === 'absent');
        const absences = empAbsences.length;
        const absenceDates = empAbsences
          .map(a => a.date)
          .sort((a, b) => a.localeCompare(b));
        
        const presence = empAttendance.filter(a => a.status === 'present').length;
        const away = empAttendance.filter(a => a.status === 'away').length;

        // Get the most frequent site in this period
        const siteCounts: Record<string, number> = {};
        empAttendance.forEach(a => {
          siteCounts[a.siteId] = (siteCounts[a.siteId] || 0) + 1;
        });
        const mainSiteId = Object.entries(siteCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        const mainSiteName = sites.find(s => s.id === mainSiteId)?.name || 'N/A';

        return {
          id: emp.id,
          name: emp.name,
          photoBase64: emp.photoBase64,
          site: mainSiteName,
          absences,
          absenceDates,
          presence,
          away,
          status: emp.status,
          total: empAttendance.length
        };
      })
      .filter(row => row.total > 0)
      .sort((a, b) => a.site.localeCompare(b.site) || a.name.localeCompare(b.name));
  }, [employees, sites, attendance, startDate, endDate, siteFilter, employeeFilter, statusFilter]);

  const exportExcel = async () => {
    const data: any[][] = [];
    
    // Add Company Header
    data.push(['JP SILVA CONSTRUÇÕES']);
    data.push([`RELATÓRIO DE FALTAS E PRESENÇA`]);
    data.push([`Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} a ${format(parseISO(endDate), 'dd/MM/yyyy')}`]);
    data.push([`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`]);
    data.push([]); // Empty row for spacing

    // Table Headers
    data.push(['Funcionário', 'Status', 'Obra Principal', 'Contrato', 'Presenças', 'Faltas', 'Datas das Faltas', 'Afastamentos', 'Total de Registros']);

    let currentSite = '';

    reportData.forEach(row => {
      if (row.site !== currentSite) {
        currentSite = row.site;
        // Add a separator/header row for the site
        data.push([`OBRA: ${currentSite.toUpperCase()}`, '', '', sites.find(s => s.name === currentSite)?.contractNumber || '', '', '', '', '', '']);
      }

      data.push([
        row.name,
        row.status === 'active' ? 'Ativo' : 'Afastado',
        row.site,
        sites.find(s => s.name === row.site)?.contractNumber || 'N/A',
        row.presence,
        row.absences,
        row.absenceDates.map(d => format(parseISO(d), 'dd/MM/yyyy')).join(', '),
        row.away,
        row.total
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    
    const filename = `relatorio_faltas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

    try {
      console.log('Iniciando exportação Excel...');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const file = new File([blob], filename, { type: blob.type });

      let shared = false;
      // Web Share API is preferred for APKs/Mobile
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          console.log('Tentando compartilhar via Web Share API...');
          await navigator.share({
            files: [file],
            title: 'Relatório Excel',
            text: 'Relatório de Faltas e Presença'
          });
          shared = true;
          console.log('Compartilhamento concluído com sucesso.');
        } catch (shareErr: any) {
          console.warn('Erro ao compartilhar Excel (tentando download):', shareErr);
          // If user cancelled, don't force download unless it's a real error
          if (shareErr.name === 'AbortError') {
            return;
          }
        }
      }

      if (!shared) {
        console.log('Usando fallback de download direto...');
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        // Small delay for some browsers
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          console.log('Download iniciado.');
        }, 100);
      }
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      alert('Erro ao exportar Excel. Se estiver no APK, verifique se as permissões de armazenamento estão ativadas.');
    }
  };

  const exportPDF = async () => {
    try {
      console.log('Iniciando exportação PDF...');
      const doc = new jsPDF();
      
      // Company Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text('JP SILVA CONSTRUÇÕES', 14, 15);
      
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text('Relatório de Faltas e Presença', 14, 22);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} a ${format(parseISO(endDate), 'dd/MM/yyyy')}`, 14, 29);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 34);
      
      // Group data by site
      const groupedData: Record<string, any[]> = {};
      reportData.forEach(row => {
        if (!groupedData[row.site]) groupedData[row.site] = [];
        groupedData[row.site].push(row);
      });

      let currentY = 42;

      Object.entries(groupedData).forEach(([siteName, rows]) => {
        // Add site header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Obra: ${siteName}`, 14, currentY);
        currentY += 5;

        const tableData = rows.map(row => [
          row.name,
          row.status === 'active' ? 'Ativo' : 'Afastado',
          row.presence,
          `${row.absences}${row.absenceDates.length > 0 ? '\n(' + row.absenceDates.map(d => format(parseISO(d), 'dd/MM')).join(', ') + ')' : ''}`,
          row.away,
          row.total
        ]);

        autoTable(doc, {
          head: [['Funcionário', 'Status', 'Pres.', 'Faltas', 'Afast.', 'Total']],
          body: tableData,
          startY: currentY,
          margin: { top: 30 },
          didDrawPage: (data) => {
            currentY = data.cursor ? data.cursor.y + 15 : 42;
          }
        });

        // Update currentY for next site
        // @ts-ignore - autoTable adds lastAutoTable to doc
        currentY = (doc as any).lastAutoTable.finalY + 15;
        
        // Check if we need a new page
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
      });

      const filename = `relatorio_faltas_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });

      let shared = false;
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          console.log('Tentando compartilhar PDF via Web Share API...');
          await navigator.share({
            files: [file],
            title: 'Relatório PDF',
            text: 'Relatório de Faltas e Presença'
          });
          shared = true;
          console.log('Compartilhamento concluído com sucesso.');
        } catch (shareErr: any) {
          console.warn('Erro ao compartilhar PDF (tentando download):', shareErr);
          if (shareErr.name === 'AbortError') {
            return;
          }
        }
      }

      if (!shared) {
        console.log('Usando fallback de download direto (doc.save)...');
        // For PDF, doc.save is very reliable in browsers
        try {
          doc.save(filename);
          console.log('PDF salvo via doc.save()');
        } catch (saveErr) {
          console.error('Erro no doc.save(), tentando link manual:', saveErr);
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }, 100);
        }
      }
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      alert('Erro ao exportar PDF. Se estiver no APK, verifique se as permissões de armazenamento estão ativadas.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Relatórios</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={exportPDF}>
            <FileText className="w-4 h-4" />
            PDF
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Input label="Data Inicial" type="date" value={startDate} onChange={setStartDate} />
          <Input label="Data Final" type="date" value={endDate} onChange={setEndDate} />
          <Select 
            label="Filtrar por Status" 
            value={statusFilter} 
            onChange={setStatusFilter} 
            placeholder="Todos os status"
            options={[
              { label: 'Ativo', value: 'active' },
              { label: 'Afastado', value: 'away' }
            ]}
          />
          <Select 
            label="Filtrar por Obra" 
            value={siteFilter} 
            onChange={setSiteFilter} 
            placeholder="Todas as obras"
            options={sites.map(s => ({ label: s.name, value: s.id }))}
          />
          <Select 
            label="Filtrar por Funcionário" 
            value={employeeFilter} 
            onChange={setEmployeeFilter} 
            placeholder="Todos os funcionários"
            options={employees.map(e => ({ label: e.name, value: e.id }))}
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-sm font-bold text-slate-700 w-16">Foto</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">Funcionário</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">Status</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">Obra Principal</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700 text-center">Presenças</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700 text-center">Faltas</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700 text-center">Afastamentos</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700 text-center">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reportData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    {row.photoBase64 ? (
                      <img src={row.photoBase64} alt={row.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                        <Users className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">{row.name}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full',
                      row.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {row.status === 'active' ? 'Ativo' : 'Afastado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{row.site}</td>
                  <td className="px-6 py-4 text-center text-emerald-600 font-bold">{row.presence}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-rose-600 font-bold">{row.absences}</div>
                    {row.absenceDates.length > 0 && (
                      <div className="text-[10px] text-rose-400 mt-1 leading-tight">
                        {row.absenceDates.map(d => format(parseISO(d), 'dd/MM')).join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center text-amber-600 font-bold">{row.away}</td>
                  <td className="px-6 py-4 text-center font-bold text-slate-400">{row.total}</td>
                </tr>
              ))}
              {reportData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Nenhum registro encontrado para o período e filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
