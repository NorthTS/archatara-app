import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, onSnapshot, 
  doc, updateDoc, serverTimestamp, orderBy 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  Calendar, Check, MapPin, Tent, Home, 
  Image as ImageIcon, Loader2, LogOut,
  ChevronLeft, ChevronRight, Map, Facebook, Target, Bike, Trophy,
  Waves
} from 'lucide-react';

// --- 1. SETUP FIREBASE CONFIGURATION ---

let firebaseConfig;
let appId = 'default-app-id';

try {
  // พยายามใช้ Config ของระบบจำลองในแชท เพื่อให้คุณกด Run เล่นได้ตอนนี้
  if (typeof __firebase_config !== 'undefined') {
    firebaseConfig = JSON.parse(__firebase_config);
  }
  if (typeof __app_id !== 'undefined') {
    appId = __app_id;
  }
} catch (e) {
  console.log("Not in preview environment");
}

// ...และแทนที่ด้วย Config ของคุณเองแบบนี้:
if (!firebaseConfig) {
  firebaseConfig = {
    // ใส่ค่า Config ที่คุณต้องการใช้จริงที่นี่
    apiKey: "AIzaSyASfi3V5U-1l_Wtny6lZlFIZO8-iFgJ_IY", // (ตรวจสอบความถูกต้องของ Key นี้อีกครั้งจาก Firebase Console)
    authDomain: "archatara-booking.firebaseapp.com",
    projectId: "archatara-booking",
    storageBucket: "archatara-booking.firebasestorage.app",
    messagingSenderId: "1077632757256",
    appId: "1:1077632757256:web:83e7aeff4f49d34011abbd"
  };
}
// ------------------------------------------------------------------

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ใช้ Collection ชื่อนี้สำหรับเก็บข้อมูล
// หมายเหตุ: ในแชทนี้เราต้องใช้ path ยาวๆ แต่เมื่อใช้จริงคุณใช้แค่ 'bookings' ได้เลย
// ผมเขียน Logic เลือก Path ให้ทำงานได้ทั้งสองที่
const getCollectionPath = () => {
   if (typeof __firebase_config !== 'undefined') {
     // Path สำหรับทดสอบในแชท (ห้ามเปลี่ยนถ้าเล่นในนี้)
     return ['artifacts', appId, 'public', 'data', 'archatara_bookings']; 
   } else {
     // Path สำหรับใช้งานจริง (Production)
     return ['bookings'];
   }
};

// --- Assets Configuration ---
const HERO_IMAGE = "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&q=80&w=2000"; 
const LOGO_URL = ""; 

// --- Constants & Data ---
const ACCOMMODATION_TYPES = [
  {
    id: 'camping',
    name: 'Camping Space',
    desc: 'ลานกางเต็นท์ริมน้ำ (นำเต็นท์มาเอง)',
    price: 200, 
    capacity: 2,
    totalUnits: 12,
    prefix: 'C',
    hasExtraBed: false,
    icon: MapPin,
    color: 'bg-sky-100 text-sky-600'
  },
  {
    id: 'glamping',
    name: 'Glamping Tent',
    desc: 'เต็นท์กระโจมติดแอร์ เย็นสบาย',
    price: 1200, 
    capacity: 2,
    totalUnits: 2,
    prefix: 'G',
    hasExtraBed: true,
    extraBedPrice: 300,
    icon: Tent,
    color: 'bg-orange-100 text-orange-600'
  },
  {
    id: 'bamboo',
    name: 'Bamboo House',
    desc: 'บ้านไม้ไผ่ติดแอร์ ส่วนตัว',
    price: 1000, 
    capacity: 2,
    totalUnits: 3,
    prefix: 'B',
    hasExtraBed: true,
    extraBedPrice: 300,
    icon: Home,
    color: 'bg-amber-100 text-amber-600'
  }
];

const ACTIVITIES = [
  {
    id: 1,
    title: "ซิ่งสุดมันส์ - ATV Adventure!!",
    icon: Bike,
    color: "bg-orange-400",
    prices: ["15 นาที 250฿", "30 นาที 400฿"]
  },
  {
    id: 2,
    title: "ยิงธนู - Archery",
    icon: Target,
    color: "bg-sky-400",
    prices: ["30 นาที 300฿/คน"]
  },
  {
    id: 3,
    title: "Horse Riding แบบ Cutee",
    icon: Trophy, 
    color: "bg-amber-400",
    prices: ["30 นาที 700฿", "60 นาที 1,200฿"]
  }
];

