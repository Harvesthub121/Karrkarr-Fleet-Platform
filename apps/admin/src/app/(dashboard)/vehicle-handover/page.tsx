'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Printer, Plus, Trash2, ChevronDown, ChevronUp, Car } from 'lucide-react';

// Types
interface DamageMarker {
  id: number;
  x: number;
  y: number;
  viewId: string;
  description: string;
}

interface PetrolLevel {
  value: string;
  label: string;
}

interface RentalOption {
  id: string;
  agreementNo: string;
  vehicle?: {
    plateNumber?: string;
    make?: string;
    model?: string;
  };
  startDate?: string;
  endDate?: string;
  customer?: {
    name?: string;
  };
}

const PETROL_LEVELS: PetrolLevel[] = [
  { value: 'E', label: 'E' },
  { value: '1/8', label: '1/8' },
  { value: '2/8', label: '2/8' },
  { value: '3/8', label: '3/8' },
  { value: '4/8', label: '4/8' },
  { value: '5/8', label: '5/8' },
  { value: '6/8', label: '6/8' },
  { value: '7/8', label: '7/8' },
  { value: 'F', label: 'F' },
];

// SVG Car Diagrams
function SideViewSVG({ markers, onAddMarker }: { markers: DamageMarker[]; onAddMarker: (x: number, y: number, viewId: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = 400 / rect.width;
    const scaleY = 140 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    onAddMarker(x, y, 'side');
  }, [onAddMarker]);

  return (
    <svg ref={svgRef} viewBox="0 0 400 140" width="400" height="140" onClick={handleClick}
      style={{ cursor: 'crosshair', background: '#1c1c1e', borderRadius: 8 }}>
      {/* Body */}
      <path d="M 40 90 L 40 70 L 80 40 L 160 28 L 280 28 L 330 40 L 360 70 L 360 90 Z"
        fill="#2d2d2d" stroke="#5eead4" strokeWidth="2" />
      {/* Roof */}
      <path d="M 85 40 L 100 28 L 300 28 L 320 40" fill="none" stroke="#5eead4" strokeWidth="1.5" />
      {/* Windshield front */}
      <path d="M 280 28 L 320 40 L 310 68 L 265 68 Z" fill="#1a3a4a" stroke="#5eead4" strokeWidth="1.5" />
      {/* Windshield rear */}
      <path d="M 110 68 L 90 68 L 80 40 L 130 28 Z" fill="#1a3a4a" stroke="#5eead4" strokeWidth="1.5" />
      {/* Windows */}
      <rect x="130" y="32" width="60" height="36" rx="3" fill="#1a3a4a" stroke="#5eead4" strokeWidth="1" />
      <rect x="200" y="32" width="58" height="36" rx="3" fill="#1a3a4a" stroke="#5eead4" strokeWidth="1" />
      {/* Door lines */}
      <line x1="195" y1="30" x2="195" y2="90" stroke="#5eead4" strokeWidth="1" />
      <line x1="265" y1="30" x2="265" y2="90" stroke="#5eead4" strokeWidth="1" />
      {/* Front wheel arch */}
      <ellipse cx="100" cy="95" rx="28" ry="12" fill="#1c1c1e" stroke="#5eead4" strokeWidth="1.5" />
      <circle cx="100" cy="95" r="18" fill="#111" stroke="#5eead4" strokeWidth="2" />
      <circle cx="100" cy="95" r="8" fill="#333" stroke="#5eead4" strokeWidth="1" />
      {/* Rear wheel arch */}
      <ellipse cx="300" cy="95" rx="28" ry="12" fill="#1c1c1e" stroke="#5eead4" strokeWidth="1.5" />
      <circle cx="300" cy="95" r="18" fill="#111" stroke="#5eead4" strokeWidth="2" />
      <circle cx="300" cy="95" r="8" fill="#333" stroke="#5eead4" strokeWidth="1" />
      {/* Bumpers */}
      <path d="M 40 70 L 30 75 L 30 95 L 40 95" fill="#333" stroke="#5eead4" strokeWidth="1.5" />
      <path d="M 360 70 L 370 75 L 370 95 L 360 95" fill="#333" stroke="#5eead4" strokeWidth="1.5" />
      {/* Headlight */}
      <rect x="30" y="58" width="14" height="10" rx="2" fill="#ffd700" stroke="#5eead4" strokeWidth="1" />
      {/* Taillight */}
      <rect x="356" y="58" width="14" height="10" rx="2" fill="#ff4444" stroke="#5eead4" strokeWidth="1" />
      {/* Label */}
      <text x="200" y="130" textAnchor="middle" fill="#5eead4" fontSize="11">Side View (click to mark damage)</text>
      {/* Markers */}
      {markers.filter(m => m.viewId === 'side').map(m => (
        <g key={m.id}>
          <circle cx={m.x} cy={m.y} r="10" fill="rgba(239,68,68,0.9)" stroke="white" strokeWidth="1.5" />
          <text x={m.x} y={m.y + 4} textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">{m.id}</text>
        </g>
      ))}
    </svg>
  );
}

