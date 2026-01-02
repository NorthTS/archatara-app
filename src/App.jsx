import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, onSnapshot, 
  doc, updateDoc, deleteDoc, serverTimestamp, orderBy, setDoc, getDoc, writeBatch 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Calendar, Check, MapPin, Tent, Home, 
  Image as ImageIcon, Loader2, LogOut,
  ChevronLeft, ChevronRight, Map, Facebook, Target, Bike, Trophy,
  Waves, Phone, Settings, Trash2, Edit2, X, AlertTriangle, WifiOff, Download, RefreshCw
} from 'lucide-react';

// --- 1. CONFIGURATION SECTION ---
let firebaseConfig;
let appId = 'default-app-id';

try {
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  }
  if (typeof __app_id !== 'undefined') {
    appId = __app_id;
  }
} catch (e) {
  console.log("Not in preview environment");
}

// ⚠️ IMPORTANT: ตรวจสอบ Config ของคุณที่นี่ ⚠️
if (!firebaseConfig) {
  firebaseConfig = {
    apiKey: "AIzaSyASfi3V5U-1l_Wtny6lZlFIZO8-iFgJ_IY",
    authDomain: "archatara-booking.firebaseapp.com",
    projectId: "archatara-booking",
    storageBucket: "archatara-booking.firebasestorage.app",
    messagingSenderId: "1077632757256",
    appId: "1:1077632757256:web:83e7aeff4f49d34011abbd"
  };
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const getPath = (collectionName) => {
   if (typeof __firebase_config !== 'undefined') {
     const safeAppId = appId.replace(/[^a-zA-Z0-9_-]/g, '_');
     return ['artifacts', safeAppId, 'public', 'data', collectionName]; 
   } else {
     return [collectionName];
   }
};

const ASSETS = {
  // ลิงก์รูปภาพ Cover
  HERO_IMAGE: "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&q=80&w=2000", 
  LOGO_URL: "", 
};

// --- CONSTANTS ---
const ACCOMMODATION_TYPES = [
  { id: 'camping', name: 'Camping Space', desc: 'ลานกางเต็นท์ริมน้ำ (นำเต็นท์มาเอง)', price: 200, capacity: 2, totalUnits: 12, prefix: 'C', hasExtraBed: false, icon: MapPin, color: 'bg-sky-100 text-sky-600' },
  { id: 'glamping', name: 'Glamping Tent', desc: 'เต็นท์กระโจมติดแอร์ เย็นสบาย', price: 1200, capacity: 2, totalUnits: 2, prefix: 'G', hasExtraBed: true, extraBedPrice: 300, icon: Tent, color: 'bg-orange-100 text-orange-600' },
  { id: 'bamboo', name: 'Bamboo House', desc: 'บ้านไม้ไผ่ติดแอร์ ส่วนตัว', price: 1000, capacity: 2, totalUnits: 3, prefix: 'B', hasExtraBed: true, extraBedPrice: 300, icon: Home, color: 'bg-amber-100 text-amber-600' }
];

const ACTIVITIES = [
  { id: 1, title: "ATV - ซิ่งสุดมันส์", icon: Bike, color: "bg-orange-400", prices: ["15 นาที 250฿", "30 นาที 400฿"] },
  { id: 2, title: "ยิงธนู - Archery", icon: Target, color: "bg-sky-400", prices: ["30 นาที 300฿/คน"] },
  { id: 3, title: "ขี่ม้า Horse Riding", icon: Trophy, color: "bg-amber-400", prices: ["30 นาที 700฿", "60 นาที 1,200฿"] }
];

// --- MOCK & UTILS ---
const sendEmail = (to, subject, body) => {
  console.log(`📧 Sending Email to ${to}: ${subject}`);
};

const exportToCSV = (bookings) => {
  if (!bookings.length) return alert("ไม่มีข้อมูลให้ดาวน์โหลด");
  const headers = "Date,Type,Unit,Customer Name,Phone,Email,Status\n";
  const rows = bookings.map(b => 
    `${b.date},${b.type},${b.unitId},"${b.customerName}","${b.customerPhone}","${b.customerEmail||'-'}",${b.status}`
  ).join("\n");
  const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `archatara_bookings_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- COMPONENT ---
export default function ArchaTaraApp() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState({ weekendOnly: false, adminEmail: 'admin@archatara.com' });
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Auth
  useEffect(() => {
    const initAuth = async () => {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
          else await signInAnonymously(auth);
        } catch (err) { console.error("Auth Error:", err); }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Fetch Data
  useEffect(() => {
    if (!user) return;
    const bookingPath = getPath('archatara_bookings');
    if (bookingPath.length % 2 === 0) { setIsOfflineMode(true); setLoading(false); return; }

    const qBookings = query(collection(db, ...bookingPath), orderBy('createdAt', 'desc'));
    const unsubBookings = onSnapshot(qBookings, (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setIsOfflineMode(false);
    }, (err) => {
      // Improved Permission Handling: Catch both code and message content
      const isPermissionError = err.code === 'permission-denied' || err.message.includes('Missing or insufficient permissions');
      
      if (isPermissionError) {
        console.warn("⚠️ Demo Mode Activated: Database permission denied (Rules might be locked).");
      } else {
        console.error("Firestore Error:", err);
      }
      setIsOfflineMode(true);
      setLoading(false);
    });

    const settingsPath = getPath('archatara_settings');
    getDoc(doc(db, ...settingsPath, 'config'))
      .then(s => s.exists() && setSettings(s.data()))
      .catch((err) => {
        // Suppress permission errors for settings fetch too
        const isPermissionError = err.code === 'permission-denied' || err.message?.includes('Missing or insufficient permissions');
        if (!isPermissionError) console.warn("Settings fetch error:", err);
      });

    return () => unsubBookings();
  }, [user]);

  const handleOfflineAction = (action, data) => {
    // Mock logic for demo mode
    if (action === 'add') setBookings([{ ...data, id: `mock_${Date.now()}`, status: 'pending', createdAt: { seconds: Date.now()/1000 } }, ...bookings]);
    else if (action === 'update') setBookings(bookings.map(b => b.id === data.id ? { ...b, ...data.updates } : b));
    else if (action === 'delete') setBookings(bookings.filter(b => b.id !== data.id));
  };

  const handleClearData = async () => {
    if (!confirm("⚠️ ยืนยันลบประวัติการจอง 'ทั้งหมด'? ข้อมูลจะไม่สามารถกู้คืนได้")) return;
    if (isOfflineMode) {
      setBookings([]);
    } else {
      // Batch delete (limit 500 in real app, simple loop here for small scale)
      const path = getPath('archatara_bookings');
      bookings.forEach(async (b) => {
        await deleteDoc(doc(db, ...path, b.id));
      });
    }
    alert("ล้างข้อมูลเรียบร้อย");
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-sky-500 w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-orange-200 flex flex-col relative">
      {isOfflineMode && <div className="bg-orange-100 text-orange-700 px-4 py-2 text-sm text-center flex items-center justify-center gap-2"><WifiOff size={16} /> Demo Mode (Database Disconnected)</div>}
      <Header view={view} setView={setView} />
      <main className="max-w-4xl mx-auto p-4 flex-grow w-full">
        {view === 'home' && <HomeView setView={setView} />}
        {view === 'activities' && <ActivitiesView />}
        {view === 'booking' && <BookingView user={user} bookings={bookings} setView={setView} settings={settings} isOfflineMode={isOfflineMode} onOfflineAction={handleOfflineAction} />}
        {view === 'admin' && <AdminView bookings={bookings} settings={settings} setSettings={setSettings} isOfflineMode={isOfflineMode} onOfflineAction={handleOfflineAction} onClearData={handleClearData} />}
      </main>
      <Footer />
    </div>
  );
}

// --- SUB-COMPONENTS ---

const Header = ({ view, setView }) => (
  <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-sky-100 shadow-sm">
    <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
        {ASSETS.LOGO_URL ? <img src={ASSETS.LOGO_URL} alt="Logo" className="h-10 w-auto object-contain" /> : 
          <div className="relative"><div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-sky-600 rounded-xl flex items-center justify-center text-white shadow-lg"><span className="font-bold text-lg">A</span></div><div className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center text-white text-xs border-2 border-white"><Waves size={12} /></div></div>
        }
        <div className="flex flex-col"><h1 className="font-bold text-xl text-slate-800">Archa<span className="text-sky-500">Tara</span></h1><span className="text-[10px] text-orange-500 font-medium tracking-wider uppercase">Camptivities</span></div>
      </div>
      <nav className="flex gap-1">
        <NavButton active={view === 'booking'} onClick={() => setView('booking')} icon={<Calendar size={16} />} label="จองเลย" />
        <NavButton active={view === 'activities'} onClick={() => setView('activities')} icon={<Bike size={16} />} label="กิจกรรม" />
        <NavButton active={view === 'admin'} onClick={() => setView('admin')} icon={<Settings size={16} />} label="Admin" />
      </nav>
    </div>
  </header>
);

const NavButton = ({ active, onClick, label, icon }) => (
  <button onClick={onClick} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 ${active ? 'bg-sky-100 text-sky-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}><span className="hidden sm:inline">{icon}</span>{label}</button>
);

const Footer = () => (
  <footer className="bg-slate-900 text-slate-300 py-8 mt-10 text-center text-xs opacity-50">
    &copy; {new Date().getFullYear()} ArchaTara Riverside. All rights reserved.
  </footer>
);

function HomeView({ setView }) {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative h-[400px] rounded-[2.5rem] overflow-hidden shadow-2xl group">
        <img src={ASSETS.HERO_IMAGE} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent flex flex-col justify-end p-8 md:p-14">
          <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-4">อาชาธารา <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-orange-200">Camptivities</span></h2>
          <button onClick={() => setView('booking')} className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-2xl font-bold hover:shadow-xl w-fit flex items-center gap-2"><Tent size={20} /> จองที่พักทันที</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {ACCOMMODATION_TYPES.map(type => {
          const Icon = type.icon;
          return (
            <div key={type.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
              <div className={`w-14 h-14 ${type.color} rounded-2xl flex items-center justify-center mb-4`}><Icon size={28} /></div>
              <h3 className="font-bold text-xl text-slate-800">{type.name}</h3>
              <p className="text-slate-500 text-sm mb-4">{type.desc}</p>
              <div className="flex items-center justify-between"><span className="font-bold text-xl text-sky-600">{type.price}.-</span><button onClick={() => setView('booking')} className="text-sm font-bold text-slate-400 group-hover:text-orange-500 flex items-center gap-1">จอง <ChevronRight size={16}/></button></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivitiesView() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10">
        {ACTIVITIES.map((activity) => {
          const Icon = activity.icon;
          return (
            <div key={activity.id} className="bg-white rounded-[2rem] overflow-hidden shadow-lg border border-slate-100 flex flex-col items-center p-8 text-center">
              <div className={`${activity.color} w-20 h-20 rounded-full flex items-center justify-center mb-4 text-white shadow-md`}><Icon size={32} /></div>
              <h3 className="text-xl font-bold text-slate-800 mb-4">{activity.title}</h3>
              <div className="space-y-2 w-full">{activity.prices.map((p, i) => <div key={i} className="bg-slate-50 py-2 rounded-lg text-sm text-slate-600">{p}</div>)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-8 rounded-[2.5rem] p-1 bg-gradient-to-r from-sky-400 to-blue-500 shadow-xl">
        <div className="bg-white rounded-[2.3rem] p-10 text-center">
          <h3 className="text-2xl font-bold text-slate-800 mb-4">สนใจจองกิจกรรม?</h3>
          <p className="text-slate-500 mb-6">สอบถามเพิ่มเติมและจองกิจกรรมได้ที่ Facebook Page</p>
          <a href="https://www.facebook.com/ArchaTara/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#1877F2] text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition-all"><Facebook size={24} /> ติดต่ออาชาธารา</a>
        </div>
      </div>
    </div>
  );
}

function BookingView({ user, bookings, setView, settings, isOfflineMode, onOfflineAction }) {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', extraBed: false, slip: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unavailableUnits = useMemo(() => {
    if (!selectedDate) return [];
    return bookings.filter(b => b.date === selectedDate && b.status !== 'rejected').map(b => b.unitId);
  }, [selectedDate, bookings]);

  const handleDateChange = (e) => {
    const dateStr = e.target.value;
    const day = new Date(dateStr).getDay();
    if (settings.weekendOnly && (day !== 0 && day !== 6 && day !== 5)) {
        alert("ขออภัย ขณะนี้เปิดให้จองเฉพาะวันศุกร์ เสาร์ และอาทิตย์ครับ");
        return;
    }
    setSelectedDate(dateStr);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1000000) { alert("ไฟล์ภาพใหญ่เกินไป (>1MB)"); return; }
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, slip: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.slip) { alert("กรุณาแนบสลิปการโอนเงิน"); return; }
    setIsSubmitting(true);
    try {
      const data = {
        date: selectedDate, type: selectedType.id, unitId: selectedUnit, 
        customerName: formData.name, customerPhone: formData.phone, customerEmail: formData.email,
        hasExtraBed: formData.extraBed, slipImage: formData.slip
      };
      if (isOfflineMode) { onOfflineAction('add', data); await new Promise(r => setTimeout(r, 800)); } 
      else { 
        const path = getPath('archatara_bookings'); 
        await addDoc(collection(db, ...path), { ...data, status: 'pending', createdAt: serverTimestamp() });
      }
      sendEmail(settings.adminEmail, "Booking", `Customer: ${formData.name}`);
      setStep(4);
    } catch (error) { console.error(error); alert("Error saving data"); } finally { setIsSubmitting(false); }
  };

  const resetBooking = () => {
    setStep(1); setSelectedDate(''); setSelectedType(null); setSelectedUnit(null);
    setFormData({ name: '', phone: '', email: '', extraBed: false, slip: null });
  };

  if (step === 1) return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl max-w-lg mx-auto mt-6 text-center">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">เลือกวันที่เข้าพัก</h2>
      {settings.weekendOnly && <p className="text-orange-500 text-sm mb-4 font-medium">* เปิดจองเฉพาะ ศุกร์-เสาร์-อาทิตย์</p>}
      <input type="date" className="w-full p-5 border border-slate-200 rounded-2xl mb-6 text-xl text-center" min={new Date().toISOString().split('T')[0]} value={selectedDate} onChange={handleDateChange} />
      <button disabled={!selectedDate} onClick={() => setStep(2)} className="w-full bg-sky-500 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 hover:bg-sky-600 transition-all">ถัดไป</button>
    </div>
  );

  if (step === 2) return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-center px-2">
        <button onClick={() => setStep(1)} className="text-slate-500 flex items-center gap-1"><ChevronLeft size={16}/> เปลี่ยนวันที่</button>
        <span className="font-bold text-sky-600">{new Date(selectedDate).toLocaleDateString('th-TH')}</span>
      </div>
      {ACCOMMODATION_TYPES.map(type => {
        const units = Array.from({ length: type.totalUnits }, (_, i) => `${type.prefix}${i + 1}`);
        const Icon = type.icon;
        return (
          <div key={type.id} className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-100 p-6">
            <div className="flex items-center gap-4 mb-4">
               <div className={`p-4 rounded-2xl ${type.color}`}><Icon size={28} /></div>
               <div><h3 className="font-bold text-xl">{type.name}</h3><p className="text-slate-500 text-sm">{type.desc}</p></div>
               <div className="ml-auto font-bold text-2xl text-sky-600">{type.price}.-</div>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              {units.map(unitId => {
                const isTaken = unavailableUnits.includes(unitId);
                return (
                  <button key={unitId} disabled={isTaken} onClick={() => { setSelectedType(type); setSelectedUnit(unitId); setStep(3); }} className={`py-3 rounded-xl text-sm font-bold transition-all relative ${isTaken ? 'bg-slate-100 text-slate-300' : 'bg-white text-slate-600 border border-slate-200 hover:border-sky-400 hover:text-sky-600 shadow-sm'}`}>{unitId}</button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (step === 3) return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 max-w-lg mx-auto mt-6">
      <button onClick={() => setStep(2)} className="text-slate-400 text-sm mb-6 flex items-center gap-1"><ChevronLeft size={16}/> ย้อนกลับ</button>
      <h2 className="text-2xl font-bold mb-6 text-center">กรอกข้อมูลผู้จอง</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input required type="text" placeholder="ชื่อ-นามสกุล" className="w-full p-4 border rounded-xl" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        <input required type="tel" placeholder="เบอร์โทรศัพท์" className="w-full p-4 border rounded-xl" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
        <input required type="email" placeholder="อีเมล" className="w-full p-4 border rounded-xl" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        {selectedType.hasExtraBed && (
          <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl cursor-pointer" onClick={() => setFormData({...formData, extraBed: !formData.extraBed})}>
            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${formData.extraBed ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300 bg-white'}`}>{formData.extraBed && <Check size={16} />}</div>
            <label className="text-sm cursor-pointer flex-1">ต้องการเตียงเสริม (+{selectedType.extraBedPrice} บาท)</label>
          </div>
        )}
        <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center cursor-pointer hover:bg-slate-50">
          <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          {formData.slip ? <div className="text-green-500 flex flex-col items-center"><Check size={32} /> แนบสลิปแล้ว</div> : <div className="text-slate-400 flex flex-col items-center"><ImageIcon size={32} /> แตะเพื่อแนบสลิปโอนเงิน</div>}
        </div>
        <button type="submit" disabled={isSubmitting} className="w-full bg-sky-500 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50 hover:bg-sky-600 transition-all">{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการจอง'}</button>
      </form>
    </div>
  );

  if (step === 4) return (
    <div className="text-center py-16 px-6 bg-white rounded-[2.5rem] shadow-xl max-w-md mx-auto mt-10">
      <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6"><Check size={40} /></div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">จองสำเร็จ!</h2>
      <p className="text-slate-500 mb-8">ข้อมูลถูกส่งเรียบร้อยแล้ว<br/>เราจะส่งอีเมลยืนยันให้ท่านหลังจากตรวจสอบ</p>
      <button onClick={resetBooking} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold">กลับหน้าหลัก</button>
    </div>
  );
}