// --- Helper Functions ---
const getStatusBadge = (status) => {
  switch (status) {
    case 'confirmed': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700 border border-sky-200">ยืนยันแล้ว</span>;
    case 'rejected': return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">ยกเลิก</span>;
    default: return <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">รอตรวจสอบ</span>;
  }
};

// --- Main Component ---
export default function ArchaTaraApp() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); // home, activities, booking, admin
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auth & Data Fetching
  useEffect(() => {
    const initAuth = async () => {
        // ตรวจสอบว่ามี Token สำหรับระบบทดสอบหรือไม่
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
             await signInWithCustomToken(auth, __initial_auth_token);
        } else {
             // สำหรับ Production จริง เราใช้ Anonymous Sign-in
             await signInAnonymously(auth);
        }
    };
    initAuth();
    
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // ต้องรอให้ User login ก่อน (แม้จะเป็น Anonymous) ถึงจะดึงข้อมูลได้
    if (!user) return;

    // ใช้ฟังก์ชันเลือก Collection Path ให้ถูกต้อง
    const pathSegments = getCollectionPath();
    const q = query(
      collection(db, ...pathSegments),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribeData = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBookings(items);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching bookings:", error);
        setLoading(false);
    });
    return () => unsubscribeData();
  }, [user]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-sky-50"><Loader2 className="animate-spin text-sky-500 w-10 h-10" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-orange-200">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-sky-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={() => setView('home')}
          >
            {LOGO_URL ? (
              <img src={LOGO_URL} alt="Logo" className="h-10 w-auto object-contain" />
            ) : (
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-sky-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-sky-200 transform group-hover:rotate-6 transition-transform">
                  <span className="font-bold text-lg">A</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center text-white text-xs shadow-md border-2 border-white">
                  <Waves size={12} />
                </div>
              </div>
            )}
            
            <div className="flex flex-col">
              <h1 className="font-bold text-xl text-slate-800 leading-none tracking-tight">Archa<span className="text-sky-500">Tara</span></h1>
              <span className="text-[10px] text-orange-500 font-medium tracking-wider uppercase">Riverside Camping</span>
            </div>
          </div>
          
          <nav className="flex gap-1">
            <NavButton active={view === 'booking'} onClick={() => setView('booking')} icon={<Calendar size={16} />} label="จองเลย" />
            <NavButton active={view === 'activities'} onClick={() => setView('activities')} icon={<Bike size={16} />} label="กิจกรรม" />
            <NavButton active={view === 'admin'} onClick={() => setView('admin')} icon={<Check size={16} />} label="ผู้ดูแล" />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto p-4 pb-24">
        {view === 'home' && <HomeView setView={setView} />}
        {view === 'activities' && <ActivitiesView />}
        {view === 'booking' && <BookingView user={user} bookings={bookings} setView={setView} />}
        {view === 'admin' && <AdminView bookings={bookings} />}
      </main>
    </div>
  );
}