function TopViewSVG({ markers, onAddMarker }: { markers: DamageMarker[]; onAddMarker: (x: number, y: number, viewId: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = 400 / rect.width;
    const scaleY = 180 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    onAddMarker(x, y, 'top');
  }, [onAddMarker]);

  return (
    <svg ref={svgRef} viewBox="0 0 400 180" width="400" height="180" onClick={handleClick}
      style={{ cursor: 'crosshair', background: '#1c1c1e', borderRadius: 8 }}>
      {/* Car body */}
      <rect x="80" y="20" width="240" height="140" rx="30" fill="#2d2d2d" stroke="#5eead4" strokeWidth="2" />
      {/* Windshield front */}
      <path d="M 110 20 L 290 20 L 280 55 L 120 55 Z" fill="#1a3a4a" stroke="#5eead4" strokeWidth="1.5" />
      {/* Windshield rear */}
      <path d="M 120 125 L 280 125 L 290 160 L 110 160 Z" fill="#1a3a4a" stroke="#5eead4" strokeWidth="1.5" />
      {/* Roof panel */}
      <rect x="120" y="55" width="160" height="70" rx="5" fill="#252525" stroke="#5eead4" strokeWidth="1" />
      {/* Door lines */}
      <line x1="80" y1="90" x2="320" y2="90" stroke="#5eead4" strokeWidth="1" strokeDasharray="4,3" />
      <line x1="175" y1="55" x2="175" y2="125" stroke="#5eead4" strokeWidth="1" />
      <line x1="225" y1="55" x2="225" y2="125" stroke="#5eead4" strokeWidth="1" />
      {/* Wheels FL */}
      <rect x="55" y="22" width="35" height="50" rx="8" fill="#111" stroke="#5eead4" strokeWidth="1.5" />
      {/* Wheels FR */}
      <rect x="310" y="22" width="35" height="50" rx="8" fill="#111" stroke="#5eead4" strokeWidth="1.5" />
      {/* Wheels RL */}
      <rect x="55" y="108" width="35" height="50" rx="8" fill="#111" stroke="#5eead4" strokeWidth="1.5" />
      {/* Wheels RR */}
      <rect x="310" y="108" width="35" height="50" rx="8" fill="#111" stroke="#5eead4" strokeWidth="1.5" />
      {/* Headlights */}
      <rect x="95" y="14" width="30" height="10" rx="3" fill="#ffd700" stroke="#5eead4" strokeWidth="1" />
      <rect x="275" y="14" width="30" height="10" rx="3" fill="#ffd700" stroke="#5eead4" strokeWidth="1" />
      {/* Taillights */}
      <rect x="95" y="156" width="30" height="10" rx="3" fill="#ff4444" stroke="#5eead4" strokeWidth="1" />
      <rect x="275" y="156" width="30" height="10" rx="3" fill="#ff4444" stroke="#5eead4" strokeWidth="1" />
      {/* Arrow labels */}
      <text x="200" y="10" textAnchor="middle" fill="#5eead4" fontSize="9">FRONT</text>
      <text x="200" y="178" textAnchor="middle" fill="#5eead4" fontSize="9">REAR — click to mark damage</text>
      {/* Markers */}
      {markers.filter(m => m.viewId === 'top').map(m => (
        <g key={m.id}>
          <circle cx={m.x} cy={m.y} r="10" fill="rgba(239,68,68,0.9)" stroke="white" strokeWidth="1.5" />
          <text x={m.x} y={m.y + 4} textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">{m.id}</text>
        </g>
      ))}
    </svg>
  );
}

function FrontViewSVG({ markers, onAddMarker }: { markers: DamageMarker[]; onAddMarker: (x: number, y: number, viewId: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = 160 / rect.width;
    const scaleY = 120 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    onAddMarker(x, y, 'front');
  }, [onAddMarker]);

  return (
    <svg ref={svgRef} viewBox="0 0 160 120" width="160" height="120" onClick={handleClick}
      style={{ cursor: 'crosshair', background: '#1c1c1e', borderRadius: 8 }}>
      {/* Body */}
      <path d="M 10 80 L 10 50 L 25 30 L 135 30 L 150 50 L 150 80 Z" fill="#2d2d2d" stroke="#5eead4" strokeWidth="2" />
      {/* Hood */}
      <path d="M 25 30 L 135 30 L 130 20 L 30 20 Z" fill="#333" stroke="#5eead4" strokeWidth="1.5" />
      {/* Windshield */}
      <path d="M 35 30 L 125 30 L 120 55 L 40 55 Z" fill="#1a3a4a" stroke="#5eead4" strokeWidth="1.5" />
      {/* Headlights */}
      <rect x="12" y="42" width="28" height="18" rx="4" fill="#ffd700" stroke="#5eead4" strokeWidth="1.5" />
      <rect x="120" y="42" width="28" height="18" rx="4" fill="#ffd700" stroke="#5eead4" strokeWidth="1.5" />
      {/* Grille */}
      <rect x="55" y="62" width="50" height="14" rx="3" fill="#111" stroke="#5eead4" strokeWidth="1.5" />
      <line x1="65" y1="62" x2="65" y2="76" stroke="#5eead4" strokeWidth="1" />
      <line x1="75" y1="62" x2="75" y2="76" stroke="#5eead4" strokeWidth="1" />
      <line x1="85" y1="62" x2="85" y2="76" stroke="#5eead4" strokeWidth="1" />
      <line x1="95" y1="62" x2="95" y2="76" stroke="#5eead4" strokeWidth="1" />
      {/* Bumper */}
      <path d="M 8 78 L 152 78 L 152 88 L 8 88 Z" fill="#333" stroke="#5eead4" strokeWidth="1.5" />
      {/* Wheels */}
      <ellipse cx="28" cy="88" rx="18" ry="8" fill="#111" stroke="#5eead4" strokeWidth="1.5" />
      <ellipse cx="132" cy="88" rx="18" ry="8" fill="#111" stroke="#5eead4" strokeWidth="1.5" />
      {/* Label */}
      <text x="80" y="115" textAnchor="middle" fill="#5eead4" fontSize="9">FRONT VIEW</text>
      {/* Markers */}
      {markers.filter(m => m.viewId === 'front').map(m => (
        <g key={m.id}>
          <circle cx={m.x} cy={m.y} r="8" fill="rgba(239,68,68,0.9)" stroke="white" strokeWidth="1.5" />
          <text x={m.x} y={m.y + 3} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{m.id}</text>
        </g>
      ))}
    </svg>
  );
}

