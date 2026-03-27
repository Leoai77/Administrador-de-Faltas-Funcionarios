import React, { useState, useEffect, useMemo, Component } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
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
  parseISO,
  addDays,
  subDays,
  startOfDay,
  isWithinInterval
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
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db, googleProvider, OperationType, handleFirestoreError } from './firebase';
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

const Card = ({ children, className }: { children: React.ReactNode; className?: string; key?: React.Key }) => (
  <div className={cn('bg-white rounded-2xl shadow-sm border border-slate-100 p-6', className)}>
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
    const unsubscribe = onAuthStateChanged(auth, (u) => {
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
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));

    return () => {
      unsubEmployees();
      unsubSites();
      unsubAllocations();
      unsubAttendance();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
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
          <Button onClick={handleLogin} className="w-full py-4 text-lg">
            <LogIn className="w-5 h-5" />
            Entrar com Google
          </Button>
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
            <SitesView sites={sites} user={user} />
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

function AttendanceView({ employees, sites, allocations, attendance }: { 
  employees: Employee[]; 
  sites: ConstructionSite[]; 
  allocations: Allocation[]; 
  attendance: AttendanceRecord[]; 
}) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  useEffect(() => {
    if (!selectedSiteId && sites.length > 0) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  const filteredEmployees = useMemo(() => {
    if (!selectedSiteId) return [];
    const allocatedEmployeeIds = allocations
      .filter(a => a.siteId === selectedSiteId)
      .map(a => a.employeeId);
    return employees.filter(e => allocatedEmployeeIds.includes(e.id));
  }, [employees, allocations, selectedSiteId]);

  const handleStatusChange = async (employeeId: string, status: AttendanceStatus) => {
    if (!selectedSiteId) return;
    
    const recordId = `${employeeId}_${selectedDate}`;
    const existing = attendance.find(a => a.employeeId === employeeId && a.date === selectedDate);

    try {
      if (existing) {
        await updateDoc(doc(db, 'attendance', existing.id), { status });
      } else {
        await setDoc(doc(db, 'attendance', recordId), {
          employeeId,
          siteId: selectedSiteId,
          date: selectedDate,
          status
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  const getStatus = (employeeId: string) => {
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
              options={sites.map(s => ({ label: s.name, value: s.id }))}
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
        </div>
        
        <div className="flex gap-2">
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
                      <p className="font-semibold text-slate-900">{emp.name}</p>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">{emp.status}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusButton 
                        active={getStatus(emp.id) === 'present'} 
                        onClick={() => handleStatusChange(emp.id, 'present')}
                        type="present"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusButton 
                        active={getStatus(emp.id) === 'absent'} 
                        onClick={() => handleStatusChange(emp.id, 'absent')}
                        type="absent"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusButton 
                        active={getStatus(emp.id) === 'away'} 
                        onClick={() => handleStatusChange(emp.id, 'away')}
                        type="away"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusButton({ active, onClick, type }: { active: boolean; onClick: () => void; type: AttendanceStatus }) {
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
      className={cn(
        'p-3 rounded-xl border transition-all mx-auto flex items-center justify-center',
        active ? config.activeClass : cn('border-transparent', config.inactiveClass)
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
  const [name, setName] = useState('');
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const [siteId, setSiteId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'employees'), { name, status });
      if (siteId) {
        await setDoc(doc(db, 'allocations', docRef.id), { employeeId: docRef.id, siteId });
      }
      setName('');
      setSiteId('');
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'employees');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este funcionário?')) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
      await deleteDoc(doc(db, 'allocations', id));
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
        <h2 className="text-2xl font-bold text-slate-900">Funcionários</h2>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus className="w-4 h-4" />
          {isAdding ? 'Cancelar' : 'Novo Funcionário'}
        </Button>
      </div>

      {isAdding && (
        <Card>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <Input label="Nome Completo" value={name} onChange={setName} required />
            <Select 
              label="Obra (Opcional)" 
              value={siteId} 
              onChange={setSiteId} 
              placeholder="Não alocado"
              options={sites.map(s => ({ label: s.name, value: s.id }))}
            />
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Salvar</Button>
              <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-sm font-bold text-slate-700">Nome</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">Status</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700">Obra Alocada</th>
                <th className="px-6 py-4 text-sm font-bold text-slate-700 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-900">{emp.name}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
                      emp.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    )}>
                      {emp.status === 'active' ? 'Ativo' : 'Afastado'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={allocations.find(a => a.employeeId === emp.id)?.siteId || ''}
                      onChange={(e) => handleAllocationChange(emp.id, e.target.value)}
                      className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer text-slate-600 font-medium"
                    >
                      <option value="">Não alocado</option>
                      {sites.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDelete(emp.id)}
                      className="p-2 text-slate-300 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SitesView({ sites, user }: { sites: ConstructionSite[], user: User }) {
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [contractNumber, setContractNumber] = useState('');

  const isAdmin = user.email === 'leocontanova7@gmail.com';

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
    if (!confirm('Tem certeza que deseja excluir esta obra?')) return;
    try {
      console.log('Tentando excluir obra com ID:', id);
      await deleteDoc(doc(db, 'sites', id));
      console.log('Obra excluída com sucesso');
    } catch (err) {
      console.error('Erro ao excluir obra:', err);
      handleFirestoreError(err, OperationType.DELETE, 'sites');
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
        {sites.map((site) => (
          <Card key={site.id} className="group relative">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                <Building2 className="w-6 h-6" />
              </div>
              <button 
                onClick={() => handleDelete(site.id)}
                className="p-2 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">{site.name}</h3>
            {site.contractNumber && (
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Contrato: {site.contractNumber}</p>
            )}
            <p className="text-sm text-slate-500">{site.location || 'Sem localização definida'}</p>
          </Card>
        ))}
      </div>
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

  const reportData = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);

    return employees
      .filter(emp => !employeeFilter || emp.id === employeeFilter)
      .map(emp => {
        const empAttendance = attendance.filter(a => 
          a.employeeId === emp.id && 
          isWithinInterval(parseISO(a.date), { start, end }) &&
          (!siteFilter || a.siteId === siteFilter)
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
          site: mainSiteName,
          absences,
          absenceDates,
          presence,
          away,
          total: empAttendance.length
        };
      })
      .filter(row => row.total > 0);
  }, [employees, sites, attendance, startDate, endDate, siteFilter, employeeFilter]);

  const exportExcel = () => {
    const data = reportData.map(row => ({
      'Funcionário': row.name,
      'Obra Principal': row.site,
      'Contrato': sites.find(s => s.name === row.site)?.contractNumber || 'N/A',
      'Presenças': row.presence,
      'Faltas': row.absences,
      'Datas das Faltas': row.absenceDates.map(d => format(parseISO(d), 'dd/MM/yyyy')).join(', '),
      'Afastamentos': row.away,
      'Total de Registros': row.total
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `relatorio_faltas_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Relatório de Faltas e Presença', 14, 15);
    doc.setFontSize(10);
    doc.text(`Período: ${format(parseISO(startDate), 'dd/MM/yyyy')} a ${format(parseISO(endDate), 'dd/MM/yyyy')}`, 14, 22);
    
    const tableData = reportData.map(row => [
      row.name,
      row.site,
      row.presence,
      `${row.absences}${row.absenceDates.length > 0 ? '\n(' + row.absenceDates.map(d => format(parseISO(d), 'dd/MM')).join(', ') + ')' : ''}`,
      row.away,
      row.total
    ]);

    (doc as any).autoTable({
      head: [['Funcionário', 'Obra', 'Pres.', 'Faltas', 'Afast.', 'Total']],
      body: tableData,
      startY: 30,
    });

    doc.save(`relatorio_faltas_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input label="Data Inicial" type="date" value={startDate} onChange={setStartDate} />
          <Input label="Data Final" type="date" value={endDate} onChange={setEndDate} />
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
                <th className="px-6 py-4 text-sm font-bold text-slate-700">Funcionário</th>
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
                  <td className="px-6 py-4 font-semibold text-slate-900">{row.name}</td>
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