// --- Helper Components ---
const NavButton = ({ active, onClick, label, icon }) => (
  <button 
    onClick={onClick}
    className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 flex items-center gap-1.5 ${
      active 
        ? 'bg-sky-100 text-sky-700 shadow-sm' 
        : 'text-slate-500 hover:bg-slate-50 hover:text-sky-600'
    }`}
  >
    <span className="hidden sm:inline">{icon}</span>
    {label}
  </button>
);

// --- Sub-Components ---
function HomeView({ setView }) {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative h-[400px] rounded-[2.5rem] overflow-hidden shadow-2xl shadow-sky-100 group">
        <img src={HERO_IMAGE} alt="ArchaTara Banner" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent flex flex-col justify-end p-8 md:p-12">
          <div className="transform transition-transform duration-500 group-hover:-translate-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider shadow-lg">New Season</span>
              <span className="bg-white/20 backdrop-blur text-white text-xs px-3 py-1 rounded-full font-medium">✨ เพชรบุรี</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-4 leading-tight">อาชาธารา <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-orange-200">Riverside</span></h2>
            <p className="text-white/80 text-lg mb-8 max-w-lg font-light leading-relaxed">สัมผัสธรรมชาติริมน้ำ กางเต็นท์ ขี่ม้า และกิจกรรมสุดมันส์ <br className="hidden md:block"/> ในบรรยากาศส่วนตัวที่คุณจะหลงรัก</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setView('booking')} className="bg-gradient-to-r from-orange-400 to-orange-600 text-white px-8 py-3.5 rounded-2xl font-bold hover:shadow-lg hover:shadow-orange-500/30 transition-all active:scale-95 flex items-center gap-2"><Tent size={20} /> จองที่พัก</button>
              <a href="https://maps.app.goo.gl/2BWTpEe2UjaoqSxe7?g_st=ipc" target="_blank" rel="noreferrer" className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-white/20 transition-all flex items-center gap-2"><MapPin size={20} /> แผนที่</a>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-2xl font-bold text-slate-800">🏡 ประเภทที่พัก</h3>
          <span className="text-sm text-slate-400">เลือกบรรยากาศที่คุณชอบ</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ACCOMMODATION_TYPES.map(type => (
            <div key={type.id} className="bg-white p-1 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-sky-50 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><type.icon size={100} className={type.color.split(' ')[1]} /></div>
              <div className="p-6 relative z-10">
                <div className={`w-14 h-14 ${type.color} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-inner`}><type.icon size={28} /></div>
                <h3 className="font-bold text-xl text-slate-800 mb-1">{type.name}</h3>
                <p className="text-slate-500 text-sm mb-6 h-10">{type.desc}</p>
                <div className="flex items-end justify-between bg-slate-50 p-4 rounded-2xl">
                  <div>
                    <p className="text-slate-400 text-xs mb-1">เริ่มต้น</p>
                    <div className="flex items-baseline gap-1"><p className="text-slate-800 font-bold text-xl">{type.price}</p><p className="text-xs text-slate-400">/ คืน</p></div>
                  </div>
                  <button onClick={() => setView('booking')} className="bg-white text-sky-600 p-2 rounded-xl shadow-sm border border-slate-100 group-hover:bg-sky-500 group-hover:text-white transition-colors"><ChevronRight size={20} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivitiesView() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="text-center py-8">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">🏄‍♂️ กิจกรรมสุดพิเศษ</h2>
        <p className="text-slate-500">สนุกกับกิจกรรมหลากหลายที่อาชาธารา</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ACTIVITIES.map((activity) => (
          <div key={activity.id} className="bg-white rounded-[2rem] overflow-hidden shadow-lg shadow-slate-100 border border-slate-100 flex flex-col h-full hover:-translate-y-1 transition-transform">
            <div className={`${activity.color} h-32 flex items-center justify-center relative overflow-hidden`}><div className="absolute inset-0 bg-white/10 rotate-12 scale-150 transform translate-y-10"></div><activity.icon size={56} className="text-white relative z-10 drop-shadow-md" /></div>
            <div className="p-8 flex-1 flex flex-col items-center text-center">
              <h3 className="text-xl font-bold text-slate-800 mb-6">{activity.title}</h3>
              <div className="space-y-3 w-full">{activity.prices.map((price, idx) => (<div key={idx} className="bg-slate-50 py-3 px-4 rounded-xl text-slate-600 font-medium text-sm border border-slate-100">{price}</div>))}</div>
              {activity.note && <p className="text-orange-500 text-xs font-medium mt-4 bg-orange-50 px-3 py-1 rounded-full">{activity.note}</p>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-3xl p-1 bg-gradient-to-r from-sky-400 to-blue-500 shadow-xl shadow-blue-100">
        <div className="bg-white rounded-[1.7rem] p-8 md:p-12 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-slate-800 mb-3">สนใจจองกิจกรรม?</h3>
            <p className="text-slate-500 mb-8">กรุณาติดต่อจองล่วงหน้าผ่านทาง Facebook Inbox</p>
            <a href="https://www.facebook.com/ArchaTara/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-[#1877F2] text-white px-8 py-4 rounded-2xl font-bold hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-95"><Facebook size={24} /> ติดต่อจองทาง Facebook</a>
          </div>
           <div className="absolute top-0 left-0 w-32 h-32 bg-sky-50 rounded-full blur-3xl -ml-16 -mt-16"></div>
           <div className="absolute bottom-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-3xl -mr-16 -mb-16"></div>
        </div>
      </div>
    </div>
  );
}

function BookingView({ user, bookings, setView }) {
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', extraBed: false, slip: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Availability: Exclude rejected bookings from unavailable list
  const unavailableUnits = useMemo(() => {
    if (!selectedDate) return [];
    return bookings
      .filter(b => b.date === selectedDate && b.status !== 'rejected')
      .map(b => b.unitId);
  }, [selectedDate, bookings]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1000000) { alert("ไฟล์ภาพใหญ่เกินไป (ต้องไม่เกิน 1MB)"); return; }
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, slip: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.slip) { alert("กรุณาแนบสลิปการโอนเงิน"); return; }
    setIsSubmitting(true);
    const pathSegments = getCollectionPath(); // ใช้ path ให้ตรงกับ Environment
    try {
      await addDoc(collection(db, ...pathSegments), {
        date: selectedDate,
        type: selectedType.id,
        unitId: selectedUnit,
        customerName: formData.name,
        customerPhone: formData.phone,
        hasExtraBed: formData.extraBed,
        slipImage: formData.slip,
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setStep(4);
    } catch (error) { console.error(error); alert("เกิดข้อผิดพลาด"); } finally { setIsSubmitting(false); }
  };

  const resetBooking = () => {
    setStep(1); setSelectedDate(''); setSelectedType(null); setSelectedUnit(null);
    setFormData({ name: '', phone: '', extraBed: false, slip: null });
  };

  if (step === 1) return (
    <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-xl shadow-sky-50 border border-sky-100 max-w-lg mx-auto mt-10 text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-400 to-orange-400"></div>
      <div className="w-20 h-20 bg-sky-50 text-sky-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"><Calendar size={40} /></div>
      <h2 className="text-3xl font-bold text-slate-800 mb-2">เลือกวันที่เข้าพัก</h2>
      <p className="text-slate-400 mb-8">กรุณาเลือกวันที่ต้องการเช็คอิน</p>
      <input type="date" className="w-full p-5 border border-slate-200 rounded-2xl mb-6 text-xl text-center font-bold text-slate-700 focus:ring-4 focus:ring-sky-100 focus:border-sky-400 outline-none bg-slate-50 hover:bg-white transition-colors cursor-pointer" min={new Date().toISOString().split('T')[0]} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      <button disabled={!selectedDate} onClick={() => setStep(2)} className="w-full bg-sky-500 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 hover:bg-sky-600 hover:shadow-lg hover:shadow-sky-200 transition-all transform active:scale-95">ตรวจสอบห้องว่าง</button>
    </div>
  );

  if (step === 2) return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-100 shadow-sm sticky top-20 z-40 backdrop-blur-md bg-white/90">
        <button onClick={() => setStep(1)} className="text-slate-500 text-sm hover:text-sky-600 flex items-center gap-1 font-medium"><ChevronLeft size={18}/> เปลี่ยนวันที่</button>
        <div className="flex flex-col items-end"><span className="text-xs text-slate-400">วันที่เข้าพัก</span><span className="font-bold text-sky-600 text-lg">{new Date(selectedDate).toLocaleDateString('th-TH', { dateStyle: 'long' })}</span></div>
      </div>
      {ACCOMMODATION_TYPES.map(type => {
        const units = Array.from({ length: type.totalUnits }, (_, i) => `${type.prefix}${i + 1}`);
        const availableCount = units.filter(u => !unavailableUnits.includes(u)).length;
        return (
          <div key={type.id} className="bg-white rounded-[1.5rem] shadow-sm overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                 <div className={`p-4 rounded-2xl ${type.color} shadow-sm`}><type.icon size={28} /></div>
                 <div>
                   <h3 className="font-bold text-slate-800 text-xl">{type.name}</h3>
                   <div className="flex items-center gap-2 mt-1">
                     <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">{type.capacity} ท่าน</span>
                     {type.hasExtraBed && <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded border border-orange-100">+เสริม 1 ({type.extraBedPrice}฿)</span>}
                   </div>
                 </div>
              </div>
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                 <div className="text-right"><p className="font-bold text-2xl text-sky-600">{type.price}.-</p></div>
                 <span className={`text-xs px-3 py-1 rounded-full font-medium ${availableCount === 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{availableCount === 0 ? 'เต็มแล้ว' : `ว่าง ${availableCount} ห้อง`}</span>
              </div>
            </div>
            <div className="p-6 bg-slate-50/50">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {units.map(unitId => {
                  const isTaken = unavailableUnits.includes(unitId);
                  return (
                    <button key={unitId} disabled={isTaken} onClick={() => { setSelectedType(type); setSelectedUnit(unitId); setStep(3); }} className={`py-3 rounded-xl text-sm font-bold transition-all relative overflow-hidden ${isTaken ? 'bg-slate-100 text-slate-300 border border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border border-slate-200 hover:border-sky-400 hover:text-sky-600 hover:shadow-md active:scale-95'}`}>{unitId}{!isTaken && <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full m-1"></div>}</button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (step === 3) {
    const totalPrice = selectedType.price + (formData.extraBed ? selectedType.extraBedPrice : 0);
    return (
      <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl shadow-sky-50 border border-slate-100 max-w-lg mx-auto">
        <button onClick={() => setStep(2)} className="text-slate-400 text-sm hover:text-slate-600 mb-6 flex items-center gap-1 font-medium"><ChevronLeft size={18}/> ย้อนกลับ</button>
        <h2 className="text-2xl font-bold mb-6 text-slate-800">ยืนยันการจอง</h2>
        <div className="bg-sky-50 p-6 rounded-2xl mb-8 space-y-3 border border-sky-100 relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10"><Tent size={100} className="text-sky-600"/></div>
           <div className="flex justify-between text-slate-600 text-sm relative z-10"><span>วันที่:</span> <span className="font-bold text-slate-800">{selectedDate}</span></div>
           <div className="flex justify-between text-slate-600 text-sm relative z-10"><span>ห้องพัก:</span> <span className="font-bold text-slate-800">{selectedType.name} ({selectedUnit})</span></div>
           {formData.extraBed && <div className="flex justify-between text-orange-600 text-sm relative z-10"><span>+ เตียงเสริม:</span> <span>{selectedType.extraBedPrice} บาท</span></div>}
           <div className="flex justify-between items-center pt-4 mt-2 border-t border-sky-200 relative z-10"><span className="text-slate-600">รวมทั้งสิ้น</span> <span className="text-2xl font-bold text-sky-600">{totalPrice.toLocaleString()} บาท</span></div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-5">
            <div><label className="block text-sm font-bold text-slate-700 mb-2">ชื่อผู้จอง</label><input required type="text" placeholder="ระบุชื่อ-นามสกุล" className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none bg-slate-50 focus:bg-white transition-colors" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
            <div><label className="block text-sm font-bold text-slate-700 mb-2">เบอร์โทรศัพท์</label><input required type="tel" placeholder="08x-xxx-xxxx" className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none bg-slate-50 focus:bg-white transition-colors" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
          </div>
          {selectedType.hasExtraBed && (
            <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl border border-orange-100 cursor-pointer hover:bg-orange-100 transition-colors" onClick={() => setFormData({...formData, extraBed: !formData.extraBed})}>
              <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${formData.extraBed ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300 bg-white'}`}>{formData.extraBed && <Check size={16} />}</div>
              <label className="text-sm font-medium text-slate-700 cursor-pointer select-none flex-1">ต้องการเตียงเสริม (+{selectedType.extraBedPrice} บาท)</label>
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">หลักฐานการโอนเงิน</label>
            <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-sky-50 hover:border-sky-300 transition-all group cursor-pointer bg-white">
              <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              {formData.slip ? (
                <div className="text-sky-600 flex flex-col items-center animate-in fade-in zoom-in"><Check size={40} /><span className="mt-2 font-medium">แนบไฟล์เรียบร้อย</span></div>
              ) : (
                <div className="text-slate-400 group-hover:text-sky-500 flex flex-col items-center transition-colors"><ImageIcon size={40} /><span className="mt-2 text-sm">แตะเพื่ออัปโหลดสลิป</span></div>
              )}
            </div>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-sky-500 to-sky-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-sky-200 transition-all mt-4 disabled:opacity-70 active:scale-95">{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการจอง'}</button>
        </form>
      </div>
    );
  }

  if (step === 4) return (
    <div className="text-center py-16 px-6 bg-white rounded-[2.5rem] shadow-2xl shadow-sky-50 max-w-md mx-auto mt-10 border border-slate-100">
      <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce"><Check size={48} /></div>
      <h2 className="text-3xl font-bold text-slate-800 mb-4">จองสำเร็จ!</h2>
      <p className="text-slate-500 mb-10 leading-relaxed">ขอบคุณที่เลือกพักกับ ArchaTara<br/>เราได้รับข้อมูลแล้ว และจะทำการยืนยันกลับโดยเร็วที่สุด</p>
      <button onClick={resetBooking} className="bg-slate-800 text-white px-10 py-3 rounded-xl font-bold hover:bg-slate-900 transition shadow-lg">กลับหน้าหลัก</button>
    </div>
  );
}

function AdminView({ bookings }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');

  const handleStatusChange = async (bookingId, newStatus) => {
    if (!confirm(`ยืนยันการเปลี่ยนสถานะ?`)) return;
    const pathSegments = getCollectionPath(); // ใช้ path ให้ตรงกับ Environment
    await updateDoc(doc(db, ...pathSegments, bookingId), { status: newStatus });
  };

  if (!isAdmin) return (
    <div className="max-w-xs mx-auto mt-20 p-8 bg-white rounded-3xl shadow-lg border border-slate-100 text-center">
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4"><Check size={20} className="text-slate-400"/></div>
      <h3 className="font-bold text-xl mb-6 text-slate-800">Admin Access</h3>
      <input type="password" placeholder="รหัสผ่าน" className="w-full p-3 border border-slate-200 rounded-xl mb-4 text-center focus:ring-2 focus:ring-sky-500 outline-none" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={() => password === '4433' ? setIsAdmin(true) : alert('รหัสผ่านไม่ถูกต้อง')} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900">เข้าสู่ระบบ</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800">รายการจอง</h2>
        <button onClick={() => setIsAdmin(false)} className="text-slate-400 hover:text-red-500 p-2 bg-slate-50 rounded-full"><LogOut size={20}/></button>
      </div>
      <div className="space-y-4">
        {bookings.length === 0 && <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">ไม่มีข้อมูลการจอง</div>}
        {bookings.map(booking => (
          <div key={booking.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow">
            <div className="w-full md:w-40 h-40 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 group relative">
               {booking.slipImage ? (
                 <img src={booking.slipImage} alt="Slip" className="w-full h-full object-cover cursor-pointer hover:scale-105 transition duration-500" onClick={() => { const w = window.open(""); w.document.write('<img src="' + booking.slipImage + '" style="max-width:100%"/>'); }}/>
               ) : <div className="flex items-center justify-center h-full text-slate-400 text-xs">No Slip</div>}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded-md uppercase tracking-wide mr-2 border border-sky-100">{booking.unitId}</span>
                  <span className="text-xs text-slate-400 font-medium">{booking.type}</span>
                  <h3 className="font-bold text-xl text-slate-800 mt-1">{booking.customerName}</h3>
                </div>
                {getStatusBadge(booking.status)}
              </div>
              <div className="text-sm text-slate-600 space-y-1 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p>📅 เข้าพัก: <span className="font-semibold">{new Date(booking.date).toLocaleDateString('th-TH')}</span></p>
                <p>📞 โทร: <span className="font-semibold">{booking.customerPhone}</span></p>
                {booking.hasExtraBed && <p className="text-orange-500 font-bold text-xs flex items-center gap-1"><Check size={12}/> เสริมเตียง</p>}
              </div>
              {booking.status === 'pending' && (
                <div className="flex gap-3">
                  <button onClick={() => handleStatusChange(booking.id, 'confirmed')} className="flex-1 bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-600 shadow-sm shadow-emerald-200 transition-all">อนุมัติ</button>
                  <button onClick={() => handleStatusChange(booking.id, 'rejected')} className="flex-1 bg-white border border-red-200 text-red-500 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 transition-all">ปฏิเสธ</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}