function RearViewSVG({ markers, onAddMarker }: { markers: DamageMarker[]; onAddMarker: (x: number, y: number, viewId: string) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = 160 / rect.width;
    const scaleY = 120 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    onAddMarker(x, y, 'rear');
  }, [onAddMarker]);

  return (
    <svg ref={svgRef} viewBox="0 0 160 120" width="160" height="120" onClick={handleClick}
      style={{ cursor: 'crosshair', background: '#1c1c1e', borderRadius: 8 }}>
      {/* Body */}
      <path d="M 10 80 L 10 50 L 25 30 L 135 30 L 150 50 L 150 80 Z" fill="#2d2d2d" stroke="#5eead4" strokeWidth="2" />
      {/* Boot lid */}
      <path d="M 30 20 L 130 20 L 135 30 L 25 30 Z" fill="#333" stroke="#5eead4" strokeWidth="1.5" />
      {/* Rear windshield */}
      <path d="M 40 55 L 120 55 L 125 30 L 35 30 Z" fill="#1a3a4a" stroke="#5eead4" strokeWidth="1.5" />
      {/* Tail lights */}
      <rect x="12" y="42" width="28" height="18" rx="4" fill="#ff4444" stroke="#5eead4" strokeWidth="1.5" />
      <rect x="120" y="42" width="28" height="18" rx="4" fill="#ff4444" stroke="#5eead4" strokeWidth="1.5" />
      {/* Number plate area */}
      <rect x="55" y="62" width="50" height="14" rx="2" fill="#ffd700" stroke="#5eead4" strokeWidth="1" />
      {/* Bumper */}
      <path d="M 8 78 L 152 78 L 152 88 L 8 88 Z" fill="#333" stroke="#5eead4" strokeWidth="1.5" />
      {/* Wheels */}
      <ellipse cx="28" cy="88" rx="18" ry="8" fill="#111" stroke="#5eead4" strokeWidth="1.5" />
      <ellipse cx="132" cy="88" rx="18" ry="8" fill="#111" stroke="#5eead4" strokeWidth="1.5" />
      {/* Label */}
      <text x="80" y="115" textAnchor="middle" fill="#5eead4" fontSize="9">REAR VIEW</text>
      {/* Markers */}
      {markers.filter(m => m.viewId === 'rear').map(m => (
        <g key={m.id}>
          <circle cx={m.x} cy={m.y} r="8" fill="rgba(239,68,68,0.9)" stroke="white" strokeWidth="1.5" />
          <text x={m.x} y={m.y + 3} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{m.id}</text>
        </g>
      ))}
    </svg>
  );
}

// Input components
function FormInput({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-400 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 print:border-gray-300 print:bg-white print:text-black"
      />
    </div>
  );
}

function FormTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-400 uppercase tracking-wide">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500 resize-none print:border-gray-300 print:bg-white print:text-black"
      />
    </div>
  );
}