function AdminView({ bookings, settings, setSettings, isOfflineMode, onOfflineAction, onClearData }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState('bookings'); 
  const [editBooking, setEditBooking] = useState(null);

  const updateBookingStatus = async (booking, newStatus) => {
    if (!confirm(`ยืนยันการเปลี่ยนสถานะเป็น ${newStatus}?`)) return;
    if (isOfflineMode) { onOfflineAction('update', { id: booking.id, updates: { status: newStatus } }); } 
    else { const path = getPath('archatara_bookings'); await updateDoc(doc(db, ...path, booking.id), { status: newStatus }); }
    if (newStatus === 'confirmed' && booking.customerEmail) sendEmail(booking.customerEmail, "Booking Confirmed", "Your booking has been confirmed!");
  };

  const handleDelete = async (id) => {
    if (!confirm("⚠️ คำเตือน: ลบข้อมูล?")) return;
    if (isOfflineMode) { onOfflineAction('delete', { id }); } 
    else { const path = getPath('archatara_bookings'); await deleteDoc(doc(db, ...path, id)); }
  };

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    const updates = { customerName: editBooking.customerName, customerPhone: editBooking.customerPhone, customerEmail: editBooking.customerEmail };
    if (isOfflineMode) onOfflineAction('update', { id: editBooking.id, updates });
    else { const path = getPath('archatara_bookings'); await updateDoc(doc(db, ...path, editBooking.id), updates); }
    setEditBooking(null);
    alert("แก้ไขข้อมูลเรียบร้อย");
  };

  const saveSettings = async (newSettings) => {
    if (!isOfflineMode) { const path = getPath('archatara_settings'); await setDoc(doc(db, ...path, 'config'), newSettings); }
    setSettings(newSettings);
    alert("บันทึกการตั้งค่าเรียบร้อย");
  };

  if (!isAdmin) return (
    <div className="max-w-xs mx-auto mt-20 p-8 bg-white rounded-3xl shadow-lg text-center">
      <h3 className="font-bold text-xl mb-6">Admin Login</h3>
      <input type="password" placeholder="รหัสผ่าน" className="w-full p-3 border rounded-xl mb-4 text-center" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={() => password === '4433' ? setIsAdmin(true) : alert('รหัสผ่านไม่ถูกต้อง')} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">เข้าสู่ระบบ</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
        {['bookings', 'calendar', 'settings'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold capitalize transition-all ${tab === t ? 'bg-sky-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>{t}</button>
        ))}
      </div>

      {tab === 'bookings' && (
        <div className="space-y-4">
          {bookings.map(booking => (
            <div key={booking.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6">
              <div className="w-full md:w-32 h-32 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
                 {booking.slipImage ? <img src={booking.slipImage} className="w-full h-full object-cover cursor-pointer" onClick={() => { const w = window.open(""); w.document.write('<img src="' + booking.slipImage + '" style="max-width:100%"/>'); }}/> : <div className="flex items-center justify-center h-full text-xs text-slate-400">No Slip</div>}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-start">
                  <div><span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded uppercase mr-2">{booking.unitId}</span><span className="font-bold text-lg">{booking.customerName}</span></div>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' : booking.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>{booking.status}</span>
                </div>
                <div className="text-sm text-slate-500"><p>📅 {booking.date}</p><p>📞 {booking.customerPhone}</p></div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {booking.status === 'pending' && (<><button onClick={() => updateBookingStatus(booking, 'confirmed')} className="bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold">อนุมัติ</button><button onClick={() => updateBookingStatus(booking, 'rejected')} className="bg-red-100 text-red-500 px-4 py-1.5 rounded-lg text-sm font-bold">ปฏิเสธ</button></>)}
                  <button onClick={() => setEditBooking(booking)} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"><Edit2 size={14}/> แก้ไข</button>
                  <button onClick={() => handleDelete(booking.id)} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:text-red-500"><Trash2 size={14}/> ลบ</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'calendar' && <AdminCalendar bookings={bookings} />}

      {tab === 'settings' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <div>
            <h3 className="font-bold text-lg mb-4">ตั้งค่า</h3>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl mb-4">
              <span>เปิดจองเฉพาะ Weekend (ศุกร์-อาทิตย์)</span>
              <button onClick={() => saveSettings({...settings, weekendOnly: !settings.weekendOnly})} className={`w-12 h-6 rounded-full transition-colors relative ${settings.weekendOnly ? 'bg-sky-500' : 'bg-slate-300'}`}><div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.weekendOnly ? 'left-7' : 'left-1'}`}></div></button>
            </div>
            <label className="block text-sm text-slate-500 mb-2">อีเมลผู้ดูแล</label>
            <div className="flex gap-2"><input type="email" className="flex-1 p-3 border rounded-xl" value={settings.adminEmail} onChange={e => setSettings({...settings, adminEmail: e.target.value})} /><button onClick={() => saveSettings(settings)} className="bg-sky-500 text-white px-6 rounded-xl font-bold">บันทึก</button></div>
          </div>
          <div className="pt-6 border-t space-y-3">
             <h3 className="font-bold text-lg">จัดการข้อมูล</h3>
             <button onClick={() => exportToCSV(bookings)} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2"><Download size={18}/> ดาวน์โหลดประวัติการจอง (CSV)</button>
             <button onClick={onClearData} className="w-full py-3 border border-red-200 text-red-500 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50"><Trash2 size={18}/> ล้างข้อมูลทั้งหมด (Reset Data)</button>
          </div>
        </div>
      )}

      {editBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between mb-4"><h3 className="font-bold text-xl">แก้ไขข้อมูล</h3><button onClick={() => setEditBooking(null)}><X /></button></div>
            <form onSubmit={handleUpdateInfo} className="space-y-3">
              <div><label className="text-xs text-slate-500">ชื่อลูกค้า</label><input className="w-full p-2 border rounded-lg" value={editBooking.customerName} onChange={e => setEditBooking({...editBooking, customerName: e.target.value})} /></div>
              <div><label className="text-xs text-slate-500">เบอร์โทร</label><input className="w-full p-2 border rounded-lg" value={editBooking.customerPhone} onChange={e => setEditBooking({...editBooking, customerPhone: e.target.value})} /></div>
              <div><label className="text-xs text-slate-500">อีเมล</label><input className="w-full p-2 border rounded-lg" value={editBooking.customerEmail} onChange={e => setEditBooking({...editBooking, customerEmail: e.target.value})} /></div>
              <button type="submit" className="w-full bg-sky-500 text-white py-3 rounded-xl font-bold mt-4">บันทึกการแก้ไข</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const AdminCalendar = ({ bookings }) => {
  const [date, setDate] = useState(new Date());
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const todayStr = new Date().toISOString().split('T')[0];

  // FIX: Use string comparison to avoid timezone issues
  const getBookingsForDay = (day) => {
    const dStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return bookings.filter(b => b.date === dStr && b.status !== 'rejected');
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-xl">{date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric'})}</h3>
        <div className="flex gap-2"><button onClick={() => setDate(new Date(date.setMonth(date.getMonth()-1)))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft/></button><button onClick={() => setDate(new Date(date.setMonth(date.getMonth()+1)))} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight/></button></div>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-slate-400 font-bold mb-2">{['อา','จ','อ','พ','พฤ','ศ','ส'].map(d => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {Array(firstDay).fill(null).map((_,i) => <div key={i}/>)}
        {Array.from({length: daysInMonth}, (_, i) => {
          const day = i + 1;
          const dayBookings = getBookingsForDay(day);
          const dStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isToday = dStr === todayStr;
          return (
            <div key={day} className={`aspect-square border rounded-xl p-1 relative hover:border-sky-400 transition-colors cursor-pointer group ${isToday ? 'bg-sky-50 border-sky-200' : 'border-slate-100'}`} onClick={() => dayBookings.length > 0 && alert(`Booking วันที่ ${day}:\n${dayBookings.map(b => `- ${b.unitId} (${b.customerName})`).join('\n')}`)}>
              <span className={`text-xs ${isToday ? 'font-bold text-sky-600' : 'text-slate-600'}`}>{day}</span>
              <div className="flex flex-wrap gap-0.5 content-end h-full pb-4 pl-0.5">{dayBookings.map((b, idx) => (<div key={idx} className={`w-1.5 h-1.5 rounded-full ${b.status === 'confirmed' ? 'bg-green-400' : 'bg-orange-300'}`} title={b.customerName}></div>))}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex gap-4 text-xs text-slate-500"><div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400"></div> ยืนยันแล้ว</div><div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-300"></div> รอตรวจสอบ</div></div>
    </div>
  );
};