function YesNoToggle({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm text-zinc-300">{label}</span>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(true)}
          className={`px-3 py-1 text-xs rounded font-medium transition-colors ${value === true ? 'bg-teal-500 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}
        >YES</button>
        <button
          onClick={() => onChange(false)}
          className={`px-3 py-1 text-xs rounded font-medium transition-colors ${value === false ? 'bg-red-500 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}
        >NO</button>
      </div>
    </div>
  );
}

export default function VehicleHandoverPage() {
  // RA Reference
  const [raNo, setRaNo] = useState('');
  const [raDate, setRaDate] = useState('');

  // Main hirer
  const [hName, setHName] = useState('');
  const [hAddress, setHAddress] = useState('');
  const [hHp, setHHp] = useState('');
  const [hEmail, setHEmail] = useState('');
  const [hNric, setHNric] = useState('');
  const [hLicence, setHLicence] = useState('');
  const [hDob, setHDob] = useState('');
  const [hLicenceDate, setHLicenceDate] = useState('');
  const [hNationality, setHNationality] = useState('');
  const [hPlaceOfIssue, setHPlaceOfIssue] = useState('');
  const [hOccupation, setHOccupation] = useState('');
  const [hExperience, setHExperience] = useState('');

  // Additional driver
  const [showAddlDriver, setShowAddlDriver] = useState(false);
  const [adName, setAdName] = useState('');
  const [adAddress, setAdAddress] = useState('');
  const [adHp, setAdHp] = useState('');
  const [adEmail, setAdEmail] = useState('');
  const [adNric, setAdNric] = useState('');
  const [adLicence, setAdLicence] = useState('');
  const [adDob, setAdDob] = useState('');
  const [adLicenceDate, setAdLicenceDate] = useState('');
  const [adNationality, setAdNationality] = useState('');
  const [adPlaceOfIssue, setAdPlaceOfIssue] = useState('');
  const [adOccupation, setAdOccupation] = useState('');
  const [adExperience, setAdExperience] = useState('');
  const [adEffectivePass, setAdEffectivePass] = useState('');

  // Rental charges
  const [daily, setDaily] = useState('');
  const [weekly, setWeekly] = useState('');
  const [monthly, setMonthly] = useState('');
  const [othersAmt, setOthersAmt] = useState('');
  const [othersDesc, setOthersDesc] = useState('');
  const [delivery, setDelivery] = useState('');
  const [deposit, setDeposit] = useState('');

  const total = [daily, weekly, monthly, othersAmt, delivery, deposit]
    .map(v => parseFloat(v) || 0)
    .reduce((a, b) => a + b, 0);

  // Vehicle handover
  const [vehicleNo, setVehicleNo] = useState('');
  const [replacementNo, setReplacementNo] = useState('');
  const [mileageOut, setMileageOut] = useState('');
  const [mileageIn, setMileageIn] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [outDate, setOutDate] = useState('');
  const [outTime, setOutTime] = useState('');
  const [contractPeriod, setContractPeriod] = useState('');
  const [petrolOut, setPetrolOut] = useState('');
  const [petrolIn, setPetrolIn] = useState('');
  const [spareTyre, setSpareTyre] = useState<boolean | null>(null);
  const [toolkit, setToolkit] = useState<boolean | null>(null);
  const [carCamera, setCarCamera] = useState<boolean | null>(null);
  const [phvDecal, setPhvDecal] = useState<boolean | null>(null);
  const [tpExcess, setTpExcess] = useState('');
  const [odExcess, setOdExcess] = useState('');
  const [wsExcess, setWsExcess] = useState('');
  const [checkedOutBy, setCheckedOutBy] = useState('');

  // Damage markers
  const [markers, setMarkers] = useState<DamageMarker[]>([]);
  const [nextMarkerId, setNextMarkerId] = useState(1);

  const addMarker = useCallback((x: number, y: number, viewId: string) => {
    setMarkers(prev => [...prev, { id: nextMarkerId, x, y, viewId, description: '' }]);
    setNextMarkerId(prev => prev + 1);
  }, [nextMarkerId]);

  const deleteMarker = (id: number) => {
    setMarkers(prev => prev.filter(m => m.id !== id));
  };

  const updateMarkerDesc = (id: number, desc: string) => {
    setMarkers(prev => prev.map(m => m.id === id ? { ...m, description: desc } : m));
  };

  // Return of vehicle
  const [returnDateIn, setReturnDateIn] = useState('');
  const [returnTimeIn, setReturnTimeIn] = useState('');
  const [returnMileageIn, setReturnMileageIn] = useState('');
  const [returnCheckedBy, setReturnCheckedBy] = useState('');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returnSignature, setReturnSignature] = useState('');

  // Rental auto-fill
  const [rentals, setRentals] = useState<RentalOption[]>([]);
  const [selectedRentalId, setSelectedRentalId] = useState('');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('karrkarr_admin_session') : null;
    if (!token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/rentals?page=1&pageSize=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        setRentals(list);
      })
      .catch(() => {});
  }, []);

  const handleSelectRental = (id: string) => {
    setSelectedRentalId(id);
    const rental = rentals.find(r => r.id === id);
    if (!rental) return;
    if (rental.agreementNo) setRaNo(rental.agreementNo);
    if (rental.vehicle?.plateNumber) setVehicleNo(rental.vehicle.plateNumber);
    if (rental.vehicle?.make) setMake(rental.vehicle.make);
    if (rental.vehicle?.model) setModel(rental.vehicle.model);
    if (rental.startDate) setOutDate(rental.startDate.split('T')[0]);
    if (rental.startDate && rental.endDate) {
      const fmt = (d: string) => new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
      setContractPeriod(`${fmt(rental.startDate)} to ${fmt(rental.endDate)}`);
    }
    if (rental.customer?.name) setHName(rental.customer.name);
  };

  const handlePrint = () => window.print();

  const formatYN = (v: boolean | null) => v === true ? 'YES' : v === false ? 'NO' : '—';

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #handover-printout, #handover-printout * { visibility: visible !important; }
          #handover-printout { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      <div className="min-h-screen bg-zinc-950 text-white p-6 no-print">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Car className="text-teal-400" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-white">Vehicle Hand-over Checklist</h1>
              <p className="text-sm text-zinc-400">Karkarr Rental Agreement Form</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Printer size={16} />
            Generate PDF
          </button>
        </div>

        {/* Auto-fill from Rental */}
        {rentals.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">Auto-fill from Rental</label>
            <select
              value={selectedRentalId}
              onChange={e => handleSelectRental(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
            >
              <option value="">— Select a rental —</option>
              {rentals.map(r => (
                <option key={r.id} value={r.id}>{r.agreementNo} {r.vehicle?.plateNumber ? `— ${r.vehicle.plateNumber}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* Section 1: RA Reference */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-teal-400 uppercase tracking-widest mb-4">RA Reference</h2>
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="RA No." value={raNo} onChange={setRaNo} />
            <FormInput label="Date" value={raDate} onChange={setRaDate} type="date" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Section 2: Main Hirer */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-teal-400 uppercase tracking-widest mb-4">Main Hirer Particulars</h2>
            <div className="flex flex-col gap-3">
              <FormInput label="Name" value={hName} onChange={setHName} />
              <FormTextarea label="Address" value={hAddress} onChange={setHAddress} />
              <FormInput label="H/P No." value={hHp} onChange={setHHp} />
              <FormInput label="Email" value={hEmail} onChange={setHEmail} type="email" />
              <FormInput label="NRIC" value={hNric} onChange={setHNric} />
              <FormInput label="Driving Licence No." value={hLicence} onChange={setHLicence} />
              <FormInput label="Date of Birth" value={hDob} onChange={setHDob} type="date" />
              <FormInput label="Date of Issue (Licence)" value={hLicenceDate} onChange={setHLicenceDate} type="date" />
              <FormInput label="Nationality" value={hNationality} onChange={setHNationality} />
              <FormInput label="Place of Issue" value={hPlaceOfIssue} onChange={setHPlaceOfIssue} />
              <FormInput label="Occupation" value={hOccupation} onChange={setHOccupation} />
              <FormInput label="Driving Experience" value={hExperience} onChange={setHExperience} placeholder="e.g. 5 years" />
            </div>
          </div>

          {/* Section 5: Vehicle Handover Details */}
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-teal-400 uppercase tracking-widest mb-4">Vehicle Handover Details</h2>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Vehicle No." value={vehicleNo} onChange={setVehicleNo} />
                <FormInput label="Replacement No." value={replacementNo} onChange={setReplacementNo} />
                <FormInput label="Make" value={make} onChange={setMake} />
                <FormInput label="Model" value={model} onChange={setModel} />
                <FormInput label="Mileage Out" value={mileageOut} onChange={setMileageOut} type="number" />
                <FormInput label="Mileage In" value={mileageIn} onChange={setMileageIn} type="number" />
                <FormInput label="Out Date" value={outDate} onChange={setOutDate} type="date" />
                <FormInput label="Out Time" value={outTime} onChange={setOutTime} type="time" />
              </div>
              <FormInput label="Contract Period" value={contractPeriod} onChange={setContractPeriod} placeholder="1 Jan 2026 to 31 Jan 2026" />

              {/* Petrol Gauges */}
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wide block mb-2">Petrol Out</label>
                <div className="flex flex-wrap gap-1">
                  {PETROL_LEVELS.map(lvl => (
                    <button key={lvl.value} onClick={() => setPetrolOut(lvl.value)}
                      className={`px-2 py-1 text-xs rounded font-medium border transition-colors ${petrolOut === lvl.value ? 'bg-teal-500 border-teal-500 text-white' : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-teal-600'}`}>
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 uppercase tracking-wide block mb-2">Petrol In</label>
                <div className="flex flex-wrap gap-1">
                  {PETROL_LEVELS.map(lvl => (
                    <button key={lvl.value} onClick={() => setPetrolIn(lvl.value)}
                      className={`px-2 py-1 text-xs rounded font-medium border transition-colors ${petrolIn === lvl.value ? 'bg-teal-500 border-teal-500 text-white' : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-teal-600'}`}>
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Yes/No Toggles */}
              <div className="border border-zinc-700 rounded-lg p-3">
                <YesNoToggle label="Spare Tyre" value={spareTyre} onChange={setSpareTyre} />
                <YesNoToggle label="Tool Kit" value={toolkit} onChange={setToolkit} />
                <YesNoToggle label="Car Camera" value={carCamera} onChange={setCarCamera} />
                <YesNoToggle label="PHV Decal" value={phvDecal} onChange={setPhvDecal} />
              </div>

              {/* Insurance Excess */}
              <div className="grid grid-cols-3 gap-2">
                <FormInput label="3rd Party Excess S$" value={tpExcess} onChange={setTpExcess} />
                <FormInput label="Own Damage Excess S$" value={odExcess} onChange={setOdExcess} />
                <FormInput label="Windscreen Excess S$" value={wsExcess} onChange={setWsExcess} />
              </div>
              <FormInput label="Checked Out By" value={checkedOutBy} onChange={setCheckedOutBy} />
            </div>
          </div>
        </div>

        {/* Section 3: Additional Driver */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl mb-4">
          <button
            onClick={() => setShowAddlDriver(!showAddlDriver)}
            className="w-full flex items-center justify-between p-5 text-sm font-semibold text-teal-400 uppercase tracking-widest"
          >
            <span>Additional Driver Particulars (Optional)</span>
            {showAddlDriver ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showAddlDriver && (
            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
              <FormInput label="Name" value={adName} onChange={setAdName} />
              <FormTextarea label="Address" value={adAddress} onChange={setAdAddress} />
              <FormInput label="H/P No." value={adHp} onChange={setAdHp} />
              <FormInput label="Email" value={adEmail} onChange={setAdEmail} type="email" />
              <FormInput label="NRIC" value={adNric} onChange={setAdNric} />
              <FormInput label="Driving Licence No." value={adLicence} onChange={setAdLicence} />
              <FormInput label="Date of Birth" value={adDob} onChange={setAdDob} type="date" />
              <FormInput label="Date of Issue (Licence)" value={adLicenceDate} onChange={setAdLicenceDate} type="date" />
              <FormInput label="Nationality" value={adNationality} onChange={setAdNationality} />
              <FormInput label="Place of Issue" value={adPlaceOfIssue} onChange={setAdPlaceOfIssue} />
              <FormInput label="Occupation" value={adOccupation} onChange={setAdOccupation} />
              <FormInput label="Driving Experience" value={adExperience} onChange={setAdExperience} placeholder="e.g. 5 years" />
              <FormInput label="Effective Pass Date" value={adEffectivePass} onChange={setAdEffectivePass} type="date" />
            </div>
          )}
        </div>

        {/* Section 4: Rental Charges */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-teal-400 uppercase tracking-widest mb-4">Rental Charges</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-800">
              {[
                ['Daily @', daily, setDaily],
                ['Weekly @', weekly, setWeekly],
                ['Monthly @', monthly, setMonthly],
                ['Others @', othersAmt, setOthersAmt],
                ['Delivery Service', delivery, setDelivery],
                ['Security Deposit', deposit, setDeposit],
              ].map(([lbl, val, setter]) => (
                <tr key={String(lbl)}>
                  <td className="py-2 text-zinc-300 pr-4 w-40">{String(lbl)}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">S$</span>
                      <input
                        type="number"
                        value={String(val)}
                        onChange={e => (setter as (v: string) => void)(e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-teal-500 w-28"
                        min="0"
                        step="0.01"
                      />
                      {String(lbl) === 'Others @' && (
                        <input
                          type="text"
                          value={othersDesc}
                          onChange={e => setOthersDesc(e.target.value)}
                          placeholder="Description"
                          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-teal-500 flex-1"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              <tr className="bg-zinc-800">
                <td className="py-2 px-2 font-bold text-white">Total</td>
                <td className="py-2 px-2 font-bold text-teal-400">S$ {total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 6: Damage Diagram */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-teal-400 uppercase tracking-widest mb-2">Car Damage Diagram</h2>
          <p className="text-xs text-zinc-400 mb-4">Click on any view to mark damage locations. Each click places a numbered marker.</p>
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Side View</p>
              <SideViewSVG markers={markers} onAddMarker={addMarker} />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Top View</p>
              <TopViewSVG markers={markers} onAddMarker={addMarker} />
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Front View</p>
                <FrontViewSVG markers={markers} onAddMarker={addMarker} />
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Rear View</p>
                <RearViewSVG markers={markers} onAddMarker={addMarker} />
              </div>
            </div>
          </div>

          {markers.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-300 uppercase mb-2">Damage Notes</h3>
              <div className="flex flex-col gap-2">
                {markers.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold shrink-0">{m.id}</span>
                    <span className="text-xs text-zinc-500 w-16 shrink-0">{m.viewId} view</span>
                    <input
                      type="text"
                      value={m.description}
                      onChange={e => updateMarkerDesc(m.id, e.target.value)}
                      placeholder="Describe damage..."
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-teal-500"
                    />
                    <button onClick={() => deleteMarker(m.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Section 7: Return of Vehicle */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-teal-400 uppercase tracking-widest mb-4">Return of Vehicle</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  {['Date In', 'Time In', 'Mileage In', 'Checked By', 'Remarks', 'Hirer Signature'].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-xs text-zinc-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[
                    [returnDateIn, setReturnDateIn, 'date'],
                    [returnTimeIn, setReturnTimeIn, 'time'],
                    [returnMileageIn, setReturnMileageIn, 'number'],
                    [returnCheckedBy, setReturnCheckedBy, 'text'],
                    [returnRemarks, setReturnRemarks, 'text'],
                    [returnSignature, setReturnSignature, 'text'],
                  ].map(([val, setter, type], i) => (
                    <td key={i} className="py-2 px-2">
                      <input
                        type={String(type)}
                        value={String(val)}
                        onChange={e => (setter as (v: string) => void)(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-teal-500"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========== PRINT VERSION ========== */}
      <div id="handover-printout" style={{ display: 'none', fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#000', padding: '0', lineHeight: '1.4' }}>
        <style>{`
          @media print {
            #handover-printout { display: block !important; }
            .print-page { page-break-after: always; }
            .print-page:last-child { page-break-after: avoid; }
          }
        `}</style>

        {/* PAGE 1 */}
        <div className="print-page" style={{ padding: '8mm' }}>
          {/* Letterhead */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '6px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>KARKARR RENTAL</div>
              <div style={{ fontSize: '9px' }}>7 Sin Ming Industrial Estate Sector C, #01-94, Singapore 575642</div>
              <div style={{ fontSize: '9px' }}>ROC: 201917017W</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px' }}><strong>RA No:</strong> {raNo || '_______________'}</div>
              <div style={{ fontSize: '11px' }}><strong>Date:</strong> {raDate || '_______________'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Vehicle Rental Agreement
          </div>

          {/* Two column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Left: Hirer + Rental Charges */}
            <div>
              <div style={{ border: '1px solid #000', padding: '6px', marginBottom: '6px' }}>
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '4px', paddingBottom: '2px', fontSize: '10px', textTransform: 'uppercase' }}>Main Hirer Particulars</div>
                {[
                  ['Name', hName], ['Address', hAddress], ['H/P No.', hHp], ['Email', hEmail],
                  ['NRIC', hNric], ['Driving Licence No.', hLicence], ['Date of Birth', hDob],
                  ['Date of Issue', hLicenceDate], ['Nationality', hNationality],
                  ['Place of Issue', hPlaceOfIssue], ['Occupation', hOccupation],
                  ['Driving Experience', hExperience],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                    <span style={{ color: '#555', minWidth: '100px', fontSize: '9px' }}>{label}:</span>
                    <span style={{ borderBottom: '1px dotted #999', flex: 1, fontSize: '9px' }}>{value || ''}</span>
                  </div>
                ))}
              </div>

              {showAddlDriver && (
                <div style={{ border: '1px solid #000', padding: '6px', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '4px', paddingBottom: '2px', fontSize: '10px', textTransform: 'uppercase' }}>Additional Driver</div>
                  {[
                    ['Name', adName], ['Address', adAddress], ['H/P No.', adHp], ['Email', adEmail],
                    ['NRIC', adNric], ['Driving Licence No.', adLicence], ['Date of Birth', adDob],
                    ['Date of Issue', adLicenceDate], ['Nationality', adNationality],
                    ['Place of Issue', adPlaceOfIssue], ['Occupation', adOccupation],
                    ['Driving Experience', adExperience], ['Effective Pass Date', adEffectivePass],
                  ].map(([label, value]) => (
                    <div key={String(label)} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                      <span style={{ color: '#555', minWidth: '100px', fontSize: '9px' }}>{label}:</span>
                      <span style={{ borderBottom: '1px dotted #999', flex: 1, fontSize: '9px' }}>{value || ''}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Rental Charges */}
              <div style={{ border: '1px solid #000', padding: '6px' }}>
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '4px', paddingBottom: '2px', fontSize: '10px', textTransform: 'uppercase' }}>Rental Charges</div>
                <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
                  <tbody>
                    {[
                      ['Daily @', daily],
                      ['Weekly @', weekly],
                      ['Monthly @', monthly],
                      [`Others @ (${othersDesc})`, othersAmt],
                      ['Delivery Service', delivery],
                      ['Security Deposit', deposit],
                    ].map(([label, value]) => (
                      <tr key={String(label)} style={{ borderBottom: '1px dotted #ccc' }}>
                        <td style={{ padding: '2px 4px' }}>{label}</td>
                        <td style={{ padding: '2px 4px', textAlign: 'right' }}>S$ {value || '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 'bold', borderTop: '1px solid #000' }}>
                      <td style={{ padding: '2px 4px' }}>TOTAL</td>
                      <td style={{ padding: '2px 4px', textAlign: 'right' }}>S$ {total.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Vehicle + Diagram */}
            <div>
              <div style={{ border: '1px solid #000', padding: '6px', marginBottom: '6px' }}>
                <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '4px', paddingBottom: '2px', fontSize: '10px', textTransform: 'uppercase' }}>Vehicle Handover Details</div>
                {[
                  ['Vehicle No.', vehicleNo], ['Replacement No.', replacementNo], ['Make', make],
                  ['Model', model], ['Mileage Out', mileageOut], ['Mileage In', mileageIn],
                  ['Out Date', outDate], ['Out Time', outTime], ['Contract Period', contractPeriod],
                ].map(([label, value]) => (
                  <div key={String(label)} style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                    <span style={{ color: '#555', minWidth: '90px', fontSize: '9px' }}>{label}:</span>
                    <span style={{ borderBottom: '1px dotted #999', flex: 1, fontSize: '9px' }}>{value || ''}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
                  <span style={{ color: '#555', minWidth: '90px', fontSize: '9px' }}>Petrol Out:</span>
                  <span style={{ fontSize: '9px' }}>{petrolOut || '—'}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                  <span style={{ color: '#555', minWidth: '90px', fontSize: '9px' }}>Petrol In:</span>
                  <span style={{ fontSize: '9px' }}>{petrolIn || '—'}</span>
                </div>
                <div style={{ fontSize: '9px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', marginBottom: '4px' }}>
                  <span>Spare Tyre: <strong>{formatYN(spareTyre)}</strong></span>
                  <span>Tool Kit: <strong>{formatYN(toolkit)}</strong></span>
                  <span>Car Camera: <strong>{formatYN(carCamera)}</strong></span>
                  <span>PHV Decal: <strong>{formatYN(phvDecal)}</strong></span>
                </div>
                <div style={{ fontSize: '9px', marginBottom: '4px' }}>
                  <span>3rd Party Excess: S$ {tpExcess || '—'} &nbsp; Own Damage: S$ {odExcess || '—'} &nbsp; Windscreen: S$ {wsExcess || '—'}</span>
                </div>
                <div style={{ fontSize: '9px' }}>Checked Out By: <span style={{ borderBottom: '1px dotted #999', minWidth: '60px', display: 'inline-block' }}>{checkedOutBy}</span></div>
              </div>

              {/* Car diagrams in print */}
              <div style={{ border: '1px solid #000', padding: '6px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}>Damage Diagram</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <svg viewBox="0 0 400 140" width="100%" style={{ maxWidth: '100%' }}>
                    <path d="M 40 90 L 40 70 L 80 40 L 160 28 L 280 28 L 330 40 L 360 70 L 360 90 Z" fill="none" stroke="#000" strokeWidth="1.5" />
                    <path d="M 280 28 L 320 40 L 310 68 L 265 68 Z" fill="none" stroke="#000" strokeWidth="1" />
                    <path d="M 110 68 L 90 68 L 80 40 L 130 28 Z" fill="none" stroke="#000" strokeWidth="1" />
                    <rect x="130" y="32" width="60" height="36" rx="3" fill="none" stroke="#000" strokeWidth="1" />
                    <rect x="200" y="32" width="58" height="36" rx="3" fill="none" stroke="#000" strokeWidth="1" />
                    <line x1="195" y1="30" x2="195" y2="90" stroke="#000" strokeWidth="0.8" />
                    <line x1="265" y1="30" x2="265" y2="90" stroke="#000" strokeWidth="0.8" />
                    <circle cx="100" cy="95" r="18" fill="none" stroke="#000" strokeWidth="1.5" />
                    <circle cx="300" cy="95" r="18" fill="none" stroke="#000" strokeWidth="1.5" />
                    <path d="M 40 70 L 30 75 L 30 95 L 40 95" fill="none" stroke="#000" strokeWidth="1" />
                    <path d="M 360 70 L 370 75 L 370 95 L 360 95" fill="none" stroke="#000" strokeWidth="1" />
                    <text x="200" y="130" textAnchor="middle" fill="#666" fontSize="10">Side View</text>
                    {markers.filter(m => m.viewId === 'side').map(m => (
                      <g key={m.id}>
                        <circle cx={m.x} cy={m.y} r="8" fill="red" stroke="white" strokeWidth="1" />
                        <text x={m.x} y={m.y + 3} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{m.id}</text>
                      </g>
                    ))}
                  </svg>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <svg viewBox="0 0 400 180" style={{ flex: 2 }}>
                      <rect x="80" y="20" width="240" height="140" rx="30" fill="none" stroke="#000" strokeWidth="1.5" />
                      <path d="M 110 20 L 290 20 L 280 55 L 120 55 Z" fill="none" stroke="#000" strokeWidth="1" />
                      <path d="M 120 125 L 280 125 L 290 160 L 110 160 Z" fill="none" stroke="#000" strokeWidth="1" />
                      <rect x="120" y="55" width="160" height="70" rx="5" fill="none" stroke="#000" strokeWidth="0.8" />
                      <line x1="80" y1="90" x2="320" y2="90" stroke="#ccc" strokeWidth="0.8" strokeDasharray="3,2" />
                      <line x1="175" y1="55" x2="175" y2="125" stroke="#ccc" strokeWidth="0.8" />
                      <line x1="225" y1="55" x2="225" y2="125" stroke="#ccc" strokeWidth="0.8" />
                      <rect x="55" y="22" width="35" height="50" rx="8" fill="none" stroke="#000" strokeWidth="1" />
                      <rect x="310" y="22" width="35" height="50" rx="8" fill="none" stroke="#000" strokeWidth="1" />
                      <rect x="55" y="108" width="35" height="50" rx="8" fill="none" stroke="#000" strokeWidth="1" />
                      <rect x="310" y="108" width="35" height="50" rx="8" fill="none" stroke="#000" strokeWidth="1" />
                      <text x="200" y="175" textAnchor="middle" fill="#666" fontSize="10">Top View</text>
                      {markers.filter(m => m.viewId === 'top').map(m => (
                        <g key={m.id}>
                          <circle cx={m.x} cy={m.y} r="8" fill="red" stroke="white" strokeWidth="1" />
                          <text x={m.x} y={m.y + 3} textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">{m.id}</text>
                        </g>
                      ))}
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <svg viewBox="0 0 160 120" style={{ width: '100%' }}>
                        <path d="M 10 80 L 10 50 L 25 30 L 135 30 L 150 50 L 150 80 Z" fill="none" stroke="#000" strokeWidth="1.5" />
                        <path d="M 25 30 L 135 30 L 130 20 L 30 20 Z" fill="none" stroke="#000" strokeWidth="1" />
                        <path d="M 35 30 L 125 30 L 120 55 L 40 55 Z" fill="none" stroke="#000" strokeWidth="1" />
                        <rect x="12" y="42" width="28" height="18" rx="4" fill="none" stroke="#000" strokeWidth="1" />
                        <rect x="120" y="42" width="28" height="18" rx="4" fill="none" stroke="#000" strokeWidth="1" />
                        <rect x="55" y="62" width="50" height="14" rx="3" fill="none" stroke="#000" strokeWidth="1" />
                        <path d="M 8 78 L 152 78 L 152 88 L 8 88 Z" fill="none" stroke="#000" strokeWidth="1" />
                        <text x="80" y="112" textAnchor="middle" fill="#666" fontSize="9">Front</text>
                        {markers.filter(m => m.viewId === 'front').map(m => (
                          <g key={m.id}>
                            <circle cx={m.x} cy={m.y} r="7" fill="red" stroke="white" strokeWidth="1" />
                            <text x={m.x} y={m.y + 3} textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">{m.id}</text>
                          </g>
                        ))}
                      </svg>
                      <svg viewBox="0 0 160 120" style={{ width: '100%' }}>
                        <path d="M 10 80 L 10 50 L 25 30 L 135 30 L 150 50 L 150 80 Z" fill="none" stroke="#000" strokeWidth="1.5" />
                        <path d="M 30 20 L 130 20 L 135 30 L 25 30 Z" fill="none" stroke="#000" strokeWidth="1" />
                        <path d="M 40 55 L 120 55 L 125 30 L 35 30 Z" fill="none" stroke="#000" strokeWidth="1" />
                        <rect x="12" y="42" width="28" height="18" rx="4" fill="none" stroke="#000" strokeWidth="1" />
                        <rect x="120" y="42" width="28" height="18" rx="4" fill="none" stroke="#000" strokeWidth="1" />
                        <rect x="55" y="62" width="50" height="14" rx="2" fill="none" stroke="#000" strokeWidth="1" />
                        <path d="M 8 78 L 152 78 L 152 88 L 8 88 Z" fill="none" stroke="#000" strokeWidth="1" />
                        <text x="80" y="112" textAnchor="middle" fill="#666" fontSize="9">Rear</text>
                        {markers.filter(m => m.viewId === 'rear').map(m => (
                          <g key={m.id}>
                            <circle cx={m.x} cy={m.y} r="7" fill="red" stroke="white" strokeWidth="1" />
                            <text x={m.x} y={m.y + 3} textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">{m.id}</text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Damage notes in print */}
                {markers.length > 0 && (
                  <div style={{ marginTop: '6px', borderTop: '1px solid #ccc', paddingTop: '4px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '9px', marginBottom: '2px' }}>Damage Notes:</div>
                    {markers.map(m => (
                      <div key={m.id} style={{ fontSize: '9px', display: 'flex', gap: '4px' }}>
                        <span style={{ color: 'red', fontWeight: 'bold', minWidth: '16px' }}>{m.id}.</span>
                        <span>[{m.viewId}]</span>
                        <span>{m.description || '(no description)'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Important Notice */}
          <div style={{ border: '1px solid #000', padding: '6px', marginTop: '8px', fontSize: '8px' }}>
            <strong>IMPORTANT NOTICE:</strong> Please inspect the vehicle before taking possession. Any damage not noted on this form will be the hirer's responsibility.
            Hirer acknowledges receipt of vehicle in the condition noted above and agrees to the terms of the Rental Agreement.
          </div>

          {/* Return of Vehicle */}
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '2px', marginBottom: '4px' }}>Return of Vehicle</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  {['Date In', 'Time In', 'Mileage In', 'Checked By', 'Remarks', 'Hirer Signature'].map(h => (
                    <th key={h} style={{ border: '1px solid #000', padding: '3px 4px', textAlign: 'left', fontWeight: 'bold' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[returnDateIn, returnTimeIn, returnMileageIn, returnCheckedBy, returnRemarks, returnSignature].map((v, i) => (
                    <td key={i} style={{ border: '1px solid #000', padding: '3px 4px', minHeight: '20px', height: '22px' }}>{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signature lines */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '16px', fontSize: '9px' }}>
            <div>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '20px', marginBottom: '4px' }}></div>
              <div>Signed by Karkarr Rental Pte Ltd</div>
              <div style={{ color: '#555' }}>Authorised Signatory / Date</div>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '20px', marginBottom: '4px' }}></div>
              <div>Hirer's Signature</div>
              <div style={{ color: '#555' }}>Name / NRIC / Date</div>
            </div>
          </div>
        </div>

        {/* PAGE 2: Terms & Conditions */}
        <div className="print-page" style={{ padding: '8mm' }}>
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            SCHEDULE — Terms & Conditions
          </div>
          <div style={{ fontSize: '8.5px', lineHeight: '1.5', columns: '2', columnGap: '12px' }}>
            <p>This is a Lease Agreement made between us, Karkarr Rental Pte Ltd (hereinafter referred to as the "Owner") and the Hirer named in this agreement.</p>
            <ol style={{ paddingLeft: '14px', margin: '4px 0' }}>
              <li style={{ marginBottom: '3px' }}>Only the Hirer is allowed to drive the rental vehicle. Additional driver(s) is subjected to the Owner's approval and must be declared.</li>
              <li style={{ marginBottom: '3px' }}>The vehicle is not allowed to be sub-let without the Owner's consent.</li>
              <li style={{ marginBottom: '3px' }}>The Owner will arrange for third party insurance coverage:
                <ol type="a" style={{ paddingLeft: '12px' }}>
                  <li>Third Party Excess: S$ {tpExcess || '___'}</li>
                  <li>Own Damage Excess: S$ {odExcess || '___'}</li>
                </ol>
              </li>
              <li style={{ marginBottom: '3px' }}>Deposits are not refundable for cancellation or early termination of contract.</li>
              <li style={{ marginBottom: '3px' }}>The excess amount will be double: (i) For Hirer's driving experience more than 1 year but less than 2 years. (ii) When travelling out of Singapore.</li>
              <li style={{ marginBottom: '3px' }}>Vehicle must be returned in the same condition as collected. The following will incur additional charges:
                <ol type="a" style={{ paddingLeft: '12px' }}>
                  <li>Cigarette smell or pet hair is found in the cabin</li>
                  <li>Vomit or other stains in the vehicle</li>
                  <li>Burnt marks and/or damage to the upholstery, dashboard or interior of the vehicle</li>
                  <li>Scratch, dent or damage to the exterior of vehicle</li>
                  <li>Excessive dirt in/on the vehicle</li>
                  <li>Lost of key</li>
                  <li>Damage to the windscreen, window panels and/or rims/tyres: S$300 (Japanese/Korean Cars), S$500 (European Cars).</li>
                </ol>
              </li>
              <li style={{ marginBottom: '3px' }}>Fuel level of vehicle returned must be the same or above the level when collected. Surcharge of $15 will be levied for every incremental level.</li>
              <li style={{ marginBottom: '3px' }}>Any breakdown of vehicle due to empty tank, punctured tyre, key being locked inside the vehicle or any event resulting in the breakdown of the vehicle due to negligence or willful act shall be liable for a charge of S$100.00 for towing service in mainland Singapore.</li>
              <li style={{ marginBottom: '3px' }}>The Owner is not liable for anything the hirer left behind in vehicle after return.</li>
              <li style={{ marginBottom: '3px' }}>The Hirer will be liable to pay an administrative fee of $50 and a late payment interest computed at a rate of 5% per month if the rental fee and/or other payment(s) remain unpaid for more than 7 calendar days from the due date.</li>
              <li style={{ marginBottom: '3px' }}>Thereafter, the Owner at its sole discretion, will reserve all rights to repossess the vehicle by lodging a lost vehicle report with the police and/or engaging a vehicle repossession team to retrieve the vehicle.</li>
              <li style={{ marginBottom: '3px' }}>The Hirer will be deemed to have breached the agreement, rendering it null and void. The security deposit will be forfeited and the hirer is also liable to reimburse the Owner the cost of repossessing the vehicle.</li>
              <li style={{ marginBottom: '3px' }}>The Hirer must ensure that the vehicle has reasonable fuel, engine oil, auto transmission oil and radiator water at all times.</li>
              <li style={{ marginBottom: '3px' }}>Extension of Lease period must be notified 24 hours in advance of expiry lease. Failing which, the Owner will levy an administration fee of S$100.</li>
              <li style={{ marginBottom: '3px' }}>Entry into Malaysia: a. Levy of S$25.00 a day. b. Levy of S$50.00 a day for Malacca and beyond. c. Non declaration of the above will incur a penalty of S$3000.00.</li>
              <li style={{ marginBottom: '3px' }}>Late return of the vehicle will be charged as follows: a. S$30.00 for every 2 hour block.</li>
              <li style={{ marginBottom: '3px' }}>In an unfortunate event of accident, the Hirer must inform the Owner immediately and repairs of any sort are to be carried out at authorised workshops only. Non declaration of the above will incur a penalty of S$3000.00.</li>
              <li style={{ marginBottom: '3px' }}>The vehicle is NOT covered by motor insurance policy covering personal accident insurance for the Hirer. The Hirer is advised to make their own personal accident insurance arrangements.</li>
              <li style={{ marginBottom: '3px' }}>The Hirer is not allowed to use the vehicle for driving tuition, racing, pace-making, competing in any form of motor sport, drug-trafficking, smuggling of contraband cigarettes or any illegal purposes whatsoever.</li>
            </ol>
          </div>

          {/* Final signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px', fontSize: '9px' }}>
            <div>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '28px', marginBottom: '4px' }}></div>
              <div style={{ fontWeight: 'bold' }}>Signed by Karkarr Rental Pte Ltd</div>
              <div style={{ color: '#555' }}>Authorised Signatory / Date</div>
            </div>
            <div>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: '28px', marginBottom: '4px' }}></div>
              <div style={{ fontWeight: 'bold' }}>Hirer's Signature</div>
              <div style={{ color: '#555' }}>Name / NRIC / Date</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
